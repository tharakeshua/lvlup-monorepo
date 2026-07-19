import React from "react";
import { cx } from "../_shared/Icon";

export function RubricBreakdown({ criteria = [], className }) {
  return (
    <div className={cx("rubric", className)}>
      {criteria.map((c, i) => {
        const ratio = c.max ? c.score / c.max : 1;
        const tone = ratio >= 1 ? "full" : ratio <= 0 ? "zero" : "partial";
        return (
          <div key={i} className="rubric__row">
            <div>
              <div className="rubric__criterion">{c.label}</div>
              {c.desc && <div className="rubric__desc">{c.desc}</div>}
            </div>
            <div className={cx("rubric__score", "rubric__score--" + tone)}>
              {c.score + " / " + c.max}
            </div>
          </div>
        );
      })}
    </div>
  );
}
