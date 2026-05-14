import { useConfigStore } from "../../store/configStore";
import { batchProcess, batchPause, batchResume, batchCancel } from "../../utils/ipc";
import type { SealOptions } from "../../types";

export default function ProgressPanel() {
  const {
    files, sealImagePath, sealWidth, sealHeight, sealOpacity,
    position, watermark, cert, outputDir,
    batchRunning, batchPaused, batchProgress,
    setBatchRunning, setBatchPaused, setBatchProgress,
    setBatchStartedAt, setBatchSummary, addLog, clearLogs,
  } = useConfigStore();

  const handleStart = async () => {
    const hasOperation =
      Boolean(sealImagePath) ||
      (watermark.enabled && watermark.text.trim().length > 0) ||
      (cert.enabled && cert.cert_path.length > 0);
    if (files.length === 0 || !hasOperation) return;

    const options: SealOptions = {
      seal_image_path: sealImagePath,
      seal_width: sealWidth,
      seal_height: sealHeight,
      seal_opacity: sealOpacity,
      position,
      watermark,
      cert,
      output_dir: outputDir,
    };

    setBatchRunning(true);
    setBatchPaused(false);
    setBatchProgress(null);
    setBatchStartedAt(Date.now());
    setBatchSummary(null);
    clearLogs();
    addLog(`开始处理 ${files.length} 个文件...`);

    try {
      await batchProcess(files, options);
    } catch (e) {
      addLog(`批量处理错误: ${e}`, "#f44336");
      setBatchStartedAt(null);
      setBatchRunning(false);
    }
  };

  const handlePauseResume = async () => {
    if (batchPaused) {
      await batchResume();
      setBatchPaused(false);
      addLog("已恢复");
    } else {
      await batchPause();
      setBatchPaused(true);
      addLog("已暂停");
    }
  };

  const handleCancel = async () => {
    await batchCancel();
    addLog("正在取消...");
  };

  const progressPct = batchProgress
    ? Math.round((batchProgress.done / batchProgress.total) * 100)
    : 0;
  const canStart =
    Boolean(sealImagePath) ||
    (watermark.enabled && watermark.text.trim().length > 0) ||
    (cert.enabled && cert.cert_path.length > 0);

  return (
    <div className="progress-panel">
      <div className="progress-bar-container">
        <div className="progress-bar" style={{ width: `${progressPct}%` }} />
      </div>
      <div className="progress-info">
        {batchProgress
          ? `${batchProgress.done} / ${batchProgress.total}`
          : "就绪"}
      </div>
      <div className="progress-buttons">
        <button onClick={handleStart} disabled={batchRunning || files.length === 0 || !canStart}>
          开始
        </button>
        <button onClick={handlePauseResume} disabled={!batchRunning}>
          {batchPaused ? "恢复" : "暂停"}
        </button>
        <button onClick={handleCancel} disabled={!batchRunning}>
          取消
        </button>
      </div>
    </div>
  );
}
