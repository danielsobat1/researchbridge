// app/api/discover/route.ts
import { NextRequest, NextResponse } from "next/server";

const ROR_BASE = "https://api.ror.org/v2";
const OPENALEX_BASE = "https://api.openalex.org";

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

// Known non-researchers that appear in academic databases
const FAMOUS_FIGURES_BLOCKLIST = new Set([
  "hitler",
  "benjamin netanyahu",
  "napoleon",
  "alexander the great",
  "julius caesar",
  "socrates",
  "plato",
  "aristotle",
  "jesus",
  "muhammad",
  "gandhi",
  "churchill",
  "stalin",
  "lenin",
  "mao",
  "confucius",
  "buddha",
]);

function isFamousFigure(name: string): boolean {
  const nameLower = name.toLowerCase().trim();
  for (const famous of FAMOUS_FIGURES_BLOCKLIST) {
    if (nameLower.includes(famous) || famous.includes(nameLower.split(" ")[0])) {
      return true;
    }
  }
  return false;
}

function isValidResearcher(researcher: any): boolean {
  // Must not be a famous non-researcher
  if (isFamousFigure(researcher.name)) {
    return false;
  }

  // Must have reasonable publication history (at least 2 works)
  // This filters out one-off spam entries
  const worksCount = researcher.worksCount ?? researcher.matchedWorksCount ?? 0;
  if (worksCount < 2) {
    return false;
  }

  return true;
}

