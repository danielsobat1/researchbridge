import fs from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";

const SRC = path.resolve("src/app/professors/ubcUndergradResearchers.ts");
const CACHE_DIR = path.resolve(".cache/ubc-prof-details");

// CLI:
// node scripts/enrich-ubc-profs.mjs --limit=0 --start=0 --concurrency=2
const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const v = hit.split("=").slice(1).join("=");
  return v === "" ? fallback : v;
};

const LIMIT = Number(getArg("limit", "0")); // 0 = no limit
const START = Number(getArg("start", "0"));
const CONCURRENCY = Math.max(1, Number(getArg("concurrency", "2")));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cleanLine(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}
function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

function looksLikeFaculty(s) {
  const low = (s || "").toLowerCase();
  return low.includes("faculty") || low.includes("school") || low.includes("college");
}

function extractFirstMatch(text, regex, builder) {
  const m = regex.exec(text);
  if (!m) return undefined;
  const val = builder ? builder(m) : (m[1] ?? m[0]);
  const out = cleanLine(val);
  return out || undefined;
}

/**
 * Pulls `export const ubcUndergradResearchers = [ ... ]` out of a TS file by:
 * 1) finding the start of the exported array
 * 2) bracket-balancing to the end of the array
 * 3) evaluating the array literal as JS (local file only)
 */
function extractArrayFromTS(fileText, exportName = "ubcUndergradResearchers") {
  const re = new RegExp(`${exportName}\\s*(?::[^=]+)?=\\s*\\[`, "m");
  const m = re.exec(fileText);
  if (!m) throw new Error(`Could not find ${exportName} = [ ... ] in TS file.`);

  const start = m.index + m[0].lastIndexOf("[");

  let i = start;
  let depth = 0;
  let inStr = false;
  let quote = "";
  let esc = false;

  for (; i < fileText.length; i++) {
    const ch = fileText[i];

    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === "\\") {
        esc = true;
        continue;
      }
      if (ch === quote) {
        inStr = false;
        quote = "";
      }
      continue;
    }

    if (ch === "'" || ch === '"' || ch === "`") {
      inStr = true;
      quote = ch;
      continue;
    }

    if (ch === "[") depth++;
    if (ch === "]") {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }

  let arrLiteral = fileText.slice(start, i);

  arrLiteral = arrLiteral.replace(
    /\]\s*(as\s+const|satisfies\s+[\w<>\[\]\s]+)?\s*;?\s*$/m,
    "]"
  );

  return Function(`"use strict"; return (${arrLiteral});`)();
}

function extractListAfterHeading($, headingText) {
  const want = cleanLine(headingText).toLowerCase();

  const h = $("h2, h3")
    .filter((_, el) => cleanLine($(el).text()).toLowerCase() === want)
    .first();

  if (!h.length) return [];

  const out = [];
  let node = h.next();

  while (node.length) {
    if (node.is("h2") || node.is("h3")) break;

    if (node.is("ul")) {
      node.find("li").each((_, li) => {
        const t = cleanLine($(li).text());
        if (t) out.push(t);
      });
    } else {
      node
        .text()
        .split("\n")
        .map(cleanLine)
        .filter(Boolean)
        .forEach((t) => out.push(t));
    }

    node = node.next();
  }

  const cleaned = out
    .map(cleanLine)
    .filter((t) => t && t !== "*" && t.toLowerCase() !== "open all");

  return uniq(cleaned);
}

function parseRecruitment(lines) {
  const out = {
    lookingToRecruit: [],
    desiredStartDates: [],
    potentialProjectAreas: [],
    otherOptions: [],
  };

  let section = null;

  for (const raw of lines) {
    const line = cleanLine(raw);
    if (!line) continue;

    const low = line.toLowerCase();

    if (low.startsWith("looking to recruit")) {
      section = "lookingToRecruit";
      continue;
    }
    if (low.startsWith("desired start dates")) {
      section = "desiredStartDates";
      continue;
    }
    if (low.startsWith("potential research project areas")) {
      section = "potentialProjectAreas";
      continue;
    }
    if (low.startsWith("other options")) {
      section = "otherOptions";
      continue;
    }

    if (!section) continue;

    const parts =
      line.includes(",") && line.length < 120
        ? line.split(",").map(cleanLine).filter(Boolean)
        : [line];

    out[section].push(...parts);
  }

  for (const k of Object.keys(out)) out[k] = uniq(out[k]);

  const hasAny = Object.values(out).some((arr) => arr.length > 0);
  return hasAny ? out : undefined;
}

function extractEmail($) {
  const href = $('a[href^="mailto:"]').first().attr("href");
  if (!href) return undefined;
  const email = href.replace(/^mailto:/i, "").split("?")[0].trim();
  return email || undefined;
}

