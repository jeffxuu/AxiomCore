import { Briefcase, CheckCircle2, CircleDollarSign, Dumbbell, HeartPulse, Languages } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Category, LifeOSDay, LifeOSTask } from "../types";

const categoryIcons: Record<string, LucideIcon> = {
  career: Briefcase,
  english: Languages,
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
    <div className="task-stack">
      {categories.map((category) => {
        const tasks = day.tasks.filter((task) => task.category_id === category.id);
        if (!tasks.length) return null;
        const Icon = categoryIcons[category.id] ?? CheckCircle2;
        return (
          <div className="task-group" key={category.id}>
            <div className="task-group-title">
              <Icon size={14} />
              {category.name}
            </div>
            {tasks.map((task) => (
              <label className="task-row" key={task.task_id}>
                <input type="checkbox" checked={Boolean(task.done)} onChange={(event) => onPatch(task.task_id, { done: event.target.checked })} />
                <span className={task.done ? "done" : ""}>{task.title}</span>
                <small>目标 {fmt(task.target_value)} {task.unit}</small>
                <input
                  className="task-num"
                  type="number"
                  value={String(task.actual_value ?? 0)}
                  onChange={(event) => onPatch(task.task_id, { actual_value: num(event.target.value) })}
                  aria-label={`${task.title} 实际完成`}
                />
              </label>
            ))}
          </div>
        );
      })}
    </div>
  );
}
