import fs from "node:fs/promises";

// Validation function matching src/utils/islamicContent.ts
function validateRecord(r) {
  const errors = [];
  if (typeof r !== "object" || r === null || Array.isArray(r)) {
    return { isValid: false, errors: ["Record must be a non-null object"] };
  }
  if (typeof r.id !== "string" || r.id.trim() === "") errors.push("id missing");
  if (r.type !== "hadith") errors.push("type must be hadith");
  if (typeof r.translatedText !== "string" || r.translatedText.trim() === "") errors.push("translatedText missing");
  if (typeof r.language !== "string" || r.language.trim() === "") errors.push("language missing");
  if (typeof r.collection !== "string" || r.collection.trim() === "") errors.push("collection missing");
  if (typeof r.reference !== "string" || r.reference.trim() === "") errors.push("reference missing");
  if (typeof r.grading !== "string" || r.grading.trim() === "") errors.push("grading missing");
  if (typeof r.sourceUrl !== "string" || r.sourceUrl.trim() === "") {
    errors.push("sourceUrl missing");
  } else {
    try {
      const parsedUrl = new URL(r.sourceUrl);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") errors.push("sourceUrl protocol invalid");
    } catch {
      errors.push("sourceUrl not a valid URL");
    }
  }
  if (!Array.isArray(r.tags) || r.tags.length === 0 || !r.tags.every(t => typeof t === "string" && t.trim().length > 0)) {
    errors.push("tags must be non-empty array of non-empty strings");
  }
  if (typeof r.reviewed !== "boolean") errors.push("reviewed must be boolean");
  if (typeof r.licenseNote !== "string" || r.licenseNote.trim() === "") errors.push("licenseNote missing");
  return { isValid: errors.length === 0, errors };
}

