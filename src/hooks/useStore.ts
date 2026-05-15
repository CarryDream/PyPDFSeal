import { useEffect, useRef } from "react";
import { LazyStore } from "@tauri-apps/plugin-store";
import { useConfigStore } from "../store/configStore";

const STORE_FILE = "config.json";
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
] as const;

// Cert fields to persist (excluding password)
const CERT_PERSIST_KEYS = ["enabled", "cert_path", "reason", "location", "contact"] as const;

function extractPersistState(state: ReturnType<typeof useConfigStore.getState>) {
  const result: Record<string, unknown> = {};
  for (const key of PERSIST_KEYS) {
    result[key] = state[key as keyof typeof state];
  }
  // Persist cert without password
  const cert: Record<string, unknown> = {};
  for (const key of CERT_PERSIST_KEYS) {
    cert[key] = state.cert[key];
  }
  result.cert = cert;
  return result;
}

export function useConfigPersistence() {
  const loadedRef = useRef(false);

  // Load saved config on mount
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    (async () => {
      try {
        const store = new LazyStore(STORE_FILE, { autoSave: false, defaults: {} });
        await store.init();

        const saved = await store.get<Record<string, unknown>>("config");
        if (saved) {
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
      } catch (e) {
        console.warn("Failed to load config:", e);
      }
    })();
  }, []);

  // Debounced save on config changes
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = useConfigStore.subscribe((state) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          const store = new LazyStore(STORE_FILE, { autoSave: false, defaults: {} });
          await store.init();
          await store.set("config", extractPersistState(state));
          await store.save();
        } catch (e) {
          console.warn("Failed to save config:", e);
        }
      }, DEBOUNCE_MS);
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, []);
}
