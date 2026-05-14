use font_kit::family_name::FamilyName;
use font_kit::handle::Handle;
use font_kit::properties::Properties;
use font_kit::source::SystemSource;
use std::fs;
use std::path::PathBuf;

/// Resolve a font family name (or explicit path) to font file bytes.
pub fn resolve_font_data(family: &str, explicit_path: &str) -> Result<Vec<u8>, String> {
    // 1. Explicit path takes priority
    if !explicit_path.is_empty() {
        return fs::read(explicit_path)
            .map_err(|e| format!("Cannot read font file {}: {}", explicit_path, e));
    }

    // 2. Try system font source
    if let Ok(data) = resolve_from_system(family) {
        return Ok(data);
    }

    // 3. Fallback: try known CJK font paths
    if let Some(data) = fallback_cjk_font(family) {
        return Ok(data);
    }

    Err(format!("Font not found: {}", family))
}

fn resolve_from_system(family: &str) -> Result<Vec<u8>, String> {
    let source = SystemSource::new();
    let handle = source
        .select_best_match(&[FamilyName::Title(family.to_string())], &Properties::new())
        .map_err(|e| format!("Font selection failed: {}", e))?;

    match handle {
        Handle::Path {
            path,
            font_index: _,
        } => fs::read(&path).map_err(|e| format!("Cannot read font {:?}: {}", path, e)),
        Handle::Memory {
            bytes,
            font_index: _,
        } => Ok(bytes.to_vec()),
    }
}

/// Fallback for CJK fonts on Windows.
fn fallback_cjk_font(family: &str) -> Option<Vec<u8>> {
    let font_dir = if cfg!(windows) {
        PathBuf::from(std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".into()))
            .join("Fonts")
    } else if cfg!(target_os = "macos") {
        PathBuf::from("/System/Library/Fonts")
    } else {
        PathBuf::from("/usr/share/fonts")
    };

    // Map common Chinese font names to filenames
    let filename = match family {
        "SimSun" | "宋体" => "simsun.ttc",
        "SimHei" | "黑体" => "simhei.ttf",
        "KaiTi" | "楷体" => "simkai.ttf",
        "FangSong" | "仿宋" => "simfang.ttf",
        "Microsoft YaHei" | "微软雅黑" => "msyh.ttc",
        "Microsoft JhengHei" | "微软正黑" => "msjh.ttc",
        "Noto Sans CJK SC" => "NotoSansCJK-Regular.ttc",
        _ => return None,
    };

    let path = font_dir.join(filename);
    if path.exists() {
        fs::read(&path).ok()
    } else {
        None
    }
}
