// app/api/researchers/route.ts
import { NextRequest, NextResponse } from "next/server";

const OPENALEX_BASE = "https://api.openalex.org";

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
  const idsParam = searchParams.get("ids") || "";

  if (!idsParam) {
    return NextResponse.json({ researchers: [] });
  }

  const ids = idsParam.split(",").filter((id) => id.trim());

  if (ids.length === 0) {
    return NextResponse.json({ researchers: [] });
  }

  try {
    // Fetch author details from OpenAlex
    const authorsUrl = new URL(`${OPENALEX_BASE}/authors`);
    authorsUrl.searchParams.set("filter", `id:${ids.join("|")}`);
    authorsUrl.searchParams.set("per-page", "200");

    const authorsData = await fetchJson(authorsUrl.toString());
    const authors = (authorsData?.results ?? []) as any[];

    const researchers = authors.map((a) => ({
      id: a?.id,
      name: a?.display_name,
      orcid: a?.orcid,
      matchedWorksCount: 0,
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

    return NextResponse.json({ researchers });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to fetch researchers" },
      { status: 500 }
    );
  }
}
