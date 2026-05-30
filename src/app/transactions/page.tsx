"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { deleteTransaction, loadTransactions } from "@/lib/storage";
import { getCardById } from "@/lib/cards";
import { inr, inrExact } from "@/lib/utils";
import type { Transaction } from "@/lib/types";
import { Icon } from "@/components/Icons";

export default function TransactionsPage() {
  const [txns, setTxns] = useState<Transaction[]>([]);

  useEffect(() => { setTxns(loadTransactions()); }, []);

  const onDelete = (id: string) => setTxns(deleteTransaction(id));

  const totalSpent = txns.reduce((acc, t) => acc + t.amount, 0);
  const totalReward = txns.reduce((acc, t) => acc + t.rewardInr, 0);
  const effectiveRate = totalSpent > 0 ? (totalReward / totalSpent) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-fg-muted mt-1">Your logged spend history. To log a new one, use Recommend.</p>
        </div>
        <Link href="/recommend" className="btn-primary"><Icon.Zap size={16} /> Recommend a route</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="stat-tile">
          <div className="label">Total spent</div>
          <div className="text-xl font-semibold mt-1">{inr(totalSpent)}</div>
        </div>
        <div className="stat-tile">
          <div className="label">Total rewards earned</div>
          <div className="text-xl font-semibold mt-1 text-success">{inr(totalReward)}</div>
        </div>
        <div className="stat-tile col-span-2 md:col-span-1">
          <div className="label">Effective return</div>
          <div className="text-xl font-semibold mt-1">{effectiveRate.toFixed(2)}%</div>
        </div>
      </div>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-xl font-bold">Transaction log ({txns.length})</h2>
          <div className="text-xs text-fg-muted">Stored locally in your browser</div>
        </div>
        {txns.length === 0 ? (
          <div className="card-shell p-8 text-center text-fg-muted">
            <Icon.Transaction className="mx-auto mb-2 opacity-50" size={32} />
            No transactions logged yet. Use the form above to log your first spend.
          </div>
        ) : (
          <div className="card-shell">
            <table className="w-full text-sm">
              <thead className="text-fg-muted text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left">Merchant</th>
                  <th className="text-left">Category</th>
                  <th className="text-right">Amount</th>
                  <th className="text-left">Card</th>
                  <th className="text-left">Path</th>
                  <th className="text-right">Reward</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {txns.slice(0, 100).map((t) => {
                  const card = getCardById(t.cardId);
                  return (
                    <tr key={t.id} className="table-row">
                      <td className="p-3 text-fg-muted">{new Date(t.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</td>
                      <td className="font-medium">{t.merchant}</td>
                      <td className="text-fg-muted">{t.category}</td>
                      <td className="text-right">{inrExact(t.amount)}</td>
                      <td><span className="pill-info">{card?.short ?? t.cardId}</span></td>
                      <td><span className="pill-neutral text-xs">{t.path}</span></td>
                      <td className="text-right text-success">{inrExact(t.rewardInr)} <span className="text-xs text-fg-muted">({t.effectivePct.toFixed(1)}%)</span></td>
                      <td className="p-3"><button className="btn-ghost text-xs" onClick={() => onDelete(t.id)}>Delete</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
