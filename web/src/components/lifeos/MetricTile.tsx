import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const toneClass = {
  slate: "bg-slate-950 text-white dark:bg-white dark:text-slate-950",
  blue: "bg-blue-600 text-white",
  emerald: "bg-emerald-600 text-white",
  amber: "bg-amber-500 text-white",
  rose: "bg-rose-600 text-white",
};

export function MetricTile({
  label,
  value,
  detail,
  icon: Icon,
  tone = "slate",
  featured = false,
}: {
  label: string;
  value: string;
  detail?: string;
  icon: LucideIcon;
  tone?: keyof typeof toneClass;
  featured?: boolean;
}) {
  return (
    <Card className={cn("shadow-sm", featured ? "min-h-32 sm:min-h-36" : "min-h-28")} size={featured ? "default" : "sm"}>
      <CardContent className={cn("flex h-full flex-col justify-between", featured ? "gap-4 p-4 sm:gap-5 sm:p-5" : "gap-3 p-4")}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", toneClass[tone])}>
            <Icon className="size-4" />
          </span>
        </div>
        <div>
          <strong className={cn("block font-semibold tracking-tight", featured ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl")}>{value}</strong>
          {detail ? <span className="mt-1 block text-xs text-muted-foreground">{detail}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}
