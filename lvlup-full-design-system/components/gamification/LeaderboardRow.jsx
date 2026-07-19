import React from "react";
import { cx } from "../_shared/Icon";
import { Avatar } from "../data/Avatar";

export function LeaderboardRow({ rank, initials, name, xp = 0, me, className, ...rest }) {
  return (
    <div className={cx("leaderboard-row", me && "leaderboard-row--me", className)} {...rest}>
      <span className={cx("leaderboard-row__rank", rank <= 3 && "leaderboard-row__rank--top")}>
        {"#" + rank}
      </span>
      <Avatar initials={initials} size="sm" />
      <span className="leaderboard-row__name">{name}</span>
      <span className="leaderboard-row__xp">{xp + " XP"}</span>
    </div>
  );
}
