"use client";

import { useEffect, useMemo, useState } from "react";
import { getUser, UserProfile } from "@/app/lib/auth";
import {
  ubcUndergradResearchers,
  type Professor,
} from "@/app/professors/ubcUndergradResearchers";
import AddToListModal from "@/app/components/AddToListModal";
import { scoreProfessors, getStarLabel } from "@/app/professors/professorScoring";

const STORAGE_KEY = "rb_saved_prof_ids";

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
}

function buildMailto(p: Professor) {
  if (!p.email) return "#";

  const subject = "Undergraduate research inquiry";
  const body = `Hi Professor ${p.lastName},

My name is [YOUR NAME] and I’m an undergraduate student at UBC. I found your profile via ResearchBridge and I’m interested in your research.

Would you be open to having an undergraduate volunteer/research assistant this term? I’d love to share my CV and a brief summary of my interests.

Thank you for your time,
[YOUR NAME]
`;

  return `mailto:${p.email}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
}

export default function ProfessorsPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [q, setQ] = useState("");
  const [faculty, setFaculty] = useState("All");
  const [dept, setDept] = useState("All");
  const [sortBy, setSortBy] = useState<"relevance" | "alpha-asc" | "alpha-desc" | "rating-high" | "rating-low">("relevance");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProfId, setSelectedProfId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 50;

  // Load user on mount to get resume keywords
  useEffect(() => {
    const u = getUser();
    setUser(u);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed))
        setSavedIds(parsed.filter((x) => typeof x === "string"));
    } catch {}
  }, []);

  function persist(next: string[]) {
    setSavedIds(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }

  function toggleSaved(id: string) {
    persist(
      savedIds.includes(id)
        ? savedIds.filter((x) => x !== id)
        : [...savedIds, id]
    );
  }

  function handleAddToList(profId: string) {
    setSelectedProfId(profId);
    setModalOpen(true);
  }

  const faculties = useMemo(
    () => [
      "All",
      ...uniqueSorted(ubcUndergradResearchers.map((p: Professor) => p.faculty)),
    ],
    []
  );

  const departments = useMemo(() => {
    const all = ubcUndergradResearchers.flatMap(
      (p: Professor) => p.departments || []
    );
    return ["All", ...uniqueSorted(all)];
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    setCurrentPage(1); // Reset to first page when filters change

    let results = ubcUndergradResearchers.filter((p: Professor) => {
      const name = `${p.firstName} ${p.lastName}`.toLowerCase();
      const interests = (p.interests || []).join(" ").toLowerCase();
      const depts = (p.departments || []).join(" ").toLowerCase();
      const fac = (p.faculty || "").toLowerCase();

      const matchesQuery =
        !query ||
        name.includes(query) ||
        interests.includes(query) ||
        depts.includes(query) ||
        fac.includes(query);

      const matchesFaculty = faculty === "All" || p.faculty === faculty;
      const matchesDept =
        dept === "All" || (p.departments || []).includes(dept);

      return matchesQuery && matchesFaculty && matchesDept;
    });

    // Calculate scores for all filtered professors using percentile ranking
    const scoreMap = scoreProfessors(results, user?.resumeKeywords);

    // Sort based on sortBy
    if (sortBy === "alpha-asc") {
      results.sort((a, b) => a.lastName.localeCompare(b.lastName));
    } else if (sortBy === "alpha-desc") {
      results.sort((a, b) => b.lastName.localeCompare(a.lastName));
    } else if (sortBy === "rating-high" || sortBy === "rating-low") {
      results.sort((a, b) => {
        const scoreA = scoreMap.get(a.id)?.stars || 0;
        const scoreB = scoreMap.get(b.id)?.stars || 0;
        return sortBy === "rating-high" 
          ? scoreB - scoreA
          : scoreA - scoreB;
      });
    }
    // "relevance" keeps default order

    return { results, scoreMap };
  }, [q, faculty, dept, sortBy, user?.resumeKeywords]);

  const professors = filtered.results;
  const scoreMap = filtered.scoreMap;
  
  // Pagination
  const totalPages = Math.ceil(professors.length / perPage);
  const startIdx = (currentPage - 1) * perPage;
  const endIdx = startIdx + perPage;
  const pagedProfessors = professors.slice(startIdx, endIdx);
  
  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Professors</h1>
            <p className="mt-2 text-white/70">
              Search UBC researchers who explicitly indicated interest in undergrad
              projects.
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
              href="/opportunities"
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
            >
              Opportunities
            </a>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-8 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, interests, department…"
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/30"
          />

          <select
            value={faculty}
            onChange={(e) => setFaculty(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/30"
          >
            {faculties.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          <select
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/30"
          >
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/30"
          >
            <option value="relevance">Sort: Relevance</option>
            <option value="alpha-asc">Sort: A-Z</option>
            <option value="alpha-desc">Sort: Z-A</option>
            <option value="rating-high">Sort: Rating High-Low</option>
            <option value="rating-low">Sort: Rating Low-High</option>
          </select>
        </div>

        <div className="mt-6 flex items-center justify-between text-sm text-white/70">
          <div>{professors.length} result(s)</div>
          {professors.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="rounded-xl border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              <span className="text-sm text-white/70">Page {currentPage} of {totalPages}</span>
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="rounded-xl border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          )}
        </div>
        <div className="flex justify-center gap-2 mt-4 text-xs text-white/60">
          Showing {startIdx + 1}-{Math.min(endIdx, professors.length)} of {professors.length}
        </div>
        <button
          type="button"
          onClick={() => {
            setQ("");
            setFaculty("All");
            setDept("All");
            setCurrentPage(1);
          }}
          className="rounded-lg border border-white/10 px-3 py-1 hover:bg-white/10 mt-2"
        >
          Reset search
        </button>

        <div className="mt-4 grid gap-4">
          {pagedProfessors.map((p: Professor) => {
            const isSaved = savedIds.includes(p.id);
            const score = scoreMap.get(p.id);

            return (
              <div
                key={p.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-5"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <a
                      href={p.profileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-lg font-medium underline decoration-white/40 underline-offset-4 hover:decoration-white"
                    >
                      {p.firstName} {p.lastName}
                    </a>
                    <div className="mt-1 text-sm text-white/70">
                      {p.faculty}
                      {p.departments?.length
                        ? ` · ${p.departments.join(", ")}`
                        : ""}
                    </div>
                    {score && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-yellow-400 text-base leading-none">
                            {"★".repeat(Math.floor(score.stars))}
                            {score.stars % 1 >= 0.3 ? "☆" : ""}
                            {"☆".repeat(5 - Math.ceil(score.stars))}
                          </span>
                          <span className="text-sm text-white/80 font-medium">
                            {score.stars.toFixed(1)}
                          </span>
                        </div>
                        <span className="text-xs text-white/60">· {getStarLabel(score.stars)}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            alert(
                              `Likelihood Score Breakdown:\n\n` +
                              `Percentile: ${(score.percentile * 100).toFixed(0)}th percentile\n` +
                              `Stars: ${score.stars}/5 ⭐\n\n` +
                              `Factors:\n` +
                              `Openness: ${(score.breakdown.openness * 100).toFixed(0)}%\n` +
                              `Fit: ${(score.breakdown.fit * 100).toFixed(0)}%\n` +
                              `Activity: ${score.breakdown.activity.toFixed(2)} (z-score)\n` +
                              `Busy penalty: ${score.breakdown.busy.toFixed(2)} (z-score)\n\n` +
                              `Reasons:\n${score.reasons.map(r => `• ${r}`).join("\n")}\n\n` +
                              `Confidence: ${score.confidence}\n\n` +
                              `Note: Ratings are relative to current search results using percentile ranking.`
                            );
                          }}
                          className="text-xs text-white/50 hover:text-white/80 underline"
                        >
                          Why?
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {p.email ? (
                      <a
                        href={buildMailto(p)}
                        className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
                      >
                        Email
                      </a>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => handleAddToList(p.id)}
                      className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
                    >
                      Add to my lists
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/70">
                  {(p.interests || []).slice(0, 10).map((t: string) => (
                    <span
                      key={t}
                      className="rounded-full border border-white/10 bg-black/20 px-3 py-1"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}

          {pagedProfessors.length === 0 && professors.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
              No matches. Try fewer filters, or accept that your "perfect fit"
              does not exist.
            </div>
          )}
        </div>

        {professors.length > 0 && (
          <div className="mt-6 flex items-center justify-between text-sm text-white/70">
            <div>
              {pagedProfessors.length} professor{pagedProfessors.length !== 1 ? "s" : ""} on page {currentPage}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="rounded-xl border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              <span className="text-sm text-white/70">Page {currentPage} of {totalPages}</span>
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="rounded-xl border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedProfId && (
        <AddToListModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedProfId(null);
          }}
          itemId={selectedProfId}
          itemType="professor"
        />
      )}
    </main>
  );
}
