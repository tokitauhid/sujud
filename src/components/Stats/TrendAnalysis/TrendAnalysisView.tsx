import React, { useState, useEffect, useMemo } from "react";
import { format, parseISO } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  History,
  TrendingUp,
  TrendingDown,
  Minus,
  Flame,
  CheckCircle2,
  Calendar as CalendarIcon,
  RotateCcw,
  Sparkles,
  Info,
  BookOpen,
  ExternalLink,
} from "lucide-react";
import { SQLiteDBConnection } from "@capacitor-community/sqlite";
import {
  SalahRecordsArrayType,
  TrendPeriodType,
  TrendSnapshotRecord,
  TrendMetrics,
  TrendSummary,
  userPreferencesType,
} from "../../../types/types";
import {
  getPeriodRange,
  getPreviousPeriod,
  getNextPeriod,
  calculateTrendAnalysisWithComparison,
  generateAnalysisSummary,
  computeSourceDataHash,
  saveAnalysisSnapshot,
  getAnalysisHistory,
  findMatchingSnapshot,
  getSnapshotById,
} from "../../../utils/trendAnalysis";
import TrendBarChart from "./TrendBarChart";
import TrendHistoryModal from "./TrendHistoryModal";

interface TrendAnalysisViewProps {
  dbConnection: React.MutableRefObject<SQLiteDBConnection | undefined>;
  userPreferences: userPreferencesType;
  fetchedSalahData: SalahRecordsArrayType;
  initialSnapshotId?: string | null;
}

