use super::locator;
use super::models::*;
use super::signer;
use super::stamper;
use super::watermarker;
use crate::error::AppError;
use crate::error::Result;
use crate::pdf::document;
use std::path::Path;
use tempfile::NamedTempFile;

pub fn process_task(input_path: &str, options: &SealOptions) -> Result<String> {
    if signer::has_existing_signature(input_path)? {
        return Err(AppError::Signature(
            "input PDF already contains a signature; rewriting it would invalidate the existing signature".into(),
        ));
    }

    let output_path = build_output_path(input_path, &options.output_dir, &options.output_name);
    let needs_stamp = !options.seal_image_path.is_empty()
        && options.seal_width > 0.0
        && options.seal_height > 0.0;
    let needs_watermark = options.watermark.enabled && !options.watermark.text.is_empty();
    let needs_sign = options.cert.enabled && !options.cert.cert_path.is_empty();

    if !needs_stamp && !needs_watermark && !needs_sign {
        return Err(AppError::Config(
            "no stamp, watermark, or signature configured".into(),
        ));
    }

    let mut temp_files = Vec::new();
    let mut current_path = input_path.to_string();

    if needs_stamp {
        let seal_img = stamper::load_seal_image(&options.seal_image_path, options.seal_opacity)?;
        let doc = lopdf::Document::load(&current_path)
            .map_err(|e| crate::error::AppError::Pdf(e.to_string()))?;
        let page_dims = document::document_page_dimensions(&doc)?;
        let placements = locator::compute_placements(
            &page_dims,
            &options.position,
            options.seal_width,
            options.seal_height,
            Some(&doc),
        );

        let next_path = if needs_watermark || needs_sign {
            let tmp = NamedTempFile::new().map_err(crate::error::AppError::Io)?;
            let path = tmp.path().to_string_lossy().to_string();
            temp_files.push(tmp);
            path
        } else {
            output_path.clone()
        };
        stamper::stamp_pdf(&current_path, &next_path, &seal_img, &placements)?;
        current_path = next_path;
    }

    if needs_watermark {
        let next_path = if needs_sign {
            let tmp = NamedTempFile::new().map_err(crate::error::AppError::Io)?;
            let path = tmp.path().to_string_lossy().to_string();
            temp_files.push(tmp);
            path
        } else {
            output_path.clone()
        };
        watermarker::apply_watermark(&current_path, &next_path, &options.watermark)?;
        current_path = next_path;
    }

    if needs_sign {
        signer::sign_pdf(&current_path, &output_path, &options.cert)?;
    }

    Ok(output_path)
}

fn build_output_path(input_path: &str, output_dir: &str, output_name: &OutputNameConfig) -> String {
    let input = Path::new(input_path);
    let stem = input.file_stem().unwrap_or_default().to_string_lossy();
    let ext = input.extension().unwrap_or_default().to_string_lossy();

    let dir = if output_dir.is_empty() {
        input.parent().unwrap_or(Path::new("."))
    } else {
        Path::new(output_dir)
    };

    // Create "sealed" subdirectory if no custom output dir
    let target_dir = if output_dir.is_empty() {
        dir.join("sealed")
    } else {
        dir.to_path_buf()
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
