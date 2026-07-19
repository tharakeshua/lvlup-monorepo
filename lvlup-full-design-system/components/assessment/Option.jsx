import React from "react";
import { cx } from "../_shared/Icon";

export function Option({ selected, state, marker, children, className }) {
  return (
    <label
      className={cx(
        "option",
        selected && "option--selected",
        state && "option--" + state,
        className
      )}
    >
      <span className="option__marker">{marker || ""}</span>
      <span>{children}</span>
    </label>
  );
}
