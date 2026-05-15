use super::models::Placement;
use crate::error::{AppError, Result};
use crate::pdf::xobject::{self, ImageDraw};
use image::DynamicImage;
use std::collections::BTreeMap;

pub fn load_seal_image(path: &str, opacity: f64) -> Result<DynamicImage> {
    let bytes = std::fs::read(path).map_err(AppError::Io)?;
    let img = image::load_from_memory(&bytes).map_err(|e| AppError::Image(e.to_string()))?;

    let opacity = opacity.clamp(0.0, 1.0);
    if (opacity - 1.0).abs() < f64::EPSILON {
        return Ok(img);
    }

    // Pre-multiply alpha by opacity
    let mut rgba = img.to_rgba8();
    for pixel in rgba.pixels_mut() {
        let a = pixel[3] as f64 / 255.0;
        let new_a = (a * opacity * 255.0).round() as u8;
        pixel[3] = new_a;
    }

    Ok(DynamicImage::ImageRgba8(rgba))
}

/// Stamp an already-loaded in-memory Document (avoids re-loading from disk).
pub fn stamp_document(
    doc: &mut lopdf::Document,
    seal_img: &DynamicImage,
    placements: &[Placement],
) -> Result<()> {
    let rgba = seal_img.to_rgba8();
    let image_id = xobject::add_rgba_image(doc, &rgba);

    let page_ids = doc.get_pages();
    let mut by_page: BTreeMap<usize, Vec<ImageDraw>> = BTreeMap::new();

    for placement in placements {
        if !page_ids.contains_key(&(placement.page_no as u32 + 1)) {
            continue;
        }

        by_page
            .entry(placement.page_no)
            .or_default()
            .push(ImageDraw {
                x: placement.x,
                y: placement.y,
                w: placement.w,
                h: placement.h,
            });
    }

    for (page_no, draws) in by_page {
        let page_id = page_ids
            .get(&(page_no as u32 + 1))
            .copied()
            .ok_or_else(|| AppError::Pdf(format!("page {} not found", page_no + 1)))?;
        let resource_name = format!("Seal{}_{}", page_no + 1, image_id.0);
        xobject::add_image_draws_to_page(doc, page_id, &resource_name, image_id, &draws)?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgba, RgbaImage};
    use lopdf::{Dictionary, Document, Object, Stream, dictionary};
    use std::io::Cursor;

    #[test]
    fn stamp_pdf_appends_visible_image_content() {
        let input = tempfile::NamedTempFile::new().unwrap();
        let output = tempfile::NamedTempFile::new().unwrap();
        create_blank_pdf(input.path().to_str().unwrap());

        let img = DynamicImage::ImageRgba8(RgbaImage::from_pixel(2, 2, Rgba([255, 0, 0, 255])));
        let placements = vec![Placement {
            page_no: 0,
            x: 10.0,
            y: 20.0,
            w: 30.0,
            h: 40.0,
        }];

        stamp_pdf(
            input.path().to_str().unwrap(),
            output.path().to_str().unwrap(),
            &img,
            &placements,
        )
        .unwrap();

        let doc = Document::load(output.path()).unwrap();
        let page_id = *doc.get_pages().get(&1).unwrap();
        let content = String::from_utf8_lossy(&doc.get_page_content(page_id).unwrap()).to_string();
        assert!(content.contains("30 0 0 40 10 20 cm"));
        assert!(content.contains(" Do Q"));
    }

    #[test]
    fn load_seal_image_uses_file_content_not_extension() {
        let file = tempfile::Builder::new().suffix(".jpg").tempfile().unwrap();
        let img = DynamicImage::ImageRgba8(RgbaImage::from_pixel(2, 2, Rgba([0, 255, 0, 255])));
        let mut bytes = Cursor::new(Vec::new());
        img.write_to(&mut bytes, image::ImageFormat::Png).unwrap();
        std::fs::write(file.path(), bytes.into_inner()).unwrap();

        let loaded = load_seal_image(file.path().to_str().unwrap(), 1.0).unwrap();
        assert_eq!(loaded.width(), 2);
        assert_eq!(loaded.height(), 2);
    }

    fn create_blank_pdf(path: &str) {
        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();
        let page_id = doc.new_object_id();
        let contents_id = doc.add_object(Stream::new(Dictionary::new(), Vec::new()));
        let resources_id = doc.add_object(Dictionary::new());

        doc.objects.insert(
            page_id,
            Object::Dictionary(dictionary! {
                "Type" => "Page",
                "Parent" => Object::Reference(pages_id),
                "MediaBox" => vec![0.into(), 0.into(), 200.into(), 200.into()],
                "Contents" => Object::Reference(contents_id),
                "Resources" => Object::Reference(resources_id),
            }),
        );
        doc.objects.insert(
            pages_id,
            Object::Dictionary(dictionary! {
                "Type" => "Pages",
                "Kids" => vec![Object::Reference(page_id)],
                "Count" => 1,
            }),
        );
        let catalog_id = doc.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => Object::Reference(pages_id),
        });
        doc.trailer.set("Root", Object::Reference(catalog_id));
        doc.save(path).unwrap();
    }
}
