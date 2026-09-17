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
          <span className="text-fg">Book tickets</span> for a single hop with instant discounts and card stacks,{" "}
          <span className="text-fg">Get me there</span> for multi-leg routes to a deadline, and{" "}
          <span className="text-fg">Plan my days</span> for a day-by-day itinerary once you arrive.
        </p>
      </div>
      <TravelAssistant onLogged={() => setRefreshKey((k) => k + 1)} />
    </div>
  );
}
