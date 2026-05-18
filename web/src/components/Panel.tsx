import type { HTMLAttributes, ReactNode } from "react";

export function Panel({
  children,
  className = "",
  as: Tag = "section",
  ...props
}: HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  as?: "section" | "article" | "div" | "aside";
}) {
  return (
    <Tag className={["panel", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </Tag>
  );
}

export function SubCard({
  children,
  className = "",
  as: Tag = "div",
  ...props
}: HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  as?: "section" | "article" | "div";
}) {
  return (
    <Tag className={["sub-card", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </Tag>
  );
}
