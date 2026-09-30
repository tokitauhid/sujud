import React, { useEffect, useRef, useState, useCallback } from "react";
import { isInitialSettingsSetupCompleted } from "../utils/deviceSettings";

export interface LoadingScreenProps {
  isAppReady: boolean;
  isFirstRun?: boolean;
  onFinish?: () => void;
  themeOverride?: "oled" | "light" | "dark";
}

export const ONBOARDING_THEME_VIDEO_CONFIG: Record<
  "oled" | "light" | "dark",
  { src: string; bg: string }
> = {
  oled: {
    src: "/assets/onboarding_intro_oled.mp4",
    bg: "#000000",
  },
  dark: {
    src: "/assets/onboarding_intro_dark.mp4",
    bg: "#0B0D11",
  },
  light: {
    src: "/assets/onboarding_intro_light.mp4",
    bg: "#FAF7F4",
  },
};

export const LOADING_THEME_VIDEO_CONFIG: Record<
  "oled" | "light" | "dark",
  { src: string; bg: string }
> = {
  oled: {
    src: "/assets/loading_oled.mp4",
    bg: "#000000",
  },
  dark: {
    src: "/assets/loading_dark.mp4",
    bg: "#0B0D11",
  },
  light: {
    src: "/assets/loading_light.mp4",
    bg: "#FAF7F4",
  },
};

// Backwards-compatible aliases
export const SUBSEQUENT_LOADING_CONFIG = LOADING_THEME_VIDEO_CONFIG.dark;
export const THEME_VIDEO_CONFIG = ONBOARDING_THEME_VIDEO_CONFIG;

