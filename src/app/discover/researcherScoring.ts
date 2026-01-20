// researcherScoring.ts - Score researchers based on OpenAlex metrics

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

export type ResearcherScore = {
  overall: number;
  stars: number;
  percentile: number;
  breakdown: {
    relevance: number;
    productivity: number;
    impact: number;
    accessibility: number;
  };
  reasons: string[];
  confidence: "Low" | "Medium" | "High";
};

// Helper functions
function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function log1p(x: number): number {
  return Math.log(1 + x);
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdev(arr: number[], avg: number): number {
  if (arr.length === 0) return 1;
  const variance = arr.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / arr.length;
  return Math.sqrt(variance) || 1;
}

function zscore(value: number, avg: number, sd: number): number {
  return (value - avg) / sd;
}

function percentileRank(value: number, sortedValues: number[]): number {
  const n = sortedValues.length;
  if (n === 0) return 0;
  if (n === 1) return 50;

  let count = 0;
  for (const v of sortedValues) {
    if (v < value) count++;
  }
  return (count / n) * 100;
}

// Blocklist of famous non-researchers who appear in academic databases
const FAMOUS_FIGURES_BLOCKLIST = new Set([
  "hitler",
  "benjamin netanyahu",
  "napoleon",
  "alexander the great",
  "julius caesar",
  "socrates",
  "plato",
  "aristotle",
  "jesus",
  "muhammad",
  "gandhi",
  "churchill",
  "stalin",
  "lenin",
  "mao",
  "confucius",
  "buddha",
  "newton", // Too famous as historical figure
  "einstein", // Too famous as public figure
  "darwin", // Too famous as historical figure
  "freud", // Discussed extensively but not primary researcher
]);

function roundToHalf(num: number): number {
  return Math.round(num * 2) / 2;
}

type ResearcherMetrics = {
  relevanceScore: number; // 0-1: matched works / total works
  productivityScore: number; // log-scaled works count
  impactScore: number; // log-scaled citation count
  hasInstitution: boolean;
  hasOrcid: boolean;
};

function calculateRelevanceScore(researcher: Researcher): number {
  // Relevance = matched works / total works (normalized)
  const totalWorks = researcher.worksCount ?? researcher.matchedWorksCount;
  if (totalWorks === 0) return 0.5;
  
  const ratio = researcher.matchedWorksCount / totalWorks;
  // Give bonus for high match ratio
  return clamp01(ratio);
}

function calculateAccessibilityScore(researcher: Researcher): number {
  let score = 0.5;
  
  // Having ORCID indicates researcher maintains professional profile
  if (researcher.orcid) score += 0.3;
  
  // Having institution info indicates active researcher
  if (researcher.lastKnownInstitution?.name) score += 0.2;
  
  return clamp01(score);
}

export function scoreResearchers(researchers: Researcher[], resumeKeywords?: string[]): Map<string, ResearcherScore> {
  if (researchers.length === 0) return new Map();

  const metrics = researchers.map((r): ResearcherMetrics => ({
    relevanceScore: calculateRelevanceScore(r),
    productivityScore: log1p(r.worksCount ?? r.matchedWorksCount),
    impactScore: log1p(r.citedByCount ?? 0),
    hasInstitution: !!r.lastKnownInstitution?.name,
    hasOrcid: !!r.orcid,
  }));

  // Calculate means and standard deviations for z-score normalization
  const prodScores = metrics.map((m) => m.productivityScore);
  const impactScores = metrics.map((m) => m.impactScore);

  const prodMean = mean(prodScores);
  const prodStdev = stdev(prodScores, prodMean);
  const impactMean = mean(impactScores);
  const impactStdev = stdev(impactScores, impactMean);

  // Check for famous figures in blocklist
  const isFamousFigure = (name: string): boolean => {
    const nameLower = name.toLowerCase().trim();
    for (const famous of FAMOUS_FIGURES_BLOCKLIST) {
      if (nameLower.includes(famous) || famous.includes(nameLower.split(" ")[0])) {
        return true;
      }
    }
    return false;
  };

  // Scoring weights
  const W_RELEVANCE = 1.5;  // Most important: how well they match the search
  const W_PROD = 0.7;        // Productivity (total output)
  const W_IMPACT = 0.9;      // Impact (citations)
  const W_ACCESS = 0.4;      // Accessibility (ORCID, institution)

  const rawScores: number[] = [];
  const scoreData: Array<{
    researcher: Researcher;
    rawScore: number;
    metrics: ResearcherMetrics;
    prodZ: number;
    impactZ: number;
    accessScore: number;
  }> = [];

  researchers.forEach((researcher, idx) => {
    const m = metrics[idx];

    const prodZ = zscore(m.productivityScore, prodMean, prodStdev);
    const impactZ = zscore(m.impactScore, impactMean, impactStdev);
    const accessScore = calculateAccessibilityScore(researcher);

    // Calculate weighted raw score
    // Relevance is 0-1, convert to -1 to +1 range for weighting
    const relevanceWeighted = (m.relevanceScore * 2 - 1) * W_RELEVANCE;
    const prodWeighted = prodZ * W_PROD;
    const impactWeighted = impactZ * W_IMPACT;
    const accessWeighted = (accessScore * 2 - 1) * W_ACCESS;

    let rawScore = relevanceWeighted + prodWeighted + impactWeighted + accessWeighted;

    // Boost score based on resume keywords
    // Note: OpenAlex researchers don't have interests field, so this boost applies to matched works
    // (researchers already matched to search query)
    if (resumeKeywords && resumeKeywords.length > 0) {
      const boostAmount = Math.min(1.5, resumeKeywords.length * 0.3);
      rawScore += boostAmount;
    }

    // BLOCKLIST CHECK: Known famous historical/political figures
    if (isFamousFigure(researcher.name)) {
      rawScore = -100; // Guaranteed bottom rank
    }
    // CRITICAL FILTER: Researchers without an institution are likely not active researchers
    // (historical figures, non-academics, etc.). Apply a hard multiplier to rank them near bottom.
    else if (!m.hasInstitution) {
      rawScore *= 0.05; // 95% penalty - they'll always be at the very bottom
    }

    // STRONG PENALTY: High citations with very few works = written about, not researcher
    // (e.g., historical/political figures, public figures)
    const totalWorks = researcher.worksCount ?? researcher.matchedWorksCount;
    const citationCount = researcher.citedByCount ?? 0;
    if (totalWorks > 0 && citationCount > totalWorks * 20) {
      // More than 20 citations per work suggests "written about" not research output
      rawScore *= 0.2; // 80% penalty
    }

    rawScores.push(rawScore);
    scoreData.push({
      researcher,
      rawScore,
      metrics: m,
      prodZ,
      impactZ,
      accessScore,
    });
  });

  // Sort raw scores for percentile ranking
  const sortedRaw = [...rawScores].sort((a, b) => a - b);

  // Convert raw scores to star ratings using percentile ranks
  const result = new Map<string, ResearcherScore>();

  scoreData.forEach((data) => {
    const percentile = percentileRank(data.rawScore, sortedRaw);

    // Map percentile to 1-5 stars
    let stars: number;
    if (percentile >= 90) stars = 5.0;
    else if (percentile >= 80) stars = 4.5;
    else if (percentile >= 70) stars = 4.0;
    else if (percentile >= 60) stars = 3.5;
    else if (percentile >= 50) stars = 3.0;
    else if (percentile >= 40) stars = 2.5;
    else if (percentile >= 30) stars = 2.0;
    else if (percentile >= 20) stars = 1.5;
    else stars = 1.0;

    // Generate reasons
    const reasons: string[] = [];
    
    // Check blocklist first
    if (isFamousFigure(data.researcher.name)) {
      reasons.push("⛔ Known historical/political figure (not an active researcher)");
    } else {
      if (data.metrics.relevanceScore > 0.8) {
        reasons.push("Very high match ratio for your search");
      } else if (data.metrics.relevanceScore > 0.6) {
        reasons.push("Good match ratio for your search");
      } else if (data.metrics.relevanceScore < 0.3) {
        reasons.push("Lower match ratio (fewer relevant works)");
      }

      if (data.prodZ > 1.0) {
        reasons.push("High research productivity");
      } else if (data.prodZ < -1.0) {
        reasons.push("Limited publication history");
      }

      if (data.impactZ > 1.5) {
        reasons.push("Very high citation impact");
      } else if (data.impactZ > 0.5) {
        reasons.push("Good citation impact");
      } else if (data.impactZ < -0.5) {
        reasons.push("Lower citation count (may be early career)");
      }

      if (data.metrics.hasOrcid) {
        reasons.push("Has ORCID (professional profile maintained)");
      }

      if (!data.metrics.hasInstitution) {
        reasons.push("⚠️ No current institution listed (may not be active researcher)");
      }

      // Check for "written about" pattern
      const totalWorks = data.researcher.worksCount ?? data.researcher.matchedWorksCount;
      const citationCount = data.researcher.citedByCount ?? 0;
      if (totalWorks > 0 && citationCount > totalWorks * 20) {
        reasons.push("⚠️ Very high citations-to-works ratio (may be historical/public figure)");
      }
    }

    // Determine confidence
    let confidence: "Low" | "Medium" | "High" = "Medium";
    const hasBasicInfo = data.metrics.hasInstitution && data.metrics.hasOrcid;
    const hasCitations = (data.researcher.citedByCount ?? 0) > 0;
    const hasWorks = (data.researcher.worksCount ?? 0) > 5;

    if (hasBasicInfo && hasCitations && hasWorks) {
      confidence = "High";
    } else if (!hasBasicInfo || !hasWorks) {
      confidence = "Low";
    }

    result.set(data.researcher.id, {
      overall: data.rawScore,
      stars,
      percentile,
      breakdown: {
        relevance: data.metrics.relevanceScore,
        productivity: data.prodZ,
        impact: data.impactZ,
        accessibility: data.accessScore,
      },
      reasons,
      confidence,
    });
  });

  return result;
}

export function getStarLabel(stars: number): string {
  if (stars >= 4.5) return "Excellent match";
  if (stars >= 3.5) return "Very good match";
  if (stars >= 2.5) return "Good match";
  if (stars >= 1.5) return "Fair match";
  return "Poor match";
}
