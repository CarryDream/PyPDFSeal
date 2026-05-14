use ab_glyph::{Font, FontRef, PxScale, ScaleFont};
use image::{Rgba, RgbaImage};
use imageproc::drawing::draw_text_mut;

use super::font_resolver;

/// Result of rendering a watermark.
pub struct WatermarkRenderResult {
    /// PNG-encoded image bytes.
    pub png_bytes: Vec<u8>,
    /// Image width in PDF points (at 72 DPI).
    pub width_pt: f64,
    /// Image height in PDF points.
    pub height_pt: f64,
}

/// Render watermark text to an RGBA PNG image.
///
/// - `text`: watermark text
/// - `font_family` / `font_path`: font specification
/// - `font_size`: in points (rendered at 4x for anti-aliasing)
/// - `opacity`: 0.0–1.0
/// - `rotation`: degrees (counter-clockwise)
/// - `color`: hex string "#RRGGBB"
pub fn render_watermark(
    text: &str,
    font_family: &str,
    font_path: &str,
    font_size: f64,
    opacity: f64,
    rotation: f64,
    color: &str,
) -> Result<WatermarkRenderResult, String> {
    let font_data = font_resolver::resolve_font_data(font_family, font_path)?;
    let font =
        FontRef::try_from_slice(&font_data).map_err(|e| format!("Failed to parse font: {}", e))?;

    let (r, g, b) = parse_hex_color(color)?;
    let alpha = (opacity.clamp(0.0, 1.0) * 255.0).round() as u8;

    // Render at 4x scale for anti-aliasing, then downscale
    let render_scale = 4.0;
    let render_size = (font_size * render_scale) as f32;
    let px_scale = PxScale::from(render_size);
    let scaled_font = font.as_scaled(px_scale);

    let ascent = scaled_font.ascent();
    let descent = scaled_font.descent();
    let line_height = (ascent - descent).ceil() as u32;

    // Measure text width
    let mut text_width: f32 = 0.0;
    for ch in text.chars() {
        let gid = font.glyph_id(ch);
        text_width += scaled_font.h_advance(gid);
    }

    let img_w = (text_width.ceil() as u32).max(1) + 8; // padding
    let img_h = line_height.max(1) + 8;

    // Create RGBA image with transparent background
    let mut img = RgbaImage::from_pixel(img_w, img_h, Rgba([0, 0, 0, 0]));

    // Draw text using imageproc
    let text_color = Rgba([r, g, b, alpha]);
    draw_text_mut(
        &mut img, text_color, 4, // x padding
        4, // y padding
        px_scale, &font, text,
    );

    // Apply rotation if needed
    let img = if rotation.abs() > 0.5 {
        rotate_image(&img, rotation)
    } else {
        img
    };

    // Downscale by render_scale for anti-aliasing
    let final_w = ((img.width() as f64 / render_scale) as u32).max(1);
    let final_h = ((img.height() as f64 / render_scale) as u32).max(1);
    let img = image::imageops::resize(&img, final_w, final_h, image::imageops::Lanczos3);

    // Encode to PNG
    let mut png_buf = std::io::Cursor::new(Vec::new());
    img.write_to(&mut png_buf, image::ImageFormat::Png)
        .map_err(|e| format!("PNG encode error: {}", e))?;

    // Image dimensions in PDF points (1 px ≈ 0.75 pt at 96 DPI, but we use 1:1 for simplicity)
    let width_pt = final_w as f64;
    let height_pt = final_h as f64;

    Ok(WatermarkRenderResult {
        png_bytes: png_buf.into_inner(),
        width_pt,
        height_pt,
    })
}

/// Rotate image by arbitrary degrees around center.
fn rotate_image(img: &RgbaImage, degrees: f64) -> RgbaImage {
    let (w, h) = img.dimensions();
    let rad = degrees.to_radians();
    let cos = rad.cos().abs();
    let sin = rad.sin().abs();

    // New dimensions to fit rotated image
    let new_w = ((w as f64 * cos + h as f64 * sin) as u32).max(1);
    let new_h = ((w as f64 * sin + h as f64 * cos) as u32).max(1);

    let mut out = RgbaImage::from_pixel(new_w, new_h, Rgba([0, 0, 0, 0]));

    let cx_src = w as f64 / 2.0;
    let cy_src = h as f64 / 2.0;
    let cx_dst = new_w as f64 / 2.0;
    let cy_dst = new_h as f64 / 2.0;

    for y in 0..new_h {
        for x in 0..new_w {
            // Inverse rotation to find source pixel
            let dx = x as f64 - cx_dst;
            let dy = y as f64 - cy_dst;
            let src_x = dx * rad.cos() + dy * rad.sin() + cx_src;
            let src_y = -dx * rad.sin() + dy * rad.cos() + cy_src;

            if src_x >= 0.0 && src_x < w as f64 && src_y >= 0.0 && src_y < h as f64 {
                let pixel = img.get_pixel(src_x as u32, src_y as u32);
                out.put_pixel(x, y, *pixel);
            }
        }
    }

    out
}

fn parse_hex_color(hex: &str) -> Result<(u8, u8, u8), String> {
    let hex = hex.trim_start_matches('#');
    if hex.len() != 6 {
        return Err(format!("Invalid hex color: {}", hex));
    }
    let r = u8::from_str_radix(&hex[0..2], 16).map_err(|_| "Invalid red")?;
    let g = u8::from_str_radix(&hex[2..4], 16).map_err(|_| "Invalid green")?;
    let b = u8::from_str_radix(&hex[4..6], 16).map_err(|_| "Invalid blue")?;
    Ok((r, g, b))
}
