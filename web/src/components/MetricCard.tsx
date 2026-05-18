import type { LucideIcon } from "lucide-react";

export function MetricCard({
  icon: Icon,
  label,
  value,
  tone = "primary",
  priority = "secondary",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: "primary" | "success" | "warning" | "danger" | "blue" | "green" | "orange" | "red";
  priority?: "primary" | "secondary";
}) {
  return (
    <article className={`metric-card metric-card--${priority} tone-${tone}`}>
      <Icon size={18} />
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}
