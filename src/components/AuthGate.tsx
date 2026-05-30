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
  const [sent, setSent] = useState(false);
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

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const sb = getSupabase();
    if (!sb || !email) return;
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });
    if (error) setError(error.message);
    else setSent(true);
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
          <p className="text-sm text-fg-muted mb-4">Sign in to sync your data securely across devices. We&apos;ll email you a magic link — no password.</p>
          {sent ? (
            <div className="text-sm text-success">Magic link sent to <b>{email}</b>. Open it on this device to sign in.</div>
          ) : (
            <form onSubmit={sendLink} className="space-y-3">
              <input
                type="email"
                className="input"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button type="submit" className="btn-primary w-full justify-center">Email me a magic link</button>
              {error && <div className="text-sm text-danger">{error}</div>}
            </form>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
