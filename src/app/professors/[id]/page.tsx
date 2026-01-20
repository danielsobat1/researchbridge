"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ubcUndergradResearchers,
  type Professor,
} from "@/app/professors/ubcUndergradResearchers";

const STORAGE_KEY = "rb_saved_prof_ids";

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
}

export default function ProfessorsPage() {
  const [q, setQ] = useState("");
  const [faculty, setFaculty] = useState("All");
  const [dept, setDept] = useState("All");
  const [savedIds, setSavedIds] = useState<string[]>([]);

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
    persist(savedIds.includes(id) ? savedIds.filter((x) => x !== id) : [...savedIds, id]);
  }

  const faculties = useMemo(
    () => ["All", ...uniqueSorted(ubcUndergradResearchers.map((p: Professor) => p.faculty))],
    []
  );

  const departments = useMemo(() => {
    const all = ubcUndergradResearchers.flatMap((p: Professor) => p.departments || []);
    return ["All", ...uniqueSorted(all)];
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    return ubcUndergradResearchers.filter((p: Professor) => {
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
      const matchesDept = dept === "All" || (p.departments || []).includes(dept);

      return matchesQuery && matchesFaculty && matchesDept;
    });
  }, [q, faculty, dept]);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Professors</h1>
            <p className="mt-2 text-white/70">
              Search UBC researchers who explicitly indicated interest in undergrad projects.
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/my-list"
              className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
            >
              My Lists
            </Link>
            <Link
              href="/opportunities"
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
            >
              Opportunities
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-8 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-3">
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
        </div>

        <div className="mt-6 flex items-center justify-between text-sm text-white/70">
          <div>{filtered.length} result(s)</div>
          <button
            type="button"
            onClick={() => {
              setQ("");
              setFaculty("All");
              setDept("All");
            }}
            className="rounded-lg border border-white/10 px-3 py-1 hover:bg-white/10"
          >
            Clear
          </button>
        </div>

        <div className="mt-4 grid gap-4">
          {filtered.map((p: Professor) => {
            const isSaved = savedIds.includes(p.id);

            return (
              <div key={p.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <Link
                      href={`/professors/${p.id}`}
                      className="text-lg font-medium hover:text-white hover:underline"
                    >
                      {p.firstName} {p.lastName}
                    </Link>

                    <div className="mt-1 text-sm text-white/70">
                      {p.faculty}
                      {p.departments?.length ? ` · ${p.departments.join(", ")}` : ""}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/professors/${p.id}`}
                      className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
                    >
                      Details
                    </Link>

                    <a
                      href={p.profileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
                    >
                      Official profile
                    </a>

                    <button
                      type="button"
                      onClick={() => toggleSaved(p.id)}
                      className={
                        isSaved
                          ? "rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
                          : "rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
                      }
                    >
                      {isSaved ? "Saved" : "Add to my lists"}
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

          {filtered.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
              No matches. Try fewer filters, or accept that your “perfect fit” does not exist.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
