import React from "react";
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import LoadingScreen from "./LoadingScreen";

describe("LoadingScreen Component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders with initial frame 1 (Qiyam) and accessible status role", () => {
    render(<LoadingScreen isAppReady={false} />);
    const statusEl = screen.getByRole("status");
    expect(statusEl).toBeDefined();

    const img = screen.getByAltText("Sujud animation") as HTMLImageElement;
    expect(img).toBeDefined();
    expect(img.src).toContain("frame-001.webp");
  });

  it("progresses through the prayer sequence and transitions into the logo phase", async () => {
    render(<LoadingScreen isAppReady={false} />);

    // Fast-forward past all 12 keyframes (~4 seconds)
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    const logoImg = screen.getByAltText("Sujud Logo") as HTMLImageElement;
    expect(logoImg).toBeDefined();
    expect(logoImg.src).toContain("sujud-logo.webp");
  });

  it("smoothly triggers onFinish after isAppReady becomes true and logo phase finishes", () => {
    const onFinishMock = vi.fn();
    const { rerender } = render(<LoadingScreen isAppReady={false} onFinish={onFinishMock} />);

    // Fast-forward into logo phase
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(onFinishMock).not.toHaveBeenCalled();

    // Now app initialization completes
    rerender(<LoadingScreen isAppReady={true} onFinish={onFinishMock} />);

    // Fast-forward exit hold + transition duration (~800ms)
    act(() => {
      vi.advanceTimersByTime(900);
    });

    expect(onFinishMock).toHaveBeenCalledTimes(1);
  });

  it("respects prefers-reduced-motion by immediately presenting static logo without motion frames", () => {
    // Mock matchMedia for prefers-reduced-motion
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes("prefers-reduced-motion: reduce"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const onFinishMock = vi.fn();
    render(<LoadingScreen isAppReady={true} onFinish={onFinishMock} />);

    // In reduced motion, sprite animation is skipped; logo is shown directly
    expect(screen.queryByAltText("Sujud animation")).toBeNull();
    const logoImg = screen.getByAltText("Sujud Logo");
    expect(logoImg).toBeDefined();

    // Fast forward exit duration
    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(onFinishMock).toHaveBeenCalledTimes(1);
  });
});
