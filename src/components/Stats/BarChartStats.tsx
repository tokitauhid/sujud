import React, { useMemo } from "react";
import { format, subDays } from "date-fns";
import { SalahRecordsArrayType, SalahNamesType } from "../../types/types";

interface BarChartStatsProps {
  fetchedSalahData: SalahRecordsArrayType;
  activeStreakCount: number;
  statsToShow: Exclude<SalahNamesType, "Asar"> | "All";
}

interface DayData {
  dateStr: string;
  dayLabel: string;
  completed: number;
  total: number;
  percentage: number;
  missed: number;
}

const prayerKeys: ("Fajr" | "Dhuhr" | "Asar" | "Maghrib" | "Isha")[] = [
  "Fajr",
  "Dhuhr",
  "Asar",
  "Maghrib",
  "Isha",
];

export const BarChartStats: React.FC<BarChartStatsProps> = ({
  fetchedSalahData,
  activeStreakCount,
  statsToShow,
}) => {
  // Compute last 7 days data
  const { days, averagePercentage, totalMissed, totalOnTime, totalExpected } =
    useMemo(() => {
      const dataDict = new Map<string, (typeof fetchedSalahData)[0]>();
      fetchedSalahData.forEach((record) => {
        dataDict.set(record.date, record);
      });

      const today = new Date();
      const last7Days: DayData[] = [];

      for (let i = 6; i >= 0; i--) {
        const d = subDays(today, i);
        const dateStr = format(d, "yyyy-MM-dd");
        const dayLabel = format(d, "EEEEE"); // 'M', 'T', 'W', etc.

        const record = dataDict.get(dateStr);
        let completed = 0;
        let missed = 0;
        let total = 0;

        if (statsToShow === "All") {
          total = 5;
          if (record) {
            prayerKeys.forEach((pKey) => {
              const status = record.salahs[pKey];
              if (
                status === "group" ||
                status === "male-alone" ||
                status === "female-alone" ||
                status === "excused"
              ) {
                completed++;
              } else if (status === "late") {
                completed++; // Prayed, though late
              } else if (status === "missed") {
                missed++;
              }
            });
          }
        } else {
          total = 1;
          const targetKey =
            statsToShow === "Asr" ? "Asar" : (statsToShow as (typeof prayerKeys)[0]);
          if (record) {
            const status = record.salahs[targetKey];
            if (
              status === "group" ||
              status === "male-alone" ||
              status === "female-alone" ||
              status === "excused" ||
              status === "late"
            ) {
              completed++;
            } else if (status === "missed") {
              missed++;
            }
          }
        }

        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

        last7Days.push({
          dateStr,
          dayLabel,
          completed,
          total,
          percentage,
          missed,
        });
      }

      const sumPercent = last7Days.reduce((acc, d) => acc + d.percentage, 0);
      const avg = Math.round(sumPercent / last7Days.length);
      const sumMissed = last7Days.reduce((acc, d) => acc + d.missed, 0);
      const sumOnTime = last7Days.reduce((acc, d) => acc + d.completed, 0);
      const sumExpected = last7Days.reduce((acc, d) => acc + d.total, 0);

      return {
        days: last7Days,
        averagePercentage: avg,
        totalMissed: sumMissed,
        totalOnTime: sumOnTime,
        totalExpected: sumExpected,
      };
    }, [fetchedSalahData, statsToShow]);

  return (
    <div className="w-full bg-[#121212] border border-[#242424] rounded-none p-4 text-white font-mono">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-xs font-bold tracking-wider uppercase text-white">
          PROGRESS STATS
        </h2>
        <p className="text-[11px] text-[#71717A]">
          Prayer Consistency — Last 7 Days
        </p>
      </div>

      {/* Clean Unstyled Bar Chart */}
      <div className="relative pt-2 pb-4">
        {/* Y Axis Grid Lines & Labels */}
        <div className="flex h-44 w-full">
          {/* Y Axis Labels */}
          <div className="flex flex-col justify-between pr-2 text-[10px] text-[#71717A] select-none text-right w-10">
            <span>100%</span>
            <span>80%</span>
            <span>60%</span>
            <span>40%</span>
            <span>20%</span>
            <span>0%</span>
          </div>

          {/* Chart Area */}
          <div className="relative flex-1 flex items-end justify-between border-l border-b border-[#242424] pl-2 pr-1">
            {/* Horizontal Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-40">
              <div className="border-b border-[#242424] w-full"></div>
              <div className="border-b border-[#242424] w-full"></div>
              <div className="border-b border-[#242424] w-full"></div>
              <div className="border-b border-[#242424] w-full"></div>
              <div className="border-b border-[#242424] w-full"></div>
              <div className="w-full"></div>
            </div>

            {/* Bars */}
            {days.map((day, idx) => (
              <div
                key={day.dateStr + idx}
                className="relative z-10 flex flex-col items-center flex-1 h-full justify-end group px-0.5"
              >
                {/* Value on top of bar */}
                <span className="text-[9px] text-[#A1A1AA] mb-1 font-mono tabular-nums leading-none">
                  {day.percentage}%
                </span>

                {/* Vertical Bar */}
                <div
                  style={{ height: `${Math.max(day.percentage, 2)}%` }}
                  className="w-full max-w-[24px] bg-white rounded-none transition-all duration-300 group-hover:bg-[#E4E4E7]"
                />
              </div>
            ))}
          </div>
        </div>

        {/* X Axis Labels */}
        <div className="flex w-full pl-12 pr-1 pt-2">
          {days.map((day, idx) => (
            <div
              key={"label-" + day.dateStr + idx}
              className="flex-1 text-center text-xs font-semibold text-[#8E8E93] font-mono uppercase"
            >
              {day.dayLabel}
            </div>
          ))}
        </div>
      </div>

      {/* High-Density Data Summary Table */}
      <div className="mt-4 border-t border-[#242424] pt-1 text-xs">
        <div className="flex justify-between py-2 border-b border-[#242424]">
          <span className="text-[#8E8E93]">Average:</span>
          <span className="text-white font-bold tabular-nums">
            {averagePercentage}%
          </span>
        </div>
        <div className="flex justify-between py-2 border-b border-[#242424]">
          <span className="text-[#8E8E93]">Missed:</span>
          <span className="text-white font-bold tabular-nums">
            {totalMissed}
          </span>
        </div>
        <div className="flex justify-between py-2 border-b border-[#242424]">
          <span className="text-[#8E8E93]">On Time:</span>
          <span className="text-white font-bold tabular-nums">
            {totalOnTime}/{totalExpected}
          </span>
        </div>
        <div className="flex justify-between py-2">
          <span className="text-[#8E8E93]">Active Streak:</span>
          <span className="text-[#CC9374] font-bold tabular-nums">
            {activeStreakCount} {activeStreakCount === 1 ? "day" : "days"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default BarChartStats;
