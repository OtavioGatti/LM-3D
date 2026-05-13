import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes
} from "react";

type FieldBaseProps = {
  className?: string;
  error?: ReactNode;
  hint?: ReactNode;
  id?: string;
  label: ReactNode;
};

function fieldClassName(className: string | undefined) {
  return className ? `form-field ${className}` : "form-field";
}

function describedBy(id: string, hint: ReactNode, error: ReactNode) {
  return [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ") || undefined;
}

type TextFieldProps = FieldBaseProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "id">;

export function TextField({ className, error, hint, id, label, ...inputProps }: TextFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <label className={fieldClassName(className)} htmlFor={fieldId}>
      <span className="form-label-text">{label}</span>
      <input
        {...inputProps}
        aria-describedby={describedBy(fieldId, hint, error)}
        aria-invalid={error ? true : undefined}
        id={fieldId}
      />
      {hint ? (
        <small className="field-hint" id={`${fieldId}-hint`}>
          {hint}
        </small>
      ) : null}
      {error ? (
        <small className="field-error" id={`${fieldId}-error`}>
          {error}
        </small>
      ) : null}
    </label>
  );
}

type TextareaFieldProps = FieldBaseProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className" | "id">;

export function TextareaField({
  className,
  error,
  hint,
  id,
  label,
  ...textareaProps
}: TextareaFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <label className={fieldClassName(className)} htmlFor={fieldId}>
      <span className="form-label-text">{label}</span>
      <textarea
        {...textareaProps}
        aria-describedby={describedBy(fieldId, hint, error)}
        aria-invalid={error ? true : undefined}
        id={fieldId}
      />
      {hint ? (
        <small className="field-hint" id={`${fieldId}-hint`}>
          {hint}
        </small>
      ) : null}
      {error ? (
        <small className="field-error" id={`${fieldId}-error`}>
          {error}
        </small>
      ) : null}
    </label>
  );
}

type SelectFieldProps = FieldBaseProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "className" | "id">;

export function SelectField({ className, error, hint, id, label, ...selectProps }: SelectFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <label className={fieldClassName(className)} htmlFor={fieldId}>
      <span className="form-label-text">{label}</span>
      <select
        {...selectProps}
        aria-describedby={describedBy(fieldId, hint, error)}
        aria-invalid={error ? true : undefined}
        id={fieldId}
      />
      {hint ? (
        <small className="field-hint" id={`${fieldId}-hint`}>
          {hint}
        </small>
      ) : null}
      {error ? (
        <small className="field-error" id={`${fieldId}-error`}>
          {error}
        </small>
      ) : null}
    </label>
  );
}
