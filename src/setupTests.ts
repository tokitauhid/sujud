import "@testing-library/jest-dom";
import React from "react";
import { vi } from "vitest";
import { MotionGlobalConfig } from "framer-motion";

MotionGlobalConfig.skipAnimations = true;

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock("@ionic/react", async () => {
  const original: any = await vi.importActual("@ionic/react");
  return {
    ...original,
    IonModal: ({ children }: any) =>
      React.createElement("div", null, children),
    useIonLoading: () => [
      vi.fn().mockResolvedValue(undefined),
      vi.fn().mockResolvedValue(undefined),
    ],
  };
});

vi.mock("./firebase/useFirebaseAuth", () => ({
  useFirebaseAuth: () => ({
    user: null,
    isAuthLoading: false,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  }),
}));
