/**
 * Utilities for Hijri (Islamic) calendar calculations and events.
 * Uses standard Intl.DateTimeFormat with islamic-umalqura calendar,
 * ensuring deterministic, locale-accurate, and dependency-free calculations.
 */

export interface HijriDate {
  day: number;
  month: number; // 1 to 12
  year: number;
  monthName: string;
  monthNameShort: string;
  formatted: string;
}

export interface IslamicEvent {
  id: string;
  month: number; // 1-12
  day: number; // 1-30
  title: string;
  description: string;
  type: "major" | "observance" | "sunnah";
}

export const ISLAMIC_MONTH_NAMES = [
  "Muharram",
  "Safar",
  "Rabi' al-Awwal",
  "Rabi' al-Thani",
  "Jumada al-Awwal",
  "Jumada al-Thani",
  "Rajab",
  "Sha'ban",
  "Ramadan",
  "Shawwal",
  "Dhu al-Qi'dah",
  "Dhu al-Hijjah",
] as const;

export const ISLAMIC_MONTH_NAMES_SHORT = [
  "Muh",
  "Saf",
  "Rab I",
  "Rab II",
  "Jum I",
  "Jum II",
  "Raj",
  "Sha",
  "Ram",
  "Shaw",
  "Dhu-Q",
  "Dhu-H",
] as const;

/**
 * Curated Islamic events by Hijri month and day.
 */
