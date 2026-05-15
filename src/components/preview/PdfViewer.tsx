import { useRef, useEffect, useState, useCallback } from "react";
import { usePdfDocument, type PageViewport } from "../../hooks/usePdfDocument";
import { useConfigStore } from "../../store/configStore";
import { getPageInfo } from "../../utils/ipc";
import SealOverlay from "./SealOverlay";
import type { PageInfo } from "../../types";

interface PdfViewerProps {
  filePath: string;
}

const SCALE_STEP = 0.15;
const MIN_SCALE = 0.3;
const MAX_SCALE = 4.0;

export default function PdfViewer({ filePath }: PdfViewerProps) {
  const { pageCount, loading, error, renderPage } = usePdfDocument(filePath);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.5);
  const [viewport, setViewport] = useState<PageViewport | null>(null);
  const [pageDims, setPageDims] = useState<PageInfo[]>([]);
  const { setPosition } = useConfigStore();
  const fileName = filePath.split(/[/\\]/).pop() ?? filePath;

  // Fetch page dimensions from backend
  useEffect(() => {
    if (!filePath) return;
    let cancelled = false;
    setCurrentPage(1);
    setViewport(null);
    setPageDims([]);

    getPageInfo(filePath)
      .then((info) => {
        if (!cancelled) setPageDims(info.pages);
      })
      .catch(() => {
        if (!cancelled) setPageDims([]);
      });

    return () => {
      cancelled = true;
    };
  }, [filePath]);

  useEffect(() => {
    if (pageCount > 0 && currentPage > pageCount) {
      setCurrentPage(pageCount);
    }
  }, [currentPage, pageCount]);

  // Render page when page or scale changes
  useEffect(() => {
    if (!canvasRef.current || loading || pageCount === 0) return;

    renderPage(currentPage, canvasRef.current, scale).then((vp) => {
      if (vp) setViewport(vp);
    });
  }, [currentPage, scale, loading, pageCount, renderPage]);

  // Ctrl+scroll zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setScale((prev) => {
        const delta = e.deltaY > 0 ? -SCALE_STEP : SCALE_STEP;
        return Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev + delta));
      });
    },
    []
  );

  const handlePrev = () => {
    if (currentPage > 1) {
      setCurrentPage((page) => page - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < pageCount) {
      setCurrentPage((page) => page + 1);
    }
  };

  // Handle seal drag end -> update position
  const handleSealDrop = useCallback(
    (pdfX: number, pdfY: number) => {
      setPosition({
        mode: "page_xy",
        page_x: Math.round(pdfX * 100) / 100,
        page_y: Math.round(pdfY * 100) / 100,
      });
    },
    [setPosition]
  );

  const currentPageDim = pageDims[currentPage - 1] ?? null;

  return (
    <div className="pdf-viewer">
      <div className="pdf-toolbar">
        <span className="pdf-toolbar-file" title={filePath}>
          {fileName}
        </span>
        <div className="pdf-toolbar-controls">
          <button onClick={handlePrev} disabled={loading || !!error || currentPage <= 1}>
            &lt;
          </button>
          <span className="page-info">
            {pageCount > 0 ? `${currentPage} / ${pageCount}` : "- / -"}
          </span>
          <button onClick={handleNext} disabled={loading || !!error || currentPage >= pageCount}>
            &gt;
          </button>
          <span className="scale-info">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale((s) => Math.max(MIN_SCALE, s - SCALE_STEP))}>
            -
          </button>
          <button onClick={() => setScale((s) => Math.min(MAX_SCALE, s + SCALE_STEP))}>
            +
          </button>
        </div>
      </div>

      {loading ? (
        <div className="pdf-loading">加载中...</div>
      ) : error ? (
        <div className="pdf-error">加载失败: {error}</div>
      ) : (
        <div
          className="pdf-canvas-container"
          onWheel={handleWheel}
        >
          <div className="pdf-canvas-wrapper" style={{ position: "relative" }}>
            <canvas ref={canvasRef} />
            {viewport && currentPageDim && (
              <SealOverlay
                canvasWidth={canvasRef.current?.width ?? 0}
                canvasHeight={canvasRef.current?.height ?? 0}
                pageWidthPt={currentPageDim.width_pt}
                pageHeightPt={currentPageDim.height_pt}
                onDrop={handleSealDrop}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
