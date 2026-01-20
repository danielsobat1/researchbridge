import { Professor } from "./ubcUndergradResearchers";

export type ProfessorScore = {
  overall: number; // raw score
  stars: number; // 0-5 (with 0.5 increments)
  percentile: number; // 0-1
  breakdown: {
    openness: number; // 0-1
    fit: number; // 0-1
    activity: number; // z-score
    busy: number; // z-score (penalty)
  };
  reasons: string[];
  confidence: "Low" | "Medium" | "High";
};

type ProfMetrics = {
  prof: Professor;
  opennessScore: number;
  fitScore: number;
  worksCount: number; // proxy: number of interests
  hasDirectEmail: boolean;
  noStudentInquiries: boolean;
};

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function log1p(x: number) {
  return Math.log(1 + Math.max(0, x));
}

function mean(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
}

function stdev(xs: number[]) {
  const m = mean(xs);
  const v = mean(xs.map(x => (x - m) ** 2));
  return Math.sqrt(v) || 1;
}

function zscore(x: number, m: number, s: number) {
  return (x - m) / (s || 1);
}

function percentileRank(sorted: number[], x: number) {
  let lo = 0, hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= x) lo = mid + 1;
    else hi = mid;
  }
  return sorted.length ? lo / sorted.length : 0.5;
}

function roundToHalf(x: number) {
  return Math.round(x * 2) / 2;
}

function calculateOpennessScore(prof: Professor): number {
  let score = 0.3; // baseline
  const reasons: string[] = [];

  if (prof.recruitment?.lookingToRecruit && prof.recruitment.lookingToRecruit.length > 0) {
    score += 0.4;
  }

  if (prof.researchOptions) {
    const undergradMention = prof.researchOptions.some(opt => 
      opt.toLowerCase().includes("undergrad") || 
      opt.toLowerCase().includes("honours") ||
      opt.toLowerCase().includes("work learn")
    );
    if (undergradMention) {
      score += 0.25;
    } else if (prof.researchOptions.length > 0) {
      score += 0.1;
    }
  }

  if (prof.recruitment?.potentialProjectAreas && prof.recruitment.potentialProjectAreas.length > 0) {
    score += Math.min(0.2, prof.recruitment.potentialProjectAreas.length * 0.05);
  }

  if (prof.recruitment?.desiredStartDates && prof.recruitment.desiredStartDates.length > 0) {
    score += 0.1;
  }

  return clamp01(score);
}

function calculateFitScore(prof: Professor): number {
  let score = 0.3; // baseline
  
  const numInterests = prof.interests?.length || 0;
  if (numInterests > 8) {
    score += 0.35;
  } else if (numInterests > 5) {
    score += 0.25;
  } else if (numInterests > 2) {
    score += 0.15;
  } else if (numInterests > 0) {
    score += 0.05;
  }

  if (prof.methodology && prof.methodology.length > 3) {
    score += 0.2;
  } else if (prof.methodology && prof.methodology.length > 0) {
    score += 0.1;
  }

  if (prof.researchClassification && prof.researchClassification.length > 0) {
    score += 0.1;
  }

  if (prof.departments && prof.departments.length > 1) {
    score += 0.1;
  }

  return clamp01(score);
}

/**
 * Score multiple professors using percentile ranking for proper spread
 */
