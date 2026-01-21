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
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-transparent to-cyan-500/20 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-900/30 via-transparent to-transparent pointer-events-none" />
      
      <section className="relative mx-auto max-w-6xl px-6 py-24">
        {user && (
          <div className="group mb-12 rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 shadow-2xl hover:border-white/20 transition-all duration-500 hover:shadow-purple-500/20">
            <p className="text-xl font-medium">
              Welcome back, <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent font-bold">{user.firstName}</span>! 👋
            </p>
            {user.university && (
              <p className="mt-3 text-white/60 text-sm">Based at {user.university}</p>
            )}
            {user.interests.length > 0 && (
              <p className="mt-3 text-white/60 text-sm">
                Interests: {user.interests.join(", ")}
              </p>
            )}
          </div>
        )}

        <h1 className="text-7xl font-bold tracking-tight leading-[1.1] max-w-4xl">
          Find research without{" "}
          <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
            cold-email roulette
          </span>
          .
        </h1>
        <p className="mt-8 max-w-2xl text-xl text-white/60 leading-relaxed">
          Built for UBC students first, open to everyone. Browse undergrad-friendly projects,
          see what labs actually want, and apply with one clean profile.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <a
            href="/discover"
            className="group relative overflow-hidden rounded-2xl bg-white px-6 py-4 text-center text-black font-semibold transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-violet-500/50"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span className="relative group-hover:text-white transition-colors duration-300">Discover Researchers</span>
          </a>
          <a
            href="/professors"
            className="group relative overflow-hidden rounded-2xl bg-white px-6 py-4 text-center text-black font-semibold transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-cyan-500/50"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span className="relative group-hover:text-white transition-colors duration-300">UBC Professors</span>
          </a>
          <a
            href="/opportunities"
            className="group relative overflow-hidden rounded-2xl bg-white px-6 py-4 text-center text-black font-semibold transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-purple-500/50"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span className="relative group-hover:text-white transition-colors duration-300">Browse Opportunities</span>
          </a>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <a
            href="/for-you"
            className="group relative flex items-center justify-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl px-8 py-5 text-white font-semibold shadow-2xl transition-all duration-500 hover:scale-[1.02] hover:border-violet-500/50 hover:shadow-violet-500/30"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 to-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <span className="relative">For You — Daily Picks Tailored For You</span>
            {hasForYouUpdate && (
              <span className="relative inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold shadow-lg">
                1
              </span>
            )}
          </a>
          <a
            href="/resume-analyzer"
            className="group relative flex items-center justify-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl px-8 py-5 text-white font-semibold shadow-2xl transition-all duration-500 hover:scale-[1.02] hover:border-cyan-500/50 hover:shadow-cyan-500/30"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <span className="relative">Resume Analyzer</span>
          </a>
        </div>

        {!user && (
          <div className="mt-8">
            <a
              href="/auth"
              className="group relative block overflow-hidden rounded-2xl border border-white/20 bg-white/5 backdrop-blur-xl px-6 py-4 text-center text-white font-semibold shadow-xl transition-all duration-500 hover:scale-[1.02] hover:border-white/40 hover:shadow-2xl"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <span className="relative">Create Account</span>
            </a>
          </div>
        )}
      </section>
    </main>
  );
}
