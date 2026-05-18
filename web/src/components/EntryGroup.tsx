import { ChevronDown, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EntryGroup({
  icon: Icon,
  title,
  open,
  onToggle,
  badge,
  children,
}: {
  icon: LucideIcon;
  title: string;
  open: boolean;
  onToggle: () => void;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <div className="entry-group">
      <button className="section-toggle" onClick={onToggle} type="button">
        <Icon size={17} />
        <span>{title}</span>
        {badge ? <em>{badge}</em> : null}
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {open ? children : null}
    </div>
  );
}
