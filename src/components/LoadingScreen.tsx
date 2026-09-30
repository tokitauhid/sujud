import React, { useEffect, useRef, useState } from "react";

interface LoadingScreenProps {
  isAppReady: boolean;
  onFinish?: () => void;
}

const VIDEO_SRC = "/assets/onboarding_intro.mp4";
const EXIT_FADE_DURATION = 500; // ms — smooth fade out after video ends + app ready

const LoadingScreen: React.FC<LoadingScreenProps> = ({ isAppReady, onFinish }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoEnded, setVideoEnded] = useState(false);
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

  const handleVideoEnded = () => {
    setVideoEnded(true);
  };

  // If app isn't ready yet when the video ends, the video will have already
  // stopped on its last frame — we just wait for isAppReady to flip.
  // If app is already ready when video ends, we exit immediately.

  if (isCompletelyFinished) {
    return null;
  }

  return (
    <div
      id="sujud-loading-screen"
      role="status"
      aria-label="Loading Sujud"
      className={`fixed inset-0 z-[999999] flex items-center justify-center select-none transition-opacity ease-out ${
        isFadingOut ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto"
      }`}
      style={{
        backgroundColor: "#000000",
        transitionDuration: `${EXIT_FADE_DURATION}ms`,
      }}
    >
      <video
        ref={videoRef}
        src={VIDEO_SRC}
        autoPlay
        muted
        playsInline
        onEnded={handleVideoEnded}
        className="w-full h-full object-cover"
        aria-hidden="true"
      />
    </div>
  );
};

export default LoadingScreen;
