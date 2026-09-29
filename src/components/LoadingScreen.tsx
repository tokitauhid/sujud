import React, { useEffect, useState, useRef, useMemo } from "react";

interface LoadingScreenProps {
  isAppReady: boolean;
  onFinish?: () => void;
}

// Transparent sprite frames in public directory (WebP with PNG fallback)
const SPRITE_FRAMES = [
  "/assets/loading_sprites/frame-001.webp",
  "/assets/loading_sprites/frame-002.webp",
  "/assets/loading_sprites/frame-003.webp",
  "/assets/loading_sprites/frame-004.webp",
  "/assets/loading_sprites/frame-005.webp",
  "/assets/loading_sprites/frame-006.webp",
  "/assets/loading_sprites/frame-007.webp",
  "/assets/loading_sprites/frame-008.webp",
  "/assets/loading_sprites/frame-009.webp",
  "/assets/loading_sprites/frame-010.webp",
  "/assets/loading_sprites/frame-011.webp",
  "/assets/loading_sprites/frame-012.webp",
];

const LOGO_SRC = "/assets/loading_sprites/sujud-logo.webp";

// Pacing timings (ms) for each keyframe in the serene prayer sequence
const FRAME_DURATIONS = [
  600, // 0: Frame 1 (Qiyam - standing posture)
  150, // 1: Frame 2 (Begin Ruku)
  150, // 2: Frame 3 (Mid Ruku)
  320, // 3: Frame 4 (Hold full Ruku)
  180, // 4: Frame 5 (Drop to knees/hands)
  180, // 5: Frame 6 (Descend to Sujood)
  350, // 6: Frame 7 (Deep Sujood prostration)
  220, // 7: Frame 8 (Cat enters on left)
  220, // 8: Frame 9 (Cat steps closer)
  220, // 9: Frame 10 (Cat tucks under)
  220, // 10: Frame 11 (Cat curls up)
  550, // 11: Frame 12 (Composition complete hold)
];

const LoadingScreen: React.FC<LoadingScreenProps> = ({ isAppReady, onFinish }) => {
  // Check prefers-reduced-motion
  const prefersReducedMotion = useMemo(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return false;
  }, []);

  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);
  const [isLogoPhase, setIsLogoPhase] = useState<boolean>(prefersReducedMotion);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);
  const [isCompletelyFinished, setIsCompletelyFinished] = useState<boolean>(false);

  const isAppReadyRef = useRef(isAppReady);
  isAppReadyRef.current = isAppReady;

  // Preload all sprite images on mount
  useEffect(() => {
    if (prefersReducedMotion) return;

    SPRITE_FRAMES.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
    const logoImg = new Image();
    logoImg.src = LOGO_SRC;
  }, [prefersReducedMotion]);

  // Main animation stepping sequence
  useEffect(() => {
    if (prefersReducedMotion) {
      // Reduced motion: directly jump to logo phase
      setIsLogoPhase(true);
      return;
    }

    let timeoutId: NodeJS.Timeout;

    const stepToNext = (idx: number) => {
      if (idx < SPRITE_FRAMES.length - 1) {
        // Next sprite frame
        const nextIdx = idx + 1;
        timeoutId = setTimeout(() => {
          setCurrentFrameIndex(nextIdx);
          stepToNext(nextIdx);
        }, FRAME_DURATIONS[nextIdx]);
      } else {
        // Completed Frame 12 hold -> Morph into Sujud Logo
        timeoutId = setTimeout(() => {
          setIsLogoPhase(true);
        }, FRAME_DURATIONS[11]);
      }
    };

    // Begin from Frame 1
    timeoutId = setTimeout(() => {
      stepToNext(0);
    }, FRAME_DURATIONS[0]);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [prefersReducedMotion]);

  // Transition into app when both logo phase is reached and app initialization is ready
  useEffect(() => {
    if (!isLogoPhase) return;

    let exitTimeout: NodeJS.Timeout;

    if (isAppReady) {
      // If app is ready, hold briefly on the brand logo for polish (~400ms), then fade out
      const holdDuration = prefersReducedMotion ? 200 : 400;
      exitTimeout = setTimeout(() => {
        setIsFadingOut(true);
        // Complete fade-out after 400ms transition
        setTimeout(() => {
          setIsCompletelyFinished(true);
          onFinish?.();
        }, 400);
      }, holdDuration);
    }

    return () => {
      clearTimeout(exitTimeout);
    };
  }, [isLogoPhase, isAppReady, prefersReducedMotion, onFinish]);

  if (isCompletelyFinished) {
    return null;
  }

  return (
    <div
      id="sujud-loading-screen"
      role="status"
      aria-label="Loading Sujud"
      className={`fixed inset-0 z-[999999] flex flex-col items-center justify-center select-none rounded-none transition-opacity duration-400 ease-out ${
        isFadingOut ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto"
      }`}
      style={{
        backgroundColor: "var(--app-bg, #0B0D11)",
      }}
    >
      {/* Animation Stage Container */}
      <div className="relative w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 flex items-center justify-center rounded-none overflow-hidden">
        {/* Animated Sprite Sequence (Frames 1..12) */}
        {!prefersReducedMotion && (
          <img
            key={currentFrameIndex}
            src={SPRITE_FRAMES[currentFrameIndex]}
            onError={(e) => {
              if (e.currentTarget.src.endsWith(".webp")) {
                e.currentTarget.src = e.currentTarget.src.replace(".webp", ".png");
              }
            }}
            alt="Sujud animation"
            className={`absolute inset-0 w-full h-full object-contain rounded-none transition-opacity duration-300 ${
              isLogoPhase ? "opacity-0 scale-95" : "opacity-100 scale-100"
            }`}
            style={{
              filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.35))",
            }}
          />
        )}

        {/* Official Sujud Logo Phase (Emblem + SUJUD title) */}
        <div
          className={`absolute inset-0 w-full h-full flex flex-col items-center justify-center transition-all duration-500 ease-out ${
            isLogoPhase ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
          }`}
        >
          <img
            src={LOGO_SRC}
            onError={(e) => {
              if (e.currentTarget.src.endsWith(".webp")) {
                e.currentTarget.src = e.currentTarget.src.replace(".webp", ".png");
              }
            }}
            alt="Sujud Logo"
            className="w-full h-full object-contain rounded-none"
            style={{
              filter: "drop-shadow(0 10px 30px rgba(0,0,0,0.4))",
            }}
          />
        </div>
      </div>

      {/* Subtle Minimal Emerald Accent Line (0 border radius, subtle readiness indicator) */}
      <div className="absolute bottom-12 w-12 h-[2px] bg-transparent overflow-hidden rounded-none">
        <div
          className={`w-full h-full bg-[#10B981] transition-opacity duration-500 ${
            isLogoPhase ? "opacity-80 animate-pulse" : "opacity-0"
          }`}
        />
      </div>
    </div>
  );
};

export default LoadingScreen;
