// Tier registry for the trust-layered SDK packages (SDK-LAYERS-PLAN §1, lint-boundaries §1).
// Single source of the tier of every @levelup/* package and which tiers each may import.

/** @typedef {'t0-domain'|'t1-contract'|'t2-client'|'t3-repos'|'t4-query'|'t-transport'|'t-app'|'t-server'} Tier */

/** @type {Record<string, Tier>} */
export const TIERS = {
  '@levelup/domain': 't0-domain',
  '@levelup/api-contract': 't1-contract',
  '@levelup/api-client': 't2-client',
  '@levelup/repositories': 't3-repos',
  '@levelup/query': 't4-query',
  '@levelup/realtime': 't4-query',
  '@levelup/offline': 't4-query',
  '@levelup/transport-firebase': 't-transport',
  '@levelup/transport-http': 't-transport',
  '@levelup/services': 't-server',
  '@levelup/access': 't-server',
  '@levelup/ai': 't-server',
  '@levelup/functions-shared': 't-server',
  '@levelup/repository-admin': 't-server',
  '@levelup/seed': 't-server',
};

/** @type {Record<Tier, Tier[]>} */
const ALLOWED = {
  't0-domain': [],
  't1-contract': ['t0-domain'],
  't2-client': ['t0-domain', 't1-contract'],
  't3-repos': ['t0-domain', 't1-contract', 't2-client'],
  't4-query': ['t0-domain', 't1-contract', 't2-client', 't3-repos', 't4-query'],
  't-transport': ['t0-domain', 't1-contract'],
  't-app': ['t0-domain', 't4-query'],
  't-server': ['t0-domain', 't1-contract', 't-server'],
};

/** @param {string} pkg @returns {Tier} */
export function tierOf(pkg) {
  const t = TIERS[pkg];
  if (!t) throw new Error(`Unknown package tier: ${pkg}`);
  return t;
}

/** @param {Tier} tier @returns {readonly Tier[]} */
export function allowedTiers(tier) {
  return ALLOWED[tier] ?? [];
}

/**
 * Concrete @levelup/* package names a given tier may NOT import.
 * @param {Tier} tier @returns {readonly string[]}
 */
export function forbiddenPackages(tier) {
  const ok = new Set(allowedTiers(tier));
  return Object.entries(TIERS)
    .filter(([, t]) => !ok.has(t))
    .map(([name]) => name);
}
