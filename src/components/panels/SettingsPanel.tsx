import { useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Button, Checkbox, Input, Select, SelectItem } from "@heroui/react";
import { useConfigStore } from "../../store/configStore";
import { getAppVersion } from "../../utils/ipc";
import { openReleasePage } from "../../utils/updates";
import { checkAppUpdates, installAppUpdate } from "../../hooks/useAppSettings";
import type { CloseBehavior, OutputNameMode, OutputStructureMode, ThemeMode } from "../../types";

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

  const handleThemeKeys = (keys: any) => {
    const value = Array.from(keys)[0] as ThemeMode | undefined;
    if (value) setAppSettings({ theme: value });
  };

  const handleCloseBehaviorChange = (value: string) => {
    setAppSettings({ close_behavior: value as CloseBehavior });
  };

  const handleCloseBehaviorKeys = (keys: any) => {
    const value = Array.from(keys)[0] as string | undefined;
    if (value) handleCloseBehaviorChange(value);
  };

  const handleOutputNameModeChange = (value: string) => {
    setAppSettings({
      output_name: { ...outputName, mode: value as OutputNameMode },
    });
  };

  const handleOutputNameModeKeys = (keys: any) => {
    const value = Array.from(keys)[0] as string | undefined;
    if (value) handleOutputNameModeChange(value);
  };

  const handleOutputStructureKeys = (keys: any) => {
    const value = Array.from(keys)[0] as OutputStructureMode | undefined;
    if (value) setAppSettings({ output_structure: value });
  };

  const handleSelectOutput = async () => {
    const dir = await open({ directory: true });
    if (dir) {
      setOutputDir(dir as string);
    }
  };

  return (
    <div className="flex flex-col gap-4 text-sm">
      <Checkbox
        isSelected={appSettings.auto_check_updates}
        onValueChange={(checked) => setAppSettings({ auto_check_updates: checked })}
        size="sm"
      >
        启动时检查更新
      </Checkbox>

      <Select
        label="主题外观"
        selectedKeys={[appSettings.theme ?? "light"]}
        onSelectionChange={handleThemeKeys}
        size="sm"
      >
        <SelectItem key="light">浅色</SelectItem>
        <SelectItem key="dark">深色</SelectItem>
        <SelectItem key="system">跟随系统</SelectItem>
      </Select>

      <Select
        label="点击窗口关闭按钮"
        selectedKeys={[appSettings.close_behavior]}
        onSelectionChange={handleCloseBehaviorKeys}
        size="sm"
      >
        <SelectItem key="minimize_to_tray">最小化到托盘</SelectItem>
        <SelectItem key="minimize_to_taskbar">最小化到任务栏</SelectItem>
        <SelectItem key="exit">直接退出</SelectItem>
      </Select>

      <div className="settings-section">
        <div className="text-xs font-medium text-foreground-600">默认输出目录</div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
          <Input
            value={outputDir}
            placeholder="默认: 原文件同级 sealed 子目录"
            readOnly
            size="sm"
            className="min-w-0"
          />
          <Button size="sm" variant="flat" onPress={handleSelectOutput}>
            选择
          </Button>
          <Button size="sm" variant="flat" onPress={() => setOutputDir("")} isDisabled={!outputDir}>
            清除
          </Button>
        </div>
      </div>

      <div className="settings-section">
        <Select
          label="输出结构"
          selectedKeys={[appSettings.output_structure ?? "flat"]}
          onSelectionChange={handleOutputStructureKeys}
          size="sm"
        >
          <SelectItem key="flat">平铺到输出目录</SelectItem>
          <SelectItem key="parent_folder">按来源文件夹分组</SelectItem>
        </Select>
        <div className="settings-note">
          按来源文件夹分组时，输出会进入“输出目录 / 学校文件夹名 / 文件名”。
        </div>
      </div>

      <div className="settings-section">
        <Select
          label="输出文件名"
          selectedKeys={[outputName.mode]}
          onSelectionChange={handleOutputNameModeKeys}
          size="sm"
        >
          <SelectItem key="suffix">添加后缀</SelectItem>
          <SelectItem key="prefix">添加前缀</SelectItem>
          <SelectItem key="none">不添加</SelectItem>
        </Select>
        {outputName.mode !== "none" && (
          <Input
            value={outputName.text}
            placeholder={outputName.mode === "suffix" ? "_sealed" : "sealed_"}
            onValueChange={(value) =>
              setAppSettings({
                output_name: { ...outputName, text: value },
              })
            }
            size="sm"
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
        <Button size="sm" variant="flat" onPress={() => void checkAppUpdates()} isDisabled={updateStatus.checking}>
          {updateStatus.checking ? "检查中..." : "检查新版"}
        </Button>
        {updateStatus.update_available && updateStatus.installable && (
          <Button
            size="sm"
            color="primary"
            onPress={() => void installAppUpdate()}
            isDisabled={updateStatus.installing}
          >
            {updateStatus.installing
              ? `更新中 ${updateStatus.download_progress || 0}%`
              : "下载并安装"}
          </Button>
        )}
        {updateStatus.update_available && (
          <Button size="sm" variant="flat" onPress={() => void openReleasePage(updateStatus.release_url)}>
            打开下载页
          </Button>
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
