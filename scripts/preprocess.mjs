#!/usr/bin/env node
/**
 * Preprocess NZ MP & Minister expense data
 * - Normalize names (strip newlines, footnotes, fix formats)
 * - Convert MP "Last, First" → "First Last" to match minister format
 * - Filter bad minister records (numeric name fields)
 * - Merge datasets with role tagging
 * - Output clean JSON to public/data/expenses.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ─── Load raw data ──────────────────────────────────────────────────────
const mpRaw = JSON.parse(
  readFileSync(join(ROOT, "data/processed/mp_expenses.json"), "utf-8")
);
const minRaw = JSON.parse(
  readFileSync(join(ROOT, "data/processed/minister_expenses.json"), "utf-8")
);

console.log(`Loaded ${mpRaw.length} MP records, ${minRaw.length} minister records`);

// ─── Name normalization helpers ─────────────────────────────────────────

function cleanName(name) {
  if (!name) return "";
  // Remove newlines
  let n = name.replace(/\n/g, "").replace(/\r/g, "");
  // Remove footnote markers like (1), (2)(3), (1)(2), etc.
  n = n.replace(/\s*\(\d+\)(\(\d+\))*/g, "");
  // Remove letter footnote markers like (A), (B), (D), etc.
  n = n.replace(/\s*\([A-Z]\)/g, "");
  // Remove trailing " MP" designation (e.g. "Simon Court MP", "John Hayes MP")
  n = n.replace(/\s+MP\b/gi, "");
  // Remove prefixes: Hon, Rt Hon, Dr, Sir, Dame
  n = n.replace(/\b(?:Hon|Rt Hon|Right Hon|Dr|Sir|Dame)\.?\s+/gi, "");
  // Collapse multiple spaces
  n = n.replace(/\s+/g, " ").trim();
  return n;
}

function lastFirstToFirstLast(name) {
  // "Adams, Amy" → "Amy Adams"
  // "Kanongata'A-Suisuiki, Anahila" → "Anahila Kanongata'A-Suisuiki"
  if (name.includes(",")) {
    const parts = name.split(",").map((s) => s.trim());
    if (parts.length === 2 && parts[1]) {
      return `${parts[1]} ${parts[0]}`;
    }
  }
  return name;
}

function normalizeName(name) {
  let n = cleanName(name);
  n = lastFirstToFirstLast(n);
  // Title case normalization for consistency
  // Handle cases like "Mcanulty" → "McAnulty" - but let's keep original casing mostly
  return n;
}

function normalizeMinisterName(name) {
  let n = cleanName(name);
  // Minister names are already "First Last" - just clean them
  return n;
}

// ─── Process MP records ─────────────────────────────────────────────────

const mpRecords = mpRaw.map((r) => ({
  year: r.year,
  quarter: r.quarter,
  party: r.party,
  name: normalizeName(r.name),
  rawName: r.name,
  wellington_accommodation: r.wellington_accommodation || 0,
  other_accommodation: r.other_accommodation || 0,
  domestic_air_travel: r.domestic_air_travel || 0,
  surface_travel: r.surface_travel || 0,
  international_travel: r.international_travel || 0,
  total: r.total || 0,
  source: "mp",
}));

// ─── Process Minister records ───────────────────────────────────────────

// Filter out bad records where name is numeric
const validMinRecords = minRaw.filter((r) => {
  if (!r.name) return false;
  // Check if name starts with a digit (aggregate rows)
  return !/^\d/.test(r.name.trim());
});

console.log(
  `Filtered minister records: ${validMinRecords.length} valid out of ${minRaw.length}`
);

const ministerRecords = validMinRecords.map((r) => ({
  year: r.year,
  quarter: r.quarter,
  party: r.party,
  name: normalizeMinisterName(r.name),
  rawName: r.name,
  wellington_accommodation: r.wellington_accommodation || 0,
  other_accommodation: r.other_accommodation || 0,
  domestic_air_travel: r.domestic_air_travel || 0,
  surface_travel: r.surface_travel || 0,
  international_travel: r.international_travel || 0,
  total: r.total || 0,
  source: "minister",
}));

// ─── Deduplicate name variants ──────────────────────────────────────────

