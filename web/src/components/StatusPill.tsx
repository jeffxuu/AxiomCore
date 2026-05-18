import type { ReactNode } from "react";

type StatusTone = "neutral" | "primary" | "success" | "warning" | "danger";

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: StatusTone;
}) {
  return <span className={`status-pill status-pill--${tone}`}>{children}</span>;
}
