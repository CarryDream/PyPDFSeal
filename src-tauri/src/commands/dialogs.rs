use std::path::{Path, PathBuf};

/// Scan a directory recursively for PDF files.
#[tauri::command]
pub fn scan_pdf_dir(dir: String) -> Result<Vec<String>, String> {
    let path = Path::new(&dir);
    if !path.is_dir() {
        return Err(format!("Not a directory: {}", dir));
    }

    let mut pdfs = Vec::new();
    let mut stack = vec![path.to_path_buf()];

    while let Some(current) = stack.pop() {
        scan_pdf_dir_entry(&current, &mut stack, &mut pdfs)?;
    }

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
