import React, { useMemo } from "react";
import { format, subDays } from "date-fns";
import { SalahRecordsArrayType, SalahNamesType } from "../../types/types";

interface BarChartStatsProps {
  fetchedSalahData: SalahRecordsArrayType;
  activeStreakCount: number;
  statsToShow: Exclude<SalahNamesType, "Asar"> | "All";
}

interface PrayerSection {
  name: "Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha";
  status: string;
  colorClass: string;
  label: string;
}

interface DayData {
  dateStr: string;
  dayLabel: string;
  completed: number;
  total: number;
  percentage: number;
  missed: number;
  inJamaah: number;
  sections: PrayerSection[];
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
  const { days, averagePercentage, totalMissed, totalOnTime, totalExpected, totalInJamaah } =
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
        let inJamaah = 0;

        const sections: PrayerSection[] = prayerKeys.map((pKey) => {
          const status = record?.salahs?.[pKey] || "";
          let colorClass = "bg-[#161922] border border-[#232936]/40";
          let label = "Not logged";

          if (status === "group") {
            colorClass = "bg-[#F59E0B] shadow-[0_0_6px_rgba(245,158,11,0.35)]";
            label = "In Jamaah";
          } else if (status === "male-alone" || status === "female-alone") {
            colorClass = "bg-[#38BDF8] shadow-[0_0_6px_rgba(56,189,248,0.25)]";
            label = "Alone";
          } else if (status === "late") {
            colorClass = "bg-[#D97706]";
            label = "Late";
          } else if (status === "missed") {
            colorClass = "bg-[#C2414B]";
            label = "Missed";
          } else if (status === "excused") {
            colorClass = "bg-[#64748B]";
            label = "Excused";
          }

          return {
            name: pKey === "Asar" ? "Asr" : pKey,
            status,
            colorClass,
            label,
          };
        });

