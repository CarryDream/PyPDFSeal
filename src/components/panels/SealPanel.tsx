import { useState } from "react";
import { createPortal } from "react-dom";
import { open } from "@tauri-apps/plugin-dialog";
import { Button, Checkbox, Divider, Image, Input } from "@heroui/react";
import { useConfigStore } from "../../store/configStore";
import { localFileSrc } from "../../utils/localFile";
import PositionPanel from "./PositionPanel";

export default function SealPanel() {
  const { sealEnabled, sealImagePath, sealWidth, sealHeight, sealOpacity } = useConfigStore();
  const [lightbox, setLightbox] = useState(false);
  const {
    setSealEnabled,
    setSealImagePath,
    setSealWidth,
    setSealHeight,
    setSealOpacity,
  } = useConfigStore();

  const handleSelectImage = async () => {
    const selected = await open({
      filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "bmp"] }],
    });
    if (selected) {
      setSealImagePath(selected as string);
    }
  };

  return (
    <div className="flex flex-col gap-4 text-sm">
      <Checkbox
        isSelected={sealEnabled}
        onValueChange={setSealEnabled}
        size="sm"
        color="primary"
      >
        <span className="text-sm">启用印章</span>
      </Checkbox>

      {!sealEnabled ? (
        <div className="rounded-md border border-divider bg-content2 px-3 py-2 text-xs text-foreground-500">
          印章未启用。启用后可选择图片、调整尺寸透明度，并在 PDF 预览区拖拽定位。
        </div>
      ) : (
        <>
      {/* 印章图片选择 */}
      <div>
        <div className="text-xs font-medium text-foreground-600 mb-1.5">印章图片</div>
        <div className="flex gap-2">
          <Input
            value={sealImagePath || ""}
            placeholder="选择印章图片..."
            readOnly
            size="sm"
            className="min-w-0 flex-1"
          />
          <Button size="sm" variant="flat" color="primary" onPress={handleSelectImage}>
            选择
          </Button>
        </div>
      </div>

      {/* 印章预览 & 尺寸 */}
      {sealImagePath && (
        <div className="flex items-start gap-3">
          <div className="shrink-0">
            <div className="text-xs font-medium text-foreground-600 mb-1.5">预览</div>
            <button
              type="button"
              onClick={() => setLightbox(true)}
              className="block bg-content1 border border-divider rounded-lg p-2 shadow-sm cursor-zoom-in hover:border-primary transition-colors"
            >
              <Image
                src={localFileSrc(sealImagePath)}
                alt="印章预览"
                width={80}
                height={80}
                isZoomed
                radius="sm"
                removeWrapper
              />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-foreground-600 mb-1.5">尺寸 (pt)</div>
            <div className="flex flex-col gap-2">
              <Input
                type="number"
                label="宽度"
                value={sealWidth.toString()}
                onValueChange={(val) => setSealWidth(Number(val) || 10)}
                size="sm"
                min={10}
                max={600}
                className="min-w-0"
              />
              <Input
                type="number"
                label="高度"
                value={sealHeight.toString()}
                onValueChange={(val) => setSealHeight(Number(val) || 10)}
                size="sm"
                min={10}
                max={600}
                className="min-w-0"
              />
            </div>
          </div>
        </div>
      )}

      {/* 无图片时仍显示尺寸设置 */}
      {!sealImagePath && (
        <div>
          <div className="text-xs font-medium text-foreground-600 mb-1.5">尺寸 (pt)</div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              label="宽度"
              value={sealWidth.toString()}
              onValueChange={(val) => setSealWidth(Number(val) || 10)}
              size="sm"
              min={10}
              max={600}
              className="min-w-0"
            />
            <Input
              type="number"
              label="高度"
              value={sealHeight.toString()}
              onValueChange={(val) => setSealHeight(Number(val) || 10)}
              size="sm"
              min={10}
              max={600}
              className="min-w-0"
            />
          </div>
        </div>
      )}

      {/* 透明度 */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-foreground-600">透明度</span>
          <span className="font-medium text-foreground">{Math.round(sealOpacity * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(sealOpacity * 100)}
          onChange={(e) => setSealOpacity(Number(e.target.value) / 100)}
          className="w-full accent-primary"
        />
      </div>

      <Divider />

      <div className="flex flex-col gap-3">
        <div>
          <div className="text-xs font-semibold text-foreground">位置</div>
          <div className="mt-0.5 text-[11px] text-foreground-500">
            启用印章后可在 PDF 预览区拖拽定位。
          </div>
        </div>
        <PositionPanel />
      </div>
        </>
      )}

      {lightbox && sealImagePath && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
          onClick={() => setLightbox(false)}
        >
          <img
            src={localFileSrc(sealImagePath)}
            alt="印章大图"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl bg-content1 p-4"
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body,
      )}
    </div>
  );
}
