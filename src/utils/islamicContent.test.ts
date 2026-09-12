import { describe, it, expect } from "vitest";
import {
  validateIslamicContentRecord,
  validateIslamicContentRecordDetailed,
  getEligibleHadith,
  getUnreviewedHadith,
  getHadithForTopic,
  selectStableHadith,
  computeDeterministicHash,
  normalizeTopicTag,
  formatSelectedHadithReflection,
} from "./islamicContent";
import { IslamicContentRecord } from "../types/islamicContent";
import bundledIslamicContent from "../assets/islamicContent.json";

// Test fixture with verified-structure sample records
const createMockHadith = (
  overrides: Partial<IslamicContentRecord> = {},
): IslamicContentRecord => ({
  id: "test-hadith-1",
  type: "hadith",
  arabicText: "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ",
  translatedText: "Actions are judged by intentions.",
  language: "en",
  narrator: "Umar ibn al-Khattab",
  collection: "Sahih al-Bukhari",
  reference: "Book 1, Hadith 1",
  grading: "Sahih",
  gradingAuthority: "Al-Bukhari",
  sourceUrl: "https://sunnah.com/bukhari:1",
  tags: ["consistency", "good-deeds"],
  reviewed: true,
  licenseNote: "Public domain text; translation used for non-commercial testing.",
  ...overrides,
});

