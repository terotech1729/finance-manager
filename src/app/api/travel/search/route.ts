import { NextResponse } from "next/server";
import { discoverFares } from "@/lib/travel/fareDiscover";
import type { TravelTripInput } from "@/lib/travel/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TravelTripInput;
    if (!body?.mode || !body?.origin || !body?.destination || !body?.date) {
      return NextResponse.json({ error: "mode, origin, destination, and date are required" }, { status: 400 });
    }
    if (!body.adults || body.adults < 1) {
      return NextResponse.json({ error: "at least 1 adult required" }, { status: 400 });
    }

    const result = await discoverFares(
      {
        ...body,
        adults: Math.max(1, Number(body.adults) || 1),
        children: Math.max(0, Number(body.children) || 0),
      },
      { travelpayoutsToken: process.env.TRAVELPAYOUTS_TOKEN }
    );

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Search failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