export const TrendAnalysisView: React.FC<TrendAnalysisViewProps> = ({
  dbConnection,
  userPreferences,
  fetchedSalahData,
  initialSnapshotId,
}) => {
  const [periodType, setPeriodType] = useState<TrendPeriodType>("weekly");
  const [referenceDate, setReferenceDate] = useState<Date>(new Date());
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [savedSnapshots, setSavedSnapshots] = useState<TrendSnapshotRecord[]>([]);
  const [viewingSnapshot, setViewingSnapshot] = useState<TrendSnapshotRecord | null>(null);

  const isMaleMode = userPreferences.userGender === "male";

  // Current period date boundaries
  const currentPeriod = useMemo(() => {
    return getPeriodRange(periodType, referenceDate);
  }, [periodType, referenceDate]);

  // Compute live metrics or use viewingSnapshot
  const { metrics, summary, dataHash } = useMemo(() => {
    if (viewingSnapshot) {
      try {
        const m: TrendMetrics = JSON.parse(viewingSnapshot.metricsJson);
        const s: TrendSummary = JSON.parse(viewingSnapshot.summaryJson);
        return { metrics: m, summary: s, dataHash: viewingSnapshot.dataVersion };
      } catch (e) {
        console.error("Failed to parse snapshot json", e);
      }
    }

    const hash = computeSourceDataHash(
      fetchedSalahData,
      currentPeriod.start,
      currentPeriod.end,
    );

    const m = calculateTrendAnalysisWithComparison(
      periodType,
      currentPeriod.start,
      currentPeriod.end,
      fetchedSalahData,
      isMaleMode,
    );

    const s = generateAnalysisSummary(m, isMaleMode);

    return { metrics: m, summary: s, dataHash: hash };
  }, [viewingSnapshot, fetchedSalahData, currentPeriod, periodType, isMaleMode]);

  // Fetch saved snapshot history when periodType changes
  const fetchSnapshots = async () => {
    try {
      const history = await getAnalysisHistory(dbConnection, periodType);
      setSavedSnapshots(history);
    } catch (error) {
      console.error("Error fetching analysis history:", error);
    }
  };

  useEffect(() => {
    fetchSnapshots();
  }, [periodType]);

  // Handle deep-linked initial snapshot
  useEffect(() => {
    if (initialSnapshotId) {
      const loadInitialSnapshot = async () => {
        try {
          const snap = await getSnapshotById(dbConnection, initialSnapshotId);
          if (snap) {
            setPeriodType(snap.periodType);
            setReferenceDate(parseISO(snap.periodStart));
            setViewingSnapshot(snap);
          }
        } catch (e) {
          console.error("Failed to load initial snapshot:", e);
        }
      };
      loadInitialSnapshot();
    }
  }, [initialSnapshotId]);

  // Auto-save live snapshot if meaningful data and no snapshot exists yet
  useEffect(() => {
    if (!viewingSnapshot && metrics.completed > 0) {
      const persistCurrentSnapshot = async () => {
        try {
          const existing = await findMatchingSnapshot(
            dbConnection,
            periodType,
            currentPeriod.start,
            currentPeriod.end,
            dataHash,
          );

          if (!existing) {
            const newSnapshot: TrendSnapshotRecord = {
              id: `snap_${periodType}_${currentPeriod.start}_${Date.now()}`,
              periodType,
              periodStart: currentPeriod.start,
              periodEnd: currentPeriod.end,
              generatedAt: Date.now(),
              schemaVersion: 1,
              dataVersion: dataHash,
              metricsJson: JSON.stringify(metrics),
              summaryJson: JSON.stringify(summary),
              isMaleMode: isMaleMode ? 1 : 0,
              isNotificationSent: 0,
              createdAt: Date.now(),
            };
            await saveAnalysisSnapshot(dbConnection, newSnapshot);
            fetchSnapshots();
          }
        } catch (error) {
          console.error("Failed to auto-save snapshot:", error);
        }
      };
      persistCurrentSnapshot();
    }
  }, [currentPeriod.start, currentPeriod.end, dataHash, viewingSnapshot]);

  // Navigation handlers
  const handlePrevPeriod = () => {
    setViewingSnapshot(null);
    const prev = getPreviousPeriod(periodType, currentPeriod.start);
    setReferenceDate(parseISO(prev.start));
  };

  const handleNextPeriod = () => {
    setViewingSnapshot(null);
    const next = getNextPeriod(periodType, currentPeriod.start);
    setReferenceDate(parseISO(next.start));
  };

  const handleResetToCurrent = () => {
    setViewingSnapshot(null);
    setReferenceDate(new Date());
  };

  return (
    <div className="w-full space-y-4 font-mono text-white">
      {/* 1. Period Selector Segment Tabs */}
      <div className="flex border border-[#242424] bg-[#121212] p-1">
        {(["weekly", "monthly", "yearly"] as TrendPeriodType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setViewingSnapshot(null);
              setPeriodType(tab);
            }}
            className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
              periodType === tab
                ? "bg-[#242424] text-white border-b-2 border-[#10B981]"
                : "text-[#71717A] hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 2. Date Navigator Bar */}
      <div className="flex items-center justify-between bg-[var(--app-card-bg)] border border-[var(--app-border)] p-2.5">
        <button
          onClick={handlePrevPeriod}
          className="p-1.5 hover:bg-[#202020] text-[#94A3B8] hover:text-white transition-colors"
          aria-label="Previous period"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1.5">
            <CalendarIcon className="w-3.5 h-3.5 text-[#10B981]" />
            <span className="text-xs font-bold text-white tracking-wide">
              {currentPeriod.label}
            </span>
          </div>
          <span className="text-[9px] text-[#71717A] uppercase tracking-wider mt-0.5">
            {metrics.totalDays} Days • {metrics.totalExpected} Expected
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleNextPeriod}
            className="p-1.5 hover:bg-[#202020] text-[#94A3B8] hover:text-white transition-colors"
            aria-label="Next period"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsHistoryModalOpen(true)}
            className="relative p-1.5 hover:bg-[#202020] text-[#94A3B8] hover:text-white transition-colors ml-1"
            title="View saved snapshot history"
            aria-label="View saved snapshot history"
          >
            <History className="w-4 h-4" />
            {savedSnapshots.length > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#10B981] text-black text-[8px] font-bold rounded-full flex items-center justify-center">
                {savedSnapshots.length > 9 ? "9+" : savedSnapshots.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 3. Historical Snapshot Banner */}
      {viewingSnapshot && (
        <div className="flex items-center justify-between bg-[#10B981]/10 border border-[#10B981]/40 px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[#10B981] shrink-0" />
            <div className="text-[11px] text-[#A7F3D0]">
              Viewing immutable snapshot from{" "}
              <span className="font-bold">
                {format(new Date(viewingSnapshot.generatedAt), "MMM dd, HH:mm")}
              </span>{" "}
              ({viewingSnapshot.dataVersion})
            </div>
          </div>
          <button
            onClick={handleResetToCurrent}
            className="flex items-center gap-1 text-[10px] text-black bg-[#10B981] px-2 py-0.5 font-bold uppercase hover:bg-[#059669] transition-colors shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
            Live
          </button>
        </div>
      )}

      {/* 4. Primary Summary Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Completion Rate Card */}
        <div className="bg-[var(--app-card-bg)] border border-[var(--app-border)] p-3 flex flex-col justify-between">
          <div>
            <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider">
              Completion Rate
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold tabular-nums text-white">
                {metrics.completionPercentage}%
              </span>
              {metrics.completionPercentageChange !== null && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 flex items-center gap-0.5 ${
                    metrics.completionPercentageChange > 0
                      ? "text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/30"
                      : metrics.completionPercentageChange < 0
                        ? "text-[#C2414B] bg-[#C2414B]/10 border border-[#C2414B]/30"
                        : "text-[#94A3B8] bg-[#242424]"
                  }`}
                >
                  {metrics.completionPercentageChange > 0 ? (
                    <TrendingUp className="w-2.5 h-2.5" />
                  ) : metrics.completionPercentageChange < 0 ? (
                    <TrendingDown className="w-2.5 h-2.5" />
                  ) : (
                    <Minus className="w-2.5 h-2.5" />
                  )}
                  {metrics.completionPercentageChange > 0 ? "+" : ""}
                  {metrics.completionPercentageChange}%
                </span>
              )}
            </div>
          </div>

          <div className="mt-3">
            <div className="w-full bg-[#1A1A1A] h-1.5 overflow-hidden border border-[#242424]">
              <div
                style={{ width: `${Math.min(metrics.completionPercentage, 100)}%` }}
                className="h-full bg-[#10B981]"
              />
            </div>
            <div className="text-[10px] text-[#71717A] mt-1.5 flex justify-between">
              <span>{metrics.completed} completed</span>
              <span>{metrics.totalExpected} expected</span>
            </div>
          </div>
        </div>

        {/* Streaks & Perfect Days Card */}
        <div className="bg-[var(--app-card-bg)] border border-[var(--app-border)] p-3 flex flex-col justify-between">
          <div>
            <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider flex items-center gap-1">
              <Flame className="w-3 h-3 text-[#F59E0B]" />
              Streak & Steadfastness
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold tabular-nums text-[#F59E0B]">
                {metrics.currentStreak}
              </span>
              <span className="text-[10px] text-[#94A3B8]">
                {metrics.currentStreak === 1 ? "day streak" : "days streak"}
              </span>
            </div>
          </div>

          <div className="border-t border-[#242424] pt-2 mt-2 space-y-1 text-[10px]">
            <div className="flex justify-between text-[#94A3B8]">
              <span>Best in period:</span>
              <span className="text-white font-bold tabular-nums">
                {metrics.longestStreak} {metrics.longestStreak === 1 ? "day" : "days"}
              </span>
            </div>
            <div className="flex justify-between text-[#94A3B8]">
              <span>All 5 completed:</span>
              <span className="text-[#10B981] font-bold tabular-nums">
                {metrics.perfectDaysCount} of {metrics.totalDays} days
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. First-Class Jamaah Card in Male Mode */}
      {isMaleMode && (
        <div className="bg-[#10B981]/5 border border-[#10B981]/30 p-3.5 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#10B981] flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
              JAMAAH REPORTING
            </span>
            {metrics.jamaahCountChange !== null && metrics.jamaahCountChange !== undefined && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 ${
                  metrics.jamaahCountChange >= 0
                    ? "text-[#10B981] bg-[#10B981]/20"
                    : "text-[#C2414B] bg-[#C2414B]/20"
                }`}
              >
                {metrics.jamaahCountChange >= 0 ? `+${metrics.jamaahCountChange}` : metrics.jamaahCountChange} vs previous
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 py-1 text-center border-y border-[#10B981]/20 my-2">
            <div>
              <div className="text-lg font-bold text-[#10B981] tabular-nums">
                {metrics.inJamaah}
              </div>
              <div className="text-[9px] text-[#94A3B8] uppercase">In Jamaah</div>
            </div>
            <div>
              <div className="text-lg font-bold text-white tabular-nums">
                {metrics.jamaahPercentage}%
              </div>
              <div className="text-[9px] text-[#94A3B8] uppercase">Jamaah Rate</div>
            </div>
            <div>
              <div className="text-lg font-bold text-[#38BDF8] tabular-nums">
                {metrics.prayersWithoutJamaah}
              </div>
              <div className="text-[9px] text-[#94A3B8] uppercase">Alone</div>
            </div>
          </div>

          <div className="text-[11px] text-[#A7F3D0] space-y-0.5 mt-2">
            {metrics.mostFrequentJamaahPrayer && (
              <div>
                • Most frequent Jamaah: <span className="font-bold text-white">{metrics.mostFrequentJamaahPrayer}</span>
              </div>
            )}
            {metrics.leastFrequentJamaahPrayer && (
              <div>
                • Room to grow in Jamaah: <span className="font-bold text-white">{metrics.leastFrequentJamaahPrayer}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. Encouraging Insights Card */}
      <div className="bg-[var(--app-card-bg)] border border-[var(--app-border)] p-3">
        <div className="flex items-center gap-1.5 mb-2 text-xs font-bold uppercase tracking-wider text-white">
          <Sparkles className="w-3.5 h-3.5 text-[#38BDF8]" />
          ANALYSIS INSIGHTS
        </div>
        <ul className="space-y-1.5 text-xs text-[#CBD5E1]">
          {summary.insights.map((insight, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="text-[#10B981] font-bold leading-tight mt-0.5">•</span>
              <span>{insight}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Hadith Reflection Card (Phase 4) */}
      {summary.hadithReflection && (
        <div className="bg-[var(--app-card-bg)] border border-[var(--app-border)] p-3.5 text-white">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-[#10B981] flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[#10B981]" />
              REFLECTION
            </span>
            {summary.hadithReflection.topic && (
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30">
                {summary.hadithReflection.topic.replace(/-/g, " ")}
              </span>
            )}
          </div>

          {summary.hadithReflection.arabicText && (
            <p
              dir="rtl"
              className="text-base text-right text-[#E2E8F0] leading-relaxed mb-2 font-medium"
            >
              {summary.hadithReflection.arabicText}
            </p>
          )}

          <p className="text-xs text-[#CBD5E1] leading-relaxed italic mb-3">
            "{summary.hadithReflection.translatedText}"
          </p>

          <div className="pt-2 border-t border-[#242424] flex items-center justify-between flex-wrap gap-2 text-[11px] text-[#94A3B8]">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-white">
                {summary.hadithReflection.collection}
              </span>
              <span>•</span>
              <span>{summary.hadithReflection.reference}</span>
              {summary.hadithReflection.grading &&
                summary.hadithReflection.grading !== "Review required" && (
                  <>
                    <span>•</span>
                    <span className="px-1.5 py-0.5 bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/30 text-[9px] font-bold">
                      {summary.hadithReflection.grading}
                      {summary.hadithReflection.gradingAuthority
                        ? ` (${summary.hadithReflection.gradingAuthority})`
                        : ""}
                    </span>
                  </>
                )}
            </div>

            {summary.hadithReflection.sourceUrl && (
              <a
                href={summary.hadithReflection.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-[#38BDF8] hover:underline flex items-center gap-1 font-medium"
              >
                View source
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Visual Trend Chart */}
      <TrendBarChart
        days={metrics.days}
        isMaleMode={isMaleMode}
        periodType={periodType}
      />

      {/* 8. Prayer-by-Prayer Breakdown Table */}
      <div className="bg-[var(--app-card-bg)] border border-[var(--app-border)] p-3 text-white overflow-x-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold tracking-wider uppercase text-white">
            PRAYER-STATUS BREAKDOWN
          </h3>
          <span className="text-[10px] text-[#71717A]">
            Completion & Status Distribution
          </span>
        </div>

        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#242424] text-[10px] text-[#71717A] uppercase">
              <th className="py-1.5 pr-2">Prayer</th>
              <th className="py-1.5 px-2 text-center">Rate</th>
              {isMaleMode && <th className="py-1.5 px-2 text-center text-[#10B981]">Jamaah</th>}
              <th className="py-1.5 px-2 text-center text-[#38BDF8]">Alone</th>
              <th className="py-1.5 px-2 text-center text-[#D97706]">Late</th>
              <th className="py-1.5 px-2 text-center text-[#C2414B]">Missed</th>
              <th className="py-1.5 pl-2 text-right">Trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#242424]">
            {metrics.prayersBreakdown.map((prayer) => (
              <tr key={prayer.name} className="hover:bg-[#161616] transition-colors">
                <td className="py-2 pr-2 font-bold text-white flex items-center gap-1.5">
                  {prayer.name}
                  {metrics.mostImprovedPrayer === prayer.name && (
                    <span className="text-[8px] px-1 bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40">
                      IMPROVED
                    </span>
                  )}
                  {metrics.mostFrequentlyMissedPrayer === prayer.name && prayer.missed > 0 && (
                    <span className="text-[8px] px-1 bg-[#C2414B]/20 text-[#C2414B] border border-[#C2414B]/40">
                      MISSED
                    </span>
                  )}
                </td>
                <td className="py-2 px-2 text-center font-bold tabular-nums text-white">
                  {prayer.completionRate}%
                </td>
                {isMaleMode && (
                  <td className="py-2 px-2 text-center font-bold tabular-nums text-[#10B981]">
                    {prayer.inJamaah}
                  </td>
                )}
                <td className="py-2 px-2 text-center font-bold tabular-nums text-[#38BDF8]">
                  {prayer.alone}
                </td>
                <td className="py-2 px-2 text-center font-bold tabular-nums text-[#D97706]">
                  {prayer.late}
                </td>
                <td className="py-2 px-2 text-center font-bold tabular-nums text-[#C2414B]">
                  {prayer.missed}
                </td>
                <td className="py-2 pl-2 text-right tabular-nums text-[11px]">
                  {prayer.changeVsPreviousRate !== null ? (
                    <span
                      className={`font-bold ${
                        prayer.changeVsPreviousRate > 0
                          ? "text-[#10B981]"
                          : prayer.changeVsPreviousRate < 0
                            ? "text-[#C2414B]"
                            : "text-[#71717A]"
                      }`}
                    >
                      {prayer.changeVsPreviousRate > 0 ? "+" : ""}
                      {prayer.changeVsPreviousRate}%
                    </span>
                  ) : (
                    <span className="text-[#52525B]">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Snapshot History Modal */}
      <TrendHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        snapshots={savedSnapshots}
        periodType={periodType}
        currentSnapshotId={viewingSnapshot?.id}
        onSelectSnapshot={(snap) => {
          setViewingSnapshot(snap);
          setReferenceDate(parseISO(snap.periodStart));
        }}
      />
    </div>
  );
};

export default TrendAnalysisView;