describe("Islamic Content Utilities", () => {
  describe("Metadata Validation", () => {
    it("validates a fully compliant record", () => {
      const record = createMockHadith();
      expect(validateIslamicContentRecord(record)).toBe(true);

      const detailed = validateIslamicContentRecordDetailed(record);
      expect(detailed.isValid).toBe(true);
      expect(detailed.errors).toEqual([]);
    });

    it("validates a record with minimal required fields (optional fields omitted or null)", () => {
      const record: IslamicContentRecord = {
        id: "hadith-min",
        type: "hadith",
        translatedText: "Take up good deeds only as much as you are able.",
        language: "en",
        collection: "Sahih al-Bukhari",
        reference: "Book 78, Hadith 120",
        grading: "Sahih",
        sourceUrl: "https://sunnah.com/bukhari:5861",
        tags: ["consistency"],
        reviewed: true,
        licenseNote: "Verified source attribution.",
      };

      expect(validateIslamicContentRecord(record)).toBe(true);
      const detailed = validateIslamicContentRecordDetailed(record);
      expect(detailed.isValid).toBe(true);
      expect(detailed.errors).toHaveLength(0);
    });

    it("rejects non-object, null, and primitive values", () => {
      expect(validateIslamicContentRecord(null)).toBe(false);
      expect(validateIslamicContentRecord(undefined)).toBe(false);
      expect(validateIslamicContentRecord("not an object")).toBe(false);
      expect(validateIslamicContentRecord(123)).toBe(false);
      expect(validateIslamicContentRecord([])).toBe(false);
    });

    it("rejects records with missing or empty id", () => {
      const record1 = createMockHadith({ id: "" });
      expect(validateIslamicContentRecord(record1)).toBe(false);

      const record2 = createMockHadith({ id: "   " });
      expect(validateIslamicContentRecord(record2)).toBe(false);
    });

    it("rejects records with invalid type", () => {
      const record = { ...createMockHadith(), type: "quote" };
      expect(validateIslamicContentRecord(record)).toBe(false);
      const detailed = validateIslamicContentRecordDetailed(record);
      expect(detailed.errors).toContain("Field 'type' must be 'hadith'");
    });

    it("rejects records with missing or empty translatedText or language", () => {
      const recordMissingText = createMockHadith({ translatedText: "" });
      expect(validateIslamicContentRecord(recordMissingText)).toBe(false);

      const recordMissingLang = createMockHadith({ language: "" });
      expect(validateIslamicContentRecord(recordMissingLang)).toBe(false);
    });

    it("rejects records with missing collection, reference, or grading", () => {
      expect(validateIslamicContentRecord(createMockHadith({ collection: "" }))).toBe(false);
      expect(validateIslamicContentRecord(createMockHadith({ reference: "" }))).toBe(false);
      expect(validateIslamicContentRecord(createMockHadith({ grading: "" }))).toBe(false);
    });

    it("rejects records with missing or invalid sourceUrl", () => {
      expect(validateIslamicContentRecord(createMockHadith({ sourceUrl: "" }))).toBe(false);
      expect(validateIslamicContentRecord(createMockHadith({ sourceUrl: "not-a-url" }))).toBe(false);
      expect(validateIslamicContentRecord(createMockHadith({ sourceUrl: "ftp://example.com/hadith" }))).toBe(false);
    });

    it("rejects records with empty tags array or non-string tag items", () => {
      expect(validateIslamicContentRecord(createMockHadith({ tags: [] }))).toBe(false);
      expect(
        validateIslamicContentRecord(
          createMockHadith({ tags: [""] as unknown as string[] }),
        ),
      ).toBe(false);
      expect(
        validateIslamicContentRecord(
          createMockHadith({ tags: [123 as unknown as string] }),
        ),
      ).toBe(false);
    });

    it("rejects records with non-boolean reviewed field", () => {
      const record = {
        ...createMockHadith(),
        reviewed: "true" as unknown as boolean,
      };
      expect(validateIslamicContentRecord(record)).toBe(false);
      const detailed = validateIslamicContentRecordDetailed(record);
      expect(detailed.errors).toContain("Field 'reviewed' must be a boolean");
    });

    it("rejects records with missing or empty licenseNote", () => {
      expect(validateIslamicContentRecord(createMockHadith({ licenseNote: "" }))).toBe(false);
      expect(validateIslamicContentRecord(createMockHadith({ licenseNote: "   " }))).toBe(false);
    });

    it("rejects records with non-string optional fields", () => {
      const record = {
        ...createMockHadith(),
        arabicText: 12345 as unknown as string,
      };
      expect(validateIslamicContentRecord(record)).toBe(false);
    });
  });

  describe("Unreviewed Content Exclusion", () => {
    it("excludes records where reviewed is false from eligible hadith", () => {
      const items: IslamicContentRecord[] = [
        createMockHadith({ id: "h1", reviewed: true }),
        createMockHadith({ id: "h2", reviewed: false }),
        createMockHadith({ id: "h3", reviewed: true }),
      ];

      const eligible = getEligibleHadith(items);
      expect(eligible.map((h) => h.id)).toEqual(["h1", "h3"]);
    });

    it("excludes invalid records even if reviewed is true", () => {
      const items = [
        createMockHadith({ id: "h1", reviewed: true }),
        { id: "h2", reviewed: true }, // invalid structure
        createMockHadith({ id: "h3", sourceUrl: "invalid-url", reviewed: true }),
      ];

      const eligible = getEligibleHadith(items);
      expect(eligible.map((h) => h.id)).toEqual(["h1"]);
    });

    it("identifies unreviewed records for audit and reporting", () => {
      const items: IslamicContentRecord[] = [
        createMockHadith({ id: "reviewed-1", reviewed: true }),
        createMockHadith({ id: "unreviewed-1", reviewed: false }),
        createMockHadith({ id: "unreviewed-2", reviewed: false }),
      ];

      const unreviewed = getUnreviewedHadith(items);
      expect(unreviewed).toHaveLength(2);
      expect(unreviewed.map((h) => h.id)).toEqual(["unreviewed-1", "unreviewed-2"]);
    });

    it("never selects unreviewed records during stable hadith selection", () => {
      const items: IslamicContentRecord[] = [
        createMockHadith({
          id: "unreviewed-patience",
          tags: ["patience"],
          reviewed: false,
        }),
        createMockHadith({
          id: "general-1",
          tags: ["general"],
          reviewed: true,
        }),
      ];

      // Request patience: unreviewed should be excluded and fall back to general-1
      const selected = selectStableHadith("patience", "2026-W36", items);
      expect(selected?.id).toBe("general-1");
    });
  });

  describe("Topic Filtering", () => {
    const fixtureList: IslamicContentRecord[] = [
      createMockHadith({
        id: "consistency-1",
        tags: ["consistency"],
        reviewed: true,
      }),
      createMockHadith({
        id: "patience-1",
        tags: ["patience"],
        reviewed: true,
      }),
      createMockHadith({
        id: "jamaah-1",
        tags: ["jamaah", "prayer"],
        reviewed: true,
      }),
      createMockHadith({
        id: "difficulty-1",
        tags: ["returning-after-difficulty"],
        reviewed: true,
      }),
    ];

    it("filters hadith matching exact topic tag", () => {
      expect(normalizeTopicTag("  Patience-Tag  ")).toBe("patience-tag");
      expect(normalizeTopicTag("returning after difficulty")).toBe("returning-after-difficulty");
      expect(normalizeTopicTag("returning_after_difficulty")).toBe("returning-after-difficulty");

      const results = getHadithForTopic("patience", fixtureList, false);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("patience-1");
    });

    it("supports case-insensitive matching and whitespace trimming", () => {
      const resultsUpper = getHadithForTopic("PATIENCE", fixtureList, false);
      expect(resultsUpper).toHaveLength(1);
      expect(resultsUpper[0].id).toBe("patience-1");

      const resultsTrim = getHadithForTopic("  patience  ", fixtureList, false);
      expect(resultsTrim).toHaveLength(1);
      expect(resultsTrim[0].id).toBe("patience-1");
    });

    it("normalizes hyphenated and space-separated topic tags", () => {
      const results = getHadithForTopic(
        "returning after difficulty",
        fixtureList,
        false,
      );
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("difficulty-1");

      const resultsUnder = getHadithForTopic(
        "returning_after_difficulty",
        fixtureList,
        false,
      );
      expect(resultsUnder).toHaveLength(1);
      expect(resultsUnder[0].id).toBe("difficulty-1");
    });

    it("returns empty array when topic has no matches and fallback is disabled", () => {
      const results = getHadithForTopic("non-existent", fixtureList, false);
      expect(results).toEqual([]);
    });
  });

  describe("General Fallback", () => {
    const fixtureWithGeneral: IslamicContentRecord[] = [
      createMockHadith({
        id: "general-1",
        tags: ["general"],
        reviewed: true,
      }),
      createMockHadith({
        id: "general-2",
        tags: ["general"],
        reviewed: true,
      }),
      createMockHadith({
        id: "patience-1",
        tags: ["patience"],
        reviewed: true,
      }),
    ];

    it("falls back to general topic when requested topic has no matching reviewed records", () => {
      const results = getHadithForTopic(
        "unknown-topic",
        fixtureWithGeneral,
        true,
      );
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.id)).toEqual(["general-1", "general-2"]);
    });

    it("does not fall back to general if the requested topic has matching records", () => {
      const results = getHadithForTopic("patience", fixtureWithGeneral, true);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("patience-1");
    });

    it("returns null in selectStableHadith if neither specific nor fallback exists", () => {
      const fixtureNoGeneral: IslamicContentRecord[] = [
        createMockHadith({
          id: "patience-1",
          tags: ["patience"],
          reviewed: true,
        }),
      ];

      const selected = selectStableHadith(
        "non-existent",
        "2026-W36",
        fixtureNoGeneral,
      );
      expect(selected).toBeNull();
    });

    it("allows specifying a custom fallback topic", () => {
      const fixtureCustom: IslamicContentRecord[] = [
        createMockHadith({
          id: "hope-1",
          tags: ["hope"],
          reviewed: true,
        }),
      ];

      const results = getHadithForTopic(
        "missing-topic",
        fixtureCustom,
        true,
        "hope",
      );
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("hope-1");
    });
  });

  describe("Deterministic Selection", () => {
    const candidates: IslamicContentRecord[] = [
      createMockHadith({ id: "h-01", tags: ["consistency"], reviewed: true }),
      createMockHadith({ id: "h-02", tags: ["consistency"], reviewed: true }),
      createMockHadith({ id: "h-03", tags: ["consistency"], reviewed: true }),
      createMockHadith({ id: "h-04", tags: ["consistency"], reviewed: true }),
    ];

    it("consistently selects the exact same record for the same period key and topic", () => {
      const periodKey = "2026-W36";
      const topic = "consistency";

      const firstChoice = selectStableHadith(topic, periodKey, candidates);
      expect(firstChoice).not.toBeNull();

      for (let i = 0; i < 20; i++) {
        const repeat = selectStableHadith(topic, periodKey, candidates);
        expect(repeat?.id).toBe(firstChoice?.id);
      }
    });

    it("is independent of the input array order (deterministic ID sorting)", () => {
      const periodKey = "2026-W36";
      const topic = "consistency";

      const forwardList = [...candidates];
      const reversedList = [...candidates].reverse();
      const shuffledList = [candidates[2], candidates[0], candidates[3], candidates[1]];

      const choice1 = selectStableHadith(topic, periodKey, forwardList);
      const choice2 = selectStableHadith(topic, periodKey, reversedList);
      const choice3 = selectStableHadith(topic, periodKey, shuffledList);

      expect(choice1?.id).toBe(choice2?.id);
      expect(choice2?.id).toBe(choice3?.id);
    });

    it("deterministically calculates hash using FNV-1a", () => {
      const h1 = computeDeterministicHash("test-key");
      const h2 = computeDeterministicHash("test-key");
      const h3 = computeDeterministicHash("other-key");

      expect(h1).toBe(h2);
      expect(h1).not.toBe(h3);
    });
  });

  describe("Avoiding Consecutive Repeats", () => {
    const candidates: IslamicContentRecord[] = [
      createMockHadith({ id: "h-alpha", tags: ["consistency"], reviewed: true }),
      createMockHadith({ id: "h-beta", tags: ["consistency"], reviewed: true }),
      createMockHadith({ id: "h-gamma", tags: ["consistency"], reviewed: true }),
    ];

    it("excludes previousHadithId when alternatives exist", () => {
      const periodKey = "2026-W36";
      const topic = "consistency";

      const initial = selectStableHadith(topic, periodKey, candidates);
      expect(initial).not.toBeNull();

      // Passing previousHadithId must exclude initial hadith from selection
      const next = selectStableHadith(topic, periodKey, candidates, initial?.id);
      expect(next?.id).not.toBe(initial?.id);

      // Same with options object
      const nextViaOptions = selectStableHadith(topic, periodKey, candidates, {
        previousHadithId: initial?.id,
      });
      expect(nextViaOptions?.id).not.toBe(initial?.id);
    });

    it("progresses to a different hadith on consecutive period keys without repeating", () => {
      const topic = "consistency";
      const period1 = "2026-W36";
      const period2 = "2026-W37";

      const choice1 = selectStableHadith(topic, period1, candidates);
      const choice2 = selectStableHadith(topic, period2, candidates);

      expect(choice1).not.toBeNull();
      expect(choice2).not.toBeNull();
      expect(choice1?.id).not.toBe(choice2?.id);
    });

    it("progresses across sequential snapshot IDs without repeating", () => {
      const topic = "consistency";
      const p1 = "snapshot-1";
      const p2 = "snapshot-2";

      const choice1 = selectStableHadith(topic, p1, candidates);
      const choice2 = selectStableHadith(topic, p2, candidates);

      expect(choice1?.id).not.toBe(choice2?.id);
    });

    it("returns the single candidate when only 1 alternative exists even if it matches previousHadithId", () => {
      const singleCandidate = [
        createMockHadith({ id: "h-only-one", tags: ["patience"], reviewed: true }),
      ];

      const result = selectStableHadith(
        "patience",
        "2026-W36",
        singleCandidate,
        "h-only-one",
      );
      expect(result).not.toBeNull();
      expect(result?.id).toBe("h-only-one");
    });
  });

  describe("Empty Content", () => {
    it("returns empty array for empty content in getEligibleHadith", () => {
      expect(getEligibleHadith([])).toEqual([]);
    });

    it("returns empty array for empty content in getHadithForTopic", () => {
      expect(getHadithForTopic("consistency", [])).toEqual([]);
    });

    it("returns null for empty content in selectStableHadith", () => {
      expect(selectStableHadith("consistency", "2026-W36", [])).toBeNull();
    });

    it("handles null or undefined content safely without throwing", () => {
      expect(getEligibleHadith(null)).toEqual([]);
      expect(getEligibleHadith(undefined)).toEqual([]);

      expect(getUnreviewedHadith(null)).toEqual([]);
      expect(getUnreviewedHadith(undefined)).toEqual([]);

      expect(getHadithForTopic("consistency", null)).toEqual([]);
      expect(getHadithForTopic("consistency", undefined)).toEqual([]);

      expect(selectStableHadith("consistency", "2026-W36", null)).toBeNull();
      expect(selectStableHadith("consistency", "2026-W36", undefined)).toBeNull();
    });
  });

  describe("Format Reflection", () => {
    it("formats selected hadith reflection for immutable trend snapshot embedding", () => {
      const record = createMockHadith();
      const reflection = formatSelectedHadithReflection(record, "consistency");

      expect(reflection).toEqual({
        id: "test-hadith-1",
        arabicText: "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ",
        translatedText: "Actions are judged by intentions.",
        displayText: "Actions are judged by intentions.",
        topic: "consistency",
        collection: "Sahih al-Bukhari",
        reference: "Book 1, Hadith 1",
        grading: "Sahih",
        gradingAuthority: "Al-Bukhari",
        sourceUrl: "https://sunnah.com/bukhari:1",
      });
    });
  });

  describe("Bundled Content Dataset Integrity", () => {
    it("validates that all records in bundledIslamicContent have valid schema", () => {
      expect(bundledIslamicContent.length).toBeGreaterThanOrEqual(35);

      for (const record of bundledIslamicContent) {
        const validation = validateIslamicContentRecordDetailed(record);
        expect(validation.isValid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      }
    });

    it("ensures all core trend analysis topics have reviewed hadiths in the bundled dataset", () => {
      const coreTopics = [
        "consistency",
        "patience",
        "returning-after-difficulty",
        "good-deeds",
        "jamaah",
        "time-and-prayer",
        "general",
      ];

      const eligible = getEligibleHadith(
        bundledIslamicContent as IslamicContentRecord[],
      );

      for (const topic of coreTopics) {
        const matching = getHadithForTopic(
          topic,
          eligible,
          false,
        );
        expect(
          matching.length,
          `Expected topic "${topic}" to have at least 1 reviewed hadith in bundled content`,
        ).toBeGreaterThanOrEqual(1);
      }
    });

    it("deterministically selects hadith for every topic across consecutive periods", () => {
      const coreTopics = [
        "consistency",
        "patience",
        "returning-after-difficulty",
        "good-deeds",
        "jamaah",
        "time-and-prayer",
      ];

      for (const topic of coreTopics) {
        const h1 = selectStableHadith(
          topic,
          "2026-W36",
          bundledIslamicContent as IslamicContentRecord[],
        );
        const h2 = selectStableHadith(
          topic,
          "2026-W37",
          bundledIslamicContent as IslamicContentRecord[],
        );

        expect(h1).not.toBeNull();
        expect(h2).not.toBeNull();
        expect(h1?.reviewed).toBe(true);
        expect(h2?.reviewed).toBe(true);
      }
    });
  });
});

