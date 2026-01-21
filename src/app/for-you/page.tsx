"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, UserProfile, updateUser } from "@/app/lib/auth";
import { ubcUndergradResearchers } from "@/app/professors/ubcUndergradResearchers";
import { scoreProfessors, getStarLabel as getProfStarLabel } from "@/app/professors/professorScoring";
import { scoreResearchers, getStarLabel as getResearcherStarLabel } from "@/app/discover/researcherScoring";

type OpenAlexResearcher = {
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

function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function hashInterests(interests: string[]): string {
  return interests.sort().join('|').toLowerCase();
}

function seededRandom(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += h << 13; h ^= h >>> 7; h += h << 3; h ^= h >>> 17; h += h << 5;
    return (h >>> 0) / 4294967296;
  };
}

type RankedProfessor = {
  id: string;
  name: string;
  faculty: string;
  departments?: string[];
  interests: string[];
  profileUrl: string;
  matchScore: number;
  matchedInterests: string[];
  stars: number;
  source: 'ubc' | 'openalex';
  institution?: string;
  worksCount?: number;
  citedByCount?: number;
  starLabel?: string;
  percentile?: number;
};

function rankResearchers(userInterests: string[], limit = 8, resumeKeywords?: string[]): RankedProfessor[] {
  const interestsNorm = userInterests.map(normalize).filter(Boolean);
  const today = new Date().toISOString().slice(0, 10);
  const rand = seededRandom(today);

  // Filter professors by interest match
  const filtered = ubcUndergradResearchers.filter((prof) => {
    if (interestsNorm.length === 0) return true; // Show all if no interests
    const profInterests = (prof.interests || []).map(normalize).filter(Boolean);
    const matched = interestsNorm.filter((i) => profInterests.some((p) => p.includes(i) || i.includes(p)));
    return matched.length > 0;
  });

  // Use proper scoring system with resume keywords boost
  const scoreMap = scoreProfessors(filtered, resumeKeywords);
  
  // Add daily randomization to scores and convert to ranked list
  const scored = filtered.map((prof) => {
    const profInterests = (prof.interests || []).map(normalize).filter(Boolean);
    const matched = interestsNorm.filter((i) => profInterests.some((p) => p.includes(i) || i.includes(p)));
    const score = scoreMap.get(prof.id);
    const noise = rand() * 0.3; // daily shuffle factor
    const matchScore = (score?.overall || 0) + noise;

    return {
      id: prof.id,
      name: `${prof.firstName} ${prof.lastName}`,
      faculty: prof.faculty,
      departments: prof.departments,
      interests: prof.interests || [],
      profileUrl: prof.profileUrl,
      matchScore,
      matchedInterests: matched,
      stars: score?.stars || 1.0,
      starLabel: score ? getProfStarLabel(score.stars) : undefined,
      percentile: score?.percentile,
      source: 'ubc' as const,
    } as RankedProfessor;
  })
    .sort((a, b) => b.matchScore - a.matchScore)
    .filter(p => p.stars >= 4.0) // Filter to 4+ stars
    .slice(0, limit); // Then limit to desired count

  return scored;
}

