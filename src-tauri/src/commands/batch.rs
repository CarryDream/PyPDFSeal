use crate::core::models::SealOptions;
use crate::error::AppError;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
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
        for (i, file) in files.iter().enumerate() {
            if state.cancelled.load(Ordering::Relaxed) {
                let _ = app_for_task.emit(
                    "batch-progress",
                    serde_json::json!({
                        "done": i,
                        "total": total,
                        "file": file,
                        "status": "cancelled",
                    }),
                );
                app_for_task.state::<BatchHandle>().clear();
                return;
            }

            // Busy-wait for unpause with short sleep to avoid spinning
            while state.paused.load(Ordering::Relaxed) {
                if state.cancelled.load(Ordering::Relaxed) {
                    let _ = app_for_task.emit(
                        "batch-progress",
                        serde_json::json!({
                            "done": i,
                            "total": total,
                            "file": file,
                            "status": "cancelled",
                        }),
                    );
                    app_for_task.state::<BatchHandle>().clear();
                    return;
                }
                std::thread::sleep(std::time::Duration::from_millis(100));
            }

            let result = crate::core::pipeline::process_task(file, &options);

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
