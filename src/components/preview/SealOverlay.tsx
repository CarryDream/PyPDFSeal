import { useRef, useState, useCallback, useEffect } from "react";
import { useConfigStore } from "../../store/configStore";
import { pixelToPdfPt, pdfPtToPixel } from "../../utils/coordinates";
import { localFileSrc } from "../../utils/localFile";
import type { Anchor } from "../../types";

interface SealOverlayProps {
  canvasWidth: number;
  canvasHeight: number;
  pageWidthPt: number;
  pageHeightPt: number;
  onDrop: (pdfX: number, pdfY: number) => void;
}

export default function SealOverlay({
  canvasWidth,
  canvasHeight,
  pageWidthPt,
  pageHeightPt,
  onDrop,
}: SealOverlayProps) {
  const { sealEnabled, sealWidth, sealHeight, sealOpacity, position, sealImagePath } = useConfigStore();
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState({ x: 100, y: 100 });
  const offsetRef = useRef({ x: 0, y: 0 });

  // PDF pt -> canvas pixel scale
  const scaleX = canvasWidth / pageWidthPt;
  const scaleY = canvasHeight / pageHeightPt;
  const sealW = sealWidth * scaleX;
  const sealH = sealHeight * scaleY;

  // Update overlay position from store position config
  useEffect(() => {
    if (position.mode === "page_xy") {
      const pixel = pdfPtToPixel(
        position.page_x,
        position.page_y + sealHeight,
        canvasWidth,
        canvasHeight,
        { width_pt: pageWidthPt, height_pt: pageHeightPt }
      );
      setPos({
        x: pixel.x,
        y: pixel.y,
      });
    } else if (position.mode === "fixed") {
      const { x: pdfX, y: pdfY } = fixedAnchorPlacement(
        pageWidthPt,
        pageHeightPt,
        position.anchor,
        position.dx,
        position.dy,
        sealWidth,
        sealHeight
      );
      const pixel = pdfPtToPixel(
        pdfX,
        pdfY + sealHeight,
        canvasWidth,
        canvasHeight,
        { width_pt: pageWidthPt, height_pt: pageHeightPt }
      );
      setPos({
        x: pixel.x,
        y: pixel.y,
      });
    }
  }, [
    position.mode, position.page_x, position.page_y,
    position.anchor, position.dx, position.dy,
    canvasWidth, canvasHeight, pageWidthPt, pageHeightPt,
    sealWidth, sealHeight, sealW, sealH,
  ]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const rect = e.currentTarget.parentElement!.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      offsetRef.current = { x: mouseX - pos.x, y: mouseY - pos.y };
      setDragging(true);
    },
    [pos]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const newX = Math.max(0, Math.min(canvasWidth - sealW, mouseX - offsetRef.current.x));
      const newY = Math.max(0, Math.min(canvasHeight - sealH, mouseY - offsetRef.current.y));
      setPos({ x: newX, y: newY });
    },
    [dragging, canvasWidth, canvasHeight, sealW, sealH]
  );

  const handleMouseUp = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    const pdf = pixelToPdfPt(pos.x, pos.y + sealH, canvasWidth, canvasHeight, {
      width_pt: pageWidthPt,
      height_pt: pageHeightPt,
    });
    onDrop(pdf.x, pdf.y);
  }, [dragging, pos, sealW, sealH, canvasWidth, canvasHeight, pageWidthPt, pageHeightPt, onDrop]);

  if (!sealEnabled) return null;

  if (!sealImagePath) {
    return (
      <div
        className="seal-overlay"
        style={{
          position: "absolute",
          inset: 0,
          width: canvasWidth,
          height: canvasHeight,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: Math.max(12, Math.min(canvasWidth - 150, pos.x)),
            top: Math.max(12, Math.min(canvasHeight - 40, pos.y)),
            padding: "7px 10px",
            borderRadius: 6,
            border: "1px dashed #dc2626",
            background: "rgba(255,255,255,0.92)",
            color: "#dc2626",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          请先选择印章图片
        </div>
      </div>
    );
  }

  return (
    <div
      className="seal-overlay"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: canvasWidth,
        height: canvasHeight,
        cursor: dragging ? "grabbing" : "default",
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        className="seal-rect"
        style={{
          position: "absolute",
          left: pos.x,
          top: pos.y,
          width: sealW,
          height: sealH,
          border: "2px dashed #e53935",
          cursor: dragging ? "grabbing" : "grab",
          opacity: dragging ? 0.78 : 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "all",
          overflow: "hidden",
          background: "rgba(255,255,255,0.15)",
        }}
        onMouseDown={handleMouseDown}
      >
        <img
          src={localFileSrc(sealImagePath)}
          alt="印章拖拽预览"
          style={{
            pointerEvents: "none",
            userSelect: "none",
            width: "100%",
            height: "100%",
            objectFit: "contain",
            opacity: dragging ? Math.max(0.2, sealOpacity * 0.72) : sealOpacity,
          }}
        />
      </div>
    </div>
  );
}

function fixedAnchorPlacement(
  pageWidth: number,
  pageHeight: number,
  anchor: Anchor,
  dx: number,
  dy: number,
  sealWidth: number,
  sealHeight: number
): { x: number; y: number } {
  switch (anchor) {
    case "top_left":
      return { x: dx, y: pageHeight - sealHeight - dy };
    case "top_right":
      return { x: pageWidth - sealWidth - dx, y: pageHeight - sealHeight - dy };
    case "bottom_left":
      return { x: dx, y: dy };
    case "bottom_right":
      return { x: pageWidth - sealWidth - dx, y: dy };
    case "center":
      return {
        x: (pageWidth - sealWidth) / 2 + dx,
        y: (pageHeight - sealHeight) / 2 - dy,
      };
  }
}
