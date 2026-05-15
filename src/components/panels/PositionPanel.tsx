import { Select, SelectItem, Input } from "@heroui/react";
import { useConfigStore } from "../../store/configStore";
import type { PositionMode, Anchor, PageScope } from "../../types";

const modeOptions = [
  { key: "fixed", label: "固定锚点" },
  { key: "page_xy", label: "页面坐标" },
  { key: "keyword", label: "关键字定位" },
];

const anchorOptions = [
  { key: "top_left", label: "左上" },
  { key: "top_right", label: "右上" },
  { key: "bottom_left", label: "左下" },
  { key: "bottom_right", label: "右下" },
  { key: "center", label: "居中" },
];

const scopeOptions = [
  { key: "all", label: "全部页面" },
  { key: "first", label: "第一页" },
  { key: "last", label: "最后一页" },
  { key: "custom", label: "自定义" },
];

export default function PositionPanel() {
  const { position, setPosition } = useConfigStore();

  const handleModeChange = (keys: any) => {
    const value = Array.from(keys)[0] as PositionMode;
    setPosition({ mode: value });
  };

  const handleAnchorChange = (keys: any) => {
    const value = Array.from(keys)[0] as Anchor;
    setPosition({ anchor: value });
  };

  const handleScopeChange = (keys: any) => {
    const value = Array.from(keys)[0] as PageScope;
    setPosition({ page_scope: value });
  };

  return (
    <div className="flex flex-col gap-4 text-sm">
      {/* 定位模式 */}
      <Select
        label="定位模式"
        selectedKeys={[position.mode]}
        onSelectionChange={handleModeChange}
        size="sm"
        className="w-full"
      >
        {modeOptions.map((opt) => (
          <SelectItem key={opt.key}>{opt.label}</SelectItem>
        ))}
      </Select>

      {/* 固定锚点模式 */}
      {position.mode === "fixed" && (
        <div className="flex flex-col gap-3">
          <Select
            label="锚点"
            selectedKeys={[position.anchor]}
            onSelectionChange={handleAnchorChange}
            size="sm"
          >
            {anchorOptions.map((opt) => (
              <SelectItem key={opt.key}>{opt.label}</SelectItem>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              label="水平偏移 (pt)"
              value={position.dx.toString()}
              onValueChange={(val) => setPosition({ dx: Number(val) || 0 })}
              size="sm"
              className="min-w-0"
            />
            <Input
              type="number"
              label="垂直偏移 (pt)"
              value={position.dy.toString()}
              onValueChange={(val) => setPosition({ dy: Number(val) || 0 })}
              size="sm"
              className="min-w-0"
            />
          </div>
        </div>
      )}

      {/* 页面坐标模式 */}
      {position.mode === "page_xy" && (
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            label="X 坐标 (pt)"
            value={position.page_x.toString()}
            onValueChange={(val) => setPosition({ page_x: Number(val) || 0 })}
            size="sm"
            className="min-w-0"
          />
          <Input
            type="number"
            label="Y 坐标 (pt)"
            value={position.page_y.toString()}
            onValueChange={(val) => setPosition({ page_y: Number(val) || 0 })}
            size="sm"
            className="min-w-0"
          />
        </div>
      )}

      {/* 关键字定位模式 */}
      {position.mode === "keyword" && (
        <div className="flex flex-col gap-3">
          <Input
            type="text"
            label="关键字"
            value={position.keyword}
            onValueChange={(val) => setPosition({ keyword: val })}
            placeholder="输入要搜索的文字..."
            size="sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              label="X 偏移 (pt)"
              value={position.keyword_dx.toString()}
              onValueChange={(val) => setPosition({ keyword_dx: Number(val) || 0 })}
              size="sm"
              className="min-w-0"
            />
            <Input
              type="number"
              label="Y 偏移 (pt)"
              value={position.keyword_dy.toString()}
              onValueChange={(val) => setPosition({ keyword_dy: Number(val) || 0 })}
              size="sm"
              className="min-w-0"
            />
          </div>
        </div>
      )}

      {/* 页面范围 */}
      <div className="pt-1">
        <Select
          label="页面范围"
          selectedKeys={[position.page_scope]}
          onSelectionChange={handleScopeChange}
          size="sm"
          className="w-full"
        >
          {scopeOptions.map((opt) => (
            <SelectItem key={opt.key}>{opt.label}</SelectItem>
          ))}
        </Select>
      </div>

      {/* 自定义页码 */}
      {position.page_scope === "custom" && (
        <Input
          type="text"
          label="页码 (逗号分隔, 支持负数)"
          value={position.custom_pages}
          onValueChange={(val) => setPosition({ custom_pages: val })}
          placeholder="例: 1,3,-1"
          size="sm"
        />
      )}
    </div>
  );
}
