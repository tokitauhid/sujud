export type IslamicContentType = "hadith";

export type IslamicContentTopic =
  | "consistency"
  | "patience"
  | "returning-after-difficulty"
  | "good-deeds"
  | "jamaah"
  | "time-and-prayer"
  | "general"
  | string;

export interface IslamicContentRecord {
  id: string;
  type: IslamicContentType;
  arabicText?: string | null;
  translatedText: string;
  language: string;
  narrator?: string | null;
  collection: string;
  reference: string;
  grading: string;
  gradingAuthority?: string | null;
  sourceUrl: string;
  tags: string[];
  reviewed: boolean;
  licenseNote: string;
}

export interface SelectedHadithReflection {
  id: string;
  arabicText?: string | null;
  translatedText: string;
  displayText?: string;
  topic: string;
  collection: string;
  reference: string;
  grading: string;
  gradingAuthority?: string | null;
  sourceUrl: string;
}

export interface ContentValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface SelectHadithOptions {
  previousHadithId?: string | null;
  fallbackTopic?: string;
}
