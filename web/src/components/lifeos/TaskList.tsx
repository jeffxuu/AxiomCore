import { Briefcase, CheckCircle2, CircleDollarSign, Dumbbell, HeartPulse, Languages } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Category, LifeOSDay, LifeOSTask } from "@/types";

const categoryIcons: Record<string, LucideIcon> = {
  career: Briefcase,
  job: Briefcase,
  english: Languages,
  learning: Languages,
  fitness: Dumbbell,
  health: HeartPulse,
  finance: CircleDollarSign,
};

function num(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function fmt(value: unknown): string {
  return String(Math.round(num(value)));
}

export function TaskList({
  categories,
  day,
  onPatch,
}: {
  categories: Category[];
  day: LifeOSDay;
  onPatch: (id: string, patch: Partial<LifeOSTask>) => void;
}) {
  return (
    <div className="space-y-5">
      {categories.map((category) => {
        const tasks = day.tasks.filter((task) => task.category_id === category.id);
        if (!tasks.length) return null;
        const done = tasks.filter((task) => Boolean(task.done)).length;
        const Icon = categoryIcons[category.id] ?? CheckCircle2;
        return (
          <section className="space-y-3" key={category.id}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Icon className="size-4" />
                </span>
                {category.name}
              </div>
              <span className="text-xs text-muted-foreground">{done}/{tasks.length}</span>
            </div>
            <Progress value={(done / Math.max(tasks.length, 1)) * 100} className="h-1.5" />
            <div className="space-y-2">
              {tasks.map((task) => (
                <label className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-xs" key={task.task_id}>
                  <input
                    type="checkbox"
                    checked={Boolean(task.done)}
                    onChange={(event) => onPatch(task.task_id, { done: event.target.checked })}
                    className="size-4 rounded border-border accent-slate-950 dark:accent-white"
                  />
                  <span className="min-w-0">
                    <span className={cn("block truncate text-sm font-medium", task.done && "text-muted-foreground line-through")}>{task.title}</span>
                    <small className="text-xs text-muted-foreground">目标 {fmt(task.target_value)} {task.unit}</small>
                  </span>
                  <Input
                    className="h-9 w-20 text-right"
                    type="number"
                    value={String(task.actual_value ?? 0)}
                    onChange={(event) => onPatch(task.task_id, { actual_value: num(event.target.value) })}
                    aria-label={`${task.title} 实际完成`}
                  />
                </label>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
