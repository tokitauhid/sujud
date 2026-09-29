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

    // Fast-forward past all 12 keyframes and composition hold (~5200ms)
    act(() => {
      vi.advanceTimersByTime(5200);
    });

    const logoImg = screen.getByAltText("Sujud Logo") as HTMLImageElement;
    expect(logoImg).toBeDefined();
    expect(logoImg.src).toContain("sujud-logo.webp");
  });

  it("HOLDS logo for at least 1800ms even if isAppReady is already true from start", () => {
    const onFinishMock = vi.fn();
    render(<LoadingScreen isAppReady={true} onFinish={onFinishMock} />);

    // Fast-forward to when logo phase just begins (~5200ms)
    act(() => {
      vi.advanceTimersByTime(5200);
    });

    // Logo is visible but must hold for at least 1800ms + 700ms morph
    expect(onFinishMock).not.toHaveBeenCalled();

    // Advance 1500ms into logo phase: still holding! (Total 6700ms)
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(onFinishMock).not.toHaveBeenCalled();

    // Advance remaining logo hold to complete minimum animation hold (Total 7700ms)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onFinishMock).not.toHaveBeenCalled(); // Exit fade is underway (500ms)

    // Advance exit fade (500ms)
    act(() => {
      vi.advanceTimersByTime(550);
    });

    // Now it should have smoothly completed
    expect(onFinishMock).toHaveBeenCalledTimes(1);
  });

  it("keeps holding logo indefinitely if database initialization takes longer, exiting only when isAppReady becomes true", () => {
    const onFinishMock = vi.fn();
    const { rerender } = render(<LoadingScreen isAppReady={false} onFinish={onFinishMock} />);

    // Fast-forward past entire animation and minimum hold (10,000ms)
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Still must NOT exit because isAppReady is false!
    expect(onFinishMock).not.toHaveBeenCalled();

    // Now database initialization completes!
    rerender(<LoadingScreen isAppReady={true} onFinish={onFinishMock} />);

    // Advance exit fade (500ms)
    act(() => {
      vi.advanceTimersByTime(550);
    });

    expect(onFinishMock).toHaveBeenCalledTimes(1);
  });

  it("respects prefers-reduced-motion with static logo and minimum hold", () => {
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

    // Must hold logo for minimum 1800ms
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onFinishMock).not.toHaveBeenCalled();

    // Complete the 1800ms minimum hold
    act(() => {
      vi.advanceTimersByTime(850);
    });
    expect(onFinishMock).not.toHaveBeenCalled(); // Exit fade is underway (500ms)

    // Advance exit fade (500ms)
    act(() => {
      vi.advanceTimersByTime(550);
    });

    expect(onFinishMock).toHaveBeenCalledTimes(1);
  });
});
