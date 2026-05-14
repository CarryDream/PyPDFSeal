import { useEffect, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { localFileSrc } from "../utils/localFile";

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export interface PageViewport {
  width: number;
  height: number;
  scale: number;
}

export function usePdfDocument(filePath: string | null) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!filePath) {
      setDoc(null);
      setPageCount(0);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        const url = localFileSrc(filePath);
        const data = await readPdfBytes(url);
        const loadingTask = pdfjsLib.getDocument({ data });
        const pdfDoc = await loadingTask.promise;

        if (!cancelled) {
          setDoc(pdfDoc);
          setPageCount(pdfDoc.numPages);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [filePath]);

  const renderPage = useCallback(
    async (
      pageNum: number,
      canvas: HTMLCanvasElement,
      scale: number
    ): Promise<PageViewport | null> => {
      if (!doc || pageNum < 1 || pageNum > doc.numPages) return null;

      const page: PDFPageProxy = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const context = canvas.getContext("2d")!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: context, viewport }).promise;

      return {
        width: viewport.width,
        height: viewport.height,
        scale,
      };
    },
    [doc]
  );

  return { doc, pageCount, loading, error, renderPage };
}

async function readPdfBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to read PDF: ${response.status} ${response.statusText}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}
