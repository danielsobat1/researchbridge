// app/discover/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { getUser, UserProfile } from "@/app/lib/auth";
import AddToListModal from "@/app/components/AddToListModal";
import { scoreResearchers, getStarLabel } from "./researcherScoring";

type Researcher = {
  id: string;
  name: string;
  orcid?: string | null;
  matchedWorksCount: number;
  worksCount?: number | null;
  citedByCount?: number | null;
  lastKnownInstitution?: {
    name: string;
    ror?: string | null;
    country?: string | null;
    type?: string | null;
  } | null;
};

export default function DiscoverPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [city, setCity] = useState("");
  const [institution, setInstitution] = useState("");
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [researchers, setResearchers] = useState<Researcher[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [savedList, setSavedList] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedResearcherId, setSelectedResearcherId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"relevance" | "a-z" | "z-a" | "rating-high" | "rating-low">("relevance");
  const [suggestedResearchers, setSuggestedResearchers] = useState<Researcher[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreResults, setHasMoreResults] = useState(false);

  // Load user on mount to get resume keywords
  useEffect(() => {
    const u = getUser();
    setUser(u);
  }, []);

  // Load saved list from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("savedResearchers");
    if (saved) {
      setSavedList(new Set(JSON.parse(saved)));
    }
  }, []);

  const addToList = (researcher: Researcher) => {
    const newList = new Set(savedList);
    newList.add(researcher.id);
    setSavedList(newList);
    localStorage.setItem("savedResearchers", JSON.stringify(Array.from(newList)));
  };

  const removeFromList = (researcherId: string) => {
    const newList = new Set(savedList);
    newList.delete(researcherId);
    setSavedList(newList);
    localStorage.setItem("savedResearchers", JSON.stringify(Array.from(newList)));
  };

  // Score and sort researchers
  const { sortedResearchers, scoreMap } = useMemo(() => {
    const scoreMap = scoreResearchers(researchers, user?.resumeKeywords);
    
    const sorted = [...researchers].sort((a, b) => {
      if (sortBy === "a-z") return a.name.localeCompare(b.name);
      if (sortBy === "z-a") return b.name.localeCompare(a.name);
      if (sortBy === "rating-high") {
        const aScore = scoreMap.get(a.id)?.stars ?? 0;
        const bScore = scoreMap.get(b.id)?.stars ?? 0;
        return bScore - aScore;
      }
      if (sortBy === "rating-low") {
        const aScore = scoreMap.get(a.id)?.stars ?? 0;
        const bScore = scoreMap.get(b.id)?.stars ?? 0;
        return aScore - bScore;
      }
      // relevance - keep original order from API
      return 0;
    });

    return { sortedResearchers: sorted, scoreMap };
  }, [researchers, sortBy, user?.resumeKeywords]);

  const resetSearch = () => {
    setCity("");
    setInstitution("");
    setName("");
    setArea("");
    setActiveOnly(false);
    setResearchers([]);
    setSuggestedResearchers([]);
    setTopics([]);
    setError(null);
    setCurrentPage(1);
    setHasMoreResults(false);
  };

  async function runSearch(page = 1) {
    setLoading(true);
    setError(null);
    if (page === 1) {
      setResearchers([]);
      setTopics([]);
    }

    try {
      const params = new URLSearchParams();
      if (city.trim()) params.append("city", city.trim());
      if (institution.trim()) params.append("institution", institution.trim());
      if (name.trim()) params.append("name", name.trim());
      if (area.trim()) params.append("area", area.trim());
      if (activeOnly) params.append("active", "true");
      params.append("page", page.toString());
      const url = `/api/discover?${params.toString()}`;
      const res = await fetch(url);
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Invalid response from API: ${text.slice(0, 100)}`);
      }
      if (!res.ok) throw new Error(data?.error || "Search failed.");

      if (page === 1) {
        setTopics(data?.matchedTopics ?? []);
      }
      setResearchers(data?.researchers ?? []);
      setSuggestedResearchers(data?.suggestedResearchers ?? []);
      setCurrentPage(page);
      setHasMoreResults((data?.researchers ?? []).length >= (data?.pagination?.perPage ?? 50));
    } catch (e: any) {
      setError(e?.message ?? "Something broke.");
    } finally {
      setLoading(false);
    }
  }

  const goToPage = (page: number) => {
    if (page < 1) return;
    runSearch(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Discover Researchers</h1>
            <p className="mt-2 text-white/70">
              Search researchers by city, institution, name, or research area (OpenAlex + ROR).
            </p>
          </div>

          <div className="flex gap-2">
            <a
              href="/my-list"
              className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
            >
              My Lists
            </a>
            <a
              href="/professors"
              className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
            >
              Professors
            </a>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-8 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-2 lg:grid-cols-3">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City (e.g., Vancouver)"
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/30"
          />
          <input
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            placeholder="Institution (optional)"
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/30"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Researcher name (optional)"
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/30"
          />
          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Research area (e.g., cartilage regeneration)"
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/30"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/30"
          >
            <option value="relevance">Sort: Relevance</option>
            <option value="a-z">Sort: A-Z</option>
            <option value="z-a">Sort: Z-A</option>
            <option value="rating-high">Sort: Rating (High)</option>
            <option value="rating-low">Sort: Rating (Low)</option>
          </select>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm lg:col-span-3">
            <label className="flex items-center gap-3 text-white/80">
              <input
                id="activeOnly"
                type="checkbox"
                checked={activeOnly}
                onChange={() => setActiveOnly((prev) => !prev)}
                className="h-4 w-4 rounded border-white/30 bg-black"
              />
              Only show active researchers (published in last 5 years)
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetSearch}
                className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10"
              >
                Reset search
              </button>
              <button
                onClick={() => runSearch(1)}
                disabled={loading}
                className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-70"
              >
                {loading ? "Searching…" : "Search"}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {topics.length > 0 && (
          <div className="mt-6">
            <div className="text-sm font-medium text-white/80">Matched topics</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {topics.map((t, i) => (
                <span
                  key={t.id ?? i}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80"
                >
                  {t.display_name ?? "Topic"} {t.score != null ? `(${Number(t.score).toFixed(2)})` : ""}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6">
          {sortedResearchers.length === 0 && !loading && !error ? (
            <div className="text-white/70">No results yet. Type something and press Search.</div>
          ) : null}

          {sortedResearchers.length > 0 && (
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-white/70">
                {sortedResearchers.length} researcher{sortedResearchers.length !== 1 ? "s" : ""} on page {currentPage}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                  className="rounded-xl border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>
                <span className="text-sm text-white/70">Page {currentPage}</span>
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={!hasMoreResults || loading}
                  className="rounded-xl border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-4">
            {sortedResearchers.map((r) => {
              const score = scoreMap.get(r.id);
              const isSaved = savedList.has(r.id);

              return (
                <div key={r.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <a
                        href={r.id}
                        target="_blank"
                        rel="noreferrer"
                        className="text-lg font-medium underline decoration-white/40 underline-offset-4 hover:decoration-white"
                      >
                        {r.name}
                      </a>
                      {r.lastKnownInstitution?.name && (
                        <div className="mt-1 text-sm text-white/70">
                          {r.lastKnownInstitution.name}
                          {r.lastKnownInstitution.country
                            ? ` (${r.lastKnownInstitution.country})`
                            : ""}
                        </div>
                      )}
                    </div>

                    <div className="text-sm text-white/70">
                      <div>
                        <b>{r.matchedWorksCount}</b> matched works
                      </div>
                      {r.worksCount != null && <div>{r.worksCount} total works</div>}
                      {r.citedByCount != null && <div>{r.citedByCount} citations</div>}
                    </div>
                  </div>

                  {score && (
                    <div className="mt-3 flex items-center gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-yellow-400">{'★'.repeat(Math.floor(score.stars))}{score.stars % 1 !== 0 ? '½' : ''}{'☆'.repeat(5 - Math.ceil(score.stars))}</span>
                        <span className="text-white/80">{score.stars.toFixed(1)}/5</span>
                        <span className="text-white/60">({getStarLabel(score.stars)})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          alert(
                            `Rating Breakdown (${score.stars.toFixed(1)}/5 stars)\n` +
                            `Percentile: ${score.percentile.toFixed(0)}th\n\n` +
                            `Relevance: ${(score.breakdown.relevance * 100).toFixed(0)}%\n` +
                            `Productivity (z-score): ${score.breakdown.productivity.toFixed(2)}\n` +
                            `Impact (z-score): ${score.breakdown.impact.toFixed(2)}\n` +
                            `Accessibility: ${(score.breakdown.accessibility * 100).toFixed(0)}%\n\n` +
                            `Reasons:\n${score.reasons.map((r) => "• " + r).join("\n")}\n\n` +
                            `Confidence: ${score.confidence}\n\n` +
                            `Note: Rating is relative to other researchers in these results, not an absolute probability.`
                          );
                        }}
                        className="text-xs text-white/50 underline hover:text-white/70"
                      >
                        Why?
                      </button>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedResearcherId(r.id);
                        setModalOpen(true);
                      }}
                      className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
                    >
                      Add to my lists
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {sortedResearchers.length > 0 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-white/70">
                {sortedResearchers.length} researcher{sortedResearchers.length !== 1 ? "s" : ""} on page {currentPage}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                  className="rounded-xl border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>
                <span className="text-sm text-white/70">Page {currentPage}</span>
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={!hasMoreResults || loading}
                  className="rounded-xl border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>

        {suggestedResearchers.length > 0 && sortedResearchers.length === 0 && (
          <div className="mt-8">
            <div className="text-lg font-semibold text-white/80 mb-4">
              💡 Most Relevant Results
            </div>
            <p className="text-sm text-white/60 mb-4">
              We couldn't find exact matches for your filters, but here are the most relevant researchers:
            </p>
            <div className="mt-4 grid gap-4">
              {suggestedResearchers.map((r) => {
                const score = scoreMap.get(r.id);
                const isSaved = savedList.has(r.id);

                return (
                  <div key={r.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <a
                          href={r.id}
                          target="_blank"
                          rel="noreferrer"
                          className="text-lg font-medium underline decoration-white/40 underline-offset-4 hover:decoration-white"
                        >
                          {r.name}
                        </a>
                        {r.lastKnownInstitution?.name && (
                          <div className="mt-1 text-sm text-white/70">
                            {r.lastKnownInstitution.name}
                            {r.lastKnownInstitution.country
                              ? ` (${r.lastKnownInstitution.country})`
                              : ""}
                          </div>
                        )}
                      </div>

                      <div className="text-sm text-white/70">
                        <div>
                          <b>{r.matchedWorksCount}</b> total works
                        </div>
                        {r.citedByCount != null && <div>{r.citedByCount} citations</div>}
                      </div>
                    </div>

                    {score && (
                      <div className="mt-3 flex items-center gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-yellow-400">{'★'.repeat(Math.floor(score.stars))}{score.stars % 1 !== 0 ? '½' : ''}{'☆'.repeat(5 - Math.ceil(score.stars))}</span>
                          <span className="text-white/80">{score.stars.toFixed(1)}/5</span>
                          <span className="text-white/60">({getStarLabel(score.stars)})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            alert(
                              `Rating Breakdown (${score.stars.toFixed(1)}/5 stars)\n` +
                              `Percentile: ${score.percentile.toFixed(0)}th\n\n` +
                              `Relevance: ${(score.breakdown.relevance * 100).toFixed(0)}%\n` +
                              `Productivity (z-score): ${score.breakdown.productivity.toFixed(2)}\n` +
                              `Impact (z-score): ${score.breakdown.impact.toFixed(2)}\n` +
                              `Accessibility: ${(score.breakdown.accessibility * 100).toFixed(0)}%\n\n` +
                              `Reasons:\n${score.reasons.map((r) => "• " + r).join("\n")}\n\n` +
                              `Confidence: ${score.confidence}\n\n` +
                              `Note: Rating is relative to other researchers in these results, not an absolute probability.`
                            );
                          }}
                          className="text-xs text-white/50 underline hover:text-white/70"
                        >
                          Why?
                        </button>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedResearcherId(r.id);
                          setModalOpen(true);
                        }}
                        className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
                      >
                        Add to my lists
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {selectedResearcherId && (
        <AddToListModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedResearcherId(null);
          }}
          itemId={selectedResearcherId}
          itemType="researcher"
          itemData={researchers.find(r => r.id === selectedResearcherId)}
        />
      )}
    </main>
  );
}