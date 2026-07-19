import React from "react";
import { cx } from "../_shared/Icon";

export function Section({ title, actions, className, children }) {
  return (
    <section className={cx("section", className)}>
      {(title || actions) && (
        <div className="section__header">
          <h3 className="section__title">{title}</h3>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
