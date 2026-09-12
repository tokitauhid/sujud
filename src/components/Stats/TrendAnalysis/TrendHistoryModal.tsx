import React from "react";
import { format } from "date-fns";
import { IonModal } from "@ionic/react";
import { X, History, ArrowRight } from "lucide-react";
import { TrendPeriodType, TrendSnapshotRecord, TrendMetrics } from "../../../types/types";

interface TrendHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshots: TrendSnapshotRecord[];
  periodType: TrendPeriodType;
  onSelectSnapshot: (snapshot: TrendSnapshotRecord) => void;
  currentSnapshotId?: string;
}

export const TrendHistoryModal: React.FC<TrendHistoryModalProps> = ({
  isOpen,
  onClose,
  snapshots,
  periodType,
  onSelectSnapshot,
  currentSnapshotId,
}) => {
  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose} className="trend-history-modal">
      <div className="bg-[#121212] text-white font-mono h-full flex flex-col p-4 border border-[#242424] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#242424] shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#10B981]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">
              SAVED {periodType.toUpperCase()} SNAPSHOTS
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#202020] text-[#94A3B8] hover:text-white transition-colors"
            aria-label="Close history modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[11px] text-[#71717A] mt-2 mb-3 shrink-0">
          Historical analyses are immutable records preserved exactly as generated.
        </p>

        {/* Snapshot List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {snapshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-[#71717A]">
              <History className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-xs">No saved snapshots for this period type yet.</p>
              <p className="text-[10px] mt-1 text-[#52525B]">
                Snapshots are automatically saved when analyses or notifications are created.
              </p>
            </div>
          ) : (
            snapshots.map((snap) => {
              let metrics: TrendMetrics | null = null;
              try {
                metrics = JSON.parse(snap.metricsJson);
              } catch (e) {
                // ignore parsing error
              }

              const isSelected = snap.id === currentSnapshotId;
              const generatedDate = new Date(snap.generatedAt);

              return (
                <div
                  key={snap.id}
                  onClick={() => {
                    onSelectSnapshot(snap);
                    onClose();
                  }}
                  className={`p-3 border transition-all cursor-pointer ${
                    isSelected
                      ? "border-[#10B981] bg-[#10B981]/10"
                      : "border-[#242424] bg-[#161616] hover:border-[#38BDF8]/60 hover:bg-[#1A1A1A]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">
                          {snap.periodStart} → {snap.periodEnd}
                        </span>
                        {isSelected && (
                          <span className="text-[9px] px-1.5 py-0.2 bg-[#10B981] text-black font-semibold uppercase">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#71717A] mt-1">
                        Generated {format(generatedDate, "MMM dd, yyyy HH:mm")} • {snap.dataVersion}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {metrics && (
                        <div className="text-right">
                          <span className="text-xs font-bold text-[#10B981] tabular-nums">
                            {metrics.completionPercentage}%
                          </span>
                          <div className="text-[9px] text-[#94A3B8]">
                            {metrics.completed}/{metrics.totalExpected}
                          </div>
                        </div>
                      )}
                      <ArrowRight className="w-3.5 h-3.5 text-[#71717A]" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#242424] mt-2 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2 bg-[#242424] hover:bg-[#2E2E2E] text-white text-xs font-bold uppercase tracking-wider transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </IonModal>
  );
};

export default TrendHistoryModal;
