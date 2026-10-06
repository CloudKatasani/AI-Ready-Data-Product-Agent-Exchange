import { FlatCompat } from '@eslint/eslintrc';
import boundaries from 'eslint-plugin-boundaries';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

/**
 * Service-module dependency direction (02-architecture §3). Key = module under src/lib, value = modules it may import.
 * `config` and `utils` are leaf helpers every module may use.
 */
const LIB_DEPS = {
  config: [],
  db: [],
  utils: [],
  packs: [],
  warehouse: ['packs'],
  query: ['warehouse', 'packs'],
  agents: ['query', 'packs'],
  lifecycle: ['query', 'agents', 'packs'],
  marketplace: ['query', 'agents', 'lifecycle', 'packs'],
  operate: ['query', 'agents', 'marketplace', 'packs'],
  strategy: ['packs', 'query', 'lifecycle'],
  standards: ['packs', 'lifecycle'],
  exports: ['standards', 'lifecycle', 'query', 'packs'],
  presenter: ['packs', 'warehouse', 'query', 'agents', 'lifecycle', 'marketplace', 'operate', 'strategy', 'standards', 'exports'],
};
const LIB = Object.keys(LIB_DEPS);
const LEAF = ['config', 'utils', 'db'];

/** Next.js file conventions that must default-export. CLAUDE.md §8 allows default exports only here. */
const NEXT_CONVENTION_FILES = ['page', 'layout', 'template', 'loading', 'error', 'global-error', 'not-found', 'default'].map(
  (f) => `src/app/**/${f}.tsx`,
);

/** CLAUDE.md §4.8 / 10 §3 — determinism: no ambient randomness or wall-clock reads in engines. */
const DETERMINISTIC_FILES = ['warehouse', 'query', 'agents/scripted', 'strategy'].map((d) => `src/lib/${d}/**/*.ts`);

const NO_DEFAULT_EXPORT = {
  selector: 'ExportDefaultDeclaration',
  message: 'No default exports except Next.js page/layout conventions (CLAUDE.md §8).',
};

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'playwright-report/**', 'test-results/**', 'next-env.d.ts', 'data/**'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      'max-lines': ['error', { max: 600, skipBlankLines: false, skipComments: false }],
    },
  },
  {
    // Invariant I02: only the warehouse adapter may load the DuckDB driver.
    files: ['**/*.{ts,tsx,mts,mjs}'],
    ignores: ['src/lib/warehouse/duckdb.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [{ group: ['@duckdb/*'], message: 'Only src/lib/warehouse/duckdb.ts may import the DuckDB driver — go through QueryService (invariant I02).' }],
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: NEXT_CONVENTION_FILES,
    rules: {
      'no-restricted-syntax': ['error', NO_DEFAULT_EXPORT],
    },
  },
  {
    // Services never import React (02-architecture §3).
    files: ['src/lib/**/*.ts'],
    ignores: ['src/lib/warehouse/duckdb.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'Services in src/lib never import React (02-architecture §3).' },
            { name: 'react-dom', message: 'Services in src/lib never import React (02-architecture §3).' },
          ],
          patterns: [
            { group: ['@duckdb/*'], message: 'Only src/lib/warehouse/duckdb.ts may import the DuckDB driver (invariant I02).' },
            { group: ['@/components/*', '@/app/*'], message: 'Services in src/lib never import UI code.' },
          ],
        },
      ],
    },
  },
  {
    files: DETERMINISTIC_FILES,
    rules: {
      'no-restricted-syntax': [
        'error',
        NO_DEFAULT_EXPORT,
        { selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']", message: 'Use rng(seed) — engines must be deterministic (invariant I08).' },
        { selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']", message: 'Use clock.asOf() — engines must be deterministic (invariant I08).' },
        { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: 'Use clock.asOf() — engines must be deterministic (invariant I08).' },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'import/resolver': { typescript: { alwaysTryTypes: true, project: './tsconfig.json' } },
      'boundaries/include': ['src/**/*'],
      'boundaries/elements': [
        ...LIB.map((m) => ({ type: m, pattern: `src/lib/${m}` })),
        { type: 'copy', pattern: 'src/copy' },
        { type: 'components', pattern: 'src/components' },
        { type: 'app', pattern: 'src/app' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            ...LIB.map((m) => ({
              from: { element: { type: m } },
              allow: { to: { element: { types: { anyOf: [m, ...LIB_DEPS[m], ...LEAF] } } } },
            })),
            { from: { element: { types: { anyOf: ['app', 'components'] } } }, allow: { to: { element: { types: { anyOf: [...LIB, 'copy', 'components'] } } } } },
            { from: { element: { type: 'app' } }, allow: { to: { element: { type: 'app' } } } },
            { from: { element: { type: 'copy' } }, allow: { to: { element: { type: 'copy' } } } },
          ],
        },
      ],
    },
  },
];

export default config;
