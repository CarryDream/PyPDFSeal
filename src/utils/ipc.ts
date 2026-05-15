import { invoke } from "@tauri-apps/api/core";
import type { CloseBehavior } from "../types";
import type { DocumentInfo, SealOptions, FontInfo, BatchFilesPage } from "../types";

export function ping(): Promise<string> {
  return invoke<string>("ping");
}

export function getPageInfo(path: string): Promise<DocumentInfo> {
  return invoke<DocumentInfo>("get_page_info", { path });
}

export function listSystemFonts(): Promise<FontInfo[]> {
  return invoke<FontInfo[]>("list_system_fonts");
}

export function getAppVersion(): Promise<string> {
  return invoke<string>("get_app_version");
}

export function setCloseBehavior(behavior: CloseBehavior): Promise<void> {
  return invoke("set_close_behavior", { behavior });
}

export function showMainWindow(): Promise<void> {
  return invoke("show_main_window");
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

// ======================== Database IPC ========================

export function dbGetConfig(): Promise<Record<string, unknown>> {
  return invoke("db_get_config");
}

export function dbSetConfigBatch(entries: Array<[string, unknown]>): Promise<void> {
  return invoke("db_set_config_batch", { entries });
}

export function dbImportFiles(files: string[]): Promise<number[]> {
  return invoke<number[]>("db_import_files", { files });
}

export function dbRemoveFile(id: number): Promise<void> {
  return invoke("db_remove_file", { id });
}

export function dbGetFilesPage(
  page: number,
  pageSize: number,
  statusFilter?: string,
): Promise<BatchFilesPage> {
  return invoke("db_get_files_page", { page, pageSize, statusFilter });
}

export function dbExportXlsx(savePath: string): Promise<void> {
  return invoke("db_export_xlsx", { savePath });
}

export function dbClearHistory(): Promise<void> {
  return invoke("db_clear_history");
}
