"use client";

import { useEffect, useState } from "react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { startCloudSync, stopCloudSync } from "@/lib/cloudSync";

type AuthState = "loading" | "signedOut" | "signedIn";

export function AuthGate({ children }: { children: React.ReactNode }) {
  // Local-only mode: no Supabase configured → render app as-is.
  if (!isSupabaseConfigured) return <>{children}</>;
  return <AuthGated>{children}</AuthGated>;
}

function AuthGated({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let mounted = true;
    sb.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) {
        setAuth("signedIn");
        void startCloudSync();
      } else {
        setAuth("signedOut");
      }
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setAuth("signedIn");
        void startCloudSync();
      } else {
        setAuth("signedOut");
        stopCloudSync();
      }
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setInfo("");
    const sb = getSupabase();
    if (!sb || !email || !password) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) { setError(error.message); return; }
        if (!data.session) {
          // Email confirmation is still ON — tell the user to disable it (or confirm via email)
          setInfo("Account created. If email confirmation is enabled in Supabase, check your inbox to confirm — or disable 'Confirm email' in Supabase for instant login.");
        }
        // If confirmation is OFF, a session is returned and onAuthStateChange signs you in.
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) setError(error.message);
      }
    } finally {
      setBusy(false);
    }
  };

  if (auth === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-fg-muted">Loading…</div>;
  }

  if (auth === "signedOut") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card-shell p-6 max-w-sm w-full">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-info flex items-center justify-center text-white font-bold text-sm">₹</div>
            <div className="font-semibold">Personal Finance Manager</div>
          </div>
          <p className="text-sm text-fg-muted mb-4">
            {mode === "signin" ? "Sign in to sync your data across devices." : "Create your account to start syncing across devices."}
          </p>
          <form onSubmit={submit} className="space-y-3">
            <input
              type="email"
              className="input"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <input
              type="password"
              className="input"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              minLength={6}
              required
            />
            <button type="submit" className="btn-primary w-full justify-center" disabled={busy}>
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
            {error && <div className="text-sm text-danger">{error}</div>}
            {info && <div className="text-sm text-info">{info}</div>}
          </form>
          <button
            className="text-xs text-fg-muted hover:text-fg mt-3"
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setInfo(""); }}
          >
            {mode === "signin" ? "First time? Create an account" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
