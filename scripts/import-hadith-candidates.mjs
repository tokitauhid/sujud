import fs from "node:fs/promises";

const sourceUrl =
  "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/eng-bukhari.json";
const outputPath = new URL(
  "../src/assets/islamicContent.candidates.json",
  import.meta.url,
);
const selectedHadithNumbers = [
  1, 39, 40, 41, 52, 56, 601, 602, 613, 646, 987, 1180, 1893, 2008,
  2010, 2011, 2697, 3223, 5641, 5673, 5748, 5982, 6018, 6021, 6137,
  6464, 6465, 6475, 6502, 7405,
];

const response = await fetch(sourceUrl);
if (!response.ok) {
  throw new Error(`Hadith source request failed: ${response.status}`);
}

const source = await response.json();
const selectedNumbers = new Set(selectedHadithNumbers);
const candidates = source.hadiths
  .filter((hadith) => selectedNumbers.has(hadith.hadithnumber))
  .map((hadith) => ({
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

if (candidates.length !== selectedHadithNumbers.length) {
  throw new Error(
    `Expected ${selectedHadithNumbers.length} candidates, received ${candidates.length}`,
  );
}

await fs.writeFile(outputPath, `${JSON.stringify(candidates, null, 2)}\n`);
console.log(`Wrote ${candidates.length} candidates to ${outputPath.pathname}`);
