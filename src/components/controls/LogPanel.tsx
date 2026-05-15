import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useConfigStore } from "../../store/configStore";
import type { BatchIssue, BatchSummary } from "../../types";

type LogPanelMode = "normal" | "minimized" | "maximized";

const DEFAULT_HEIGHT = 180;
const MIN_HEIGHT = 92;
const MINIMIZED_HEIGHT = 32;

export default function LogPanel() {
  const { logs, batchSummary, clearLogs } = useConfigStore();
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [mode, setMode] = useState<LogPanelMode>("normal");
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const maxHeight = () => Math.max(DEFAULT_HEIGHT, window.innerHeight - 120);

  const restore = () => {
    setMode("normal");
    setHeight((value) => Math.min(Math.max(value, DEFAULT_HEIGHT), maxHeight()));
  };

  const minimize = () => {
    setMode("minimized");
  };

  const maximize = () => {
    setMode("maximized");
    setHeight(maxHeight());
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
      setMode("normal");
      setHeight(Math.min(Math.max(nextHeight, MIN_HEIGHT), maxHeight()));
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
  }, [height, mode]);

  useEffect(() => {
    const onResize = () => {
      setHeight((value) => Math.min(value, maxHeight()));
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
      <div className="log-header">
        <span>日志</span>
        <div className="log-actions">
          <button onClick={clearLogs}>清空</button>
          {mode === "minimized" ? (
            <button onClick={restore}>还原</button>
          ) : (
            <button onClick={minimize}>最小化</button>
          )}
          {mode === "maximized" ? (
            <button onClick={restore}>还原</button>
          ) : (
            <button onClick={maximize}>最大化</button>
          )}
        </div>
      </div>
      {mode !== "minimized" && (
        <>
          {batchSummary && <BatchSummaryCard summary={batchSummary} />}
          <div className="log-content">
            {logs.map((log, i) => (
              <div key={i} className="log-entry" style={{ color: log.color }}>
                <span className="log-time">{log.time}</span>
                <span className="log-msg">{log.message}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BatchSummaryCard({ summary }: { summary: BatchSummary }) {
  return (
    <div className="batch-summary">
      <div className="batch-summary-head">
        <div>
          <div className="batch-summary-title">执行完成</div>
          <div className="batch-summary-subtitle">
            共 {summary.total} 个文件，用时 {formatElapsed(summary.elapsed_ms)}
          </div>
        </div>
        <div className={summary.failed > 0 ? "summary-badge danger" : "summary-badge success"}>
          {summary.failed > 0 ? "有失败" : "完成"}
        </div>
      </div>

      <div className="summary-metrics">
        <Metric label="成功" value={summary.succeeded} tone="success" />
        <Metric label="失败" value={summary.failed} tone="danger" />
        <Metric label="跳过" value={summary.skipped} tone="warning" />
        <Metric label="取消" value={summary.cancelled} tone="muted" />
      </div>

      {summary.failures.length > 0 && (
        <IssueList title="失败文件" issues={summary.failures} tone="danger" />
      )}
      {summary.skipped_files.length > 0 && (
        <IssueList title="跳过文件" issues={summary.skipped_files} tone="warning" />
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "danger" | "warning" | "muted";
}) {
  return (
    <div className={`summary-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function IssueList({
  title,
  issues,
  tone,
}: {
  title: string;
  issues: BatchIssue[];
  tone: "danger" | "warning";
}) {
  return (
    <div className={`summary-issues ${tone}`}>
      <div className="summary-issues-title">{title}</div>
      {issues.map((issue) => (
        <div className="summary-issue" key={`${issue.file}-${issue.message}`}>
          <span className="summary-issue-file" title={issue.file}>
            {basename(issue.file)}
          </span>
          <span className="summary-issue-message">{issue.message}</span>
        </div>
      ))}
    </div>
  );
}

function basename(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms} ms`;

  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} 秒`;

  return `${minutes} 分 ${seconds} 秒`;
}
