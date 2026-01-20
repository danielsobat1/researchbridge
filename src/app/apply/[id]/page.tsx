"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { opportunities } from "../../opportunities/opportunities";

const APPS_KEY = "rb_applications";

type Application = {
  id: string; // opportunity id
  name: string;
  email: string;
  message: string;
  createdAt: string;
};

export default function ApplyPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const opp = useMemo(() => opportunities.find((o) => o.id === id), [id]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setSubmitted(false);
  }, [id]);

  function saveApplication() {
    if (!id) return;
    if (!name.trim() || !email.trim() || !message.trim()) return;

    const app: Application = {
      id,
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
      createdAt: new Date().toISOString(),
    };

    try {
      const raw = localStorage.getItem(APPS_KEY);
      const existing = raw ? JSON.parse(raw) : [];
      const next = Array.isArray(existing) ? [...existing, app] : [app];
      localStorage.setItem(APPS_KEY, JSON.stringify(next));
      setSubmitted(true);
      setMessage("");
    } catch {
      // ignore
    }
  }

  if (!opp) {
    return (
      <main className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-2xl px-6 py-10">
          <a className="text-white/70 hover:text-white" href="/opportunities">
            ← Back
          </a>
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
            Opportunity not found.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <a className="text-white/70 hover:text-white" href={`/opportunities`}>
          ← Back to opportunities
        </a>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-2xl font-semibold">Apply</h1>
          <p className="mt-2 text-white/70">
            {opp.title}
            <span className="text-white/40"> · </span>
            {opp.lab}
          </p>

          {submitted && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/10 p-4 text-sm text-white/80">
              Submitted. Stored locally for now (aka: not actually sent anywhere yet).
            </div>
          )}

          <form
            className="mt-6 grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveApplication();
            }}
          >
            <label className="grid gap-2">
              <span className="text-sm text-white/70">Your name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/30"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-white/70">Your email</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/30"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-white/70">Message</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[140px] rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/30"
                placeholder="Why you're interested, relevant skills, availability..."
              />
            </label>

            <button
              type="submit"
              className="rounded-xl bg-white px-5 py-3 text-sm font-medium text-black hover:bg-white/90"
            >
              Submit application
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
