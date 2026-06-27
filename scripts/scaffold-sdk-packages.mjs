// Scaffold script for the @levelup/* SDK rebuild packages.
// Additive only: creates new packages under packages/ without touching existing ones.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKGS = join(ROOT, 'packages');

const ZOD = '^4.3.6';
const RQ = '^5.62.8';
const FIREBASE = '^11.0.0';
const FIREBASE_ADMIN = '^12.0.0';
const FIREBASE_FUNCTIONS = '^6.0.0';
const UUID = '^11.0.0';
const REACT = '^18.0.0';

// pkg -> { platform: 'neutral'|'node', deps, peerDeps, devDeps, entries }
const PACKAGES = {
  domain: {
    desc: 'Pure Zod-first domain entities, branded IDs, ISO timestamps and ALLOWED_TRANSITIONS',
    platform: 'neutral',
    deps: { zod: ZOD },
    levelupDeps: [],
  },
  'api-contract': {
    desc: 'Wire SSOT: CallableDef, CALLABLES, SUBSCRIPTIONS, error model, pagination, transitions',
    platform: 'neutral',
    deps: { zod: ZOD },
    levelupDeps: ['domain'],
  },
  'api-client': {
    desc: 'createApiClient(transport): validation, normalizeError, idempotency, retry, subscribe',
    platform: 'neutral',
    deps: { zod: ZOD, uuid: UUID },
    devDeps: { '@types/uuid': '^10.0.0' },
    levelupDeps: ['domain', 'api-contract'],
  },
  repositories: {
    desc: 'Client brain: domain repos, shaping, N+1 collapse, cursor mgmt, transition pre-checks',
    platform: 'neutral',
    deps: { zod: ZOD },
    levelupDeps: ['domain', 'api-contract', 'api-client'],
  },
  query: {
    desc: 'React Query hooks, key factories, invalidation graph, optimistic recipes, ApiProvider',
    platform: 'neutral',
    deps: {},
    peerDeps: { react: REACT, '@tanstack/react-query': RQ },
    devDeps: { react: '^18.3.18', '@types/react': '^18.3.18', '@tanstack/react-query': RQ },
    levelupDeps: ['domain', 'api-contract', 'repositories', 'realtime', 'offline'],
  },
  realtime: {
    desc: 'subscribe() seam consumer, RealtimeProvider, useSubscription, useServerTime',
    platform: 'neutral',
    deps: { zod: ZOD },
    peerDeps: { react: REACT },
    devDeps: { react: '^18.3.18', '@types/react': '^18.3.18' },
    levelupDeps: ['domain', 'api-contract'],
  },
  offline: {
    desc: 'OfflineQueue interface + NoopOfflineQueue passthrough seam',
    platform: 'neutral',
    deps: { zod: ZOD },
    levelupDeps: ['api-contract'],
  },
  'transport-firebase': {
    desc: 'The Transport impl: invokeViaCallable, subscribeViaFirestore/Rtdb, source resolver',
    platform: 'neutral',
    deps: { firebase: FIREBASE, zod: ZOD },
    levelupDeps: ['domain', 'api-contract'],
  },
  'transport-http': {
    desc: 'Future stub Transport over REST/SSE/WS',
    platform: 'neutral',
    deps: { zod: ZOD },
    levelupDeps: ['api-contract'],
  },
  services: {
    desc: 'Server brain: fn(input, ctx) per capability; never imports firebase-functions',
    platform: 'node',
    deps: { zod: ZOD },
    levelupDeps: ['domain', 'api-contract', 'access', 'ai'],
  },
  access: {
    desc: 'authorize(ctx, action, resource), ACCESS_RULES table, assertTransition',
    platform: 'node',
    deps: { zod: ZOD },
    levelupDeps: ['domain', 'api-contract'],
  },
  ai: {
    desc: 'LLM provider seam, per-tenant Secret Manager keys, cost/quota/circuit-breaker',
    platform: 'node',
    deps: { zod: ZOD, '@google/generative-ai': '^0.21.0', '@google-cloud/secret-manager': '^5.6.0' },
    levelupDeps: ['domain', 'api-contract'],
  },
  'functions-shared': {
    desc: 'onCall/trigger/scheduler adapters, buildAuthContext, parseRequest, fail, outbox, Cloud Tasks',
    platform: 'node',
    deps: { zod: ZOD, 'firebase-functions': FIREBASE_FUNCTIONS, 'firebase-admin': FIREBASE_ADMIN },
    levelupDeps: ['domain', 'api-contract', 'access', 'services'],
  },
};

