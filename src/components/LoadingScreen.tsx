import React, { useEffect, useRef, useState, useCallback } from "react";

interface LoadingScreenProps {
  isAppReady: boolean;
  onFinish?: () => void;
  themeOverride?: "oled" | "light" | "dark";
}

export const THEME_VIDEO_CONFIG: Record<
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

// 1x1 transparent PNG poster to prevent Android WebView from rendering its default circular play poster
const TRANSPARENT_POSTER =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const EXIT_FADE_DURATION = 500; // ms — smooth fade out after video ends + app ready

const LoadingScreen: React.FC<LoadingScreenProps> = ({ isAppReady, onFinish, themeOverride }) => {
  const activeTheme = themeOverride || getResolvedLoadingTheme();
  const themeConfig = THEME_VIDEO_CONFIG[activeTheme] || THEME_VIDEO_CONFIG.dark;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoEnded, setVideoEnded] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isCompletelyFinished, setIsCompletelyFinished] = useState(false);

  // When BOTH the video has finished AND the app is ready, trigger the exit fade
  const isReadyToExit = videoEnded && isAppReady;

  useEffect(() => {
    if (!isReadyToExit) return;

    setIsFadingOut(true);

    const timer = setTimeout(() => {
      setIsCompletelyFinished(true);
      onFinish?.();
    }, EXIT_FADE_DURATION);

    return () => clearTimeout(timer);
  }, [isReadyToExit, onFinish]);

  // Ensure playback starts immediately on mount with audio
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.playsInline = true;
    video.autoplay = true;

    // Attempt unmuted playback so audio plays immediately (works natively on Android via WebSettings)
    video.muted = false;

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsVideoPlaying(true);
        })
        .catch(() => {
          // If a desktop/mobile web browser blocks unmuted autoplay without user gesture, fallback to muted
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current
              .play()
              .then(() => setIsVideoPlaying(true))
              .catch(() => setIsVideoPlaying(true));
          }
        });
    }
  }, []);

  const handleVideoPlaying = useCallback(() => {
    setIsVideoPlaying(true);
  }, []);

  const handleVideoEnded = useCallback(() => {
    setVideoEnded(true);
  }, []);

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
        backgroundColor: themeConfig.bg,
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
        - Full audio playback enabled with web fallback
      */}
      <div className="relative flex items-center justify-center w-full h-full max-w-full max-h-full pointer-events-none">
        <video
          ref={videoRef}
          src={themeConfig.src}
          poster={TRANSPARENT_POSTER}
          autoPlay
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
            backgroundColor: themeConfig.bg,
          }}
        />
      </div>
    </div>
  );
};

export default LoadingScreen;
