"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DEFAULT_STATE, exportAll, importAll, loadState, saveState, clearAll, recomputeCounters, type AppState } from "@/lib/storage";
import { Callout } from "@/components/Callout";
import { toast } from "@/components/Toast";
import { uniqueGiftCardDeals, AMAZON_WELCOME_OFFERS } from "@/lib/stacking";
import { isSupabaseConfigured, getSupabase } from "@/lib/supabase";
import { onSyncStatus, pullFromCloud, pushToCloud, type SyncStatus } from "@/lib/cloudSync";

const FIELDS: { key: keyof AppState; label: string; group: string; numeric?: boolean }[] = [
  { key: "ptccEligibleSpend", label: "Amex Plat Travel — eligible cycle spend (₹)", group: "Annual milestone progress", numeric: true },
  { key: "mrccCycleSpend", label: "Amex MRCC — fee-waiver cycle spend (₹)", group: "Annual milestone progress", numeric: true },
  { key: "sbiYtdSpend", label: "SBI SimplyCLICK — ONLINE voucher spend (₹, toward ₹1L/₹2L)", group: "Annual milestone progress", numeric: true },
  { key: "sbiFeeWaiverSpend", label: "SBI SimplyCLICK — fee-waiver eligible spend (₹, since day after fee)", group: "Annual milestone progress", numeric: true },
  { key: "idfcYtdSpend", label: "IDFC Indigo — YTD spend (₹)", group: "Annual milestone progress", numeric: true },
  { key: "bobYtdSpend", label: "BOB Eterna — spend since issuance (₹)", group: "Annual milestone progress", numeric: true },
  { key: "hsbcLivePlusYtdSpend", label: "HSBC Live+ — YTD spend (₹, fee waiver @ ₹2L)", group: "Annual milestone progress", numeric: true },
  { key: "scapiaMonthlySpend", label: "Scapia — current month spend (₹)", group: "Monthly tracking", numeric: true },
  { key: "kiwiNeonCycleSpend", label: "Kiwi Neon cycle (Apr–Mar) spend (₹)", group: "Monthly tracking", numeric: true },
  { key: "livePlusAccelCashbackUsedThisMonth", label: "HSBC Live+ — 10% cashback used this month (cap ₹1,200)", group: "Monthly milestone counters", numeric: true },
  { key: "goldThisMonthTxnsAt1k", label: "Amex Gold — ≥₹1K txns this calendar month (0-6)", group: "Monthly milestone counters", numeric: true },
  { key: "mrccThisCycleTxnsAt1500", label: "Amex MRCC — ≥₹1.5K txns this calendar month (0-4)", group: "Monthly milestone counters", numeric: true },
  { key: "mrccThisCycleAmount", label: "Amex MRCC — total this calendar month (toward ₹20K)", group: "Monthly milestone counters", numeric: true },
  { key: "goldShopwiseUsedThisMonth", label: "Amex Gold — ShopWise voucher spend this month (cap ₹10K)", group: "Monthly milestone counters", numeric: true },
  { key: "bobCycleSpend5x", label: "BOB Eterna — 5× spend this cycle (cap ~₹33K)", group: "Monthly milestone counters", numeric: true },
  { key: "amazonPayBalance", label: "Amazon Pay balance (₹, idle gift-card money)", group: "Amazon Pay & welcome windows", numeric: true },
  { key: "bobEternaIssueDate", label: "BOB Eterna issue date (YYYY-MM-DD, drives 60-day welcome)", group: "Amazon Pay & welcome windows", numeric: false },
  { key: "amazonPayIciciIssueDate", label: "Amazon Pay ICICI issue date (YYYY-MM-DD)", group: "Amazon Pay & welcome windows", numeric: false },
  { key: "hsbcLivePlusIssueDate", label: "HSBC Live+ issue date (YYYY-MM-DD, drives ₹25k/30d welcome)", group: "Amazon Pay & welcome windows", numeric: false },
  { key: "sbiFeeAnniversaryDate", label: "SBI SimplyCLICK — annual fee date (YYYY-MM-DD)", group: "Milestone period dates", numeric: false },
  { key: "sbiOnlineYearStart", label: "SBI SimplyCLICK — online voucher year start (YYYY-MM-DD)", group: "Milestone period dates", numeric: false },
  { key: "amexMrPooled", label: "Amex MR — pooled balance", group: "Reward balances", numeric: true },
  { key: "indigoBluChips", label: "IndiGo BluChips balance", group: "Reward balances", numeric: true },
  { key: "scapiaCoins", label: "Scapia coins balance", group: "Reward balances", numeric: true },
  { key: "sbiRp", label: "SBI Reward Points balance", group: "Reward balances", numeric: true },
  { key: "bobRp", label: "BOB Reward Points balance", group: "Reward balances", numeric: true },
  { key: "kiwiCashback", label: "Kiwi cashback balance (current cycle)", group: "Reward balances", numeric: true },
  { key: "kiwiLifetimeEarned", label: "Kiwi lifetime earnings (₹)", group: "Reward balances", numeric: true },
  { key: "credCoins", label: "CRED coins balance", group: "Reward balances", numeric: true },
  { key: "cheqChips", label: "CheQ chips balance", group: "Reward balances", numeric: true },
  { key: "gyftrBalance", label: "HDFC GyFTR balance (₹)", group: "Debit & GyFTR", numeric: true },
  { key: "hdfcDebitCashbackPts", label: "HDFC Platinum debit cashback points", group: "Debit & GyFTR", numeric: true },
  { key: "hdfcDebitIssueDate", label: "HDFC debit / account issue date (YYYY-MM-DD)", group: "Debit & GyFTR", numeric: false },
  { key: "ptccLoungesUsed", label: "PTCC lounges used (year)", group: "Lounge usage", numeric: true },
  { key: "ptccLoungesUsedThisQuarter", label: "PTCC lounges used (this quarter)", group: "Lounge usage", numeric: true },
];

