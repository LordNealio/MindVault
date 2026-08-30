import { useState, useId } from "react";
import { C } from "../../lib/balanceSheet.js";

// Shared, accessible primitives for the Personal Balance Sheet.
//
// These deliberately borrow MindVault's existing visual language rather than
// inventing one: Unbounded for headings and micro-labels with wide tracking,
// soft 18px cards on the cream ground, inset fields. The balance-sheet accents
// (navy/green/red/blue/amber) are used only as thin markers on top of it.
//
// Accessibility rules held here so every section inherits them:
//  - every control has a real <label> tied by id
//  - scales are radio groups in a fieldset (screen readers announce position)
//  - meaning is never carried by colour alone — text always says it too
//  - touch targets are >= 44px

export const D = {
  bg: "#F0EDE5", bk: "#0A0A0A", muted: "#6B665C", faint: "#9B9589",
  border: "#E8E4DA", surf: "#FAFAF7", white: "#FFFFFF",
};

export const HEAD = "'Unbounded', monospace";
const SHADOW = "0 2px 12px rgba(0,0,0,0.06)";

export const focusRing = { outline: "none", boxShadow: "0 0 0 3px rgba(29,53,87,0.32)" };

/** The app's small all-caps marker. */
export function Kicker({ children, color = C.navy, style = {} }) {
  return (
    <div style={{
      fontFamily: HEAD, fontSize: 8, fontWeight: 700,
      letterSpacing: ".14em", textTransform: "uppercase", color, ...style,
    }}>
      {children}
    </div>
  );
}

export function Label({ htmlFor, children, hint }) {
  return (
    <label htmlFor={htmlFor} style={{ display: "block", marginBottom: 7 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: D.bk, lineHeight: 1.45 }}>{children}</span>
      {hint && <span style={{ display: "block", fontSize: 11, color: D.muted, fontWeight: 400, marginTop: 3, lineHeight: 1.55 }}>{hint}</span>}
    </label>
  );
}

// Inset field on the cream ground — the pattern used across the app's forms.
const baseField = {
  width: "100%", padding: "11px 13px", borderRadius: 11,
  border: `1.5px solid ${D.border}`, fontSize: 14, boxSizing: "border-box",
  background: D.bg, color: D.bk, fontFamily: "inherit", minHeight: 44,
};

export function TextField({ label, hint, value, onChange, placeholder, type = "text", ...rest }) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <Label htmlFor={id} hint={hint}>{label}</Label>}
      <input
        id={id} type={type} value={value || ""} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ ...baseField, background: focused ? D.white : D.bg, ...(focused ? focusRing : {}) }}
        {...rest}
      />
    </div>
  );
}

export function TextArea({ label, hint, value, onChange, placeholder, rows = 3 }) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <Label htmlFor={id} hint={hint}>{label}</Label>}
      <textarea
        id={id} value={value || ""} placeholder={placeholder} rows={rows}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          ...baseField, lineHeight: 1.7, resize: "vertical",
          background: focused ? D.white : D.bg, ...(focused ? focusRing : {}),
        }}
      />
    </div>
  );
}

export function SelectField({ label, hint, value, onChange, options, placeholder = "Choose…" }) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <Label htmlFor={id} hint={hint}>{label}</Label>}
      <select
        id={id} value={value || ""} onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ ...baseField, background: focused ? D.white : D.bg, ...(focused ? focusRing : {}) }}
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
    <fieldset style={{ border: "none", padding: 0, margin: "0 0 18px" }}>
      <legend style={{ padding: 0, marginBottom: 7 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: D.bk }}>{label}</span>
        {hint && <span style={{ display: "block", fontSize: 11, color: D.muted, fontWeight: 400, marginTop: 3, lineHeight: 1.55 }}>{hint}</span>}
      </legend>
      <div style={{ display: "flex", gap: 7 }}>
        {Array.from({ length: max }, (_, i) => i + 1).map(n => {
          const on = Number(value) === n;
          return (
            <label
              key={n}
              style={{
                flex: 1, minHeight: 46, display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 12, cursor: "pointer", position: "relative",
                fontFamily: HEAD, fontSize: 12, fontWeight: 700,
                background: on ? accent : D.bg,
                color: on ? "#FFFFFF" : D.muted,
                border: `1.5px solid ${on ? accent : D.border}`,
                transition: "background .15s, color .15s",
              }}
            >
              <input
                type="radio" name={name} value={n} checked={on}
                onChange={() => onChange(n)}
                style={{ position: "absolute", opacity: 0, width: 1, height: 1 }}
              />
              <span aria-hidden="true">{n}</span>
              <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                {n} of {max}
              </span>
            </label>
          );
        })}
      </div>
      {(lowLabel || highLabel) && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: D.faint }}>
          <span>{lowLabel}</span><span>{highLabel}</span>
        </div>
      )}
      <div aria-live="polite" style={{ fontSize: 11, color: value ? D.muted : D.faint, marginTop: 5 }}>
        {value ? `Selected: ${value} of ${max}` : "Not answered — you can skip this."}
      </div>
    </fieldset>
  );
}

