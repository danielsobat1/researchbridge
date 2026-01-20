import fs from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";

const OUT = path.resolve("src/app/professors/ubcUndergradResearchers.ts");

// CLI:
// node scripts/sync-ubc-undergrad-profs.mjs --url="https://www.grad.ubc.ca/research/undergraduate" --maxPages=999 --delay=200
const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const v = hit.split("=").slice(1).join("=");
  return v === "" ? fallback : v;
};

const BASE_URL = getArg("url", "");
if (!BASE_URL) {
  console.error("Missing --url=...");
  process.exit(1);
}
const MAX_PAGES = Number(getArg("maxPages", "999"));
const DELAY_MS = Number(getArg("delay", "250"));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function clean(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function normHeader(s) {
  // remove arrows/odd characters and normalize spaces
  return clean(s)
    .toLowerCase()
    .replace(/[↑↓▲▼▶◀]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniq(arr) {
  return Array.from(new Set((arr || []).map(clean).filter(Boolean)));
}

function slugify(s) {
  return clean(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

async function fetchHTML(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "ResearchBridge/0.1 (educational use)",
      Accept: "text/html",
      "Accept-Language": "en-CA,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

function getTableHeaders($, $table) {
  // Try thead first
  let headers = $table
    .find("thead th")
    .toArray()
    .map((th) => normHeader($(th).text()))
    .filter(Boolean);

  if (headers.length) return headers;

  // Fallback: first row that has TH cells
  const headerRow = $table
    .find("tr")
    .toArray()
    .find((tr) => $(tr).find("th").length > 0);

  if (!headerRow) return [];

  headers = $(headerRow)
    .find("th")
    .toArray()
    .map((th) => normHeader($(th).text()))
    .filter(Boolean);

  return headers;
}

function scoreHeaders(headers) {
  const has = (needle) => headers.some((h) => h.includes(needle));
  let score = 0;
  if (has("last name")) score += 3;
  if (has("first name")) score += 3;
  if (has("type")) score += 2;
  if (has("research interest")) score += 3;
  if (has("department")) score += 3;
  if (has("faculty")) score += 2;
  return score;
}

function findResultsTable($) {
  const tables = $("table").toArray();
  let best = null;
  let bestScore = 0;

  for (const t of tables) {
    const $t = $(t);
    const headers = getTableHeaders($, $t);
    const s = scoreHeaders(headers);
    if (s > bestScore) {
      bestScore = s;
      best = $t;
    }
  }

  // Require a minimum score so we don’t grab random tables
  return bestScore >= 8 ? best : null;
}

function findCol(headers, needle) {
  // needle can be string or array of strings
  const needles = Array.isArray(needle) ? needle : [needle];
  return headers.findIndex((h) => needles.some((n) => h.includes(n)));
}

function parsePage(html, pageUrl) {
  const $ = cheerio.load(html);

  const $table = findResultsTable($);
  if (!$table) {
    const title = clean($("title").text());
    const bodyPreview = clean($("body").text()).slice(0, 220);
    console.log(`No results table found. title="${title}" preview="${bodyPreview}"`);
    return [];
  }

  const headers = getTableHeaders($, $table);

  const idxLast = findCol(headers, "last name");
  const idxFirst = findCol(headers, "first name");
  const idxType = findCol(headers, "type");
  const idxInterests = findCol(headers, ["research interests", "research interest"]);
  const idxDepts = findCol(headers, "department");
  const idxFaculty = findCol(headers, "faculty");

  if ([idxLast, idxFirst, idxType, idxInterests, idxDepts, idxFaculty].some((i) => i < 0)) {
    console.log("Found table but couldn’t map columns. Headers:", headers);
    return [];
  }

  // Data rows: any tr that has td cells
  const rows = [];
  $table
    .find("tr")
    .toArray()
    .filter((tr) => $(tr).find("td").length > 0)
    .forEach((tr) => {
      const $cells = $(tr).children("td,th"); // some tables use th in body columns
      if ($cells.length === 0) return;

      const lastCell = $cells.eq(idxLast);
      const firstCell = $cells.eq(idxFirst);

      const lastName = clean(lastCell.text());
      const firstName = clean(firstCell.text());

      const href = lastCell.find("a").first().attr("href");
      if (!href || !lastName || !firstName) return;

      const profileUrl = new URL(href, pageUrl).toString();

      const typeText = clean($cells.eq(idxType).text());

      const interestsRaw = clean($cells.eq(idxInterests).text());
      const interests = uniq(
        interestsRaw
          .split(";")
          .map((s) => clean(s))
          .filter(Boolean)
      );

      const deptCell = $cells.eq(idxDepts);
      const deptLinks = deptCell
        .find("a")
        .toArray()
        .map((a) => clean($(a).text()))
        .filter(Boolean);

      const departments = uniq(
        deptLinks.length
          ? deptLinks
          : deptCell
              .text()
              .split(";")
              .map((s) => clean(s))
              .filter(Boolean)
      );

      const facultyText = clean($cells.eq(idxFaculty).text());

      const idBase = slugify(`${lastName}-${firstName}`);
      const id = `${idBase}-${hashStr(profileUrl).slice(0, 6)}`;

      rows.push({
        id,
        firstName,
        lastName,
        type: typeText || undefined,
        interests: interests.length ? interests : undefined,
        departments: departments.length ? departments : undefined,
        faculty: facultyText || "Unknown",
        profileUrl,
      });
    });

  return rows;
}

function writeTS(profs) {
  const typeDef = `export type Professor = {
  id: string;
  firstName: string;
  lastName: string;

  // Columns from the Grad UBC table
  type?: string;
  interests?: string[];
  departments?: string[];
  faculty: string;

  profileUrl: string;

  // Enriched fields (scraped from profileUrl)
  email?: string;
  title?: string;
  nameOnPage?: string;
  researchClassification?: string[];
  affiliations?: string[];
  researchOptions?: string[];
  methodology?: string[];
  recruitment?: {
    lookingToRecruit?: string[];
    desiredStartDates?: string[];
    potentialProjectAreas?: string[];
    otherOptions?: string[];
  };
};\n`;

  return `// AUTO-GENERATED. Do not hand-edit.
// Generated by scripts/sync-ubc-undergrad-profs.mjs

${typeDef}
export const ubcUndergradResearchers: Professor[] = ${JSON.stringify(profs, null, 2)};
`;
}

async function main() {
  const all = [];
  const base = new URL(BASE_URL);

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(base.toString());

    // UBC uses ?page=1,2,... in practice, but page 0 sometimes works too.
    // We fetch base with no param first (page=0), then ?page=1...
    if (page > 0) url.searchParams.set("page", String(page));

    console.log(`Fetching page ${page + 1}: ${url.toString()}`);

    const html = await fetchHTML(url.toString());
    const rows = parsePage(html, url.toString());

    if (rows.length === 0) break;

    all.push(...rows);
    await sleep(DELAY_MS);
  }

  if (all.length === 0) {
    throw new Error("Parsed 0 professors. Refusing to overwrite dataset.");
  }

  // de-dupe by id
  const byId = new Map();
  for (const p of all) byId.set(p.id, p);
  const profs = Array.from(byId.values());

  await fs.writeFile(OUT, writeTS(profs), "utf8");
  console.log(`Wrote ${profs.length} professor(s) to: ${OUT}`);
}

main().catch((e) => {
  console.error("Error:", e?.message || e);
  process.exit(1);
});
