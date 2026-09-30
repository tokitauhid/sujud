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
    expect(video.src).toContain("onboarding_intro");
    expect(video.autoplay).toBe(true);
    expect(video.muted).toBe(false);
  });

  it("selects video and background color matching theme: OLED, Dark, and Light", () => {
    const { unmount: unmountOled } = render(<LoadingScreen isAppReady={false} themeOverride="oled" />);
    let video = document.querySelector("video") as HTMLVideoElement;
    expect(video.src).toContain("onboarding_intro_oled.mp4");
    expect(video.style.backgroundColor).toBe("rgb(0, 0, 0)");
    unmountOled();

    const { unmount: unmountDark } = render(<LoadingScreen isAppReady={false} themeOverride="dark" />);
    video = document.querySelector("video") as HTMLVideoElement;
    expect(video.src).toContain("onboarding_intro_dark.mp4");
    expect(video.style.backgroundColor).toBe("rgb(11, 13, 17)");
    unmountDark();

    render(<LoadingScreen isAppReady={false} themeOverride="light" />);
    video = document.querySelector("video") as HTMLVideoElement;
    expect(video.src).toContain("onboarding_intro_light.mp4");
    expect(video.style.backgroundColor).toBe("rgb(250, 247, 244)");
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

  it("enforces natural 1:1 aspect ratio and object-fit: contain (never object-fit: cover)", () => {
    render(<LoadingScreen isAppReady={false} />);
    const video = document.querySelector("video") as HTMLVideoElement;
    expect(video).not.toBeNull();

    // Verify 1:1 aspect ratio and containment
    expect(video.style.aspectRatio).toBe("1 / 1");
    expect(video.style.objectFit).toBe("contain");
    expect(video.style.objectFit).not.toBe("cover");

    // Verify proportional scaling sizing constraints
    expect(video.style.width).toContain("min(100vw, 100vh, 720px)");
    expect(video.style.height).toContain("min(100vw, 100vh, 720px)");
  });

  it("hides all media player UI and sets inline playback attributes", () => {
    render(<LoadingScreen isAppReady={false} themeOverride="oled" />);
    const video = document.querySelector("video") as HTMLVideoElement;
    expect(video).not.toBeNull();

    // Ensure player controls are explicitly disabled and audio enabled
    expect(video.controls).toBe(false);
    expect(video.playsInline).toBe(true);
    expect(video.muted).toBe(false);
    expect(video.getAttribute("disablepictureinpicture")).not.toBeNull();
    expect(video.getAttribute("disableremoteplayback")).not.toBeNull();

    // Ensure seamless black background is applied
    expect(video.style.backgroundColor).toBe("rgb(0, 0, 0)");
  });

  it("gracefully recovers and exits when video encounters an error and app is ready", () => {
    const onFinishMock = vi.fn();
    render(<LoadingScreen isAppReady={true} onFinish={onFinishMock} />);

    const video = document.querySelector("video") as HTMLVideoElement;
    act(() => { fireEvent(video, new Event("error")); });

    // Exit fade duration
    act(() => { vi.advanceTimersByTime(550); });
    expect(onFinishMock).toHaveBeenCalledTimes(1);
  });
});
