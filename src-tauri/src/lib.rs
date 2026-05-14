mod commands;
mod core;
mod error;
mod pdf;
mod text;

use commands::batch::BatchHandle;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(BatchHandle::new())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::preview::get_page_info,
            commands::fonts::list_system_fonts,
            commands::batch::batch_process,
            commands::batch::batch_pause,
            commands::batch::batch_resume,
            commands::batch::batch_cancel,
            commands::dialogs::scan_pdf_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
