import { useEffect, useSyncExternalStore } from "react";
import React from "react";
import ReactDOM from "react-dom/client";
import { HeroUIProvider, ToastProvider } from "@heroui/react";
import { useConfigStore } from "./store/configStore";
import type { ThemeMode } from "./types";
import App from "./App";
import "./index.css";

const darkMedia = window.matchMedia("(prefers-color-scheme: dark)");

function subscribeSystemTheme(callback: () => void) {
  darkMedia.addEventListener("change", callback);
  return () => darkMedia.removeEventListener("change", callback);
}

function getSystemDark() {
  return darkMedia.matches;
}

function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return useSyncExternalStore(subscribeSystemTheme, getSystemDark) ? "dark" : "light";
  }
  return mode;
}

function applyTheme(theme: "light" | "dark") {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

function Root() {
  const themeMode = useConfigStore((s) => s.appSettings.theme);
  const theme = resolveTheme(themeMode);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <React.StrictMode>
      <HeroUIProvider className={theme}>
        <ToastProvider />
        <App />
      </HeroUIProvider>
    </React.StrictMode>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Root />);
