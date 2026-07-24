"use client";

import { useState } from "react";
import { RecommendationWidget } from "@/components/RecommendationWidget";

export default function RecommendPage() {
  const [, setRefreshKey] = useState(0);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Recommend &amp; log a spend</h1>
        <p className="text-fg-muted mt-1">Enter what you&apos;re buying + the amount → we compare every card, aggregator, gift-card and voucher route and pick the best. Then hit <b className="text-fg">&ldquo;Log this expense&rdquo;</b> to record it in your Transactions.</p>
      </div>
      <RecommendationWidget onLogged={() => setRefreshKey((k) => k + 1)} />
    </div>
  );
}
