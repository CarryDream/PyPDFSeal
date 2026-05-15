import { create } from "zustand";
import type {
  PositionConfig,
  WatermarkConfig,
  CertConfig,
  AppSettings,
  UpdateStatus,
  BatchProgress,
  BatchSummary,
} from "../types";

interface LogEntry {
  time: string;
  message: string;
  color: string;
}

const LOG_LIMIT = 100;

interface ConfigState {
  // Seal
  sealEnabled: boolean;
  sealImagePath: string;
  sealWidth: number;
  sealHeight: number;
  sealOpacity: number;

  // Position
  position: PositionConfig;

  // Watermark
  watermark: WatermarkConfig;

  // Certificate
  cert: CertConfig;

  // App settings
  appSettings: AppSettings;
  updateStatus: UpdateStatus;

  // Files
  files: string[];
  outputDir: string;

  // File list pagination
  fileListPage: number;
  fileListPageSize: number;
  fileListTotal: number;

  // Batch
  batchRunning: boolean;
  batchPaused: boolean;
  batchProgress: BatchProgress | null;
  batchStartedAt: number | null;
  batchSummary: BatchSummary | null;
  batchSummaryOpen: boolean;
  logs: LogEntry[];

  // Preview
  selectedFileIndex: number;
  previewScale: number;

  // Layout
  leftWidth: number;
  rightWidth: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  logPanelHeight: number;
  logPanelMode: "normal" | "minimized" | "maximized";

  // Actions
  setSealImagePath: (path: string) => void;
  setSealEnabled: (enabled: boolean) => void;
  setSealWidth: (w: number) => void;
  setSealHeight: (h: number) => void;
  setSealOpacity: (o: number) => void;
  setPosition: (p: Partial<PositionConfig>) => void;
  setWatermark: (w: Partial<WatermarkConfig>) => void;
  setCert: (c: Partial<CertConfig>) => void;
  setAppSettings: (s: Partial<AppSettings>) => void;
  setUpdateStatus: (s: Partial<UpdateStatus>) => void;
  setFiles: (files: string[]) => void;
  addFiles: (files: string[]) => void;
  removeFile: (index: number) => void;
  setOutputDir: (dir: string) => void;
  setBatchRunning: (v: boolean) => void;
  setBatchPaused: (v: boolean) => void;
  setBatchProgress: (p: BatchProgress | null) => void;
  setBatchStartedAt: (v: number | null) => void;
  setBatchSummary: (s: BatchSummary | null) => void;
  setBatchSummaryOpen: (v: boolean) => void;
  addLog: (message: string, color?: string) => void;
  clearLogs: () => void;
  setSelectedFileIndex: (i: number) => void;
  setPreviewScale: (s: number) => void;
  setFileListPage: (page: number) => void;
  setLeftWidth: (w: number) => void;
  setRightWidth: (w: number) => void;
  setLeftCollapsed: (v: boolean) => void;
  setRightCollapsed: (v: boolean) => void;
  setLogPanelHeight: (h: number) => void;
  setLogPanelMode: (m: "normal" | "minimized" | "maximized") => void;
}

const defaultPosition: PositionConfig = {
  mode: "fixed",
  anchor: "bottom_right",
  dx: 0,
  dy: 0,
  page_x: 400,
  page_y: 600,
  keyword: "",
  keyword_dx: 0,
  keyword_dy: 0,
  page_scope: "all",
  custom_pages: "",
};

const defaultWatermark: WatermarkConfig = {
  enabled: false,
  text: "",
  font_family: "SimSun",
  font_path: "",
  font_size: 24,
  opacity: 0.15,
  rotation: -45,
  color: "#808080",
  layout: "tile",
  page_scope: "all",
  custom_pages: "",
  gap_x: 100,
  gap_y: 100,
};

const defaultCert: CertConfig = {
  enabled: false,
  cert_path: "",
  password: "",
  reason: "",
  location: "",
  contact: "",
};

const defaultAppSettings: AppSettings = {
  auto_check_updates: true,
  close_behavior: "minimize_to_tray",
  output_name: {
    mode: "suffix",
    text: "_sealed",
  },
  output_structure: "flat",
  theme: "light",
};

