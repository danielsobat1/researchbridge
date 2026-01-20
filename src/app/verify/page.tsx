// app/verify/page.tsx
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { verifyEmailToken, getVerificationToken, saveUser, createUser, saveUserToDatabase } from "@/app/lib/auth";

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");

  useEffect(() => {
    (async () => {
      const email = searchParams.get("email");
      const token = searchParams.get("token");

      if (!email || !token) {
        setStatus("error");
        setMessage("Invalid verification link");
        return;
      }

      setEmail(email);

      // Verify the token
      if (verifyEmailToken(email, token)) {
        // Token is valid, extract username and firstName from search params
        const username = searchParams.get("username");
        const firstName = searchParams.get("firstName");
        if (username && firstName) {
          setUsername(username);
          setFirstName(firstName);
          setStatus("success");
          setMessage("Email verified successfully!");

          // Auto-create user in localStorage
          const user = createUser(email, username, firstName);
          user.verified = true;
          saveUser(user);
          
          // Try to save to database (Supabase)
          await saveUserToDatabase(user);

          // Redirect to home after 2 seconds
          setTimeout(() => {
            router.push("/");
          }, 2000);
        } else {
          setStatus("error");
          setMessage("Username or first name not found in verification link");
        }
      } else {
        setStatus("error");
        setMessage("Invalid or expired verification link");
      }
    })();
  }, [searchParams, router]);

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-6">Email Verification</h1>

          {status === "verifying" && (
            <div className="space-y-4">
              <div className="text-white/70">Verifying your email...</div>
              <div className="inline-block animate-spin">⟳</div>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-4">
              <div className="text-2xl">✅</div>
              <div className="text-lg font-semibold text-green-400">{message}</div>
              <div className="text-white/70">Welcome, <span className="font-semibold">{username}</span>!</div>
              <div className="text-sm text-white/60">Redirecting to home page...</div>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <div className="text-2xl">❌</div>
              <div className="text-lg font-semibold text-red-400">{message}</div>
              <a
                href="/auth"
                className="inline-block mt-4 rounded-xl bg-white px-6 py-3 text-black font-medium hover:bg-white/90"
              >
                Try Sign Up Again
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
          <div className="w-full max-w-md text-center text-white/70">Loading verification…</div>
        </main>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
