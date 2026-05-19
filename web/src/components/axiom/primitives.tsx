import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Panel — minimal surface with a hairline border and tight header. Linear-ish.
 */
export function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
  contentClassName,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section className={cn("ax-card overflow-hidden", className)}>
      {title || actions ? (
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            {title ? <h2 className="text-[13px] font-semibold tracking-tight">{title}</h2> : null}
            {subtitle ? <p className="mt-0.5 text-[12px] text-muted-foreground">{subtitle}</p> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn("p-5", contentClassName)}>{children}</div>
    </section>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        {eyebrow ? <p className="ax-eyebrow">{eyebrow}</p> : null}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
        {description ? <p className="max-w-2xl text-[13px] leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyHint({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function StatusDot({ tone }: { tone: "positive" | "warning" | "danger" | "info" | "neutral" }) {
  const cls = {
    positive: "bg-[var(--positive)]",
    warning: "bg-[var(--warning)]",
    danger: "bg-[var(--danger)]",
    info: "bg-[var(--info)]",
    neutral: "bg-muted-foreground",
  }[tone];
  return <span className={cn("inline-block size-1.5 rounded-full", cls)} />;
}

export function formatCNY(value: number, options?: { signed?: boolean; compact?: boolean }): string {
  const sign = options?.signed && value > 0 ? "+" : "";
  if (options?.compact && Math.abs(value) >= 1000) {
    const v = value / 1000;
    return `${sign}${v.toFixed(v % 1 === 0 ? 0 : 1)}k`;
  }
  const fixed = Math.abs(value) >= 100 ? 0 : 2;
  return `${sign}${value.toLocaleString("en-US", { minimumFractionDigits: fixed, maximumFractionDigits: fixed })}`;
}

export function netTone(value: number): "positive" | "danger" | "neutral" {
  if (value > 0) return "positive";
  if (value < 0) return "danger";
  return "neutral";
}
