import React from "react";
import { Icon, cx } from "../_shared/Icon";

export function NavItem({ href, active, icon, badge, children, className }) {
  return (
    <a
      className={cx("nav-item", className)}
      href={href || "#"}
      aria-current={active ? "page" : undefined}
    >
      {icon && <Icon name={icon} size={18} />}
      <span>{children}</span>
      {badge && <span className="nav-item__badge">{badge}</span>}
    </a>
  );
}
