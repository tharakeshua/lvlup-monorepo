import React from "react";
import { Icon, cx } from "../_shared/Icon";

export function Accordion({ items = [], defaultOpen = 0, className }) {
  const [open, setOpen] = React.useState(defaultOpen != null ? defaultOpen : 0);
  return (
    <div className={cx("accordion", className)}>
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className="accordion__item" data-open={isOpen}>
            <button
              className="accordion__trigger"
              onClick={() => setOpen(isOpen ? -1 : i)}
              aria-expanded={isOpen}
            >
              <span>{it.title}</span>
              <span className="accordion__chevron">
                <Icon name="chevron-down" size={18} />
              </span>
            </button>
            <div className="accordion__panel">
              <div className="accordion__panel-inner">
                <div>{it.content}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
