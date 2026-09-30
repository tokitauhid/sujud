import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import LoadingScreen from "./LoadingScreen";

// jsdom doesn't implement HTMLVideoElement.play/load, so we stub them
beforeEach(() => {
  localStorage.clear();
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

  describe("Stage 1: First install / Onboarding", () => {
    it("renders the 13-second onboarding video with audio enabled and loop=false", async () => {
      await act(async () => {
        render(<LoadingScreen isAppReady={false} isFirstRun={true} />);
      });
      expect(screen.getByRole("status")).toBeDefined();
      const video = document.querySelector("video") as HTMLVideoElement;
      expect(video).not.toBeNull();
      expect(video.src).toContain("onboarding_intro");
      expect(video.autoplay).toBe(true);
      expect(video.loop).toBe(false);
      expect(video.muted).toBe(false);
    });

    it("selects video and background color matching theme: OLED, Dark, and Light", () => {
      const { unmount: unmountOled } = render(
        <LoadingScreen isAppReady={false} isFirstRun={true} themeOverride="oled" />
      );
      let video = document.querySelector("video") as HTMLVideoElement;
      expect(video.src).toContain("onboarding_intro_oled.mp4");
      expect(video.style.backgroundColor).toBe("rgb(0, 0, 0)");
      unmountOled();

      const { unmount: unmountDark } = render(
        <LoadingScreen isAppReady={false} isFirstRun={true} themeOverride="dark" />
      );
      video = document.querySelector("video") as HTMLVideoElement;
      expect(video.src).toContain("onboarding_intro_dark.mp4");
      expect(video.style.backgroundColor).toBe("rgb(11, 13, 17)");
      unmountDark();

      render(
        <LoadingScreen isAppReady={false} isFirstRun={true} themeOverride="light" />
      );
      video = document.querySelector("video") as HTMLVideoElement;
      expect(video.src).toContain("onboarding_intro_light.mp4");
      expect(video.style.backgroundColor).toBe("rgb(250, 247, 244)");
    });

    it("does NOT exit while onboarding video is still playing, even if app is ready", () => {
      const onFinishMock = vi.fn();
      render(
        <LoadingScreen isAppReady={true} isFirstRun={true} onFinish={onFinishMock} />
      );

      // App is ready but video hasn't ended yet — must not exit
      act(() => {
        vi.advanceTimersByTime(9000);
      });
      expect(onFinishMock).not.toHaveBeenCalled();
      expect(screen.getByRole("status")).toBeDefined();
    });

    it("does NOT exit when onboarding video ends but app is NOT ready", () => {
      const onFinishMock = vi.fn();
      render(
        <LoadingScreen isAppReady={false} isFirstRun={true} onFinish={onFinishMock} />
      );

      const video = document.querySelector("video") as HTMLVideoElement;
      act(() => {
        fireEvent(video, new Event("ended"));
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onFinishMock).not.toHaveBeenCalled();
    });

    it("exits with smooth fade after video ends AND app becomes ready", () => {
      const onFinishMock = vi.fn();
      const { rerender } = render(
        <LoadingScreen isAppReady={false} isFirstRun={true} onFinish={onFinishMock} />
      );

      const video = document.querySelector("video") as HTMLVideoElement;
      act(() => {
        fireEvent(video, new Event("ended"));
      });

      // App not ready yet
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(onFinishMock).not.toHaveBeenCalled();

      // App becomes ready
      rerender(
        <LoadingScreen isAppReady={true} isFirstRun={true} onFinish={onFinishMock} />
      );

      // Advance past 500ms exit fade
      act(() => {
        vi.advanceTimersByTime(550);
      });
      expect(onFinishMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("Stage 2: Subsequent app startups", () => {
    it("uses loading video with continuous loop enabled and muted=true", () => {
      render(<LoadingScreen isAppReady={false} isFirstRun={false} />);
      const video = document.querySelector("video") as HTMLVideoElement;
      expect(video).not.toBeNull();
      expect(video.src).toContain("loading");
      expect(video.loop).toBe(true);
      expect(video.muted).toBe(true);
    });

    it("selects loading video and background color matching theme: OLED, Dark, and Light", () => {
      const { unmount: unmountOled } = render(
        <LoadingScreen isAppReady={false} isFirstRun={false} themeOverride="oled" />
      );
      let video = document.querySelector("video") as HTMLVideoElement;
      expect(video.src).toContain("loading_oled.mp4");
      expect(video.style.backgroundColor).toBe("rgb(0, 0, 0)");
      unmountOled();

      const { unmount: unmountDark } = render(
        <LoadingScreen isAppReady={false} isFirstRun={false} themeOverride="dark" />
      );
      video = document.querySelector("video") as HTMLVideoElement;
      expect(video.src).toContain("loading_dark.mp4");
      expect(video.style.backgroundColor).toBe("rgb(11, 13, 17)");
      unmountDark();

      render(
        <LoadingScreen isAppReady={false} isFirstRun={false} themeOverride="light" />
      );
      video = document.querySelector("video") as HTMLVideoElement;
      expect(video.src).toContain("loading_light.mp4");
      expect(video.style.backgroundColor).toBe("rgb(250, 247, 244)");
    });

    it("loops continuously while app initialization is in progress", () => {
      const onFinishMock = vi.fn();
      render(
        <LoadingScreen isAppReady={false} isFirstRun={false} onFinish={onFinishMock} />
      );

      const video = document.querySelector("video") as HTMLVideoElement;

      // Simulate a loop cycle ending while app is still initializing
      act(() => {
        fireEvent(video, new Event("ended"));
      });

      // Advance time — should still be active and looping
      act(() => {
        vi.advanceTimersByTime(18000);
      });
      expect(onFinishMock).not.toHaveBeenCalled();
      expect(screen.getByRole("status")).toBeDefined();
    });

    it("immediately begins fade-out when app becomes ready mid-loop without waiting for loop end", () => {
      const onFinishMock = vi.fn();
      const { rerender } = render(
        <LoadingScreen isAppReady={false} isFirstRun={false} onFinish={onFinishMock} />
      );

      // Video is playing (e.g. 4 seconds in)
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(onFinishMock).not.toHaveBeenCalled();

      // Database and background initialization completes now
      rerender(
        <LoadingScreen isAppReady={true} isFirstRun={false} onFinish={onFinishMock} />
      );

      // Fade-out starts immediately: at 250ms it's fading
      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(onFinishMock).not.toHaveBeenCalled();

      // At 550ms fade completes
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(onFinishMock).toHaveBeenCalledTimes(1);
    });

    it("immediately begins fade-out if initialization was already complete on mount", () => {
      const onFinishMock = vi.fn();
      render(
        <LoadingScreen isAppReady={true} isFirstRun={false} onFinish={onFinishMock} />
      );

      // Within 500ms fade duration
      act(() => {
        vi.advanceTimersByTime(550);
      });
      expect(onFinishMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("Aesthetics, sizing, and error resilience", () => {
    it("enforces natural 1:1 aspect ratio and object-fit: contain (never object-fit: cover)", () => {
      render(<LoadingScreen isAppReady={false} isFirstRun={false} />);
      const video = document.querySelector("video") as HTMLVideoElement;
      expect(video).not.toBeNull();

      expect(video.style.aspectRatio).toBe("1 / 1");
      expect(video.style.objectFit).toBe("contain");
      expect(video.style.objectFit).not.toBe("cover");

      expect(video.style.width).toContain("min(100vw, 100vh, 720px)");
      expect(video.style.height).toContain("min(100vw, 100vh, 720px)");
    });

    it("hides all media player UI and sets inline playback attributes", () => {
      render(<LoadingScreen isAppReady={false} isFirstRun={false} />);
      const video = document.querySelector("video") as HTMLVideoElement;
      expect(video).not.toBeNull();

      expect(video.controls).toBe(false);
      expect(video.playsInline).toBe(true);
      expect(video.getAttribute("disablepictureinpicture")).not.toBeNull();
      expect(video.getAttribute("disableremoteplayback")).not.toBeNull();
    });

    it("gracefully recovers and exits when video encounters an error and app is ready", () => {
      const onFinishMock = vi.fn();
      render(
        <LoadingScreen isAppReady={true} isFirstRun={true} onFinish={onFinishMock} />
      );

      const video = document.querySelector("video") as HTMLVideoElement;
      act(() => {
        fireEvent(video, new Event("error"));
      });

      // Exit fade duration
      act(() => {
        vi.advanceTimersByTime(550);
      });
      expect(onFinishMock).toHaveBeenCalledTimes(1);
    });
  });
});