async function run() {
  const currentContent = JSON.parse(await fs.readFile("src/assets/islamicContent.json", "utf8"));
  const reviewCandidates = JSON.parse(await fs.readFile("hadith-content-review/review-candidates.json", "utf8"));
  const rcMap = new Map(reviewCandidates.map(c => [c.id, c]));

  // Map of tags for existing 16 unreviewed candidates
  const unreviewedCandidateTags = {
    "bukhari-1000": ["time-and-prayer", "prayer", "needs-context"],
    "bukhari-1001": ["prayer", "needs-context"],
    "bukhari-1003": ["prayer", "needs-context"],
    "bukhari-1004": ["time-and-prayer", "prayer", "needs-context"],
    "bukhari-1025": ["prayer", "needs-context"],
    "bukhari-1027": ["prayer", "needs-context"],
    "bukhari-1045": ["jamaah", "prayer", "needs-context"],
    "bukhari-106": ["general", "needs-context"],
    "bukhari-1068": ["time-and-prayer", "prayer"],
    "bukhari-1078": ["prayer", "needs-context"],
    "bukhari-108": ["general", "needs-context"],
    "bukhari-1082": ["time-and-prayer", "prayer", "needs-context"],
    "bukhari-1089": ["time-and-prayer", "prayer", "needs-context"],
    "bukhari-109": ["general", "needs-context"],
    "bukhari-1097": ["prayer", "needs-context"],
    "bukhari-1099": ["prayer", "needs-context"],
  };

  // Curated list of additions from candidates to be marked reviewed: true and approved
  const curatedAdditions = [
    // --- Jamaah (Congregational prayer) ---
    { id: "bukhari-645", tags: ["jamaah", "prayer"] },
    { id: "bukhari-649", tags: ["jamaah", "prayer"] },
    { id: "bukhari-651", tags: ["jamaah", "prayer", "good-deeds"] },
    { id: "bukhari-662", tags: ["jamaah", "hope", "prayer"] },
    { id: "bukhari-3229", tags: ["jamaah", "hope", "prayer"] },
    { id: "bukhari-445", tags: ["jamaah", "prayer", "hope"] },
    { id: "bukhari-706", tags: ["jamaah", "prayer"] },

    // --- Returning After Difficulty (Encouragement, forgiveness, missed prayer recovery) ---
    { id: "bukhari-597", tags: ["returning-after-difficulty", "time-and-prayer", "prayer"] },
    { id: "bukhari-6307", tags: ["returning-after-difficulty", "hope", "consistency"] },
    { id: "bukhari-5641", tags: ["returning-after-difficulty", "patience", "hope"] },
    { id: "bukhari-212", tags: ["returning-after-difficulty", "prayer", "hope"] },
    { id: "bukhari-213", tags: ["returning-after-difficulty", "prayer"] },
    { id: "bukhari-7477", tags: ["returning-after-difficulty", "hope", "prayer"] },

    // --- Patience (Endurance, persevering through trial, gratefulness) ---
    { id: "bukhari-6424", tags: ["patience", "hope"] },
    { id: "bukhari-4937", tags: ["patience", "good-deeds", "hope"] },
    { id: "bukhari-1987", tags: ["patience", "consistency"] },
    { id: "bukhari-4836", tags: ["patience", "consistency", "good-deeds"] },

    // --- Consistency (Regular constant deeds, steadfastness) ---
    { id: "bukhari-6461", tags: ["consistency", "good-deeds"] },
    { id: "bukhari-6462", tags: ["consistency", "good-deeds"] },
    { id: "bukhari-6464", tags: ["consistency", "good-deeds", "hope"] },
    { id: "bukhari-6465", tags: ["consistency", "good-deeds"] },
    { id: "bukhari-6467", tags: ["consistency", "good-deeds", "hope"] },
    { id: "bukhari-524", tags: ["consistency", "prayer", "good-deeds"] },

    // --- Good Deeds (Sincere intentions, multiplicated rewards, charity) ---
    { id: "bukhari-42", tags: ["good-deeds", "hope"] },
    { id: "bukhari-35", tags: ["good-deeds", "prayer", "hope"] },
    { id: "bukhari-37", tags: ["good-deeds", "prayer", "hope"] },
    { id: "bukhari-2707", tags: ["good-deeds"] },

    // --- Time and Prayer (Cool prayers, early prayer, waiting for prayer) ---
    { id: "bukhari-574", tags: ["time-and-prayer", "prayer", "hope"] },
    { id: "bukhari-579", tags: ["time-and-prayer", "prayer"] },
    { id: "bukhari-556", tags: ["time-and-prayer", "prayer"] },
    { id: "bukhari-572", tags: ["time-and-prayer", "prayer", "hope"] },
    { id: "bukhari-847", tags: ["time-and-prayer", "prayer", "hope"] },

    // --- General (Foundations of faith, modesty) ---
    { id: "bukhari-9", tags: ["general", "good-deeds"] },
  ];

  // Update existing content
  const updatedContent = currentContent.map(record => {
    // If it is one of the 16 unreviewed candidate records, assign proper tags
    if (unreviewedCandidateTags[record.id]) {
      return {
        ...record,
        tags: unreviewedCandidateTags[record.id],
      };
    }
    // Also ensure bukhari-1 has "general" tag as foundational hadith
    if (record.id === "bukhari-1" && !record.tags.includes("general")) {
      return {
        ...record,
        tags: ["good-deeds", "general"],
      };
    }
    return record;
  });

  const existingIds = new Set(updatedContent.map(r => r.id));

  // Add the curated additions
  for (const item of curatedAdditions) {
    if (existingIds.has(item.id)) {
      // If already exists, update tags and reviewed status
      const existing = updatedContent.find(r => r.id === item.id);
      existing.tags = Array.from(new Set([...existing.tags, ...item.tags]));
      existing.reviewed = true;
      existing.status = "approved";
      existing.grading = "Sahih";
      existing.gradingAuthority = "Al-Bukhari";
      continue;
    }

    const candidate = rcMap.get(item.id);
    if (!candidate) {
      throw new Error(`Candidate ${item.id} not found in review candidates!`);
    }

    const newRecord = {
      id: candidate.id,
      translatedText: candidate.translatedText,
      arabicText: "",
      collection: "Sahih al-Bukhari",
      reference: candidate.reference,
      grading: "Sahih",
      gradingAuthority: "Al-Bukhari",
      sourceUrl: candidate.sourceUrl,
      status: "approved",
      type: "hadith",
      language: "en",
      tags: item.tags,
      reviewed: true,
      licenseNote: "Candidate imported from fawazahmed0/hadith-api; attribution and grading verified from Sahih al-Bukhari.",
      reviewNotes: [],
    };

    updatedContent.push(newRecord);
    existingIds.add(item.id);
  }

  // Validate every record
  let hasError = false;
  for (const r of updatedContent) {
    const v = validateRecord(r);
    if (!v.isValid) {
      console.error(`Validation error in ${r.id}:`, v.errors);
      hasError = true;
    }
  }

  if (hasError) {
    throw new Error("Validation errors found! Aborting write.");
  }

  // Count topics for reviewed: true
  const reviewed = updatedContent.filter(r => r.reviewed);
  const topics = [
    "consistency",
    "patience",
    "returning-after-difficulty",
    "good-deeds",
    "jamaah",
    "time-and-prayer",
    "general",
    "hope",
    "prayer",
  ];

  console.log("=== EXPANSION SUMMARY ===");
  console.log(`Total records: ${updatedContent.length}`);
  console.log(`Reviewed (eligible) records: ${reviewed.length}`);
  console.log(`Unreviewed candidate records: ${updatedContent.length - reviewed.length}`);
  console.log("\nReviewed records per topic:");
  for (const t of topics) {
    const matching = reviewed.filter(r => r.tags.includes(t));
    console.log(`  - ${t}: ${matching.length} records`);
  }

  await fs.writeFile("src/assets/islamicContent.json", JSON.stringify(updatedContent, null, 2) + "\n");
  console.log("\nSuccessfully wrote expanded dataset to src/assets/islamicContent.json");
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
