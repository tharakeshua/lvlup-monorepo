import React from "react";
import { cx } from "../_shared/Icon";

export function Breadcrumb({ items = [], className }) {
  return (
    <nav className={cx("breadcrumb", className)} aria-label="Breadcrumb">
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return [
          last ? (
            <span key={i} className="breadcrumb__current">
              {it.label}
            </span>
          ) : (
            <a key={i} href={it.href || "#"}>
              {it.label}
            </a>
          ),
          !last && (
            <span key={"s" + i} className="breadcrumb__sep">
              /
            </span>
          ),
        ];
      })}
    </nav>
  );
}
