import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import CloudSyncSettings from "./CloudSyncSettings";
import * as syncService from "../../firebase/syncService";

// Mock useFirebaseAuth
const mockUser = {
  uid: "test-user-123",
  displayName: "Test User",
  email: "test@example.com",
  photoURL: null,
};

let currentAuthUser: any = mockUser;

vi.mock("../../firebase/useFirebaseAuth", () => ({
  useFirebaseAuth: () => ({
    user: currentAuthUser,
    isAuthLoading: false,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock("../../utils/helpers", () => ({
  showToast: vi.fn(),
}));

vi.mock("@ionic/react", () => ({
  IonActionSheet: () => <div data-testid="ion-action-sheet" />,
  useIonAlert: () => [vi.fn()],
  useIonViewWillEnter: (cb: () => void) => {
    // In test environment, callback is available if needed
  },
}));

describe("CloudSyncSettings UI and state-tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    currentAuthUser = mockUser;
  });

  it("displays 'Never synced' when user has never synced before", async () => {
    const mockDbConnection: any = { current: {} };
    const mockFetchData = vi.fn().mockResolvedValue(undefined);

    render(
      <CloudSyncSettings
        dbConnection={mockDbConnection}
        fetchDataFromDB={mockFetchData}
      />
    );

    expect(screen.getByText("Connected & Live")).toBeInTheDocument();
    expect(screen.getByText("Never synced")).toBeInTheDocument();
  });

  it("immediately displays stored timestamp from previous session without waiting for network", () => {
    const previousTime = new Date(Date.now() - 5 * 60000); // 5 min ago
    localStorage.setItem("lastSyncedAt_test-user-123", previousTime.toISOString());

    const mockDbConnection: any = { current: {} };
    const mockFetchData = vi.fn().mockResolvedValue(undefined);

    render(
      <CloudSyncSettings
        dbConnection={mockDbConnection}
        fetchDataFromDB={mockFetchData}
      />
    );

    expect(screen.getByText("Synced 5 minutes ago")).toBeInTheDocument();
  });

  it("updates immediately when a background sync succeeds via subscription without leaving screen", async () => {
    const mockDbConnection: any = { current: {} };
    const mockFetchData = vi.fn().mockResolvedValue(undefined);

    render(
      <CloudSyncSettings
        dbConnection={mockDbConnection}
        fetchDataFromDB={mockFetchData}
      />
    );

    expect(screen.getByText("Never synced")).toBeInTheDocument();

    // Trigger sync success event (e.g. from background listener or salah log)
    const now = new Date();
    act(() => {
      syncService.recordSyncSuccess("test-user-123", now);
    });

    await waitFor(() => {
      expect(screen.getByText("Synced just now")).toBeInTheDocument();
    });
  });

  it("manual sync updates timestamp to 'Synced just now' immediately", async () => {
    const mockDbConnection: any = { current: {} };
    const mockFetchData = vi.fn().mockResolvedValue(undefined);

    // Mock performManualSync to succeed
    const newSyncTime = new Date();
    vi.spyOn(syncService, "performManualSync").mockImplementation(async (userId) => {
      syncService.recordSyncSuccess(userId, newSyncTime);
      return newSyncTime;
    });

    render(
      <CloudSyncSettings
        dbConnection={mockDbConnection}
        fetchDataFromDB={mockFetchData}
      />
    );

    // Click the sync row
    const syncRow = screen.getByText("Never synced").closest("div");
    fireEvent.click(syncRow!);

    await waitFor(() => {
      expect(screen.getByText("Synced just now")).toBeInTheDocument();
    });
  });

  it("failed sync preserves previous timestamp and displays 'Sync failed'", async () => {
    const previousTime = new Date(Date.now() - 10 * 60000); // 10 min ago
    localStorage.setItem("lastSyncedAt_test-user-123", previousTime.toISOString());

    const mockDbConnection: any = { current: {} };
    const mockFetchData = vi.fn().mockResolvedValue(undefined);

    // Mock performManualSync to throw
    vi.spyOn(syncService, "performManualSync").mockRejectedValue(new Error("Network failed"));

    render(
      <CloudSyncSettings
        dbConnection={mockDbConnection}
        fetchDataFromDB={mockFetchData}
      />
    );

    expect(screen.getByText("Synced 10 minutes ago")).toBeInTheDocument();

    // Click manual sync
    const syncRow = screen.getByText("Synced 10 minutes ago").closest("div");
    fireEvent.click(syncRow!);

    await waitFor(() => {
      expect(screen.getByText("Sync failed")).toBeInTheDocument();
      // Previous timestamp is retained!
      expect(screen.getByText("Synced 10 minutes ago")).toBeInTheDocument();
    });
  });

  it("refreshes timestamp when re-entering view via viewEnterCount", async () => {
    const mockDbConnection: any = { current: {} };
    const mockFetchData = vi.fn().mockResolvedValue(undefined);

    const { rerender } = render(
      <CloudSyncSettings
        dbConnection={mockDbConnection}
        fetchDataFromDB={mockFetchData}
        viewEnterCount={0}
      />
    );

    expect(screen.getByText("Never synced")).toBeInTheDocument();

    // Simulate background write to localStorage while user was on another tab
    const newTime = new Date();
    localStorage.setItem("lastSyncedAt_test-user-123", newTime.toISOString());

    // User returns to Settings tab
    rerender(
      <CloudSyncSettings
        dbConnection={mockDbConnection}
        fetchDataFromDB={mockFetchData}
        viewEnterCount={1}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Synced just now")).toBeInTheDocument();
    });
  });
});
