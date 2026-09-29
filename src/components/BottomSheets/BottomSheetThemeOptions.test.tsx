import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import BottomSheetThemeOptions from "./BottomSheetThemeOptions";
import { mockdbConnection } from "../../__mocks__/test-utils";
import * as helpers from "../../utils/helpers";

describe("BottomSheetThemeOptions Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.className = "";
  });

  it("renders all theme choices including OLED Black", () => {
    const mockSetPrefs = vi.fn();
    const mockHandleTheme = vi.fn();

    render(
      <BottomSheetThemeOptions
        dbConnection={mockdbConnection}
        triggerId="test-theme-trigger"
        theme="oled"
        setUserPreferences={mockSetPrefs}
        handleTheme={mockHandleTheme}
      />,
    );

    expect(screen.getByRole("button", { name: "Light" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dark" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "OLED Black" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "System" })).toBeInTheDocument();
  });

  it("marks OLED Black as aria-pressed when theme is oled", () => {
    const mockSetPrefs = vi.fn();
    const mockHandleTheme = vi.fn();

    render(
      <BottomSheetThemeOptions
        dbConnection={mockdbConnection}
        triggerId="test-theme-trigger"
        theme="oled"
        setUserPreferences={mockSetPrefs}
        handleTheme={mockHandleTheme}
      />,
    );

    const oledButton = screen.getByRole("button", { name: "OLED Black" });
    expect(oledButton).toHaveAttribute("aria-pressed", "true");

    const darkButton = screen.getByRole("button", { name: "Dark" });
    expect(darkButton).toHaveAttribute("aria-pressed", "false");
  });

  it("calls updateUserPrefs with 'oled' when OLED Black button is clicked", async () => {
    const mockSetPrefs = vi.fn();
    const mockHandleTheme = vi.fn();
    const updateSpy = vi.spyOn(helpers, "updateUserPrefs").mockResolvedValue(undefined as any);

    render(
      <BottomSheetThemeOptions
        dbConnection={mockdbConnection}
        triggerId="test-theme-trigger"
        theme="dark"
        setUserPreferences={mockSetPrefs}
        handleTheme={mockHandleTheme}
      />,
    );

    const oledButton = screen.getByRole("button", { name: "OLED Black" });
    await userEvent.click(oledButton);

    expect(updateSpy).toHaveBeenCalledWith(
      mockdbConnection,
      "theme",
      "oled",
      mockSetPrefs,
    );
  });

  it("calls updateUserPrefs with 'dark' when Dark button is clicked", async () => {
    const mockSetPrefs = vi.fn();
    const mockHandleTheme = vi.fn();
    const updateSpy = vi.spyOn(helpers, "updateUserPrefs").mockResolvedValue(undefined as any);

    render(
      <BottomSheetThemeOptions
        dbConnection={mockdbConnection}
        triggerId="test-theme-trigger"
        theme="oled"
        setUserPreferences={mockSetPrefs}
        handleTheme={mockHandleTheme}
      />,
    );

    const darkButton = screen.getByRole("button", { name: "Dark" });
    await userEvent.click(darkButton);

    expect(updateSpy).toHaveBeenCalledWith(
      mockdbConnection,
      "theme",
      "dark",
      mockSetPrefs,
    );
  });

  it("calls updateUserPrefs with 'light' when Light button is clicked", async () => {
    const mockSetPrefs = vi.fn();
    const mockHandleTheme = vi.fn();
    const updateSpy = vi.spyOn(helpers, "updateUserPrefs").mockResolvedValue(undefined as any);

    render(
      <BottomSheetThemeOptions
        dbConnection={mockdbConnection}
        triggerId="test-theme-trigger"
        theme="oled"
        setUserPreferences={mockSetPrefs}
        handleTheme={mockHandleTheme}
      />,
    );

    const lightButton = screen.getByRole("button", { name: "Light" });
    await userEvent.click(lightButton);

    expect(updateSpy).toHaveBeenCalledWith(
      mockdbConnection,
      "theme",
      "light",
      mockSetPrefs,
    );
  });

  it("calls updateUserPrefs with 'system' when System button is clicked", async () => {
    const mockSetPrefs = vi.fn();
    const mockHandleTheme = vi.fn();
    const updateSpy = vi.spyOn(helpers, "updateUserPrefs").mockResolvedValue(undefined as any);

    render(
      <BottomSheetThemeOptions
        dbConnection={mockdbConnection}
        triggerId="test-theme-trigger"
        theme="oled"
        setUserPreferences={mockSetPrefs}
        handleTheme={mockHandleTheme}
      />,
    );

    const systemButton = screen.getByRole("button", { name: "System" });
    await userEvent.click(systemButton);

    expect(updateSpy).toHaveBeenCalledWith(
      mockdbConnection,
      "theme",
      "system",
      mockSetPrefs,
    );
  });
});
