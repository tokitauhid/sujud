import fs from "node:fs/promises";

const inputPath = process.argv[2];
const outputPath = process.argv[3] || "seed-candidates.sql";

if (!inputPath) {
  console.error("Usage: node scripts/generate-seed-sql.mjs candidates.json [output.sql]");
  process.exit(1);
}

const records = JSON.parse(await fs.readFile(inputPath, "utf8"));
if (!Array.isArray(records)) throw new Error("Expected a JSON array");

const sqlValue = (value) => `'${String(value ?? "").replaceAll("'", "''")}'`;
const statements = records.map((record) => {
  if (!record.id || !record.translatedText || !record.collection || !record.reference || !record.sourceUrl) {
    throw new Error(`Missing required candidate fields: ${record.id || "unknown"}`);
  }
  return `INSERT OR IGNORE INTO candidates (id, translated_text, arabic_text, collection, reference, grading, source_url) VALUES (${[
    record.id,
    record.translatedText,
    record.arabicText,
    record.collection,
    record.reference,
    record.grading || "Review required",
    record.sourceUrl,
  ].map(sqlValue).join(", ")});`;
});

await fs.writeFile(outputPath, `${statements.join("\n")}\n`);
console.log(`Wrote ${statements.length} candidate inserts to ${outputPath}`);
