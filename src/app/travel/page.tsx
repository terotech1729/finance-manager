"use client";

import { useState } from "react";
import { TravelAssistant } from "@/components/TravelAssistant";

export default function TravelPage() {
  const [, setRefreshKey] = useState(0);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Travel</h1>
        <p className="page-sub">
          Book a single mode with Instant Discount + card stacks, or use{" "}
          <span className="text-fg">Reach by</span> for multi-leg route trees (via Mumbai hubs, sleep-friendly
          timing, cost vs time).
        </p>
      </div>
      <TravelAssistant onLogged={() => setRefreshKey((k) => k + 1)} />
    </div>
  );
}
