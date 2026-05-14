import { useConfigStore } from "../../store/configStore";
import type { PositionMode, Anchor, PageScope } from "../../types";

export default function PositionPanel() {
  const { position, setPosition } = useConfigStore();

  return (
    <div className="panel position-panel">
      <h3>位置设置</h3>

      <label>定位模式</label>
      <select
        value={position.mode}
        onChange={(e) => setPosition({ mode: e.target.value as PositionMode })}
      >
        <option value="fixed">固定锚点</option>
        <option value="page_xy">页面坐标</option>
        <option value="keyword">关键字定位</option>
      </select>

      {position.mode === "fixed" && (
        <>
          <label>锚点</label>
          <select
            value={position.anchor}
            onChange={(e) => setPosition({ anchor: e.target.value as Anchor })}
          >
            <option value="top_left">左上</option>
            <option value="top_right">右上</option>
            <option value="bottom_left">左下</option>
            <option value="bottom_right">右下</option>
            <option value="center">居中</option>
          </select>

          <label>水平偏移 (pt)</label>
          <input
            type="number"
            value={position.dx}
            onChange={(e) => setPosition({ dx: Number(e.target.value) })}
          />

          <label>垂直偏移 (pt)</label>
          <input
            type="number"
            value={position.dy}
            onChange={(e) => setPosition({ dy: Number(e.target.value) })}
          />
        </>
      )}

      {position.mode === "page_xy" && (
        <>
          <label>X 坐标 (pt)</label>
          <input
            type="number"
            value={position.page_x}
            onChange={(e) => setPosition({ page_x: Number(e.target.value) })}
          />

          <label>Y 坐标 (pt)</label>
          <input
            type="number"
            value={position.page_y}
            onChange={(e) => setPosition({ page_y: Number(e.target.value) })}
          />
        </>
      )}

      {position.mode === "keyword" && (
        <>
          <label>关键字</label>
          <input
            type="text"
            value={position.keyword}
            onChange={(e) => setPosition({ keyword: e.target.value })}
            placeholder="输入要搜索的文字..."
          />

          <label>X 偏移 (pt)</label>
          <input
            type="number"
            value={position.keyword_dx}
            onChange={(e) => setPosition({ keyword_dx: Number(e.target.value) })}
          />

          <label>Y 偏移 (pt)</label>
          <input
            type="number"
            value={position.keyword_dy}
            onChange={(e) => setPosition({ keyword_dy: Number(e.target.value) })}
          />
        </>
      )}

      <label>页面范围</label>
      <select
        value={position.page_scope}
        onChange={(e) => setPosition({ page_scope: e.target.value as PageScope })}
      >
        <option value="all">全部页面</option>
        <option value="first">第一页</option>
        <option value="last">最后一页</option>
        <option value="custom">自定义</option>
      </select>

      {position.page_scope === "custom" && (
        <>
          <label>页码 (逗号分隔, 支持负数)</label>
          <input
            type="text"
            value={position.custom_pages}
            onChange={(e) => setPosition({ custom_pages: e.target.value })}
            placeholder="例: 1,3,-1"
          />
        </>
      )}
    </div>
  );
}