const defaultUpdateStatus: UpdateStatus = {
  checking: false,
  installing: false,
  download_progress: 0,
  current_version: "",
  latest_version: "",
  update_available: false,
  release_url: "",
  installable: false,
  error: "",
  last_checked: "",
};

export const useConfigStore = create<ConfigState>((set) => ({
  sealEnabled: false,
  sealImagePath: "",
  sealWidth: 100,
  sealHeight: 100,
  sealOpacity: 1.0,
  position: defaultPosition,
  watermark: defaultWatermark,
  cert: defaultCert,
  appSettings: defaultAppSettings,
  updateStatus: defaultUpdateStatus,
  files: [],
  outputDir: "",
  fileListPage: 1,
  fileListPageSize: 50,
  fileListTotal: 0,
  batchRunning: false,
  batchPaused: false,
  batchProgress: null,
  batchStartedAt: null,
  batchSummary: null,
  batchSummaryOpen: false,
  logs: [],
  selectedFileIndex: 0,
  previewScale: 1.0,
  leftWidth: 280,
  rightWidth: 280,
  leftCollapsed: false,
  rightCollapsed: false,
  logPanelHeight: 180,
  logPanelMode: "normal",

  setSealImagePath: (path) => set({ sealImagePath: path }),
  setSealEnabled: (enabled) => set({ sealEnabled: enabled }),
  setSealWidth: (w) => set({ sealWidth: w }),
  setSealHeight: (h) => set({ sealHeight: h }),
  setSealOpacity: (o) => set({ sealOpacity: o }),
  setPosition: (p) =>
    set((s) => ({ position: { ...s.position, ...p } })),
  setWatermark: (w) =>
    set((s) => ({ watermark: { ...s.watermark, ...w } })),
  setCert: (c) => set((s) => ({ cert: { ...s.cert, ...c } })),
  setAppSettings: (settings) =>
    set((s) => ({ appSettings: { ...s.appSettings, ...settings } })),
  setUpdateStatus: (status) =>
    set((s) => ({ updateStatus: { ...s.updateStatus, ...status } })),
  setFiles: (files) => set({ files }),
  addFiles: (newFiles) =>
    set((s) => ({
      files: appendUniqueFiles(s.files, newFiles),
    })),
  removeFile: (index) =>
    set((s) => ({ files: s.files.filter((_, i) => i !== index) })),
  setOutputDir: (dir) => set({ outputDir: dir }),
  setBatchRunning: (v) => set({ batchRunning: v }),
  setBatchPaused: (v) => set({ batchPaused: v }),
  setBatchProgress: (p) => set({ batchProgress: p }),
  setBatchStartedAt: (v) => set({ batchStartedAt: v }),
  setBatchSummary: (summary) => set({ batchSummary: summary, batchSummaryOpen: !!summary }),
  setBatchSummaryOpen: (open) => set((s) => ({ batchSummaryOpen: open && !!s.batchSummary })),
  addLog: (message, color = "#333") =>
    set((s) => ({
      logs: tail([
        ...s.logs,
        { time: new Date().toLocaleTimeString(), message, color },
      ], LOG_LIMIT),
    })),
  clearLogs: () => set({ logs: [] }),
  setSelectedFileIndex: (i) => set({ selectedFileIndex: i }),
  setPreviewScale: (s) => set({ previewScale: s }),
  setFileListPage: (page) => set({ fileListPage: page }),
  setLeftWidth: (w) => set({ leftWidth: w }),
  setRightWidth: (w) => set({ rightWidth: w }),
  setLeftCollapsed: (v) => set({ leftCollapsed: v }),
  setRightCollapsed: (v) => set({ rightCollapsed: v }),
  setLogPanelHeight: (h) => set({ logPanelHeight: h }),
  setLogPanelMode: (m) => set({ logPanelMode: m }),
}));

function appendUniqueFiles(existing: string[], incoming: string[]): string[] {
  if (incoming.length === 0) return existing;

  const seen = new Set(existing);
  const next = [...existing];
  for (const file of incoming) {
    if (seen.has(file)) continue;
    seen.add(file);
    next.push(file);
  }
  return next;
}

function tail<T>(items: T[], limit: number): T[] {
  if (items.length <= limit) return items;
  return items.slice(items.length - limit);
}
