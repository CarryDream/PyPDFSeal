import { useMemo } from "react";
import { useConfigStore } from "../../store/configStore";

interface WatermarkOverlayProps {
  canvasWidth: number;
  canvasHeight: number;
  pageWidthPt: number;
  pageHeightPt: number;
}

/** Measure text width using an offscreen canvas for accuracy. */
function measureTextWidth(text: string, fontSize: number, fontFamily: string): number {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return text.length * fontSize * 0.6;
  ctx.font = `${fontSize}px ${fontFamily}`;
  return ctx.measureText(text).width;
}

export default function WatermarkOverlay({
  canvasWidth,
  canvasHeight,
  pageWidthPt,
  pageHeightPt,
}: WatermarkOverlayProps) {
  const watermark = useConfigStore((s) => s.watermark);

  if (!watermark.enabled || !watermark.text.trim()) return null;

  const scaleX = canvasWidth / pageWidthPt;
  const scaleY = canvasHeight / pageHeightPt;
  // Backend renders at 4x then downscales — use uniform scale to match
  const scale = Math.min(scaleX, scaleY);
  const fontSizePx = watermark.font_size * scale;
  const gapXPx = watermark.gap_x * scaleX;
  const gapYPx = watermark.gap_y * scaleY;
  const fontFamily = watermark.font_family || "sans-serif";
  const rotation = watermark.rotation;

  // Measure text dimensions (approximation of backend's ab_glyph metrics)
  const { boxW, boxH } = useMemo(() => {
    const w = measureTextWidth(watermark.text, fontSizePx, fontFamily);
    const h = fontSizePx * 1.2;
    // Bounding box of rotated text — matches backend's rotate_image() new dimensions
    const rad = Math.abs(rotation * Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return { boxW: w * cos + h * sin, boxH: w * sin + h * cos };
  }, [watermark.text, fontSizePx, fontFamily, rotation]);

  const baseStyle: React.CSSProperties = {
    fontSize: fontSizePx,
    fontFamily,
    fontWeight: "normal",
    fontStyle: "normal",
    letterSpacing: "normal",
    color: watermark.color,
    opacity: watermark.opacity,
    whiteSpace: "nowrap",
    transform: `rotate(${rotation}deg)`,
    pointerEvents: "none",
    userSelect: "none",
    lineHeight: 1,
  };

  if (watermark.layout === "center") {
    return (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: canvasWidth,
          height: canvasHeight,
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <span style={baseStyle}>{watermark.text}</span>
        </div>
      </div>
    );
  }

  // Tile mode: staggered grid matching backend watermarker.rs logic.
  // Backend rotates the watermark image first, then tiles the rotated image.
  // Use the rotated bounding box (boxW × boxH) for tile spacing to match.
  const tileW = Math.max(boxW + gapXPx, 1);
  const tileH = Math.max(boxH + gapYPx, 1);
  const items: React.ReactNode[] = [];
  let row = 0;
  let y = -boxH;

  while (y <= canvasHeight + boxH) {
    const stagger = row % 2 === 1 ? tileW / 2 : 0;
    let x = stagger - boxW;

    while (x <= canvasWidth + boxW) {
      items.push(
        <span
          key={`${row}-${items.length}`}
          style={{
            position: "absolute",
            left: x,
            top: y,
            ...baseStyle,
          }}
        >
          {watermark.text}
        </span>
      );
      x += tileW;
    }
    y += tileH;
    row++;
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: canvasWidth,
        height: canvasHeight,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {items}
    </div>
  );
}
