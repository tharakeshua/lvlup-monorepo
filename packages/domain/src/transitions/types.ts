/**
 * The type-level contract for ALLOWED_TRANSITIONS. For a status union S the keys
 * must be EXACTLY the members of S and each value an array of members of S. This
 * is the compile-time assertion that transition-map members match the as-const
 * status enums (domain-core §7.3 / REVIEW open-Q / top-risk #5).
 */
export type TransitionMap<S extends string> = {
  readonly [From in S]: readonly S[];
};

/** Typed marker error thrown by assertTransition; api-contract maps it to a code. */
export class InvalidTransitionError extends Error {
  readonly domain: string;
  readonly from: string;
  readonly to: string;

  constructor(domain: string, from: string, to: string) {
    super(`invalid ${domain} transition: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
    this.domain = domain;
    this.from = from;
    this.to = to;
  }
}
