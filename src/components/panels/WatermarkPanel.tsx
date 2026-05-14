import { useConfigStore } from "../../store/configStore";
import type { WatermarkLayout, PageScope } from "../../types";

export default function WatermarkPanel() {
  const { watermark, setWatermark } = useConfigStore();

  return (
    <div className="panel watermark-panel">
      <h3>水印设置</h3>

      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={watermark.enabled}
          onChange={(e) => setWatermark({ enabled: e.target.checked })}
        />
        启用水印
      </label>

      {watermark.enabled && (
        <>
          <label>水印文字</label>
          <input
            type="text"
            value={watermark.text}
            onChange={(e) => setWatermark({ text: e.target.value })}
            placeholder="输入水印文字..."
          />

          <label>字体</label>
          <input
            type="text"
            value={watermark.font_family}
            onChange={(e) => setWatermark({ font_family: e.target.value })}
          />

          <label>字号 (pt)</label>
          <input
            type="number"
            value={watermark.font_size}
            onChange={(e) => setWatermark({ font_size: Number(e.target.value) })}
            min={6}
            max={200}
          />

          <label>透明度 ({Math.round(watermark.opacity * 100)}%)</label>
          <input
            type="range"
            min={1}
            max={100}
            value={Math.round(watermark.opacity * 100)}
            onChange={(e) => setWatermark({ opacity: Number(e.target.value) / 100 })}
          />

          <label>旋转角度</label>
          <input
            type="number"
            value={watermark.rotation}
            onChange={(e) => setWatermark({ rotation: Number(e.target.value) })}
            min={-180}
            max={180}
          />

          <label>颜色</label>
          <input
            type="color"
            value={watermark.color}
            onChange={(e) => setWatermark({ color: e.target.value })}
          />

          <label>布局</label>
          <select
            value={watermark.layout}
            onChange={(e) => setWatermark({ layout: e.target.value as WatermarkLayout })}
          >
            <option value="center">居中</option>
            <option value="tile">平铺</option>
          </select>

          {watermark.layout === "tile" && (
            <>
              <label>水平间距 (pt)</label>
              <input
                type="number"
                value={watermark.gap_x}
                onChange={(e) => setWatermark({ gap_x: Number(e.target.value) })}
              />
              <label>垂直间距 (pt)</label>
              <input
                type="number"
                value={watermark.gap_y}
                onChange={(e) => setWatermark({ gap_y: Number(e.target.value) })}
              />
            </>
          )}

          <label>页面范围</label>
          <select
            value={watermark.page_scope}
            onChange={(e) => setWatermark({ page_scope: e.target.value as PageScope })}
          >
            <option value="all">全部页面</option>
            <option value="first">第一页</option>
            <option value="last">最后一页</option>
            <option value="custom">自定义</option>
          </select>

          {watermark.page_scope === "custom" && (
            <input
              type="text"
              value={watermark.custom_pages}
              onChange={(e) => setWatermark({ custom_pages: e.target.value })}
              placeholder="例: 1,3,-1"
            />
          )}
        </>
      )}
    </div>
  );
}
