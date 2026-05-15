import { Button, Progress } from "@heroui/react";
import { useConfigStore } from "../../store/configStore";
import { batchProcess, batchPause, batchResume, batchCancel } from "../../utils/ipc";
import type { SealOptions } from "../../types";

export default function ProgressPanel() {
  const {
    files, sealEnabled, sealImagePath, sealWidth, sealHeight, sealOpacity,
    position, watermark, cert, outputDir, appSettings,
    batchRunning, batchPaused, batchProgress,
    setBatchRunning, setBatchPaused, setBatchProgress,
    setBatchStartedAt, setBatchSummary, addLog, clearLogs,
  } = useConfigStore();

  const handleStart = async () => {
    const hasOperation =
      (sealEnabled && Boolean(sealImagePath)) ||
      (watermark.enabled && watermark.text.trim().length > 0) ||
      (cert.enabled && cert.cert_path.length > 0);
    if (files.length === 0 || !hasOperation) return;

    const options: SealOptions = {
      seal_image_path: sealEnabled ? sealImagePath : "",
      seal_width: sealWidth,
      seal_height: sealHeight,
      seal_opacity: sealOpacity,
      position,
      watermark,
      cert,
      output_dir: outputDir,
      output_name: appSettings.output_name ?? { mode: "suffix", text: "_sealed" },
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
    (sealEnabled && Boolean(sealImagePath)) ||
    (watermark.enabled && watermark.text.trim().length > 0) ||
    (cert.enabled && cert.cert_path.length > 0);

  return (
    <div className="flex items-center gap-4 px-3 py-2 bg-content1 border-b border-divider">
      {/* 进度条 */}
      <div className="flex-1 min-w-0">
        <Progress
          aria-label="批处理进度"
          value={progressPct}
          color={progressPct === 100 ? "success" : "primary"}
          size="sm"
          className="w-full"
        />
        <div className="text-[11px] text-foreground-500 mt-0.5">
          {batchProgress
            ? `${batchProgress.done} / ${batchProgress.total} 文件`
            : "就绪"}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2 shrink-0">
        <Button
          size="sm"
          color="primary"
          onPress={handleStart}
          isDisabled={batchRunning || files.length === 0 || !canStart}
        >
          开始
        </Button>
        <Button
          size="sm"
          variant="flat"
          onPress={handlePauseResume}
          isDisabled={!batchRunning}
        >
          {batchPaused ? "恢复" : "暂停"}
        </Button>
        <Button
          size="sm"
          variant="flat"
          color="danger"
          onPress={handleCancel}
          isDisabled={!batchRunning}
        >
          取消
        </Button>
      </div>
    </div>
  );
}
