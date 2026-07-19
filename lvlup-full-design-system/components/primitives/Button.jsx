import React from "react";
import { cx } from "../_shared/Icon";

export function Button({
  variant = "primary",
  size,
  block,
  loading,
  disabled,
  leadingIcon,
  trailingIcon,
  className,
  children,
  ...rest
}) {
  const cls = cx(
    "btn",
    "btn--" + variant,
    size && "btn--" + size,
    block && "btn--block",
    loading && "btn--loading",
    className
  );
  return (
    <button className={cls} disabled={disabled} aria-disabled={disabled || undefined} {...rest}>
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
}
