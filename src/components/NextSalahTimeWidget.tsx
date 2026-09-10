import React from "react";
import { LocationsDataObjTypeArr, nextSalahTimeType, userPreferencesType } from "../types/types";
import { upperCaseFirstLetter } from "../utils/helpers";

interface NextSalahTimeWidgetProps {
  userPreferences: userPreferencesType;
  userLocations: LocationsDataObjTypeArr;
  nextSalahNameAndTime: nextSalahTimeType;
}

const NextSalahTimeWidget: React.FC<NextSalahTimeWidgetProps> = ({
  userPreferences,
  userLocations,
  nextSalahNameAndTime,
}) => {
  if (userPreferences.prayerCalculationMethod === "" || userLocations?.length === 0) {
    return null;
  }

  const countdownStyle: React.CSSProperties = {
    fontFeatureSettings: "'tnum'",
    fontVariantNumeric: "tabular-nums",
  };

  return (
    <>
      {nextSalahNameAndTime.nextSalah !== "dhuhr" && (
        <section className="p-4 rounded-none bg-[#121212] border border-[#242424] font-mono">
          {nextSalahNameAndTime.currentSalah !== "sunrise" && (
            <div>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-none bg-[#10B981]" />
                <p className="text-[11px] font-bold tracking-widest uppercase text-[#10B981]">
                  CURRENT PRAYER
                </p>
              </div>
              <p className="text-4xl font-bold text-center text-white tracking-wide">
                {upperCaseFirstLetter(
                  nextSalahNameAndTime.currentSalah === "none"
                    ? "isha"
                    : nextSalahNameAndTime.currentSalah,
                )}
              </p>
            </div>
          )}
          <div
            className={`${nextSalahNameAndTime.currentSalah === "fajr" || nextSalahNameAndTime.currentSalah === "maghrib" ? "mt-4" : "mt-2"}`}
          >
            {nextSalahNameAndTime.hoursRemaining > 0 && (
              <p className="text-center opacity-80" style={countdownStyle}>
                {nextSalahNameAndTime.hoursRemaining === 1
                  ? `${nextSalahNameAndTime.hoursRemaining} hour ${nextSalahNameAndTime.minsRemaining === 0 ? "to go until" : ""}`
                  : `${nextSalahNameAndTime.hoursRemaining} hours ${nextSalahNameAndTime.minsRemaining === 0 ? "to go until" : ""}`}{" "}
              </p>
            )}
            {nextSalahNameAndTime.minsRemaining > 0 && (
              <p className="text-center opacity-80" style={countdownStyle}>
                {nextSalahNameAndTime.minsRemaining === 1
                  ? `${nextSalahNameAndTime.minsRemaining} minute to go until`
                  : `${nextSalahNameAndTime.minsRemaining} minutes to go until`}
              </p>
            )}
            <p className="mt-1 mb-2 text-2xl font-semibold text-center">
              {upperCaseFirstLetter(nextSalahNameAndTime.nextSalah)}
            </p>
          </div>
        </section>
      )}
      {nextSalahNameAndTime.nextSalah === "dhuhr" &&
        nextSalahNameAndTime.currentSalah === "sunrise" && (
          <section className="p-4 rounded-none bg-[#121212] border border-[#242424] font-mono">
            <div>
              <p className="mb-1 text-[11px] font-bold tracking-widest text-center uppercase text-[#71717A]">
                UPCOMING PRAYER
              </p>
              <p className="text-4xl font-bold text-center text-white tracking-wide">
                {upperCaseFirstLetter(nextSalahNameAndTime.nextSalah)}
              </p>
            </div>
            <div>
              {nextSalahNameAndTime.hoursRemaining > 0 && (
                <p className="text-center opacity-80" style={countdownStyle}>
                  {nextSalahNameAndTime.hoursRemaining === 1
                    ? `${nextSalahNameAndTime.hoursRemaining} hour ${nextSalahNameAndTime.minsRemaining === 0 ? "to go" : ""}`
                    : `${nextSalahNameAndTime.hoursRemaining} hours ${nextSalahNameAndTime.minsRemaining === 0 ? "to go" : "and"}`}{" "}
                </p>
              )}
              {nextSalahNameAndTime.minsRemaining > 0 && (
                <p className="text-center opacity-80" style={countdownStyle}>
                  {nextSalahNameAndTime.minsRemaining === 1
                    ? `${nextSalahNameAndTime.minsRemaining} minute to go`
                    : `${nextSalahNameAndTime.minsRemaining} minutes to go`}
                </p>
              )}
            </div>
          </section>
        )}
    </>
  );
};

export default NextSalahTimeWidget;