async function fetchJson(url: string, ms = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "From": "research-bridge-demo@example.com",
        "Accept": "application/json",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 100)}`);
    }
  } finally {
    clearTimeout(t);
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = (searchParams.get("city") || "").trim();
  const institution = (searchParams.get("institution") || "").trim();
  const name = (searchParams.get("name") || "").trim();
  const area = (searchParams.get("area") || "").trim();
  const active = searchParams.get("active") === "true";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const perPage = 50;

  console.log("Discover API called with city:", city, "institution:", institution, "name:", name, "area:", area);

  if (!city && !institution && !name && !area) {
    return NextResponse.json(
      { error: "At least one search parameter is required." },
      { status: 400 }
    );
  }

  // 1) ROR: institutions in city or specific institution (if provided)
  let rorIds: string[] = [];
  if (city || institution) {
    const rorUrl = new URL(`${ROR_BASE}/organizations`);
    rorUrl.searchParams.set("query", institution || city);
    rorUrl.searchParams.set("page", "1");
    const rorData = await fetchJson(rorUrl.toString());
    console.log("ROR data:", rorData);
    const institutionsRaw = (rorData?.items ?? []) as any[];
    rorIds = institutionsRaw
      .map((x) => x?.id)
      .filter((x: any) => typeof x === "string" && x.includes("ror.org/"))
      .slice(0, 10);
    console.log("ROR IDs:", rorIds);
  }

  // 2) OpenAlex: search topics (if area provided)
  let topicIds: string[] = [];
  let topicsRaw: any[] = [];
  if (area) {
    const topicsUrl = new URL(`${OPENALEX_BASE}/topics`);
    topicsUrl.searchParams.set("search", area);
    const topicsData = await fetchJson(topicsUrl.toString());
    console.log("Topics data:", topicsData);
    topicsRaw = (topicsData?.results ?? []) as any[];
    topicIds = topicsRaw
      .slice(0, 3)
      .map((t) => t?.id)
      .filter((id: any) => typeof id === "string");
    console.log("Topic IDs:", topicIds);
  }

  // Build filter dynamically
  const filterParts: string[] = [];
  if (rorIds.length > 0) {
    filterParts.push(`institutions.ror:${rorIds.join("|")}`);
  }
  if (topicIds.length > 0) {
    filterParts.push(`primary_topic.id:${topicIds.join("|")}`);
  }

  if (filterParts.length === 0 && !name) {
    return NextResponse.json({
      city,
      institution,
      name,
      area,
      matchedInstitutions: rorIds.length,
      matchedTopics: topicIds.length,
      researchers: [],
      suggestedResearchers: [],
      pagination: {
        currentPage: page,
        perPage,
        hasResults: false,
      },
    });
  }

  let researchers: any[] = [];

  // If name is provided, use direct author search (works better than complex filters)
  if (name) {
    const authorsUrl = new URL(`${OPENALEX_BASE}/authors`);
    authorsUrl.searchParams.set("search", name);
    authorsUrl.searchParams.set("per-page", perPage.toString());
    authorsUrl.searchParams.set("page", page.toString());

    const authorsData = await fetchJson(authorsUrl.toString());
    const authors = (authorsData?.results ?? []) as any[];

    // Filter by institution if specified
    let filtered = authors;
    if (rorIds.length > 0) {
      filtered = authors.filter((a) => {
        const instRor = a?.last_known_institution?.ror;
        return instRor && rorIds.some((id) => instRor.includes(id));
      });
    }

    researchers = filtered.map((a) => ({
      id: a?.id,
      name: a?.display_name,
      orcid: a?.orcid,
      matchedWorksCount: a?.works_count ?? 0,
      worksCount: a?.works_count ?? null,
      citedByCount: a?.cited_by_count ?? null,
      lastKnownInstitution: a?.last_known_institution
        ? {
            name: a.last_known_institution.display_name,
            ror: a.last_known_institution.ror,
            country: a.last_known_institution.country_code,
            type: a.last_known_institution.type,
          }
        : null,
    }));
  } else {
    // Use works group_by
    const filterPartsCopy = [...filterParts];
    // If active filter is set, add publication year filter for last 5 years
    if (active) {
      const currentYear = new Date().getFullYear();
      const minYear = currentYear - 5;
      // Use publication_year filter with range syntax
      filterPartsCopy.push(`publication_year:${minYear}-${currentYear}`);
    }
    const filter = filterPartsCopy.join(",");

    const worksUrl = new URL(`${OPENALEX_BASE}/works`);
    worksUrl.searchParams.set("filter", filter);
    worksUrl.searchParams.set("group_by", "authorships.author.id");
    worksUrl.searchParams.set("per-page", "200");

    const grouped = await fetchJson(worksUrl.toString());
    const groups = (grouped?.group_by ?? []) as any[];

    // Rank authors by count
    const sortedGroups = groups
      .filter((g) => typeof g?.key === "string")
      .sort((a, b) => (b?.count ?? 0) - (a?.count ?? 0));
    
    // Paginate: slice based on page
    const startIdx = (page - 1) * perPage;
    const endIdx = startIdx + perPage;
    const topGroups = sortedGroups.slice(startIdx, endIdx);

    const authorIds = uniq(topGroups.map((g) => g.key));

    if (authorIds.length === 0) {
      return NextResponse.json({
        city,
        institution,
        name,
        area,
        matchedInstitutions: rorIds.length,
        matchedTopics: topicIds.length,
        researchers: [],
      });
    }

    // 4) Fetch author details
    const authorsUrl = new URL(`${OPENALEX_BASE}/authors`);
    authorsUrl.searchParams.set("filter", `id:${authorIds.join("|")}`);
    authorsUrl.searchParams.set("per-page", "200");

    const authorsData = await fetchJson(authorsUrl.toString());
    const authors = (authorsData?.results ?? []) as any[];

    // Merge counts
    const countById = new Map<string, number>(
      topGroups.map((g) => [g.key, g.count ?? 0])
    );

    researchers = authors.map((a) => ({
      id: a?.id,
      name: a?.display_name,
      orcid: a?.orcid,
      matchedWorksCount: countById.get(a?.id) ?? 0,
      worksCount: a?.works_count ?? null,
      citedByCount: a?.cited_by_count ?? null,
      lastKnownInstitution: a?.last_known_institution
        ? {
            name: a.last_known_institution.display_name,
            ror: a.last_known_institution.ror,
            country: a.last_known_institution.country_code,
            type: a.last_known_institution.type,
          }
        : null,
    }));

    // If active filter is set, verify each researcher has recent works
    if (active) {
      const currentYear = new Date().getFullYear();
      const minYear = currentYear - 5;
      
      // Filter researchers to only those with works in the last 5 years
      researchers = researchers.filter((r) => {
        const matchedCount = countById.get(r.id) ?? 0;
        return matchedCount > 0; // countById only contains authors from the filtered works (last 5 years)
      });
    }
  }

  // Filter out fake/non-researchers
  researchers = researchers.filter((r) => isValidResearcher(r));

  // If no results found, try to get partial matches (looser filters)
  let suggestedResearchers: any[] = [];
  if (researchers.length === 0 && name) {
    // Try searching by name alone without other filters
    const authorsUrl = new URL(`${OPENALEX_BASE}/authors`);
    authorsUrl.searchParams.set("search", name);
    authorsUrl.searchParams.set("per-page", "10");

    try {
      const authorsData = await fetchJson(authorsUrl.toString());
      const authors = (authorsData?.results ?? []) as any[];

      suggestedResearchers = authors
        .filter((a) => isValidResearcher({
          name: a?.display_name,
          worksCount: a?.works_count,
          matchedWorksCount: a?.works_count,
          citedByCount: a?.cited_by_count,
          lastKnownInstitution: a?.last_known_institution ? {
            name: a.last_known_institution.display_name,
          } : null,
        }))
        .map((a) => ({
          id: a?.id,
          name: a?.display_name,
          orcid: a?.orcid,
          matchedWorksCount: a?.works_count ?? 0,
          worksCount: a?.works_count ?? null,
          citedByCount: a?.cited_by_count ?? null,
          lastKnownInstitution: a?.last_known_institution
            ? {
                name: a.last_known_institution.display_name,
                ror: a.last_known_institution.ror,
                country: a.last_known_institution.country_code,
                type: a.last_known_institution.type,
              }
            : null,
        }))
        .slice(0, 5);
    } catch (e) {
      console.log("Error fetching suggested researchers:", e);
    }
  }

  return NextResponse.json({
    city,
    institution,
    name,
    area,
    matchedInstitutions: rorIds.length,
    matchedTopics: topicsRaw.slice(0, 3).map((t) => ({
      id: t?.id,
      display_name: t?.display_name ?? t?.name,
      score: t?.relevance ?? t?.score,
    })),
    researchers: researchers.sort(
      (a, b) => (b.matchedWorksCount ?? 0) - (a.matchedWorksCount ?? 0)
    ),
    suggestedResearchers: suggestedResearchers.sort(
      (a, b) => (b.matchedWorksCount ?? 0) - (a.matchedWorksCount ?? 0)
    ),
    pagination: {
      currentPage: page,
      perPage,
      hasResults: researchers.length > 0,
    },
  });
}