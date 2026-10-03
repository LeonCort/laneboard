import { useId, useState, type ReactNode } from "react";
export function Field({
  label,
  value,
  onChange,
  multiline = false,
  disabled = false,
  hint,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  multiline?: boolean;
  disabled?: boolean;
  hint?: string;
  type?: string;
}) {
  const id = useId();
  const [numberDraft, setNumberDraft] = useState<string | null>(null);
  return (
    <div className="lb-field">
      <label htmlFor={id} className="lb-field__label">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          className="lb-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      ) : (
        <input
          id={id}
          className="lb-input"
          type={type}
          value={
            type === "number" && numberDraft !== null ? numberDraft : value
          }
          onFocus={() => {
            if (type === "number") setNumberDraft(String(value));
          }}
          onChange={(e) => {
            if (type === "number") setNumberDraft(e.target.value);
            else onChange(e.target.value);
          }}
          onBlur={(e) => {
            if (type !== "number") return;
            if (
              e.target.value.trim() &&
              Number.isFinite(Number(e.target.value))
            )
              onChange(e.target.value);
            setNumberDraft(null);
          }}
          onKeyDown={(e) => {
            if (type !== "number") return;
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            } else if (e.key === "Escape") {
              e.stopPropagation();
              e.currentTarget.value = String(value);
              e.currentTarget.blur();
            }
          }}
          disabled={disabled}
        />
      )}{" "}
      {hint ? <span className="lb-field__hint">{hint}</span> : null}
    </div>
  );
}
export function Select({
  label,
  value,
  onChange,
  children,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="lb-field">
      <label htmlFor={id} className="lb-field__label">
        {label}
      </label>
      <select
        id={id}
        className="lb-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {children}
      </select>
    </div>
  );
}
export function Check({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="lb-check">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      {label}
    </label>
  );
}
