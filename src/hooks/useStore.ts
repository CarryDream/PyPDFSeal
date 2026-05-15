import { useEffect, useRef } from "react";
import { useConfigStore } from "../store/configStore";
import { dbGetConfig, dbSetConfigBatch } from "../utils/ipc";

const DEBOUNCE_MS = 500;

// Keys to persist (excluding transient state and sensitive data)
const PERSIST_KEYS = [
  "sealEnabled",
  "sealImagePath",
  "sealWidth",
  "sealHeight",
  "sealOpacity",
  "position",
  "watermark",
  "appSettings",
  "outputDir",
  "previewScale",
  "leftWidth",
  "rightWidth",
  "leftCollapsed",
  "rightCollapsed",
  "logPanelHeight",
  "logPanelMode",
] as const;

// Cert fields to persist (excluding password)
const CERT_PERSIST_KEYS = ["enabled", "cert_path", "reason", "location", "contact"] as const;

function extractPersistEntries(state: ReturnType<typeof useConfigStore.getState>): Array<[string, unknown]> {
  const entries: Array<[string, unknown]> = [];
  for (const key of PERSIST_KEYS) {
    entries.push([key, state[key as keyof typeof state]]);
  }
  // Persist cert without password
  const cert: Record<string, unknown> = {};
  for (const key of CERT_PERSIST_KEYS) {
    cert[key] = state.cert[key];
  }
  entries.push(["cert", cert]);
  return entries;
}

function applySavedConfig(saved: Record<string, unknown>) {
  const partial: Record<string, unknown> = {};
  for (const key of PERSIST_KEYS) {
    if (saved[key] !== undefined) {
      if (key === "appSettings" && typeof saved[key] === "object" && saved[key] !== null) {
        const savedAppSettings = saved[key] as Record<string, unknown>;
        const currentAppSettings = useConfigStore.getState().appSettings;
        partial[key] = {
          ...currentAppSettings,
          ...savedAppSettings,
          output_name: {
            ...currentAppSettings.output_name,
            ...(typeof savedAppSettings.output_name === "object" &&
            savedAppSettings.output_name !== null
              ? (savedAppSettings.output_name as Record<string, unknown>)
              : {}),
          },
          output_structure:
            savedAppSettings.output_structure === "parent_folder"
              ? "parent_folder"
              : currentAppSettings.output_structure,
        };
      } else {
        partial[key] = saved[key];
      }
    }
  }
  if (saved.cert && typeof saved.cert === "object") {
    const certPartial: Record<string, unknown> = {};
    for (const key of CERT_PERSIST_KEYS) {
      if ((saved.cert as Record<string, unknown>)[key] !== undefined) {
        certPartial[key] = (saved.cert as Record<string, unknown>)[key];
      }
    }
    partial.cert = { ...useConfigStore.getState().cert, ...certPartial };
  }
  useConfigStore.setState(partial);
}

export function useConfigPersistence() {
  const loadedRef = useRef(false);

  // Load saved config on mount from DB
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    (async () => {
      try {
        const saved = await dbGetConfig();
        if (saved && Object.keys(saved).length > 0) {
          applySavedConfig(saved);
        }
      } catch (e) {
        console.warn("Failed to load config from DB:", e);
      }
    })();
  }, []);

  // Debounced save on config changes to DB
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = useConfigStore.subscribe((state) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          const entries = extractPersistEntries(state);
          await dbSetConfigBatch(entries as Array<[string, unknown]>);
        } catch (e) {
          console.warn("Failed to save config to DB:", e);
        }
      }, DEBOUNCE_MS);
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, []);
}
