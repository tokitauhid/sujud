import "react-virtualized/styles.css";
import { Column, Table, AutoSizer } from "react-virtualized";
import { motion, AnimatePresence } from "framer-motion";
import Joyride, { CallBackProps, Step } from "react-joyride";
import {
  HiOutlineChevronDoubleUp,
  HiChevronDoubleDown,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
} from "react-icons/hi2";

import {
  SalahNamesType,
  SalahByDateObjType,
  userPreferencesType,
} from "../../types/types";
import BottomSheetSalahStatus from "../BottomSheets/BottomSheetSalahStatus";

import { TbEdit } from "react-icons/tb";
import { SalahRecordsArrayType } from "../../types/types";
import {
  salahStatusColorsHexCodes,
  salahNamesArr,
} from "../../utils/constants";
import { SQLiteDBConnection } from "@capacitor-community/sqlite";
import { useEffect, useRef, useState } from "react";
import {
  createLocalisedDate,
} from "../../utils/helpers";

interface SalahTableProps {
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>;
  // setUserPreferences: React.Dispatch<React.SetStateAction<userPreferencesType>>;
  setShowJoyRideEditIcon: React.Dispatch<React.SetStateAction<boolean>>;
  showJoyRideEditIcon: boolean;
  setFetchedSalahData: React.Dispatch<
    React.SetStateAction<SalahRecordsArrayType>
  >;
  fetchedSalahData: SalahRecordsArrayType;
  userPreferences: userPreferencesType;
  setSelectedSalahAndDate: React.Dispatch<
    React.SetStateAction<SalahByDateObjType>
  >;
  selectedSalahAndDate: SalahByDateObjType;
  setIsMultiEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  isMultiEditMode: boolean;
  setShowUpdateStatusModal: React.Dispatch<React.SetStateAction<boolean>>;
  showUpdateStatusModal: boolean;
  generateStreaks: (fetchedSalahData: SalahRecordsArrayType) => void;
}

