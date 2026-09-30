import React, { useEffect, useRef, useState, useCallback } from "react";

interface LoadingScreenProps {
  isAppReady: boolean;
  onFinish?: () => void;
}

const VIDEO_SRC = "/assets/onboarding_intro.mp4";
// 1x1 transparent PNG poster to prevent Android WebView from rendering its default circular play poster
const TRANSPARENT_POSTER =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const EXIT_FADE_DURATION = 500; // ms — smooth fade out after video ends + app ready

const LoadingScreen: React.FC<LoadingScreenProps> = ({ isAppReady, onFinish }) => {
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
        backgroundColor: "#000000",
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
        - Seamless 100% black background matching surrounding screen with zero boundaries or card effects
        - Zero video player UI, zero native overlay controls, transparent poster to eliminate default Android play icon
        - Full audio playback enabled with web fallback
      */}
      <div className="relative flex items-center justify-center w-full h-full max-w-full max-h-full pointer-events-none">
        <video
          ref={videoRef}
          src={VIDEO_SRC}
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
            backgroundColor: "#000000",
          }}
        />
      </div>
    </div>
  );
};

export default LoadingScreen;
