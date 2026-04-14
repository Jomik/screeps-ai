# tsgo + oxlint Migration Research Brief

## Question

How do we migrate this Screeps AI monorepo from TypeScript 6 (`tsc`) to tsgo (`@typescript/native-preview`) for type-checking, and from ESLint 9 to oxlint for linting?

## Summary

**tsgo** is the native Go port of TypeScript (aka TypeScript 7), published as `@typescript/native-preview` on npm. It reads existing `tsconfig.json` files and produces the same type errors as TS 6.0. Type checking, parsing, emit, and build mode are all marked "done". The CLI binary is `tsgo` and is a drop-in replacement for `tsc --noEmit` in type-checking workflows. It does NOT replace the TypeScript compiler used by bundlers or test runners for _transpilation_ -- Rollup and ts-jest will continue using the `typescript` npm package for emit. tsgo's role here is strictly the `typecheck` script.

**oxlint** is a Rust-based linter supporting 700+ ESLint rules natively (source: https://oxc.rs/docs/guide/usage/linter), with an automatic migration tool (`@oxlint/migrate`) that converts ESLint flat configs to `.oxlintrc.json`. For type-aware rules (the `typescript-eslint` rules we currently use), oxlint integrates with **tsgolint** (source: https://github.com/oxc-project/tsgolint) -- a Go binary that uses `typescript-go` under the hood. This means type-aware oxlint linting inherently depends on tsgo.

Both migrations are independent but complementary. The oxlint type-aware path (`oxlint --type-aware --type-check`) can fully replace both `tsc --noEmit` and `eslint` in CI.

## Findings

### tsgo: Type-Checking Replacement

**Package:** `@typescript/native-preview` (npm)
**CLI:** `npx tsgo` — used exactly like `tsc`
**Source:** https://github.com/microsoft/typescript-go

Status of features relevant to this codebase:

- Type checking: done (same errors as TS 6.0)
- `tsconfig.json` parsing: done
- Build mode / project references: done
- Emit (JS output): done, but NOT the migration path here
- Watch mode: prototype only
- API: not ready (rules out programmatic consumers like `rollup-plugin-typescript2`)

**What tsgo replaces in this repo:**
The `typecheck` scripts in both workspace `package.json` files (`packages/bot/package.json`, `packages/coroutines/package.json`). These currently invoke `tsc --noEmit` against both the main and test tsconfigs. tsgo is a CLI-compatible drop-in → swap the binary name.

**What tsgo does NOT replace:**

- `rollup-plugin-typescript2` and `ts-jest` — both call the TypeScript compiler API programmatically for transpilation + emit. tsgo's API is "not ready" (source: https://github.com/microsoft/typescript-go README). The `typescript` npm package remains as a devDependency for these tools.

**tsconfig.json compatibility:**
tsgo reads existing tsconfig files. The CHANGES.md documents intentional differences, but they are almost entirely about JavaScript/JSDoc inference and CommonJS patterns. This codebase is pure TypeScript with ESM source → no impact from the listed changes.

One consideration: tsgo uses UTF-8 byte offsets for node positions instead of UTF-16. This only matters for programmatic API consumers, not CLI type-checking.

**Installation:**
Add `@typescript/native-preview` as a root devDependency. This provides the `tsgo` binary.

### oxlint: Linting Replacement

**Package:** `oxlint` (npm)
**Source:** https://github.com/oxc-project/oxc
**Migration tool:** `@oxlint/migrate` (source: https://oxc.rs/docs/guide/usage/linter/migrate-from-eslint)

**Current ESLint setup (from `eslint.config.mjs`):**

- `@eslint/js` recommended
- `typescript-eslint` recommendedTypeChecked (type-aware rules)
- `eslint-config-prettier` (disables formatting rules)
- Custom rules: `require-yield: off`, `no-unused-vars` with ignore patterns, `ban-ts-comment`, `switch-exhaustiveness-check`, `no-empty-object-type`
- Ignores: `dist/`, `coverage/`
- JS files get Node globals; TS files get type-checked linting

**Migration path:**

1. **Auto-migrate config:** `@oxlint/migrate --type-aware` reads the ESLint flat config and produces `.oxlintrc.json`. Manual review needed for:
   - `require-yield: off` → verify oxlint rule name
   - Custom rule options (argsIgnorePattern, etc.)
   - `eslint-config-prettier` → oxlint doesn't conflict with Prettier by default (no formatting rules enabled), so this becomes unnecessary

2. **Type-aware linting via tsgolint:** Install `oxlint-tsgolint` as a devDependency and enable `typeAware: true` in the oxlint config. Optionally enable `typeCheck: true` to report TypeScript errors alongside lint results, which can replace a separate `tsc --noEmit` step.

3. **Inline `eslint-disable` comments:**
   oxlint supports `eslint-disable` / `eslint-disable-next-line` comments natively for backward compatibility (source: https://oxc.rs/docs/guide/usage/linter/ignore-comments). The 11 existing `eslint-disable` directives in the codebase will continue working without modification.

4. **CI integration:**
   oxlint supports `--format github` for native GitHub Actions annotations (source: https://oxc.rs/docs/guide/usage/linter/output-formats).

**Rule coverage for current config:**

| Current ESLint Rule                              | oxlint Support                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| `@eslint/js` recommended                         | Fully covered (700+ rules)                                                      |
| `@typescript-eslint/no-unused-vars`              | `typescript/no-unused-vars` — supported                                         |
| `@typescript-eslint/ban-ts-comment`              | `typescript/ban-ts-comment` — supported                                         |
| `@typescript-eslint/switch-exhaustiveness-check` | `typescript/switch-exhaustiveness-check` — supported (type-aware, via tsgolint) |
| `@typescript-eslint/no-empty-object-type`        | `typescript/no-empty-object-type` — supported                                   |
| `@typescript-eslint/no-non-null-assertion`       | `typescript/no-non-null-assertion` — supported                                  |
| `@typescript-eslint/no-unsafe-assignment`        | `typescript/no-unsafe-assignment` — supported (type-aware)                      |
| `@typescript-eslint/no-explicit-any`             | `typescript/no-explicit-any` — supported                                        |
| `@typescript-eslint/restrict-plus-operands`      | `typescript/restrict-plus-operands` — supported (type-aware)                    |
| `require-yield`                                  | `eslint/require-yield` — supported                                              |
| `eslint-config-prettier`                         | Not needed — oxlint has no formatting rules enabled by default                  |

All rules currently in use appear to be supported. The `recommendedTypeChecked` preset from typescript-eslint maps to oxlint's built-in typescript plugin with `typeAware: true`.

## Open Questions

1. **Test tsconfig coverage in oxlint:** The current `typecheck` script runs `tsc` against both `tsconfig.json` and `tsconfig.test.json`. With `oxlint --type-aware --type-check`, need to verify that test files are covered. The ESLint config already references both tsconfigs in `parserOptions.project` — oxlint should pick these up if pointed at the same scope. May need `tsconfig.json` references or explicit configuration.

2. **CI job structure:** Current CI runs `build` (typecheck) as a matrix job per workspace, then `unit-test` and `lint` run in parallel (both depend on `build`). With oxlint's `--type-check`, typecheck and lint could merge into one job, but this changes the dependency graph — tests currently start as soon as typecheck passes, without waiting for lint. Three options:
   - (a) Merged: `oxlint --type-aware --type-check` replaces both `build` and `lint` — simplest, but tests must wait for lint
   - (b) Separate: `tsgo --noEmit` (matrix) + `oxlint --type-aware` (single job) — preserves current parallel structure
   - (c) Hybrid: `oxlint --type-aware` without `--type-check`, keep `tsgo` for typecheck matrix — maximum parallelism
     Design phase should decide.

3. **oxlint rule options fidelity:** The auto-migrator handles most rule options, but custom options like `argsIgnorePattern` on `no-unused-vars` and `considerDefaultExhaustiveForUnions` on `switch-exhaustiveness-check` need manual verification after migration.

4. **CI annotation format:** Current CI uses `eslint-annotate-action` with JSON output. oxlint's `--format github` produces native GitHub annotations. Need to verify the annotation quality is equivalent.

5. **Monorepo structure:** oxlint type-aware linting docs note that dependent packages need `.d.ts` files built first. The `coroutines` package is referenced as `workspace:*` with `main: "src/index.ts"` — Rollup resolves this at source level, but tsgo/tsgolint may need the coroutines package built first. Current `typecheck` runs per-workspace in CI matrix, so this may need sequencing.
