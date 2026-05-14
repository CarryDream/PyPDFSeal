import { useState } from "react";
import SealPanel from "../panels/SealPanel";
import PositionPanel from "../panels/PositionPanel";
import WatermarkPanel from "../panels/WatermarkPanel";
import CertPanel from "../panels/CertPanel";

const tabs = [
  { id: "seal", label: "印章", component: SealPanel },
  { id: "position", label: "位置", component: PositionPanel },
  { id: "watermark", label: "水印", component: WatermarkPanel },
  { id: "cert", label: "签名", component: CertPanel },
];

export default function Sidebar() {
  const [activeTab, setActiveTab] = useState("seal");

  const ActiveComponent = tabs.find((t) => t.id === activeTab)?.component ?? SealPanel;

  return (
    <div className="sidebar">
      <div className="tab-bar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="tab-content">
        <ActiveComponent />
      </div>
    </div>
  );
}
