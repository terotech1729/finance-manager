import { getSupabase } from "./supabase";
import { hydrateCardOverlay, type CardPatch } from "./cardOverlay";

/**
 * Pulls accepted card-term patches from Supabase and installs them over the compiled
 * catalogue. Awaited during boot, before the first data page renders.
 *
 * Deliberately forgiving: a missing table, an offline device or an empty result all
 * leave the compiled catalogue in place. The overlay is an improvement on the baseline,
 * never a prerequisite for the app working.
 */
export async function hydrateOverlayFromCloud(): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 0;
  try {
    const { data, error } = await sb.from("card_overlay").select("card_id,patch");
    if (error || !Array.isArray(data)) return 0;

    const patches: Record<string, CardPatch> = {};
    for (const row of data as { card_id: string; patch: CardPatch }[]) {
      if (row?.card_id && row.patch && typeof row.patch === "object") {
        patches[row.card_id] = row.patch;
      }
    }
    hydrateCardOverlay(patches);
    return Object.keys(patches).length;
  } catch {
    return 0;
  }
}
