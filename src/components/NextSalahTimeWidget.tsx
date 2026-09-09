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
        <section className="p-5 rounded-2xl bg-[var(--card-bg-color)] border border-[var(--app-border-color)]">
          {nextSalahNameAndTime.currentSalah !== "sunrise" && (
            <div>
              <p className="mb-1 text-xs font-semibold tracking-widest text-center uppercase opacity-60">
                Current Prayer
              </p>
              <p className="text-5xl font-bold text-center text-[var(--accent-color)]">
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
          <section className="p-5 rounded-2xl bg-[var(--card-bg-color)] border border-[var(--app-border-color)]">
            <div>
              <p className="mb-1 text-xs font-semibold tracking-widest text-center uppercase opacity-60">
                Upcoming Prayer
              </p>
              <p className="text-5xl font-bold text-center text-[var(--accent-color)]">
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
