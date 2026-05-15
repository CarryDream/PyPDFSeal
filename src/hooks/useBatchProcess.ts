import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import type { BatchIssue, BatchProgress } from "../types";
import { useConfigStore } from "../store/configStore";

interface BatchStatsDraft {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  outputs: string[];
  failures: BatchIssue[];
  skipped_files: BatchIssue[];
  started_at: number;
}

export function useBatchProcess() {
  const statsRef = useRef<BatchStatsDraft | null>(null);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;

    const setup = async () => {
      const stop = await listen<BatchProgress>("batch-progress", (event) => {
        const p = event.payload;
        const s = useConfigStore.getState();
        s.setBatchProgress(p);

        if (!statsRef.current || p.done <= 1) {
          statsRef.current = {
            total: p.total,
            succeeded: 0,
            failed: 0,
            skipped: 0,
            outputs: [],
            failures: [],
            skipped_files: [],
            started_at: s.batchStartedAt ?? Date.now(),
          };
        }
        const stats = statsRef.current;

        if (p.status === "ok") {
          stats.succeeded += 1;
          if (p.output) stats.outputs.push(p.output);
          s.addLog(`完成: ${p.done} / ${p.total}: ${p.file}`, "#4caf50");
        } else if (p.status === "error") {
          stats.failed += 1;
          stats.failures.push({ file: p.file, message: p.error ?? "未知错误" });
          s.addLog(`失败: ${p.file} - ${p.error}`, "#f44336");
        } else if (p.status === "skipped") {
          stats.skipped += 1;
          stats.skipped_files.push({ file: p.file, message: p.error ?? "已跳过" });
          s.addLog(`跳过: ${p.file} - ${p.error}`, "#ff9800");
        } else if (p.status === "cancelled") {
          s.addLog("已取消", "#ff9800");
        }

        if (p.done === p.total || p.status === "cancelled") {
          const cancelled = p.status === "cancelled" ? Math.max(p.total - p.done, 0) : 0;
          s.setBatchSummary({
            total: stats.total,
            succeeded: stats.succeeded,
            failed: stats.failed,
            skipped: stats.skipped,
            cancelled,
            elapsed_ms: Date.now() - stats.started_at,
            started_at: stats.started_at,
            finished_at: Date.now(),
            outputs: stats.outputs,
            failures: stats.failures,
            skipped_files: stats.skipped_files,
          });
          s.setBatchStartedAt(null);
          s.setBatchRunning(false);
          s.setBatchPaused(false);
        }
      });

      if (disposed) {
        stop();
      } else {
        unlisten = stop;
      }
    };

    setup();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
}
