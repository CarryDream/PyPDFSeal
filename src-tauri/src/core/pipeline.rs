use super::locator;
use super::models::*;
use super::signer;
use super::stamper;
use super::watermarker;
use crate::error::AppError;
use crate::error::Result;
use crate::pdf::document;
use crate::text::watermark_image;
use image::DynamicImage;
use openssl::pkey::{PKey, Private};
use openssl::stack::Stack;
use openssl::x509::X509;
use std::path::Path;

/// Pre-computed assets shared across all files in a batch.
pub struct PreparedAssets {
    pub seal_img: Option<DynamicImage>,
    pub watermark_rendered: Option<watermark_image::WatermarkRenderResult>,
    pub cert_keys: Option<(PKey<Private>, X509, Stack<X509>)>,
}

impl PreparedAssets {
    pub fn prepare(options: &SealOptions) -> Result<Self> {
        let seal_img = if !options.seal_image_path.is_empty()
            && options.seal_width > 0.0
            && options.seal_height > 0.0
        {
            Some(stamper::load_seal_image(
                &options.seal_image_path,
                options.seal_opacity,
            )?)
        } else {
            None
        };

        let watermark_rendered = if options.watermark.enabled && !options.watermark.text.is_empty()
        {
            Some(
                watermark_image::render_watermark(
                    &options.watermark.text,
                    &options.watermark.font_family,
                    &options.watermark.font_path,
                    options.watermark.font_size,
                    options.watermark.opacity,
                    options.watermark.rotation,
                    &options.watermark.color,
                )
                .map_err(AppError::Font)?,
            )
        } else {
            None
        };

        let cert_keys = if options.cert.enabled && !options.cert.cert_path.is_empty() {
            Some(signer::parse_pkcs12(
                &options.cert.cert_path,
                &options.cert.password,
            )?)
        } else {
            None
        };

        Ok(PreparedAssets {
            seal_img,
            watermark_rendered,
            cert_keys,
        })
    }
}

/// Process a single PDF file with pre-computed assets.
/// Merges stamp + watermark into a single PDF load/save cycle.
pub fn process_task_with_assets(
    input_path: &str,
    options: &SealOptions,
    assets: &PreparedAssets,
) -> Result<String> {
    if signer::has_existing_signature(input_path)? {
        return Err(AppError::Signature(
            "input PDF already contains a signature; rewriting it would invalidate the existing signature".into(),
        ));
    }

    let output_path = build_output_path(
        input_path,
        &options.output_dir,
        &options.output_name,
        &options.output_structure,
    );

    let needs_stamp = assets.seal_img.is_some();
    let needs_watermark = assets.watermark_rendered.is_some();
    let needs_sign = assets.cert_keys.is_some();

    if !needs_stamp && !needs_watermark && !needs_sign {
        return Err(AppError::Config(
            "no stamp, watermark, or signature configured".into(),
        ));
    }

    // Load PDF once, apply stamp + watermark in-memory, then save once
    let mut doc = lopdf::Document::load(input_path)
        .map_err(|e| crate::error::AppError::Pdf(e.to_string()))?;

    if needs_stamp {
        let seal_img = assets.seal_img.as_ref().unwrap();
        let page_dims = document::document_page_dimensions(&doc)?;
        let placements = locator::compute_placements(
            &page_dims,
            &options.position,
            options.seal_width,
            options.seal_height,
            Some(&doc),
        );
        stamper::stamp_document(&mut doc, seal_img, &placements)?;
    }

    if needs_watermark {
        let rendered = assets.watermark_rendered.as_ref().unwrap();
        watermarker::apply_watermark_to_document(&mut doc, &options.watermark, rendered)?;
    }

    if needs_sign {
        // Sign requires a file path, so save to temp first
        let tmp = tempfile::NamedTempFile::new().map_err(crate::error::AppError::Io)?;
        let tmp_path = tmp.path().to_string_lossy().to_string();
        doc.save(&tmp_path)
            .map_err(|e| crate::error::AppError::Pdf(e.to_string()))?;

        let (pkey, cert, chain) = assets.cert_keys.as_ref().unwrap();
        signer::sign_pdf_with_keys(&tmp_path, &output_path, pkey, cert, chain, &options.cert)?;
        // tmp is cleaned up automatically
    } else {
        doc.save(&output_path)
            .map_err(|e| crate::error::AppError::Pdf(e.to_string()))?;
    }

    Ok(output_path)
}

fn build_output_path(
    input_path: &str,
    output_dir: &str,
    output_name: &OutputNameConfig,
    output_structure: &OutputStructureMode,
) -> String {
    let input = Path::new(input_path);
    let stem = input.file_stem().unwrap_or_default().to_string_lossy();
    let ext = input.extension().unwrap_or_default().to_string_lossy();
    let input_dir = input.parent().unwrap_or(Path::new("."));

    let base_dir = if output_dir.is_empty() {
        match output_structure {
            OutputStructureMode::Flat => input_dir.join("sealed"),
            OutputStructureMode::ParentFolder => {
                input_dir.parent().unwrap_or(input_dir).join("sealed")
            }
        }
    } else {
        Path::new(output_dir).to_path_buf()
    };

    let target_dir = match output_structure {
        OutputStructureMode::Flat => base_dir,
        OutputStructureMode::ParentFolder => {
            let group = input_dir
                .file_name()
                .filter(|name| !name.is_empty())
                .unwrap_or_else(|| std::ffi::OsStr::new("未分组"));
            base_dir.join(Path::new(group))
        }
    };

    std::fs::create_dir_all(&target_dir).ok();

    let mut filename = build_output_filename(&stem, &ext, output_name);
    let mut output = target_dir.join(&filename);

    if output == input {
        let fallback = OutputNameConfig::default();
        filename = build_output_filename(&stem, &ext, &fallback);
        output = target_dir.join(filename);
    }

    output.to_string_lossy().to_string()
}

fn build_output_filename(stem: &str, ext: &str, output_name: &OutputNameConfig) -> String {
    let name = match output_name.mode {
        OutputNameMode::Prefix => format!("{}{}", output_name.text, stem),
        OutputNameMode::Suffix => format!("{}{}", stem, output_name.text),
        OutputNameMode::None => stem.to_string(),
    };

    if ext.is_empty() {
        name
    } else {
        format!("{}.{}", name, ext)
    }
}
