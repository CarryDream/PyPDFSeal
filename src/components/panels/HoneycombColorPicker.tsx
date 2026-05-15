import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

// Commonly used watermark text colors
const COLORS = [
  // Grays
  "#000000", "#333333", "#555555", "#666666", "#808080", "#999999",
  // Muted reds & browns
  "#8b0000", "#a52a2a", "#8b4513",
  // Muted blues
  "#191970", "#2f4f4f", "#4682b4",
  // Muted greens
  "#006400", "#2e8b57", "#556b2f",
  // Warm darks
  "#4a3728", "#6b4423", "#704214",
];

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, updatePos]);

  const panel = open
    ? createPortal(
        <div
          ref={panelRef}
          className="fixed z-[9999] rounded-xl border border-divider bg-content1 p-3 shadow-lg"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="grid grid-cols-6 gap-1.5">
            {COLORS.map((color) => {
              const isSelected = color.toLowerCase() === value.toLowerCase();
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    onChange(color);
                    setOpen(false);
                  }}
                  className="w-7 h-7 rounded-md border border-divider cursor-pointer transition-transform hover:scale-110"
                  style={{
                    backgroundColor: color,
                    outline: isSelected ? "2px solid var(--heroui-primary)" : "none",
                    outlineOffset: 2,
                  }}
                  title={color}
                />
              );
            })}
          </div>

          <div className="mt-2.5 flex items-center gap-2 border-t border-divider pt-2.5">
            <span className="text-[11px] text-foreground-500">自定义:</span>
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-7 h-7 cursor-pointer border-0 bg-transparent p-0"
            />
            <span className="text-[11px] font-mono text-foreground-400">{value}</span>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div ref={triggerRef} className="inline-block">
      <div className="text-xs text-foreground-600 mb-1">颜色</div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md border border-divider bg-content1 px-2 py-1.5 hover:bg-content2 transition-colors"
      >
        <div
          className="w-7 h-7 rounded-md border border-divider shadow-sm"
          style={{ backgroundColor: value }}
        />
        <span className="text-xs font-mono text-foreground-500">{value}</span>
      </button>
      {panel}
    </div>
  );
}
