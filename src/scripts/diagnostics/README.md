# Diagnostic Scripts

Read-only inspection tools for debugging data shapes, linkage, and persistence
in the Cosmos `aiInsights` container. Safe to run against any environment;
none of these scripts write.

## Conventions for adding a new diagnostic

- Filename starts with `inspect-` (or `query-`, `verify-`, `audit-`) and
  describes the entity it inspects.
- Top-of-file comment block: one-line summary, prose paragraph explaining
  *when* you would reach for it, `Usage:` example, env vars required, and
  an explicit "Read-only" note if it does not write.
- Default to dry-run / read-only behaviour; if a diagnostic legitimately
  needs to write (rare), follow the `--apply` flag pattern from
  `src/scripts/backfill-verdict-counts.ts`.
- Connect to Cosmos via `DefaultAzureCredential` (matches the existing
  scripts) — do not hardcode keys.
- Keep them small. If a diagnostic grows past a single file, lift the
  shared logic into `src/utils/` and have multiple thin scripts call into it.

## Available diagnostics

| Script | Purpose |
|---|---|
| [`inspect-run-record.ts`](./inspect-run-record.ts) | Print a single run-ledger record + related step / input records. Use when debugging run-ledger linkage (e.g. why `backfill-verdict-counts` cannot find a run's evaluation). |
| [`inspect-evaluations.ts`](./inspect-evaluations.ts) | List Axiom evaluation records for an order. Use when verifying whether an evaluation actually completed with a criteria array. |

## Other diagnostic-flavoured scripts elsewhere in the repo

These predate the `diagnostics/` folder and could be moved here in a future
cleanup; left in place for now to avoid breaking any external workflow that
references their existing paths:

- `src/scripts/inspect-pdf-fields.ts` — dumps AcroForm fields from a fillable PDF.
- `src/scripts/query-docs.ts` — ad-hoc Cosmos `documents` container query.
- `src/scripts/verify-assignments.ts` — verifies appraiser-assignment records.