export const ISLAMIC_EVENTS: IslamicEvent[] = [
  // 1. Muharram
  {
    id: "islamic-new-year",
    month: 1,
    day: 1,
    title: "Islamic New Year",
    description:
      "First day of Muharram, marking the beginning of the new Hijri year.",
    type: "major",
  },
  {
    id: "tasua",
    month: 1,
    day: 9,
    title: "Tasu'a",
    description:
      "The 9th of Muharram, recommended day of fasting preceding the Day of Ashura.",
    type: "observance",
  },
  {
    id: "ashura",
    month: 1,
    day: 10,
    title: "Day of Ashura",
    description:
      "The 10th of Muharram, commemorating the salvation of Prophet Musa (AS) and the children of Israel. A highly recommended day of voluntary fasting.",
    type: "major",
  },

  // 3. Rabi' al-Awwal
  {
    id: "mawlid-an-nabi",
    month: 3,
    day: 12,
    title: "Mawlid an-Nabi",
    description:
      "Observance commemorating the birth of Prophet Muhammad ﷺ.",
    type: "observance",
  },

  // 7. Rajab
  {
    id: "isra-and-miraj",
    month: 7,
    day: 27,
    title: "Isra and Mi'raj",
    description:
      "Commemorates the miraculous Night Journey of Prophet Muhammad ﷺ from Makkah to Jerusalem and his ascension to the heavens.",
    type: "major",
  },

  // 8. Sha'ban
  {
    id: "nisf-shaban",
    month: 8,
    day: 15,
    title: "Mid-Sha'ban (Nisf Sha'ban)",
    description:
      "The 15th night of Sha'ban, a night of seeking forgiveness and preparation for the arrival of Ramadan.",
    type: "observance",
  },

  // 9. Ramadan
  {
    id: "ramadan-begins",
    month: 9,
    day: 1,
    title: "Ramadan Begins",
    description:
      "The first day of Ramadan, the holy month of fasting, Qur'an, and spiritual devotion.",
    type: "major",
  },
  {
    id: "battle-of-badr",
    month: 9,
    day: 17,
    title: "Day of Badr",
    description:
      "Anniversary of the Battle of Badr, a pivotal moment in early Islamic history.",
    type: "observance",
  },
  {
    id: "ramadan-night-21",
    month: 9,
    day: 21,
    title: "21st Night of Ramadan",
    description:
      "The first of the odd nights in the last ten days of Ramadan, sought for Laylat al-Qadr.",
    type: "observance",
  },
  {
    id: "ramadan-night-23",
    month: 9,
    day: 23,
    title: "23rd Night of Ramadan",
    description:
      "One of the blessed odd nights in the last ten days of Ramadan, sought for Laylat al-Qadr.",
    type: "observance",
  },
  {
    id: "ramadan-night-25",
    month: 9,
    day: 25,
    title: "25th Night of Ramadan",
    description:
      "One of the blessed odd nights in the last ten days of Ramadan, sought for Laylat al-Qadr.",
    type: "observance",
  },
  {
    id: "laylat-al-qadr",
    month: 9,
    day: 27,
    title: "Laylat al-Qadr (Night of Power)",
    description:
      "The Night of Decree, described in the Qur'an as better than a thousand months. Traditionally observed on the 27th night of Ramadan.",
    type: "major",
  },
  {
    id: "ramadan-night-29",
    month: 9,
    day: 29,
    title: "29th Night of Ramadan",
    description:
      "One of the blessed odd nights in the last ten days of Ramadan, sought for Laylat al-Qadr.",
    type: "observance",
  },

  // 10. Shawwal
  {
    id: "eid-al-fitr-1",
    month: 10,
    day: 1,
    title: "Eid al-Fitr",
    description:
      "The Festival of Breaking the Fast, celebrating the completion of the blessed month of Ramadan.",
    type: "major",
  },
  {
    id: "eid-al-fitr-2",
    month: 10,
    day: 2,
    title: "Eid al-Fitr (Day 2)",
    description: "The second day of Eid al-Fitr celebrations.",
    type: "major",
  },
  {
    id: "eid-al-fitr-3",
    month: 10,
    day: 3,
    title: "Eid al-Fitr (Day 3)",
    description: "The third day of Eid al-Fitr celebrations.",
    type: "major",
  },

  // 12. Dhu al-Hijjah
  {
    id: "dhu-al-hijjah-10-days",
    month: 12,
    day: 1,
    title: "First 10 Days of Dhu al-Hijjah",
    description:
      "Start of the first ten days of Dhu al-Hijjah, revered as the most virtuous days of the year for righteous deeds.",
    type: "observance",
  },
  {
    id: "day-of-tarwiyah",
    month: 12,
    day: 8,
    title: "Day of Tarwiyah",
    description:
      "The 8th of Dhu al-Hijjah, marking the beginning of the Hajj rites as pilgrims proceed to Mina.",
    type: "observance",
  },
  {
    id: "day-of-arafah",
    month: 12,
    day: 9,
    title: "Day of Arafah",
    description:
      "The pinnacle of the Hajj pilgrimage at Mount Arafat. Fasting on this day expiates sins for the preceding and coming year for non-pilgrims.",
    type: "major",
  },
  {
    id: "eid-al-adha-1",
    month: 12,
    day: 10,
    title: "Eid al-Adha",
    description:
      "The Festival of Sacrifice, commemorating Prophet Ibrahim's (AS) devotion to Allah. The major day of Hajj.",
    type: "major",
  },
  {
    id: "days-of-tashreeq-1",
    month: 12,
    day: 11,
    title: "Days of Tashreeq (Day 1)",
    description:
      "The second day of Eid al-Adha and the first day of Tashreeq, spent in remembrance of Allah.",
    type: "observance",
  },
  {
    id: "days-of-tashreeq-2",
    month: 12,
    day: 12,
    title: "Days of Tashreeq (Day 2)",
    description:
      "The third day of Eid al-Adha and the second day of Tashreeq.",
    type: "observance",
  },
  {
    id: "days-of-tashreeq-3",
    month: 12,
    day: 13,
    title: "Days of Tashreeq (Day 3)",
    description:
      "The final day of Tashreeq and concluding day of Eid al-Adha rites.",
    type: "observance",
  },
];

/**
 * Cache for Hijri date conversions by ISO date string (YYYY-MM-DD)
 * to avoid redundant Intl formatting calls during calendar rendering.
 */
const hijriDateCache = new Map<string, HijriDate>();

/**
 * Converts a Gregorian Date to HijriDate using Umm al-Qura calendar.
 */
