import { useState, useId } from "react";
import { C } from "../../lib/balanceSheet.js";

// Shared, accessible primitives for the Personal Balance Sheet.
// Rules held here so every section inherits them:
//  - every control has a real <label> tied by id
//  - scales are radio groups in a fieldset (screen readers announce position)
//  - meaning is never carried by colour alone — text always says it too
//  - touch targets are >= 44px

export const D = {
  bg: "#F0EDE5", bk: "#0A0A0A", muted: "#6B665C", faint: "#9B9589",
  border: "#E8E4DA", surf: "#FAFAF7", white: "#FFFFFF",
};

export const focusRing = {
  outline: "none",
  boxShadow: `0 0 0 3px rgba(29,53,87,0.35)`,
};

export function Label({ htmlFor, children, hint }) {
  return (
    <label htmlFor={htmlFor} style={{ display: "block", marginBottom: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: D.bk, letterSpacing: ".01em" }}>{children}</span>
      {hint && <span style={{ display: "block", fontSize: 11, color: D.muted, fontWeight: 400, marginTop: 2, lineHeight: 1.5 }}>{hint}</span>}
    </label>
  );
}

const baseField = {
  width: "100%", padding: "11px 12px", borderRadius: 8,
  border: `1px solid ${D.border}`, fontSize: 14, boxSizing: "border-box",
  background: D.white, color: D.bk, fontFamily: "inherit", minHeight: 44,
};

export function TextField({ label, hint, value, onChange, placeholder, type = "text", ...rest }) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <Label htmlFor={id} hint={hint}>{label}</Label>}
      <input
        id={id} type={type} value={value || ""} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ ...baseField, ...(focused ? focusRing : {}) }}
        {...rest}
      />
    </div>
  );
}

export function TextArea({ label, hint, value, onChange, placeholder, rows = 3 }) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <Label htmlFor={id} hint={hint}>{label}</Label>}
      <textarea
        id={id} value={value || ""} placeholder={placeholder} rows={rows}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ ...baseField, lineHeight: 1.6, resize: "vertical", ...(focused ? focusRing : {}) }}
      />
    </div>
  );
}

export function SelectField({ label, hint, value, onChange, options, placeholder = "Choose…" }) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <Label htmlFor={id} hint={hint}>{label}</Label>}
      <select
        id={id} value={value || ""} onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ ...baseField, ...(focused ? focusRing : {}) }}
      >
        <option value="">{placeholder}</option>
        {options.map(o => {
          const val = typeof o === "string" ? o : o.value;
          const lab = typeof o === "string" ? o : o.label;
          return <option key={val} value={val}>{lab}</option>;
        })}
      </select>
    </div>
  );
}

/**
 * Discrete 1..max scale as a radio group. Selected state is shown by colour,
 * a filled dot, AND the reading beneath — never colour alone.
 */
export function Scale({ label, hint, value, onChange, max = 5, accent = C.navy, lowLabel, highLabel }) {
  const name = useId();
  return (
    <fieldset style={{ border: "none", padding: 0, margin: "0 0 16px" }}>
      <legend style={{ padding: 0, marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: D.bk }}>{label}</span>
        {hint && <span style={{ display: "block", fontSize: 11, color: D.muted, fontWeight: 400, marginTop: 2, lineHeight: 1.5 }}>{hint}</span>}
      </legend>
      <div style={{ display: "flex", gap: 6 }}>
        {Array.from({ length: max }, (_, i) => i + 1).map(n => {
          const on = Number(value) === n;
          return (
            <label
              key={n}
              style={{
                flex: 1, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 700,
                background: on ? accent : D.white,
                color: on ? "#FFFFFF" : D.bk,
                border: `1px solid ${on ? accent : D.border}`,
              }}
            >
              <input
                type="radio" name={name} value={n} checked={on}
                onChange={() => onChange(n)}
                style={{ position: "absolute", opacity: 0, width: 1, height: 1 }}
              />
              <span aria-hidden="true">{on ? `● ${n}` : n}</span>
              <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                {n} of {max}
              </span>
            </label>
          );
        })}
      </div>
      {(lowLabel || highLabel) && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: D.muted }}>
          <span>{lowLabel}</span><span>{highLabel}</span>
        </div>
      )}
      <div aria-live="polite" style={{ fontSize: 11, color: D.muted, marginTop: 4 }}>
        {value ? `Selected: ${value} of ${max}` : "Not answered yet — you can skip this."}
      </div>
    </fieldset>
  );
}

