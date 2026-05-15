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
  const fontSizePx = watermark.font_size * Math.min(scaleX, scaleY);
  const gapXPx = watermark.gap_x * scaleX;
  const gapYPx = watermark.gap_y * scaleY;
  const fontFamily = watermark.font_family || "sans-serif";

  // Measure actual text dimensions using canvas API for accuracy
  const { textW, textH } = useMemo(() => {
    const w = measureTextWidth(watermark.text, fontSizePx, fontFamily);
    const h = fontSizePx * 1.2;
    return { textW: w, textH: h };
  }, [watermark.text, fontSizePx, fontFamily]);

  const baseStyle: React.CSSProperties = {
    fontSize: fontSizePx,
    fontFamily,
    fontWeight: "normal",
    fontStyle: "normal",
    letterSpacing: "normal",
    color: watermark.color,
    opacity: watermark.opacity,
    whiteSpace: "nowrap",
    transform: `rotate(${watermark.rotation}deg)`,
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

  // Tile mode: staggered grid matching backend watermarker.rs logic
  const tileW = Math.max(textW + gapXPx, 1);
  const tileH = Math.max(textH + gapYPx, 1);
  const items: React.ReactNode[] = [];
  let row = 0;
  let y = -textH;

  while (y <= canvasHeight + textH) {
    const stagger = row % 2 === 1 ? tileW / 2 : 0;
    let x = stagger - textW;

    while (x <= canvasWidth + textW) {
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
