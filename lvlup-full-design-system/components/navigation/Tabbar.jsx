import React from "react";
import { Icon, cx } from "../_shared/Icon";

export function Tabbar({ items = [], className }) {
  return (
    <nav className={cx("tabbar", className)}>
      {items.map((it, i) => (
        <a
          key={i}
          className="tabbar__item"
          href={it.href || "#"}
          aria-current={it.active ? "page" : undefined}
        >
          <Icon name={it.icon} size={22} />
          <span>{it.label}</span>
        </a>
      ))}
    </nav>
  );
}
