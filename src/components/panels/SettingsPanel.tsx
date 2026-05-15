import { useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useConfigStore } from "../../store/configStore";
import { getAppVersion } from "../../utils/ipc";
import { openReleasePage } from "../../utils/updates";
import { checkAppUpdates, installAppUpdate } from "../../hooks/useAppSettings";
import type { CloseBehavior, OutputNameMode } from "../../types";

export default function SettingsPanel() {
  const {
    appSettings,
    outputDir,
    updateStatus,
    setAppSettings,
    setOutputDir,
    setUpdateStatus,
  } = useConfigStore();
  const outputName = appSettings.output_name ?? { mode: "suffix" as const, text: "_sealed" };

  useEffect(() => {
    if (updateStatus.current_version) return;
    getAppVersion()
      .then((version) => setUpdateStatus({ current_version: version }))
      .catch((e) => setUpdateStatus({ error: String(e) }));
  }, [setUpdateStatus, updateStatus.current_version]);

  const handleCloseBehaviorChange = (value: string) => {
    setAppSettings({ close_behavior: value as CloseBehavior });
  };

  const handleOutputNameModeChange = (value: string) => {
    setAppSettings({
      output_name: { ...outputName, mode: value as OutputNameMode },
    });
  };

  const handleSelectOutput = async () => {
    const dir = await open({ directory: true });
    if (dir) {
      setOutputDir(dir as string);
    }
  };

  return (
    <div className="panel settings-panel">
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={appSettings.auto_check_updates}
          onChange={(e) => setAppSettings({ auto_check_updates: e.target.checked })}
        />
        启动时检查更新
      </label>

      <label>点击窗口关闭按钮</label>
      <select
        value={appSettings.close_behavior}
        onChange={(e) => handleCloseBehaviorChange(e.target.value)}
      >
        <option value="minimize_to_tray">最小化到托盘</option>
        <option value="minimize_to_taskbar">最小化到任务栏</option>
        <option value="exit">直接退出</option>
      </select>

      <div className="settings-section">
        <label>默认输出目录</label>
        <div className="output-dir-row">
          <input
            type="text"
            value={outputDir}
            placeholder="默认: 原文件同级 sealed 子目录"
            readOnly
          />
          <button onClick={handleSelectOutput}>选择</button>
          <button onClick={() => setOutputDir("")} disabled={!outputDir}>
            清除
          </button>
        </div>
      </div>

      <div className="settings-section">
        <label>输出文件名</label>
        <select
          value={outputName.mode}
          onChange={(e) => handleOutputNameModeChange(e.target.value)}
        >
          <option value="suffix">添加后缀</option>
          <option value="prefix">添加前缀</option>
          <option value="none">不添加</option>
        </select>
        {outputName.mode !== "none" && (
          <input
            type="text"
            value={outputName.text}
            placeholder={outputName.mode === "suffix" ? "_sealed" : "sealed_"}
            onChange={(e) =>
              setAppSettings({
                output_name: { ...outputName, text: e.target.value },
              })
            }
          />
        )}
        <div className="settings-note">
          示例: {formatOutputNameExample(outputName.mode, outputName.text)}
        </div>
      </div>

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
          {updateStatus.checking ? "检查中..." : "检查新版"}
        </button>
        {updateStatus.update_available && updateStatus.installable && (
          <button
            onClick={() => void installAppUpdate()}
            disabled={updateStatus.installing}
          >
            {updateStatus.installing
              ? `更新中 ${updateStatus.download_progress || 0}%`
              : "下载并安装"}
          </button>
        )}
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

function formatOutputNameExample(mode: OutputNameMode, text: string): string {
  const affix = text || (mode === "prefix" ? "sealed_" : "_sealed");
  if (mode === "prefix") return `${affix}example.pdf`;
  if (mode === "suffix") return `example${affix}.pdf`;
  return "example.pdf";
}
