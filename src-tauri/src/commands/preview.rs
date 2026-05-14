use crate::pdf::document;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct PageInfo {
    pub width_pt: f64,
    pub height_pt: f64,
}

#[derive(Debug, Serialize)]
pub struct DocumentInfo {
    pub pages: Vec<PageInfo>,
    pub total_pages: usize,
}

#[tauri::command]
pub fn get_page_info(path: String) -> Result<DocumentInfo, String> {
    let doc = lopdf::Document::load(&path).map_err(|e| e.to_string())?;
    let page_ids = doc.get_pages();

    let mut pages = Vec::new();
    for page_id in page_ids.values() {
        let (width_pt, height_pt) =
            document::page_dimensions(&doc, *page_id).map_err(|e| e.to_string())?;

        pages.push(PageInfo {
            width_pt,
            height_pt,
        });
    }

    let total_pages = pages.len();
    Ok(DocumentInfo { pages, total_pages })
}
