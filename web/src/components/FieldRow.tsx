import type { InputHTMLAttributes } from "react";

export function FieldRow({
  label,
  unit,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  unit?: string;
}) {
  return (
    <label className={["field-row", className].filter(Boolean).join(" ")}>
      <span>
        {label}
        {unit ? <small>{unit}</small> : null}
      </span>
      <input className="field-input" {...props} />
    </label>
  );
}
