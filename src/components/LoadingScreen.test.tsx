import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import LoadingScreen from "./LoadingScreen";

// jsdom doesn't implement HTMLVideoElement.play/load, so we stub them
beforeEach(() => {
  Object.defineProperty(HTMLVideoElement.prototype, "play", {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
  Object.defineProperty(HTMLVideoElement.prototype, "load", {
    configurable: true,
    value: vi.fn(),
  });
});

describe("LoadingScreen Component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the video element and accessible status role", () => {
    render(<LoadingScreen isAppReady={false} />);
    expect(screen.getByRole("status")).toBeDefined();
    const video = document.querySelector("video") as HTMLVideoElement;
    expect(video).not.toBeNull();
    expect(video.src).toContain("onboarding_intro.mp4");
    expect(video.autoplay).toBe(true);
    expect(video.muted).toBe(true);
  });

  it("does NOT exit while video is still playing, even if app is ready", () => {
    const onFinishMock = vi.fn();
    render(<LoadingScreen isAppReady={true} onFinish={onFinishMock} />);

    // App is ready but video hasn't ended yet — must not exit
    act(() => { vi.advanceTimersByTime(9000); });
    expect(onFinishMock).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toBeDefined();
  });

  it("does NOT exit when video ends but app is NOT ready", () => {
    const onFinishMock = vi.fn();
    render(<LoadingScreen isAppReady={false} onFinish={onFinishMock} />);

    // Fire the video ended event
    const video = document.querySelector("video") as HTMLVideoElement;
    act(() => { fireEvent(video, new Event("ended")); });

    act(() => { vi.advanceTimersByTime(1000); });
    expect(onFinishMock).not.toHaveBeenCalled();
  });

  it("exits with fade after video ends AND app becomes ready", () => {
    const onFinishMock = vi.fn();
    const { rerender } = render(<LoadingScreen isAppReady={false} onFinish={onFinishMock} />);

    // Fire video ended
    const video = document.querySelector("video") as HTMLVideoElement;
    act(() => { fireEvent(video, new Event("ended")); });

    // App not ready yet
    act(() => { vi.advanceTimersByTime(500); });
    expect(onFinishMock).not.toHaveBeenCalled();

    // App becomes ready
    rerender(<LoadingScreen isAppReady={true} onFinish={onFinishMock} />);

    // Advance past 500ms exit fade
    act(() => { vi.advanceTimersByTime(550); });
    expect(onFinishMock).toHaveBeenCalledTimes(1);
  });

  it("exits with fade when app is already ready and video ends", () => {
    const onFinishMock = vi.fn();
    render(<LoadingScreen isAppReady={true} onFinish={onFinishMock} />);

    // Fire video ended — both conditions now met
    const video = document.querySelector("video") as HTMLVideoElement;
    act(() => { fireEvent(video, new Event("ended")); });

    // Not yet — fade is 500ms
    act(() => { vi.advanceTimersByTime(400); });
    expect(onFinishMock).not.toHaveBeenCalled();

    // Complete the fade
    act(() => { vi.advanceTimersByTime(150); });
    expect(onFinishMock).toHaveBeenCalledTimes(1);
  });
});
