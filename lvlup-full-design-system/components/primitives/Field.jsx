import React from "react";
import { Icon, cx } from "../_shared/Icon";

export function Field({ label, required, htmlFor, error, hint, className, children }) {
  return (
    <div className={cx("field", className)}>
      {label && (
        <label
          className={cx("field__label", required && "field__label--required")}
          htmlFor={htmlFor}
        >
          {label}
        </label>
      )}
      {children}
      {error ? (
        <div className="field__error">
          <Icon name="alert-circle" size={13} />
          {error}
        </div>
      ) : (
        hint && <div className="field__hint">{hint}</div>
      )}
    </div>
  );
}
