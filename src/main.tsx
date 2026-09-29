import React from "react";
import { Capacitor } from "@capacitor/core";
import App from "./App.tsx";
import "./index.css";
import { JeepSqlite } from "jeep-sqlite/dist/components/jeep-sqlite";
import { CapacitorSQLite, SQLiteConnection } from "@capacitor-community/sqlite";
import { createRoot } from "react-dom/client";

import "@ionic/react/css/core.css";
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";

// Optional utility styles
import "@ionic/react/css/padding.css";
import "@ionic/react/css/float-elements.css";
import "@ionic/react/css/text-alignment.css";
import "@ionic/react/css/text-transformation.css";
import "@ionic/react/css/flex-utils.css";
import "@ionic/react/css/display.css";

// Custom global styles (optional)
// import "./theme/variables.css";

import { setupIonicReact } from "@ionic/react";

// Restore cached theme pre-hydration to prevent visual flashing
try {
  const cachedTheme = localStorage.getItem("sujud_theme");
  if (cachedTheme === "oled") {
    document.body.classList.add("dark", "oled");
    document.body.classList.remove("light");
  } else if (cachedTheme === "dark") {
    document.body.classList.add("dark");
    document.body.classList.remove("oled", "light");
  } else if (cachedTheme === "light") {
    document.body.classList.remove("dark", "oled");
    document.body.classList.add("light");
  } else if (cachedTheme === "system") {
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
      document.body.classList.add("dark");
      document.body.classList.remove("oled", "light");
    } else {
      document.body.classList.remove("dark", "oled");
      document.body.classList.add("light");
    }
  }
} catch {
  // ignore
}

import { SplashScreen } from "@capacitor/splash-screen";

setupIonicReact();

const startApp = async () => {
  try {
    const platform = Capacitor.getPlatform();

    // Dismiss native splash as early as possible so web loading screen is first visible UI
    if (Capacitor.isNativePlatform()) {
      SplashScreen.hide({ fadeOutDuration: 100 }).catch(() => {});
    }

    // WEB SPECIFIC FUNCTIONALITY
    if (platform === "web") {
      const sqlite = new SQLiteConnection(CapacitorSQLite);
      // Create the 'jeep-sqlite' Stencil component
      customElements.define("jeep-sqlite", JeepSqlite);
      const jeepSqliteEl = document.createElement("jeep-sqlite");
      document.body.appendChild(jeepSqliteEl);
      await customElements.whenDefined("jeep-sqlite");

      // Initialize the Web store
      await sqlite.initWebStore();
    }

    const container = document.getElementById("root");
    const root = createRoot(container!);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (e) {
    console.error(e);
  }
};

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", startApp);
} else {
  startApp();
}
