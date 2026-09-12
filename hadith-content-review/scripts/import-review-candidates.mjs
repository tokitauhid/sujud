import fs from "node:fs/promises";

const count = Number(process.argv[2] || 100);
const outputPath = process.argv[3] || "review-candidates.json";
const maxCharacters = 320;
const sourceUrl =
  "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/eng-bukhari.json";
const topicPatterns = [
  /prayer|pray|mosque|congregation|masjid|fajr|isha|maghrib|asr|dhuhr/gi,
  /deed|worship|faith|belief|intention|regular|constant|good deed/gi,
  /mercy|forgiv|repent|hope|patien|sorrow|distress|hardship|difficulty/gi,
  /charity|sadaqa|remembrance|remember|obedience|supplication/gi,
];

if (!Number.isInteger(count) || count < 1 || count > 1000) {
  throw new Error("Count must be an integer between 1 and 1000");
}

const response = await fetch(sourceUrl);
if (!response.ok) throw new Error(`Hadith source request failed: ${response.status}`);
const source = await response.json();

const candidates = source.hadiths
  .map((hadith) => {
    const score = topicPatterns.reduce(
      (total, pattern) => total + (hadith.text.match(pattern) || []).length,
      0,
    );
    return { hadith, score };
  })
  .filter(({ hadith, score }) => score > 0 && hadith.text.length <= maxCharacters)
  .sort((a, b) => b.score - a.score || a.hadith.hadithnumber - b.hadith.hadithnumber)
  .slice(0, count)
  .map(({ hadith }) => ({
    id: `bukhari-${hadith.hadithnumber}`,
    type: "hadith",
    translatedText: hadith.text,
    language: "en",
    narrator: null,
    collection: "Sahih al-Bukhari",
    reference: `Hadith ${hadith.hadithnumber}`,
    grading: "Review required",
    gradingAuthority: null,
    sourceUrl: `https://sunnah.com/bukhari:${hadith.hadithnumber}`,
    tags: ["general"],
    reviewed: false,
    licenseNote:
      "Candidate imported from fawazahmed0/hadith-api; verify translation redistribution permission before use.",
  }));

if (candidates.length !== count) {
  throw new Error(`Expected ${count} candidates, received ${candidates.length}`);
}

await fs.writeFile(outputPath, `${JSON.stringify(candidates, null, 2)}\n`);
console.log(`Wrote ${candidates.length} candidates to ${outputPath}`);
