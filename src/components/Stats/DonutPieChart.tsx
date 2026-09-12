import { useState } from "react";
import { salahStatusColorsHexCodes } from "../../utils/constants";
import { PieChart } from "react-minimal-pie-chart";

const DonutPieChart = ({
  donutPieChartData,
  salahStatusStatistics,
  userGender,
}: {
  salahStatusStatistics: {
    salahInGroupDatesOverall: number;
    salahMaleAloneDatesOverall: number;
    salahFemaleAloneDatesOverall: number;
    salahExcusedDatesOverall: number;
    salahMissedDatesOverall: number;
    salahLateDatesOverall: number;
  };
  donutPieChartData: { title: string; value: number; color: string }[];
  userGender: string;
}) => {
  const [toggleValues, setToggleValues] = useState<"percentage" | "amount">(
    "amount"
  );

  return (
    <div className="flex w-full h-full min-h-[320px] justify-around items-center donut-pie-chart-wrapper bg-[var(--app-card-bg)] border border-[var(--app-border)] rounded-none p-4 font-mono text-white">
      <section
        className="w-1/2 max-w-[210px] max-h-[210px] my-auto flex items-center justify-center cursor-pointer"
        onClick={() => {
          setToggleValues(toggleValues === "amount" ? "percentage" : "amount");
        }}
      >
        <div className="w-full max-w-[200px] aspect-square">
          <PieChart
            // animate={true}
            rounded={false}
            lineWidth={30}
          label={({ dataEntry }) => {
            if (dataEntry.value === 0) return;
            return toggleValues === "percentage"
              ? `${dataEntry.percentage.toFixed(1)}%`
              : `${Math.round(dataEntry.value)}`;
          }}
          labelStyle={(index) => ({
            fontSize: "6px",
            fill: donutPieChartData[index].color,
          })}
          labelPosition={55}
          data={donutPieChartData}
        />
        </div>
      </section>
      <div className="justify-center">
        {salahStatusStatistics.salahFemaleAloneDatesOverall > 0 ||
        salahStatusStatistics.salahInGroupDatesOverall > 0 ? (
          <p
            style={
              {
                "--group-color": salahStatusColorsHexCodes.group,
              } as React.CSSProperties
            }
            className="donut-pie-chart-text pb-1 text-sm before:bg-[var(--group-color)] font-medium flex items-center gap-1.5"
          >
            <span>{userGender === "male" ? "In Jamaah" : "Prayed"}</span>
          </p>
        ) : null}

        {salahStatusStatistics.salahExcusedDatesOverall > 0 ||
        salahStatusStatistics.salahMaleAloneDatesOverall > 0 ? (
          userGender === "male" ? (
            <p
              style={
                {
                  "--male-alone-color": salahStatusColorsHexCodes["male-alone"],
                } as React.CSSProperties
              }
              className="donut-pie-chart-text pb-1 text-sm before:bg-[var(--male-alone-color)] text-[#94A3B8]"
            >
              Alone
            </p>
          ) : (
            <p
              style={
                {
                  "--excused-color": salahStatusColorsHexCodes.excused,
                } as React.CSSProperties
              }
              className="donut-pie-chart-text pb-1 text-sm before:bg-[var(--excused-color)]"
            >
              Excused
            </p>
          )
        ) : null}

        {salahStatusStatistics.salahLateDatesOverall > 0 && (
          <p
            style={
              {
                "--late-color": salahStatusColorsHexCodes.late,
              } as React.CSSProperties
            }
            className="donut-pie-chart-text pb-1 text-sm before:bg-[var(--late-color)]"
          >
            Late
          </p>
        )}
        {salahStatusStatistics.salahMissedDatesOverall > 0 && (
          <p
            style={
              {
                "--missed-color": salahStatusColorsHexCodes.missed,
              } as React.CSSProperties
            }
            className="donut-pie-chart-text pb-1 text-sm before:bg-[var(--missed-color)]"
          >
            Missed
          </p>
        )}
      </div>
    </div>
  );
};

export default DonutPieChart;