const SalahTable = ({
  dbConnection,
  // setUserPreferences,
  setShowJoyRideEditIcon,
  showJoyRideEditIcon,
  setFetchedSalahData,
  fetchedSalahData,
  userPreferences,
  setSelectedSalahAndDate,
  selectedSalahAndDate,
  setIsMultiEditMode,
  isMultiEditMode,
  setShowUpdateStatusModal,
  showUpdateStatusModal,
  generateStreaks,
}: SalahTableProps) => {
  const showBtnsRef = useRef<number | null>(null);
  const currentIndexRef = useRef(0);
  const hasMountedRef = useRef(false);

  const resetSelectedSalahAndDate = () => {
    setSelectedSalahAndDate({});
  };
  const [isScrolling, setIsScrolling] = useState(false);

  const tableRef = useRef<Table | null>(null);

  useEffect(() => {
    return () => {
      if (showBtnsRef.current) {
        clearTimeout(showBtnsRef.current);
      }
    };
  }, []);

  const hideButtons = (timeout: number) => {
    if (showBtnsRef.current) {
      clearTimeout(showBtnsRef.current);
    }

    setIsScrolling(true);

    showBtnsRef.current = window.setTimeout(() => {
      setIsScrolling(false);
    }, timeout);
    // }, 10000000000);
  };

  const handleTableCellClick = (
    salahName: SalahNamesType,
    rowDataDate: string,
  ) => {
    setSelectedSalahAndDate((prev) => {
      let newArr = { ...prev };

      if (prev[rowDataDate]?.includes(salahName)) {
        newArr[rowDataDate] = prev[rowDataDate].filter(
          (item) => item !== salahName,
        );

        if (newArr[rowDataDate].length === 0) {
          delete newArr[rowDataDate];
        }
      } else {
        newArr[rowDataDate] = prev[rowDataDate]
          ? [...prev[rowDataDate], salahName]
          : [salahName];
      }
      return newArr;
    });

    if (!isMultiEditMode) {
      setShowUpdateStatusModal(true);
    }
  };

  const handleToggleDay = (rowDataDate: string) => {
    setSelectedSalahAndDate((prev) => {
      const currentForDate = prev[rowDataDate] || [];
      const isAllSelected = salahNamesArr.every((salah) =>
        currentForDate.includes(salah),
      );
      const newObj = { ...prev };
      if (isAllSelected) {
        delete newObj[rowDataDate];
      } else {
        newObj[rowDataDate] = [...salahNamesArr];
      }
      return newObj;
    });
  };

  const joyRideonBoardingSteps: Step[] = [
    {
      target: ".multi-edit-icon",
      content:
        "Tap this icon to edit multiple Salah entries across different dates at once (provided they share the same status, reasons, and notes).",
      disableBeacon: true,
    },

    {
      target: ".single-table-cell",
      content:
        "Alternatively, you can update a Salah individually by tapping on a specific cell.",
      disableBeacon: true,
      placement: "center",
    },
  ];

  const handleJoyRide = async (data: CallBackProps) => {

    // await updateUserPrefs(
    //   dbConnection,
    //   "isExistingUser",
    //   "1",
    //   setUserPreferences,
    // );

    // if (data.action === "prev") {
    //   setMultiEditIconAnimation(true);
    // }

    if (data.status === "ready") {
      // console.log("JOYRIDE COMPLETE");

      setShowJoyRideEditIcon(false);

      // console.log("EXISTING USER FLAG CHANGED TO 1 IN DB");
    }
  };

  const totalSelected = Object.keys(selectedSalahAndDate).reduce(
    (acc, k) => acc + (selectedSalahAndDate[k]?.length || 0),
    0,
  );

  return (
    <section className="salah-table-wrap hide-scrollbar">
      <Joyride
        disableOverlay={false}
        disableOverlayClose={true}
        run={showJoyRideEditIcon}
        locale={{
          last: "Done",
          next: "Next",
          back: "Back",
        }}
        steps={joyRideonBoardingSteps}
        continuous
        disableScrolling={true}
        hideCloseButton={true}
        callback={handleJoyRide}
        styles={{
          options: {
            backgroundColor: "#1E1F24",
            arrowColor: "#F3F3F4",
            textColor: "#F3F3F4",
            zIndex: 10000,
          },
          buttonNext: {
            backgroundColor: "#B5876E",
            color: "#fff",
            borderRadius: "0px",
            padding: "8px 14px",
          },
          buttonBack: {
            backgroundColor: "#C84646",
            color: "#fff",
            borderRadius: "0px",
            padding: "8px 14px",
          },
        }}
      />
      <AnimatePresence>
        {isMultiEditMode && totalSelected > 0 && (
          <motion.div
            initial={{ x: "-50%", y: 20, opacity: 0 }}
            animate={{ x: "-50%", y: 0, opacity: 1 }}
            exit={{ x: "-50%", y: 20, opacity: 0 }}
            className="absolute bottom-2 left-1/2 z-20 flex items-center bg-[#141414] border border-[#2A2A2A] text-xs font-mono shadow-2xl divide-x divide-[#242424]"
          >
            <button
              className="px-2.5 py-1 text-[10px] text-[#8E8E93] hover:text-white transition-colors uppercase tracking-wider"
              onClick={() => {
                setIsMultiEditMode(false);
                resetSelectedSalahAndDate();
              }}
            >
              Cancel
            </button>
            <div className="px-2.5 py-1 text-[10px] text-[#A1A1AA] tabular-nums font-medium">
              <span className="text-white font-bold">{totalSelected}</span> selected
            </div>
            <button
              className="px-2 py-1 text-[10px] text-[#71717A] hover:text-white transition-colors uppercase tracking-wider"
              onClick={resetSelectedSalahAndDate}
              title="Clear selection"
            >
              Clear
            </button>
            <button
              className="px-3 py-1 bg-white text-black font-bold text-[10px] uppercase tracking-wider hover:bg-[#E4E4E7] active:bg-[#D4D4D8] transition-colors"
              onClick={() => {
                setShowUpdateStatusModal(true);
              }}
            >
              Update
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="h-[95%]">
        <AutoSizer>
          {({ height, width }) => (
            <Table
              ref={tableRef}
              onScroll={() => {
                if (!hasMountedRef.current) {
                  hasMountedRef.current = true;
                  return;
                }

                hideButtons(2000);
                // if (showBtnsRef.current) {
                //   clearTimeout(showBtnsRef.current);
                // }

                // setIsScrolling(true);

                // showBtnsRef.current = window.setTimeout(() => {
                //   setIsScrolling(false);
                // }, 1000);
              }}
              // scrollToAlignment="center"
              onRowsRendered={({ startIndex }) => {
                currentIndexRef.current = startIndex;
                // <setScrollIndex>(startIndex);
                console.log("ROW RENDERED");
                console.log("startIndex: ", startIndex);
                console.log("currentIndex: ", currentIndexRef.current);
              }}
              style={{
                textTransform: "none",
                fontSize: "3rem",
              }}
              className="text-center"
              rowCount={fetchedSalahData.length}
              rowGetter={({ index }) => fetchedSalahData[index]}
              rowHeight={48}
              headerHeight={40}
              height={height}
              width={width}
              scrollToAlignment="start"
            >
              <Column
                style={{ marginLeft: "0" }}
                // className="items-center text-left"
                className="text-left"
                label="DATE"
                dataKey="date"
                headerRenderer={() => (
                  <button
                    onClick={() => {
                      if (isMultiEditMode) {
                        setIsMultiEditMode(false);
                        resetSelectedSalahAndDate();
                      } else {
                        setIsMultiEditMode(true);
                      }
                    }}
                    className={`multi-edit-icon inline-flex items-center gap-1 text-[11px] font-mono tracking-wider transition-colors uppercase ${
                      isMultiEditMode
                        ? "text-white font-bold"
                        : "text-[#71717A] hover:text-white"
                    }`}
                    title={
                      isMultiEditMode
                        ? "Exit multi-select mode"
                        : "Enter multi-select mode"
                    }
                  >
                    <span>DATE</span>
                    <TbEdit
                      className={`text-xs transition-colors ${
                        isMultiEditMode ? "text-[#B5876E]" : "text-[#71717A]"
                      }`}
                    />
                  </button>
                )}
                cellRenderer={({ rowData }) => {
                  const [day, formattedParsedDate] = createLocalisedDate(
                    rowData.date,
                  );
                  const isAllDaySelected =
                    isMultiEditMode &&
                    salahNamesArr.every((s) =>
                      selectedSalahAndDate[rowData.date]?.includes(s),
                    );
                  const isSomeDaySelected =
                    isMultiEditMode &&
                    !isAllDaySelected &&
                    (selectedSalahAndDate[rowData.date]?.length ?? 0) > 0;

                  return (
                    <section
                      className={`py-0.5 leading-tight select-none transition-colors ${
                        isMultiEditMode
                          ? "cursor-pointer hover:opacity-80"
                          : ""
                      }`}
                      onClick={() => {
                        if (isMultiEditMode) {
                          handleToggleDay(rowData.date);
                        }
                      }}
                      title={
                        isMultiEditMode
                          ? "Click to toggle entire day"
                          : undefined
                      }
                    >
                      <div className="flex items-center gap-1.5">
                        {isMultiEditMode && (
                          <div
                            className={`w-2.5 h-2.5 rounded-none border flex items-center justify-center shrink-0 ${
                              isAllDaySelected
                                ? "bg-white border-white text-black"
                                : isSomeDaySelected
                                  ? "border-white bg-[#2A2A2A]"
                                  : "border-[#3F3F46] bg-transparent"
                            }`}
                          >
                            {isAllDaySelected ? (
                              <svg
                                className="w-2 h-2 text-black"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="4"
                                strokeLinecap="square"
                              >
                                <path d="M5 13l4 4L19 7" />
                              </svg>
                            ) : isSomeDaySelected ? (
                              <span className="w-1 h-1 bg-white"></span>
                            ) : null}
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-semibold text-white font-mono">
                            {formattedParsedDate}
                          </p>
                          <p className="text-[10px] text-[#71717A] uppercase font-mono tracking-wider">
                            {day}
                          </p>
                        </div>
                      </div>
                    </section>
                  );
                }}
                width={72}
                flexGrow={1}
              />
              {salahNamesArr.map((salahName) => (
                <Column
                  key={salahName}
                  style={{ marginLeft: "0" }}
                  className="items-center text-sm"
                  label={salahName === "Asar" ? "Asr" : salahName}
                  dataKey={""}
                  width={54}
                  flexGrow={1}
                  cellRenderer={({ rowData }) => {
                    let isChecked = selectedSalahAndDate[
                      rowData.date
                    ]?.includes(salahName)
                      ? true
                      : false;
                    return (
                      <section
                        className="cursor-pointer flex items-center justify-center relative w-full h-full"
                        onClick={() => {
                          handleTableCellClick(salahName, rowData.date);
                        }}
                      >
                        {rowData.salahs[salahName] === "" ? (
                          <div
                            className={`w-[1.45rem] h-[1.45rem] rounded-none border transition-all flex items-center justify-center ${
                              isChecked
                                ? "border-white ring-2 ring-white bg-[#2A2A2A] z-10"
                                : isMultiEditMode
                                  ? "border-[#3F3F46] bg-[#161616] hover:border-[#71717A]"
                                  : "border-[#262626] bg-[#161616] hover:border-[#3F3F46]"
                            } ${
                              showJoyRideEditIcon && salahName === "Asar"
                                ? "single-table-cell ring-1 ring-white"
                                : ""
                            }`}
                          >
                            {isChecked ? (
                              <svg
                                className="w-2.5 h-2.5 text-white"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3.5"
                                strokeLinecap="square"
                                strokeLinejoin="miter"
                              >
                                <path d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <span className="w-1 h-1 rounded-none bg-[#2A2A2A]"></span>
                            )}
                          </div>
                        ) : (
                          <div
                            style={{
                              backgroundColor:
                                salahStatusColorsHexCodes[
                                  rowData.salahs[
                                    salahName
                                  ] as keyof typeof salahStatusColorsHexCodes
                                ],
                            }}
                            className={`w-[1.45rem] h-[1.45rem] rounded-none border flex items-center justify-center transition-all relative ${
                              isChecked
                                ? "border-white ring-2 ring-white z-10"
                                : isMultiEditMode
                                  ? "border-[#3F3F46] opacity-80 hover:opacity-100"
                                  : "border-[#242424]"
                            }`}
                          >
                            {isChecked ? (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <svg
                                  className="w-2.5 h-2.5 text-white"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3.5"
                                  strokeLinecap="square"
                                  strokeLinejoin="miter"
                                >
                                  <path d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            ) : ["group", "male-alone", "female-alone"].includes(
                                rowData.salahs[salahName],
                              ) ? (
                              <svg
                                className="w-2.5 h-2.5 text-black"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                              </svg>
                            ) : rowData.salahs[salahName] === "late" ? (
                              <span className="w-1.5 h-1.5 rounded-none bg-black"></span>
                            ) : null}
                          </div>
                        )}
                      </section>
                    );
                  }}
                />
              ))}
            </Table>
          )}
        </AutoSizer>
      </div>
      {isScrolling && (
        <motion.div
          initial={{ x: "-50%", y: 20, opacity: 0 }}
          animate={{ x: "-50%", y: 0, opacity: 1 }}
          exit={{ x: "-50%", y: 20, opacity: 0 }}
          className={`absolute left-1/2 -translate-x-1/2 flex bg-[#161616] border rounded-none border-[#2A2A2A] py-1 px-3 gap-4 text-white font-mono text-[11px] z-30 ${
            isMultiEditMode && totalSelected > 0 ? "bottom-12" : "bottom-2"
          }`}
        >
          <div className="">
            <button
              aria-label="Jump up 1 year"
              color={"medium"}
              className="flex flex-col items-center text-xs whitespace-nowrap"
              onClick={() => {
                hideButtons(2000);

                const next = Math.max(currentIndexRef.current - 365, 0);

                currentIndexRef.current = next;
                tableRef.current?.scrollToRow(next);
              }}
            >
              <HiOutlineChevronDoubleUp className="mb-1 text-lg " />1 Year
            </button>
          </div>
          <button
            aria-label="Jump up 30 days"
            color={"medium"}
            className="flex flex-col items-center text-xs whitespace-nowrap"
            onClick={() => {
              hideButtons(2000);
              const next = Math.max(currentIndexRef.current - 30, 0);

              currentIndexRef.current = next;
              tableRef.current?.scrollToRow(next);
            }}
          >
            <HiOutlineChevronUp className="mb-1 text-lg " />
            30 Days
          </button>
          <button
            aria-label="Jump down 30 days"
            color={"medium"}
            className="flex flex-col items-center text-xs whitespace-nowrap"
            onClick={() => {
              hideButtons(2000);
              const next = Math.min(
                currentIndexRef.current + 30,
                fetchedSalahData.length - 1,
              );

              currentIndexRef.current = next;
              tableRef.current?.scrollToRow(next);
            }}
          >
            {" "}
            <HiOutlineChevronDown className="mb-1 text-lg " />
            30 Days
          </button>
          <button
            color={"medium"}
            aria-label="Jump down 1 year"
            className="flex flex-col items-center text-xs whitespace-nowrap"
            onClick={() => {
              hideButtons(2000);
              const next = Math.min(
                currentIndexRef.current + 365,
                fetchedSalahData.length - 1,
              );

              currentIndexRef.current = next;
              tableRef.current?.scrollToRow(next);
            }}
          >
            <HiChevronDoubleDown className="mb-1 text-lg " />1 Year
          </button>
        </motion.div>
      )}
      <BottomSheetSalahStatus
        setFetchedSalahData={setFetchedSalahData}
        fetchedSalahData={fetchedSalahData}
        userPreferences={userPreferences}
        setShowBoxAnimation={() => {}}
        selectedSalahAndDate={selectedSalahAndDate}
        resetSelectedSalahAndDate={resetSelectedSalahAndDate}
        setIsMultiEditMode={setIsMultiEditMode}
        isMultiEditMode={isMultiEditMode}
        dbConnection={dbConnection}
        setShowUpdateStatusModal={setShowUpdateStatusModal}
        showUpdateStatusModal={showUpdateStatusModal}
        generateStreaks={generateStreaks}
      />
    </section>
  );
};

export default SalahTable;
