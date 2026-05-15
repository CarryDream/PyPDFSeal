use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PositionMode {
    Fixed,
    PageXy,
    Keyword,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Anchor {
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
    Center,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PageScope {
    All,
    First,
    Last,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WatermarkLayout {
    Center,
    Tile,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Placement {
    pub page_no: usize,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PositionConfig {
    pub mode: PositionMode,
    pub anchor: Anchor,
    pub dx: f64,
    pub dy: f64,
    pub page_x: f64,
    pub page_y: f64,
    pub keyword: String,
    pub keyword_dx: f64,
    pub keyword_dy: f64,
    pub page_scope: PageScope,
    pub custom_pages: String,
}

impl Default for PositionConfig {
    fn default() -> Self {
        Self {
            mode: PositionMode::Fixed,
            anchor: Anchor::BottomRight,
            dx: 0.0,
            dy: 0.0,
            page_x: 400.0,
            page_y: 600.0,
            keyword: String::new(),
            keyword_dx: 0.0,
            keyword_dy: 0.0,
            page_scope: PageScope::All,
            custom_pages: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatermarkConfig {
    pub enabled: bool,
    pub text: String,
    pub font_family: String,
    pub font_path: String,
    pub font_size: f64,
    pub opacity: f64,
    pub rotation: f64,
    pub color: String,
    pub layout: WatermarkLayout,
    pub page_scope: PageScope,
    pub custom_pages: String,
    pub gap_x: f64,
    pub gap_y: f64,
}

impl Default for WatermarkConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            text: String::new(),
            font_family: "SimSun".into(),
            font_path: String::new(),
            font_size: 24.0,
            opacity: 0.15,
            rotation: -45.0,
            color: "#808080".into(),
            layout: WatermarkLayout::Tile,
            page_scope: PageScope::All,
            custom_pages: String::new(),
            gap_x: 100.0,
            gap_y: 100.0,
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CertConfig {
    pub enabled: bool,
    pub cert_path: String,
    pub password: String,
    pub reason: String,
    pub location: String,
    pub contact: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OutputNameMode {
    Prefix,
    #[default]
    Suffix,
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutputNameConfig {
    #[serde(default)]
    pub mode: OutputNameMode,
    #[serde(default = "default_output_name_text")]
    pub text: String,
}

fn default_output_name_text() -> String {
    "_sealed".into()
}

impl Default for OutputNameConfig {
    fn default() -> Self {
        Self {
            mode: OutputNameMode::Suffix,
            text: default_output_name_text(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SealOptions {
    pub seal_image_path: String,
    pub seal_width: f64,
    pub seal_height: f64,
    pub seal_opacity: f64,
    pub position: PositionConfig,
    pub watermark: WatermarkConfig,
    pub cert: CertConfig,
    pub output_dir: String,
    #[serde(default)]
    pub output_name: OutputNameConfig,
}
