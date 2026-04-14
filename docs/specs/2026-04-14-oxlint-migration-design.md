# oxlint Migration Design

## Overview

Replace ESLint and standalone `tsc --noEmit` type-checking with oxlint backed by
tsgolint. oxlint handles syntax linting, tsgolint provides type-aware linting
via typescript-go (tsgo), and the `--type-check` flag replaces the separate
type-checking step. Prettier remains the formatter. The build toolchain (Rollup 2

- rollup-plugin-typescript2) is unchanged.

## Goals

- Unify linting and type-checking into a single oxlint invocation per workspace.
- Preserve all current lint rule semantics (or nearest oxlint equivalents).
- Preserve type-checking coverage currently provided by `tsc --noEmit`.
- Reduce CI wall-clock time by eliminating the separate type-check job.
- Remove ESLint, typescript-eslint, and related packages from the dependency tree.

## Non-Goals

- Build toolchain changes (Rollup, rollup-plugin-typescript2).
- Formatter changes (Prettier stays).
- Adding new lint rules beyond current coverage.
- Supporting oxlint in editor — IDE integration is out of scope for this change,
  though oxlint's VS Code extension exists for future adoption.

## Architecture

The project is a Yarn workspaces monorepo with two packages (bot, coroutines).
Today, three separate tools run in CI: `tsc --noEmit` (per workspace, twice —
main and test tsconfig), ESLint (root-level, across all workspaces), and
Prettier (unchanged).

After migration, oxlint replaces both tsc and ESLint:

```
┌─────────────────────────────────────────────┐
│                  CI Pipeline                │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  oxlint --type-aware --type-check   │    │
│  │  (per workspace)                    │    │
│  │                                     │    │
│  │  ┌───────────┐  ┌────────────────┐  │    │
│  │  │  oxlint   │  │   tsgolint     │  │    │
│  │  │  (syntax) │  │ (type-aware +  │  │    │
│  │  │           │  │  type-check)   │  │    │
│  │  └───────────┘  └────────────────┘  │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌──────────┐  ┌──────────┐                 │
│  │  tests   │  │ Prettier │                 │
│  └──────────┘  └──────────┘                 │
└─────────────────────────────────────────────┘
```

A single root-level oxlint configuration file defines shared rules. Each
workspace's existing tsconfig files provide type information to tsgolint — no
changes to tsconfig files are needed.

## Configuration

### Oxlint Configuration

A root-level configuration file declares the linting rules. Oxlint supports
both JSON (`.oxlintrc.json`) and JavaScript (`oxlint.config.mjs`) formats. The
JavaScript format using `defineConfig` is preferred for consistency with the
existing flat-config style and for inline comments.

The configuration enables type-aware linting and type-checking globally.
Workspace-specific tsconfig resolution is handled by oxlint's automatic
project detection (it reads `tsconfig.json` from each package).

### Rule Mapping

Each current ESLint rule maps to an oxlint equivalent:

| Current ESLint Rule                                       | oxlint Equivalent                                            | Notes                                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `eslint/recommended` preset                               | oxlint's default categories                                  | oxlint enables `correctness` by default; `recommended` category covers the rest  |
| `require-yield` (off)                                     | Not applicable                                               | oxlint does not enforce this by default                                          |
| `@typescript-eslint/no-unused-vars` (warn, ignore `_`)    | `typescript/no-unused-vars`                                  | Same ignore pattern support                                                      |
| `@typescript-eslint/ban-ts-comment` (ts-ignore with desc) | `typescript/ban-ts-comment`                                  | Same option structure                                                            |
| `@typescript-eslint/switch-exhaustiveness-check` (warn)   | `typescript/switch-exhaustiveness-check`                     | Type-aware rule, supported by tsgolint                                           |
| `@typescript-eslint/no-empty-object-type`                 | `typescript/no-empty-object-type`                            | Same option for single-extends interfaces                                        |
| `eslint-config-prettier`                                  | Not needed                                                   | oxlint does not include formatting rules that conflict with Prettier             |
| `reportUnusedDisableDirectives` (off)                     | Equivalent oxlint option or not applicable                   | Currently disabled; if oxlint tracks disable directives, keep disabled initially |
| `recommendedTypeChecked` preset                           | Covered by enabling `recommended` category + type-aware mode | tsgolint implements 59/61 targeted type-aware rules                              |

