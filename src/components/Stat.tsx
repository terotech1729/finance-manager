type Props = {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
};
export function Stat({ label, value, hint, tone = "neutral" }: Props) {
  const valueColor =
    tone === "success" ? "text-success" :
    tone === "warning" ? "text-warning" :
    tone === "danger" ? "text-danger" :
    tone === "info" ? "text-info" :
    "text-fg";
  return (
    <div className="stat-tile">
      <div className="label">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${valueColor}`}>{value}</div>
      {hint ? <div className="text-xs text-fg-muted mt-1">{hint}</div> : null}
    </div>
  );
}
