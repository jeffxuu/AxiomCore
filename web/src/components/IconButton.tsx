import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonVariant = "secondary" | "ghost" | "danger";

export function IconButton({
  children,
  variant = "secondary",
  className = "",
  label,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: IconButtonVariant;
  label: string;
}) {
  const classes = ["icon-button", `icon-button--${variant}`, className].filter(Boolean).join(" ");

  return (
    <button className={classes} type="button" aria-label={label} title={label} {...props}>
      {children}
    </button>
  );
}
