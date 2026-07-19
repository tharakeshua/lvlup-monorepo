import React from "react";
import { Icon } from "../_shared/Icon";
import { IconButton } from "../primitives/IconButton";

export function Drawer({ open, onClose, side, title, children }) {
  return (
    <div
      data-drawer-open={!!open}
      style={{ position: "absolute", inset: 0, pointerEvents: open ? "auto" : "none" }}
    >
      <div className="drawer-scrim" onClick={onClose} />
      <div className={side === "left" ? "drawer drawer--left" : "drawer"}>
        <div className="drawer__head">
          <strong>{title}</strong>
          <IconButton icon={<Icon name="x" size={20} />} label="Close" onClick={onClose} />
        </div>
        <div className="drawer__body">{children}</div>
      </div>
    </div>
  );
}
