use std::path::Path;

/// Scan a directory for PDF files (non-recursive).
#[tauri::command]
pub fn scan_pdf_dir(dir: String) -> Result<Vec<String>, String> {
    let path = Path::new(&dir);
    if !path.is_dir() {
        return Err(format!("Not a directory: {}", dir));
    }

    let mut pdfs = Vec::new();
    let entries = std::fs::read_dir(path).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let p = entry.path();
        if p.is_file()
            && let Some(ext) = p.extension()
            && ext.eq_ignore_ascii_case("pdf")
        {
            pdfs.push(p.to_string_lossy().to_string());
        }
    }

    pdfs.sort();
    Ok(pdfs)
}
