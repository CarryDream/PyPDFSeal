import { useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import { Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Tabs, Tab, Pagination, addToast } from "@heroui/react";
import SettingsPanel from "../panels/SettingsPanel";
import { checkAppUpdates, installAppUpdate } from "../../hooks/useAppSettings";
import { useModalDraggable } from "../../hooks/useModalDraggable";
import { useConfigStore } from "../../store/configStore";
import { getAppVersion, dbGetFilesPage, dbExportXlsx } from "../../utils/ipc";
import { openReleasePage } from "../../utils/updates";
import type { BatchFileRow, BatchSummary } from "../../types";

type ActiveModal = "settings" | "updates" | "about" | null;
const PAGE_SIZE = 10;

export default function AppModals() {
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const {
    updateStatus,
    setUpdateStatus,
    batchSummary,
    batchSummaryOpen,
    setBatchSummaryOpen,
  } = useConfigStore();

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
    void addListener("show-updates-requested", () => setActiveModal("updates"));

    return () => {
      disposed = true;
      unlisteners.forEach((stop) => stop());
    };
  }, []);

  const isOpen = !!activeModal;
  const { targetRef, moveProps } = useModalDraggable(isOpen);

  const title =
    activeModal === "settings"
      ? "应用设置"
      : activeModal === "updates"
      ? "检查更新"
      : activeModal === "about"
      ? "关于"
      : "";

  const handleClose = () => setActiveModal(null);

  return (
    <>
      <Modal
        ref={targetRef}
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
              <ModalHeader {...moveProps} className="text-base font-semibold pr-10 cursor-move select-none">
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
        isOpen={batchSummaryOpen}
        onClose={() => setBatchSummaryOpen(false)}
      />
    </>
  );
}

function BatchSummaryModal({
  summary,
  isOpen,
  onClose,
}: {
  summary: BatchSummary | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const hasError = !!summary && summary.failed > 0;
  const hasWarning = !!summary && (summary.skipped > 0 || summary.cancelled > 0);
  const { targetRef: batchTargetRef, moveProps: batchMoveProps } = useModalDraggable(isOpen && !!summary);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageData, setPageData] = useState<{ items: BatchFileRow[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);

  const fetchPage = useCallback(async (p: number, filter: string) => {
    setLoading(true);
    try {
      const f = filter === "all" ? undefined : filter;
      const result = await dbGetFilesPage(p, PAGE_SIZE, f);
      setPageData({ items: result.items, total: result.total });
    } catch (e) {
      console.error("Failed to fetch page:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && summary) {
      setPage(1);
      setStatusFilter("all");
      fetchPage(1, "all");
    }
  }, [isOpen, summary, fetchPage]);

  const handleTabChange = (key: React.Key) => {
    const filter = key as string;
    setStatusFilter(filter);
    setPage(1);
    fetchPage(1, filter);
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    fetchPage(p, statusFilter);
  };

  const handleExport = async () => {
    try {
      const savePath = await save({
        defaultPath: `batch_result_${Date.now()}.xlsx`,
        filters: [{ name: "Excel", extensions: ["xlsx"] }],
      });
      if (savePath) {
        await dbExportXlsx(savePath);
        addToast({
          title: "导出成功",
          description: savePath,
          color: "success",
          timeout: 3000,
        });
      }
    } catch (e) {
      console.error("Failed to export:", e);
    }
  };

  const totalPages = Math.max(1, Math.ceil(pageData.total / PAGE_SIZE));

  const statusTabs = [
    { key: "all", label: `全部 (${summary?.total ?? 0})` },
    { key: "success", label: `成功 (${summary?.succeeded ?? 0})` },
    { key: "fail", label: `失败 (${summary?.failed ?? 0})` },
    { key: "skip", label: `跳过 (${summary?.skipped ?? 0})` },
  ];

  return (
    <Modal
      ref={batchTargetRef}
      isOpen={isOpen && !!summary}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="lg"
      scrollBehavior="inside"
      classNames={{
        base: "max-w-[600px]",
        header: "border-b border-divider pb-3",
        body: "py-4",
        footer: "border-t border-divider",
      }}
    >
      <ModalContent>
        {() => summary ? (
          <>
            <ModalHeader {...batchMoveProps} className="flex items-center justify-between gap-3 pr-10 cursor-move select-none">
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
                {summary.started_at && (
                  <> · 开始 {formatTime(summary.started_at)}</>
                )}
                {summary.finished_at && (
                  <> · 完成 {formatTime(summary.finished_at)}</>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2">
                <SummaryMetric label="成功" value={summary.succeeded} tone="success" />
                <SummaryMetric label="失败" value={summary.failed} tone="danger" />
                <SummaryMetric label="跳过" value={summary.skipped} tone="warning" />
                <SummaryMetric label="取消" value={summary.cancelled} tone="default" />
              </div>

              <Tabs
                selectedKey={statusFilter}
                onSelectionChange={handleTabChange}
                size="sm"
                variant="light"
                classNames={{ tabList: "gap-1", tab: "text-xs h-7 px-2" }}
              >
                {statusTabs.map((tab) => (
                  <Tab key={tab.key} title={tab.label} />
                ))}
              </Tabs>

              <div className="min-h-[120px]">
                {loading ? (
                  <div className="flex items-center justify-center py-8 text-xs text-foreground-500">
                    加载中...
                  </div>
                ) : pageData.items.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-xs text-foreground-500">
                    暂无数据
                  </div>
                ) : (
                  <div className="space-y-1 font-mono text-[11px]">
                    {pageData.items.map((item) => {
                      const isIssue = item.status === "fail" || item.status === "skip";
                      const toneClass =
                        item.status === "success" ? "text-success-700" :
                        item.status === "fail" ? "text-danger-600" :
                        item.status === "skip" ? "text-warning-600" :
                        "text-foreground-500";
                      return (
                        <div key={item.id} className="rounded-md bg-content2 px-2 py-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`shrink-0 text-[10px] font-medium ${toneClass}`}>
                              {item.status === "success" ? "成功" :
                               item.status === "fail" ? "失败" :
                               item.status === "skip" ? "跳过" :
                               item.status === "processing" ? "处理中" : "待处理"}
                            </span>
                            <span className="flex-1 truncate text-foreground" title={item.file_path}>
                              {basename(item.file_path)}
                            </span>
                            {item.processing_time_ms != null && (
                              <span className="shrink-0 text-[10px] text-foreground-400">
                                {item.processing_time_ms}ms
                              </span>
                            )}
                          </div>
                          {isIssue && item.error_message && (
                            <div className="mt-0.5 truncate text-foreground-500" title={item.error_message}>
                              {item.error_message}
                            </div>
                          )}
                          {item.status === "success" && item.output_path && (
                            <div className="mt-0.5 truncate text-foreground-400" title={item.output_path}>
                              → {item.output_path}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {totalPages > 1 && (
                <div className="flex justify-center">
                  <Pagination
                    total={totalPages}
                    page={page}
                    onChange={handlePageChange}
                    size="sm"
                    showControls
                  />
                </div>
              )}
            </ModalBody>

            <ModalFooter>
              <Button variant="flat" onPress={() => void handleExport()}>
                导出 Excel
              </Button>
              <Button color="primary" onPress={onClose}>关闭</Button>
            </ModalFooter>
          </>
        ) : null}
      </ModalContent>
    </Modal>
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

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString();
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
        <div className="text-sm text-foreground-600">PDF 批量盖章 · 水印 · 证书签名工具</div>
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
