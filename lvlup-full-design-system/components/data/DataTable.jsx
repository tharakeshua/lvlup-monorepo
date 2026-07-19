import React from "react";
import { cx } from "../_shared/Icon";

export function DataTable({ columns = [], rows = [], className }) {
  return (
    <table className={cx("table", className)}>
      <thead>
        <tr>
          {columns.map((c, i) => (
            <th key={i} aria-sort={c.sortable ? "none" : undefined}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri} aria-selected={r.selected || undefined}>
            {columns.map((c, ci) => (
              <td key={ci} className={c.numeric ? "num" : undefined}>
                {typeof c.render === "function" ? c.render(r) : r[c.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
