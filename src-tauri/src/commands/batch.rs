use crate::core::models::SealOptions;
use crate::core::pipeline;
use crate::db::{BatchRunSummary, Database};
use crate::error::AppError;
use rayon::prelude::*;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, mpsc};
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

struct FileResult {
    index: usize,
    file: String,
    status: String,
    output: Option<String>,
    error: Option<String>,
    elapsed_ms: i64,
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

        // Pre-compute assets once (seal image, watermark, cert)
        let assets = match pipeline::PreparedAssets::prepare(&options) {
            Ok(a) => a,
            Err(e) => {
                eprintln!("PreparedAssets prepare error: {e}");
                app_for_task.state::<BatchHandle>().clear();
                return;
            }
        };

        // Channel for results from rayon workers
        let (tx, rx) = mpsc::channel::<FileResult>();

        // Process files in parallel with rayon
        let state_for_rayon = state.clone();
        rayon::scope(|s| {
            s.spawn(|_| {
                files
                    .par_iter()
                    .enumerate()
                    .for_each_with(tx, |tx, (i, file)| {
                        // Check cancel
                        if state_for_rayon.cancelled.load(Ordering::Relaxed) {
                            let _ = tx.send(FileResult {
                                index: i,
                                file: file.clone(),
                                status: "cancelled".into(),
                                output: None,
                                error: None,
                                elapsed_ms: 0,
                            });
                            return;
                        }

                        // Busy-wait for unpause
                        while state_for_rayon.paused.load(Ordering::Relaxed) {
                            if state_for_rayon.cancelled.load(Ordering::Relaxed) {
                                let _ = tx.send(FileResult {
                                    index: i,
                                    file: file.clone(),
                                    status: "cancelled".into(),
                                    output: None,
                                    error: None,
                                    elapsed_ms: 0,
                                });
                                return;
                            }
                            std::thread::sleep(std::time::Duration::from_millis(100));
                        }

                        let file_start = Instant::now();
                        let result = pipeline::process_task_with_assets(file, &options, &assets);
                        let file_elapsed = file_start.elapsed().as_millis() as i64;

                        let (status, output, error) = match result {
                            Ok(output) => ("ok".to_string(), Some(output), None),
                            Err(AppError::Signature(message))
                                if message.contains("already contains a signature") =>
                            {
                                (
                                    "skipped".to_string(),
                                    None,
                                    Some("已包含数字签名，跳过以避免破坏原签名".to_string()),
                                )
                            }
                            Err(e) => ("error".to_string(), None, Some(e.to_string())),
                        };

                        let _ = tx.send(FileResult {
                            index: i,
                            file: file.clone(),
                            status,
                            output,
                            error,
                            elapsed_ms: file_elapsed,
                        });
                    });
            });
        });

        // Collect results on main thread: update DB + emit progress
        let mut succeeded: u32 = 0;
        let mut failed: u32 = 0;
        let mut skipped: u32 = 0;
        let mut cancelled: u32 = 0;
        let mut done_count: u32 = 0;

        // Collect all results, batch write to DB
        let mut pending_results: Vec<FileResult> = Vec::new();

        for result in rx {
            pending_results.push(result);

            // Process in batches of 50 for DB writes
            if pending_results.len() >= 50 {
                flush_results(
                    &pending_results,
                    &file_ids,
                    &app_for_task,
                    &mut succeeded,
                    &mut failed,
                    &mut skipped,
                    &mut cancelled,
                    &mut done_count,
                    total,
                );
                pending_results.clear();
            }
        }

        // Flush remaining
        if !pending_results.is_empty() {
            flush_results(
                &pending_results,
                &file_ids,
                &app_for_task,
                &mut succeeded,
                &mut failed,
                &mut skipped,
                &mut cancelled,
                &mut done_count,
                total,
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

fn flush_results(
    results: &[FileResult],
    file_ids: &[i64],
    app: &tauri::AppHandle,
    succeeded: &mut u32,
    failed: &mut u32,
    skipped: &mut u32,
    cancelled: &mut u32,
    done_count: &mut u32,
    total: usize,
) {
    let db = app.state::<Database>();
    let mut entries: Vec<(i64, &str, Option<&str>, Option<&str>, Option<i64>)> = Vec::new();

    for r in results {
        let db_status = match r.status.as_str() {
            "ok" => "success",
            "skipped" => "skip",
            "cancelled" => "cancelled",
            _ => "fail",
        };

        entries.push((
            file_ids[r.index],
            db_status,
            r.output.as_deref(),
            r.error.as_deref(),
            Some(r.elapsed_ms),
        ));

        match r.status.as_str() {
            "ok" => {
                *succeeded += 1;
                *done_count += 1;
            }
            "skipped" => {
                *skipped += 1;
                *done_count += 1;
            }
            "cancelled" => {
                *cancelled += (total as u32) - *done_count;
                *done_count = total as u32;
            }
            _ => {
                *failed += 1;
                *done_count += 1;
            }
        }
    }

    let _ = db.update_files_status_batch(&entries);

    // Emit progress events
    for r in results {
        let _ = app.emit(
            "batch-progress",
            serde_json::json!({
                "done": *done_count,
                "total": total,
                "file": r.file,
                "status": r.status,
                "output": r.output,
                "error": r.error,
            }),
        );
    }
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
