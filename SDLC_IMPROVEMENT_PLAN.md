# SDLC Improvement Plan

Captured March 14, 2026. These are improvements to our software delivery pipeline — not the appraisal business process.

## Current CI/CD Topology

| Repo | Trigger | Pipeline |
|---|---|---|
| `appraisal-management-backend` | push to `main` | type-check → test → Docker build → ACR push → Container App update → health check |
| `appraisal-management-backend` | PR | `ci.yml`: type-check, test, Bicep lint |
| `appraisal-management-backend` | `infrastructure/**` change | `infrastructure.yml`: full Bicep deploy via `az deployment sub create` |
| `l1-valuation-platform-ui` | push to `main` | type-check → Vite build → Azure Static Web Apps deploy |
| `l1-valuation-platform-ui` | PR open/sync | SWA preview environment created |
| `l1-valuation-platform-ui` | PR close | SWA preview environment torn down |

Production deployment is currently **manually triggered** via `workflow_dispatch` (the auto-promotion job is `if: false` — was causing a loop).

---

## Known Gaps

| Gap | Severity | Detail |
|---|---|---|
| Tests fail silently | **High** | `ci.yml` has `continue-on-error: true` on unit, integration, and coverage. `deploy.yml` uses `\|\| echo` to mask type-check and build failures — a broken build can deploy |
| Production path is disabled | **High** | `production-promotion` job is `if: false`. Prod requires a manual `workflow_dispatch` |
| Service Bus subscription drift | **High** | Nothing validates that every subscription name in code exists in Bicep — hit twice in one day |
| No frontend CI on PRs | **Medium** | UI has no PR checks; type errors only caught on push to main |
| No E2E / smoke tests | **Medium** | Health check only confirms the process started, not that routes, auth, or Service Bus work |
| `ci.yml` uses `npm ci`, `deploy.yml` uses `pnpm` | **Medium** | Inconsistent — `npm ci` will fail on a pnpm workspace |
| No rollback | **Medium** | Failed health check leaves the bad image running; nothing reverts to the prior tag |
| No cross-repo coordination | **Medium** | Frontend bakes backend FQDN at build time; a backend breaking change deploys before the frontend adapts |
| Secrets via env vars not Key Vault refs | **Low** | `az containerapp secret set` used instead of Key Vault references provisioned by Bicep |
| Post-deployment steps are stubs | **Low** | Stakeholder notification and README badge steps just `echo` |

---

## Improvement Phases

### Phase 1 — Stop silent failures (1-2 days)
1. Remove all `continue-on-error: true` from CI tests — a failing test must fail the workflow
2. Fix `deploy.yml` `|| echo` masking — `type-check` and `build` must be hard gates
3. Fix `ci.yml` to use pnpm — replace `npm ci` with pnpm setup + `pnpm install --frozen-lockfile`
4. Add a frontend CI workflow in the UI repo — PR-triggered type-check + lint, no deploy

### Phase 2 — Fix production path (2-3 days)
5. Re-enable production promotion without the loop — gate on `github.ref == 'refs/heads/main'` + a `production-approval` GitHub environment (human clicks approve in GitHub UI)
6. Implement rollback — store previous image tag as a Container App label; on health check failure, rerun `az containerapp update` with the prior tag and fail the workflow

### Phase 3 — Infra drift prevention (1 day)
7. Add Bicep completeness check to CI — script greps all `subscriptionName` values in source and asserts every one has a named resource in `service-bus.bicep`; would have caught today's two failures
8. Run `az deployment group what-if` in PRs touching `infrastructure/**` — post the diff as a PR comment, no actual deploy

### Phase 4 — Smoke tests (2-3 days)
9. Post-deploy smoke test job — after health check, run a small test suite against staging hitting real API routes (auth via service principal test credential), key Service Bus operations, Cosmos reads
10. Frontend deployment test — after SWA deploy, assert the app loads with correct status and HTML

### Phase 5 — Full pipeline (1 week)
11. Semantic versioning + real changelogs via `semantic-release`
12. Teams/Slack notification — webhook already stubbed in `deploy.yml`, just needs the secret
13. Cross-repo dispatch — after backend deploy succeeds, trigger frontend `workflow_dispatch` via GitHub API
14. Key Vault references — replace `az containerapp secret set` with Key Vault secret references provisioned by Bicep
