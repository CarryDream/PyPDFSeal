import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Button, Checkbox, Pagination, Progress, addToast } from "@heroui/react";
import { listen } from "@tauri-apps/api/event";
import { useConfigStore } from "../../store/configStore";
import { scanPdfDir, dbImportFiles } from "../../utils/ipc";

export default function FileList() {
  const {
    files,
    addFiles,
    removeFile,
    setFiles,
    outputDir,
    setOutputDir,
    selectedFileIndex,
    setSelectedFileIndex,
    fileListPage,
    fileListPageSize,
    setFileListPage,
  } = useConfigStore();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ label: string; done: number; total: number } | null>(null);
  const unlistenRefs = useRef<Array<() => void>>([]);

  const cleanupListeners = useCallback(() => {
    unlistenRefs.current.forEach((fn) => fn());
    unlistenRefs.current = [];
  }, []);

  useEffect(() => cleanupListeners, [cleanupListeners]);

  const totalPages = Math.max(1, Math.ceil(files.length / fileListPageSize));
  const pageFiles = useMemo(() => {
    const start = (fileListPage - 1) * fileListPageSize;
    return files.slice(start, start + fileListPageSize);
  }, [files, fileListPage, fileListPageSize]);

  const pageStart = (fileListPage - 1) * fileListPageSize;

  const toggleSelect = (globalIndex: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(globalIndex)) {
        next.delete(globalIndex);
      } else {
        next.add(globalIndex);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === files.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(files.map((_, i) => i)));
    }
  };

  const handleDeleteSelected = () => {
    if (selected.size === 0) return;
    const remaining = files.filter((_, i) => !selected.has(i));
    const removedBeforeCurrent = [...selected].filter((i) => i < selectedFileIndex).length;
    const nextSelectedIndex = selected.has(selectedFileIndex)
      ? Math.min(selectedFileIndex, Math.max(remaining.length - 1, 0))
      : Math.max(selectedFileIndex - removedBeforeCurrent, 0);

    setFiles(remaining);
    setSelectedFileIndex(nextSelectedIndex);
    setSelected(new Set());
    const newTotalPages = Math.max(1, Math.ceil(remaining.length / fileListPageSize));
    if (fileListPage > newTotalPages) {
      setFileListPage(newTotalPages);
    }
    addToast({ title: `已删除 ${selected.size} 个文件`, color: "primary", timeout: 2000 });
  };

  const handleAddFiles = async () => {
    const sel = await open({
      multiple: true,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!sel) return;

    const paths = Array.isArray(sel) ? sel : [sel];
    const existing = new Set(files);
    const newPaths = paths.filter((p) => !existing.has(p));
    const dupCount = paths.length - newPaths.length;

    if (newPaths.length > 0) {
      setLoading(true);
      setProgress({ label: "导入文件...", done: 0, total: newPaths.length });
      cleanupListeners();

      const unlistenImport = await listen<{ done: number; total: number }>(
        "import-progress",
        (e) => {
          setProgress({ label: "导入文件...", done: e.payload.done, total: e.payload.total });
        },
      );
      unlistenRefs.current.push(unlistenImport);

      addFiles(newPaths);
      try { await dbImportFiles(newPaths); } catch (e) { console.warn("DB import:", e); }
      cleanupListeners();
      setProgress(null);
      setLoading(false);
    }

    if (dupCount > 0 && newPaths.length > 0) {
      addToast({ title: `新增 ${newPaths.length} 个，${dupCount} 个已存在`, color: "warning", timeout: 2500 });
    } else if (dupCount > 0) {
      addToast({ title: `${dupCount} 个文件已存在`, color: "warning", timeout: 2000 });
    } else {
      addToast({ title: `已添加 ${newPaths.length} 个文件`, color: "success", timeout: 2000 });
    }
  };

  const handleSelectOutput = async () => {
    const dir = await open({ directory: true });
    if (dir) {
      setOutputDir(dir as string);
    }
  };

  const handleAddDir = async () => {
    const dir = await open({ directory: true });
    if (!dir) return;

    setLoading(true);
    setProgress({ label: "扫描目录...", done: 0, total: 0 });
    cleanupListeners();

    // Listen for scan progress
    const unlistenScan = await listen<{ found: number; dirs: number }>(
      "scan-progress",
      (e) => {
        setProgress({ label: "扫描目录...", done: e.payload.found, total: 0 });
      },
    );
    unlistenRefs.current.push(unlistenScan);

    try {
      const pdfs = await scanPdfDir(dir as string);
      cleanupListeners();

      if (pdfs.length === 0) {
        setProgress(null);
        setLoading(false);
        addToast({ title: "目录中未找到 PDF 文件", color: "warning", timeout: 2000 });
        return;
      }

      const existing = new Set(files);
      const newPaths = pdfs.filter((p) => !existing.has(p));
      const dupCount = pdfs.length - newPaths.length;

      if (newPaths.length > 0) {
        // Listen for import progress
        setProgress({ label: "导入文件...", done: 0, total: newPaths.length });
        const unlistenImport = await listen<{ done: number; total: number }>(
          "import-progress",
          (e) => {
            setProgress({ label: "导入文件...", done: e.payload.done, total: e.payload.total });
          },
        );
        unlistenRefs.current.push(unlistenImport);

        addFiles(newPaths);
        try { await dbImportFiles(newPaths); } catch (e) { console.warn("DB import:", e); }
        cleanupListeners();
      }

      setProgress(null);
      setLoading(false);

      if (dupCount > 0 && newPaths.length > 0) {
        addToast({ title: `新增 ${newPaths.length} 个，${dupCount} 个已存在`, color: "warning", timeout: 2500 });
      } else if (dupCount > 0) {
        addToast({ title: `${dupCount} 个文件已存在`, color: "warning", timeout: 2000 });
      } else {
        addToast({ title: `从目录导入 ${newPaths.length} 个文件`, color: "success", timeout: 2000 });
      }
    } catch (e) {
      cleanupListeners();
      setProgress(null);
      setLoading(false);
      console.error("Failed to scan directory:", e);
      addToast({ title: "目录扫描失败", color: "danger", timeout: 2000 });
    }
  };

  const handleClearAll = () => {
    const count = files.length;
    setFiles([]);
    setSelectedFileIndex(0);
    setSelected(new Set());
    setFileListPage(1);
    if (count > 0) {
      addToast({ title: `已清空 ${count} 个文件`, color: "primary", timeout: 2000 });
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-content2">
      <div className="shrink-0 border-b border-divider bg-content1">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="tool-panel-title">
            文件列表 <span className="text-foreground-500">({files.length})</span>
          </div>
          <div className="text-[11px] text-foreground-500">
            {selected.size > 0 ? `已选 ${selected.size}` : "未选择"}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1.5 px-3 pb-2">
          <Button size="sm" variant="flat" onPress={handleAddFiles} isDisabled={loading} className="min-w-0">
            添加
          </Button>
          <Button size="sm" variant="flat" onPress={handleAddDir} isDisabled={loading} className="min-w-0">
            目录
          </Button>
          <Button size="sm" variant="flat" color="danger" onPress={handleDeleteSelected} isDisabled={selected.size === 0 || loading} className="min-w-0">
            删除
          </Button>
          <Button size="sm" variant="flat" onPress={handleClearAll} isDisabled={loading} className="min-w-0">
            清空
          </Button>
        </div>
        {progress && (
          <div className="px-3 pb-2">
            <Progress
              size="sm"
              isIndeterminate={progress.total === 0}
              value={progress.total > 0 ? (progress.done / progress.total) * 100 : 0}
              aria-label={progress.label}
              className="w-full"
            />
            <div className="text-[11px] text-foreground-500 mt-0.5">
              {progress.total > 0
                ? `${progress.label} ${progress.done} / ${progress.total}`
                : `${progress.label} 已找到 ${progress.done} 个 PDF`}
            </div>
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div className="flex shrink-0 items-center border-b border-divider bg-content1 px-3 py-1.5">
          <Checkbox
            isSelected={selected.size === files.length && files.length > 0}
            onValueChange={toggleSelectAll}
            size="sm"
          >
            <span className="text-xs">全选</span>
          </Checkbox>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-foreground-500 text-xs py-8">
            <div className="mb-1">暂无文件</div>
            <div>点击「添加」选择文件，或「目录」递归导入 PDF</div>
          </div>
        ) : (
          <div className="space-y-0.5">
            {pageFiles.map((f, offset) => {
              const i = pageStart + offset;
              const fileName = f.split(/[/\\]/).pop() || f;
              const isActive = i === selectedFileIndex;
              const isChecked = selected.has(i);

              return (
                <div
                  key={i}
                  onClick={() => setSelectedFileIndex(i)}
                  className={`group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                    isActive
                      ? "bg-primary/10 border-l-3 border-primary"
                      : "hover:bg-content3"
                  }`}
                >
                  <Checkbox
                    isSelected={isChecked}
                    onValueChange={() => toggleSelect(i)}
                    onClick={(e) => e.stopPropagation()}
                    size="sm"
                  />

                  <span
                    className="flex-1 truncate text-foreground"
                    title={f}
                  >
                    {fileName}
                  </span>

                  <Button
                    size="sm"
                    variant="light"
                    isIconOnly
                    onPress={() => {
                      removeFile(i);
                      if (i === selectedFileIndex) {
                        setSelectedFileIndex(Math.min(i, Math.max(files.length - 2, 0)));
                      } else if (i < selectedFileIndex) {
                        setSelectedFileIndex(selectedFileIndex - 1);
                      }
                      setSelected((prev) => {
                        const next = new Set<number>();
                        for (const idx of prev) {
                          if (idx < i) next.add(idx);
                          else if (idx > i) next.add(idx - 1);
                        }
                        return next;
                      });
                    }}
                    className="opacity-40 group-hover:opacity-100 min-w-0 w-6 h-6"
                  >
                    ×
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {files.length > fileListPageSize && (
        <div className="shrink-0 flex justify-center border-t border-divider bg-content1 px-3 py-2">
          <Pagination
            total={totalPages}
            page={fileListPage}
            onChange={setFileListPage}
            size="sm"
            showControls
          />
        </div>
      )}

      <div className="shrink-0 border-t border-divider bg-content1 p-3">
        <div className="mb-1.5 tool-panel-title">输出目录</div>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={outputDir}
            placeholder="sealed 子目录"
            readOnly
            className="min-w-0 flex-1 rounded-md border border-divider bg-white px-2 py-1.5 text-xs text-foreground-600"
          />
          <Button size="sm" variant="flat" onPress={handleSelectOutput}>
            选择
          </Button>
        </div>
      </div>
    </div>
  );
}
