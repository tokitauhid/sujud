import {
  ContentValidationResult,
  IslamicContentRecord,
  SelectHadithOptions,
  SelectedHadithReflection,
} from "../types/islamicContent";

/**
 * Normalizes a topic or tag string for consistent comparison.
 * Trims whitespace, converts to lowercase, and normalizes hyphens/underscores/spaces.
 */
export const normalizeTopicTag = (tag: string): string => {
  return tag
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

/**
 * Validates an Islamic content record and provides detailed errors for auditing and tests.
 */
export const validateIslamicContentRecordDetailed = (
  record: unknown,
): ContentValidationResult => {
  const errors: string[] = [];

  if (typeof record !== "object" || record === null || Array.isArray(record)) {
    return {
      isValid: false,
      errors: ["Record must be a non-null object"],
    };
  }

  const r = record as Record<string, unknown>;

  if (typeof r.id !== "string" || r.id.trim() === "") {
    errors.push("Field 'id' must be a non-empty string");
  }

  if (r.type !== "hadith") {
    errors.push("Field 'type' must be 'hadith'");
  }

  if (typeof r.translatedText !== "string" || r.translatedText.trim() === "") {
    errors.push("Field 'translatedText' must be a non-empty string");
  }

  if (typeof r.language !== "string" || r.language.trim() === "") {
    errors.push("Field 'language' must be a non-empty string");
  }

  if (typeof r.collection !== "string" || r.collection.trim() === "") {
    errors.push("Field 'collection' must be a non-empty string");
  }

  if (typeof r.reference !== "string" || r.reference.trim() === "") {
    errors.push("Field 'reference' must be a non-empty string");
  }

  if (typeof r.grading !== "string" || r.grading.trim() === "") {
    errors.push("Field 'grading' must be a non-empty string");
  }

  if (typeof r.sourceUrl !== "string" || r.sourceUrl.trim() === "") {
    errors.push("Field 'sourceUrl' must be a non-empty string");
  } else {
    try {
      const parsedUrl = new URL(r.sourceUrl);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        errors.push("Field 'sourceUrl' must have http or https protocol");
      }
    } catch {
      errors.push("Field 'sourceUrl' must be a valid URL");
    }
  }

  if (
    !Array.isArray(r.tags) ||
    r.tags.length === 0 ||
    !r.tags.every((t) => typeof t === "string" && t.trim().length > 0)
  ) {
    errors.push("Field 'tags' must be a non-empty array of non-empty strings");
  }

  if (typeof r.reviewed !== "boolean") {
    errors.push("Field 'reviewed' must be a boolean");
  }

  if (typeof r.licenseNote !== "string" || r.licenseNote.trim() === "") {
    errors.push("Field 'licenseNote' must be a non-empty string");
  }

  if (
    r.arabicText !== undefined &&
    r.arabicText !== null &&
    typeof r.arabicText !== "string"
  ) {
    errors.push("Field 'arabicText' must be a string or null/undefined");
  }

  if (
    r.narrator !== undefined &&
    r.narrator !== null &&
    typeof r.narrator !== "string"
  ) {
    errors.push("Field 'narrator' must be a string or null/undefined");
  }

  if (
    r.gradingAuthority !== undefined &&
    r.gradingAuthority !== null &&
    typeof r.gradingAuthority !== "string"
  ) {
    errors.push("Field 'gradingAuthority' must be a string or null/undefined");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Type guard to validate whether an unknown record conforms to IslamicContentRecord.
 */
export const validateIslamicContentRecord = (
  record: unknown,
): record is IslamicContentRecord => {
  return validateIslamicContentRecordDetailed(record).isValid;
};

/**
 * Returns all valid records that have reviewed: true.
 * Records failing schema validation or marked reviewed: false are excluded.
 */
export const getEligibleHadith = (
  content: unknown[] | null | undefined,
): IslamicContentRecord[] => {
  if (!Array.isArray(content)) {
    return [];
  }

  return content.filter(
    (record): record is IslamicContentRecord =>
      validateIslamicContentRecord(record) && record.reviewed === true,
  );
};

/**
 * Identifies unreviewed records in the dataset for content auditing and editorial reports.
 */
export const getUnreviewedHadith = (
  content: unknown[] | null | undefined,
): IslamicContentRecord[] => {
  if (!Array.isArray(content)) {
    return [];
  }

  return content.filter((record): record is IslamicContentRecord => {
    if (typeof record !== "object" || record === null) {
      return false;
    }
    const r = record as Record<string, unknown>;
    return r.reviewed === false;
  });
};

/**
 * Filters eligible hadith matching a specific topic.
 * Falls back to general encouragement hadith if no specific records exist and allowFallback is true.
 */
export const getHadithForTopic = (
  topic: string,
  content: IslamicContentRecord[] | null | undefined,
  allowFallback = true,
  fallbackTopic = "general",
): IslamicContentRecord[] => {
  const eligible = getEligibleHadith(content);
  if (eligible.length === 0) {
    return [];
  }

  const normalizedTopic = normalizeTopicTag(topic);
  const directMatches = eligible.filter((item) =>
    item.tags.some((tag) => normalizeTopicTag(tag) === normalizedTopic),
  );

  if (directMatches.length > 0) {
    return directMatches;
  }

  if (allowFallback && normalizedTopic !== normalizeTopicTag(fallbackTopic)) {
    const normalizedFallback = normalizeTopicTag(fallbackTopic);
    return eligible.filter((item) =>
      item.tags.some((tag) => normalizeTopicTag(tag) === normalizedFallback),
    );
  }

  return [];
};

/**
 * Deterministic 32-bit FNV-1a hash function.
 */
export const computeDeterministicHash = (str: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

/**
 * Extracts a sequential step from common period keys (ISO week, dates, period numbers)
 * to guarantee progressive selection across consecutive periods even without previousHadithId.
 */
export const extractSequenceStep = (periodKey: string): number | null => {
  // 1. ISO week format, e.g. "2026-W36" or "2026W36"
  const weekMatch = periodKey.match(/(\d{4})-?W(\d{1,2})/i);
  if (weekMatch) {
    const year = parseInt(weekMatch[1], 10);
    const week = parseInt(weekMatch[2], 10);
    return year * 53 + week;
  }

  // 2. Month format, e.g. "2026-09"
  const monthMatch = periodKey.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const year = parseInt(monthMatch[1], 10);
    const month = parseInt(monthMatch[2], 10);
    return year * 12 + month;
  }

  // 3. Full date format, e.g. "2026-09-01"
  const dateMatch = periodKey.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) {
    const parsed = Date.parse(dateMatch[0]);
    if (!isNaN(parsed)) {
      return Math.floor(parsed / 86400000);
    }
  }

  // 4. Trailing integer, e.g. "period-1", "week_2", "snapshot-3"
  const trailingMatch = periodKey.match(/[-_:\s](\d+)$/);
  if (trailingMatch) {
    return parseInt(trailingMatch[1], 10);
  }

  return null;
};

/**
 * Selects a stable, deterministic hadith for a given topic and period key.
 *
 * Requirements:
 * - Excludes unreviewed records.
 * - Filters by topic tags.
 * - Falls back to general encouragement when topic has no direct matches.
 * - Returns null when no valid content is available.
 * - Avoids selecting the same hadith repeatedly for consecutive periods when alternatives exist.
 */
export const selectStableHadith = (
  topic: string,
  periodKey: string,
  content: IslamicContentRecord[] | null | undefined,
  optionsOrPreviousId?: string | null | SelectHadithOptions,
): IslamicContentRecord | null => {
  if (!Array.isArray(content) || content.length === 0) {
    return null;
  }

  let previousHadithId: string | null = null;
  let fallbackTopic = "general";

  if (typeof optionsOrPreviousId === "string") {
    previousHadithId = optionsOrPreviousId;
  } else if (optionsOrPreviousId && typeof optionsOrPreviousId === "object") {
    if (optionsOrPreviousId.previousHadithId !== undefined) {
      previousHadithId = optionsOrPreviousId.previousHadithId;
    }
    if (optionsOrPreviousId.fallbackTopic) {
      fallbackTopic = optionsOrPreviousId.fallbackTopic;
    }
  }

  const candidates = getHadithForTopic(topic, content, true, fallbackTopic);
  if (candidates.length === 0) {
    return null;
  }

  // Deterministically sort candidates by id to eliminate input ordering dependency
  const sorted = [...candidates].sort((a, b) => a.id.localeCompare(b.id));

  if (sorted.length === 1) {
    return sorted[0];
  }

  // Avoid repeating previous hadith if alternatives exist
  let pool = sorted;
  if (previousHadithId) {
    const withoutPrevious = sorted.filter((h) => h.id !== previousHadithId);
    if (withoutPrevious.length > 0) {
      pool = withoutPrevious;
    }
  }

  // Choose deterministically based on periodKey and topic
  const seq = extractSequenceStep(periodKey);
  let index: number;

  if (seq !== null) {
    const topicHash = computeDeterministicHash(topic);
    index = Math.abs((topicHash + seq) % pool.length);
  } else {
    const hash = computeDeterministicHash(`${periodKey}:${topic}`);
    index = hash % pool.length;
  }

  return pool[index];
};

/**
 * Prepares a selected hadith for embedding into snapshot summary metadata.
 */
export const formatSelectedHadithReflection = (
  record: IslamicContentRecord,
  topic: string,
): SelectedHadithReflection => {
  return {
    id: record.id,
    arabicText: record.arabicText ?? null,
    translatedText: record.translatedText,
    displayText: record.translatedText,
    topic,
    collection: record.collection,
    reference: record.reference,
    grading: record.grading,
    gradingAuthority: record.gradingAuthority ?? null,
    sourceUrl: record.sourceUrl,
  };
};
