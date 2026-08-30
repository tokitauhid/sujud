import { SalahByDateObjType, SalahRecordsArrayType } from "../../types/types";
import { SQLiteDBConnection } from "@capacitor-community/sqlite";
import { useEffect } from "react";
import { IonButton, IonButtons, IonContent, IonHeader, IonModal, IonTitle, IonToolbar } from "@ionic/react";
import { toggleDBConnection } from "../../utils/dbUtils";
import MissedSalahsPanel from "../MissedSalahsPanel";

interface MissedSalahsListBottomSheetProps {
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>;
  setFetchedSalahData: React.Dispatch<React.SetStateAction<SalahRecordsArrayType>>;
  setShowMissedSalahsSheet: React.Dispatch<React.SetStateAction<boolean>>;
  showMissedSalahsSheet: boolean;
  missedSalahList: SalahByDateObjType;
}

const MissedSalahsListBottomSheet = ({
  dbConnection,
  setFetchedSalahData,
  setShowMissedSalahsSheet,
  showMissedSalahsSheet,
  missedSalahList,
}: MissedSalahsListBottomSheetProps) => {
  useEffect(() => {
    if (!showMissedSalahsSheet) return;

    const openDBConnection = async () => {
      await toggleDBConnection(dbConnection, "open");
    };

    const closeDBConnection = async () => {
      await toggleDBConnection(dbConnection, "close");
    };

    openDBConnection();

    return () => {
      closeDBConnection();
    };
  }, [showMissedSalahsSheet, dbConnection]);

  return (
    <IonModal
      mode="ios"
      isOpen={showMissedSalahsSheet}
      onDidDismiss={() => {
        setShowMissedSalahsSheet(false);
      }}
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle>Missed Salah</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => setShowMissedSalahsSheet(false)}>
              Close
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent scrollY={false} className="relative">
        <MissedSalahsPanel
          dbConnection={dbConnection}
          setFetchedSalahData={setFetchedSalahData}
          missedSalahList={missedSalahList}
        />
      </IonContent>
    </IonModal>
  );
};

export default MissedSalahsListBottomSheet;
