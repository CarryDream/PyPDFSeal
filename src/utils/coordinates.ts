import type { PageInfo } from "../types";

export function pixelToPdfPt(
  pixelX: number,
  pixelY: number,
  canvasWidth: number,
  canvasHeight: number,
  page: PageInfo
): { x: number; y: number } {
  const scaleX = page.width_pt / canvasWidth;
  const scaleY = page.height_pt / canvasHeight;
  // PDF origin is bottom-left, canvas origin is top-left
  return {
    x: pixelX * scaleX,
    y: page.height_pt - pixelY * scaleY,
  };
}

export function pdfPtToPixel(
  ptX: number,
  ptY: number,
  canvasWidth: number,
  canvasHeight: number,
  page: PageInfo
): { x: number; y: number } {
  const scaleX = canvasWidth / page.width_pt;
  const scaleY = canvasHeight / page.height_pt;
  return {
    x: ptX * scaleX,
    y: (page.height_pt - ptY) * scaleY,
  };
}
