import { useState, useEffect, useCallback } from "react";
import { useFirebaseAuth } from "../../firebase/useFirebaseAuth";
import {
  getLastSyncTimestamp,
  getLocalLastSyncTimestamp,
  performManualSync,
  pushLocalDataToCloud,
  pullCloudDataToLocal,
  getSyncDataCounts,
  subscribeSyncState,
  formatLastSynced,
  SyncStatus,
} from "../../firebase/syncService";
import { showToast } from "../../utils/helpers";
import { SQLiteDBConnection } from "@capacitor-community/sqlite";
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
import { IonActionSheet, useIonAlert, useIonViewWillEnter } from "@ionic/react";

interface CloudSyncSettingsProps {
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>;
  fetchDataFromDB: (isDBImported?: boolean) => Promise<void>;
  viewEnterCount?: number;
}

const CloudSyncSettings = ({
  dbConnection,
  fetchDataFromDB,
  viewEnterCount,
}: CloudSyncSettingsProps) => {
  const { user, signInWithGoogle, signOut } = useFirebaseAuth();
  const [lastSynced, setLastSynced] = useState<Date | null>(() => {
    return user ? getLocalLastSyncTimestamp(user.uid) : null;
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => {
    return user && getLocalLastSyncTimestamp(user.uid) ? "synced" : "idle";
  });
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [presentAlert] = useIonAlert();
  const [, setTick] = useState(0);

  // Sync state subscription & initial sync time fetch
  useEffect(() => {
    if (!user) {
      setLastSynced(null);
      setSyncStatus("idle");
      return;
    }

    const localTs = getLocalLastSyncTimestamp(user.uid);
    if (localTs) {
      setLastSynced(localTs);
      setSyncStatus("synced");
    }

    // Subscribe to any successful sync completion anywhere in the app
    const unsub = subscribeSyncState((event) => {
      setSyncStatus(event.status);
      if (event.lastSynced) {
        setLastSynced(event.lastSynced);
      }
    });

    // Check remote Firestore in background in case another device synced
    getLastSyncTimestamp(user.uid).then((ts) => {
      if (ts) {
        setLastSynced(ts);
        setSyncStatus("synced");
      }
    });

    return () => unsub();
  }, [user]);

  // Handle Ionic view re-entry when cached
  const refreshOnViewEnter = useCallback(() => {
    if (!user) return;
    const local = getLocalLastSyncTimestamp(user.uid);
    if (local) {
      setLastSynced(local);
    }
    getLastSyncTimestamp(user.uid).then((ts) => {
      if (ts) {
        setLastSynced(ts);
      }
    });
  }, [user]);

  useIonViewWillEnter(() => {
    refreshOnViewEnter();
  });

  useEffect(() => {
    if (viewEnterCount !== undefined && viewEnterCount > 0) {
      refreshOnViewEnter();
    }
  }, [viewEnterCount, refreshOnViewEnter]);

  // Dynamic live elapsed-time ticker (updates relative time display while remaining on Settings screen)
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  /**
   * Handle the "Sign in with Google" flow.
   * After sign-in, checks if cloud data exists:
   * - If yes → pulls from cloud and seeds SQLite (new device)
   * - If no → pushes local data to cloud (first sign-in ever)
   */
  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Sign-in failed:", error);
      showToast("Sign-in failed. Please try again.", "long");
    }
  };

  const handleManualSync = async () => {
    if (!user) return;

    try {
      setSyncStatus("syncing");

      await performManualSync(user.uid);
      await fetchDataFromDB();

      setSyncStatus("synced");
      showToast("Data refreshed!", "short");
    } catch (error) {
      console.error("Manual refresh failed:", error);
      setSyncStatus("error");
      showToast("Refresh failed. Please try again.", "long");
      // Note: lastSynced is preserved on error — never overwritten!
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



  // --- SIGNED OUT STATE ---
  if (!user) {
    return (
      <div className="mb-4 rounded-none overflow-hidden border border-[var(--app-border)] bg-[var(--app-card-bg)] font-mono">
        <div
          className="flex items-center justify-between py-3 px-3.5 cursor-pointer hover:bg-[var(--app-surface-hover)] transition-colors"
          onClick={handleSignIn}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-none bg-[var(--app-surface)] border border-[var(--app-border)] flex items-center justify-center">
              <FcGoogle className="text-base" />
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--text-primary)] tracking-wide">Sync Data (Google)</p>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
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
    <div className="mb-4 rounded-none overflow-hidden border border-[var(--app-border)] bg-[var(--app-card-bg)] font-mono">
      {/* User info row */}
      <div className="flex items-center justify-between py-3 px-3.5 border-b border-[var(--app-border)]">
        <div className="flex items-center gap-3">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              className="w-7 h-7 rounded-none"
              referrerPolicy="no-referrer"
            />
          ) : (
            <IoPersonCircleOutline className="text-2xl text-[var(--text-secondary)]" />
          )}
          <div>
            <p className="text-xs font-medium text-[var(--text-primary)]">{user.displayName || "User"}</p>
            <p className="text-[10px] text-[var(--text-secondary)]">{user.email}</p>
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
          <div className="w-7 h-7 rounded-none bg-[var(--app-surface)] border border-[var(--app-border)] flex items-center justify-center">
            {syncStatus === "syncing" && (
              <IoSyncOutline className="text-sm animate-spin text-[var(--text-primary)]" />
            )}
            {syncStatus === "synced" && (
              <IoCloudDoneOutline className="text-sm text-[#10B981]" />
            )}
            {syncStatus === "error" && (
              <IoWarningOutline className="text-sm text-red-400" />
            )}
            {syncStatus === "idle" && (
              <IoCloudUploadOutline className="text-sm text-[var(--text-muted)]" />
            )}
          </div>
          <div>
            <p className="text-xs text-[var(--text-primary)]">
              {syncStatus === "syncing"
                ? "Syncing..."
                : syncStatus === "error"
                  ? "Sync failed"
                  : "Connected & Live"}
            </p>
            <p className="text-[10px] text-[var(--text-secondary)]">
              {formatLastSynced(lastSynced)}
            </p>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowActionSheet(true);
          }}
          disabled={syncStatus === "syncing"}
          className="p-1.5 rounded-none text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-30"
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
