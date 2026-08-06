import { NextResponse } from "next/server";
import { planJourney } from "@/lib/travel/journey/planJourney";
import type { JourneyPlanInput } from "@/lib/travel/journey/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as JourneyPlanInput;
    if (!body?.destination || !body?.arriveBy) {
      return NextResponse.json(
        { error: "destination and arriveBy (YYYY-MM-DDTHH:mm) are required" },
        { status: 400 }
      );
    }

    const result = await planJourney(
      {
        origin: body.origin || "Pune",
        destination: body.destination,
        arriveBy: body.arriveBy,
        adults: Math.max(1, Number(body.adults) || 1),
        prefs: body.prefs,
        today: body.today,
      },
      { travelpayoutsToken: process.env.TRAVELPAYOUTS_TOKEN }
    );

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Journey plan failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
