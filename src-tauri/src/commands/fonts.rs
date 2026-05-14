use font_kit::handle::Handle;
use font_kit::source::SystemSource;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct FontInfo {
    pub family: String,
    pub path: String,
}

#[tauri::command]
pub fn list_system_fonts() -> Result<Vec<FontInfo>, String> {
    let source = SystemSource::new();
    let fonts = source.all_fonts().map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for handle in fonts {
        if let Handle::Path { path, .. } = &handle
            && let Ok(font) = handle.load()
        {
            let family = font.family_name().to_string();
            result.push(FontInfo {
                family,
                path: path.to_string_lossy().to_string(),
            });
        }
    }

    result.sort_by(|a, b| a.family.cmp(&b.family));
    result.dedup_by(|a, b| a.family == b.family && a.path == b.path);
    Ok(result)
}
