import { pct, inrExact, inr } from "@/lib/utils";

type Checkpoint = {
  value: number;
  label?: string;
  hit?: boolean;
};

type Props = {
  current: number;
  total: number;
  checkpoints?: Checkpoint[];
  tone?: "info" | "success" | "warning" | "danger";
  showLabels?: boolean;
};

export function CheckpointedProgress({ current, total, checkpoints = [], tone = "info", showLabels = true }: Props) {
  const fillClass =
    tone === "success" ? "bg-success" :
    tone === "warning" ? "bg-warning" :
    tone === "danger" ? "bg-danger" :
    "bg-accent";
  // If a checkpoint is explicitly marked hit, the bar should reach at least that
  // point (the milestone is ground-truth even if tracked spend lags). Avoids a
  // confusing gap between the fill and a green "hit" dot.
  const maxHitValue = checkpoints.reduce((mx, cp) => (cp.hit && cp.value > mx ? cp.value : mx), 0);
  const fillValue = Math.max(current, maxHitValue);
  const currentPct = pct(fillValue, total);

  return (
    <div className="space-y-2">
      <div className="relative h-2.5 rounded-full bg-bg-chrome overflow-visible">
        {/* Filled portion */}
        <div
          className={`absolute top-0 left-0 h-full rounded-full ${fillClass} transition-all duration-500`}
          style={{ width: `${currentPct}%` }}
        />
        {/* Checkpoints (vertical markers) */}
        {checkpoints.map((cp, i) => {
          const cpPct = pct(cp.value, total);
          const hit = cp.hit ?? current >= cp.value;
          return (
            <div
              key={i}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
              style={{ left: `${cpPct}%` }}
            >
              <div
                className={`w-3 h-3 rounded-full border-2 ${
                  hit ? "bg-success border-success" : "bg-bg-elevated border-border-strong"
                } shadow`}
              />
            </div>
          );
        })}
        {/* End marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-full"
          style={{ left: "100%" }}
        >
          <div className={`w-3 h-3 rounded-full border-2 ${
            current >= total ? "bg-success border-success" : "bg-bg-elevated border-border-strong"
          } shadow`} />
        </div>
      </div>

      {/* Checkpoint labels under bar */}
      {showLabels && checkpoints.length > 0 && (
        <div className="relative h-5 text-[10px] text-fg-muted">
          {checkpoints.map((cp, i) => {
            const cpPct = pct(cp.value, total);
            const hit = cp.hit ?? current >= cp.value;
            return (
              <div
                key={i}
                className="absolute -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${cpPct}%` }}
              >
                <span className={hit ? "text-success font-semibold" : ""}>{inr(cp.value)}</span>
              </div>
            );
          })}
          <div
            className="absolute -translate-x-full whitespace-nowrap"
            style={{ left: "100%" }}
          >
            <span className={current >= total ? "text-success font-semibold" : ""}>{inr(total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
