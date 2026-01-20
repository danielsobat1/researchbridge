"use client";

import { useEffect, useState } from "react";
import { getUser, UserProfile } from "@/app/lib/auth";

function hashInterests(interests: string[]): string {
  return interests.sort().join('|').toLowerCase();
}

export default function Home() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [mounted, setMounted] = useState(false);
  const [hasForYouUpdate, setHasForYouUpdate] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [colorTheme, setColorTheme] = useState<"default" | "blue" | "green" | "purple">("default");

  useEffect(() => {
    const currentUser = getUser();
    setUser(currentUser);
    
    const savedTheme = localStorage.getItem("rb_theme") as "light" | "dark" | null;
    const savedColor = localStorage.getItem("rb_color") as "default" | "blue" | "green" | "purple" | null;
    if (savedTheme) setTheme(savedTheme);
    if (savedColor) setColorTheme(savedColor);
    
    setMounted(true);
    checkForYouUpdate(currentUser);
    
    // Poll localStorage for theme changes
    const interval = setInterval(() => {
      const currentTheme = localStorage.getItem("rb_theme") as "light" | "dark" | null;
      const currentColor = localStorage.getItem("rb_color") as "default" | "blue" | "green" | "purple" | null;
      if (currentTheme) setTheme(currentTheme);
      if (currentColor) setColorTheme(currentColor);
    }, 100);
    
    return () => clearInterval(interval);
  }, []);
  
  const checkForYouUpdate = (currentUser: UserProfile | null) => {
    if (!currentUser) {
      setHasForYouUpdate(false);
      return;
    }
    
    const university = (currentUser.university || "").toLowerCase();
    if (!university.includes("ubc")) {
      setHasForYouUpdate(false);
      return;
    }
    
    const currentHash = hashInterests(currentUser.interests || []);
    const lastHash = currentUser.lastInterestsHash || "";
    const lastView = currentUser.lastForYouView;
    const today = new Date().toISOString().slice(0, 10);
    const lastViewDate = lastView ? lastView.slice(0, 10) : "";
    
    // Show notification if:
    // 1. Interests changed since last view, OR
    // 2. It's a new day since last view
    const interestsChanged = currentHash !== lastHash && lastHash !== "";
    const newDay = lastViewDate !== today && lastViewDate !== "";
    const neverViewed = !lastView;
    
    setHasForYouUpdate(interestsChanged || newDay || neverViewed);
  };

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto max-w-5xl px-6 py-20">
        {user && (
          <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-lg">
              Welcome back, <span className="font-semibold">{user.firstName}</span>! 👋
            </p>
            {user.university && (
              <p className="mt-2 text-white/70">Based at {user.university}</p>
            )}
            {user.interests.length > 0 && (
              <p className="mt-2 text-white/70">
                Interests: {user.interests.join(", ")}
              </p>
            )}
          </div>
        )}

        <h1 className="text-5xl font-semibold tracking-tight">
          Find research without cold-email roulette.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-white/70">
          Built for UBC students first, open to everyone. Browse undergrad-friendly projects,
          see what labs actually want, and apply with one clean profile.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <a
            href="/discover"
            className="rounded-xl bg-white px-5 py-3 text-center text-black font-semibold hover:bg-white/90"
          >
            Discover Researchers
          </a>
          <a
            href="/professors"
            className="rounded-xl bg-white px-5 py-3 text-center text-black font-semibold hover:bg-white/90"
          >
            UBC Professors
          </a>
          <a
            href="/opportunities"
            className="rounded-xl bg-white px-5 py-3 text-center text-black font-semibold hover:bg-white/90"
          >
            Browse Opportunities
          </a>
          {!user && (
            <a
              href="/auth"
              className="rounded-xl border border-white/20 px-5 py-3 text-center text-white hover:bg-white/10 sm:col-span-2 md:col-span-1"
            >
              Create Account
            </a>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <a
            href="/for-you"
            className="flex items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 text-center text-black font-semibold shadow-md transition hover:bg-white/90"
          >
            <span>For You — Daily Picks Tailored For You</span>
            {hasForYouUpdate && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-semibold">
                1
              </span>
            )}
          </a>
          <a
            href="/resume-analyzer"
            className="flex items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 text-center text-black font-semibold shadow-md transition hover:bg-white/90"
          >
            <span>Resume Analyzer</span>
          </a>
        </div>
      </section>
    </main>
  );
}