export function scoreProfessors(profs: Professor[], resumeKeywords?: string[]): Map<string, ProfessorScore> {
  if (profs.length === 0) return new Map();

  // Extract metrics for each professor
  const metrics: ProfMetrics[] = profs.map(prof => ({
    prof,
    opennessScore: calculateOpennessScore(prof),
    fitScore: calculateFitScore(prof),
    worksCount: prof.interests?.length || 0,
    hasDirectEmail: !!prof.email,
    noStudentInquiries: false // could parse from profile in future
  }));

  // Normalize activity (use interest count as proxy for lab size/productivity)
  const worksLog = metrics.map(m => log1p(m.worksCount));
  const worksM = mean(worksLog);
  const worksS = stdev(worksLog);

  // For "busy penalty" we'd use citations, but we don't have that data
  // So we'll use affiliations count as a proxy for "well-known"
  const busyLog = metrics.map(m => log1p(m.prof.affiliations?.length || 0));
  const busyM = mean(busyLog);
  const busyS = stdev(busyLog);

  // Weights
  const W_OPEN = 1.4;
  const W_FIT = 1.1;
  const W_ACT = 0.8;
  const W_BUSY = 0.6; // penalty for being too busy/famous

  const scored = metrics.map(m => {
    const actZ = zscore(log1p(m.worksCount), worksM, worksS);
    const busyZ = zscore(log1p(m.prof.affiliations?.length || 0), busyM, busyS);

    let raw =
      W_OPEN * (clamp01(m.opennessScore) * 2 - 1) +
      W_FIT * (clamp01(m.fitScore) * 2 - 1) +
      W_ACT * actZ -
      W_BUSY * busyZ;

    // Boost score if resume keywords match professor interests
    if (resumeKeywords && resumeKeywords.length > 0 && m.prof.interests) {
      const interestsLower = m.prof.interests.map(i => i.toLowerCase());
      const resumeKeywordsLower = resumeKeywords.map(k => k.toLowerCase());
      
      let matchCount = 0;
      resumeKeywordsLower.forEach(keyword => {
        if (interestsLower.some(interest => interest.includes(keyword) || keyword.includes(interest))) {
          matchCount++;
        }
      });
      
      if (matchCount > 0) {
        const boostAmount = Math.min(1.5, matchCount * 0.4); // Max boost of 1.5
        raw += boostAmount;
      }
    }

    const why: string[] = [];

    if (m.noStudentInquiries) {
      raw -= 2.0;
      why.push("Lab says no student inquiries");
    }

    if (m.hasDirectEmail) {
      raw += 0.25;
      why.push("Direct email available");
    } else {
      raw -= 0.15;
    }

    if (m.opennessScore >= 0.7) why.push("Undergrad-friendly signals");
    if (m.opennessScore >= 0.5) why.push("On undergrad research list");
    if (m.fitScore >= 0.7) why.push("Strong research diversity");
    if (m.worksCount >= 8) why.push("Large research program");
    if (m.prof.recruitment?.lookingToRecruit?.length) why.push("Currently recruiting");
    if (m.prof.recruitment?.potentialProjectAreas?.length) {
      why.push(`${m.prof.recruitment.potentialProjectAreas.length} project areas`);
    }
    if ((m.prof.affiliations?.length || 0) > 3) {
      why.push("Highly visible (may be busy)");
    }

    // Calculate confidence based on data completeness
    let dataPoints = 0;
    if (m.prof.interests && m.prof.interests.length > 0) dataPoints++;
    if (m.prof.recruitment?.lookingToRecruit) dataPoints++;
    if (m.prof.recruitment?.potentialProjectAreas) dataPoints++;
    if (m.prof.methodology && m.prof.methodology.length > 0) dataPoints++;
    if (m.prof.researchOptions && m.prof.researchOptions.length > 0) dataPoints++;

    const confidence: "Low" | "Medium" | "High" = 
      dataPoints >= 4 ? "High" : 
      dataPoints >= 2 ? "Medium" : "Low";

    return {
      id: m.prof.id,
      rawScore: raw,
      opennessScore: m.opennessScore,
      fitScore: m.fitScore,
      actZ,
      busyZ,
      why,
      confidence
    };
  });

  // Percentile-based star mapping
  const rawSorted = [...scored.map(s => s.rawScore)].sort((a, b) => a - b);

  const result = new Map<string, ProfessorScore>();

  for (const s of scored) {
    const pct = percentileRank(rawSorted, s.rawScore);
    const stars = roundToHalf(1 + 4 * pct); // 1.0 to 5.0

    result.set(s.id, {
      overall: s.rawScore,
      stars,
      percentile: pct,
      breakdown: {
        openness: s.opennessScore,
        fit: s.fitScore,
        activity: s.actZ,
        busy: s.busyZ
      },
      reasons: s.why.length > 0 ? s.why : ["Profile available"],
      confidence: s.confidence
    });
  }

  return result;
}

/**
 * Get a single professor's score (less accurate without population context)
 */
export function calculateProfessorScore(prof: Professor): ProfessorScore {
  const opennessScore = calculateOpennessScore(prof);
  const fitScore = calculateFitScore(prof);
  
  // Simplified scoring for single prof (no percentile context)
  const raw = opennessScore * 40 + fitScore * 35 + 25;
  const stars = roundToHalf(Math.max(1, Math.min(5, raw / 20)));

  const why: string[] = [];
  if (opennessScore >= 0.7) why.push("Undergrad-friendly signals");
  if (fitScore >= 0.7) why.push("Strong research diversity");
  if (prof.recruitment?.lookingToRecruit?.length) why.push("Currently recruiting");
  if (prof.email) why.push("Direct email available");

  let dataPoints = 0;
  if (prof.interests?.length) dataPoints++;
  if (prof.recruitment?.lookingToRecruit) dataPoints++;
  if (prof.methodology?.length) dataPoints++;

  return {
    overall: raw,
    stars,
    percentile: 0.5,
    breakdown: {
      openness: opennessScore,
      fit: fitScore,
      activity: 0,
      busy: 0
    },
    reasons: why.length > 0 ? why : ["Profile available"],
    confidence: dataPoints >= 3 ? "High" : dataPoints >= 2 ? "Medium" : "Low"
  };
}

/**
 * Get a text label for star rating
 */
export function getStarLabel(stars: number): string {
  if (stars >= 4.5) return "Excellent fit";
  if (stars >= 4.0) return "Very good fit";
  if (stars >= 3.5) return "Good fit";
  if (stars >= 3.0) return "Decent fit";
  if (stars >= 2.5) return "Moderate fit";
  if (stars >= 2.0) return "Lower likelihood";
  return "Limited info";
}

