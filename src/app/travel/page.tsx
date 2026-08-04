"use client";

import { useState } from "react";
import { TravelAssistant } from "@/components/TravelAssistant";

export default function TravelPage() {
  const [, setRefreshKey] = useState(0);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Travel</h1>
        <p className="text-fg-muted mt-1">
          Flights, trains, and buses — rank <b className="text-fg">platform + Instant Discount + card / Cashkaro</b> for the
          lowest all-in cost (better than cheapest sticker fare alone). Paste fares you see; we chain the optimal spend
          route.
        </p>
      </div>
      <TravelAssistant onLogged={() => setRefreshKey((k) => k + 1)} />
    </div>
  );
}
