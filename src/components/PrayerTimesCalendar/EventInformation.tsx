import { IslamicEvent, HijriDate } from "../../utils/hijriCalendar";

interface EventInformationProps {
  event: IslamicEvent | null;
  hijriDate?: HijriDate;
}

const EventInformation = ({ event, hijriDate }: EventInformationProps) => {
  // If there is no event, render nothing (do not show an empty event section)
  if (!event) {
    return null;
  }

  const isMajor = event.type === "major";
  const badgeText =
    event.type === "major"
      ? "Major Event"
      : event.type === "sunnah"
        ? "Sunnah Observance"
        : "Islamic Observance";

  return (
    <section
      aria-label="Islamic Event Details"
      data-testid="event-information-card"
      className="p-3 border border-[#242424] bg-[#161616] mb-3 transition-all"
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[9px] font-mono uppercase tracking-wider font-bold px-1.5 py-0.5 border ${
            isMajor
              ? "text-[#10B981] bg-[#10B981]/10 border-[#10B981]/30"
              : "text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/30"
          }`}
        >
          {badgeText}
        </span>
        {hijriDate && (
          <span className="text-[10px] font-mono text-[#8E8E93]">
            {hijriDate.formatted}
          </span>
        )}
      </div>

      <h3 className="text-sm font-mono font-bold text-white mt-1.5 tracking-wide">
        {event.title}
      </h3>

      <p className="text-xs font-mono text-[#D4D4D8] mt-1 leading-relaxed">
        {event.description}
      </p>
    </section>
  );
};

export default EventInformation;
