use crate::error::{AppError, Result};
use lopdf::{Dictionary, Object};

/// Build a PDF signature dictionary and inject it into the document.
/// Returns the signature field name for ByteRange patching.
pub fn inject_signature_dict(
    doc: &mut lopdf::Document,
    reason: &str,
    location: &str,
    contact: &str,
    sig_content_len: usize,
) -> Result<(lopdf::ObjectId, lopdf::ObjectId)> {
    // Create signature dictionary
    let mut sig_dict = Dictionary::new();
    sig_dict.set("Type", Object::Name(b"Sig".to_vec()));
    sig_dict.set("Filter", Object::Name(b"Adobe.PPKLite".to_vec()));
    sig_dict.set("SubFilter", Object::Name(b"adbe.pkcs7.detached".to_vec()));

    // Wide placeholders leave enough bytes for the final numeric offsets.
    sig_dict.set(
        "ByteRange",
        Object::Array(vec![
            Object::Integer(999_999_999_999_999_999),
            Object::Integer(999_999_999_999_999_999),
            Object::Integer(999_999_999_999_999_999),
            Object::Integer(999_999_999_999_999_999),
        ]),
    );

    // Hexadecimal strings are serialized as two hex chars per byte.
    sig_dict.set(
        "Contents",
        Object::String(vec![0; sig_content_len], lopdf::StringFormat::Hexadecimal),
    );

    if !reason.is_empty() {
        sig_dict.set(
            "Reason",
            Object::String(reason.as_bytes().to_vec(), lopdf::StringFormat::Literal),
        );
    }
    if !location.is_empty() {
        sig_dict.set(
            "Location",
            Object::String(location.as_bytes().to_vec(), lopdf::StringFormat::Literal),
        );
    }
    if !contact.is_empty() {
        sig_dict.set(
            "ContactInfo",
            Object::String(contact.as_bytes().to_vec(), lopdf::StringFormat::Literal),
        );
    }

    let sig_id = doc.add_object(sig_dict);

    // Create signature form field
    let mut field_dict = Dictionary::new();
    field_dict.set("Type", Object::Name(b"Annot".to_vec()));
    field_dict.set("Subtype", Object::Name(b"Widget".to_vec()));
    field_dict.set("FT", Object::Name(b"Sig".to_vec()));
    field_dict.set("V", Object::Reference(sig_id));
    field_dict.set("F", Object::Integer(4)); // Print flag
    field_dict.set(
        "Rect",
        Object::Array(vec![
            Object::Integer(0),
            Object::Integer(0),
            Object::Integer(0),
            Object::Integer(0),
        ]),
    );

    let first_page_id = doc.get_pages().values().next().copied();
    if let Some(page_id) = first_page_id {
        field_dict.set("P", Object::Reference(page_id));
    }

    let field_id = doc.add_object(field_dict);
    if let Some(page_id) = first_page_id {
        append_annotation(doc, page_id, field_id)?;
    }

    append_acroform_field(doc, field_id)?;

    Ok((sig_id, field_id))
}

fn append_acroform_field(doc: &mut lopdf::Document, field_id: lopdf::ObjectId) -> Result<()> {
    let root_id = doc
        .trailer
        .get(b"Root")
        .map_err(|e| AppError::Pdf(e.to_string()))?
        .as_reference()
        .map_err(|e| AppError::Pdf(e.to_string()))?;
    let acroform = doc
        .get_object(root_id)
        .map_err(|e| AppError::Pdf(e.to_string()))?
        .as_dict()
        .map_err(|e| AppError::Pdf(e.to_string()))?
        .get(b"AcroForm")
        .ok()
        .cloned();

    match acroform {
        Some(Object::Reference(acroform_id)) => {
            let af_dict = doc
                .get_object_mut(acroform_id)
                .map_err(|e| AppError::Pdf(e.to_string()))?
                .as_dict_mut()
                .map_err(|e| AppError::Pdf(e.to_string()))?;
            push_field(af_dict, field_id);
        }
        Some(Object::Dictionary(_)) => {
            let root = doc
                .get_object_mut(root_id)
                .map_err(|e| AppError::Pdf(e.to_string()))?
                .as_dict_mut()
                .map_err(|e| AppError::Pdf(e.to_string()))?;
            let acroform = root
                .get_mut(b"AcroForm")
                .map_err(|e| AppError::Pdf(e.to_string()))?
                .as_dict_mut()
                .map_err(|e| AppError::Pdf(e.to_string()))?;
            push_field(acroform, field_id);
        }
        _ => {
            let mut acroform = Dictionary::new();
            acroform.set("Fields", Object::Array(vec![Object::Reference(field_id)]));
            acroform.set("SigFlags", Object::Integer(3)); // SignaturesExist | AppendOnly
            let root = doc
                .get_object_mut(root_id)
                .map_err(|e| AppError::Pdf(e.to_string()))?
                .as_dict_mut()
                .map_err(|e| AppError::Pdf(e.to_string()))?;
            root.set("AcroForm", Object::Dictionary(acroform));
        }
    }

    Ok(())
}

fn push_field(acroform: &mut Dictionary, field_id: lopdf::ObjectId) {
    acroform.set("SigFlags", Object::Integer(3));
    if !acroform.has(b"Fields") {
        acroform.set("Fields", Object::Array(Vec::new()));
    }
    if let Ok(fields) = acroform.get_mut(b"Fields").and_then(Object::as_array_mut) {
        fields.push(Object::Reference(field_id));
    }
}

fn append_annotation(
    doc: &mut lopdf::Document,
    page_id: lopdf::ObjectId,
    annot_id: lopdf::ObjectId,
) -> Result<()> {
    let annots = doc
        .get_object(page_id)
        .map_err(|e| AppError::Pdf(e.to_string()))?
        .as_dict()
        .map_err(|e| AppError::Pdf(e.to_string()))?
        .get(b"Annots")
        .ok()
        .cloned();

    match annots {
        Some(Object::Reference(annots_id)) => {
            let arr = doc
                .get_object_mut(annots_id)
                .map_err(|e| AppError::Pdf(e.to_string()))?
                .as_array_mut()
                .map_err(|e| AppError::Pdf(e.to_string()))?;
            arr.push(Object::Reference(annot_id));
        }
        Some(Object::Array(_)) => {
            let page = doc
                .get_object_mut(page_id)
                .map_err(|e| AppError::Pdf(e.to_string()))?
                .as_dict_mut()
                .map_err(|e| AppError::Pdf(e.to_string()))?;
            let arr = page
                .get_mut(b"Annots")
                .map_err(|e| AppError::Pdf(e.to_string()))?
                .as_array_mut()
                .map_err(|e| AppError::Pdf(e.to_string()))?;
            arr.push(Object::Reference(annot_id));
        }
        _ => {
            let page = doc
                .get_object_mut(page_id)
                .map_err(|e| AppError::Pdf(e.to_string()))?
                .as_dict_mut()
                .map_err(|e| AppError::Pdf(e.to_string()))?;
            page.set("Annots", Object::Array(vec![Object::Reference(annot_id)]));
        }
    }

    Ok(())
}
