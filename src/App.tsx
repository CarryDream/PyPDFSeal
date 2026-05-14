import { useEffect } from "react";
import { ping } from "./utils/ipc";
import { useBatchProcess, useConfigPersistence } from "./hooks";
import Sidebar from "./components/layout/Sidebar";
import Preview from "./components/layout/Preview";
import FileList from "./components/layout/FileList";
import ProgressPanel from "./components/controls/ProgressPanel";
import LogPanel from "./components/controls/LogPanel";
import "./App.css";
import "./components.css";
import "./pdf-viewer.css";

export default function App() {
  useBatchProcess();
  useConfigPersistence();

  useEffect(() => {
    ping().then((r) => console.log("IPC ping:", r));
  }, []);

  return (
    <div className="app-container">
      <div className="left-panel">
        <Sidebar />
      </div>
      <div className="center-panel">
        <Preview />
      </div>
      <div className="right-panel">
        <FileList />
      </div>
      <div className="bottom-panel">
        <ProgressPanel />
        <LogPanel />
      </div>
    </div>
  );
}
