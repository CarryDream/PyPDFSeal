import { open } from "@tauri-apps/plugin-dialog";
import { useConfigStore } from "../../store/configStore";
import { localFileSrc } from "../../utils/localFile";

export default function SealPanel() {
  const { sealImagePath, sealWidth, sealHeight, sealOpacity } = useConfigStore();
  const { setSealImagePath, setSealWidth, setSealHeight, setSealOpacity } = useConfigStore();

  const handleSelectImage = async () => {
    const selected = await open({
      filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "bmp"] }],
    });
    if (selected) {
      setSealImagePath(selected as string);
    }
  };

  return (
    <div className="panel seal-panel">
      <h3>印章设置</h3>

      <label>印章图片</label>
      <div className="row">
        <input type="text" value={sealImagePath} readOnly placeholder="选择印章图片..." />
        <button onClick={handleSelectImage}>选择</button>
      </div>

      {sealImagePath && (
        <div className="seal-preview">
          <img src={localFileSrc(sealImagePath)} alt="印章预览" />
        </div>
      )}

      <label>宽度 (pt)</label>
      <input
        type="number"
        value={sealWidth}
        onChange={(e) => setSealWidth(Number(e.target.value))}
        min={10}
        max={600}
      />

      <label>高度 (pt)</label>
      <input
        type="number"
        value={sealHeight}
        onChange={(e) => setSealHeight(Number(e.target.value))}
        min={10}
        max={600}
      />

      <label>透明度 ({Math.round(sealOpacity * 100)}%)</label>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(sealOpacity * 100)}
        onChange={(e) => setSealOpacity(Number(e.target.value) / 100)}
      />
    </div>
  );
}
