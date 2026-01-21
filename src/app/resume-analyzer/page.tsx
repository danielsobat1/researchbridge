"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getUser, updateUser } from "@/app/lib/auth";
import { ubcUndergradResearchers } from "@/app/professors/ubcUndergradResearchers";
import { scoreProfessors, getStarLabel as getProfStarLabel } from "@/app/professors/professorScoring";
import { scoreResearchers, getStarLabel as getResearcherStarLabel } from "@/app/discover/researcherScoring";
import * as pdfjsLib from "pdfjs-dist";

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

type KeywordMatch = {
  keyword: string;
  frequency: number;
};

type RankedResearcher = {
  id: string;
  name: string;
  faculty: string;
  interests: string[];
  matchScore: number;
  matchedTopics: string[];
  stars: number;
  starLabel?: string;
  source: 'ubc' | 'openalex';
  institution?: string;
  worksCount?: number;
  citedByCount?: number;
  departments?: string[];
  profileUrl?: string;
  percentile?: number;
};

function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
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

function extractKeywords(text: string): KeywordMatch[] {
  const normalized = normalize(text);
  const words = normalized.split(/\s+/).filter(w => w.length > 2);
  
  // Whitelist of actual research topics, technologies, methods, and fields
  // Only keywords matching these are extracted
  const researchKeywords = new Set([
    // Programming languages & tech
    "python", "javascript", "java", "cpp", "rust", "golang", "swift", "kotlin",
    "typescript", "scala", "haskell", "lisp", "matlab", "r", "sql", "html", "css",
    
    // Machine learning & AI
    "machine", "learning", "deep", "neural", "networks", "nlp", "computer", "vision",
    "ai", "artificial", "intelligence", "algorithm", "algorithms", "classifier",
    "regression", "clustering", "supervised", "unsupervised", "reinforcement",
    "tensorflow", "pytorch", "keras", "scikit",
    
    // Data science & analytics
    "analytics", "big", "hadoop", "spark", "database", "databases",
    "nosql", "mongodb", "postgresql", "statistics", "statistical",
    "visualization", "tableau", "power", "excel", "pandas", "numpy",
    
    // Biology & life sciences
    "biology", "biological", "genetics", "genetic", "genomics", "genomic",
    "protein", "proteins", "dna", "rna", "molecular", "cell", "cellular",
    "immunology", "immune", "microbiology", "microbial", "neuroscience",
    "neuroscientific", "pharmacology", "drug", "diseases", "disease",
    "vaccine", "vaccines", "cancer", "oncology", "evolution", "evolutionary",
    
    // Tissue engineering & regenerative medicine
    "tissue", "engineering", "regeneration", "regenerative", "regenerate",
    "biomaterial", "biomaterials", "cartilage", "chondrocytes", "bone", "osteo",
    "scaffold", "scaffolds", "hydrogel", "hydrogels", "chitosan", "decellularized",
    "biocompatibility", "biocompatible", "bioengineering", "biofabrication",
    "mscs", "stem", "progenitor", "fibroblasts", "neurons", "neural",
    "growth", "factor", "egf", "tgf", "vegf", "fgf",
    
    // Chemistry & materials
    "chemistry", "chemical", "organic", "inorganic", "synthesis", "analytical",
    "biochemistry", "polymer", "pharmaceutical", "catalyst", "catalysis",
    
    // Physics & materials
    "physics", "quantum", "particle", "materials", "nanotechnology", "nano",
    "optics", "photonics", "thermodynamics", "energy", "nuclear",
    
    // Environmental & climate
    "climate", "environmental", "sustainability", "renewable", "carbon",
    "emissions", "weather", "ocean", "atmosphere", "geology", "ecological",
    
    // Engineering
    "engineering", "civil", "mechanical", "electrical", "chemical", "software",
    "robotics", "automation", "controls", "systems", "circuit", "circuits",
    "biomechanics", "biomechanical", "orthopedic", "orthopedics",
    
    // Medicine & health
    "medicine", "clinical", "surgery", "diagnosis", "diagnostic",
    "treatment", "therapy", "patient", "hospital", "epidemiology", "epidemiological",
    "psychiatry", "psychiatric", "psychology", "behavioral", "mental",
    "parkinson", "alzheimer", "autism", "schizophrenia", "depression",
    "anxiety", "adhd", "addiction", "addictions", "fentanyl", "opioid",
    "fracture", "fractures", "injury", "injuries", "cardiac", "cardiovascular",
    "responder", "cpr", "aed", "emergency",
    
    // Lab techniques & equipment
    "assay", "assays", "cell", "culture", "pcr", "chromatography", "extraction",
    "spectrophotometry", "gel", "electrophoresis", "microscopy", "microscope",
    "imaging", "microscopic", "rheology", "rheological", "sem", "mri", "ct",
    "immunoassay", "blot", "western", "elisa", "flow", "cytometry", "mtt",
    "titration", "chromatography", "dilution", "staining", "histology",
    
    // Research methods & concepts
    "qualitative", "quantitative", "experiment", "experimental", "hypothesis",
    "theory", "theoretical", "simulation", "model", "modeling", "prediction",
    "optimization", "analytical", "framework", "benchmark", "performance",
    "testing", "validation", "verification", "randomized", "trial", "cohort",
    "crossover", "longitudinal", "observational",
    
    // Economics & social sciences
    "economics", "economic", "finance", "financial", "business", "marketing",
    "sociology", "anthropology", "political", "policy", "governance", "social",
    
    // Other fields
    "mathematics", "mathematical", "geometry", "topology", "logic",
    "philosophy", "ethics", "history", "literature", "linguistics",
    "education", "pedagogy", "architecture", "design",
    
    // Specific conditions & health
    "fracture", "arthritis", "osteoarthritis", "rheumatoid", "degenerative",
    "neurodegeneration", "cognitive", "dementia", "stroke", "heart", "hypertension",
  ]);
  
  // Count how many research keywords appear in the text
  const frequencyMap = new Map<string, number>();
  words.forEach(word => {
    if (researchKeywords.has(word)) {
      frequencyMap.set(word, (frequencyMap.get(word) || 0) + 1);
    }
  });
  
  // Return keywords sorted by frequency
  return Array.from(frequencyMap.entries())
    .map(([keyword, frequency]) => ({ keyword, frequency }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 30); // Top 30 keywords
}

function matchKeywordsWithProfessors(
  keywords: KeywordMatch[],
  professors: typeof ubcUndergradResearchers
): RankedResearcher[] {
  const keywordSet = new Set(keywords.map(k => k.keyword));
  
  const matches = professors.map(prof => {
    const profInterests = (prof.interests || []).map(normalize);
    const profName = normalize(`${prof.firstName} ${prof.lastName}`);
    const profFaculty = normalize(prof.faculty);
    
    let matchScore = 0;
    const matchedTopics: string[] = [];
    
    // Check for exact interest matches
    profInterests.forEach(interest => {
      const interestWords = interest.split(/\s+/);
      interestWords.forEach(word => {
        if (keywordSet.has(word)) {
          matchScore += 3; // Higher weight for interest matches
          if (!matchedTopics.includes(interest)) {
            matchedTopics.push(interest);
          }
        }
      });
    });
    
    // Check for partial keyword matches in interests
    keywords.forEach(kw => {
      profInterests.forEach(interest => {
        if (interest.includes(kw.keyword)) {
          matchScore += kw.frequency;
          if (!matchedTopics.includes(interest)) {
            matchedTopics.push(interest);
          }
        }
      });
    });
    
    return {
      id: prof.id,
      name: `${prof.firstName} ${prof.lastName}`,
      faculty: prof.faculty,
      interests: prof.interests || [],
      matchScore,
      matchedTopics,
      stars: 4.0, // Use placeholder score for UBC researchers
      source: 'ubc' as const,
      profileUrl: prof.profileUrl,
    };
  })
    .filter(m => m.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 10); // Top 10 matches
  
  return matches;
}

export default function ResumeAnalyzerPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [resumeText, setResumeText] = useState("");
  const [keywords, setKeywords] = useState<KeywordMatch[]>([]);
  const [matches, setMatches] = useState<RankedResearcher[]>([]);
  const [openAlexResearchers, setOpenAlexResearchers] = useState<RankedResearcher[]>([]);
  const [analyzed, setAnalyzed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingOpenAlex, setLoadingOpenAlex] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sourceFilter, setSourceFilter] = useState<'all' | 'ubc' | 'global'>('all');

  useEffect(() => {
    const currentUser = getUser();
    setUser(currentUser);
  }, []);

  useEffect(() => {
    // Set PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  }, []);

  const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      if (arrayBuffer.byteLength === 0) {
        throw new Error("PDF file is empty");
      }
      
      // Check if it's a valid PDF (starts with %PDF)
      const view = new Uint8Array(arrayBuffer);
      const isValidPDF = view[0] === 37 && view[1] === 80 && view[2] === 68 && view[3] === 70; // %PDF
      
      if (!isValidPDF) {
        throw new Error("File is not a valid PDF. Please ensure you're uploading a proper PDF file.");
      }
      
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      if (pdf.numPages === 0) {
        throw new Error("PDF has no pages");
      }
      
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str || "")
            .join(" ");
          fullText += pageText + " ";
        } catch (pageError) {
          console.warn(`Error extracting text from page ${i}:`, pageError);
          // Continue with other pages even if one fails
        }
      }
      
      if (!fullText.trim()) {
        throw new Error("Could not extract text from PDF. The PDF may be image-based or corrupted.");
      }
      
      return fullText;
    } catch (error: any) {
      throw new Error(
        error.message || 
        "Failed to parse PDF. Please ensure it's a valid PDF file and try again."
      );
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setLoading(true);
    try {
      let text = "";
      
      if (file.type === "application/pdf") {
        if (!file.name.toLowerCase().endsWith(".pdf")) {
          throw new Error("File appears to be PDF but has wrong extension. Please ensure you're uploading a proper PDF file.");
        }
        text = await extractTextFromPDF(file);
      } else if (file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt")) {
        text = await file.text();
      } else {
        throw new Error("Unsupported file type. Please upload a PDF or text file.");
      }

      if (!text.trim()) {
        throw new Error("File is empty. Please upload a file with content.");
      }

      setResumeText(text);
    } catch (error: any) {
      setError(error.message || "Failed to read file. Please ensure you're uploading a proper PDF or text file.");
      console.error("Error reading file:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!resumeText.trim()) {
      setError("Please paste or upload your resume text");
      return;
    }

    setLoading(true);
    setError("");
    try {
      // Extract keywords
      const extractedKeywords = extractKeywords(resumeText);
      setKeywords(extractedKeywords);

      // Match with UBC professors
      const matchedProfessors = matchKeywordsWithProfessors(
        extractedKeywords,
        ubcUndergradResearchers
      );
      setMatches(matchedProfessors);
      
      // Fetch OpenAlex researchers based on keywords
      if (extractedKeywords.length > 0) {
        await fetchOpenAlexResearchers(extractedKeywords);
      }
      
      setAnalyzed(true);
    } catch (error) {
      console.error("Error analyzing resume:", error);
      setError("Error analyzing resume. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchOpenAlexResearchers = async (keywords: KeywordMatch[]) => {
    setLoadingOpenAlex(true);
    try {
      // Use all keywords for search (not just top 3)
      const allKeywordsToSearch = keywords.map(k => k.keyword);
      if (allKeywordsToSearch.length === 0) {
        setOpenAlexResearchers([]);
        return;
      }

      // Make all API calls in parallel instead of sequentially
      const promises = allKeywordsToSearch.map(async (keyword) => {
        const params = new URLSearchParams();
        params.append('area', keyword);
        params.append('active', 'true');
        
        try {
          const response = await fetch(`/api/discover?${params.toString()}`);
          if (response.ok) {
            const data = await response.json();
            return data.researchers?.slice(0, 15) || [];
          }
        } catch (error) {
          console.error(`Error fetching for keyword "${keyword}":`, error);
        }
        return [];
      });

      // Wait for all requests to complete
      const allResults = await Promise.all(promises);
      
      const allResearchers: OpenAlexResearcher[] = [];
      const seenIds = new Set<string>(); // Track seen researchers to avoid duplicates across searches
      
      // Flatten results and deduplicate
      allResults.forEach(researchers => {
        researchers.forEach((r: OpenAlexResearcher) => {
          if (!seenIds.has(r.id)) {
            allResearchers.push(r);
            seenIds.add(r.id);
          }
        });
      });

      // Use proper scoring system
      const scoreMap = scoreResearchers(allResearchers);
      
      const ranked: RankedResearcher[] = allResearchers.map((r) => {
        const score = scoreMap.get(r.id);
        
        return {
          id: r.id,
          name: r.name,
          faculty: r.lastKnownInstitution?.name || 'Unknown',
          interests: [],
          matchScore: score?.overall || 0,
          matchedTopics: allKeywordsToSearch.slice(0, 3), // Show top 3 keywords as matched topics
          stars: score?.stars || 1.0,
          starLabel: score ? getResearcherStarLabel(score.stars) : undefined,
          percentile: score?.percentile,
          source: 'openalex' as const,
          institution: r.lastKnownInstitution?.name,
          worksCount: r.worksCount || undefined,
          citedByCount: r.citedByCount || undefined,
        };
      });

      // Sort by score, filter to 4+ stars, then take top 20
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

  const combinedResearchers = useMemo(() => {
    // Interleave UBC and OpenAlex researchers
    const combined: RankedResearcher[] = [];
    const maxLen = Math.max(matches.length, openAlexResearchers.length);
    
    for (let i = 0; i < maxLen; i++) {
      if (i < matches.length) {
        combined.push(matches[i]);
      }
      if (i < openAlexResearchers.length) {
        combined.push(openAlexResearchers[i]);
      }
    }
    
    return combined;
  }, [matches, openAlexResearchers]);

  const filteredResearchers = useMemo(() => {
    let filtered = combinedResearchers;
    
    if (sourceFilter === 'ubc') {
      filtered = filtered.filter(r => r.source === 'ubc');
    } else if (sourceFilter === 'global') {
      filtered = filtered.filter(r => r.source === 'openalex');
    }
    
    return filtered;
  }, [combinedResearchers, sourceFilter]);

  const addInterest = (interest: string) => {
    const currentUser = getUser();
    if (!currentUser) return;
    
    const currentInterests = currentUser.interests || [];
    if (!currentInterests.includes(interest)) {
      const updatedInterests = [...currentInterests, interest];
      updateUser({ interests: updatedInterests });
      setUser({ ...currentUser, interests: updatedInterests });
      setSuccess(`Added "${interest}" to your interests!`);
      // Clear the success message after 3 seconds
      setTimeout(() => setSuccess(""), 3000);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-600/20 via-transparent to-orange-500/20 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-900/30 via-transparent to-transparent pointer-events-none" />
      
      <div className="relative mx-auto max-w-5xl px-6 py-16 space-y-8">
        <header className="space-y-3">

          <h1 className="text-5xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
              Resume Analyzer
            </span>
          </h1>
          <p className="text-white/70">
            Paste your resume to discover relevant research labs and topics that match your background.
          </p>
        </header>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200 text-sm">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Upload or Paste Your Resume
            </label>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-white/60 mb-2">
                  Upload PDF or text file:
                </label>
                <input
                  type="file"
                  accept=".pdf,.txt"
                  onChange={handleFileUpload}
                  disabled={loading}
                  className="block w-full text-sm text-white/70 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-white/10 file:text-white hover:file:bg-white/20 disabled:opacity-50"
                />
                <p className="text-[11px] text-white/50 mt-1">
                  Supports PDF and text files
                </p>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-black text-white/50">or</span>
                </div>
              </div>

              <div>
                <label className="block text-xs text-white/60 mb-2">
                  Paste your resume text:
                </label>
                <textarea
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  placeholder="Paste your resume content here. Include skills, experience, projects, and research interests..."
                  rows={10}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/30 resize-none"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={loading || !resumeText.trim()}
            className="w-full rounded-xl bg-white px-4 py-3 text-black font-medium hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? "Analyzing..." : "Analyze Resume"}
          </button>
        </div>

        {analyzed && (
          <>
            {/* Keywords Section */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Detected Topics & Skills</h2>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="flex flex-wrap gap-2">
                  {keywords.length > 0 ? (
                    keywords.map((kw) => (
                      <span
                        key={kw.keyword}
                        className="rounded-full border border-blue-400/40 bg-blue-400/10 px-3 py-1 text-sm text-blue-100"
                      >
                        {kw.keyword}
                        <span className="ml-1 text-[11px] text-blue-200/70">×{kw.frequency}</span>
                      </span>
                    ))
                  ) : (
                    <p className="text-white/60">No significant keywords found</p>
                  )}
                </div>
              </div>
            </div>

            {/* Matching Researchers Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">
                  {filteredResearchers.length > 0
                    ? `${filteredResearchers.length} Matching Lab${filteredResearchers.length !== 1 ? "s" : ""}`
                    : "No Matching Labs Found"}
                </h2>
              </div>

              {(matches.length > 0 || openAlexResearchers.length > 0) && (
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

              {loadingOpenAlex && openAlexResearchers.length === 0 && (
                <div className="rounded-2xl border border-blue-400/40 bg-blue-400/10 p-4 text-blue-100 text-sm">
                  Loading global researchers from OpenAlex...
                </div>
              )}

              {filteredResearchers.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredResearchers.map((prof) => (
                    <article
                      key={prof.id}
                      className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-white/30 transition"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold leading-tight">{prof.name}</h3>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                              prof.source === 'ubc' 
                                ? 'bg-blue-500/20 text-blue-200 border border-blue-400/30' 
                                : 'bg-purple-500/20 text-purple-200 border border-purple-400/30'
                            }`}>
                              {prof.source === 'ubc' ? 'UBC' : 'Global'}
                            </span>
                          </div>
                          <p className="text-sm text-white/60">{prof.institution || prof.faculty}</p>
                          {prof.worksCount && (
                            <p className="text-xs text-white/50 mt-1">
                              {prof.worksCount} publications · {prof.citedByCount?.toLocaleString()} citations
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold">
                            {'\u2605'.repeat(Math.floor(prof.stars))}{prof.stars % 1 !== 0 ? '\u00bd' : ''}
                          </div>
                          <p className="text-[10px] text-white/50 mt-1">{prof.starLabel}</p>
                        </div>
                      </div>

                      {prof.matchedTopics.length > 0 && (
                        <div className="mt-4">
                          <p className="text-xs text-white/70 mb-2">Matching topics:</p>
                          <div className="flex flex-wrap gap-2">
                            {prof.matchedTopics.slice(0, 3).map((topic) => (
                              <span
                                key={topic}
                                className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-[11px] text-emerald-100"
                              >
                                {topic}
                              </span>
                            ))}
                            {prof.matchedTopics.length > 3 && (
                              <span className="text-[11px] text-white/60">
                                +{prof.matchedTopics.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {prof.source === 'ubc' && prof.profileUrl && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                          <a
                            href={`/professors/${prof.id}`}
                            className="w-full inline-block rounded-lg bg-white/10 px-3 py-2 text-center text-xs font-medium hover:bg-white/20 transition"
                          >
                            View Profile
                          </a>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              ) : matches.length === 0 && openAlexResearchers.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
                  <p>No matching researchers found. Try adding more details to your resume.</p>
                </div>
              ) : null}
            </div>

            {/* Suggested Interests Section */}
            {keywords.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold">Suggested Interests</h2>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
                  <div>
                    <p className="text-white/70 mb-3 text-sm">
                      Based on your resume, consider adding these topics to your interests:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {keywords.slice(0, 10)
                        .filter(kw => !user?.interests?.includes(kw.keyword))
                        .map((kw) => (
                        <button
                          key={kw.keyword}
                          onClick={() => addInterest(kw.keyword)}
                          className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/30 hover:border-white/40 transition cursor-pointer"
                        >
                          + {kw.keyword}
                        </button>
                      ))}
                    </div>
                    {keywords.slice(0, 10).filter(kw => !user?.interests?.includes(kw.keyword)).length === 0 && (
                      <p className="text-white/60 text-sm">All suggested topics have been added to your interests!</p>
                    )}
                  </div>
                  
                  {success && (
                    <div className="rounded-xl border border-green-500/40 bg-green-500/5 p-4 text-green-200 text-sm">
                      {success}
                    </div>
                  )}
                  
                  <p className="text-xs text-white/50">
                    Click any topic to add it to your interests. Your recommendations will update accordingly!
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
