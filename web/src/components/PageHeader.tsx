import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow?: string;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header__main">
        <div>
          {eyebrow ? <span className="section-eyebrow">{eyebrow}</span> : null}
          <h1>{title}</h1>
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      {children ? <div>{children}</div> : null}
    </header>
  );
}
