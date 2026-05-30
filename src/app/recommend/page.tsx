"use client";

import { useState } from "react";
import { RecommendationWidget } from "@/components/RecommendationWidget";

export default function RecommendPage() {
  const [, setRefreshKey] = useState(0);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Recommend a route</h1>
        <p className="text-fg-muted mt-1">Tell us what you&apos;re buying + the amount. We compare every card, aggregator, gift-card and voucher route and pick the best.</p>
      </div>
      <RecommendationWidget onLogged={() => setRefreshKey((k) => k + 1)} />
    </div>
  );
}
