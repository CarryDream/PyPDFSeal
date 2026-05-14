use crate::error::{AppError, Result};
use lopdf::Object;
use lopdf::content::Content;

/// A text span found in a PDF page with its position.
#[derive(Debug, Clone)]
pub struct TextSpan {
    pub text: String,
    /// X position in PDF points (from left).
    pub x: f64,
    /// Y position in PDF points (from bottom).
    pub y: f64,
}

/// Extract all positioned text spans from a page.
pub fn extract_page_text(doc: &lopdf::Document, page_id: lopdf::ObjectId) -> Result<Vec<TextSpan>> {
    let page = doc
        .get_object(page_id)
        .map_err(|e| AppError::Pdf(e.to_string()))?;
    let page_dict = page.as_dict().map_err(|e| AppError::Pdf(e.to_string()))?;

    // Get content streams (may be an array of references)
    let contents_obj = page_dict
        .get(b"Contents")
        .map_err(|e| AppError::Pdf(e.to_string()))?;

    let content_bytes = match contents_obj {
        Object::Reference(ref_id) => {
            let obj = doc
                .get_object(*ref_id)
                .map_err(|e| AppError::Pdf(e.to_string()))?;
            if let Object::Stream(stream) = obj {
                stream
                    .decompressed_content()
                    .unwrap_or_else(|_| stream.content.clone())
            } else {
                return Ok(vec![]);
            }
        }
        Object::Array(arr) => {
            let mut combined = Vec::new();
            for item in arr {
                if let Object::Reference(ref_id) = item {
                    let obj = doc
                        .get_object(*ref_id)
                        .map_err(|e| AppError::Pdf(e.to_string()))?;
                    if let Object::Stream(stream) = obj {
                        let data = stream
                            .decompressed_content()
                            .unwrap_or_else(|_| stream.content.clone());
                        combined.extend_from_slice(&data);
                        combined.push(b'\n');
                    }
                }
            }
            combined
        }
        _ => return Ok(vec![]),
    };

    let content = Content::decode(&content_bytes)
        .map_err(|e| AppError::Pdf(format!("Content stream decode error: {}", e)))?;

    let mut spans = Vec::new();
    // Text matrix state: [a, b, c, d, e, f] where e=tx, f=ty
    let mut tm = [1.0f64, 0.0, 0.0, 1.0, 0.0, 0.0];
    let mut tm_stack = Vec::new();
    let mut in_text = false;
    let mut current_font_size = 12.0f64;

    for operation in &content.operations {
        match operation.operator.as_str() {
            "BT" => {
                in_text = true;
                tm = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];
            }
            "ET" => {
                in_text = false;
            }
            "Tf" => {
                // Set font: /F1 12 Tf
                if let Some(Object::Integer(sz)) = operation.operands.get(1) {
                    current_font_size = *sz as f64;
                } else if let Some(Object::Real(sz)) = operation.operands.get(1) {
                    current_font_size = *sz as f64;
                }
            }
            "Tm" if operation.operands.len() >= 6 => {
                // Set text matrix: a b c d e f Tm
                tm[0] = op_to_f64(&operation.operands[0]);
                tm[1] = op_to_f64(&operation.operands[1]);
                tm[2] = op_to_f64(&operation.operands[2]);
                tm[3] = op_to_f64(&operation.operands[3]);
                tm[4] = op_to_f64(&operation.operands[4]);
                tm[5] = op_to_f64(&operation.operands[5]);
            }
            "Td" | "TD" if operation.operands.len() >= 2 => {
                // Move to next line: tx ty Td
                let tx = op_to_f64(&operation.operands[0]);
                let ty = op_to_f64(&operation.operands[1]);
                tm[4] += tx;
                tm[5] += ty;
            }
            "Tj" if in_text => {
                // Show string: (text) Tj
                if let Some(text) = op_to_string(operation.operands.first()) {
                    let x = tm[4];
                    let y = tm[5];
                    let width = estimate_text_width(&text, current_font_size);
                    spans.push(TextSpan { text, x, y });
                    // Advance cursor
                    tm[4] += width;
                }
            }
            "TJ" if in_text => {
                // Show text with positioning: [(...) num (...) num] TJ
                if let Some(Object::Array(arr)) = operation.operands.first() {
                    let mut x = tm[4];
                    let y = tm[5];
                    let mut combined = String::new();
                    for item in arr {
                        match item {
                            Object::String(bytes, _) => {
                                let s = pdf_string_to_string(bytes);
                                combined.push_str(&s);
                            }
                            Object::Integer(offset) => {
                                // Kerning offset (in thousandths of text space)
                                x -= *offset as f64 * current_font_size / 1000.0;
                            }
                            Object::Real(offset) => {
                                x -= *offset as f64 * current_font_size / 1000.0;
                            }
                            _ => {}
                        }
                    }
                    if !combined.is_empty() {
                        let width = estimate_text_width(&combined, current_font_size);
                        spans.push(TextSpan {
                            text: combined,
                            x,
                            y,
                        });
                        tm[4] = x + width;
                    }
                }
            }
            "T*" => {
                // Move to start of next line
                tm[5] -= current_font_size * 1.2;
                tm[4] = 0.0;
            }
            "q" => {
                tm_stack.push(tm);
            }
            "Q" => {
                if let Some(saved) = tm_stack.pop() {
                    tm = saved;
                }
            }
            _ => {}
        }
    }

    Ok(spans)
}

/// Search for a keyword in the page text and return matching positions.
pub fn search_text_in_page(
    doc: &lopdf::Document,
    page_id: lopdf::ObjectId,
    keyword: &str,
) -> Result<Vec<TextSpan>> {
    if keyword.trim().is_empty() {
        return Ok(Vec::new());
    }

    let spans = extract_page_text(doc, page_id)?;
    let keyword_lower = keyword.to_lowercase();

    let mut results = Vec::new();
    for span in &spans {
        if span.text.to_lowercase().contains(&keyword_lower) {
            results.push(span.clone());
        }
    }

    Ok(results)
}

fn op_to_f64(obj: &Object) -> f64 {
    match obj {
        Object::Integer(i) => *i as f64,
        Object::Real(f) => *f as f64,
        _ => 0.0,
    }
}

fn op_to_string(obj: Option<&Object>) -> Option<String> {
    match obj {
        Some(Object::String(bytes, _)) => Some(pdf_string_to_string(bytes)),
        _ => None,
    }
}

fn pdf_string_to_string(bytes: &[u8]) -> String {
    // PDF strings are typically PDFDocEncoding or UTF-16BE
    if bytes.len() >= 2 && bytes[0] == 0xFE && bytes[1] == 0xFF {
        // UTF-16BE BOM
        let mut chars = Vec::new();
        let mut i = 2;
        while i + 1 < bytes.len() {
            let code = ((bytes[i] as u16) << 8) | (bytes[i + 1] as u16);
            chars.push(code);
            i += 2;
        }
        String::from_utf16_lossy(&chars)
    } else {
        // PDFDocEncoding (superset of Latin-1)
        bytes.iter().map(|&b| b as char).collect()
    }
}

/// Estimate text width based on character count and font size.
/// This is a rough approximation; real PDF text width depends on the font metrics.
fn estimate_text_width(text: &str, font_size: f64) -> f64 {
    // Average character width is roughly 0.5 * font_size for Latin characters,
    // and 1.0 * font_size for CJK characters.
    let mut width = 0.0;
    for ch in text.chars() {
        if ch.is_ascii() {
            width += font_size * 0.5;
        } else {
            width += font_size * 1.0;
        }
    }
    width
}
