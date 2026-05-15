use crate::core::models::SealOptions;
use crate::db::{BatchRunSummary, Database};
use crate::error::AppError;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::{Emitter, Manager};

struct BatchState {
    paused: AtomicBool,
    cancelled: AtomicBool,
}

/// Managed wrapper — registered once at app setup.
pub struct BatchHandle(Mutex<Option<Arc<BatchState>>>);

impl BatchHandle {
    pub fn new() -> Self {
        Self(Mutex::new(None))
    }

    fn set(&self, state: Arc<BatchState>) {
        *self.0.lock().unwrap() = Some(state);
    }

    fn get(&self) -> Option<Arc<BatchState>> {
        self.0.lock().unwrap().clone()
    }

    fn clear(&self) {
        *self.0.lock().unwrap() = None;
    }
}

#[tauri::command]
pub async fn batch_process(
    app: tauri::AppHandle,
    files: Vec<String>,
    options: SealOptions,
) -> Result<(), String> {
    if files.is_empty() {
        return Err("no files selected".into());
    }

    let handle = app.state::<BatchHandle>();
    if handle.get().is_some() {
        return Err("batch is already running".into());
    }

    let state = Arc::new(BatchState {
        paused: AtomicBool::new(false),
        cancelled: AtomicBool::new(false),
    });
    handle.set(state.clone());

    let total = files.len();
    let app_for_task = app.clone();

    tokio::task::spawn_blocking(move || {
        let batch_start = Instant::now();

        // Prepare DB: clear history, import files, create batch run
        let db = app_for_task.state::<Database>();
        if let Err(e) = db.clear_history() {
            eprintln!("DB clear_history error: {e}");
        }
        let file_ids = match db.import_files(&files) {
            Ok(ids) => ids,
            Err(e) => {
                eprintln!("DB import_files error: {e}");
                app_for_task.state::<BatchHandle>().clear();
                return;
            }
        };
        let run_id = match db.create_batch_run() {
            Ok(id) => id,
            Err(e) => {
                eprintln!("DB create_batch_run error: {e}");
                app_for_task.state::<BatchHandle>().clear();
                return;
            }
        };
        let _ = db.set_batch_run_total(run_id, total as u32);
        let _ = db.assign_files_to_run(run_id);
        drop(db);
        let mut succeeded: u32 = 0;
        let mut failed: u32 = 0;
        let mut skipped: u32 = 0;
        let mut cancelled: u32 = 0;

        for (i, file) in files.iter().enumerate() {
            if state.cancelled.load(Ordering::Relaxed) {
                cancelled += (total - i) as u32;
                let _ = app_for_task.emit(
                    "batch-progress",
                    serde_json::json!({
                        "done": i,
                        "total": total,
                        "file": file,
                        "status": "cancelled",
                    }),
                );
                break;
            }

            // Busy-wait for unpause with short sleep to avoid spinning
            while state.paused.load(Ordering::Relaxed) {
                if state.cancelled.load(Ordering::Relaxed) {
                    cancelled += (total - i) as u32;
                    let _ = app_for_task.emit(
                        "batch-progress",
                        serde_json::json!({
                            "done": i,
                            "total": total,
                            "file": file,
                            "status": "cancelled",
                        }),
                    );
                    // Write batch summary and return
                    let elapsed = batch_start.elapsed().as_millis() as u64;
                    let db = app_for_task.state::<Database>();
                    let _ = db.update_file_status(file_ids[i], "fail", None, Some("已取消"), None);
                    let _ = db.finish_batch_run(run_id, &BatchRunSummary {
                        total: total as u32,
                        succeeded,
                        failed,
                        skipped,
                        cancelled,
                        elapsed_ms: elapsed,
                    });
                    app_for_task.state::<BatchHandle>().clear();
                    return;
                }
                std::thread::sleep(std::time::Duration::from_millis(100));
            }

            // Mark file as processing in DB
            {
                let db = app_for_task.state::<Database>();
                let _ = db.update_file_status(file_ids[i], "processing", None, None, None);
            }

            let file_start = Instant::now();
            let result = crate::core::pipeline::process_task(file, &options);
            let file_elapsed = file_start.elapsed().as_millis() as i64;

            let (status, output, error) = match result {
                Ok(output) => {
                    succeeded += 1;
                    ("ok".to_string(), Some(output.clone()), None)
                }
                Err(AppError::Signature(message))
                    if message.contains("already contains a signature") =>
                {
                    skipped += 1;
                    (
                        "skipped".to_string(),
                        None,
                        Some("已包含数字签名，跳过以避免破坏原签名".to_string()),
                    )
                }
                Err(e) => {
                    failed += 1;
                    ("error".to_string(), None, Some(e.to_string()))
                }
            };

            // Update DB with result
            {
                let db = app_for_task.state::<Database>();
                let db_status = match status.as_str() {
                    "ok" => "success",
                    "skipped" => "skip",
                    _ => "fail",
                };
                let _ = db.update_file_status(
                    file_ids[i],
                    db_status,
                    output.as_deref(),
                    error.as_deref(),
                    Some(file_elapsed),
                );
            }

            let _ = app_for_task.emit(
                "batch-progress",
                serde_json::json!({
                    "done": i + 1,
                    "total": total,
                    "file": file,
                    "status": status,
                    "output": output,
                    "error": error,
                }),
            );
        }

        // Write batch summary
        let elapsed = batch_start.elapsed().as_millis() as u64;
        {
            let db = app_for_task.state::<Database>();
            let _ = db.finish_batch_run(
                run_id,
                &BatchRunSummary {
                    total: total as u32,
                    succeeded,
                    failed,
                    skipped,
                    cancelled,
                    elapsed_ms: elapsed,
                },
            );
        }

        app_for_task.state::<BatchHandle>().clear();
    });

    Ok(())
}

#[tauri::command]
pub fn batch_pause(app: tauri::AppHandle) {
    if let Some(state) = app.state::<BatchHandle>().get() {
        state.paused.store(true, Ordering::Relaxed);
    }
}

#[tauri::command]
pub fn batch_resume(app: tauri::AppHandle) {
    if let Some(state) = app.state::<BatchHandle>().get() {
        state.paused.store(false, Ordering::Relaxed);
    }
}

#[tauri::command]
pub fn batch_cancel(app: tauri::AppHandle) {
    if let Some(state) = app.state::<BatchHandle>().get() {
        state.cancelled.store(true, Ordering::Relaxed);
    }
}
