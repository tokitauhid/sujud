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
  showAlert,
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
            borderRadius: "8px",
            padding: "8px 14px",
          },
          buttonBack: {
            backgroundColor: "#C84646",
            color: "#fff",
            borderRadius: "8px",
            padding: "8px 14px",
          },
        }}
      />
      <AnimatePresence>
        {isMultiEditMode && (
          <motion.section
            initial={{ x: "-50%", y: 40, opacity: 0 }}
            animate={{ y: "-12vh", opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className="absolute bottom-0 z-20 flex items-center text-xs text-white border border-[#2A2A2A] transform -translate-x-1/2 rounded-[4px] bg-[#161616] left-1/2 font-mono"
          >
            <button
              className="py-2.5 px-4 text-[#8E8E93] hover:text-white border-r border-[#2A2A2A] transition-colors"
              onClick={() => {
                setIsMultiEditMode(false);
                resetSelectedSalahAndDate();
              }}
            >
              Cancel
            </button>
            <button
              className="py-2.5 px-4 text-white font-bold hover:bg-[#222222] transition-colors"
              onClick={() => {
                const dateArrLength = Object.keys(selectedSalahAndDate).length;
                dateArrLength > 0
                  ? setShowUpdateStatusModal(true)
                  : showAlert(
                      "No Salah Selected",
                      "Please select at least one Salah",
                    );
              }}
            >
              Update ({Object.keys(selectedSalahAndDate).reduce((acc, k) => acc + (selectedSalahAndDate[k]?.length || 0), 0)})
            </button>
          </motion.section>
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
              rowHeight={100}
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
                      if (isMultiEditMode) return;
                      setIsMultiEditMode(true);
                    }}
                    className="p-1.5 rounded-[3px] border border-[#242424] bg-[#161616] hover:border-[#3F3F46] text-[#8E8E93] hover:text-white transition-colors"
                    title="Toggle multi-select mode"
                  >
                    <TbEdit className="text-sm" />
                  </button>
                )}
                cellRenderer={({ rowData }) => {
                  const [day, formattedParsedDate] = createLocalisedDate(
                    rowData.date,
                  );

                  return (
                    <section className="py-0.5 leading-tight">
                      <p className="text-xs font-semibold text-white font-mono">{formattedParsedDate}</p>
                      <p className="text-[10px] text-[#71717A] uppercase font-mono tracking-wider">{day}</p>
                    </section>
                  );
                }}
                width={160}
                flexGrow={1}
              />
              {salahNamesArr.map((salahName) => (
                <Column
                  key={salahName}
                  style={{ marginLeft: "0" }}
                  className="items-center text-sm"
                  label={salahName === "Asar" ? "Asr" : salahName}
                  dataKey={""}
                  width={120}
                  flexGrow={1}
                  cellRenderer={({ rowData }) => {
                    let isChecked = selectedSalahAndDate[
                      rowData.date
                    ]?.includes(salahName)
                      ? true
                      : false;
                    return (
                      <section
                        className="cursor-pointer flex items-center justify-center"
                        onClick={() => {
                          if (isMultiEditMode) return;
                          handleTableCellClick(salahName, rowData.date);
                        }}
                      >
                        {rowData.salahs[salahName] === "" ? (
                          <div
                            className={`w-[1.45rem] h-[1.45rem] rounded-[2px] border border-[#262626] bg-[#161616] flex items-center justify-center hover:border-[#3F3F46] transition-colors ${
                              showJoyRideEditIcon && salahName === "Asar"
                                ? "single-table-cell ring-1 ring-white"
                                : ""
                            }`}
                          >
                            <span className="w-1 h-1 rounded-full bg-[#2A2A2A]"></span>
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
                            className="w-[1.45rem] h-[1.45rem] rounded-[2px] border border-[#242424] flex items-center justify-center transition-all"
                          >
                            {["group", "male-alone", "female-alone"].includes(rowData.salahs[salahName]) ? (
                              <svg className="w-2.5 h-2.5 text-black" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                              </svg>
                            ) : rowData.salahs[salahName] === "late" ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
                            ) : null}
                          </div>
                        )}
                        <AnimatePresence>
                          {isMultiEditMode && (
                            <motion.div
                              className="checkbox-wrap"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                            >
                              <label className="p-4 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    handleTableCellClick(
                                      salahName,
                                      rowData.date,
                                    );
                                  }}
                                />
                              </label>
                            </motion.div>
                          )}
                        </AnimatePresence>
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
          initial={{ x: "-50%", y: 40, opacity: 0 }}
          animate={{ y: "-3vh", opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          className="absolute left-1/2 bottom-0 -translate-x-1/2 flex bg-[#161616] border rounded-[4px] border-[#2A2A2A] py-1 px-3 gap-4 text-white font-mono text-[11px]"
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
