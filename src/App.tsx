import { useEffect, useRef, type CSSProperties, type PointerEvent } from "react";
import { ping } from "./utils/ipc";
import { useAppSettings, useBatchProcess, useConfigPersistence } from "./hooks";
import { useConfigStore } from "./store/configStore";
import Sidebar from "./components/layout/Sidebar";
import Preview from "./components/layout/Preview";
import FileList from "./components/layout/FileList";
import ProgressPanel from "./components/controls/ProgressPanel";
import LogPanel from "./components/controls/LogPanel";
import AppModals from "./components/controls/AppModals";
import "./App.css";
import "./components.css";
import "./pdf-viewer.css";

const MIN_SIDE_WIDTH = 220;
const MAX_SIDE_WIDTH = 520;
const MIN_CENTER_WIDTH = 360;

export default function App() {
  useBatchProcess();
  useConfigPersistence();
  useAppSettings();
  const workspaceRef = useRef<HTMLDivElement>(null);
  const {
    leftWidth, rightWidth, leftCollapsed, rightCollapsed,
    setLeftWidth, setRightWidth, setLeftCollapsed, setRightCollapsed,
  } = useConfigStore();

  useEffect(() => {
    ping().then((r) => console.log("IPC ping:", r));
  }, []);

  const startResize = (side: "left" | "right", event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const workspace = workspaceRef.current;
    if (!workspace) return;

    document.body.classList.add("resizing-side-panel");

    const handleMove = (moveEvent: globalThis.PointerEvent) => {
      const rect = workspace.getBoundingClientRect();
      const occupiedByOtherSide =
        side === "left"
          ? rightCollapsed ? 0 : rightWidth
          : leftCollapsed ? 0 : leftWidth;
      const maxWidth = Math.min(MAX_SIDE_WIDTH, rect.width - occupiedByOtherSide - MIN_CENTER_WIDTH);

      if (side === "left") {
        const width = moveEvent.clientX - rect.left;
        setLeftWidth(clamp(width, MIN_SIDE_WIDTH, maxWidth));
      } else {
        const width = rect.right - moveEvent.clientX;
        setRightWidth(clamp(width, MIN_SIDE_WIDTH, maxWidth));
      }
    };

    const stopResize = () => {
      document.body.classList.remove("resizing-side-panel");
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
  };

  const workspaceStyle = {
    gridTemplateColumns: `${leftCollapsed ? 0 : leftWidth}px minmax(0, 1fr) ${rightCollapsed ? 0 : rightWidth}px`,
    "--left-panel-width": `${leftCollapsed ? 0 : leftWidth}px`,
    "--right-panel-width": `${rightCollapsed ? 0 : rightWidth}px`,
  } as CSSProperties;

  return (
    <div className="app-container">
      <div ref={workspaceRef} className="top-workspace" style={workspaceStyle}>
        <div className={`left-panel ${leftCollapsed ? "side-panel-collapsed" : ""}`}>
          <Sidebar />
        </div>

        <div className="center-panel">
          <Preview />
        </div>

        <div className={`right-panel ${rightCollapsed ? "side-panel-collapsed" : ""}`}>
          <FileList />
        </div>

        {!leftCollapsed && (
          <div
            className="side-resize-handle left-resize-handle"
            title="拖动调整左侧区域宽度"
            onPointerDown={(event) => startResize("left", event)}
          />
        )}
        {!rightCollapsed && (
          <div
            className="side-resize-handle right-resize-handle"
            title="拖动调整右侧区域宽度"
            onPointerDown={(event) => startResize("right", event)}
          />
        )}

        <button
          type="button"
          className={`side-toggle left-toggle ${leftCollapsed ? "is-collapsed" : ""}`}
          title={leftCollapsed ? "展开左侧区域" : "隐藏左侧区域"}
          onClick={() => setLeftCollapsed(!leftCollapsed)}
        >
          {leftCollapsed ? ">" : "<"}
        </button>

        <button
          type="button"
          className={`side-toggle right-toggle ${rightCollapsed ? "is-collapsed" : ""}`}
          title={rightCollapsed ? "展开右侧区域" : "隐藏右侧区域"}
          onClick={() => setRightCollapsed(!rightCollapsed)}
        >
          {rightCollapsed ? "<" : ">"}
        </button>
      </div>

      <div className="bottom-panel">
        <ProgressPanel />
        <LogPanel />
      </div>
      <AppModals />
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}
