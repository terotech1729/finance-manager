import { pct } from "@/lib/utils";

type Props = {
  value: number;
  total: number;
  tone?: "info" | "success" | "warning" | "danger";
};
export function ProgressBar({ value, total, tone = "info" }: Props) {
  const fillClass =
    tone === "success" ? "bar-fill bar-fill-success" :
    tone === "warning" ? "bar-fill bar-fill-warning" :
    tone === "danger" ? "bar-fill bar-fill-danger" :
    "bar-fill";
  return (
    <div className="bar w-full">
      <div className={fillClass} style={{ width: `${pct(value, total)}%` }} />
    </div>
  );
}
