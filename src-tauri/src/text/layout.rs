use ab_glyph::{Font, FontRef, PxScale, ScaleFont};

/// A single positioned glyph for rendering.
pub struct PositionedGlyph {
    pub glyph_id: ab_glyph::GlyphId,
    pub x: f32,
    pub y: f32,
}

/// Measure and lay out text using ab_glyph.
/// Returns (glyphs, total_width, total_height).
pub fn layout_text(
    font_data: &[u8],
    text: &str,
    font_size: f32,
) -> Result<(Vec<PositionedGlyph>, f32, f32), String> {
    let font =
        FontRef::try_from_slice(font_data).map_err(|e| format!("Failed to load font: {}", e))?;
    let scale = PxScale::from(font_size);
    let scaled = font.as_scaled(scale);

    let mut glyphs = Vec::new();
    let mut x: f32 = 0.0;

    // Use ascent for vertical baseline offset
    let ascent = scaled.ascent();
    let descent = scaled.descent();
    let line_height = ascent - descent; // ascent is positive, descent is negative

    for ch in text.chars() {
        if ch == '\n' {
            x = 0.0;
            continue;
        }
        let glyph_id = font.glyph_id(ch);
        let _glyph = glyph_id.with_scale_and_position(scale, ab_glyph::point(x, ascent));
        glyphs.push(PositionedGlyph {
            glyph_id,
            x,
            y: 0.0,
        });
        x += scaled.h_advance(glyph_id);
    }

    let total_width = x;
    let total_height = line_height;

    Ok((glyphs, total_width, total_height))
}
