import React, { useEffect, useState, useMemo } from "react";

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
  "/assets/loading_sprites/frame-011.webp",
  "/assets/loading_sprites/frame-012.webp",
];

const LOGO_SRC = "/assets/loading_sprites/sujud-logo.webp";

// Calibrated serene timings:
// Qiyam: ~700ms
// Qiyam -> Ruku: ~700ms (Frames 2..4: 200ms, 200ms, 300ms)
// Ruku -> Sujood: ~900ms (Frames 5..7: 250ms, 250ms, 400ms)
// Cat walking: ~1000ms (Frames 8..9: 500ms, 500ms)
// Cat curling: ~700ms (Frames 11..12: 350ms, 350ms)
// Person + cat hold: ~900ms
// Logo transformation: ~700ms
// Final logo hold: minimum 1800ms
const FRAME_DURATIONS = [
  700, // 0: Frame 1 (Qiyam hold)
  200, // 1: Frame 2 (Qiyam -> Ruku start)
  200, // 2: Frame 3 (Qiyam -> Ruku mid)
  300, // 3: Frame 4 (Full Ruku hold)
  250, // 4: Frame 5 (Ruku -> Sujood drop)
  250, // 5: Frame 6 (Descend to mat)
  400, // 6: Frame 7 (Full Sujood hold)
  500, // 7: Frame 8 (Cat walks in)
  500, // 8: Frame 9 (Cat steps toward worshipper)
  350, // 9: Frame 11 (Cat curls under prayer arch)
  350, // 10: Frame 12 (Cat curled up composition)
];

const COMPOSITION_HOLD_DURATION = 900; // Person + cat hold before logo morph
const LOGO_MORPH_DURATION = 700; // Morph from composition into Sujud logo
const MIN_LOGO_HOLD_DURATION = 1800; // Minimum peaceful logo hold
const EXIT_FADE_DURATION = 500; // Smooth fade transition into the app

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
  const [minAnimationComplete, setMinAnimationComplete] = useState<boolean>(false);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);
  const [isCompletelyFinished, setIsCompletelyFinished] = useState<boolean>(false);

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
      // Reduced motion: directly jump to logo phase and hold minimum 1800ms
      setIsLogoPhase(true);
      const reducedMotionTimer = setTimeout(() => {
        setMinAnimationComplete(true);
      }, MIN_LOGO_HOLD_DURATION);
      return () => clearTimeout(reducedMotionTimer);
    }

    let timeoutId: NodeJS.Timeout;

    const stepToNext = (idx: number) => {
      if (idx < SPRITE_FRAMES.length - 1) {
        const nextIdx = idx + 1;
        timeoutId = setTimeout(() => {
          setCurrentFrameIndex(nextIdx);
          stepToNext(nextIdx);
        }, FRAME_DURATIONS[nextIdx]);
      } else {
        // Completed Frame 12 (person + cat composition) -> Hold composition for 900ms
        timeoutId = setTimeout(() => {
          setIsLogoPhase(true);

          // Morph (700ms) + Final logo hold (min 1800ms) = 2500ms
          timeoutId = setTimeout(() => {
            setMinAnimationComplete(true);
          }, LOGO_MORPH_DURATION + MIN_LOGO_HOLD_DURATION);
        }, COMPOSITION_HOLD_DURATION);
      }
    };

    // Begin from Frame 1 (Qiyam)
    timeoutId = setTimeout(() => {
      stepToNext(0);
    }, FRAME_DURATIONS[0]);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [prefersReducedMotion]);

  // Transition into app only when BOTH conditions are met:
  // 1. Minimum animation & logo hold completed (minAnimationComplete === true)
  // 2. Real app database initialization is ready (isAppReady === true)
  const isReadyToExit = minAnimationComplete && isAppReady;

  useEffect(() => {
    if (!isReadyToExit) return;

    // Begin smooth 500ms fade transition into the app
    setIsFadingOut(true);

    const exitTimer = setTimeout(() => {
      setIsCompletelyFinished(true);
      onFinish?.();
    }, EXIT_FADE_DURATION);

    return () => {
      clearTimeout(exitTimer);
    };
  }, [isReadyToExit, onFinish]);

  if (isCompletelyFinished) {
    return null;
  }

  return (
    <div
      id="sujud-loading-screen"
      role="status"
      aria-label="Loading Sujud"
      className={`fixed inset-0 z-[999999] flex flex-col items-center justify-center select-none rounded-none transition-opacity duration-500 ease-out ${
        isFadingOut ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto"
      }`}
      style={{
        backgroundColor: "var(--app-bg, #0B0D11)",
      }}
    >
      {/* Animation Stage Container with single unified drop shadow */}
      <div
        className="relative w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 flex items-center justify-center rounded-none overflow-hidden"
        style={{
          filter: "drop-shadow(0 10px 30px rgba(0,0,0,0.38))",
        }}
      >
        {/* Animated Sprite Sequence (Frames 1..12) */}
        {!prefersReducedMotion && (
          <div
            className={`absolute inset-0 w-full h-full flex items-center justify-center transition-opacity duration-700 ease-in-out ${
              isLogoPhase ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
          >
            <img
              src={SPRITE_FRAMES[currentFrameIndex]}
              onError={(e) => {
                if (e.currentTarget.src.endsWith(".webp")) {
                  e.currentTarget.src = e.currentTarget.src.replace(".webp", ".png");
                }
              }}
              alt="Sujud animation"
              className="absolute inset-0 w-full h-full object-contain rounded-none select-none"
            />
          </div>
        )}

        {/* Official Sujud Logo Phase (Emblem + SUJUD title) */}
        <div
          className={`absolute inset-0 w-full h-full flex flex-col items-center justify-center transition-opacity duration-700 ease-in-out ${
            isLogoPhase ? "opacity-100" : "opacity-0 pointer-events-none"
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
            className="w-full h-full object-contain rounded-none select-none"
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
