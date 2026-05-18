import type { ReactNode } from "react";

export function SectionHeader({
  title,
  eyebrow,
  action,
}: {
  title: ReactNode;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-header">
      <div>
        {eyebrow ? <span className="section-eyebrow">{eyebrow}</span> : null}
        <h2>{title}</h2>
      </div>
      {action ? <div className="section-action">{action}</div> : null}
    </div>
  );
}