function extractFacultyAndDepartments($) {
  const pageText = cleanLine($("body").text()).slice(0, 25000);

  // Faculty from obvious patterns
  const faculty =
    extractFirstMatch(pageText, /\bFaculty of ([A-Za-z0-9& ,.'-]+)/i, (m) => `Faculty of ${m[1]}`) ||
    extractFirstMatch(pageText, /\bSchool of ([A-Za-z0-9& ,.'-]+)/i, (m) => `School of ${m[1]}`) ||
    extractFirstMatch(pageText, /\bCollege of ([A-Za-z0-9& ,.'-]+)/i, (m) => `College of ${m[1]}`);

  // Departments from headings (if present)
  const deptFromHeadings = uniq([
    ...extractListAfterHeading($, "Department"),
    ...extractListAfterHeading($, "Departments"),
  ]);

  // Departments from loose text patterns
  const deptMatches = [];
  const re = /\bDepartment of ([A-Za-z0-9& ,.'-]+)/gi;
  let mm;
  while ((mm = re.exec(pageText)) && deptMatches.length < 10) {
    deptMatches.push(`Department of ${cleanLine(mm[1])}`);
  }

  const departments = uniq([...deptFromHeadings, ...deptMatches]);

  return {
    faculty: faculty || undefined,
    departments: departments.length ? departments : undefined,
  };
}

async function fetchHTML(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "ResearchBridge/0.1 (educational use)",
      Accept: "text/html",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

async function enrichOne(prof) {
  const cachePath = path.join(CACHE_DIR, `${prof.id}.json`);

  // cache hit
  try {
    const cached = JSON.parse(await fs.readFile(cachePath, "utf8"));
    return { ...prof, ...cached };
  } catch {}

  const html = await fetchHTML(prof.profileUrl);
  const $ = cheerio.load(html);

  // email (mailto)
  let email;
  const mailto = $('a[href^="mailto:"]').first().attr("href");
  if (mailto) {
    const raw = mailto.replace(/^mailto:/i, "").split("?")[0];
    email = decodeURIComponent(raw);
  }

  const name = cleanLine($("h1").first().text());
  const titleGuess = cleanLine($("h1").first().nextAll().first().text());
  const title =
    titleGuess && !titleGuess.toLowerCase().includes("faculty of")
      ? titleGuess
      : undefined;

  const researchClassification = extractListAfterH2($, "Research Classification");
  const researchInterests = extractListAfterH2($, "Research Interests");
  const affiliations = extractListAfterH2(
    $,
    "Affiliations to Research Centres, Institutes & Clusters"
  );
  const researchOptions = extractListAfterH2($, "Research Options");
  const methodology = extractListAfterH2($, "Research Methodology");
  const recruitmentLines = extractListAfterH2($, "Recruitment");
  const recruitment = parseRecruitment(recruitmentLines);

  const enriched = {
    email: email || undefined,
    title,
    nameOnPage: name || undefined,
    researchClassification: researchClassification.length ? researchClassification : undefined,
    interests: researchInterests.length ? researchInterests : prof.interests || [],
    affiliations: affiliations.length ? affiliations : undefined,
    researchOptions: researchOptions.length ? researchOptions : undefined,
    methodology: methodology.length ? methodology : undefined,
    recruitment,
  };

  await fs.writeFile(cachePath, JSON.stringify(enriched, null, 2), "utf8");
  return { ...prof, ...enriched };
}


function writeTS(profs) {
  const typeDef = `export type Professor = {
  id: string;
  firstName: string;
  lastName: string;
  faculty: string;
  departments?: string[];
  interests?: string[];
  profileUrl: string;

  email?: string;

  // Enriched fields (scraped from profileUrl)
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

  const body = `// AUTO-GENERATED. Do not hand-edit.
// Generated by scripts/enrich-ubc-profs.mjs

${typeDef}
export const ubcUndergradResearchers: Professor[] = ${JSON.stringify(profs, null, 2)};
`;

  return body;
}

async function main() {
  await fs.mkdir(CACHE_DIR, { recursive: true });

  const tsText = await fs.readFile(SRC, "utf8");
  const base = extractArrayFromTS(tsText, "ubcUndergradResearchers");

  const slice = base.slice(START, LIMIT > 0 ? START + LIMIT : undefined);

  console.log(
    `Enriching ${slice.length} professor(s) (start=${START}, limit=${LIMIT || "ALL"}, concurrency=${CONCURRENCY})`
  );

  const results = [];
  let idx = 0;

  async function worker() {
    while (idx < slice.length) {
      const myIndex = idx++;
      const prof = slice[myIndex];

      try {
        const enriched = await enrichOne(prof);
        results[myIndex] = enriched;
        console.log(`OK   ${prof.id} ${prof.firstName} ${prof.lastName}`);
      } catch (e) {
        results[myIndex] = prof;
        console.log(`FAIL ${prof.id} ${prof.firstName} ${prof.lastName}: ${e?.message || e}`);
      }

      await sleep(150);
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  const merged = base.slice();
  for (let i = 0; i < slice.length; i++) merged[START + i] = results[i];

  await fs.writeFile(SRC, writeTS(merged), "utf8");
  console.log(`Wrote enriched data to: ${SRC}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
