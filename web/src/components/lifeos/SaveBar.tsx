import { RefreshCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SaveBar({
  date,
  status,
  saving,
  onDateChange,
  onRefresh,
  onSave,
}: {
  date: string;
  status: string;
  saving: boolean;
  onDateChange: (date: string) => void;
  onRefresh: () => void;
  onSave: () => void;
}) {
  return (
    <section className="sticky top-[4.5rem] z-30 rounded-2xl border border-border/80 bg-background/88 p-2 shadow-sm backdrop-blur-xl">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-[auto_1fr] items-center gap-2 sm:flex">
          <Label className="text-xs text-muted-foreground" htmlFor="lifeos-date">日期</Label>
          <Input
            id="lifeos-date"
            type="date"
            value={date}
            onChange={(event) => onDateChange(event.target.value)}
            className="h-10 min-w-0 sm:w-40"
          />
          <p className="col-span-2 truncate px-1 text-xs text-muted-foreground sm:col-span-1">{status}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon" onClick={onRefresh} aria-label="刷新">
            <RefreshCcw className="size-4" />
          </Button>
          <Button type="button" onClick={onSave} disabled={saving} className="min-w-32">
            <Save className="size-4" />
            {saving ? "保存中" : "保存今日记录"}
          </Button>
        </div>
      </div>
    </section>
  );
}
