use tauri::{Emitter, Manager};

use crate::db::{BatchFilesPage, Database};

#[tauri::command]
pub fn db_get_config(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let db = app.state::<Database>();
    let map = db.get_config().map_err(|e| e.to_string())?;
    let json_map: serde_json::Map<String, serde_json::Value> = map
        .into_iter()
        .filter_map(|(k, v)| {
            let val: serde_json::Value = serde_json::from_str(&v).unwrap_or(serde_json::Value::String(v));
            Some((k, val))
        })
        .collect();
    Ok(serde_json::Value::Object(json_map))
}

#[tauri::command]
pub fn db_set_config_batch(
    app: tauri::AppHandle,
    entries: Vec<(String, serde_json::Value)>,
) -> Result<(), String> {
    let db = app.state::<Database>();
    let str_entries: Vec<(String, String)> = entries
        .into_iter()
        .map(|(k, v)| {
            let s = match &v {
                serde_json::Value::String(s) => s.clone(),
                _ => serde_json::to_string(&v).unwrap_or_default(),
            };
            (k, s)
        })
        .collect();
    db.set_config_batch(&str_entries).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn db_import_files(app: tauri::AppHandle, files: Vec<String>) -> Result<Vec<i64>, String> {
    let db = app.state::<Database>();
    let total = files.len();
    let batch_size = 500;
    let mut all_ids = Vec::with_capacity(total);

    for (i, chunk) in files.chunks(batch_size).enumerate() {
        let ids = db.import_files(chunk).map_err(|e| e.to_string())?;
        all_ids.extend(ids);

        let done = (i + 1) * batch_size;
        let _ = app.emit(
            "import-progress",
            serde_json::json!({
                "done": done.min(total),
                "total": total,
            }),
        );
        tokio::task::yield_now().await;
    }

    Ok(all_ids)
}

#[tauri::command]
pub fn db_remove_file(app: tauri::AppHandle, id: i64) -> Result<(), String> {
    let db = app.state::<Database>();
    db.remove_file(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_get_files_page(
    app: tauri::AppHandle,
    page: u32,
    page_size: u32,
    status_filter: Option<String>,
) -> Result<BatchFilesPage, String> {
    let db = app.state::<Database>();
    db.get_files_page(page, page_size, status_filter.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_export_xlsx(app: tauri::AppHandle, save_path: String) -> Result<(), String> {
    let db = app.state::<Database>();
    db.export_to_xlsx(&save_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_clear_history(app: tauri::AppHandle) -> Result<(), String> {
    let db = app.state::<Database>();
    db.clear_history().map_err(|e| e.to_string())
}
