// Composed per-tier ESLint flat-config presets (lint-boundaries §3.2).
// Each preset is a FlatConfig[] applying the no-restricted-imports boundary matrix for its tier.
// These are additive: legacy index.js/react.js/node.js remain for the existing apps/packages.

import tsParser from '@typescript-eslint/parser';

import {
  FIREBASE_BAN,
  FIRESTORE_BAN,
  REACT_BAN,
  DEEP_IMPORT_BAN,
  SECRETS_BAN,
  TRANSPORT_BAN,
  restrictedFor,
  buildNoRestrictedImports,
} from './boundaries.mjs';

const TS_FILES = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'];

/**
 * @param {string[]} files
 * @param {import('./boundaries.mjs').RestrictedSpec[]} specs
 * @returns {import('eslint').Linter.FlatConfig}
 */
function boundaryBlock(files, specs) {
  return {
    files,
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    rules: {
      'no-restricted-imports': buildNoRestrictedImports(specs),
    },
  };
}

// t0-domain: pure — no firebase, no react, no firestore, no deep imports (R3).
export const domainPreset = [boundaryBlock(TS_FILES, [FIREBASE_BAN, FIRESTORE_BAN, REACT_BAN, SECRETS_BAN, DEEP_IMPORT_BAN, restrictedFor('t0-domain')])];

// t1-contract: pure + R11 (no tenantId in request schema is enforced by the contract test).
export const contractPreset = [boundaryBlock(TS_FILES, [FIREBASE_BAN, FIRESTORE_BAN, REACT_BAN, SECRETS_BAN, DEEP_IMPORT_BAN, restrictedFor('t1-contract')])];

// t2-client (api-client): R4 (no firebase) + R5 (no react) + R2 (no transport) + R8 + R13.
export const clientPreset = [boundaryBlock(TS_FILES, [FIREBASE_BAN, FIRESTORE_BAN, REACT_BAN, SECRETS_BAN, TRANSPORT_BAN, DEEP_IMPORT_BAN, restrictedFor('t2-client')])];

// t3-repos: R4 + R5 + R8 + R13 (sibling-repo R6 enforced by dependency-cruiser).
export const reposPreset = [boundaryBlock(TS_FILES, [FIREBASE_BAN, FIRESTORE_BAN, REACT_BAN, SECRETS_BAN, TRANSPORT_BAN, DEEP_IMPORT_BAN, restrictedFor('t3-repos')])];

// t4-query: React ALLOWED here (the one binding site); still no firebase/firestore/secrets/transport (R10 is a custom rule, added later).
export const queryPreset = [boundaryBlock(TS_FILES, [FIREBASE_BAN, FIRESTORE_BAN, SECRETS_BAN, TRANSPORT_BAN, DEEP_IMPORT_BAN, restrictedFor('t4-query')])];

// t-transport: firebase ALLOWED; may only import t0/t1; no react; no deep imports (R2-source/R13).
export const transportPreset = [boundaryBlock(TS_FILES, [REACT_BAN, FIRESTORE_BAN, DEEP_IMPORT_BAN, restrictedFor('t-transport')])];

// t-app: apps may import ONLY query/realtime/offline/domain (R7) + no firebase/firestore + no transport (except root).
export const appPreset = [boundaryBlock(TS_FILES, [FIREBASE_BAN, FIRESTORE_BAN, TRANSPORT_BAN, DEEP_IMPORT_BAN, restrictedFor('t-app')])];

// t-server: R8 (firestore only in admin) + R9 (no firebase-functions in services/access/ai) + R12 + R14.
// firebase-functions IS allowed in functions-shared; serverPreset bans it, so functions-shared overrides locally.
export const serverPreset = [boundaryBlock(TS_FILES, [FIRESTORE_BAN, REACT_BAN, DEEP_IMPORT_BAN])];

// admin adapter: FIRESTORE_BAN lifted (the one allowed Firestore site); still no react.
export const adminAdapterPreset = [boundaryBlock(TS_FILES, [REACT_BAN, DEEP_IMPORT_BAN])];
