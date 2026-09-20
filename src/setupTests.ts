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

const createStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
};

Object.defineProperty(window, "localStorage", {
  value: createStorageMock(),
  writable: true,
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
  FirebaseAuthProvider: ({ children }: any) => children,
  useFirebaseAuth: () => ({
    user: null,
    isAuthLoading: false,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  }),
}));