        if (statsToShow === "All") {
          total = 5;
          if (record) {
            prayerKeys.forEach((pKey) => {
              const status = record.salahs[pKey];
              if (status === "group") {
                completed++;
                inJamaah++;
              } else if (
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
            if (status === "group") {
              completed++;
              inJamaah++;
            } else if (
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
          inJamaah,
          sections,
        });
      }

      const sumPercent = last7Days.reduce((acc, d) => acc + d.percentage, 0);
      const avg = Math.round(sumPercent / last7Days.length);
      const sumMissed = last7Days.reduce((acc, d) => acc + d.missed, 0);
      const sumOnTime = last7Days.reduce((acc, d) => acc + d.completed, 0);
      const sumExpected = last7Days.reduce((acc, d) => acc + d.total, 0);
      const sumJamaah = last7Days.reduce((acc, d) => acc + d.inJamaah, 0);

      return {
        days: last7Days,
        averagePercentage: avg,
        totalMissed: sumMissed,
        totalOnTime: sumOnTime,
        totalExpected: sumExpected,
        totalInJamaah: sumJamaah,
      };
    }, [fetchedSalahData, statsToShow]);

  return (
    <div className="w-full bg-[var(--app-card-bg)] border border-[var(--app-border)] rounded-none p-4 text-white font-mono">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-xs font-bold tracking-wider uppercase text-white">
          PROGRESS STATS
        </h2>
        <p className="text-[11px] text-[#94A3B8]">
          Prayer Consistency — Last 7 Days
        </p>
      </div>

      {/* Clean Segmented Bar Chart */}
      <div className="relative pt-2 pb-4">
        {/* Y Axis Grid Lines & Labels */}
        <div className="flex h-44 w-full">
          {/* Y Axis Labels */}
          <div className="flex flex-col justify-between pr-2 text-[10px] text-[#64748B] select-none text-right w-10">
            <span>100%</span>
            <span>80%</span>
            <span>60%</span>
            <span>40%</span>
            <span>20%</span>
            <span>0%</span>
          </div>

          {/* Chart Area */}
          <div className="relative flex-1 flex items-end justify-between border-l border-b border-[var(--app-border)] pl-2 pr-1">
            {/* Horizontal Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-40">
              <div className="border-b border-[var(--app-border)] w-full"></div>
              <div className="border-b border-[var(--app-border)] w-full"></div>
              <div className="border-b border-[var(--app-border)] w-full"></div>
              <div className="border-b border-[var(--app-border)] w-full"></div>
              <div className="border-b border-[var(--app-border)] w-full"></div>
              <div className="w-full"></div>
            </div>

            {/* Bars */}
            {days.map((day, idx) => (
              <div
                key={day.dateStr + idx}
                className="relative z-10 flex flex-col items-center flex-1 h-full justify-end group px-0.5"
              >
                {/* Value on top of bar */}
                <div className="flex items-center gap-1 mb-1 leading-none shrink-0">
                  {day.inJamaah > 0 && (
                    <span
                      className="w-1.5 h-1.5 rotate-45 bg-[#F59E0B] shadow-[0_0_4px_#F59E0B] inline-block shrink-0"
                      title={`${day.inJamaah} in Jamaah`}
                    />
                  )}
                  <span
                    className={`text-[9px] font-mono tabular-nums font-semibold ${
                      day.inJamaah > 0
                        ? "text-[#F59E0B]"
                        : day.completed > 0
                        ? "text-[#38BDF8]"
                        : day.missed > 0
                        ? "text-[#C2414B]"
                        : "text-[#64748B]"
                    }`}
                  >
                    {day.percentage}%
                  </span>
                </div>

                {/* 5-Section Segmented Bar when All, or Single Bar when Specific */}
                {statsToShow === "All" ? (
                  <div className="w-full max-w-[22px] flex-1 flex flex-col-reverse gap-[2px] pb-[1px] h-full">
                    {day.sections.map((sec) => (
                      <div
                        key={sec.name}
                        className={`w-full flex-1 rounded-none transition-all duration-300 ${sec.colorClass} hover:brightness-125 cursor-pointer`}
                        title={`${sec.name}: ${sec.label}`}
                      />
                    ))}
                  </div>
                ) : (
                  <div
                    style={{ height: `${Math.max(day.percentage, 2)}%` }}
                    className={`w-full max-w-[22px] rounded-none transition-all duration-300 relative ${
                      day.inJamaah > 0
                        ? "bg-[#F59E0B] shadow-[0_0_10px_rgba(245,158,11,0.3)] group-hover:bg-[#D97706]"
                        : day.completed > 0
                        ? "bg-[#38BDF8] shadow-[0_0_8px_rgba(56,189,248,0.25)] group-hover:bg-[#0284C7]"
                        : day.missed > 0
                        ? "bg-[#C2414B]/60 group-hover:bg-[#C2414B]"
                        : "bg-[#161922] border border-[#232936]/40"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* X Axis Labels */}
        <div className="flex w-full pl-12 pr-1 pt-2">
          {days.map((day, idx) => (
            <div
              key={"label-" + day.dateStr + idx}
              className="flex-1 text-center text-xs font-semibold text-[#94A3B8] font-mono uppercase"
            >
              {day.dayLabel}
            </div>
          ))}
        </div>

        {/* Legend for 5-section bar */}
        {statsToShow === "All" && (
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] text-[#94A3B8] font-mono mt-3 select-none">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-none bg-[#F59E0B] inline-block" />
              <span>In Jamaah</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-none bg-[#38BDF8] inline-block" />
              <span>Alone</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-none bg-[#D97706] inline-block" />
              <span>Late</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-none bg-[#C2414B] inline-block" />
              <span>Missed</span>
            </div>
          </div>
        )}
      </div>

      {/* High-Density Data Summary Table */}
      <div className="mt-4 border-t border-[var(--app-border)] pt-1 text-xs">
        {/* In Jamaah - Highest Achievement Row */}
        <div className="flex justify-between py-2 border-b border-[var(--app-border)] bg-[#10B981]/5 px-2 -mx-2">
          <span className="text-white font-medium flex items-center gap-1.5">
            <span className="text-[#F59E0B]">✦</span> In Jamaah
            <span className="text-[9px] px-1 py-0.2 bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40 tracking-wider font-mono">
              TOP
            </span>
          </span>
          <span className="text-[#10B981] font-bold tabular-nums">
            {totalInJamaah} {totalInJamaah === 1 ? "prayer" : "prayers"}
          </span>
        </div>
        <div className="flex justify-between py-2 border-b border-[var(--app-border)]">
          <span className="text-[#94A3B8]">Average:</span>
          <span className="text-white font-bold tabular-nums">
            {averagePercentage}%
          </span>
        </div>
        <div className="flex justify-between py-2 border-b border-[var(--app-border)]">
          <span className="text-[#94A3B8]">Missed:</span>
          <span className={`font-bold tabular-nums ${totalMissed > 0 ? "text-[#C2414B]" : "text-white"}`}>
            {totalMissed}
          </span>
        </div>
        <div className="flex justify-between py-2 border-b border-[var(--app-border)]">
          <span className="text-[#94A3B8]">On Time:</span>
          <span className="text-[#10B981] font-bold tabular-nums">
            {totalOnTime}/{totalExpected}
          </span>
        </div>
        <div className="flex justify-between py-2">
          <span className="text-[#94A3B8]">Active Streak:</span>
          <span className="text-[#F59E0B] font-bold tabular-nums">
            {activeStreakCount} {activeStreakCount === 1 ? "day" : "days"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default BarChartStats;
