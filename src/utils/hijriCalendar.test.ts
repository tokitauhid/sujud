import { describe, it, expect } from "vitest";
import {
  getHijriDate,
  getIslamicEventForDate,
  getHijriMonthRange,
  ISLAMIC_MONTH_NAMES,
  ISLAMIC_MONTH_NAMES_SHORT,
} from "./hijriCalendar";

describe("Hijri Calendar Utilities", () => {
  it("has 12 Islamic month names and short names", () => {
    expect(ISLAMIC_MONTH_NAMES).toHaveLength(12);
    expect(ISLAMIC_MONTH_NAMES_SHORT).toHaveLength(12);
    expect(ISLAMIC_MONTH_NAMES[0]).toBe("Muharram");
    expect(ISLAMIC_MONTH_NAMES[8]).toBe("Ramadan");
    expect(ISLAMIC_MONTH_NAMES[9]).toBe("Shawwal");
    expect(ISLAMIC_MONTH_NAMES[11]).toBe("Dhu al-Hijjah");
  });

  it("calculates Hijri dates accurately for known dates", () => {
    // 2026-02-18 corresponds to 1 Ramadan 1447 AH in Umm al-Qura
    const ramadanStart = new Date(2026, 1, 18);
    const hijriRamadan = getHijriDate(ramadanStart);
    expect(hijriRamadan.month).toBe(9);
    expect(hijriRamadan.day).toBe(1);
    expect(hijriRamadan.monthName).toBe("Ramadan");
    expect(hijriRamadan.monthNameShort).toBe("Ram");
    expect(hijriRamadan.year).toBe(1447);
    expect(hijriRamadan.formatted).toContain("1 Ramadan 1447 AH");
  });

  it("identifies major Islamic events accurately", () => {
    // 1 Ramadan -> Ramadan Begins
    const ramadanStart = new Date(2026, 1, 18);
    const ramadanEvent = getIslamicEventForDate(ramadanStart);
    expect(ramadanEvent).not.toBeNull();
    expect(ramadanEvent?.title).toBe("Ramadan Begins");
    expect(ramadanEvent?.type).toBe("major");

    // Direct Hijri query for Eid al-Fitr (Month 10, Day 1)
    const eidFitrEvent = getIslamicEventForDate({
      day: 1,
      month: 10,
      year: 1447,
      monthName: "Shawwal",
      monthNameShort: "Shaw",
      formatted: "1 Shawwal 1447 AH",
    });
    expect(eidFitrEvent).not.toBeNull();
    expect(eidFitrEvent?.title).toBe("Eid al-Fitr");
    expect(eidFitrEvent?.type).toBe("major");

    // Direct Hijri query for Day of Arafah (Month 12, Day 9)
    const arafahEvent = getIslamicEventForDate({
      day: 9,
      month: 12,
      year: 1447,
      monthName: "Dhu al-Hijjah",
      monthNameShort: "Dhu-H",
      formatted: "9 Dhu al-Hijjah 1447 AH",
    });
    expect(arafahEvent).not.toBeNull();
    expect(arafahEvent?.title).toBe("Day of Arafah");

    // Direct Hijri query for Eid al-Adha (Month 12, Day 10)
    const eidAdhaEvent = getIslamicEventForDate({
      day: 10,
      month: 12,
      year: 1447,
      monthName: "Dhu al-Hijjah",
      monthNameShort: "Dhu-H",
      formatted: "10 Dhu al-Hijjah 1447 AH",
    });
    expect(eidAdhaEvent).not.toBeNull();
    expect(eidAdhaEvent?.title).toBe("Eid al-Adha");

    // Direct Hijri query for Ashura (Month 1, Day 10)
    const ashuraEvent = getIslamicEventForDate({
      day: 10,
      month: 1,
      year: 1448,
      monthName: "Muharram",
      monthNameShort: "Muh",
      formatted: "10 Muharram 1448 AH",
    });
    expect(ashuraEvent).not.toBeNull();
    expect(ashuraEvent?.title).toBe("Day of Ashura");
  });

  it("identifies White Days (Ayyam al-Beed) on the 13th, 14th, 15th of normal months", () => {
    // Safar (Month 2), Day 14
    const whiteDayEvent = getIslamicEventForDate({
      day: 14,
      month: 2,
      year: 1448,
      monthName: "Safar",
      monthNameShort: "Saf",
      formatted: "14 Safar 1448 AH",
    });
    expect(whiteDayEvent).not.toBeNull();
    expect(whiteDayEvent?.title).toContain("Ayyam al-Beed");
    expect(whiteDayEvent?.type).toBe("sunnah");
  });

  it("does not report White Days during Ramadan", () => {
    const ramadan14 = getIslamicEventForDate({
      day: 14,
      month: 9,
      year: 1447,
      monthName: "Ramadan",
      monthNameShort: "Ram",
      formatted: "14 Ramadan 1447 AH",
    });
    // Should be null because Ramadan fasting is already obligatory
    expect(ramadan14).toBeNull();
  });

  it("returns null for ordinary dates without events", () => {
    // 5 Safar
    const normalDay = getIslamicEventForDate({
      day: 5,
      month: 2,
      year: 1448,
      monthName: "Safar",
      monthNameShort: "Saf",
      formatted: "5 Safar 1448 AH",
    });
    expect(normalDay).toBeNull();
  });

  it("generates Hijri month range header strings correctly", () => {
    const sepStart = new Date(2026, 8, 1);
    const sepEnd = new Date(2026, 8, 30);
    const range = getHijriMonthRange(sepStart, sepEnd);
    expect(range).toContain("1448 AH");
    expect(range).toContain("Rabi'");
  });
});
