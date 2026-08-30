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

  return (
    <>
      {nextSalahNameAndTime.nextSalah !== "dhuhr" && (
        <section className="p-4 rounded-lg bg-[var(--card-bg-color)]">
          {nextSalahNameAndTime.currentSalah !== "sunrise" && (
            <div>
              <p className="mb-1 text-lg text-center opacity-80">
                Current Salah
              </p>
              <p className="text-6xl font-bold text-center text-blue-500">
                {upperCaseFirstLetter(
                  nextSalahNameAndTime.currentSalah === "none"
                    ? "isha"
                    : nextSalahNameAndTime.currentSalah,
                )}
              </p>
            </div>
          )}
          <div
            className={`${nextSalahNameAndTime.currentSalah === "fajr" || nextSalahNameAndTime.currentSalah === "maghrib" ? "mt-3" : "mt-1"}`}
          >
            {nextSalahNameAndTime.hoursRemaining > 0 && (
              <p className="text-center opacity-90">
                {nextSalahNameAndTime.hoursRemaining === 1
                  ? `${nextSalahNameAndTime.hoursRemaining} hour ${nextSalahNameAndTime.minsRemaining === 0 ? "to go until" : ""}`
                  : `${nextSalahNameAndTime.hoursRemaining} hours ${nextSalahNameAndTime.minsRemaining === 0 ? "to go until" : ""}`}{" "}
              </p>
            )}
            {nextSalahNameAndTime.minsRemaining > 0 && (
              <p className="text-center opacity-90">
                {nextSalahNameAndTime.minsRemaining === 1
                  ? `${nextSalahNameAndTime.minsRemaining} minute to go until`
                  : `${nextSalahNameAndTime.minsRemaining} minutes to go until`}
              </p>
            )}
            <p className="mt-1 mb-2 text-2xl text-center">
              {upperCaseFirstLetter(nextSalahNameAndTime.nextSalah)}
            </p>
          </div>
        </section>
      )}
      {nextSalahNameAndTime.nextSalah === "dhuhr" &&
        nextSalahNameAndTime.currentSalah === "sunrise" && (
          <section className="p-4 rounded-lg bg-[var(--card-bg-color)]">
            <div>
              <p className="mb-1 text-lg text-center opacity-80">
                Upcoming Salah
              </p>
              <p className="text-6xl font-bold text-center">
                {upperCaseFirstLetter(nextSalahNameAndTime.nextSalah)}
              </p>
            </div>
            <div>
              {nextSalahNameAndTime.hoursRemaining > 0 && (
                <p className={`text-center opacity-90`}>
                  {nextSalahNameAndTime.hoursRemaining === 1
                    ? `${nextSalahNameAndTime.hoursRemaining} hour ${nextSalahNameAndTime.minsRemaining === 0 ? "to go" : ""}`
                    : `${nextSalahNameAndTime.hoursRemaining} hours ${nextSalahNameAndTime.minsRemaining === 0 ? "to go" : "and"}`}{" "}
                </p>
              )}
              {nextSalahNameAndTime.minsRemaining > 0 && (
                <p className="text-center opacity-90">
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
