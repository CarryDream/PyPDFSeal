import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { listen } from "@tauri-apps/api/event";
import SettingsPanel from "../panels/SettingsPanel";
import { checkAppUpdates } from "../../hooks/useAppSettings";
import { useConfigStore } from "../../store/configStore";
import { getAppVersion } from "../../utils/ipc";
import { openReleasePage } from "../../utils/updates";

type ActiveModal = "settings" | "updates" | "about" | null;

export default function AppModals() {
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const { updateStatus, setUpdateStatus } = useConfigStore();

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

  if (!activeModal) return null;

  return (
    <Modal
      title={
        activeModal === "settings"
          ? "应用设置"
          : activeModal === "updates"
            ? "检查更新"
            : "关于"
      }
      onClose={() => setActiveModal(null)}
    >
      {activeModal === "settings" && <SettingsPanel />}
      {activeModal === "updates" && <UpdatePanel />}
      {activeModal === "about" && <AboutPanel />}
    </Modal>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function UpdatePanel() {
  const { updateStatus } = useConfigStore();

  return (
    <div className="panel settings-panel">
      <div className="settings-section">
        <div className="settings-row">
          <span>当前版本</span>
          <strong>{updateStatus.current_version || "-"}</strong>
        </div>
        <div className="settings-row">
          <span>最新版本</span>
          <strong>{updateStatus.latest_version || "-"}</strong>
        </div>
        <button onClick={() => void checkAppUpdates()} disabled={updateStatus.checking}>
          {updateStatus.checking ? "检查中..." : "重新检查"}
        </button>
        {updateStatus.update_available && (
          <button onClick={() => void openReleasePage(updateStatus.release_url)}>
            打开下载页
          </button>
        )}
        {updateStatus.last_checked && (
          <div className="settings-note">上次检查: {updateStatus.last_checked}</div>
        )}
        {updateStatus.error && (
          <div className="settings-error">检查失败: {updateStatus.error}</div>
        )}
        {!updateStatus.error && updateStatus.last_checked && !updateStatus.latest_version && (
          <div className="settings-note">暂无公开发布版本</div>
        )}
        {!updateStatus.error && updateStatus.latest_version && !updateStatus.update_available && (
          <div className="settings-note">当前已是最新版本</div>
        )}
      </div>
    </div>
  );
}

function AboutPanel() {
  const { updateStatus } = useConfigStore();
  const version = updateStatus.current_version || "-";

  return (
    <div className="about-panel">
      <div className="about-title">PyPDFSeal</div>
      <div className="settings-row">
        <span>当前版本</span>
        <strong>{version}</strong>
      </div>
      <div className="settings-row">
        <span>项目地址</span>
        <button onClick={() => void openReleasePage("https://github.com/CarryDream/PyPDFSeal")}>
          打开 GitHub
        </button>
      </div>
      <div className="settings-note">PDF 批量盖章、文本水印和证书签名工具。</div>
    </div>
  );
}
