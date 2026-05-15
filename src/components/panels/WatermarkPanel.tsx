import { Checkbox, Input, Select, SelectItem } from "@heroui/react";
import { useConfigStore } from "../../store/configStore";
import type { WatermarkLayout, PageScope } from "../../types";

const layoutOptions = [
  { key: "center", label: "居中" },
  { key: "tile", label: "平铺" },
];

const scopeOptions = [
  { key: "all", label: "全部页面" },
  { key: "first", label: "第一页" },
  { key: "last", label: "最后一页" },
  { key: "custom", label: "自定义" },
];

export default function WatermarkPanel() {
  const { watermark, setWatermark } = useConfigStore();

  const handleLayoutChange = (keys: any) => {
    const value = Array.from(keys)[0] as WatermarkLayout;
    setWatermark({ layout: value });
  };

  const handleScopeChange = (keys: any) => {
    const value = Array.from(keys)[0] as PageScope;
    setWatermark({ page_scope: value });
  };

  return (
    <div className="flex flex-col gap-4 text-sm">
      {/* 启用水印 */}
      <Checkbox
        isSelected={watermark.enabled}
        onValueChange={(checked) => setWatermark({ enabled: checked })}
        size="sm"
        color="primary"
      >
        <span className="text-sm">启用水印</span>
      </Checkbox>

      {watermark.enabled && (
        <>
          {/* 水印文字 */}
          <Input
            type="text"
            label="水印文字"
            value={watermark.text}
            onValueChange={(val) => setWatermark({ text: val })}
            placeholder="输入水印文字..."
            size="sm"
          />

          {/* 字体 & 字号 */}
          <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
            <Input
              type="text"
              label="字体"
              value={watermark.font_family}
              onValueChange={(val) => setWatermark({ font_family: val })}
              size="sm"
              className="min-w-0"
            />
            <Input
              type="number"
              label="字号 (pt)"
              value={watermark.font_size.toString()}
              onValueChange={(val) => setWatermark({ font_size: Number(val) || 12 })}
              min={6}
              max={200}
              size="sm"
              className="w-28"
            />
          </div>

          {/* 透明度 */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-foreground-600">透明度</span>
              <span className="font-medium text-foreground">{Math.round(watermark.opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={Math.round(watermark.opacity * 100)}
              onChange={(e) => setWatermark({ opacity: Number(e.target.value) / 100 })}
              className="w-full accent-primary"
            />
          </div>

          {/* 旋转角度 & 颜色 */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-end">
            <Input
              type="number"
              label="旋转角度"
              value={watermark.rotation.toString()}
              onValueChange={(val) => setWatermark({ rotation: Number(val) || 0 })}
              min={-180}
              max={180}
              size="sm"
              className="min-w-0"
            />

            {/* 颜色选择器 */}
            <div className="flex flex-col gap-1 min-w-[88px]">
              <div className="text-xs text-foreground-600">颜色</div>
              <div className="flex items-center gap-2">
                <div className="w-9 h-8 rounded-md border border-divider overflow-hidden shadow-sm">
                  <input
                    type="color"
                    value={watermark.color}
                    onChange={(e) => setWatermark({ color: e.target.value })}
                    className="w-12 h-12 -m-1 cursor-pointer border-0 bg-transparent"
                  />
                </div>
                <div className="text-xs font-mono text-foreground-500">{watermark.color}</div>
              </div>
            </div>
          </div>

          {/* 布局 */}
          <Select
            label="布局"
            selectedKeys={[watermark.layout]}
            onSelectionChange={handleLayoutChange}
            size="sm"
          >
            {layoutOptions.map((opt) => (
              <SelectItem key={opt.key}>{opt.label}</SelectItem>
            ))}
          </Select>

          {/* 平铺间距 */}
          {watermark.layout === "tile" && (
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                label="水平间距 (pt)"
                value={watermark.gap_x.toString()}
                onValueChange={(val) => setWatermark({ gap_x: Number(val) || 0 })}
                size="sm"
                className="min-w-0"
              />
              <Input
                type="number"
                label="垂直间距 (pt)"
                value={watermark.gap_y.toString()}
                onValueChange={(val) => setWatermark({ gap_y: Number(val) || 0 })}
                size="sm"
                className="min-w-0"
              />
            </div>
          )}

          {/* 页面范围 */}
          <Select
            label="页面范围"
            selectedKeys={[watermark.page_scope]}
            onSelectionChange={handleScopeChange}
            size="sm"
          >
            {scopeOptions.map((opt) => (
              <SelectItem key={opt.key}>{opt.label}</SelectItem>
            ))}
          </Select>

          {/* 自定义页码 */}
          {watermark.page_scope === "custom" && (
            <Input
              type="text"
              label="页码 (逗号分隔)"
              value={watermark.custom_pages}
              onValueChange={(val) => setWatermark({ custom_pages: val })}
              placeholder="例: 1,3,-1"
              size="sm"
            />
          )}
        </>
      )}
    </div>
  );
}
