"use client";

import { useEffect, useMemo, useState } from "react";
import { opportunities } from "./opportunities";
import AddToListModal from "@/app/components/AddToListModal";

const STORAGE_KEY = "rb_saved_opportunity_ids";

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

export default function OpportunitiesPage() {
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("All");
  const [type, setType] = useState("All");
  const [location, setLocation] = useState("All");

  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOppId, setSelectedOppId] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const savedTheme = localStorage.getItem("rb_theme") as "light" | "dark" | null;
    if (savedTheme) setTheme(savedTheme);
    
    // Poll localStorage for theme changes
    const interval = setInterval(() => {
      const currentTheme = localStorage.getItem("rb_theme") as "light" | "dark" | null;
      if (currentTheme) setTheme(currentTheme);
    }, 100);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setSavedIds(parsed.filter((x) => typeof x === "string"));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedIds));
    } catch {
      // ignore
    }
  }, [savedIds]);

  function toggleSaved(id: string) {
    setSelectedOppId(id);
    setIsModalOpen(true);
  }

  const depts = useMemo(
    () => ["All", ...uniqueSorted(opportunities.map((o) => o.dept))],
    []
  );
  const types = useMemo(
    () => ["All", ...uniqueSorted(opportunities.map((o) => o.type))],
    []
  );
  const locations = useMemo(
    () => ["All", ...uniqueSorted(opportunities.map((o) => o.location))],
    []
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    return opportunities.filter((o) => {
      const matchesQuery =
        !query ||
        o.title.toLowerCase().includes(query) ||
        o.lab.toLowerCase().includes(query) ||
        o.dept.toLowerCase().includes(query) ||
        o.tags.some((t) => t.toLowerCase().includes(query));

      const matchesDept = dept === "All" || o.dept === dept;
      const matchesType = type === "All" || o.type === type;
      const matchesLocation = location === "All" || o.location === location;

      return matchesQuery && matchesDept && matchesType && matchesLocation;
    });
  }, [q, dept, type, location]);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Opportunities</h1>
            <p className="mt-2 text-white/70">
              Search labs, departments, and skills.
            </p>
            <p className="mt-2 text-xs text-white/70 bg-white/10 rounded-lg px-3 py-2 w-fit">
              <span className={`inline-block rounded-full px-2 py-1 font-medium mr-2 ${
                theme === "light" 
                  ? "bg-yellow-400 text-yellow-900" 
                  : "bg-yellow-500/20 text-yellow-300"
              }`}>Beta</span>These are example opportunities to demonstrate the platform.
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
    href="/post"
    className="w-fit rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
  >
    Post an opportunity
  </a>
</div>

        </div>

        {/* Filters */}
        <div className="mt-8 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, lab, skill…"
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/30"
          />

          <select
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/30"
          >
            {depts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/30"
          >
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/30"
          >
            {locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        {/* Results */}
        <div className="mt-6 flex items-center justify-between text-sm text-white/70">
          <div>{filtered.length} result(s)</div>
          <button
            onClick={() => {
              setQ("");
              setDept("All");
              setType("All");
              setLocation("All");
            }}
            className="rounded-lg border border-white/10 px-3 py-1 hover:bg-white/10"
            type="button"
          >
            Clear
          </button>
        </div>

        <div className="mt-4 grid gap-4">
          {filtered.map((o) => {
            const isSaved = savedIds.includes(o.id);

            return (
              <div
                key={o.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-5"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-lg font-medium">{o.title}</div>
                    <div className="mt-1 text-sm text-white/70">
                      {o.lab} · {o.dept}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => toggleSaved(o.id)}
                      className={
                        isSaved
                          ? "rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
                          : "rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
                      }
                    >
                      {isSaved ? "Saved (remove)" : "Add to my lists"}
                    </button>

                    {o.applyUrl ? (
                      <a
                        href={o.applyUrl}
                        className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Apply
                      </a>
                    ) : o.email ? (
                      <a
                        href={`mailto:${o.email}?subject=${encodeURIComponent(
                          "Undergraduate research interest"
                        )}`}
                        className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
                      >
                        Email
                      </a>
                    ) : null}
                  </div>
                </div>

                <p className="mt-4 text-sm text-white/70">{o.description}</p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/70">
                  <span className="rounded-full border border-white/10 px-3 py-1">
                    {o.type}
                  </span>
                  <span className="rounded-full border border-white/10 px-3 py-1">
                    {o.hoursPerWeek} hrs/week
                  </span>
                  <span className="rounded-full border border-white/10 px-3 py-1">
                    {o.location}
                  </span>
                  {o.tags.map((t) => (
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
              No matches. Try a different keyword (or lower your standards).
            </div>
          )}
        </div>
      </div>

      {selectedOppId && (
        <AddToListModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedOppId(null);
          }}
          itemId={selectedOppId}
          itemType="opportunity"
          itemData={opportunities.find(o => o.id === selectedOppId)}
        />
      )}
    </main>
  );
}