/** Collapsible examples. Closed by default so the form stays uncluttered. */
export function Disclosure({ summary, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      <button
        type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{
          background: "none", border: "none", padding: "6px 0", cursor: "pointer",
          fontFamily: HEAD, fontSize: 9, fontWeight: 700, letterSpacing: ".1em",
          textTransform: "uppercase", color: C.navy, textAlign: "left", minHeight: 34,
        }}
      >
        {open ? "▾" : "▸"} {summary}
      </button>
      {open && (
        <div style={{ fontSize: 12, color: D.muted, lineHeight: 1.7, padding: "4px 0 0 14px", borderLeft: `2px solid ${D.border}`, marginLeft: 2 }}>
          {children}
        </div>
      )}
    </div>
  );
}

export function Button({ children, onClick, variant = "primary", accent = C.navy, small, disabled, type = "button", full, style = {}, ...rest }) {
  const styles = {
    primary: { background: disabled ? D.border : accent, color: disabled ? D.faint : "#FFFFFF", border: `1.5px solid ${disabled ? D.border : accent}` },
    secondary: { background: D.white, color: D.bk, border: `1.5px solid ${D.bk}` },
    ghost: { background: "transparent", color: D.muted, border: "1.5px solid transparent" },
    danger: { background: D.white, color: C.red, border: `1.5px solid ${C.red}` },
  }[variant];
  return (
    <button
      type={type} onClick={onClick} disabled={disabled}
      style={{
        ...styles,
        padding: small ? "9px 13px" : "13px 18px",
        minHeight: small ? 38 : 46,
        width: full ? "100%" : undefined,
        borderRadius: 12, fontFamily: HEAD,
        fontSize: small ? 9 : 10, fontWeight: 700, letterSpacing: ".1em",
        textTransform: "uppercase",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "opacity .15s", ...style,
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
      borderRadius: 18, padding: 16, marginBottom: 14,
      boxShadow: SHADOW, ...style,
    }}>
      {children}
    </div>
  );
}

export function Callout({ children, accent = C.navy, title }) {
  return (
    <div style={{
      background: `${accent}0F`, border: `1px solid ${accent}44`,
      borderRadius: 16, padding: 14, marginBottom: 18,
      fontSize: 12.5, color: D.bk, lineHeight: 1.7,
    }}>
      {title && <Kicker color={accent} style={{ marginBottom: 6 }}>{title}</Kicker>}
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
        <p style={{ fontSize: 12.5, color: D.muted, lineHeight: 1.7, marginBottom: 14 }}>{emptyHint}</p>
      )}
      {items.map((item, idx) => (
        <Card key={item.id} accent={accent}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Kicker color={D.faint}>{String(idx + 1).padStart(2, "0")}</Kicker>
            {confirming === item.id ? (
              <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: C.red }}>Remove?</span>
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

/** Section wrapper: kicker + title in the app's heading voice. */
export function SectionShell({ title, accent, intro, kicker, children }) {
  return (
    <section aria-label={title}>
      {kicker && <Kicker color={accent} style={{ marginBottom: 6 }}>{kicker}</Kicker>}
      <h2 style={{
        fontFamily: HEAD, fontSize: 20, fontWeight: 900, color: D.bk,
        margin: "0 0 10px", lineHeight: 1.25, letterSpacing: "-.01em",
      }}>
        {title}
      </h2>
      {intro && <p style={{ fontSize: 13, color: D.muted, lineHeight: 1.75, marginBottom: 20 }}>{intro}</p>}
      {children}
    </section>
  );
}
