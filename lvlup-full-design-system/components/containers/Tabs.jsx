import React from "react";
import { cx } from "../_shared/Icon";

export function Tabs({ items = [], defaultIndex = 0, pill, className }) {
  const [idx, setIdx] = React.useState(defaultIndex || 0);
  return (
    <div className={cx(pill ? "tabs tabs--pill" : "tabs", className)}>
      <div className="tabs__list" role="tablist">
        {items.map((it, i) => (
          <button
            key={i}
            className="tabs__trigger"
            role="tab"
            aria-selected={i === idx}
            onClick={() => setIdx(i)}
          >
            {it.label}
          </button>
        ))}
      </div>
      {items.map((it, i) => (
        <div key={i} className="tabs__panel" role="tabpanel" hidden={i !== idx}>
          {it.content}
        </div>
      ))}
    </div>
  );
}
