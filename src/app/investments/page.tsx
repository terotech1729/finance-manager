"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadHoldings, addHolding, deleteHolding, addContribution, deleteContribution,
  updateHolding, holdingInvested, holdingValue, holdingHasValue,
} from "@/lib/storage";
import type { Holding, InvestmentType, PaymentMethod } from "@/lib/types";
import { INVESTMENT_TYPES, PAYMENT_METHODS, typeIcon, typeLabel } from "@/lib/investmentTypes";
import { inr, inrExact, newId, todayLocal, localDateToISO } from "@/lib/utils";
import { Icon } from "@/components/Icons";
import { Callout } from "@/components/Callout";

function pnl(h: Holding) {
  const invested = holdingInvested(h);
  const value = holdingValue(h);
  const abs = value - invested;
  const pct = invested > 0 ? (abs / invested) * 100 : 0;
  return { invested, value, abs, pct, hasValue: holdingHasValue(h) };
}

export default function InvestmentsPage() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  // Add-holding form
  const [name, setName] = useState("");
  const [type, setType] = useState<InvestmentType>("stocks");
  const [platform, setPlatform] = useState("");
  const [opening, setOpening] = useState("");
  const [curVal, setCurVal] = useState("");
  const [date, setDate] = useState(() => todayLocal());
  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [notes, setNotes] = useState("");
  // Real-estate specific
  const [reValue, setReValue] = useState("");
  const [reDown, setReDown] = useState("");
  const [reLoan, setReLoan] = useState("");
  const [reLender, setReLender] = useState("");
  const [reRate, setReRate] = useState("");
  const [reEmi, setReEmi] = useState("");
  const [reTenure, setReTenure] = useState("");

  const isRE = type === "real_estate";

  // Per-holding inline editors
  const [addMoneyFor, setAddMoneyFor] = useState<string | null>(null);
  const [valueFor, setValueFor] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [showBulkValues, setShowBulkValues] = useState(false);

  useEffect(() => { setHoldings(loadHoldings()); }, []);

  const anyValues = useMemo(() => holdings.some((h) => holdingHasValue(h)), [holdings]);
  const totals = useMemo(() => {
    let invested = 0, value = 0;
    holdings.forEach((h) => { const p = pnl(h); invested += p.invested; value += p.value; });
    const thisMonth = holdings.reduce((a, h) => a + (h.contributions ?? [])
      .filter((c) => c.date.slice(0, 7) === todayLocal().slice(0, 7))
      .reduce((s, c) => s + c.amount, 0), 0);
    return { invested, value, abs: value - invested, pct: invested > 0 ? ((value - invested) / invested) * 100 : 0, thisMonth };
  }, [holdings]);

  const sorted = useMemo(
    () => [...holdings].sort((a, b) => pnl(b).value - pnl(a).value),
    [holdings]
  );

  const num = (s: string) => { const n = Number((s || "").replace(/[^0-9.]/g, "")); return s.trim() && !Number.isNaN(n) ? n : undefined; };

  const onAddHolding = () => {
    if (!name.trim()) return;
    let h: Holding;
    if (isRE) {
      const down = num(reDown) ?? 0;
      h = {
        id: newId(),
        name: name.trim(),
        type,
        platform: platform.trim() || undefined,
        // Down payment is the equity you've actually deployed (cost basis).
        contributions: down > 0
          ? [{ id: newId(), date: localDateToISO(date), amount: down, note: "Down payment" }]
          : [],
        currentValueDate: localDateToISO(date),
        realEstate: {
          propertyValue: num(reValue),
          downPayment: down || undefined,
          loanAmount: num(reLoan),
          lender: reLender.trim() || undefined,
          interestRate: num(reRate),
          emi: num(reEmi),
          tenureMonths: reTenure.trim() ? Math.round((num(reTenure) ?? 0) * 12) : undefined,
        },
        notes: notes.trim() || undefined,
      };
    } else {
      const opAmt = num(opening) ?? 0;
      const cv = num(curVal);
      h = {
        id: newId(),
        name: name.trim(),
        type,
        platform: platform.trim() || undefined,
        contributions: opAmt > 0
          ? [{ id: newId(), date: localDateToISO(date), amount: opAmt, paymentMethod: method, note: "Opening balance" }]
          : [],
        currentValue: cv,
        currentValueDate: cv != null ? localDateToISO(date) : undefined,
        notes: notes.trim() || undefined,
      };
    }
    setHoldings(addHolding(h));
    setName(""); setPlatform(""); setOpening(""); setCurVal(""); setNotes(""); setDate(todayLocal());
    setReValue(""); setReDown(""); setReLoan(""); setReLender(""); setReRate(""); setReEmi(""); setReTenure("");
    setShowAdd(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Investments</h1>
          <p className="text-fg-muted mt-1">Track each holding as one position. SIPs &amp; top-ups add to the same holding so it grows over time.</p>
        </div>
        <div className="flex gap-2">
          {holdings.length > 0 && (
            <button className="btn-secondary" onClick={() => setShowBulkValues((v) => !v)}>
              {showBulkValues ? "Close" : "Update values"}
            </button>
          )}
          <button className="btn-primary" onClick={() => setShowAdd((v) => !v)}>
            <Icon.Plus size={16} /> {showAdd ? "Close" : "Add holding"}
          </button>
        </div>
      </div>

      {/* Portfolio KPIs — gains shown only once you've entered current values (fully optional) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-tile">
          <div className="label">Invested (deployed)</div>
          <div className="text-2xl font-semibold mt-1 text-info">{inr(totals.invested)}</div>
          <div className="text-xs text-fg-muted mt-1">{holdings.length} holding{holdings.length === 1 ? "" : "s"}</div>
        </div>
        <div className="stat-tile">
          <div className="label">Added this month</div>
          <div className="text-2xl font-semibold mt-1">{inr(totals.thisMonth)}</div>
          <div className="text-xs text-fg-muted mt-1">contributions in {todayLocal().slice(0, 7)}</div>
        </div>
        {anyValues ? (
          <>
            <div className="stat-tile">
              <div className="label">Current value</div>
              <div className="text-2xl font-semibold mt-1">{inr(totals.value)}</div>
              <div className="text-xs text-fg-muted mt-1">as last updated by you</div>
            </div>
            <div className="stat-tile">
              <div className="label">Unrealized P/L</div>
              <div className={`text-2xl font-semibold mt-1 ${totals.abs >= 0 ? "text-success" : "text-danger"}`}>
                {totals.abs >= 0 ? "+" : "−"}{inr(Math.abs(totals.abs))}
              </div>
              <div className={`text-xs mt-1 ${totals.abs >= 0 ? "text-success" : "text-danger"}`}>
                {totals.abs >= 0 ? "+" : "−"}{Math.abs(totals.pct).toFixed(2)}%
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="stat-tile">
              <div className="label">Asset types</div>
              <div className="text-2xl font-semibold mt-1">{new Set(holdings.map((h) => h.type)).size}</div>
            </div>
            <div className="stat-tile">
              <div className="label">Gains (optional)</div>
              <div className="text-sm font-medium mt-2 text-fg-muted leading-snug">Add current values anytime to see P/L — totally optional.</div>
            </div>
          </>
        )}
      </div>

      {showBulkValues && (
        <BulkValueEditor
          holdings={holdings}
          onCancel={() => setShowBulkValues(false)}
          onSave={(map, d) => {
            let next = holdings;
            Object.entries(map).forEach(([id, val]) => {
              if (val == null) return;
              const hh = holdings.find((x) => x.id === id);
              if (hh?.type === "real_estate") {
                next = updateHolding(id, { realEstate: { ...(hh.realEstate ?? {}), propertyValue: val }, currentValueDate: localDateToISO(d) });
              } else {
                next = updateHolding(id, { currentValue: val, currentValueDate: localDateToISO(d) });
              }
            });
            setHoldings(next);
            setShowBulkValues(false);
          }}
        />
      )}

      {/* Add holding */}
      {showAdd && (
        <div className="card-shell bg-gradient-to-br from-info/5 via-bg-elevated to-bg-elevated border-info/30">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <Icon.Sparkles className="text-info" />
              <div>
                <div className="font-semibold">Add a holding</div>
                <div className="text-xs text-fg-muted">Enter what you already hold — set the invested-so-far as the opening balance, and the current market value if you know it.</div>
              </div>
            </div>
          </div>
          <div className="card-body space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <div className="label mb-1">Holding name <span className="text-danger">*</span></div>
                <input className="input" placeholder="e.g. Large and Midcap Tracker / Reliance Industries" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </div>
              <div>
                <div className="label mb-1">Type <span className="text-danger">*</span></div>
                <select className="input" value={type} onChange={(e) => setType(e.target.value as InvestmentType)}>
                  {INVESTMENT_TYPES.map((t) => <option key={t.v} value={t.v}>{t.icon} {t.l}</option>)}
                </select>
              </div>

              {isRE ? (
                <>
                  <div>
                    <div className="label mb-1">Property value (₹)</div>
                    <input className="input" placeholder="e.g. 8000000" value={reValue} onChange={(e) => setReValue(e.target.value)} inputMode="numeric" />
                  </div>
                  <div>
                    <div className="label mb-1">Down payment (₹)</div>
                    <input className="input" placeholder="e.g. 1600000" value={reDown} onChange={(e) => setReDown(e.target.value)} inputMode="numeric" />
                  </div>
                  <div>
                    <div className="label mb-1">Loan amount (₹)</div>
                    <input className="input" placeholder="outstanding e.g. 6400000" value={reLoan} onChange={(e) => setReLoan(e.target.value)} inputMode="numeric" />
                  </div>
                  <div>
                    <div className="label mb-1">As of date</div>
                    <input type="date" className="input" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} />
                  </div>
                  <div>
                    <div className="label mb-1">Lender <span className="text-fg-muted text-[10px] normal-case">(optional)</span></div>
                    <input className="input" placeholder="e.g. HDFC, SBI" value={reLender} onChange={(e) => setReLender(e.target.value)} />
                  </div>
                  <div>
                    <div className="label mb-1">Interest % p.a. <span className="text-fg-muted text-[10px] normal-case">(optional)</span></div>
                    <input className="input" placeholder="e.g. 8.5" value={reRate} onChange={(e) => setReRate(e.target.value)} inputMode="numeric" />
                  </div>
                  <div>
                    <div className="label mb-1">EMI / month (₹) <span className="text-fg-muted text-[10px] normal-case">(optional)</span></div>
                    <input className="input" placeholder="e.g. 55000" value={reEmi} onChange={(e) => setReEmi(e.target.value)} inputMode="numeric" />
                  </div>
                  <div>
                    <div className="label mb-1">Tenure (years) <span className="text-fg-muted text-[10px] normal-case">(optional)</span></div>
                    <input className="input" placeholder="e.g. 20" value={reTenure} onChange={(e) => setReTenure(e.target.value)} inputMode="numeric" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div className="label mb-1">Invested so far (₹)</div>
                    <input className="input" placeholder="e.g. 50000" value={opening} onChange={(e) => setOpening(e.target.value)} inputMode="numeric" />
                  </div>
                  <div>
                    <div className="label mb-1">Current value (₹) <span className="text-fg-muted text-[10px] normal-case">(optional)</span></div>
                    <input className="input" placeholder="e.g. 58200" value={curVal} onChange={(e) => setCurVal(e.target.value)} inputMode="numeric" />
                  </div>
                  <div>
                    <div className="label mb-1">As of date</div>
                    <input type="date" className="input" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} />
                  </div>
                  <div>
                    <div className="label mb-1">Platform <span className="text-fg-muted text-[10px] normal-case">(optional)</span></div>
                    <input className="input" placeholder="e.g. Smallcase, Zerodha, Groww" value={platform} onChange={(e) => setPlatform(e.target.value)} />
                  </div>
                  <div>
                    <div className="label mb-1">Method (opening)</div>
                    <select className="input" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                      {PAYMENT_METHODS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
                    </select>
                  </div>
                </>
              )}

              <div className="sm:col-span-3">
                <div className="label mb-1">Notes</div>
                <input className="input" placeholder="Free text" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
            {isRE && (
              <div className="text-xs text-fg-muted">
                Down payment is tracked as your deployed equity; the loan is recorded as a liability. The analyzer shows <b>net equity = property value − outstanding loan</b>. Add future EMIs/prepayments later via “Add money”.
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-primary" onClick={onAddHolding} disabled={!name.trim()}>
                <Icon.Plus size={16} /> Add holding
              </button>
            </div>
          </div>
        </div>
      )}

      <Callout tone="info" title="Note on credit-card payments for investments">
        SEBI prohibits credit-card payment for direct stock / mutual fund investments. Pay via UPI or NEFT from your bank — some brokers allow CC for wallet top-up but charge ~1% that wipes any reward. <b>Always pay investments via UPI or NEFT.</b>
      </Callout>

      {/* Holdings */}
      <section>
        <h2 className="text-lg font-bold mb-3">Your holdings ({holdings.length})</h2>
        {holdings.length === 0 ? (
          <div className="card-shell p-8 text-center text-fg-muted">
            <Icon.Trophy className="mx-auto mb-2 opacity-50" size={32} />
            No holdings yet. Click <b>Add holding</b> to enter your existing portfolio.
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((h) => {
              const p = pnl(h);
              const isOpen = expanded === h.id;
              const contribs = [...(h.contributions ?? [])].sort((a, b) => b.date.localeCompare(a.date));
              return (
                <div key={h.id} className="card-shell">
                  <div className="p-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg">{typeIcon(h.type)}</span>
                        <span className="font-semibold truncate">{h.name}</span>
                        <span className="pill-neutral text-[10px] uppercase">{typeLabel(h.type)}</span>
                        {h.platform && <span className="text-xs text-fg-muted">· {h.platform}</span>}
                      </div>
                      <div className="text-xs text-fg-muted mt-1">
                        {h.type === "real_estate"
                          ? <>Down payment {inrExact(p.invested)}{(h.contributions ?? []).length > 1 ? ` + ${(h.contributions ?? []).length - 1} top-up(s)` : ""}</>
                          : <>Invested {inrExact(p.invested)} · {(h.contributions ?? []).length} contribution{(h.contributions ?? []).length === 1 ? "" : "s"}</>}
                        {p.hasValue && h.currentValueDate && <> · as of {new Date(h.currentValueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}</>}
                      </div>
                      {h.type === "real_estate" && h.realEstate && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
                          <span>Property <b>{inrExact(h.realEstate.propertyValue ?? 0)}</b></span>
                          <span className="text-danger">Loan {inrExact(h.realEstate.loanAmount ?? 0)}</span>
                          {h.realEstate.emi != null && <span>EMI {inrExact(h.realEstate.emi)}/mo</span>}
                          {h.realEstate.interestRate != null && <span>{h.realEstate.interestRate}% p.a.</span>}
                          {h.realEstate.tenureMonths != null && <span>{Math.round(h.realEstate.tenureMonths / 12)}y</span>}
                          {h.realEstate.lender && <span className="text-fg-muted">· {h.realEstate.lender}</span>}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xl font-bold">{inrExact(p.value)}</div>
                      <div className="text-[11px] text-fg-muted uppercase tracking-wide">{h.type === "real_estate" ? "net equity" : p.hasValue ? "current value" : "invested"}</div>
                      {p.hasValue && (
                        <div className={`text-xs font-medium ${p.abs >= 0 ? "text-success" : "text-danger"}`}>
                          {p.abs >= 0 ? "+" : "−"}{inrExact(Math.abs(p.abs))} ({p.abs >= 0 ? "+" : "−"}{Math.abs(p.pct).toFixed(2)}%)
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="px-4 pb-3 flex items-center gap-2 flex-wrap border-t border-border pt-3">
                    <button className="btn-secondary text-xs" onClick={() => { setAddMoneyFor(addMoneyFor === h.id ? null : h.id); setValueFor(null); }}>
                      <Icon.Plus size={14} /> Add money
                    </button>
                    <button className="btn-secondary text-xs" onClick={() => { setValueFor(valueFor === h.id ? null : h.id); setAddMoneyFor(null); }}>
                      Update value
                    </button>
                    <button className="btn-ghost text-xs" onClick={() => setExpanded(isOpen ? null : h.id)}>
                      {isOpen ? "Hide" : "Contributions"} {((h.contributions ?? []).length)}
                    </button>
                    <button className="btn-ghost text-xs text-danger ml-auto" onClick={() => { if (confirm(`Delete "${h.name}" and all its contributions?`)) setHoldings(deleteHolding(h.id)); }}>
                      Delete holding
                    </button>
                  </div>

                  {addMoneyFor === h.id && (
                    <AddMoneyRow
                      onCancel={() => setAddMoneyFor(null)}
                      onSubmit={(amount, d, m, note) => {
                        setHoldings(addContribution(h.id, { id: newId(), date: localDateToISO(d), amount, paymentMethod: m, note }));
                        setAddMoneyFor(null);
                      }}
                    />
                  )}

                  {valueFor === h.id && (
                    <UpdateValueRow
                      current={h.type === "real_estate" ? h.realEstate?.propertyValue : h.currentValue}
                      label={h.type === "real_estate" ? "Property value (₹)" : "Current value (₹)"}
                      onCancel={() => setValueFor(null)}
                      onSubmit={(val, d) => {
                        if (h.type === "real_estate") {
                          setHoldings(updateHolding(h.id, { realEstate: { ...(h.realEstate ?? {}), propertyValue: val }, currentValueDate: localDateToISO(d) }));
                        } else {
                          setHoldings(updateHolding(h.id, { currentValue: val, currentValueDate: localDateToISO(d) }));
                        }
                        setValueFor(null);
                      }}
                    />
                  )}

                  {isOpen && (
                    <div className="px-4 pb-4">
                      {contribs.length === 0 ? (
                        <div className="text-xs text-fg-muted py-2">No contributions logged. Use “Add money”.</div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="text-fg-muted text-[10px] uppercase tracking-wide">
                            <tr><th className="text-left py-1">Date</th><th className="text-left">Method</th><th className="text-left">Note</th><th className="text-right">Amount</th><th></th></tr>
                          </thead>
                          <tbody>
                            {contribs.map((c) => (
                              <tr key={c.id} className="border-t border-border/60">
                                <td className="py-1.5 text-fg-muted">{new Date(c.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}</td>
                                <td className="text-fg-muted text-xs uppercase">{c.paymentMethod ?? "—"}</td>
                                <td className="text-fg-muted">{c.note ?? "—"}</td>
                                <td className="text-right font-medium">{inrExact(c.amount)}</td>
                                <td className="text-right"><button className="btn-ghost text-[11px] text-danger" onClick={() => setHoldings(deleteContribution(h.id, c.id))}>Remove</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function AddMoneyRow({ onSubmit, onCancel }: { onSubmit: (amount: number, date: string, method: PaymentMethod, note?: string) => void; onCancel: () => void; }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => todayLocal());
  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [note, setNote] = useState("");
  const amt = Number((amount || "0").replace(/[^0-9.]/g, "")) || 0;
  return (
    <div className="px-4 pb-4 pt-1 bg-bg-chrome/40">
      <div className="text-xs text-fg-muted mb-2">Add a SIP / top-up to this holding:</div>
      <div className="grid sm:grid-cols-[1fr_1fr_1fr_1.4fr_auto] gap-2 items-end">
        <div><div className="label mb-1">Amount (₹)</div><input className="input" inputMode="numeric" placeholder="e.g. 5000" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div><div className="label mb-1">Date</div><input type="date" className="input" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} /></div>
        <div>
          <div className="label mb-1">Method</div>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
          </select>
        </div>
        <div><div className="label mb-1">Note</div><input className="input" placeholder="optional" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        <div className="flex gap-2">
          <button className="btn-primary" disabled={!amt} onClick={() => onSubmit(amt, date, method, note.trim() || undefined)}>Add</button>
          <button className="btn-secondary" onClick={onCancel}>×</button>
        </div>
      </div>
    </div>
  );
}

function BulkValueEditor({ holdings, onSave, onCancel }: { holdings: Holding[]; onSave: (map: Record<string, number | null>, date: string) => void; onCancel: () => void; }) {
  const [vals, setVals] = useState<Record<string, string>>(
    () => Object.fromEntries(holdings.map((h) => {
      const cur = h.type === "real_estate" ? h.realEstate?.propertyValue : h.currentValue;
      return [h.id, cur != null ? String(cur) : ""];
    }))
  );
  const [date, setDate] = useState(() => todayLocal());
  const parse = (s: string) => { const n = Number((s || "").replace(/[^0-9.]/g, "")); return s.trim() && !Number.isNaN(n) ? n : null; };
  return (
    <div className="card-shell bg-bg-chrome/30">
      <div className="card-header">
        <div>
          <div className="font-semibold">Update current values</div>
          <div className="text-xs text-fg-muted">Optional — glance at your broker apps and type the latest value for each holding. Leave blank to skip. Used only for P/L.</div>
        </div>
      </div>
      <div className="card-body space-y-3">
        <div className="flex items-center gap-2">
          <span className="label">As of</span>
          <input type="date" className="input max-w-[180px]" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          {holdings.map((h) => {
            const invested = holdingInvested(h);
            return (
              <div key={h.id} className="grid grid-cols-[1fr_auto] items-center gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{typeIcon(h.type)} {h.name}</div>
                  <div className="text-[11px] text-fg-muted">{h.type === "real_estate" ? "down payment" : "invested"} {inrExact(invested)}{h.platform ? ` · ${h.platform}` : ""}</div>
                </div>
                <input
                  className="input w-40"
                  inputMode="numeric"
                  placeholder={h.type === "real_estate" ? "property ₹" : "current ₹"}
                  value={vals[h.id] ?? ""}
                  onChange={(e) => setVals((m) => ({ ...m, [h.id]: e.target.value }))}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={() => onSave(Object.fromEntries(holdings.map((h) => [h.id, parse(vals[h.id] ?? "")])), date)}>
            Save values
          </button>
        </div>
      </div>
    </div>
  );
}

function UpdateValueRow({ current, label = "Current value (₹)", onSubmit, onCancel }: { current?: number; label?: string; onSubmit: (value: number, date: string) => void; onCancel: () => void; }) {
  const [val, setVal] = useState(current != null ? String(current) : "");
  const [date, setDate] = useState(() => todayLocal());
  const v = Number((val || "0").replace(/[^0-9.]/g, "")) || 0;
  return (
    <div className="px-4 pb-4 pt-1 bg-bg-chrome/40">
      <div className="text-xs text-fg-muted mb-2">Enter the latest value of this holding (for P/L):</div>
      <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
        <div><div className="label mb-1">{label}</div><input className="input" inputMode="numeric" placeholder="e.g. 58200" value={val} onChange={(e) => setVal(e.target.value)} /></div>
        <div><div className="label mb-1">As of date</div><input type="date" className="input" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="flex gap-2">
          <button className="btn-primary" disabled={!v} onClick={() => onSubmit(v, date)}>Save</button>
          <button className="btn-secondary" onClick={onCancel}>×</button>
        </div>
      </div>
    </div>
  );
}
