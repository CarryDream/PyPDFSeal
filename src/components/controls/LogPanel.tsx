import { useEffect, useRef, useCallback } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { Button } from "@heroui/react";
import { useConfigStore } from "../../store/configStore";

const DEFAULT_HEIGHT = 180;
const MIN_HEIGHT = 92;
const MINIMIZED_HEIGHT = 32;
const LOG_LIMIT = 100;
const SCROLL_THRESHOLD = 8;

export default function LogPanel() {
  const { logs, clearLogs, logPanelHeight, logPanelMode, setLogPanelHeight, setLogPanelMode } = useConfigStore();
  const height = logPanelHeight;
  const mode = logPanelMode;
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  const checkAutoScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD;
  }, []);

  // Auto-scroll when logs change
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const maxHeight = () => Math.max(DEFAULT_HEIGHT, window.innerHeight - 120);

  const restore = () => {
    setLogPanelMode("normal");
    setLogPanelHeight(Math.min(Math.max(height, DEFAULT_HEIGHT), maxHeight()));
  };

  const minimize = () => {
    setLogPanelMode("minimized");
  };

  const maximize = () => {
    setLogPanelMode("maximized");
    setLogPanelHeight(maxHeight());
  };

  const toggleByDoubleClick = () => {
    if (mode === "maximized") {
      minimize();
      return;
    }
    maximize();
  };

  const beginResize = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (mode === "minimized") {
      restore();
    }
    dragRef.current = {
      startY: event.clientY,
      startHeight: mode === "maximized" ? maxHeight() : height,
    };
    document.body.classList.add("resizing-log-panel");
  };

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!dragRef.current) return;

      const nextHeight = dragRef.current.startHeight + dragRef.current.startY - event.clientY;
      setLogPanelMode("normal");
      setLogPanelHeight(Math.min(Math.max(nextHeight, MIN_HEIGHT), maxHeight()));
    };

    const onMouseUp = () => {
      dragRef.current = null;
      document.body.classList.remove("resizing-log-panel");
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.classList.remove("resizing-log-panel");
    };
  }, [height, mode, setLogPanelHeight, setLogPanelMode]);

  useEffect(() => {
    const onResize = () => {
      setLogPanelHeight(Math.min(height, maxHeight()));
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [height, setLogPanelHeight]);

  const renderedHeight =
    mode === "minimized" ? MINIMIZED_HEIGHT : mode === "maximized" ? maxHeight() : height;

  return (
    <div
      className={`log-panel ${mode}`}
      style={{ height: renderedHeight }}
    >
      <div
        className="log-resize-handle"
        onMouseDown={beginResize}
        onDoubleClick={toggleByDoubleClick}
        title="拖拽调整日志高度，双击最大化或最小化"
      />
      <div className="flex items-center justify-between px-2 py-1 border-b border-divider bg-content1 shrink-0">
        <span className="text-sm font-medium text-foreground">日志</span>
        <div className="flex gap-0.5">
          <Button size="sm" variant="light" onPress={clearLogs}>清空</Button>
          {mode === "minimized" ? (
            <Button size="sm" variant="light" onPress={restore}>还原</Button>
          ) : (
            <Button size="sm" variant="light" onPress={minimize}>最小化</Button>
          )}
          {mode === "maximized" ? (
            <Button size="sm" variant="light" onPress={restore}>还原</Button>
          ) : (
            <Button size="sm" variant="light" onPress={maximize}>最大化</Button>
          )}
        </div>
      </div>

      {mode !== "minimized" && (
        <div ref={scrollRef} onScroll={checkAutoScroll} className="log-content flex-1 overflow-y-auto p-2 text-xs font-mono space-y-0.5">
          {logs.length >= LOG_LIMIT && (
            <div className="px-2 py-1 text-foreground-400">
              仅保留最近 {LOG_LIMIT} 条日志，早期日志自动覆盖。
            </div>
          )}
          {logs.length === 0 ? (
            <div className="text-foreground-400 px-2 py-1">暂无日志</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="flex gap-2 text-foreground-600" style={{ color: log.color || undefined }}>
                <span className="text-foreground-400 shrink-0">[{log.time}]</span>
                <span className="flex-1 break-all">{log.message}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
