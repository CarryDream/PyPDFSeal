import { heroui } from "@heroui/react";

export default heroui({
  defaultTheme: "light",
  themes: {
    light: {
      colors: {
        primary: {
          DEFAULT: "#1976d2",
          "50": "#e3f2fd",
          "100": "#bbdefb",
          "200": "#90caf9",
          "300": "#64b5f6",
          "400": "#42a5f5",
          "500": "#2196f3",
          "600": "#1976d2",
          "700": "#1565c0",
          "800": "#0d47a1",
          "900": "#0a3d8a",
          foreground: "#ffffff",
        },
        background: "#f4f6f9",
        foreground: "#1f2937",
        content1: "#ffffff",
        content2: "#f8f9fb",
        content3: "#eef0f4",
        divider: "#e2e5eb",
        success: {
          DEFAULT: "#16a34a",
          foreground: "#ffffff",
        },
        warning: {
          DEFAULT: "#ca8a04",
          foreground: "#ffffff",
        },
        danger: {
          DEFAULT: "#dc2626",
          foreground: "#ffffff",
        },
        default: {
          DEFAULT: "#f0f2f5",
          foreground: "#374151",
        },
        focus: "#1976d2",
      },
    },
    dark: {
      colors: {
        primary: {
          DEFAULT: "#5b9ef4",
          "50": "#0d1b2a",
          "100": "#132740",
          "200": "#1a3556",
          "300": "#234a70",
          "400": "#3b6fa0",
          "500": "#5b9ef4",
          "600": "#7db3f7",
          "700": "#a3c9fa",
          "800": "#c9dffc",
          "900": "#e8f1fe",
          foreground: "#0d1117",
        },
        background: "#0f1117",
        foreground: "#e1e4ea",
        content1: "#161922",
        content2: "#1c1f2b",
        content3: "#252836",
        divider: "#2d3140",
        success: {
          DEFAULT: "#22c55e",
          foreground: "#0d1117",
        },
        warning: {
          DEFAULT: "#facc15",
          foreground: "#0d1117",
        },
        danger: {
          DEFAULT: "#ef4444",
          foreground: "#ffffff",
        },
        default: {
          DEFAULT: "#252836",
          foreground: "#a1a7b5",
        },
        focus: "#5b9ef4",
      },
    },
  },
});