/** Collapsible examples. Closed by default so the form stays uncluttered. */
export function Disclosure({ summary, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 12 }}>
      <button
        type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{
          background: "none", border: "none", padding: "6px 0", cursor: "pointer",
          fontSize: 11, fontWeight: 700, color: C.navy, textAlign: "left", minHeight: 32,
        }}
      >
        {open ? "▾" : "▸"} {summary}
      </button>
      {open && (
        <div style={{ fontSize: 12, color: D.muted, lineHeight: 1.65, padding: "6px 0 0 14px", borderLeft: `2px solid ${D.border}`, marginLeft: 2 }}>
          {children}
        </div>
      )}
    </div>
  );
}

export function Button({ children, onClick, variant = "primary", accent = C.navy, small, disabled, type = "button", full, ...rest }) {
  const styles = {
    primary: { background: disabled ? D.faint : accent, color: "#FFFFFF", border: `1px solid ${disabled ? D.faint : accent}` },
    secondary: { background: D.white, color: D.bk, border: `1px solid ${D.border}` },
    ghost: { background: "transparent", color: D.muted, border: "1px solid transparent" },
    danger: { background: D.white, color: C.red, border: `1px solid ${C.red}` },
  }[variant];
  return (
    <button
      type={type} onClick={onClick} disabled={disabled}
      style={{
        ...styles,
        padding: small ? "8px 12px" : "12px 18px",
        minHeight: small ? 36 : 44,
        width: full ? "100%" : undefined,
        borderRadius: 8, fontSize: small ? 11 : 12, fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        letterSpacing: ".02em", fontFamily: "inherit",
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Card({ children, accent, style = {} }) {
  return (
    <div style={{
      background: D.surf, border: `1px solid ${D.border}`,
      borderLeft: accent ? `3px solid ${accent}` : `1px solid ${D.border}`,
      borderRadius: 12, padding: 14, marginBottom: 12, ...style,
    }}>
      {children}
    </div>
  );
}

export function Callout({ children, accent = C.navy, title }) {
  return (
    <div style={{
      background: `${accent}12`, border: `1px solid ${accent}55`,
      borderRadius: 10, padding: 12, marginBottom: 16,
      fontSize: 12, color: D.bk, lineHeight: 1.65,
    }}>
      {title && <div style={{ fontWeight: 700, marginBottom: 4, color: accent }}>{title}</div>}
      {children}
    </div>
  );
}

/**
 * Add/remove list of sub-forms. `render` draws one entry; `blank` makes a new one.
 * Removal is confirmed inline so a mis-tap can't wipe a long answer.
 */
export function Repeater({ items, onChange, blank, render, addLabel, accent = C.navy, emptyHint, max }) {
  const [confirming, setConfirming] = useState(null);
  const atMax = max != null && items.length >= max;

  const update = (id, patch) => onChange(items.map(i => (i.id === id ? { ...i, ...patch } : i)));
  const remove = (id) => { onChange(items.filter(i => i.id !== id)); setConfirming(null); };

  return (
    <div>
      {items.length === 0 && emptyHint && (
        <p style={{ fontSize: 12, color: D.muted, lineHeight: 1.6, marginBottom: 12 }}>{emptyHint}</p>
      )}
      {items.map((item, idx) => (
        <Card key={item.id} accent={accent}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: D.muted, letterSpacing: ".08em" }}>
              #{idx + 1}
            </span>
            {confirming === item.id ? (
              <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: C.red }}>Remove this?</span>
                <Button small variant="danger" onClick={() => remove(item.id)}>Remove</Button>
                <Button small variant="ghost" onClick={() => setConfirming(null)}>Keep</Button>
              </span>
            ) : (
              <Button small variant="ghost" onClick={() => setConfirming(item.id)}
                aria-label={`Remove entry ${idx + 1}`}>Remove</Button>
            )}
          </div>
          {render(item, (patch) => update(item.id, patch))}
        </Card>
      ))}
      <Button
        variant="secondary" full disabled={atMax}
        onClick={() => onChange([...items, blank()])}
      >
        {atMax ? `Limit reached (${max})` : `+ ${addLabel}`}
      </Button>
    </div>
  );
}

/** Section wrapper: heading, explanation, and consistent spacing. */
export function SectionShell({ title, accent, intro, children }) {
  return (
    <section aria-label={title}>
      <h2 style={{ fontSize: 19, fontWeight: 800, color: D.bk, margin: "0 0 4px" }}>{title}</h2>
      <div style={{ height: 3, width: 40, background: accent, borderRadius: 2, marginBottom: 12 }} />
      {intro && <p style={{ fontSize: 13, color: D.muted, lineHeight: 1.7, marginBottom: 16 }}>{intro}</p>}
      {children}
    </section>
  );
}
