// no-restricted-imports boundary factory (lint-boundaries §2, R1–R14).
// Each export builds a RestrictedSpec consumed by buildNoRestrictedImports().

import { forbiddenPackages } from './tiers.mjs';

/** @typedef {{ paths: {name:string,message:string}[], patterns: {group:string[],message:string}[] }} RestrictedSpec */

/** @type {RestrictedSpec} */
export const FIREBASE_BAN = {
  paths: [
    { name: 'firebase', message: 'R3/R4: firebase is injected via transport-firebase only.' },
    { name: 'firebase-admin', message: 'R3/R4: firebase-admin is allowed only in repository-admin (server).' },
    { name: 'firebase-functions', message: 'R9: firebase-functions is allowed only in functions/* adapters.' },
  ],
  patterns: [
    { group: ['firebase/*'], message: 'R3/R4: firebase/* is injected via transport-firebase only.' },
    { group: ['firebase-admin/*'], message: 'R8: firebase-admin/* is allowed only in repository-admin.' },
    { group: ['firebase-functions/*'], message: 'R9: firebase-functions/* is allowed only in functions/* adapters.' },
  ],
};

/** @type {RestrictedSpec} */
export const FIRESTORE_BAN = {
  paths: [{ name: '@google-cloud/firestore', message: 'R8: direct Firestore is allowed only in repository-admin.' }],
  patterns: [
    { group: ['firebase/firestore', 'firebase/firestore/*'], message: 'R8: direct Firestore is allowed only in repository-admin.' },
    { group: ['firebase-admin/firestore'], message: 'R8: direct Firestore is allowed only in repository-admin.' },
    { group: ['@google-cloud/firestore/*'], message: 'R8: direct Firestore is allowed only in repository-admin.' },
  ],
};

/** @type {RestrictedSpec} */
export const REACT_BAN = {
  paths: [
    { name: 'react', message: 'R5: only @levelup/query (and realtime) may bind React; lower tiers stay framework-free.' },
    { name: 'react-dom', message: 'R5: only @levelup/query may bind React-DOM.' },
    { name: '@tanstack/react-query', message: 'R5: only @levelup/query may import @tanstack/react-query.' },
  ],
  patterns: [{ group: ['@tanstack/*'], message: 'R5: only @levelup/query may import @tanstack/*.' }],
};

/** @type {RestrictedSpec} */
export const DEEP_IMPORT_BAN = {
  paths: [],
  patterns: [
    {
      group: ['@levelup/*/src/*', '@levelup/*/dist/*', '@levelup/*/internal', '@levelup/*/internal/*'],
      message: 'R13: import @levelup/* through its public "." export surface only — no deep/internal paths.',
    },
  ],
};

/** @type {RestrictedSpec} */
export const SECRETS_BAN = {
  paths: [{ name: '@google-cloud/secret-manager', message: 'R14: AI secrets never in a client bundle.' }],
  patterns: [{ group: ['@google-cloud/secret-manager/*'], message: 'R14: AI secrets never in a client bundle.' }],
};

/** @type {RestrictedSpec} */
export const TRANSPORT_BAN = {
  paths: [
    { name: '@levelup/transport-firebase', message: 'R2: transport is injected once at the app root only.' },
    { name: '@levelup/transport-http', message: 'R2: transport is injected once at the app root only.' },
  ],
  patterns: [],
};

/**
 * Build the per-tier upward-import ban from the tier graph (R1).
 * @param {import('./tiers.mjs').Tier} tier
 * @returns {RestrictedSpec}
 */
export function restrictedFor(tier) {
  const forbidden = forbiddenPackages(tier);
  return {
    paths: forbidden.map((name) => ({
      name,
      message: `R1: ${tier} may not import ${name} (upward/sideways tier import).`,
    })),
    patterns: [],
  };
}

/**
 * Merge several RestrictedSpec into one no-restricted-imports rule entry array.
 * @param {RestrictedSpec[]} specs
 * @returns {['error', { paths: any[], patterns: any[] }]}
 */
export function buildNoRestrictedImports(specs) {
  const paths = [];
  const patterns = [];
  for (const s of specs) {
    if (s?.paths) paths.push(...s.paths);
    if (s?.patterns) patterns.push(...s.patterns);
  }
  return ['error', { paths, patterns }];
}
