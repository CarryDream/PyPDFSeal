pub mod batch;
pub mod dialogs;
pub mod fonts;
pub mod preview;

#[tauri::command]
pub fn ping() -> String {
    "pong".to_string()
}
