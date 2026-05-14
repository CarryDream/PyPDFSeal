use crate::error::{AppError, Result};
use image::RgbaImage;
use lopdf::{Dictionary, Document, Object, ObjectId, Stream};

pub fn add_rgba_image(doc: &mut Document, rgba: &RgbaImage) -> ObjectId {
    let (img_w, img_h) = rgba.dimensions();
    let mut rgb_bytes = Vec::with_capacity((img_w * img_h * 3) as usize);
    let mut alpha_bytes = Vec::with_capacity((img_w * img_h) as usize);

    for pixel in rgba.pixels() {
        rgb_bytes.push(pixel[0]);
        rgb_bytes.push(pixel[1]);
        rgb_bytes.push(pixel[2]);
        alpha_bytes.push(pixel[3]);
    }

    let mut smask_dict = Dictionary::new();
    smask_dict.set("Type", Object::Name(b"XObject".to_vec()));
    smask_dict.set("Subtype", Object::Name(b"Image".to_vec()));
    smask_dict.set("Width", Object::Integer(img_w as i64));
    smask_dict.set("Height", Object::Integer(img_h as i64));
    smask_dict.set("ColorSpace", Object::Name(b"DeviceGray".to_vec()));
    smask_dict.set("BitsPerComponent", Object::Integer(8));
    let smask_id = doc.add_object(Stream::new(smask_dict, alpha_bytes));

    let mut img_dict = Dictionary::new();
    img_dict.set("Type", Object::Name(b"XObject".to_vec()));
    img_dict.set("Subtype", Object::Name(b"Image".to_vec()));
    img_dict.set("Width", Object::Integer(img_w as i64));
    img_dict.set("Height", Object::Integer(img_h as i64));
    img_dict.set("ColorSpace", Object::Name(b"DeviceRGB".to_vec()));
    img_dict.set("BitsPerComponent", Object::Integer(8));
    img_dict.set("SMask", Object::Reference(smask_id));

    doc.add_object(Stream::new(img_dict, rgb_bytes))
}

pub fn add_png_image(doc: &mut Document, png_bytes: &[u8]) -> Result<ObjectId> {
    let img = image::load_from_memory(png_bytes)
        .map_err(|e| AppError::Image(e.to_string()))?
        .to_rgba8();
    Ok(add_rgba_image(doc, &img))
}

pub fn add_image_draws_to_page(
    doc: &mut Document,
    page_id: ObjectId,
    resource_name: &str,
    image_id: ObjectId,
    draws: &[ImageDraw],
) -> Result<()> {
    if draws.is_empty() {
        return Ok(());
    }

    doc.add_xobject(page_id, resource_name.as_bytes().to_vec(), image_id)
        .map_err(|e| AppError::Pdf(e.to_string()))?;

    let mut content = Vec::new();
    for draw in draws {
        let op = format!(
            "q {} 0 0 {} {} {} cm /{} Do Q\n",
            pdf_num(draw.w),
            pdf_num(draw.h),
            pdf_num(draw.x),
            pdf_num(draw.y),
            resource_name
        );
        content.extend_from_slice(op.as_bytes());
    }

    doc.add_page_contents(page_id, content)
        .map_err(|e| AppError::Pdf(e.to_string()))
}

#[derive(Debug, Clone, Copy)]
pub struct ImageDraw {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

fn pdf_num(value: f64) -> String {
    if !value.is_finite() {
        return "0".into();
    }

    let mut s = format!("{:.4}", value);
    while s.contains('.') && s.ends_with('0') {
        s.pop();
    }
    if s.ends_with('.') {
        s.pop();
    }
    if s == "-0" { "0".into() } else { s }
}
