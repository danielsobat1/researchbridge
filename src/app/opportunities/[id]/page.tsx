"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { opportunities } from "../opportunities";

const STORAGE_KEY = "rb_saved_opportunity_ids";

export default function OpportunityDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const opportunity = useMemo(
    () => opportunities.find((o) => o.id === id),
    [id]
  );

  const [savedIds, setSavedIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setSavedIds(parsed);
    } catch {}
  }, []);

  function persist(next: string[]) {
    setSavedIds(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }

  function toggleSaved() {
    if (!id) return;
    const isSaved = savedIds.includes(id);
    persist(isSaved ? savedIds.filter((x) => x !== id) : [...savedIds, id]);
  }

  if (!opportunity) {
    return (
      <main className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <a className="text-white/70 hover:text-white" href="/opportunities">
            ← Back
          </a>
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
            Opportunity not found.
          </div>
        </div>
      </main>
    );
  }

  const isSaved = !!id && savedIds.includes(id);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <a className="text-white/70 hover:text-white" href="/opportunities">
          ← Back to opportunities
        </a>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">{opportunity.title}</h1>
              <p className="mt-2 text-white/70">
                {opportunity.lab} · {opportunity.dept}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={toggleSaved}
                className={
                  isSaved
                    ? "rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
                    : "rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
                }
              >
                {isSaved ? "Saved (remove)" : "Add to my lists"}
              </button>

              <a
                href={`/apply/${opportunity.id}`}
                className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
              >
                Apply
              </a>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 text-xs text-white/70">
            <span className="rounded-full border border-white/10 px-3 py-1">
              {opportunity.type}
            </span>
            <span className="rounded-full border border-white/10 px-3 py-1">
              {opportunity.hoursPerWeek} hrs/week
            </span>
            <span className="rounded-full border border-white/10 px-3 py-1">
              {opportunity.location}
            </span>
            {opportunity.tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-white/10 bg-black/20 px-3 py-1"
              >
                {t}
              </span>
            ))}
          </div>

          <p className="mt-6 text-sm text-white/80">{opportunity.description}</p>
        </div>
      </div>
    </main>
  );
}
