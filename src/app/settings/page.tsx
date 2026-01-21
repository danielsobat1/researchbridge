"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUser, updateUser, UserProfile, updateUserInDatabase } from "@/app/lib/auth";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const [firstName, setFirstName] = useState("");
  const [age, setAge] = useState("");
  const [university, setUniversity] = useState("");
  const [interests, setInterests] = useState("");
  const [resumeLoading, setResumeLoading] = useState(false);

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser) {
      router.push("/auth");
      return;
    }
    
    setUser(currentUser);
    setFirstName(currentUser.firstName);
    setAge(currentUser.age?.toString() || "");
    setUniversity(currentUser.university || "");
    setInterests(currentUser.interests.join(", "));
  }, [router]);

  const extractResumeKeywords = (text: string): string[] => {
    // Same whitelist as resume analyzer
    const researchKeywords = new Set([
      "python", "javascript", "java", "cpp", "rust", "golang", "swift", "kotlin",
      "typescript", "scala", "haskell", "lisp", "matlab", "r", "sql", "html", "css",
      "machine", "learning", "deep", "neural", "networks", "nlp", "computer", "vision",
      "ai", "artificial", "intelligence", "algorithm", "algorithms", "classifier",
      "regression", "clustering", "supervised", "unsupervised", "reinforcement",
      "tensorflow", "pytorch", "keras", "scikit", "analytics", "big", "hadoop", "spark",
      "database", "databases", "nosql", "mongodb", "postgresql", "statistics", "statistical",
      "visualization", "tableau", "power", "excel", "pandas", "numpy",
      "biology", "biological", "genetics", "genetic", "genomics", "genomic",
      "protein", "proteins", "dna", "rna", "molecular", "cell", "cellular",
      "immunology", "immune", "microbiology", "microbial", "neuroscience",
      "neuroscientific", "pharmacology", "drug", "diseases", "disease",
      "vaccine", "vaccines", "cancer", "oncology", "evolution", "evolutionary",
      "tissue", "engineering", "regeneration", "regenerative", "regenerate",
      "biomaterial", "biomaterials", "cartilage", "chondrocytes", "bone", "osteo",
      "scaffold", "scaffolds", "hydrogel", "hydrogels", "chitosan", "decellularized",
      "biocompatibility", "biocompatible", "bioengineering", "biofabrication",
      "mscs", "stem", "progenitor", "fibroblasts", "neurons", "neural",
      "growth", "factor", "egf", "tgf", "vegf", "fgf",
      "chemistry", "chemical", "organic", "inorganic", "synthesis", "analytical",
      "biochemistry", "polymer", "pharmaceutical", "catalyst", "catalysis",
      "physics", "quantum", "particle", "materials", "nanotechnology", "nano",
      "optics", "photonics", "thermodynamics", "energy", "nuclear",
      "climate", "environmental", "sustainability", "renewable", "carbon",
      "emissions", "weather", "ocean", "atmosphere", "geology", "ecological",
      "engineering", "civil", "mechanical", "electrical", "chemical", "software",
      "robotics", "automation", "controls", "systems", "circuit", "circuits",
      "biomechanics", "biomechanical", "orthopedic", "orthopedics",
      "medicine", "clinical", "surgery", "diagnosis", "diagnostic",
      "treatment", "therapy", "patient", "hospital", "epidemiology", "epidemiological",
      "psychiatry", "psychiatric", "psychology", "behavioral", "mental",
      "parkinson", "alzheimer", "autism", "schizophrenia", "depression",
      "anxiety", "adhd", "addiction", "addictions", "fentanyl", "opioid",
      "fracture", "fractures", "injury", "injuries", "cardiac", "cardiovascular",
      "responder", "cpr", "aed", "emergency",
      "assay", "assays", "cell", "culture", "pcr", "chromatography", "extraction",
      "spectrophotometry", "gel", "electrophoresis", "microscopy", "microscope",
      "imaging", "microscopic", "rheology", "rheological", "sem", "mri", "ct",
      "immunoassay", "blot", "western", "elisa", "flow", "cytometry", "mtt",
      "titration", "dilution", "staining", "histology",
      "qualitative", "quantitative", "experiment", "experimental", "hypothesis",
      "theory", "theoretical", "simulation", "model", "modeling", "prediction",
      "optimization", "analytical", "framework", "benchmark", "performance",
      "testing", "validation", "verification", "randomized", "trial", "cohort",
      "crossover", "longitudinal", "observational",
      "economics", "economic", "finance", "financial", "business", "marketing",
      "sociology", "anthropology", "political", "policy", "governance", "social",
      "mathematics", "mathematical", "geometry", "topology", "logic",
      "philosophy", "ethics", "history", "literature", "linguistics",
      "education", "pedagogy", "architecture", "design",
      "degenerative", "neurodegeneration", "cognitive", "dementia", "stroke", "heart", "hypertension"
    ]);

    const normalized = text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
    const words = normalized.split(/\s+/).filter(w => w.length > 2);
    
    const found = new Set<string>();
    words.forEach(word => {
      if (researchKeywords.has(word) && !found.has(word)) {
        found.add(word);
      }
    });
    
    return Array.from(found);
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResumeLoading(true);
    setError("");
    setSuccess("");
    
    try {
      let text = "";
      
      if (file.type === "application/pdf") {
        // For now, show a message that PDF support requires the library
        setError("PDF support coming soon. Please paste your resume as text instead.");
        setResumeLoading(false);
        return;
      } else if (file.type === "text/plain") {
        text = await file.text();
      } else {
        throw new Error("Please upload a text file (.txt)");
      }

      if (!text.trim()) {
        throw new Error("File is empty");
      }

      const keywords = extractResumeKeywords(text);
      if (keywords.length === 0) {
        throw new Error("No research topics found in resume. Try uploading a longer resume.");
      }

      const updated = updateUser({ resumeKeywords: keywords });
      if (updated) {
        setUser(updated);
        // Persist to database
        await updateUserInDatabase(updated);
        setSuccess(`Resume processed! Found ${keywords.length} research topics.`);
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch (err: any) {
      setError(err.message || "Failed to process resume");
    } finally {
      setResumeLoading(false);
    }
  };

  const handleResumePaste = async (text: string) => {
    if (!text.trim()) {
      setError("Please paste your resume text");
      return;
    }

    setError("");
    setSuccess("");

    const keywords = extractResumeKeywords(text);
    if (keywords.length === 0) {
      setError("No research topics found. Make sure your resume contains relevant topics.");
      return;
    }

    const updated = updateUser({ resumeKeywords: keywords });
    if (updated) {
      setUser(updated);
      // Persist to database
      await updateUserInDatabase(updated);
      setSuccess(`Resume processed! Found ${keywords.length} research topics.`);
      setTimeout(() => setSuccess(""), 3000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (!firstName.trim()) {
        setError("First name is required");
        setLoading(false);
        return;
      }

      const newInterests = interests
        .split(",")
        .map((i) => i.trim())
        .filter((i) => i.length > 0);
      
      const updated = updateUser({
        firstName: firstName.trim(),
        age: age ? parseInt(age, 10) : undefined,
        university: university.trim() || undefined,
        interests: newInterests,
      });

      if (updated) {
        setUser(updated);
        // Save to database
        await updateUserInDatabase(updated);
        setSuccess("Settings saved successfully!");
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch (err: any) {
      setError(err.message || "Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-white/70">Loading...</div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-600/20 via-transparent to-blue-500/20 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-teal-900/30 via-transparent to-transparent pointer-events-none" />
      
      <div className="relative mx-auto max-w-4xl px-6 py-16">
        <div className="max-w-2xl">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Account Settings</h1>
            <p className="text-white/70">Manage your profile information</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* First Name */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                First Name *
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Your first name"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/30"
              />
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Email
              </label>
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none opacity-50"
              />
              <p className="text-xs text-white/60 mt-1">Cannot be changed</p>
            </div>

            {/* Username (read-only) */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Username
              </label>
              <input
                type="text"
                value={user.username}
                disabled
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none opacity-50"
              />
              <p className="text-xs text-white/60 mt-1">Cannot be changed</p>
            </div>

            {/* Age */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Age (Optional)
              </label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="e.g., 20"
                min="13"
                max="120"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/30"
              />
            </div>

            {/* University */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                University (Optional)
              </label>
              <input
                type="text"
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                placeholder="e.g., University of British Columbia"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/30"
              />
            </div>

            {/* Resume Upload */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
              <h3 className="text-lg font-semibold">Upload Resume (Optional)</h3>
              <p className="text-sm text-white/70">
                Upload your resume to get personalized research recommendations based on your background and skills.
              </p>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Upload Text File or Paste Content:
                  </label>
                  <input
                    type="file"
                    accept=".txt"
                    onChange={handleResumeUpload}
                    disabled={resumeLoading}
                    className="block w-full text-sm text-white/70 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-white/10 file:text-white hover:file:bg-white/20 disabled:opacity-50"
                  />
                  <p className="text-[11px] text-white/50 mt-1">Supports .txt files</p>
                </div>

                <textarea
                  placeholder="Or paste your resume content here..."
                  rows={6}
                  onBlur={(e) => {
                    if (e.target.value.trim()) {
                      handleResumePaste(e.target.value);
                      e.target.value = "";
                    }
                  }}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/30 resize-none"
                  disabled={resumeLoading}
                />
              </div>

              {user?.resumeKeywords && user.resumeKeywords.length > 0 && (
                <div className="pt-3 border-t border-white/10">
                  <p className="text-sm text-white/70 mb-2">Detected Topics ({user.resumeKeywords.length}):</p>
                  <div className="flex flex-wrap gap-2">
                    {user.resumeKeywords.slice(0, 15).map((keyword) => (
                      <span key={keyword} className="rounded-full border border-blue-400/40 bg-blue-400/10 px-3 py-1 text-xs text-blue-100">
                        {keyword}
                      </span>
                    ))}
                    {user.resumeKeywords.length > 15 && (
                      <span className="text-xs text-white/60">+{user.resumeKeywords.length - 15} more</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Interests */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Research Interests (Optional)
              </label>
              <p className="text-xs text-white/60 mb-2">Separate with commas</p>
              <textarea
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                placeholder="e.g., Machine Learning, Biology, Climate Science"
                rows={4}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/30 resize-none"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-100">
                {success}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 rounded-xl border border-white/20 px-4 py-3 text-sm font-medium hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-xl bg-white px-4 py-3 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