const TOGGLES: { key: keyof AppState; label: string }[] = [
  { key: "amazonPayIciciIssued", label: "Amazon Pay ICICI issued (received)" },
  { key: "primeMember", label: "Amazon Prime member" },
  { key: "bobWelcomeUnlocked", label: "BOB Eterna ₹50K welcome bonus already credited" },
  { key: "hsbcWelcomeClaimed", label: "HSBC Live+ ₹1k welcome cashback already credited" },
  { key: "hdfcDebitWelcomeGyftrClaimed", label: "HDFC debit welcome GyFTR ₹500/₹750 already received" },
  // BOGO is now auto-derived from your logged District transactions — no manual toggle needed.
];

export default function SettingsPage() {
  const [state, setState] = useState<AppState | null>(null);
  const [exportText, setExportText] = useState("");
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState("");

  useEffect(() => { setState(loadState()); }, []);
  if (!state) return <div className="text-fg-muted">Loading…</div>;

  const update = <K extends keyof AppState>(k: K, v: AppState[K]) => {
    const next = { ...state, [k]: v };
    setState(next);
    saveState(next);
  };

  const groups = Array.from(new Set(FIELDS.map((f) => f.group)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Settings</h1>
        <p className="text-fg-muted text-sm">
          Update card balances, milestone progress, and card-issuance status. Stored locally.{" "}
          <Link href="/claims" className="text-accent hover:underline">Benefit claims checklist →</Link>
        </p>
      </div>

      <Callout tone="info">
        <div className="font-medium mb-1">Milestone periods (not all calendar year)</div>
        <ul className="text-sm space-y-1 list-disc pl-4">
          <li><b>Amex Gold / MRCC monthly</b> — calendar month</li>
          <li><b>Amex PT annual</b> — membership year (ends ~3 Dec), not Jan–Dec</li>
          <li><b>Amex MRCC fee waiver</b> — renewal / membership year (see card cycle end), not calendar year</li>
          <li><b>SBI fee waiver</b> — fee anniversary (~21 Oct); spend counts from the day after the fee posts</li>
          <li><b>SBI online vouchers</b> — separate year (statement reset ~22 May); not the Oct fee year</li>
          <li><b>Kiwi Neon</b> — 1 Apr → 31 Mar</li>
          <li><b>IDFC / Live+ fee YTD</b> — tracked as calendar year here (confirm on issuer app if unsure)</li>
          <li><b>Scapia lounge</b> — calendar month ₹20k · <b>BOB lounge</b> — ₹75k prior quarter · <b>BOB welcome</b> — 60 days from issue</li>
        </ul>
      </Callout>

      <section className="card-shell border-accent/30 bg-gradient-to-br from-accent/5 to-bg-elevated">
        <div className="card-body flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="font-semibold">Rebuild counters from log</div>
            <div className="text-xs text-fg-muted mt-0.5 max-w-xl">
              Overwrites Milestones till-date numbers with sums from your logged transactions only (usually incomplete vs statements). Loyalty balances and issuance dates are kept. Prefer editing till-dates on Milestones — do not use this after a redeploy unless you mean to wipe those edits.
            </div>
          </div>
          <button
            className="btn-primary whitespace-nowrap"
            onClick={() => {
              if (!confirm("Rebuild all spend/milestone counters from your logged transactions? Loyalty balances are preserved.")) return;
              setState(recomputeCounters());
              toast("Counters rebuilt from your transaction log", "success");
            }}
          >Recompute counters</button>
        </div>
      </section>

      {groups.map((g) => (
        <section key={g} className="card-shell">
          <div className="card-header"><div className="font-semibold">{g}</div></div>
          <div className="card-body grid sm:grid-cols-2 gap-3">
            {FIELDS.filter((f) => f.group === g).map((f) => (
              <div key={String(f.key)}>
                <div className="label mb-1">{f.label}</div>
                <input
                  className="input"
                  value={String(state[f.key])}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const n = Number(raw.replace(/[^0-9.-]/g, ""));
                    update(f.key, (f.numeric ? (Number.isFinite(n) ? n : 0) : raw) as AppState[typeof f.key]);
                  }}
                  inputMode={f.numeric ? "numeric" : undefined}
                />
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="card-shell">
        <div className="card-header">
          <div className="font-semibold">Live offer rates</div>
          <div className="text-xs text-fg-muted">Enter what you see in-app — the recommender recalculates instantly</div>
        </div>
        <div className="card-body space-y-5">
          <div>
            <div className="label mb-2">Gift-card discounts (CRED / CheQ) — % off face value</div>
            <div className="grid sm:grid-cols-2 gap-2">
              {uniqueGiftCardDeals().map((d) => {
                const current = state.giftCardRateOverrides?.[d.key];
                return (
                  <div key={d.key} className="flex items-center gap-2">
                    <span className="text-sm flex-1">{d.store} · {d.merchantLabel}</span>
                    <input
                      className="input w-24"
                      inputMode="numeric"
                      placeholder={`${d.defaultPct}%`}
                      value={current ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9.]/g, "");
                        const next = { ...(state.giftCardRateOverrides ?? {}) };
                        if (raw === "") delete next[d.key];
                        else next[d.key] = Number(raw);
                        update("giftCardRateOverrides", next);
                      }}
                    />
                    <span className="text-xs text-fg-muted w-4">%</span>
                  </div>
                );
              })}
            </div>
            <div className="text-xs text-fg-muted mt-1">Blank = use default estimate ({"shown as placeholder"}). Set to 0 to disable a route.</div>
          </div>

          <div>
            <div className="label mb-2">Amazon Pay ICICI welcome coupons — tick the ones you've already used</div>
            <div className="grid sm:grid-cols-2 gap-2">
              {AMAZON_WELCOME_OFFERS.map((o) => {
                const claimed = (state.amazonWelcomeClaimed ?? []).includes(o.id);
                return (
                  <label key={o.id} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={claimed}
                      onChange={(e) => {
                        const set = new Set(state.amazonWelcomeClaimed ?? []);
                        if (e.target.checked) set.add(o.id);
                        else set.delete(o.id);
                        update("amazonWelcomeClaimed", Array.from(set));
                      }}
                    />
                    <span className={claimed ? "line-through text-fg-muted" : ""}>{o.label}</span>
                  </label>
                );
              })}
            </div>
            <div className="text-xs text-fg-muted mt-1">Unticked = still available; the recommender will prioritise it on your first matching transaction.</div>
          </div>
        </div>
      </section>

      <section className="card-shell">
        <div className="card-header"><div className="font-semibold">Card status</div></div>
        <div className="card-body space-y-3">
          {TOGGLES.map((t) => (
            <label key={String(t.key)} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(state[t.key])}
                onChange={(e) => update(t.key, e.target.checked as AppState[typeof t.key])}
              />
              <span>{t.label}</span>
            </label>
          ))}
        </div>
      </section>

      <CloudSyncSection />

      <section className="card-shell">
        <div className="card-header"><div className="font-semibold">Backup / restore</div></div>
        <div className="card-body space-y-3">
          <div>
            <button
              className="btn-secondary"
              onClick={() => setExportText(exportAll())}
            >Export all data (JSON)</button>
            {exportText ? (
              <textarea className="input mt-2 font-mono text-xs h-40" readOnly value={exportText} />
            ) : null}
          </div>
          <div>
            <div className="label mb-1">Paste JSON to restore</div>
            <textarea className="input font-mono text-xs h-40" value={importText} onChange={(e) => setImportText(e.target.value)} />
            <div className="flex items-center gap-2 mt-2">
              <button
                className="btn-primary"
                onClick={() => {
                  if (importAll(importText)) {
                    setState(loadState());
                    setImportMsg("Imported successfully.");
                    toast("Data imported successfully", "success");
                  } else {
                    setImportMsg("Import failed — invalid JSON.");
                    toast("Import failed — invalid JSON", "error");
                  }
                }}
              >Import</button>
              {importMsg ? <span className="text-sm text-fg-muted">{importMsg}</span> : null}
            </div>
          </div>
          <Callout tone="danger" title="Reset everything">
            <button
              className="btn-secondary border-danger/40 text-danger"
              onClick={() => {
                if (confirm("Clear all transactions and reset state to defaults? This cannot be undone.")) {
                  clearAll();
                  setState(loadState());
                }
              }}
            >Clear all data</button>
          </Callout>
        </div>
      </section>
    </div>
  );
}

function CloudSyncSection() {
  const [status, setStatus] = useState<SyncStatus>("offline");
  const [email, setEmail] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const off = onSyncStatus(setStatus);
    const sb = getSupabase();
    sb?.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    return () => { off(); };
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <section className="card-shell">
        <div className="card-header"><div className="font-semibold">Cloud sync</div></div>
        <div className="card-body">
          <Callout tone="info" title="Local-only mode">
            Cloud sync is not configured, so all data lives in this browser only. To enable cross-device sync, set the Supabase env vars (see README) and redeploy. Until then, use Export/Restore below as your backup.
          </Callout>
        </div>
      </section>
    );
  }

  const label: Record<SyncStatus, string> = {
    idle: "Idle", syncing: "Syncing…", synced: "Synced ✓", error: "Sync error", offline: "Local only",
  };
  const tone = status === "synced" ? "text-success" : status === "error" ? "text-danger" : "text-fg-muted";

  return (
    <section className="card-shell">
      <div className="card-header">
        <div className="font-semibold">Cloud sync</div>
        <span className={`text-sm font-medium ${tone}`}>{label[status]}</span>
      </div>
      <div className="card-body space-y-3">
        <div className="text-sm text-fg-muted">
          Signed in as <b className="text-fg">{email ?? "…"}</b>. Your data syncs automatically to your private Supabase row after every change.
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={async () => { setMsg(""); const ok = await pushToCloud(); setMsg(ok ? "Pushed to cloud." : "Push failed."); }}>Push now</button>
          <button className="btn-secondary" onClick={async () => { setMsg(""); const r = await pullFromCloud(); setMsg(r.pulled ? "Pulled latest from cloud. Refresh to see it." : "No remote data found."); }}>Pull latest</button>
          <button className="btn-secondary border-danger/40 text-danger" onClick={async () => { await getSupabase()?.auth.signOut(); location.reload(); }}>Sign out</button>
          {msg && <span className="text-sm text-fg-muted self-center">{msg}</span>}
        </div>
      </div>
    </section>
  );
}
