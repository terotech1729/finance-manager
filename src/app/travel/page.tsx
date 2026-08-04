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
          Flights, trains, buses — search like a booking site, then book the <span className="text-fg">lowest all-in</span> path
          after Instant Discount, Cashkaro, and your cards.
        </p>
      </div>
      <TravelAssistant onLogged={() => setRefreshKey((k) => k + 1)} />
    </div>
  );
}
