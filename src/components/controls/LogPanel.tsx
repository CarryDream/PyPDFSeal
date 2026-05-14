import { useConfigStore } from "../../store/configStore";
import type { BatchIssue, BatchSummary } from "../../types";

export default function LogPanel() {
  const { logs, batchSummary, clearLogs } = useConfigStore();

  return (
    <div className="log-panel">
      <div className="log-header">
        <span>日志</span>
        <button onClick={clearLogs}>清空</button>
      </div>
      {batchSummary && <BatchSummaryCard summary={batchSummary} />}
      <div className="log-content">
        {logs.map((log, i) => (
          <div key={i} className="log-entry" style={{ color: log.color }}>
            <span className="log-time">{log.time}</span>
            <span className="log-msg">{log.message}</span>
          </div>
        ))}
      </div>
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
