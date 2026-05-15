export type PositionMode = "fixed" | "page_xy" | "keyword";
export type Anchor = "top_left" | "top_right" | "bottom_left" | "bottom_right" | "center";
export type PageScope = "all" | "first" | "last" | "custom";
export type WatermarkLayout = "center" | "tile";
export type CloseBehavior = "minimize_to_tray" | "minimize_to_taskbar" | "exit";
export type OutputNameMode = "suffix" | "prefix" | "none";
export type OutputStructureMode = "flat" | "parent_folder";

export interface PageInfo {
  width_pt: number;
  height_pt: number;
}

export interface DocumentInfo {
  pages: PageInfo[];
  total_pages: number;
}

export interface PositionConfig {
  mode: PositionMode;
  anchor: Anchor;
  dx: number;
  dy: number;
  page_x: number;
  page_y: number;
  keyword: string;
  keyword_dx: number;
  keyword_dy: number;
  page_scope: PageScope;
  custom_pages: string;
}

export interface WatermarkConfig {
  enabled: boolean;
  text: string;
  font_family: string;
  font_path: string;
  font_size: number;
  opacity: number;
  rotation: number;
  color: string;
  layout: WatermarkLayout;
  page_scope: PageScope;
  custom_pages: string;
  gap_x: number;
  gap_y: number;
}

export interface CertConfig {
  enabled: boolean;
  cert_path: string;
  password: string;
  reason: string;
  location: string;
  contact: string;
}

export interface AppSettings {
  auto_check_updates: boolean;
  close_behavior: CloseBehavior;
  output_name: OutputNameConfig;
  output_structure: OutputStructureMode;
}

export interface OutputNameConfig {
  mode: OutputNameMode;
  text: string;
}

export interface UpdateStatus {
  checking: boolean;
  installing: boolean;
  download_progress: number;
  current_version: string;
  latest_version: string;
  update_available: boolean;
  release_url: string;
  installable?: boolean;
  error: string;
  last_checked: string;
}

export interface SealOptions {
  seal_image_path: string;
  seal_width: number;
  seal_height: number;
  seal_opacity: number;
  position: PositionConfig;
  watermark: WatermarkConfig;
  cert: CertConfig;
  output_dir: string;
  output_name: OutputNameConfig;
  output_structure: OutputStructureMode;
}

export interface BatchProgress {
  done: number;
  total: number;
  file: string;
  status: "ok" | "error" | "skipped" | "cancelled";
  output?: string;
  error?: string;
}

export interface BatchIssue {
  file: string;
  message: string;
}

export interface BatchSummary {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  cancelled: number;
  elapsed_ms: number;
  started_at: number;
  finished_at: number;
  outputs: string[];
  failures: BatchIssue[];
  skipped_files: BatchIssue[];
}

export interface FontInfo {
  family: string;
  path: string;
}

export interface BatchFileRow {
  id: number;
  batch_run_id: number | null;
  file_path: string;
  status: "pending" | "processing" | "success" | "fail" | "skip";
  output_path: string | null;
  error_message: string | null;
  processing_time_ms: number | null;
  created_at: string;
}

export interface BatchFilesPage {
  items: BatchFileRow[];
  total: number;
  page: number;
  page_size: number;
}