export default function ForYouPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [isUBC, setIsUBC] = useState(false);
  const [openAlexResearchers, setOpenAlexResearchers] = useState<RankedProfessor[]>([]);
  const [loadingOpenAlex, setLoadingOpenAlex] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'ubc' | 'global'>('all');

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.push("/auth");
      return;
    }
    setUser(u);
    setIsUBC((u.university || "").toLowerCase().includes("ubc"));
    setReady(true);
    
    // Mark as viewed when page loads
    updateUser({
      lastForYouView: new Date().toISOString(),
      lastInterestsHash: hashInterests(u.interests || []),
    });
    
    // Fetch OpenAlex researchers if user has interests
    if (u.interests && u.interests.length > 0) {
      fetchOpenAlexResearchers(u.interests);
    }
  }, [router]);
  
  const fetchOpenAlexResearchers = async (interests: string[]) => {
    setLoadingOpenAlex(true);
    try {
      // Search for each interest area and combine results
      const allResearchers: OpenAlexResearcher[] = [];
      
      for (const interest of interests.slice(0, 3)) { // Limit to first 3 interests to avoid too many API calls
        const params = new URLSearchParams();
        params.append('area', interest);
        params.append('active', 'true');
        
        const response = await fetch(`/api/discover?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          if (data.researchers) {
            allResearchers.push(...data.researchers.slice(0, 25)); // Top 25 per interest (increased from 10)
          }
        }
      }
      
      // Remove duplicates
      const uniqueResearchers = Array.from(
        new Map(allResearchers.map(r => [r.id, r])).values()
      );
      
      // Use proper scoring system
      const scoreMap = scoreResearchers(uniqueResearchers);
      
      const interestsNorm = interests.map(normalize).filter(Boolean);
      const today = new Date().toISOString().slice(0, 10);
      const rand = seededRandom(today);
      
      const ranked: RankedProfessor[] = uniqueResearchers.map((r) => {
        const score = scoreMap.get(r.id);
        const noise = rand() * 0.3;
        const matchScore = (score?.overall || 0) + noise;
        
        return {
          id: r.id,
          name: r.name,
          faculty: r.lastKnownInstitution?.name || 'Unknown',
          interests: [], // OpenAlex doesn't provide interests directly
          profileUrl: r.id,
          matchScore,
          matchedInterests: interestsNorm.slice(0, 2), // Assume some match
          stars: score?.stars || 1.0,
          starLabel: score ? getResearcherStarLabel(score.stars) : undefined,
          percentile: score?.percentile,
          source: 'openalex' as const,
          institution: r.lastKnownInstitution?.name,
          worksCount: r.worksCount || undefined,
          citedByCount: r.citedByCount || undefined,
        };
      });
      
      // Sort by match score, filter to 4+ stars, then take top 20 results
      const sorted = ranked
        .sort((a, b) => b.matchScore - a.matchScore)
        .filter(r => r.stars >= 4.0)
        .slice(0, 20);
      
      setOpenAlexResearchers(sorted);
    } catch (error) {
      console.error('Error fetching OpenAlex researchers:', error);
    } finally {
      setLoadingOpenAlex(false);
    }
  };

  const recommendations = useMemo(() => {
    if (!user || !isUBC) return [];
    return rankResearchers(user.interests || [], 8, user.resumeKeywords);
  }, [user, isUBC]);
  
  const combinedResearchers = useMemo(() => {
    // Interleave UBC and OpenAlex researchers
    const combined: RankedProfessor[] = [];
    const maxLen = Math.max(recommendations.length, openAlexResearchers.length);
    
    for (let i = 0; i < maxLen; i++) {
      if (i < recommendations.length) {
        combined.push(recommendations[i]);
      }
      if (i < openAlexResearchers.length) {
        combined.push(openAlexResearchers[i]);
      }
    }
    
    return combined;
  }, [recommendations, openAlexResearchers]);
  
  const filteredResearchers = useMemo(() => {
    let filtered = combinedResearchers;
    
    // Filter by source
    if (sourceFilter === 'ubc') {
      filtered = filtered.filter(r => r.source === 'ubc');
    } else if (sourceFilter === 'global') {
      filtered = filtered.filter(r => r.source === 'openalex');
    }
    
    return filtered;
  }, [combinedResearchers, sourceFilter]);

  if (!ready) return null;

  return (
    <main className=\"relative min-h-screen overflow-hidden bg-black text-white\">
      {/* Gradient background */}
      <div className=\"absolute inset-0 bg-gradient-to-br from-pink-600/20 via-transparent to-violet-500/20 pointer-events-none\" />
      <div className=\"absolute inset-0 bg-[radial-gradient(ellipse_at_top_center,_var(--tw-gradient-stops))] from-fuchsia-900/30 via-transparent to-transparent pointer-events-none\" />
      
      <div className=\"relative mx-auto max-w-5xl px-6 py-16 space-y-8\">
        <header className=\"space-y-3\">\n          <p className=\"text-sm uppercase tracking-[0.2em] text-white/50 font-medium\">Daily Scoop</p>
          <h1 className="text-4xl font-bold">For You</h1>
          <p className="text-white/70">
            Fresh researchers matched to your interests. Updates every day with UBC researchers and global scholars from OpenAlex.
          </p>
          {user?.interests?.length ? (
            <div className="flex flex-wrap gap-2 pt-2">
              {user.interests.map((interest) => (
                <span
                  key={interest}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80"
                >
                  {interest}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-sm text-white/60 pt-2">Add interests in Settings for sharper picks.</div>
          )}
        </header>

        {isUBC && (
          <div className="flex gap-2 rounded-2xl border border-white/10 bg-white/5 p-3">
            <button
              onClick={() => setSourceFilter('all')}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition ${
                sourceFilter === 'all'
                  ? 'bg-white text-black'
                  : 'bg-transparent text-white/70 hover:bg-white/10'
              }`}
            >
              All Sources
            </button>
            <button
              onClick={() => setSourceFilter('ubc')}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition ${
                sourceFilter === 'ubc'
                  ? 'bg-white text-black'
                  : 'bg-transparent text-white/70 hover:bg-white/10'
              }`}
            >
              UBC Only
            </button>
            <button
              onClick={() => setSourceFilter('global')}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition ${
                sourceFilter === 'global'
                  ? 'bg-white text-black'
                  : 'bg-transparent text-white/70 hover:bg-white/10'
              }`}
            >
              Global Only
            </button>
          </div>
        )}

        {!isUBC && (
          <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-6 text-amber-100">
            For You is currently UBC-only. Update your university to "UBC" in Settings to get daily picks.
            <div className="mt-3">
              <button
                onClick={() => router.push("/settings")}
                className="rounded-xl bg-white px-4 py-2 text-black text-sm font-medium hover:bg-white/90"
              >
                Go to Settings
              </button>
            </div>
          </div>
        )}

        {isUBC && (
          <>
            {loadingOpenAlex && openAlexResearchers.length === 0 && (
              <div className="rounded-2xl border border-blue-400/40 bg-blue-400/10 p-4 text-blue-100 text-sm">
                Loading global researchers from OpenAlex...
              </div>
            )}
            <section className="grid gap-4 md:grid-cols-2">
            {filteredResearchers.map((prof) => (
              <article
                key={prof.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-white/30 transition"
              >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-semibold leading-tight">{prof.name}</h2>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      prof.source === 'ubc' 
                        ? 'bg-blue-500/20 text-blue-200 border border-blue-400/30' 
                        : 'bg-purple-500/20 text-purple-200 border border-purple-400/30'
                    }`}>
                      {prof.source === 'ubc' ? 'UBC' : 'Global'}
                    </span>
                  </div>
                  <p className="text-sm text-white/60">{prof.institution || prof.faculty}</p>
                  {prof.departments?.length ? (
                    <p className="text-xs text-white/50 mt-1">{prof.departments.join(", ")}</p>
                  ) : prof.worksCount ? (
                    <p className="text-xs text-white/50 mt-1">
                      {prof.worksCount} publications · {prof.citedByCount?.toLocaleString()} citations
                    </p>
                  ) : null}
                </div>
                <a
                  href={prof.profileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-white hover:underline shrink-0"
                >
                  View profile
                </a>
              </div>

              <div className="mt-2 text-sm flex items-center gap-2">
                <span className="text-yellow-400">
                  {'★'.repeat(Math.floor(prof.stars))}
                  {prof.stars % 1 !== 0 ? '½' : ''}
                  {'☆'.repeat(5 - Math.ceil(prof.stars))}
                </span>
                <span className="text-white/70">{prof.stars.toFixed(1)}/5</span>
                {prof.starLabel && (
                  <span className="text-white/60 text-xs">({prof.starLabel})</span>
                )}
              </div>

              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap gap-2">
                  {prof.matchedInterests.length > 0 ? (
                    prof.matchedInterests.slice(0, 3).map((m) => (
                      <span
                        key={m}
                        className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-[11px] text-emerald-100"
                      >
                        Match: {m}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70">
                      Good general fit
                    </span>
                  )}
                </div>
                {prof.interests.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {prof.interests.slice(0, 6).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </article>
            ))}
          </section>          </>        )}

        {isUBC && recommendations.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/80">
            No matches yet. Try adding interests in Settings or check back tomorrow.
          </div>
        )}
      </div>
    </main>
  );
}