export function getResolvedLoadingTheme(): "oled" | "light" | "dark" {
  try {
    const cached = localStorage.getItem("sujud_theme");
    if (cached === "oled") return "oled";
    if (cached === "light") return "light";
    if (cached === "dark") return "dark";
    if (cached === "system") {
      return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
  } catch {}
  return "dark";
}

/**
 * Determines whether the app is on its very first launch / initial onboarding
 * using the app's existing persistence state.
 */
export function determineIsFirstRun(): boolean {
  try {
    if (typeof window !== "undefined") {
      if (window.location.search.includes("first_run=1")) return true;
      if (window.location.search.includes("no_onboarding")) return false;
      return !isInitialSettingsSetupCompleted();
    }
  } catch {}
  return false;
}

// 1x1 transparent PNG poster to prevent Android WebView from rendering its default circular play poster
const TRANSPARENT_POSTER =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const EXIT_FADE_DURATION = 500; // ms — smooth 400–600ms fade out

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  isAppReady,
  isFirstRun,
  onFinish,
  themeOverride,
}) => {
  const isFirstRunActive = isFirstRun !== undefined ? isFirstRun : determineIsFirstRun();
  const activeTheme = themeOverride || getResolvedLoadingTheme();

  // STAGE 1: Full 13-second theme-matched onboarding intro video (OLED, Dark, Light)
  // STAGE 2: Looping theme-matched loading indicator video (OLED, Dark, Light)
  const mediaConfig = isFirstRunActive
    ? (ONBOARDING_THEME_VIDEO_CONFIG[activeTheme] || ONBOARDING_THEME_VIDEO_CONFIG.dark)
    : (LOADING_THEME_VIDEO_CONFIG[activeTheme] || LOADING_THEME_VIDEO_CONFIG.dark);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoEnded, setVideoEnded] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isCompletelyFinished, setIsCompletelyFinished] = useState(false);

  // STAGE 1: Must show full ~13s video; exits when BOTH video has ended AND app initialization is ready
  // STAGE 2: Immediately begins fade-out as soon as app initialization is ready (even mid-loop)
  const isReadyToExit = isFirstRunActive ? (videoEnded && isAppReady) : isAppReady;

  useEffect(() => {
    if (!isReadyToExit) return;

    setIsFadingOut(true);

    const timer = setTimeout(() => {
      setIsCompletelyFinished(true);
      onFinish?.();
    }, EXIT_FADE_DURATION);

    return () => clearTimeout(timer);
  }, [isReadyToExit, onFinish]);

  // Ensure playback starts immediately on mount
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.playsInline = true;
    video.autoplay = true;

    // First run has audio (takbeer/narration), subsequent runs are visual indicator
    video.muted = !isFirstRunActive;

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsVideoPlaying(true);
        })
        .catch(() => {
          // If browser restricts unmuted playback without user interaction, fallback to muted
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current
              .play()
              .then(() => setIsVideoPlaying(true))
              .catch(() => setIsVideoPlaying(true));
          }
        });
    }
  }, [isFirstRunActive, mediaConfig.src]);

  const handleVideoPlaying = useCallback(() => {
    setIsVideoPlaying(true);
  }, []);

  const handleVideoEnded = useCallback(() => {
    if (isFirstRunActive) {
      setVideoEnded(true);
    } else {
      // In case native looping pauses or doesn't fire seamlessly, immediately restart
      const video = videoRef.current;
      if (video) {
        video.currentTime = 0;
        video.play().catch(() => {});
      }
    }
  }, [isFirstRunActive]);

  const handleVideoError = useCallback(() => {
    // If video fails to load or decode, gracefully proceed so app doesn't stall
    setVideoEnded(true);
  }, []);

  if (isCompletelyFinished) {
    return null;
  }

  return (
    <div
      id="sujud-loading-screen"
      role="status"
      aria-label="Loading Sujud"
      className={`fixed inset-0 z-[999999] flex items-center justify-center select-none overflow-hidden transition-opacity ease-out ${
        isFadingOut ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto"
      }`}
      style={{
        backgroundColor: mediaConfig.bg,
        transitionDuration: `${EXIT_FADE_DURATION}ms`,
      }}
    >
      <style>{`
        #sujud-loading-screen video::-webkit-media-controls,
        #sujud-loading-screen video::-webkit-media-controls-enclosure,
        #sujud-loading-screen video::-webkit-media-controls-panel,
        #sujud-loading-screen video::-webkit-media-controls-play-button,
        #sujud-loading-screen video::-webkit-media-controls-start-playback-button,
        #sujud-loading-screen video::-webkit-media-controls-overlay-play-button {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
          -webkit-appearance: none !important;
          pointer-events: none !important;
        }
      `}</style>

      {/*
        1:1 Video Stage:
        - 1:1 proportional scaling only, centered horizontally and vertically
        - Never cropped, never zoomed, never stretched (object-fit: contain)
        - Seamless background matching surrounding screen with zero boundaries or card effects
        - Zero video player UI, zero native overlay controls, transparent poster to eliminate default Android play icon
        - Looping continuously without visible pause or flash on subsequent startups
      */}
      <div className="relative flex items-center justify-center w-full h-full max-w-full max-h-full pointer-events-none">
        <video
          ref={videoRef}
          src={mediaConfig.src}
          poster={TRANSPARENT_POSTER}
          autoPlay
          loop={!isFirstRunActive}
          playsInline
          {...{ "webkit-playsinline": "true" }}
          disablePictureInPicture
          disableRemotePlayback
          controls={false}
          preload="auto"
          onPlaying={handleVideoPlaying}
          onLoadedData={handleVideoPlaying}
          onEnded={handleVideoEnded}
          onError={handleVideoError}
          aria-hidden="true"
          className={`pointer-events-none select-none max-w-[720px] max-h-[720px] w-full h-full aspect-square transition-opacity duration-150 ${
            isVideoPlaying ? "opacity-100" : "opacity-0"
          }`}
          style={{
            width: "min(100vw, 100vh, 720px)",
            height: "min(100vw, 100vh, 720px)",
            aspectRatio: "1 / 1",
            objectFit: "contain",
            backgroundColor: mediaConfig.bg,
          }}
        />
      </div>
    </div>
  );
};

export default LoadingScreen;
