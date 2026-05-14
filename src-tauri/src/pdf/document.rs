use lopdf::Document;
use lopdf::Object;

use crate::error::{AppError, Result};

pub fn object_to_f64(obj: &Object) -> Result<f64> {
    match obj {
        Object::Integer(v) => Ok(*v as f64),
        Object::Real(v) => Ok(*v as f64),
        other => Err(AppError::Pdf(format!(
            "expected numeric PDF object, got {:?}",
            other
        ))),
    }
}

pub fn page_dimensions(doc: &Document, page_id: lopdf::ObjectId) -> Result<(f64, f64)> {
    let media_box = inherited_page_array(doc, page_id, b"MediaBox")?
        .ok_or_else(|| AppError::Pdf("page has no MediaBox".into()))?;

    if media_box.len() < 4 {
        return Err(AppError::Pdf(
            "page MediaBox has fewer than 4 values".into(),
        ));
    }

    let x1 = object_to_f64(&media_box[0])?;
    let y1 = object_to_f64(&media_box[1])?;
    let x2 = object_to_f64(&media_box[2])?;
    let y2 = object_to_f64(&media_box[3])?;

    Ok(((x2 - x1).abs(), (y2 - y1).abs()))
}

pub fn document_page_dimensions(doc: &Document) -> Result<Vec<(f64, f64)>> {
    doc.get_pages()
        .values()
        .map(|page_id| page_dimensions(doc, *page_id))
        .collect()
}

fn inherited_page_array(
    doc: &Document,
    mut node_id: lopdf::ObjectId,
    key: &[u8],
) -> Result<Option<Vec<Object>>> {
    for _ in 0..32 {
        let dict = doc
            .get_object(node_id)
            .map_err(|e| AppError::Pdf(e.to_string()))?
            .as_dict()
            .map_err(|e| AppError::Pdf(e.to_string()))?;

        if let Ok(value) = dict.get(key) {
            return value
                .as_array()
                .map(|arr| Some(arr.clone()))
                .map_err(|e| AppError::Pdf(e.to_string()));
        }

        match dict.get(b"Parent").and_then(Object::as_reference) {
            Ok(parent_id) => node_id = parent_id,
            Err(_) => return Ok(None),
        }
    }

    Err(AppError::Pdf("page tree inheritance depth exceeded".into()))
}
