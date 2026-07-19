import React from "react";
import { Icon, cx } from "../_shared/Icon";

export function Pagination({ pages = 5, current = 1, className }) {
  const arr = [];
  for (let i = 1; i <= pages; i++) arr.push(i);
  return (
    <nav className={cx("pagination", className)} aria-label="Pagination">
      <a className="pagination__item">
        <Icon name="chevron-left" size={16} />
      </a>
      {arr.map((n) => (
        <a key={n} className="pagination__item" aria-current={n === current ? "page" : undefined}>
          {n}
        </a>
      ))}
      <a className="pagination__item">
        <Icon name="chevron-right" size={16} />
      </a>
    </nav>
  );
}
