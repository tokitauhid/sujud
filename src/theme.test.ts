import { describe, it, expect, beforeEach, vi } from "vitest";
import { themeType } from "./types/types";

describe("Theme Handling Logic & OLED Mode", () => {
  beforeEach(() => {
    document.body.className = "";
    localStorage.clear();
    vi.clearAllMocks();
  });

  const applyTheme = (theme: themeType) => {
    let themeColor = theme;
    let statusBarThemeColor = "#242424";

    if (themeColor === "system") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      themeColor = media.matches ? "dark" : "light";
    }

    if (themeColor === "oled") {
      statusBarThemeColor = "#000000";
      document.body.classList.add("dark");
      document.body.classList.add("oled");
    } else if (themeColor === "dark") {
      statusBarThemeColor = "#121315";
      document.body.classList.add("dark");
      document.body.classList.remove("oled");
    } else if (themeColor === "light") {
      statusBarThemeColor = "#FAF7F4";
      document.body.classList.remove("dark");
      document.body.classList.remove("oled");
    }

    localStorage.setItem("sujud_theme", theme);
    return { themeColor, statusBarThemeColor };
  };

  it("applies both 'dark' and 'oled' classes and sets #000000 for OLED theme", () => {
    const result = applyTheme("oled");
    expect(document.body.classList.contains("dark")).toBe(true);
    expect(document.body.classList.contains("oled")).toBe(true);
    expect(result.statusBarThemeColor).toBe("#000000");
    expect(localStorage.getItem("sujud_theme")).toBe("oled");
  });

  it("removes 'oled' and retains 'dark' with #121315 for Dark theme", () => {
    // Start from OLED
    applyTheme("oled");
    expect(document.body.classList.contains("oled")).toBe(true);

    // Switch to Dark
    const result = applyTheme("dark");
    expect(document.body.classList.contains("dark")).toBe(true);
    expect(document.body.classList.contains("oled")).toBe(false);
    expect(result.statusBarThemeColor).toBe("#121315");
    expect(localStorage.getItem("sujud_theme")).toBe("dark");
  });

  it("removes both 'dark' and 'oled' with #FAF7F4 for Light theme", () => {
    // Start from OLED
    applyTheme("oled");
    expect(document.body.classList.contains("oled")).toBe(true);

    // Switch to Light
    const result = applyTheme("light");
    expect(document.body.classList.contains("dark")).toBe(false);
    expect(document.body.classList.contains("oled")).toBe(false);
    expect(result.statusBarThemeColor).toBe("#FAF7F4");
    expect(localStorage.getItem("sujud_theme")).toBe("light");
  });

  it("resolves System theme and ensures 'oled' is not applied", () => {
    // Start from OLED
    applyTheme("oled");
    expect(document.body.classList.contains("oled")).toBe(true);

    // Switch to System
    const result = applyTheme("system");
    expect(document.body.classList.contains("oled")).toBe(false);
    expect(["#121315", "#FAF7F4"]).toContain(result.statusBarThemeColor);
    expect(localStorage.getItem("sujud_theme")).toBe("system");
  });
});
