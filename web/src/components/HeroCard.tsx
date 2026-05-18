import type { ReactNode } from "react";

export function HeroCard({
  eyebrow,
  title,
  children,
  actions,
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={["hero-card", "glass-surface", className].filter(Boolean).join(" ")}>
      <div>
        {eyebrow ? <span className="section-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {children}
      </div>
      {actions ? <div className="hero-card__actions">{actions}</div> : null}
    </section>
  );
}
