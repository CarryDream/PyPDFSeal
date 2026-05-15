import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/react";
import SettingsPanel from "../panels/SettingsPanel";
import { checkAppUpdates, installAppUpdate } from "../../hooks/useAppSettings";
import { useConfigStore } from "../../store/configStore";
import { getAppVersion } from "../../utils/ipc";
import { openReleasePage } from "../../utils/updates";
import type { BatchIssue, BatchSummary } from "../../types";

type ActiveModal = "settings" | "updates" | "about" | null;

export default function AppModals() {
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const { updateStatus, setUpdateStatus, batchSummary, setBatchSummary } = useConfigStore();

  useEffect(() => {
    if (updateStatus.current_version) return;
    getAppVersion()
      .then((version) => setUpdateStatus({ current_version: version }))
      .catch((e) => setUpdateStatus({ error: String(e) }));
  }, [setUpdateStatus, updateStatus.current_version]);

  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    let disposed = false;

    const addListener = async (
      event: string,
      handler: () => void | Promise<void>,
    ) => {
      const stop = await listen(event, () => {
        void handler();
      });

      if (disposed) {
        stop();
      } else {
        unlisteners.push(stop);
      }
    };

    void addListener("show-settings-requested", () => setActiveModal("settings"));
    void addListener("show-about-requested", () => setActiveModal("about"));
    void addListener("check-update-requested", async () => {
      setActiveModal("updates");
      await checkAppUpdates();
    });

    return () => {
      disposed = true;
      unlisteners.forEach((stop) => stop());
    };
  }, []);

  const isOpen = !!activeModal;

  const title =
    activeModal === "settings"
      ? "应用设置"
      : activeModal === "updates"
      ? "检查更新"
      : activeModal === "about"
      ? "关于 PyPDFSeal"
      : "";

  const handleClose = () => setActiveModal(null);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) handleClose();
        }}
        size="lg"
        scrollBehavior="inside"
        classNames={{
          base: "max-w-[520px]",
          header: "border-b border-divider pb-3",
          body: "py-4",
        }}
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="text-base font-semibold pr-10">
                {title}
              </ModalHeader>
              <ModalBody>
                {activeModal === "settings" && <SettingsPanel />}
                {activeModal === "updates" && <UpdatePanel />}
                {activeModal === "about" && <AboutPanel />}
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>

      <BatchSummaryModal
        summary={batchSummary}
        onClose={() => setBatchSummary(null)}
      />
    </>
  );
}

