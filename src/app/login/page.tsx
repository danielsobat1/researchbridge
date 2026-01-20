// app/login/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, isValidEmail, fetchUserFromDatabase, saveUser } from "@/app/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [existingUser, setExistingUser] = useState<null | { email: string; firstName: string }>(null);

  useEffect(() => {
    const cached = getUser();
    if (cached) {
      setExistingUser({ email: cached.email, firstName: cached.firstName });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!email.trim()) {
        setError("Email is required");
        return;
      }

      if (!isValidEmail(email)) {
        setError("Please enter a valid email");
        return;
      }
      
      // Try Supabase first (if configured)
      const dbUser = await fetchUserFromDatabase(email);
      if (dbUser) {
        saveUser(dbUser);
        router.push("/");
        return;
      }

      // Fallback to localStorage user (demo/local mode)
      const localUser = getUser();
      if (localUser && localUser.email === email) {
        saveUser(localUser);
        router.push("/");
        return;
      }

      setError("Account not found. Please create a new account instead.");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-lg">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Welcome back</h1>
          <p className="text-white/70 text-sm">Use your verified email. If we don't find an account, we'll guide you to create one.</p>
        </div>

        {existingUser && (
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white">
            <div className="mb-2 font-semibold">You're already signed in as {existingUser.firstName} ({existingUser.email}).</div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="rounded-xl bg-white px-4 py-2 text-black font-medium hover:bg-white/90"
              >
                Go to my account
              </button>
              <button
                type="button"
                onClick={() => router.push("/settings")}
                className="rounded-xl border border-white/20 px-4 py-2 text-white hover:bg-white/10"
              >
                Account settings
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-white/70">
              <label className="font-medium">Email address</label>
              <span>Verified email only</span>
            </div>
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
            disabled={loading}
            className="w-full rounded-xl bg-white px-4 py-3 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-70"
          >
            {loading ? "Checking..." : "Sign in"}
          </button>

          <div className="text-center text-sm text-white/60">
            No account yet?{" "}
            <a href="/auth" className="text-white hover:underline font-medium">
              Create one
            </a>
          </div>
        </form>
      </div>
    </main>
  );
}
