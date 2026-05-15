import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Button, Checkbox } from "@heroui/react";
import { useConfigStore } from "../../store/configStore";
import { scanPdfDir } from "../../utils/ipc";

export default function FileList() {
  const {
    files,
    addFiles,
    removeFile,
    outputDir,
    setOutputDir,
    selectedFileIndex,
    setSelectedFileIndex,
  } = useConfigStore();
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggleSelect = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
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
    const store = useConfigStore.getState();
    const remaining = files.filter((_, i) => !selected.has(i));
    const removedBeforeCurrent = [...selected].filter((i) => i < selectedFileIndex).length;
    const nextSelectedIndex = selected.has(selectedFileIndex)
      ? Math.min(selectedFileIndex, Math.max(remaining.length - 1, 0))
      : Math.max(selectedFileIndex - removedBeforeCurrent, 0);

    store.setFiles(remaining);
    store.setSelectedFileIndex(nextSelectedIndex);
    setSelected(new Set());
  };

  const handleAddFiles = async () => {
    const sel = await open({
      multiple: true,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (sel) {
      const paths = Array.isArray(sel) ? sel : [sel];
      addFiles(paths);
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
    if (dir) {
      try {
        const pdfs = await scanPdfDir(dir as string);
        if (pdfs.length > 0) {
          addFiles(pdfs);
        }
      } catch (e) {
        console.error("Failed to scan directory:", e);
      }
    }
  };

  const handleClearAll = () => {
    const store = useConfigStore.getState();
    store.setFiles([]);
    store.setSelectedFileIndex(0);
    setSelected(new Set());
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
          <Button size="sm" variant="flat" onPress={handleAddFiles} className="min-w-0">
            添加
          </Button>
          <Button size="sm" variant="flat" onPress={handleAddDir} className="min-w-0">
            目录
          </Button>
          <Button size="sm" variant="flat" color="danger" onPress={handleDeleteSelected} isDisabled={selected.size === 0} className="min-w-0">
            删除
          </Button>
          <Button size="sm" variant="flat" onPress={handleClearAll} className="min-w-0">
            清空
          </Button>
        </div>
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
            <div>点击上方「添加」或「目录」导入 PDF</div>
          </div>
        ) : (
          files.map((f, i) => {
            const fileName = f.split(/[/\\]/).pop() || f;
            const isActive = i === selectedFileIndex;
            const isChecked = selected.has(i);

            return (
              <div
                key={i}
                onClick={() => setSelectedFileIndex(i)}
                className={`group mb-1 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
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
          })
        )}
      </div>

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
