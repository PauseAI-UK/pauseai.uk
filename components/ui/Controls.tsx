import {
  Fragment,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import DatePicker from "./DatePicker";
import styles from "./Controls.module.css";

// Every form control on the site: a text box, a select, a text area, a file
// picker, a checkbox and a row of choices. Each has the orange focus ring,
// and its height and text size follow the density (styles/tokens.css). A
// label goes round or over it (Field.tsx).

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className">;

/** A text, email, search or time field. A day is a DatePicker. */
export function TextInput(props: InputProps) {
  return <input {...props} className={styles.control} />;
}

/**
 * Two days side by side, a dash between: from and to, each a DatePicker
 * with its own name and label, either of which can be left empty. Goes in
 * a FieldSet, which names the pair.
 */
export function DateRange({ from, to }: { from: DateProps; to: DateProps }) {
  return (
    <span className={styles.dateRange}>
      <DatePicker {...from} clearable />
      <span aria-hidden="true">–</span>
      <DatePicker {...to} clearable />
    </span>
  );
}

type DateProps = { name?: string; defaultValue?: string; "aria-label": string };

export function Select(props: Omit<SelectHTMLAttributes<HTMLSelectElement>, "className">) {
  return <select {...props} className={styles.control} />;
}

export function TextArea(props: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className">) {
  return <textarea {...props} className={`${styles.control} ${styles.textarea}`} />;
}

export function FileInput(props: Omit<InputProps, "type">) {
  return <input {...props} type="file" className={styles.file} />;
}

/**
 * A checkbox with its label beside it. Controlled: `onChange` gets whether
 * it's now ticked. A form sends `value` for it, ticked. `boxed`, the two sit
 * in a box of their own, lit in the accent colour while ticked, for a few
 * choices side by side that should stand out, such as a topic's ways on the
 * contact preferences page.
 */
export function Checkbox({
  id,
  name,
  value,
  checked,
  disabled,
  boxed = false,
  onChange,
  children,
}: {
  id?: string;
  name?: string;
  value?: string;
  checked: boolean;
  disabled?: boolean;
  boxed?: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className={boxed ? `${styles.checkboxLabel} ${styles.boxed}` : styles.checkboxLabel} htmlFor={id}>
      <input
        id={id}
        name={name}
        value={value}
        type="checkbox"
        className={styles.checkbox}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}

/**
 * A radio button, for a row whose own label holds it. `onChange` says it's
 * been chosen; `checked`, if given, says whether it is.
 */
export function Radio({
  name,
  value,
  checked,
  onChange,
}: {
  name: string;
  value: string | number;
  checked?: boolean;
  onChange: () => void;
}) {
  return <input type="radio" name={name} value={value} checked={checked} onChange={onChange} />;
}

/**
 * A row of buttons any of which can be on, as Segmented's look, with a
 * lighter `joiner` ("or") between each, e.g. the topics a broadcast goes
 * under. Each says whether it's pressed. `values` are those on; one change
 * gives them all, in the options' order. `min` of them stay on: the last
 * one on can't be turned off. `disabled`, none can be changed; `busy`,
 * a change is on its way, so clicks do nothing, but nothing looks
 * different, as a cursor that flickers to "not allowed" on each click would.
 */
export function Toggles<T extends string>({
  label,
  options,
  values,
  onChange,
  joiner,
  min = 0,
  disabled = false,
  busy = false,
}: {
  label: string;
  options: { value: T; label: string }[];
  values: T[];
  onChange: (values: T[]) => void;
  joiner: string;
  min?: number;
  disabled?: boolean;
  busy?: boolean;
}) {
  const toggle = (value: T) => {
    const on = values.includes(value);
    if (busy || (on && values.length <= min)) return;
    onChange(options.map((o) => o.value).filter((one) => (one === value ? !on : values.includes(one))));
  };
  return (
    <div className={styles.segmented} role="group" aria-label={label} aria-busy={busy || undefined}>
      {options.map((o, i) => (
        <Fragment key={o.value}>
          {i > 0 && (
            <span className={styles.joiner} aria-hidden="true">
              {joiner}
            </span>
          )}
          <button
            type="button"
            aria-pressed={values.includes(o.value)}
            className={styles.segment}
            disabled={disabled}
            onClick={() => toggle(o.value)}
          >
            {o.label}
          </button>
        </Fragment>
      ))}
    </div>
  );
}

/**
 * A row of mutually exclusive buttons, e.g. a QR code's size; each with an
 * icon before its words if it has one. One `quiet` is set apart from the
 * rest, dashed and grey, for a choice of nothing, such as no answer.
 * `disabled`, none can be picked; an option's own, just it. `busy`, a
 * pick is on its way, so clicks do nothing, but nothing looks different,
 * as a cursor that flickers to "not allowed" on each click would.
 */
export function Segmented<T extends string | boolean>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  busy = false,
}: {
  label: string;
  options: { value: T; label: string; icon?: ReactNode; quiet?: boolean; disabled?: boolean }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={label} aria-busy={busy || undefined}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.quiet ? `${styles.segment} ${styles.quiet}` : styles.segment}
          disabled={disabled || o.disabled}
          onClick={() => !busy && onChange(o.value)}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