Rules from `recommendedTypeChecked` that are not yet implemented in tsgolint
(2 of 61) should be identified during implementation and documented. If any
map to rules actively catching bugs in this codebase, a mitigation strategy
(such as a one-time manual audit) should be noted.

### File Targeting

- TypeScript files (`*.ts`): all lint categories + type-aware rules
- JavaScript files (`*.js`): syntax-only rules with Node.js globals
- Ignored paths: `**/dist/`, `**/coverage/`

The current ESLint config applies different settings to `.js` and `.ts` files.
oxlint handles this natively — type-aware rules only apply to TypeScript files
within a tsconfig project scope.

## Scripts

### Current Scripts

Each workspace has a `typecheck` script running `tsc --noEmit --skipLibCheck`
twice (main tsconfig + test tsconfig). The root has a `lint` script running
ESLint across the whole repo.

### Target Scripts

The per-workspace `typecheck` script is replaced by an oxlint invocation that
covers both type-checking and linting for that workspace. The root `lint`
script is replaced by a single oxlint command.

Each workspace gets a unified `check` command that runs oxlint with type-aware
linting and type-checking scoped to that workspace's tsconfig files (both main
and test). The root gets a single `check` command that runs type-aware
checking across all workspaces.

The old `typecheck` and `lint` script names are removed — the `check` command
subsumes their purpose. Warnings are treated as errors (zero-warning
tolerance), preserving the current `--max-warnings 0` behavior.

## CI Pipeline Changes

### Current CI Structure

Three sequential jobs: `build` (typecheck per workspace matrix) → `unit-test`
(test per workspace matrix) → `lint` (ESLint with PR annotation).

### Target CI Structure

Two jobs: `check` (oxlint per workspace matrix, replaces both typecheck and
lint) → `unit-test` (unchanged except job dependency name updates).

The `check` job runs oxlint per workspace in matrix mode. It requires the same
permissions as the current lint job (`checks: write`, `pull-requests: read`)
to support PR annotations. The `unit-test` job's dependency updates from
`build` to `check`.

PR annotations use oxlint's native `--format github` output format, which
produces GitHub Actions-compatible annotations directly. No third-party
annotation action is needed — `eslint-annotate-action` is removed.

Merging typecheck and lint into one job per workspace reduces CI wall time by
eliminating a full checkout + install cycle for the separate lint job.

## Dependency Changes

### Removed

- `eslint`
- `@eslint/js`
- `typescript-eslint`
- `eslint-config-prettier`
- `globals`

### Added

- `oxlint-tsgolint` (provides oxlint CLI with tsgolint type-aware backend)

### Unchanged

- `prettier` (formatter)
- `typescript` (still needed for rollup-plugin-typescript2 build emit and IDE
  support; tsgo in tsgolint handles type-checking separately)

## Risk and Mitigation

**Rule coverage gap:** 2 of 61 targeted type-aware rules may not be
implemented in tsgolint. Impact is low — the missing rules should be
identified during implementation and assessed for relevance to this codebase.

**tsgolint maturity:** tsgolint is newer than typescript-eslint. If blocking
bugs are encountered, the fallback is to keep ESLint for type-aware rules only
(hybrid mode) while using oxlint for syntax rules. This is a contingency, not
the plan.

**tsgo targeting TypeScript 7 (Project Corsa):** tsgolint uses typescript-go
which tracks the TypeScript 7 type system. The project currently uses
TypeScript 6. Behavioral differences in type resolution are possible but
unlikely for the patterns used in this codebase. The `--type-check` flag
should catch any type-system discrepancies that would otherwise be silent.

**rollup-plugin-typescript2 still needs `typescript` package:** The `typescript`
npm package remains installed for build emit. This is expected and not a
conflict — oxlint/tsgolint and rollup-plugin-typescript2 operate
independently.

**Dual type-system versions during transition:** tsgolint uses typescript-go
(tracking TypeScript 7) while rollup-plugin-typescript2 uses the `typescript`
npm package (TypeScript 6). Both perform type-checking on the same codebase,
potentially with different results. In practice, TypeScript 7 is a superset
with very few breaking changes from 6 — divergence is unlikely for the
patterns in this codebase. If type errors appear in one tool but not the other,
the build toolchain modernization (out of scope here) would resolve it by
aligning both on the same compiler. Until then, the `--type-check` flag in
oxlint is the authoritative type-checking gate; rollup-plugin-typescript2's
type-checking during build is a secondary safety net.
