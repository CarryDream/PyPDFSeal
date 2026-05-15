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
        background: "#f5f5f5",
        foreground: "#1f2937",
        content1: "#ffffff",
        content2: "#fafafa",
        content3: "#f0f0f0",
        divider: "#e5e7eb",
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
          DEFAULT: "#f3f4f6",
          foreground: "#374151",
        },
        focus: "#1976d2",
      },
    },
  },
});
