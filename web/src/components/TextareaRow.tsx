import type { TextareaHTMLAttributes } from "react";

export function TextareaRow({
  label,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
}) {
  return (
    <label className={["field-row", "wide", className].filter(Boolean).join(" ")}>
      <span>{label}</span>
      <textarea className="field-input" {...props} />
    </label>
  );
}
