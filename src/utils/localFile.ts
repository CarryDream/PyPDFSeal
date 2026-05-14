import { convertFileSrc } from "@tauri-apps/api/core";

export function localFileSrc(path: string): string {
  if (/^(https?:|blob:|data:|asset:)/i.test(path)) {
    return path;
  }

  if (hasTauriInternals()) {
    return convertFileSrc(path);
  }

  return `file:///${path.replace(/\\/g, "/")}`;
}

function hasTauriInternals(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
  );
}
