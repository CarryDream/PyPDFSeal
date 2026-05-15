use std::path::{Path, PathBuf};
use tauri::Emitter;

/// Scan a directory recursively for PDF files, emitting progress events.
#[tauri::command]
pub async fn scan_pdf_dir(app: tauri::AppHandle, dir: String) -> Result<Vec<String>, String> {
    let path = Path::new(&dir);
    if !path.is_dir() {
        return Err(format!("Not a directory: {}", dir));
    }

    let mut pdfs = Vec::new();
    let mut stack = vec![path.to_path_buf()];
    let mut scanned_dirs: u32 = 0;

    while let Some(current) = stack.pop() {
        scan_pdf_dir_entry(&current, &mut stack, &mut pdfs)?;
        scanned_dirs += 1;

        // Emit progress every 10 directories
        if scanned_dirs.is_multiple_of(10) {
            let _ = app.emit(
                "scan-progress",
                serde_json::json!({
                    "found": pdfs.len(),
                    "dirs": scanned_dirs,
                }),
            );
            tokio::task::yield_now().await;
        }
    }

    // Final progress
    let _ = app.emit(
        "scan-progress",
        serde_json::json!({
            "found": pdfs.len(),
            "dirs": scanned_dirs,
        }),
    );

    pdfs.sort();
    Ok(pdfs)
}

fn scan_pdf_dir_entry(
    dir: &Path,
    stack: &mut Vec<PathBuf>,
    pdfs: &mut Vec<String>,
) -> Result<(), String> {
    let entries = std::fs::read_dir(dir).map_err(|e| format!("{}: {}", dir.display(), e))?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        let p = entry.path();
        if file_type.is_dir() {
            stack.push(p);
        } else if file_type.is_file() && is_pdf_file(&p) {
            pdfs.push(p.to_string_lossy().to_string());
        }
    }
    Ok(())
}

fn is_pdf_file(path: &Path) -> bool {
    path.extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("pdf"))
}