export const getHijriDate = (date: Date): HijriDate => {
  if (!date || isNaN(date.getTime())) {
    date = new Date();
  }

  // Create local YYYY-MM-DD key for caching
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const cached = hijriDateCache.get(key);
  if (cached) {
    return cached;
  }

  let day = 1;
  let month = 1;
  let year = 1448;

  try {
    const formatter = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    });
    const parts = formatter.formatToParts(date);
    for (const part of parts) {
      if (part.type === "day") day = parseInt(part.value, 10);
      if (part.type === "month") month = parseInt(part.value, 10);
      if (part.type === "year") year = parseInt(part.value, 10);
    }
  } catch {
    try {
      const fallbackFormatter = new Intl.DateTimeFormat("en-u-ca-islamic-nu-latn", {
        day: "numeric",
        month: "numeric",
        year: "numeric",
      });
      const parts = fallbackFormatter.formatToParts(date);
      for (const part of parts) {
        if (part.type === "day") day = parseInt(part.value, 10);
        if (part.type === "month") month = parseInt(part.value, 10);
        if (part.type === "year") year = parseInt(part.value, 10);
      }
    } catch {
      // Deterministic fallback if Intl is somehow unavailable
      day = 1;
      month = 1;
      year = 1448;
    }
  }

  // Safety clamps
  if (month < 1 || month > 12) month = 1;
  if (day < 1 || day > 30) day = 1;

  const monthName = ISLAMIC_MONTH_NAMES[month - 1];
  const monthNameShort = ISLAMIC_MONTH_NAMES_SHORT[month - 1];
  const formatted = `${day} ${monthName} ${year} AH`;

  const result: HijriDate = {
    day,
    month,
    year,
    monthName,
    monthNameShort,
    formatted,
  };

  hijriDateCache.set(key, result);
  return result;
};

/**
 * Checks if a given date or HijriDate corresponds to an Islamic event.
 * Returns the IslamicEvent if found, or null otherwise.
 */
export const getIslamicEventForDate = (
  dateOrHijri: Date | HijriDate,
): IslamicEvent | null => {
  const hijri =
    "month" in dateOrHijri && "day" in dateOrHijri
      ? dateOrHijri
      : getHijriDate(dateOrHijri);

  // 1. Check curated major & observance events first
  const matchedEvent = ISLAMIC_EVENTS.find(
    (ev) => ev.month === hijri.month && ev.day === hijri.day,
  );
  if (matchedEvent) {
    return matchedEvent;
  }

  // 2. Check for Ayyam al-Beed (White Days: 13, 14, 15 of every lunar month)
  // Note: During Ramadan (month 9) it's already obligatory fasting;
  // on Dhu al-Hijjah 11-13 (Days of Tashreeq) fasting is prohibited.
  if (
    (hijri.day === 13 || hijri.day === 14 || hijri.day === 15) &&
    hijri.month !== 9 &&
    !(hijri.month === 12 && hijri.day === 13)
  ) {
    return {
      id: `white-day-${hijri.month}-${hijri.day}`,
      month: hijri.month,
      day: hijri.day,
      title: "Ayyam al-Beed (White Day)",
      description:
        "The 13th, 14th, and 15th of the lunar month. Recommended voluntary fasting days according to the Sunnah of Prophet Muhammad ﷺ.",
      type: "sunnah",
    };
  }

  return null;
};

/**
 * Generates a clean Hijri month/year range label for a given month's dates.
 * e.g. "Rabi' I - Rabi' II 1448 AH" or "Ramadan 1447 AH"
 */
export const getHijriMonthRange = (startDate: Date, endDate: Date): string => {
  const startHijri = getHijriDate(startDate);
  const endHijri = getHijriDate(endDate);

  if (startHijri.month === endHijri.month && startHijri.year === endHijri.year) {
    return `${startHijri.monthName} ${startHijri.year} AH`;
  }

  if (startHijri.year === endHijri.year) {
    return `${startHijri.monthName} – ${endHijri.monthName} ${startHijri.year} AH`;
  }

  return `${startHijri.monthName} ${startHijri.year} – ${endHijri.monthName} ${endHijri.year} AH`;
};
