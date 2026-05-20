import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function InsightCard({
  title,
  subtitle,
  badge,
  alert,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  alert?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-xl border bg-[#FFFFFF] shadow-sm transition-colors",
        "dark:bg-[#111B2D]",
        alert
          ? "border-[#E11D48]/50 dark:border-[#F43F5E]/55 ring-1 ring-[#E11D48]/10 dark:ring-[#F43F5E]/15"
          : "border-[#E2E8F0] dark:border-[#1E293B]",
        className
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] px-5 py-3.5 dark:border-[#1E293B]">
        <div className="min-w-0">
          <h2
            className={cn(
              "font-sans text-[13px] font-semibold leading-tight tracking-tight",
              alert ? "text-[#E11D48] dark:text-[#F43F5E]" : "text-[#0F172A] dark:text-[#F8FAFC]"
            )}
          >
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 font-sans text-[11px] leading-snug tracking-tight text-[#64748B] dark:text-[#94A3B8]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function EmptyCanvas({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[260px] items-center justify-center rounded-md border border-dashed border-[#CBD5E1] bg-[#F8FAFC] dark:border-[#1E293B] dark:bg-[#0B1220]/60">
      <p className="font-sans text-[11px] tracking-tight text-[#94A3B8] dark:text-[#475569]">{label}</p>
    </div>
  );
}
