import React from "react";
import { Icon, cx } from "../_shared/Icon";

export function CommandPalette({ placeholder, items = [], selected = 0, className }) {
  return (
    <div className={cx("cmdk", className)}>
      <input className="cmdk__input" placeholder={placeholder || "Search or jump to…"} />
      <div className="cmdk__list">
        {items.map((it, i) => (
          <div key={i} className="cmdk__item" aria-selected={i === selected}>
            {it.icon && <Icon name={it.icon} size={16} />}
            <span>{it.label}</span>
            {it.kbd && <span className="cmdk__kbd kbd">{it.kbd}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
