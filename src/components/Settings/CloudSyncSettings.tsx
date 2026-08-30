import { useState, useEffect } from "react";
import { useFirebaseAuth } from "../../firebase/useFirebaseAuth";
import {
  getLastSyncTimestamp,
  performBidirectionalSync,
  SyncStatus,
} from "../../firebase/syncService";
import { showToast } from "../../utils/helpers";
import {
  SQLiteDBConnection,
  SQLiteConnection,
} from "@capacitor-community/sqlite";
import {
  userPreferencesType,
  LocationsDataObjTypeArr,
} from "../../types/types";
import { FcGoogle } from "react-icons/fc";
import {
  IoCloudDoneOutline,
  IoCloudUploadOutline,
  IoSyncOutline,
  IoWarningOutline,
  IoPersonCircleOutline,
  IoLogOutOutline,
} from "react-icons/io5";

interface CloudSyncSettingsProps {
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>;
  sqliteConnection: React.MutableRefObject<SQLiteConnection | undefined>;
  userPreferences: userPreferencesType;
  userLocations: LocationsDataObjTypeArr;
  fetchDataFromDB: (isDBImported?: boolean) => Promise<void>;
}

const CloudSyncSettings = ({
  dbConnection,
  sqliteConnection: _sqliteConnection,
  userPreferences: _userPreferences,
  userLocations: _userLocations,
  fetchDataFromDB,
}: CloudSyncSettingsProps) => {
  const { user, isAuthLoading, signInWithGoogle, signOut } = useFirebaseAuth();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  // Fetch last sync time on mount + when user changes
  useEffect(() => {
    if (user) {
      getLastSyncTimestamp(user.uid).then(setLastSynced);
    } else {
      setLastSynced(null);
    }
  }, [user]);

  /**
   * Handle the "Sign in with Google" flow.
   * After sign-in, checks if cloud data exists:
   * - If yes → pulls from cloud and seeds SQLite (new device)
   * - If no → pushes local data to cloud (first sign-in ever)
   */
  const handleSignIn = async () => {
    try {
      await signInWithGoogle();

      // After sign-in, the auth state listener will update `user`.
      // We need to wait a tick for it to propagate.
      // The actual sync will be triggered by the useEffect below.
    } catch (error) {
      console.error("Sign-in failed:", error);
      showToast("Sign-in failed. Please try again.", "long");
    }
  };

  // Trigger initial sync after successful sign-in
  useEffect(() => {
    if (!user || isAuthLoading) return;

    const initialSync = async () => {
      try {
        setSyncStatus("syncing");
        
        await performBidirectionalSync(user.uid, dbConnection);
        await fetchDataFromDB(true);

        const ts = await getLastSyncTimestamp(user.uid);
        setLastSynced(ts);
        setSyncStatus("synced");
      } catch (error) {
        console.error("Initial sync failed:", error);
        setSyncStatus("error");
      }
    };

    initialSync();
  }, [user?.uid]);

  // seedSQLiteFromCloud is now imported from syncService

  const handleManualSync = async () => {
    if (!user) return;

    try {
      setSyncStatus("syncing");

      await performBidirectionalSync(user.uid, dbConnection);
      await fetchDataFromDB(true);

      const ts = await getLastSyncTimestamp(user.uid);
      setLastSynced(ts);
      setSyncStatus("synced");
      showToast("Sync complete!", "short");
    } catch (error) {
      console.error("Manual sync failed:", error);
      setSyncStatus("error");
      showToast("Sync failed. Please try again.", "long");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setSyncStatus("idle");
      setLastSynced(null);
      showToast("Signed out", "short");
    } catch (error) {
      console.error("Sign-out failed:", error);
    }
  };

  const formatLastSynced = (date: Date | null): string => {
    if (!date) return "Never";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // --- SIGNED OUT STATE ---
  if (!user) {
    return (
      <div className="my-5 rounded-md overflow-hidden">
        <div
          className="flex items-center justify-between bg-[var(--card-bg-color)] mx-auto py-4 px-3 cursor-pointer active:opacity-80 transition-opacity"
          onClick={handleSignIn}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--card-bg-color)] border border-[var(--app-border-color)] flex items-center justify-center">
              <FcGoogle className="text-xl" />
            </div>
            <div>
              <p className="text-lg">Cloud Sync</p>
              <p className="text-[0.8rem] font-light opacity-70">
                Sign in with Google to sync your data across devices
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- SIGNED IN STATE ---
  return (
    <div className="my-5 rounded-md overflow-hidden">
      {/* User info row */}
      <div className="flex items-center justify-between bg-[var(--card-bg-color)] mx-auto py-3 px-3 border-b border-[var(--app-border-color)]">
        <div className="flex items-center gap-3">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              className="w-9 h-9 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <IoPersonCircleOutline className="text-3xl opacity-60" />
          )}
          <div>
            <p className="text-sm font-medium">{user.displayName || "User"}</p>
            <p className="text-[0.7rem] font-light opacity-60">{user.email}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="p-2 rounded-lg active:opacity-60 transition-opacity"
          aria-label="Sign out"
        >
          <IoLogOutOutline className="text-xl text-red-400" />
        </button>
      </div>

      {/* Sync status row */}
      <div
        className="flex items-center justify-between bg-[var(--card-bg-color)] mx-auto py-3 px-3 cursor-pointer active:opacity-80 transition-opacity"
        onClick={handleManualSync}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[var(--card-bg-color)] border border-[var(--app-border-color)] flex items-center justify-center">
            {syncStatus === "syncing" && (
              <IoSyncOutline className="text-lg text-blue-400 animate-spin" />
            )}
            {syncStatus === "synced" && (
              <IoCloudDoneOutline className="text-lg text-green-400" />
            )}
            {syncStatus === "error" && (
              <IoWarningOutline className="text-lg text-red-400" />
            )}
            {syncStatus === "idle" && (
              <IoCloudUploadOutline className="text-lg opacity-60" />
            )}
          </div>
          <div>
            <p className="text-sm">
              {syncStatus === "syncing"
                ? "Syncing..."
                : syncStatus === "error"
                  ? "Sync failed"
                  : "Sync now"}
            </p>
            <p className="text-[0.7rem] font-light opacity-60">
              Last synced: {formatLastSynced(lastSynced)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CloudSyncSettings;