function BatchSummaryModal({
  summary,
  onClose,
}: {
  summary: BatchSummary | null;
  onClose: () => void;
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const hasError = !!summary && summary.failed > 0;
  const hasWarning = !!summary && (summary.skipped > 0 || summary.cancelled > 0);

  const handleCopy = async (key: string, text: string) => {
    await copyText(text);
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((current) => current === key ? null : current);
    }, 1500);
  };

  return (
    <Modal
      isOpen={!!summary}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="lg"
      scrollBehavior="inside"
      classNames={{
        base: "max-w-[560px]",
        header: "border-b border-divider pb-3",
        body: "py-4",
        footer: "border-t border-divider",
      }}
    >
      <ModalContent>
        {() => summary ? (
          <>
            <ModalHeader className="flex items-center justify-between gap-3 pr-10">
              <div className="text-base font-semibold">处理完成</div>
              <div className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                hasError ? "bg-danger-100 text-danger-700" :
                hasWarning ? "bg-warning-100 text-warning-700" :
                "bg-success-100 text-success-700"
              }`}>
                {hasError ? "存在失败" : hasWarning ? "存在跳过" : "全部成功"}
              </div>
            </ModalHeader>

            <ModalBody>
              <div className="text-xs text-foreground-500">
                共 {summary.total} 个文件 · 用时 {formatElapsed(summary.elapsed_ms)}
              </div>

              <div className="grid grid-cols-4 gap-2">
                <SummaryMetric label="成功" value={summary.succeeded} tone="success" />
                <SummaryMetric label="失败" value={summary.failed} tone="danger" />
                <SummaryMetric label="跳过" value={summary.skipped} tone="warning" />
                <SummaryMetric label="取消" value={summary.cancelled} tone="default" />
              </div>

              {summary.outputs.length > 0 && (
                <div className="rounded-md border border-divider bg-content2 p-3">
                  <SummarySectionHeader
                    title="输出文件"
                    copyLabel={copiedKey === "outputs" ? "已复制" : "复制"}
                    onCopy={() => void handleCopy("outputs", summary.outputs.join("\n"))}
                  />
                  <div className="max-h-[110px] space-y-1 overflow-auto font-mono text-[11px] text-success-700">
                    {summary.outputs.map((path, index) => (
                      <div key={index} className="truncate" title={path}>{path}</div>
                    ))}
                  </div>
                </div>
              )}

              {summary.failures.length > 0 && (
                <SummaryIssueList
                  title="失败文件"
                  issues={summary.failures}
                  tone="danger"
                  copyLabel={copiedKey === "failures" ? "已复制" : "复制"}
                  onCopy={() => void handleCopy("failures", formatIssues(summary.failures))}
                />
              )}
              {summary.skipped_files.length > 0 && (
                <SummaryIssueList
                  title="跳过文件"
                  issues={summary.skipped_files}
                  tone="warning"
                  copyLabel={copiedKey === "skipped" ? "已复制" : "复制"}
                  onCopy={() => void handleCopy("skipped", formatIssues(summary.skipped_files))}
                />
              )}
            </ModalBody>

            <ModalFooter>
              <Button color="primary" onPress={onClose}>关闭</Button>
            </ModalFooter>
          </>
        ) : null}
      </ModalContent>
    </Modal>
  );
}

function SummarySectionHeader({
  title,
  className = "text-foreground",
  copyLabel,
  onCopy,
}: {
  title: string;
  className?: string;
  copyLabel: string;
  onCopy: () => void;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <div className={`text-xs font-semibold ${className}`}>{title}</div>
      <Button size="sm" variant="light" className="h-6 px-2 text-xs" onPress={onCopy}>
        {copyLabel}
      </Button>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "danger" | "warning" | "default";
}) {
  const toneClass =
    tone === "success" ? "text-success-600" :
    tone === "danger" ? "text-danger-600" :
    tone === "warning" ? "text-warning-600" : "text-foreground-500";

  return (
    <div className="rounded-md border border-divider bg-content1 px-3 py-2 text-center">
      <div className="text-[11px] text-foreground-500">{label}</div>
      <div className={`text-xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function SummaryIssueList({
  title,
  issues,
  tone,
  copyLabel,
  onCopy,
}: {
  title: string;
  issues: BatchIssue[];
  tone: "danger" | "warning";
  copyLabel: string;
  onCopy: () => void;
}) {
  const titleColor = tone === "danger" ? "text-danger-600" : "text-warning-600";

  return (
    <div className="rounded-md border border-divider bg-content2 p-3">
      <SummarySectionHeader
        title={title}
        className={titleColor}
        copyLabel={copyLabel}
        onCopy={onCopy}
      />
      <div className="max-h-[120px] space-y-1 overflow-auto text-xs">
        {issues.map((issue, index) => (
          <div key={index} className="grid grid-cols-[120px_minmax(0,1fr)] gap-2">
            <span className="truncate font-mono text-foreground-500" title={issue.file}>
              {basename(issue.file)}
            </span>
            <span className="break-all text-foreground-600">{issue.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

function formatIssues(issues: BatchIssue[]): string {
  return issues.map((issue) => `${issue.file}\t${issue.message}`).join("\n");
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

function UpdatePanel() {
  const { updateStatus } = useConfigStore();

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="grid grid-cols-2 gap-y-2 text-foreground-600">
        <div>当前版本</div>
        <div className="font-medium text-foreground">{updateStatus.current_version || "-"}</div>
        <div>最新版本</div>
        <div className="font-medium text-foreground">{updateStatus.latest_version || "-"}</div>
      </div>

      <div className="flex flex-col gap-2 pt-2">
        <Button
          size="sm"
          variant="flat"
          onPress={() => void checkAppUpdates()}
          isDisabled={updateStatus.checking}
          className="w-full"
        >
          {updateStatus.checking ? "检查中..." : "重新检查"}
        </Button>

        {updateStatus.update_available && updateStatus.installable && (
          <Button
            size="sm"
            color="primary"
            onPress={() => void installAppUpdate()}
            isDisabled={updateStatus.installing}
            className="w-full"
          >
            {updateStatus.installing
              ? `更新中 ${updateStatus.download_progress || 0}%`
              : "下载并安装"}
          </Button>
        )}

        {updateStatus.update_available && (
          <Button
            size="sm"
            variant="flat"
            onPress={() => void openReleasePage(updateStatus.release_url)}
            className="w-full"
          >
            打开下载页
          </Button>
        )}
      </div>

      {updateStatus.last_checked && (
        <div className="text-xs text-foreground-500 mt-1">
          上次检查: {updateStatus.last_checked}
        </div>
      )}
      {updateStatus.error && (
        <div className="text-xs text-danger">{updateStatus.error}</div>
      )}
      {!updateStatus.error && updateStatus.last_checked && !updateStatus.latest_version && (
        <div className="text-xs text-foreground-500">暂无公开发布版本</div>
      )}
      {!updateStatus.error && updateStatus.latest_version && !updateStatus.update_available && (
        <div className="text-xs text-success-600">当前已是最新版本</div>
      )}
    </div>
  );
}

function AboutPanel() {
  const { updateStatus } = useConfigStore();
  const version = updateStatus.current_version || "-";

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div>
        <div className="text-xl font-semibold tracking-tight">PyPDFSeal</div>
        <div className="text-xs text-foreground-500 mt-0.5">PDF 批量盖章 · 水印 · 证书签名工具</div>
      </div>

      <div className="grid grid-cols-2 gap-y-2 text-foreground-600">
        <div>当前版本</div>
        <div className="font-medium text-foreground">{version}</div>
        <div>项目地址</div>
        <button
          onClick={() => void openReleasePage("https://github.com/CarryDream/PyPDFSeal")}
          className="text-left text-primary hover:underline w-fit"
        >
          GitHub 仓库
        </button>
      </div>
    </div>
  );
}
