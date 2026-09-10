import { useState, useEffect } from "react";
import { useFirebaseAuth } from "../../firebase/useFirebaseAuth";
import {
  getLastSyncTimestamp,
  pushLocalDataToCloud,
  pullCloudDataToLocal,
  getSyncDataCounts,
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
  IoSettingsOutline,
} from "react-icons/io5";
import { IonActionSheet, useIonAlert } from "@ionic/react";

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
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [presentAlert] = useIonAlert();

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

  // Refresh sync status when this component mounts (NOT a duplicate sync —
  // the actual initial sync is handled in App.tsx's useEffect).
  useEffect(() => {
    if (!user || isAuthLoading) return;

    const refreshStatus = async () => {
      try {
        const ts = await getLastSyncTimestamp(user.uid);
        setLastSynced(ts);
        setSyncStatus(ts ? "synced" : "idle");
      } catch (error) {
        console.error("Failed to refresh sync status:", error);
        setSyncStatus("error");
      }
    };

    refreshStatus();
  }, [user?.uid]);

  // seedSQLiteFromCloud is now imported from syncService

  const handleManualSync = async () => {
    if (!user) return;

    try {
      setSyncStatus("syncing");

      // Real-time listeners handle ongoing sync;
      // manual sync just refreshes local state from SQLite
      await fetchDataFromDB();

      const ts = await getLastSyncTimestamp(user.uid);
      setLastSynced(ts);
      setSyncStatus("synced");
      showToast("Data refreshed!", "short");
    } catch (error) {
      console.error("Manual refresh failed:", error);
      setSyncStatus("error");
      showToast("Refresh failed. Please try again.", "long");
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

  const handlePush = async () => {
    if (!user) return;
    try {
      setSyncStatus("syncing");
      await pushLocalDataToCloud(user.uid, dbConnection);
      const ts = await getLastSyncTimestamp(user.uid);
      setLastSynced(ts);
      setSyncStatus("synced");
      showToast("Pushed to cloud!", "short");
    } catch (error) {
      console.error("Push failed:", error);
      setSyncStatus("error");
      showToast("Push failed.", "long");
    }
  };

  const handlePull = async () => {
    if (!user) return;
    try {
      setSyncStatus("syncing");
      await pullCloudDataToLocal(user.uid, dbConnection);
      await fetchDataFromDB();
      const ts = await getLastSyncTimestamp(user.uid);
      setLastSynced(ts);
      setSyncStatus("synced");
      showToast("Pulled from cloud!", "short");
    } catch (error) {
      console.error("Pull failed:", error);
      setSyncStatus("error");
      showToast("Pull failed.", "long");
    }
  };

  const confirmOperation = async (operation: "push" | "pull") => {
    if (!user) return;
    setSyncStatus("syncing"); // Visual feedback while counting
    
    try {
      const counts = await getSyncDataCounts(user.uid, dbConnection);
      setSyncStatus("idle");

      const isPush = operation === "push";
      const header = isPush ? "Push local data?" : "Pull cloud data?";
      const message = isPush
        ? `This will replace your cloud data with the data currently stored on this device.<br><br><b>This device:</b><br>• ${counts.local.salahs} Salah records<br>• ${counts.local.locations} saved locations<br><br><b>Cloud currently:</b><br>• ${counts.cloud.salahs} Salah records<br>• ${counts.cloud.locations} saved locations<br><br>Cloud-only changes may be permanently lost.`
        : `This will replace the data on this device with your cloud data.<br><br><b>Cloud:</b><br>• ${counts.cloud.salahs} Salah records<br>• ${counts.cloud.locations} saved locations<br><br><b>This device currently:</b><br>• ${counts.local.salahs} Salah records<br>• ${counts.local.locations} saved locations<br><br>Local-only changes may be permanently lost.`;

      presentAlert({
        header,
        message,
        buttons: [
          { text: "Cancel", role: "cancel", cssClass: "text-gray-500" },
          {
            text: isPush ? "Push to Cloud" : "Pull from Cloud",
            role: "confirm",
            cssClass: "text-red-500 font-bold",
            handler: () => {
              isPush ? handlePush() : handlePull();
            },
          },
        ],
      });
    } catch (error) {
      console.error("Failed to get counts:", error);
      setSyncStatus("error");
      showToast("Failed to prepare sync. Please try again.", "long");
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
      <div className="mb-4 rounded-none overflow-hidden border border-[#242424] bg-[#121212] font-mono">
        <div
          className="flex items-center justify-between py-3 px-3.5 cursor-pointer hover:bg-[#161616] transition-colors"
          onClick={handleSignIn}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-none bg-[#181818] border border-[#242424] flex items-center justify-center">
              <FcGoogle className="text-base" />
            </div>
            <div>
              <p className="text-xs font-medium text-white tracking-wide">Sync Data (Google)</p>
              <p className="text-[11px] text-[#71717A] mt-0.5">
                Sign in to sync across devices
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- SIGNED IN STATE ---
  return (
    <div className="mb-4 rounded-none overflow-hidden border border-[#242424] bg-[#121212] font-mono">
      {/* User info row */}
      <div className="flex items-center justify-between py-3 px-3.5 border-b border-[#242424]">
        <div className="flex items-center gap-3">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              className="w-7 h-7 rounded-none"
              referrerPolicy="no-referrer"
            />
          ) : (
            <IoPersonCircleOutline className="text-2xl text-[#71717A]" />
          )}
          <div>
            <p className="text-xs font-medium text-white">{user.displayName || "User"}</p>
            <p className="text-[10px] text-[#71717A]">{user.email}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="p-1 rounded-none text-red-400 hover:text-red-300 transition-colors"
          aria-label="Sign out"
        >
          <IoLogOutOutline className="text-lg" />
        </button>
      </div>

      {/* Sync status row */}
      <div className="flex items-center justify-between py-3 px-3.5">
        <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={handleManualSync}>
          <div className="w-7 h-7 rounded-none bg-[#181818] border border-[#242424] flex items-center justify-center">
            {syncStatus === "syncing" && (
              <IoSyncOutline className="text-sm animate-spin text-white" />
            )}
            {syncStatus === "synced" && (
              <IoCloudDoneOutline className="text-sm text-[#10B981]" />
            )}
            {syncStatus === "error" && (
              <IoWarningOutline className="text-sm text-red-400" />
            )}
            {syncStatus === "idle" && (
              <IoCloudUploadOutline className="text-sm text-[#71717A]" />
            )}
          </div>
          <div>
            <p className="text-xs text-white">
              {syncStatus === "syncing"
                ? "Syncing..."
                : syncStatus === "error"
                  ? "Sync failed"
                  : "Connected & Live"}
            </p>
            <p className="text-[10px] text-[#71717A]">
              Last synced: {formatLastSynced(lastSynced)}
            </p>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowActionSheet(true);
          }}
          disabled={syncStatus === "syncing"}
          className="p-1.5 rounded-none text-[#71717A] hover:text-white transition-colors disabled:opacity-30"
          aria-label="Sync options"
        >
          <IoSettingsOutline className="text-base" />
        </button>
      </div>
      <IonActionSheet
        isOpen={showActionSheet}
        onDidDismiss={() => setShowActionSheet(false)}
        header="Sync options"
        subHeader="Warning: Push and Pull are overwrite operations. Use these only when you are sure which copy is correct."
        buttons={[
          {
            text: "↑ Push local data to cloud",
            handler: () => {
              confirmOperation("push");
            },
          },
          {
            text: "↓ Pull cloud data to this device",
            handler: () => {
              confirmOperation("pull");
            },
          },
          {
            text: "Cancel",
            role: "cancel",
            data: {
              action: "cancel",
            },
          },
        ]}
      />
    </div>
  );
};

export default CloudSyncSettings;
