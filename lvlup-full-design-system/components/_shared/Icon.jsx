import React from "react";

/**
 * Lucide-on-mount icon helper (matches the reference project's Icon pattern).
 * Renders an <i data-lucide="name"> placeholder, then asks the global `lucide`
 * (loaded by each card via the lucide CDN) to swap it for an inline SVG.
 * Re-runs on every render so prop-driven icon changes are reflected.
 */
export function Icon({ name, size = 16 }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current && window.lucide) {
      ref.current.innerHTML = "";
      const el = document.createElement("i");
      el.setAttribute("data-lucide", name);
      ref.current.appendChild(el);
      window.lucide.createIcons({ attrs: { width: size, height: size } });
    }
  });
  return <span ref={ref} style={{ display: "inline-flex", lineHeight: 0 }} />;
}

/**
 * className combiner. Accepts strings and {className: truthy} objects;
 * falsy args are skipped. e.g. cx("btn", "btn--" + variant, disabled && "is-disabled").
 */
export function cx(...args) {
  const out = [];
  for (const a of args) {
    if (!a) continue;
    if (typeof a === "string") out.push(a);
    else if (typeof a === "object") for (const k in a) if (a[k]) out.push(k);
  }
  return out.join(" ");
}

/** Return a shallow copy of `obj` without the listed keys (to spread the rest onto a DOM node). */
export function omit(obj, keys) {
  const o = {};
  for (const k in obj) if (!keys.includes(k)) o[k] = obj[k];
  return o;
}
