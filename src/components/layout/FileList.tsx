import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useConfigStore } from "../../store/configStore";
import { scanPdfDir } from "../../utils/ipc";

export default function FileList() {
  const { files, addFiles, removeFile, outputDir, setOutputDir, selectedPageIndex, setSelectedPageIndex } = useConfigStore();
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
    store.setFiles(remaining);
    setSelected(new Set());
    if (selected.has(selectedPageIndex)) {
      setSelectedPageIndex(0);
    }
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

  return (
    <div className="file-list">
      <div className="file-list-header">
        <div className="file-list-title">文件列表 ({files.length})</div>
        <div className="file-list-actions">
          <button onClick={handleAddFiles} title="添加文件">添加</button>
          <button onClick={handleAddDir} title="添加目录">目录</button>
          <button onClick={handleDeleteSelected} disabled={selected.size === 0} title="删除选中">
            删除({selected.size})
          </button>
          <button onClick={() => { useConfigStore.getState().setFiles([]); setSelected(new Set()); }}>
            清空
          </button>
        </div>
      </div>
      {files.length > 0 && (
        <div className="file-list-select-all">
          <label>
            <input
              type="checkbox"
              checked={selected.size === files.length}
              onChange={toggleSelectAll}
            />
            全选
          </label>
        </div>
      )}
      <div className="file-list-items">
        {files.map((f, i) => (
          <div
            key={i}
            className={`file-item ${i === selectedPageIndex ? "selected" : ""}`}
            onClick={() => setSelectedPageIndex(i)}
          >
            <input
              type="checkbox"
              checked={selected.has(i)}
              onClick={(e) => e.stopPropagation()}
              onChange={() => toggleSelect(i)}
            />
            <span className="file-name" title={f}>
              {f.split(/[/\\]/).pop()}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeFile(i);
                setSelected((prev) => {
                  const next = new Set<number>();
                  for (const idx of prev) {
                    if (idx < i) next.add(idx);
                    else if (idx > i) next.add(idx - 1);
                  }
                  return next;
                });
              }}
            >
              &times;
            </button>
          </div>
        ))}
      </div>
      <div className="output-dir">
        <span>输出目录</span>
        <div className="output-dir-row">
          <input
            type="text"
            value={outputDir}
            placeholder="默认: sealed 子目录"
            readOnly
          />
          <button onClick={handleSelectOutput}>选择</button>
        </div>
      </div>
    </div>
  );
}
