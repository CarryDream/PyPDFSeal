mod commands;
mod core;
mod error;
mod pdf;
mod text;

use commands::batch::BatchHandle;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{
    Emitter, Manager, WindowEvent,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum CloseBehavior {
    MinimizeToTray,
    MinimizeToTaskbar,
    Exit,
}

impl Default for CloseBehavior {
    fn default() -> Self {
        Self::MinimizeToTray
    }
}

struct AppSettingsState {
    close_behavior: Mutex<CloseBehavior>,
}

impl AppSettingsState {
    fn new() -> Self {
        Self {
            close_behavior: Mutex::new(CloseBehavior::default()),
        }
    }
}

#[tauri::command]
fn set_close_behavior(
    behavior: CloseBehavior,
    state: tauri::State<'_, AppSettingsState>,
) -> Result<(), String> {
    *state.close_behavior.lock().map_err(|e| e.to_string())? = behavior;
    Ok(())
}

#[tauri::command]
fn get_app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[tauri::command]
fn show_main_window(app: tauri::AppHandle) -> Result<(), String> {
    show_main_window_impl(&app).map_err(|e| e.to_string())
}

fn show_main_window_impl<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        window.unminimize()?;
        window.show()?;
        window.set_focus()?;
    }
    Ok(())
}

fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItemBuilder::with_id("show", "显示主窗口").build(app)?;
    let settings = MenuItemBuilder::with_id("settings", "设置").build(app)?;
    let check_update = MenuItemBuilder::with_id("check_update", "检查更新").build(app)?;
    let about = MenuItemBuilder::with_id("about", "关于").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "退出").build(app)?;
    let menu = MenuBuilder::new(app)
        .items(&[&show, &settings, &check_update, &about, &quit])
        .build()?;

    let mut tray = TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("PyPDFSeal")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => {
                let _ = show_main_window_impl(app);
            }
            "settings" => {
                let _ = show_main_window_impl(app);
                let _ = app.emit("show-settings-requested", ());
            }
            "check_update" => {
                let _ = show_main_window_impl(app);
                let _ = app.emit("check-update-requested", ());
            }
            "about" => {
                let _ = show_main_window_impl(app);
                let _ = app.emit("show-about-requested", ());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let _ = show_main_window_impl(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        tray = tray.icon(icon);
    }

    tray.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(BatchHandle::new())
        .manage(AppSettingsState::new())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            build_tray(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }

            if let WindowEvent::CloseRequested { api, .. } = event {
                let behavior = window
                    .state::<AppSettingsState>()
                    .close_behavior
                    .lock()
                    .map(|guard| *guard)
                    .unwrap_or_default();

                match behavior {
                    CloseBehavior::MinimizeToTray => {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                    CloseBehavior::MinimizeToTaskbar => {
                        api.prevent_close();
                        let _ = window.minimize();
                    }
                    CloseBehavior::Exit => {}
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_app_version,
            set_close_behavior,
            show_main_window,
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
