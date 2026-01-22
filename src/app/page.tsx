"use client";

import { useEffect, useState } from "react";
import { getUser, UserProfile } from "@/app/lib/auth";

function hashInterests(interests: string[]): string {
  return interests.sort().join("|").toLowerCase();
}

export default function Home() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [mounted, setMounted] = useState(false);
  const [hasForYouUpdate, setHasForYouUpdate] = useState(false);

  useEffect(() => {
    const currentUser = getUser();
    setUser(currentUser);
    setMounted(true);
    checkForYouUpdate(currentUser);
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

    const interestsChanged = currentHash !== lastHash && lastHash !== "";
    const newDay = lastViewDate !== today && lastViewDate !== "";
    const neverViewed = !lastView;

    setHasForYouUpdate(interestsChanged || newDay || neverViewed);
  };

  if (!mounted) return null;

  return (
    <main className="relative min-h-screen bg-[#0b0b0b] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,_rgba(255,255,255,0.08),_rgba(11,11,11,0.95)_55%,_rgba(0,0,0,1))]" />

      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,_rgba(255,255,255,0.18),_transparent_45%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,_rgba(255,255,255,0.14),_rgba(11,11,11,0.25)_45%,_rgba(11,11,11,0.95))]" />
        </div>

        <div className="absolute bottom-0 left-1/2 h-[88%] w-[160%] -translate-x-1/2 translate-y-[20%] transform-gpu">
          <div
            className="absolute inset-0 rounded-[90px] border border-white/10 bg-[repeating-linear-gradient(180deg,_rgba(255,255,255,0.15)_0px,_rgba(255,255,255,0.15)_2px,_rgba(11,11,11,0)_24px,_rgba(11,11,11,0)_48px)]"
            style={{ transform: "rotateX(68deg)" }}
          />
          <div
            className="absolute inset-0 rounded-[90px] border-l border-r border-white/25"
            style={{ transform: "rotateX(68deg)" }}
          />
          <div
            className="absolute left-1/2 top-[26%] h-[60%] w-[12%] -translate-x-1/2 rounded-t-[40px] border border-white/25 bg-[linear-gradient(to_bottom,_rgba(255,255,255,0.15),_rgba(11,11,11,0))]"
            style={{ transform: "rotateX(68deg)" }}
          />
        </div>

        <div className="absolute inset-0">
          <div className="absolute left-1/2 top-[14%] h-[60%] w-[60%] -translate-x-1/2">
            {[...Array(8)].map((_, index) => {
              const offset = 12 + index * 10;
              return (
                <div
                  key={`left-${offset}`}
                  className="absolute bottom-0 h-full w-px bg-white/20"
                  style={{
                    left: `${offset}%`,
                    transform: "skewX(6deg)",
                    transformOrigin: "bottom",
                  }}
                />
              );
            })}
            {[...Array(8)].map((_, index) => {
              const offset = 88 - index * 10;
              return (
                <div
                  key={`right-${offset}`}
                  className="absolute bottom-0 h-full w-px bg-white/20"
                  style={{
                    left: `${offset}%`,
                    transform: "skewX(-6deg)",
                    transformOrigin: "bottom",
                  }}
                />
              );
            })}
            <div className="absolute left-1/2 top-[22%] h-[38%] w-[18%] -translate-x-1/2 rounded-t-[40px] border border-white/25" />
          </div>
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-10">
          {user && (
            <div className="w-fit rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm text-white/80 backdrop-blur">
              Welcome back, <span className="text-white font-semibold">{user.firstName}</span>
            </div>
          )}

          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.5em] text-white/60">Bridge the distance</p>
            <h1 className="mt-6 text-5xl font-semibold leading-tight sm:text-6xl">
              Walk into research that
              <span className="block text-white/80">meets you halfway.</span>
            </h1>
            <p className="mt-6 text-lg text-white/70">
              BRIDGE is the AI-powered path for college students to match with real research,
              mentors, and funded projects. Every scroll step moves you closer to the right lab.
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <a
              href="/discover"
              className="group relative overflow-hidden rounded-full bg-white px-7 py-3 text-sm font-semibold text-black shadow-2xl transition hover:-translate-y-0.5"
            >
              <span className="relative z-10">Explore Research</span>
              <span className="absolute inset-0 z-0 translate-y-full bg-gradient-to-r from-white to-neutral-200 transition group-hover:translate-y-0" />
            </a>
            <a
              href="/for-you"
              className="group flex items-center gap-2 rounded-full border border-white/25 px-7 py-3 text-sm font-semibold text-white/80 transition hover:border-white hover:text-white"
            >
              For You Picks
              {hasForYouUpdate && <span className="inline-flex h-2 w-2 rounded-full bg-white" />}
            </a>
            {!user && (
              <a
                href="/auth"
                className="rounded-full border border-white/25 px-7 py-3 text-sm font-semibold text-white/60 transition hover:border-white hover:text-white"
              >
                Create Account
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="relative min-h-screen px-6 py-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(255,255,255,0.12),_transparent_55%)]" />
        <div className="mx-auto flex max-w-5xl flex-col gap-12">
          <div className="grid gap-8 md:grid-cols-[1.2fr_1fr]">
            <div>
              <h2 className="text-4xl font-semibold">Advance down the bridge.</h2>
              <p className="mt-4 text-lg text-white/70">
                Each scroll moves you forward. We surface the research you match, the labs that
                respond, and the mentors ready for undergrads.
              </p>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/5 p-6 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.4em] text-white/60">AI signals</p>
              <ul className="mt-6 space-y-4 text-white/70">
                <li>• Match score based on your interests.</li>
                <li>• Live openings from active labs.</li>
                <li>• Mentor fit summaries in one glance.</li>
              </ul>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <a
              href="/professors"
              className="group rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-white/40 hover:bg-white/10"
            >
              <h3 className="text-lg font-semibold">Faculty Spotlights</h3>
              <p className="mt-2 text-sm text-white/60">
                See professors who are actively mentoring undergrads.
              </p>
            </a>
            <a
              href="/opportunities"
              className="group rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-white/40 hover:bg-white/10"
            >
              <h3 className="text-lg font-semibold">Project Map</h3>
              <p className="mt-2 text-sm text-white/60">
                Browse funded research roles and assistantships.
              </p>
            </a>
            <a
              href="/resume-analyzer"
              className="group rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-white/40 hover:bg-white/10"
            >
              <h3 className="text-lg font-semibold">Resume Analyzer</h3>
              <p className="mt-2 text-sm text-white/60">
                Let AI sharpen your research pitch and fit.
              </p>
            </a>
          </div>
        </div>
      </section>

      <section className="relative min-h-screen px-6 pb-24">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-10 h-[120%] w-[120%] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_50%_20%,_rgba(255,255,255,0.2),_transparent_60%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,_rgba(11,11,11,0),_rgba(11,11,11,0.7)_55%,_rgba(0,0,0,1))]" />
        </div>

        <div className="relative mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-10 text-center">
          <p className="text-xs uppercase tracking-[0.6em] text-white/60">Beyond the bridge</p>
          <div className="relative rise-text">
            <p className="absolute left-1/2 top-10 -translate-x-1/2 text-sm uppercase tracking-[0.5em] text-white/40">
              Research
            </p>
            <h2 className="text-5xl font-semibold leading-tight sm:text-6xl">
              <span className="block text-white/80">RESEARCH</span>
              <span className="block text-white">BRIDGE</span>
            </h2>
            <div className="mt-4 h-px w-32 bg-white/50 mx-auto" />
          </div>
          <p className="max-w-2xl text-lg text-white/70">
            As you reach the far side, the opportunity rises. Build a profile, apply with AI
            guidance, and meet mentors who are ready for you.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="/apply"
              className="rounded-full bg-white px-8 py-3 text-sm font-semibold text-black transition hover:-translate-y-0.5"
            >
              Apply to Research
            </a>
            <a
              href="/discover"
              className="rounded-full border border-white/25 px-8 py-3 text-sm font-semibold text-white/70 transition hover:border-white hover:text-white"
            >
              See the Bridge Map
            </a>
          </div>
        </div>
      </section>

      <style jsx global>{`
        @keyframes rise {
          0% {
            opacity: 0;
            transform: translateY(40px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .rise-text {
          animation: rise 1.6s ease-out forwards;
        }
      `}</style>
    </main>
  );
}
