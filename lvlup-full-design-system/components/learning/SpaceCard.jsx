import React from "react";
import { cx } from "../_shared/Icon";

export function SpaceCard({ title, description, points = 0, progress = 0, spark, className }) {
  return (
    <div className={cx("space-card", className)}>
      <div className={cx("space-card__banner", spark && "space-card__banner--spark")} />
      <div className="space-card__body">
        <div className="space-card__title">{title}</div>
        {description && <div className="card__body">{description}</div>}
        <div className="space-card__meta">
          <span>
            <span className="u-num">{points}</span> story points
          </span>
          <span>
            <span className="u-num">{progress + "%"}</span> mastered
          </span>
        </div>
      </div>
    </div>
  );
}
