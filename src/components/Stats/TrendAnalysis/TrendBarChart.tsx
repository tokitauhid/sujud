import React, { useState } from "react";
import { DayTrendItem } from "../../../types/types";

interface TrendBarChartProps {
  days: DayTrendItem[];
  isMaleMode: boolean;
  periodType: "weekly" | "monthly" | "yearly";
}

export const TrendBarChart: React.FC<TrendBarChartProps> = ({
  days,
  isMaleMode,
  periodType,
}) => {
  const [selectedDay, setSelectedDay] = useState<DayTrendItem | null>(null);

  // For monthly view with ~30 bars, allow responsive compact bars or scrolling
  const isMonthly = periodType === "monthly";

  return (
    <div
      className="w-full bg-[var(--app-card-bg)] border border-[var(--app-border)] p-4 text-white font-mono"
      role="region"
      aria-label="Daily prayer trend chart"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-xs font-bold tracking-wider uppercase text-white">
            PRAYER CONSISTENCY & JAMAAH
          </h3>
          <p className="text-[11px] text-[#94A3B8]">
            {isWeeklyOrYearlyLabel(periodType, days.length)}
          </p>
        </div>
        {/* Selected day pill */}
        {selectedDay && (
          <div className="text-[11px] text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 border border-[#10B981]/30">
            {selectedDay.dayLabel} {selectedDay.date.slice(5)}: {selectedDay.completed}/5
            {isMaleMode && ` (${selectedDay.inJamaah} Jamaah)`}
          </div>
        )}
      </div>

      {/* Chart grid */}
      <div className="relative pt-2 pb-2">
        <div className="flex h-36 w-full">
          {/* Y Axis */}
          <div className="flex flex-col justify-between pr-2 text-[10px] text-[#64748B] select-none text-right w-8 shrink-0">
            <span>100%</span>
            <span>75%</span>
            <span>50%</span>
            <span>25%</span>
            <span>0%</span>
          </div>

          {/* Bars Container */}
          <div className="relative flex-1 flex items-end justify-between border-l border-b border-[var(--app-border)] pl-1 pr-1 overflow-x-auto">
            {/* Horizontal Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-30">
              <div className="border-b border-[var(--app-border)] w-full"></div>
              <div className="border-b border-[var(--app-border)] w-full"></div>
              <div className="border-b border-[var(--app-border)] w-full"></div>
              <div className="border-b border-[var(--app-border)] w-full"></div>
              <div className="w-full"></div>
            </div>

            {/* Individual Bars */}
            <div className="flex items-end justify-between w-full h-full gap-1 z-10">
              {days.map((day) => {
                const heightPct = Math.max(day.percentage, 3);
                const hasJamaah = isMaleMode && day.inJamaah > 0;
                const isPerfect = day.isAllCompleted;

                return (
                  <div
                    key={day.date}
                    onClick={() => setSelectedDay(day)}
                    onMouseEnter={() => setSelectedDay(day)}
                    className="flex-1 flex flex-col items-center justify-end h-full group cursor-pointer"
                    style={{ minWidth: isMonthly ? "7px" : "18px" }}
                    role="button"
                    tabIndex={0}
                    aria-label={`${day.date}: ${day.completed} of 5 prayers completed (${day.percentage}%)${
                      hasJamaah ? `, ${day.inJamaah} in Jamaah` : ""
                    }`}
                  >
                    {/* Top percentage label (only shown on weekly or hover) */}
                    {!isMonthly && (
                      <span
                        className={`text-[8px] font-mono tabular-nums mb-1 leading-none ${
                          hasJamaah
                            ? "text-[#10B981]"
                            : day.completed > 0
                              ? "text-[#38BDF8]"
                              : "text-[#64748B]"
                        }`}
                      >
                        {day.percentage}%
                      </span>
                    )}

                    {/* Bar Stack */}
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full max-w-[24px] transition-all duration-200 relative flex flex-col justify-end overflow-hidden ${
                        isPerfect
                          ? "ring-1 ring-[#10B981]/50"
                          : day.missed > 0
                            ? "ring-1 ring-[#C2414B]/30"
                            : ""
                      }`}
                    >
                      {/* Jamaah segment (if male mode and > 0) */}
                      {isMaleMode && day.inJamaah > 0 && (
                        <div
                          style={{
                            height: `${Math.round((day.inJamaah / Math.max(day.completed, 1)) * 100)}%`,
                          }}
                          className="w-full bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.3)] transition-colors group-hover:brightness-110"
                        />
                      )}

                      {/* Alone / Other completed segment */}
                      <div
                        className={`w-full flex-1 ${
                          day.completed === 0
                            ? "bg-[#161922] border border-[#232936]/40"
                            : isMaleMode && day.inJamaah > 0
                              ? "bg-[#38BDF8]/80"
                              : "bg-[#38BDF8]"
                        } transition-colors group-hover:brightness-110`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* X Axis Labels */}
        <div className="flex w-full pl-8 pr-1 pt-1.5">
          {days.map((day, idx) => {
            // In monthly mode, display every 5th label to prevent clutter
            const showLabel =
              !isMonthly || idx === 0 || idx % 5 === 0 || idx === days.length - 1;

            return (
              <div
                key={"label-" + day.date}
                className="flex-1 text-center text-[10px] text-[#94A3B8] font-mono select-none"
              >
                {showLabel ? (isMonthly ? day.date.slice(8) : day.dayLabel) : ""}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] text-[#94A3B8] font-mono mt-3 border-t border-[var(--app-border)] pt-2 select-none">
        {isMaleMode && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-[#10B981] inline-block" />
            <span>In Jamaah</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-[#38BDF8] inline-block" />
          <span>Alone / On Time</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-[#D97706] inline-block" />
          <span>Late</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-[#C2414B] inline-block" />
          <span>Missed</span>
        </div>
      </div>
    </div>
  );
};

function isWeeklyOrYearlyLabel(periodType: string, count: number) {
  if (periodType === "weekly") {
    return "Daily Completion — 7 Days";
  }
  if (periodType === "monthly") {
    return `Daily Completion — ${count} Days`;
  }
  return `Daily Completion — ${count} Days`;
}

export default TrendBarChart;
