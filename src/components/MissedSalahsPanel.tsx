import React, { useMemo, useState } from "react";
import { FixedSizeList as List } from "react-window";
import {
  IonIcon,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
} from "@ionic/react";
import { swapVerticalOutline } from "ionicons/icons";
import { AutoSizer } from "react-virtualized";
import { SQLiteDBConnection } from "@capacitor-community/sqlite";

import {
  SalahByDateObjType,
  restructuredMissedSalahListProp,
  SalahNamesType,
  SalahRecordsArrayType,
} from "../types/types";
import { salahStatusColorsHexCodes } from "../utils/constants";
import { toggleDBConnection } from "../utils/dbUtils";
import { createLocalisedDate } from "../utils/helpers";

interface MissedSalahsPanelProps {
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>;
  setFetchedSalahData: React.Dispatch<React.SetStateAction<SalahRecordsArrayType>>;
  missedSalahList: SalahByDateObjType;
}

const MissedSalahsPanel: React.FC<MissedSalahsPanelProps> = ({
  dbConnection,
  setFetchedSalahData,
  missedSalahList,
}) => {
  const [isClickedItem, setIsClickedItem] = useState<string>();
  const [salahToShow, setSalahToShow] = useState<Exclude<SalahNamesType, "Asar"> | "All">("All");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const restructuredMissedSalahList = useMemo(() => {
    const list: restructuredMissedSalahListProp[] = [];

    const sortedArr = Object.fromEntries(
      Object.entries(missedSalahList).sort(([dateA], [dateB]) =>
        sortOrder === "newest" ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB),
      ),
    );

    for (let date in sortedArr) {
      sortedArr[date].forEach((item) => {
        if (
          salahToShow === "All" ||
          item === salahToShow ||
          (salahToShow === "Asr" && item === "Asar")
        ) {
          list.push({ [date]: item });
        }
      });
    }

    return list;
  }, [salahToShow, missedSalahList, sortOrder]);

  const modifySalahStatusInDB = async (date: string, salahName: SalahNamesType) => {
    const query = `UPDATE salahDataTable SET salahStatus = ?, updatedAt = ? WHERE date = ? AND salahName = ?`;
    const values = ["late", Date.now(), date, salahName];
    if (!dbConnection.current) {
      throw new Error("dbConnection.current does not exist");
    }
    await dbConnection.current.run(query, values);

    setTimeout(() => {
      setFetchedSalahData((prev) => {
        const copy = [...prev];
        for (let i = 0; i < prev.length; i++) {
          if (copy[i].date === date) {
            for (let salah in copy[i].salahs) {
              if (salah === salahName) {
                copy[i].salahs[salah] = "late";
              }
            }
          }
        }
        return copy;
      });
    }, 500);
  };

  const Row = ({
    index,
    style,
    data,
  }: {
    index: number;
    style: React.CSSProperties;
    data: restructuredMissedSalahListProp[];
  }) => {
    const item = data[index];
    const date = Object.keys(item)[0];
    const salah = Object.values(item)[0];
    const key = `${date}-${salah}`;

    return (
      <div
        style={{
          ...style,
          height: (style.height as number) - 12,
          top: (style.top as number) + 6,
        }}
        className="bg-[var(--card-bg-color)] px-4 rounded-2xl"
      >
        <div className="flex items-center justify-between text-[var(--ion-text-color)] py-3 border-b border-[var(--app-border-color)]">
          <p>{salah === "Asar" ? "Asr" : salah}</p>
          <div
            style={{
              backgroundColor:
                isClickedItem === key
                  ? salahStatusColorsHexCodes["late"]
                  : salahStatusColorsHexCodes["missed"],
              transition: "background-color 250ms ease",
            }}
            className="w-[1.3rem] h-[1.3rem] rounded-md"
          />
        </div>
        <div className="flex items-center justify-between text-[var(--ion-text-color)] py-3">
          <p className="text-sm opacity-80">{createLocalisedDate(date)[1]}</p>
          <button
            className="rounded-full bg-[var(--missed-salah-sheet-btn-color)]"
            onClick={async () => {
              setIsClickedItem(key);
              // Open DB connection before modifying just in case
              await toggleDBConnection(dbConnection, "open");
              await modifySalahStatusInDB(date, salah);
            }}
          >
            <section className="flex items-center justify-between w-full px-3 py-2 text-sm">
              <p>Mark As Done</p>
            </section>
          </button>
        </div>
      </div>
    );
  };

  return (
    <section className="mt-4 mb-4 text-[var(--ion-text-color)] flex flex-col h-full">
      <p className="mx-2 mb-4 text-center text-[var(--ion-text-color)]">
        You have{" "}
        <span className="text-[rgb(230,57,70)]">
          {restructuredMissedSalahList.length}{" "}
        </span>{" "}
        {salahToShow !== "All" ? salahToShow : ""} Salah to make up
      </p>

      <section className="px-4 mb-6 shrink-0">
        <IonSegment
          mode="ios"
          value={salahToShow}
          onIonChange={(e) => {
            const value = e.detail.value === "Asar" ? "Asr" : e.detail.value;
            setSalahToShow(value as Exclude<SalahNamesType, "Asar"> | "All");
          }}
        >
          <IonSegmentButton value="All">
            <IonLabel>All</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="Fajr">
            <IonLabel>Fajr</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="Dhuhr">
            <IonLabel>Dhuhr</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="Asr">
            <IonLabel>Asr</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="Maghrib">
            <IonLabel>Maghrib</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="Isha">
            <IonLabel>Isha</IonLabel>
          </IonSegmentButton>
        </IonSegment>
      </section>

      <section className="mx-4 border border-[var(--app-border-color)] rounded-lg mb-4 shrink-0">
        <IonSelect
          className="w-full px-2 pl-2 text-sm sort-select"
          value={sortOrder}
          labelPlacement="stacked"
          aria-label="Sort missed salahs"
          interface="popover"
          placeholder="Sort missed salahs"
          onIonChange={(e) => setSortOrder(e.detail.value)}
        >
          <IonIcon
            className="mr-[5px]"
            slot="start"
            icon={swapVerticalOutline}
            aria-hidden="true"
          />
          <IonSelectOption value="newest">Newest first</IonSelectOption>
          <IonSelectOption value="oldest">Oldest first</IonSelectOption>
        </IonSelect>
      </section>

      <div className="px-4 flex-1 min-h-0">
        <AutoSizer>
          {({ width, height }) => (
            <List
              height={height || 400}
              width={width}
              itemData={restructuredMissedSalahList}
              itemCount={restructuredMissedSalahList.length}
              itemSize={125}
            >
              {Row}
            </List>
          )}
        </AutoSizer>
      </div>
    </section>
  );
};

export default MissedSalahsPanel;
