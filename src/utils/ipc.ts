import { invoke } from "@tauri-apps/api/core";
import type { DocumentInfo, SealOptions, FontInfo } from "../types";

export function ping(): Promise<string> {
  return invoke<string>("ping");
}

export function getPageInfo(path: string): Promise<DocumentInfo> {
  return invoke<DocumentInfo>("get_page_info", { path });
}

export function listSystemFonts(): Promise<FontInfo[]> {
  return invoke<FontInfo[]>("list_system_fonts");
}

export function batchProcess(files: string[], options: SealOptions): Promise<void> {
  return invoke("batch_process", { files, options });
}

export function batchPause(): Promise<void> {
  return invoke("batch_pause");
}

export function batchResume(): Promise<void> {
  return invoke("batch_resume");
}

export function batchCancel(): Promise<void> {
  return invoke("batch_cancel");
}

export function scanPdfDir(dir: string): Promise<string[]> {
  return invoke<string[]>("scan_pdf_dir", { dir });
}
