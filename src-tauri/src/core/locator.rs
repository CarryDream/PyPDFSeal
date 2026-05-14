use super::models::*;
use crate::pdf::content_stream;
use lopdf::Document;

pub fn resolve_pages(page_scope: &PageScope, custom_pages: &str, total_pages: usize) -> Vec<usize> {
    if total_pages == 0 {
        return Vec::new();
    }

    match page_scope {
        PageScope::All => (0..total_pages).collect(),
        PageScope::First => vec![0],
        PageScope::Last => vec![total_pages.saturating_sub(1)],
        PageScope::Custom => parse_custom_pages(custom_pages, total_pages),
    }
}

fn parse_custom_pages(input: &str, total_pages: usize) -> Vec<usize> {
    input
        .split(',')
        .filter_map(|s| {
            let s = s.trim();
            if s.is_empty() {
                return None;
            }
            let n: i32 = s.parse().ok()?;
            let idx = if n < 0 {
                (total_pages as i32 + n).max(0) as usize
            } else {
                (n - 1).max(0) as usize
            };
            if idx < total_pages { Some(idx) } else { None }
        })
        .collect()
}

fn anchor_rect(
    page_w: f64,
    page_h: f64,
    anchor: &Anchor,
    dx: f64,
    dy: f64,
    seal_w: f64,
    seal_h: f64,
) -> (f64, f64) {
    let (base_x, base_y) = match anchor {
        Anchor::TopLeft => (dx, page_h - seal_h - dy),
        Anchor::TopRight => (page_w - seal_w - dx, page_h - seal_h - dy),
        Anchor::BottomLeft => (dx, dy),
        Anchor::BottomRight => (page_w - seal_w - dx, dy),
        Anchor::Center => ((page_w - seal_w) / 2.0, (page_h - seal_h) / 2.0),
    };
    if matches!(anchor, Anchor::Center) {
        (base_x + dx, base_y - dy)
    } else {
        (base_x, base_y)
    }
}

/// Compute seal placements for all target pages.
/// If `doc` is provided and mode is Keyword, uses text search.
pub fn compute_placements(
    pages: &[(f64, f64)],
    cfg: &PositionConfig,
    seal_w: f64,
    seal_h: f64,
    doc: Option<&Document>,
) -> Vec<Placement> {
    let total = pages.len();
    let targets = resolve_pages(&cfg.page_scope, &cfg.custom_pages, total);

    let mut result = Vec::new();

    for idx in targets {
        let Some(&(pw, ph)) = pages.get(idx) else {
            continue;
        };

        match cfg.mode {
            PositionMode::Fixed => {
                let (x, y) = anchor_rect(pw, ph, &cfg.anchor, cfg.dx, cfg.dy, seal_w, seal_h);
                result.push(Placement {
                    page_no: idx,
                    x,
                    y,
                    w: seal_w,
                    h: seal_h,
                });
            }
            PositionMode::PageXy => {
                result.push(Placement {
                    page_no: idx,
                    x: cfg.page_x,
                    y: cfg.page_y,
                    w: seal_w,
                    h: seal_h,
                });
            }
            PositionMode::Keyword => {
                if cfg.keyword.trim().is_empty() {
                    continue;
                }

                if let Some(doc) = doc {
                    let page_ids = doc.get_pages();
                    let page_num = idx as u32 + 1;
                    if let Some(&page_id) = page_ids.get(&page_num) {
                        let hits = content_stream::search_text_in_page(doc, page_id, &cfg.keyword)
                            .unwrap_or_default();

                        for hit in hits {
                            let x = hit.x + cfg.keyword_dx;
                            let y = hit.y + cfg.keyword_dy - seal_h;
                            result.push(Placement {
                                page_no: idx,
                                x,
                                y,
                                w: seal_w,
                                h: seal_h,
                            });
                        }
                    }
                }
            }
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    fn position(anchor: Anchor, dx: f64, dy: f64) -> PositionConfig {
        PositionConfig {
            mode: PositionMode::Fixed,
            anchor,
            dx,
            dy,
            ..PositionConfig::default()
        }
    }

    #[test]
    fn resolves_empty_document_to_no_pages() {
        assert!(resolve_pages(&PageScope::First, "", 0).is_empty());
        assert!(resolve_pages(&PageScope::Last, "", 0).is_empty());
    }

    #[test]
    fn fixed_anchors_use_pdf_bottom_left_coordinates() {
        let pages = vec![(600.0, 800.0)];
        let cases = [
            (Anchor::TopLeft, 10.0, 20.0, 10.0, 680.0),
            (Anchor::TopRight, 10.0, 20.0, 490.0, 680.0),
            (Anchor::BottomLeft, 10.0, 20.0, 10.0, 20.0),
            (Anchor::BottomRight, 10.0, 20.0, 490.0, 20.0),
            (Anchor::Center, 10.0, 20.0, 260.0, 330.0),
        ];

        for (anchor, dx, dy, expected_x, expected_y) in cases {
            let placements =
                compute_placements(&pages, &position(anchor, dx, dy), 100.0, 100.0, None);
            assert_eq!(placements.len(), 1);
            assert_eq!(placements[0].x, expected_x);
            assert_eq!(placements[0].y, expected_y);
        }
    }
}
