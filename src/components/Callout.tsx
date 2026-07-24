type Props = {
  tone?: "info" | "success" | "warning" | "danger" | "neutral";
  title?: string;
  children: React.ReactNode;
};
export function Callout({ tone = "info", title, children }: Props) {
  const cls =
    tone === "success" ? "border-success/40 bg-success-muted text-fg" :
    tone === "warning" ? "border-warning/40 bg-warning-muted text-fg" :
    tone === "danger" ? "border-danger/40 bg-danger-muted text-fg" :
    tone === "info" ? "border-info/40 bg-info-muted text-fg" :
    "border-border bg-bg-elevated text-fg";
  const titleColor =
    tone === "success" ? "text-success" :
    tone === "warning" ? "text-warning" :
    tone === "danger" ? "text-danger" :
    tone === "info" ? "text-info" :
    "text-fg";
  return (
    <div className={`border rounded-md p-3 ${cls}`}>
      {title ? <div className={`text-sm font-semibold mb-1 ${titleColor}`}>{title}</div> : null}
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}
