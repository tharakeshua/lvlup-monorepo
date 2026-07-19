import React from "react";
import { cx } from "../_shared/Icon";

export function DefinitionList({ items = [], className }) {
  return (
    <dl className={cx("deflist", className)}>
      {items.map((it, i) => (
        <React.Fragment key={i}>
          <dt>{it.term}</dt>
          <dd>{it.value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}
