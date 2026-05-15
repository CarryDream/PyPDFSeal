import { useEffect, useRef } from "react";
import { emit } from "@tauri-apps/api/event";
import { useConfigStore } from "../store/configStore";
import { setCloseBehavior, showMainWindow } from "../utils/ipc";
import { checkForUpdates, installPendingUpdate } from "../utils/updates";

export async function checkAppUpdates() {
  const state = useConfigStore.getState();
  if (state.updateStatus.checking) return;

  state.setUpdateStatus({ checking: true, error: "", download_progress: 0 });

  try {
    const result = await checkForUpdates();
    useConfigStore.getState().setUpdateStatus({
      ...result,
      checking: false,
      installing: false,
      download_progress: 0,
      error: "",
      last_checked: new Date().toLocaleString(),
    });

    if (result.update_available) {
      await showMainWindow().catch(() => undefined);
      useConfigStore.getState().addLog(
        `发现新版 ${result.latest_version}，当前版本 ${result.current_version}`,
        "#1976d2",
      );
      await emit("show-updates-requested").catch(() => undefined);
    }
  } catch (e) {
    useConfigStore.getState().setUpdateStatus({
      checking: false,
      installing: false,
      error: String(e),
      last_checked: new Date().toLocaleString(),
    });
  }
}

export async function installAppUpdate() {
  const state = useConfigStore.getState();
  if (state.updateStatus.installing) return;

  state.setUpdateStatus({ installing: true, error: "", download_progress: 0 });

  try {
    await installPendingUpdate((progress) => {
      useConfigStore.getState().setUpdateStatus({
        download_progress: progress.percent,
      });
    });
  } catch (e) {
    useConfigStore.getState().setUpdateStatus({
      installing: false,
      error: String(e),
    });
  }
}

export function useAppSettings() {
  const autoCheckedRef = useRef(false);

  useEffect(() => {
    const sync = (behavior: ReturnType<typeof useConfigStore.getState>["appSettings"]["close_behavior"]) => {
      setCloseBehavior(behavior).catch((e) => console.warn("Failed to sync close behavior:", e));
    };

    sync(useConfigStore.getState().appSettings.close_behavior);

    const unsubscribe = useConfigStore.subscribe((state, prevState) => {
      if (state.appSettings.close_behavior !== prevState.appSettings.close_behavior) {
        sync(state.appSettings.close_behavior);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (autoCheckedRef.current) return;
    autoCheckedRef.current = true;

    const timer = window.setTimeout(() => {
      if (useConfigStore.getState().appSettings.auto_check_updates) {
        void checkAppUpdates();
      }
    }, 1200);

    return () => window.clearTimeout(timer);
  }, []);

}