// Build canonical name lookup: normalize to lowercase-alpha key,
// pick the most common form as canonical
function buildCanonicalMap(records) {
  const variants = new Map(); // key → Map<name, count>
  for (const r of records) {
    const n = r.name.replace(/\s?\*$/, "").trim(); // strip trailing asterisks
    
    // Normalize unicode to ascii, strip special characters, split into components, sort, and recombine
    let asciiName = n.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const key = asciiName.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).sort().join("");
    
    if (!variants.has(key)) variants.set(key, new Map());
    const counts = variants.get(key);
    counts.set(n, (counts.get(n) || 0) + 1);
  }
  
  const canonical = new Map(); // original name → canonical name
  for (const [, counts] of variants) {
    if (counts.size <= 1) continue;
    // Pick the variant with most occurrences as canonical
    let best = null, bestCount = 0;
    for (const [name, count] of counts) {
      if (count > bestCount) { best = name; bestCount = count; }
    }
    for (const [name] of counts) {
      if (name !== best) canonical.set(name, best);
    }
  }
  return canonical;
}

const nameFixups = buildCanonicalMap([...mpRecords, ...ministerRecords]);
console.log(`Name deduplication: ${nameFixups.size} variants merged`);
for (const [from, to] of [...nameFixups.entries()].slice(0, 10)) {
  console.log(`  "${from}" → "${to}"`);
}

// Apply fixups
for (const r of mpRecords) {
  r.name = r.name.replace(/\s?\*$/, "").trim();
  if (nameFixups.has(r.name)) r.name = nameFixups.get(r.name);
}
for (const r of ministerRecords) {
  r.name = r.name.replace(/\s?\*$/, "").trim();
  if (nameFixups.has(r.name)) r.name = nameFixups.get(r.name);
}

// ─── Build member metadata ──────────────────────────────────────────────

const allRecords = [...mpRecords, ...ministerRecords];

// Build unique member map
const memberMap = new Map();

for (const r of allRecords) {
  if (!r.name) continue;
  if (!memberMap.has(r.name)) {
    memberMap.set(r.name, {
      name: r.name,
      parties: new Set(),
      roles: new Set(),
      yearsActive: new Set(),
    });
  }
  const m = memberMap.get(r.name);
  m.parties.add(r.party);
  m.roles.add(r.source);
  m.yearsActive.add(r.year);
}

const members = Array.from(memberMap.values())
  .map((m) => ({
    name: m.name,
    parties: [...m.parties].sort(),
    roles: [...m.roles].sort(),
    yearsActive: [...m.yearsActive].sort((a, b) => a - b),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

// ─── Build metadata ────────────────────────────────────────────────────

const parties = [...new Set(allRecords.map((r) => r.party))].sort();
const years = [...new Set(allRecords.map((r) => r.year))].sort((a, b) => a - b);
const quarters = [];
for (const y of years) {
  for (const q of ["Q1", "Q2", "Q3", "Q4"]) {
    if (allRecords.some((r) => r.year === y && r.quarter === q)) {
      quarters.push(`${y}-${q}`);
    }
  }
}

// ─── Strip rawName before output ────────────────────────────────────────
const cleanRecords = allRecords.map(({ rawName, ...rest }) => rest);

// ─── Output ─────────────────────────────────────────────────────────────

const output = {
  records: cleanRecords,
  parties,
  members,
  yearRange: [years[0], years[years.length - 1]],
  quarters,
};

const outDir = join(ROOT, "public/data");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "expenses.json");
writeFileSync(outPath, JSON.stringify(output));

console.log(`\nOutput written to ${outPath}`);
console.log(`  ${cleanRecords.length} total records`);
console.log(`  ${members.length} unique members`);
console.log(`  ${parties.length} parties: ${parties.join(", ")}`);
console.log(`  ${quarters.length} quarters from ${quarters[0]} to ${quarters[quarters.length - 1]}`);

// Sanity checks
const mpNames = new Set(mpRecords.map((r) => r.name));
const minNames = new Set(ministerRecords.map((r) => r.name));
const overlap = [...mpNames].filter((n) => minNames.has(n));
console.log(`\n  Members in both MP and Minister data: ${overlap.length}`);
if (overlap.length > 0) {
  console.log(`  Examples: ${overlap.slice(0, 10).join(", ")}`);
}

// Check for remaining duplicates
const nameVariants = new Map();
for (const name of memberMap.keys()) {
  const key = name.toLowerCase().replace(/[^a-z]/g, "");
  if (!nameVariants.has(key)) nameVariants.set(key, []);
  nameVariants.get(key).push(name);
}
const dupes = [...nameVariants.entries()].filter(([, v]) => v.length > 1);
if (dupes.length > 0) {
  console.log(`\n  Potential duplicate names (${dupes.length}):`);
  for (const [, names] of dupes.slice(0, 15)) {
    console.log(`    ${names.join(" | ")}`);
  }
}
