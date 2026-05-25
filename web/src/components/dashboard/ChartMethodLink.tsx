import { BookOpenText } from "lucide-react";
import { useT } from "@/lib/i18nConfig";

export function ChartMethodLink({ onOpen }: { onOpen?: () => void }) {
  const t = useT();
  if (!onOpen) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--ax-border)] px-2 py-1 text-[10.5px] font-medium transition-colors hover:border-[var(--ax-border-strong)] hover:bg-[var(--ax-hover)]"
      style={{ color: "var(--ax-muted)" }}
    >
      <BookOpenText className="size-3" />
      {t("dashboard.chart.method")}
    </button>
  );
}
