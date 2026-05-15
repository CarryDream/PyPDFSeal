use super::locator;
use super::models::*;
use crate::error::Result;
use crate::pdf::document;
use crate::pdf::xobject::{self, ImageDraw};
use crate::text::watermark_image;

/// Apply watermark to an already-loaded in-memory Document (avoids re-loading).
pub fn apply_watermark_to_document(
    doc: &mut lopdf::Document,
    cfg: &WatermarkConfig,
    rendered: &watermark_image::WatermarkRenderResult,
) -> Result<()> {
    let image_id = xobject::add_png_image(doc, &rendered.png_bytes)?;

    let page_ids = doc.get_pages();
    let total_pages = page_ids.len();
    let target_pages = locator::resolve_pages(&cfg.page_scope, &cfg.custom_pages, total_pages);

    for &page_idx in &target_pages {
        let page_num = page_idx as u32 + 1;
        let page_id = match page_ids.get(&page_num) {
            Some(&id) => id,
            None => continue,
        };

        let (page_w, page_h) = document::page_dimensions(doc, page_id)?;
        let draws = watermark_draws(cfg, rendered.width_pt, rendered.height_pt, page_w, page_h);
        let resource_name = format!("Wm{}_{}", page_idx + 1, image_id.0);
        xobject::add_image_draws_to_page(doc, page_id, &resource_name, image_id, &draws)?;
    }

    Ok(())
}

fn watermark_draws(
    cfg: &WatermarkConfig,
    wm_w: f64,
    wm_h: f64,
    page_w: f64,
    page_h: f64,
) -> Vec<ImageDraw> {
    match cfg.layout {
        WatermarkLayout::Center => vec![ImageDraw {
            x: (page_w - wm_w) / 2.0,
            y: (page_h - wm_h) / 2.0,
            w: wm_w,
            h: wm_h,
        }],
        WatermarkLayout::Tile => {
            tiled_watermark_draws(wm_w, wm_h, page_w, page_h, cfg.gap_x, cfg.gap_y)
        }
    }
}

/// Build tiled watermark draws in a staggered pattern.
fn tiled_watermark_draws(
    wm_w: f64,
    wm_h: f64,
    page_w: f64,
    page_h: f64,
    gap_x: f64,
    gap_y: f64,
) -> Vec<ImageDraw> {
    let tile_w = (wm_w + gap_x).max(1.0);
    let tile_h = (wm_h + gap_y).max(1.0);
    let mut draws = Vec::new();

    let mut row = 0;
    let mut y = 0.0;
    while y <= page_h + wm_h {
        let stagger = if row % 2 == 1 { tile_w / 2.0 } else { 0.0 };
        let mut x = stagger - wm_w; // start slightly off-screen for stagger rows
        while x <= page_w + wm_w {
            let draw_y = page_h - y - wm_h; // PDF coords: bottom-left origin
            draws.push(ImageDraw {
                x,
                y: draw_y,
                w: wm_w,
                h: wm_h,
            });

            x += tile_w;
        }
        y += tile_h;
        row += 1;
    }

    draws
}
