import { useState } from "react";
import { Tabs, Tab } from "@heroui/react";
import SealPanel from "../panels/SealPanel";
import WatermarkPanel from "../panels/WatermarkPanel";
import CertPanel from "../panels/CertPanel";

export default function Sidebar() {
  const [activeTab, setActiveTab] = useState("seal");

  return (
    <div className="h-full flex flex-col bg-content2 min-h-0 overflow-hidden">
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as string)}
        variant="light"
        color="primary"
        size="sm"
        className="shrink-0"
        classNames={{
          base: "shrink-0",
          tabList: "flex-shrink-0 px-1 pt-1.5 bg-content2 border-b border-divider",
          tab: "text-sm font-medium h-9 px-3 data-[selected=true]:font-semibold",
          tabContent: "text-foreground",
          panel: "flex-1 min-h-0 overflow-auto p-3 bg-content1",
        }}
      >
        <Tab key="seal" title="印章">
          <SealPanel />
        </Tab>
        <Tab key="watermark" title="水印">
          <WatermarkPanel />
        </Tab>
        <Tab key="cert" title="签名">
          <CertPanel />
        </Tab>
      </Tabs>
    </div>
  );
}