function sortObj(o) {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
}

function buildPackageJson(name, cfg) {
  const deps = { ...(cfg.deps || {}) };
  for (const d of cfg.levelupDeps) deps[`@levelup/${d}`] = 'workspace:*';

  const devDeps = {
    tsup: '^8.0.0',
    typescript: '^5.3.0',
    vitest: '^4.0.18',
    ...(cfg.devDeps || {}),
  };

  const pkg = {
    name: `@levelup/${name}`,
    version: '0.1.0',
    private: true,
    description: cfg.desc,
    type: 'module',
    sideEffects: false,
    main: './dist/index.cjs',
    module: './dist/index.js',
    types: './dist/index.d.ts',
    exports: {
      '.': {
        types: './dist/index.d.ts',
        import: './dist/index.js',
        require: './dist/index.cjs',
      },
      './package.json': './package.json',
    },
    files: ['dist'],
    scripts: {
      build: 'tsup',
      dev: 'tsup --watch',
      clean: 'rm -rf dist',
      typecheck: 'tsc --noEmit',
      test: 'vitest run',
      'test:watch': 'vitest',
    },
    dependencies: sortObj(deps),
    devDependencies: sortObj(devDeps),
  };
  if (cfg.peerDeps) pkg.peerDependencies = sortObj(cfg.peerDeps);
  return JSON.stringify(pkg, null, 2) + '\n';
}

function buildTsconfig(platform) {
  return (
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          lib: platform === 'node' ? ['ES2020'] : ['ES2020'],
          moduleResolution: 'bundler',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          declaration: true,
          declarationMap: true,
          isolatedModules: true,
          verbatimModuleSyntax: true,
          outDir: './dist',
          rootDir: './src',
        },
        include: ['src/**/*'],
        exclude: ['node_modules', 'dist'],
      },
      null,
      2,
    ) + '\n'
  );
}

function buildTsup(platform) {
  const platformLine = platform === 'node' ? "  platform: 'node',\n  target: 'node20',\n" : "  platform: 'neutral',\n";
  return `import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  outExtension: ({ format }) => ({ js: format === 'cjs' ? '.cjs' : '.js' }),
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  treeshake: true,
${platformLine}});
`;
}

function buildVitest() {
  return `import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: path.resolve(__dirname),
    include: ['src/**/*.test.ts'],
  },
});
`;
}

function buildIndex(name) {
  return `// @levelup/${name} — public surface (scaffold placeholder).
// Real implementations are added by the downstream build waves.
export {};
`;
}

// preset name per platform for the eslint.config.mjs of each package
const PRESET_BY_PKG = {
  domain: 'domainPreset',
  'api-contract': 'contractPreset',
  'api-client': 'clientPreset',
  repositories: 'reposPreset',
  query: 'queryPreset',
  realtime: 'clientPreset',
  offline: 'clientPreset',
  'transport-firebase': 'transportPreset',
  'transport-http': 'transportPreset',
  services: 'serverPreset',
  access: 'serverPreset',
  ai: 'serverPreset',
  'functions-shared': 'serverPreset',
};

const created = [];
for (const [name, cfg] of Object.entries(PACKAGES)) {
  const dir = join(PKGS, name);
  if (existsSync(dir)) {
    console.log(`SKIP (exists): @levelup/${name}`);
    continue;
  }
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), buildPackageJson(name, cfg));
  writeFileSync(join(dir, 'tsconfig.json'), buildTsconfig(cfg.platform));
  writeFileSync(join(dir, 'tsup.config.ts'), buildTsup(cfg.platform));
  writeFileSync(join(dir, 'vitest.config.ts'), buildVitest());
  writeFileSync(join(dir, 'src', 'index.ts'), buildIndex(name));
  writeFileSync(
    join(dir, 'eslint.config.mjs'),
    `import { ${PRESET_BY_PKG[name]} } from '@levelup/eslint-config/presets';\nexport default [...${PRESET_BY_PKG[name]}];\n`,
  );
  created.push(`@levelup/${name}`);
  console.log(`CREATED: @levelup/${name}`);
}

console.log('\nCREATED_COUNT=' + created.length);
console.log('CREATED_LIST=' + created.join(','));
