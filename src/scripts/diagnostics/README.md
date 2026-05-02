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
| [`inspect-pdf-fields.ts`](./inspect-pdf-fields.ts) | Dump every AcroForm field from a fillable PDF (e.g. Fannie Mae Form 1004) so report-mapper keys can be verified against the real document. |
| [`query-docs.ts`](./query-docs.ts) | Ad-hoc Cosmos `documents` container query — pulls id / name / blob path / orderId / category for a hard-coded order id. Edit the in-script query for one-off investigations. |
| [`verify-assignments.ts`](./verify-assignments.ts) | Query the `orders` container for `appraiser_assignment` records and report what's been written. Use when an auto-assignment flow looks broken end-to-end. |
