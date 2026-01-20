// app/auth/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isValidEmail, isValidUsername, generateVerificationToken, saveVerificationToken } from "@/app/lib/auth";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [step, setStep] = useState<"email" | "username" | "name" | "profile">("email");
  const [error, setError] = useState("");
  const [age, setAge] = useState("");
  const [isUBC, setIsUBC] = useState(false);
  const [interests, setInterests] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    if (!isValidEmail(email)) {
      setError("Please enter a valid email");
      return;
    }

    setStep("username");
  };

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim()) {
      setError("Username is required");
      return;
    }

    if (!isValidUsername(username)) {
      setError("Username must be 3-20 characters (letters, numbers, underscore, hyphen only)");
      return;
    }

    setStep("name");
  };

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!firstName.trim()) {
      setError("First name is required");
      return;
    }

    setStep("profile");
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Generate verification token
      const token = generateVerificationToken();
      saveVerificationToken(email, token);

      // Build verification URL
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
      const verificationUrl = `${baseUrl}/verify?email=${encodeURIComponent(email)}&username=${encodeURIComponent(username)}&firstName=${encodeURIComponent(firstName)}&token=${token}`;

      // Prepare user data to send in email
      const userData = {
        age: age ? parseInt(age, 10) : undefined,
        university: isUBC ? "UBC" : undefined,
        interests: interests
          .split(",")
          .map((i) => i.trim())
          .filter((i) => i.length > 0),
      };

      // Send verification email
      const emailResponse = await fetch("/api/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          username,
          firstName,
          token,
          verificationUrl,
          userData,
        }),
      });

      if (!emailResponse.ok) {
        throw new Error("Failed to send verification email");
      }

      setVerificationSent(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (verificationSent) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="text-4xl mb-4">📧</div>
          <h1 className="text-2xl font-bold mb-2">Check your email!</h1>
          <p className="text-white/70 mb-4">
            We've sent a verification link to <span className="font-semibold">{email}</span>
          </p>
          <p className="text-white/60 text-sm mb-6">
            Click the link in your email to verify your account and complete sign-up.
          </p>
          <button
            onClick={() => {
              setVerificationSent(false);
              setStep("email");
              setEmail("");
              setUsername("");
            }}
            className="rounded-xl border border-white/20 px-6 py-2 text-sm hover:bg-white/10"
          >
            Back to sign up
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="max-w-md mx-auto">
          <h1 className="text-3xl font-bold mb-2">ResearchBridge</h1>
          <p className="text-white/70">Create your personalized research profile</p>

          {step === "email" ? (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/30"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="w-full rounded-xl bg-white px-4 py-3 text-sm font-medium text-black hover:bg-white/90"
              >
                Continue
              </button>

              <p className="text-center text-sm text-white/60">
                Already have an account?{" "}
                <a href="/login" className="text-white hover:underline">
                  Sign in
                </a>
              </p>
            </form>
          ) : step === "username" ? (
            <form onSubmit={handleUsernameSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Username
                </label>
                <p className="text-xs text-white/60 mb-2">
                  3-20 characters (letters, numbers, underscore, hyphen)
                </p>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g., john_doe"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/30"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="flex-1 rounded-xl border border-white/20 px-4 py-3 text-sm font-medium hover:bg-white/10"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-white px-4 py-3 text-sm font-medium text-black hover:bg-white/90"
                >
                  Continue
                </button>
              </div>
            </form>
          ) : step === "name" ? (
            <form onSubmit={handleNameSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g., John"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/30"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep("username")}
                  className="flex-1 rounded-xl border border-white/20 px-4 py-3 text-sm font-medium hover:bg-white/10"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-white px-4 py-3 text-sm font-medium text-black hover:bg-white/90"
                >
                  Continue
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  disabled
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Age (optional)
                </label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="e.g., 22"
                  min="13"
                  max="120"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/30"
                />
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                <input
                  id="isUBC"
                  type="checkbox"
                  checked={isUBC}
                  onChange={(e) => setIsUBC(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-white/40 bg-black/30"
                />
                <div>
                  <label htmlFor="isUBC" className="block text-sm font-medium text-white/80">
                    I am part of UBC
                  </label>
                  <p className="text-xs text-white/60">Enables UBC-only daily picks and professor matching</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Research Interests
                </label>
                <p className="text-xs text-white/60 mb-2">
                  Separate multiple interests with commas
                </p>
                <textarea
                  value={interests}
                  onChange={(e) => setInterests(e.target.value)}
                  placeholder="e.g., machine learning, genetics, climate science"
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/30 resize-none"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep("username")}
                  className="flex-1 rounded-xl border border-white/20 px-4 py-3 text-sm font-medium hover:bg-white/10"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-xl bg-white px-4 py-3 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-70"
                >
                  {loading ? "Sending..." : "Create Account"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
