# AI Autopilot — canary tenant onboarding runbook

**Audience:** SRE / platform admin flipping the first real tenant to autopilot.
**Status:** Phase 14 v2 shipped 2026-05-11.  Pentest sign-off pending.

This is a step-by-step procedure for flipping ONE internal tenant to autopilot before broader rollout.  Every step is reversible — the kill switch is per-tenant, per-environment, and per-service-instance.

---

## 0. Pre-flight (one-time, before any tenant flip)

Two new infrastructure resources are declared in Bicep — deploying `main.bicep` against the target environment provisions them with no manual `az cosmosdb` / `az servicebus` calls:

- One Cosmos container `ai-autopilot` (shared for recipes + runs, `entityType` discriminator, per-doc TTL on runs) ← `infrastructure/modules/cosmos-ai-assistant-containers.bicep` (already wired into `main.bicep` line 317).
- Service Bus queue `autopilot-tasks` ← `infrastructure/modules/service-bus.bicep` (already wired into `main.bicep` line 444).

| # | Action | Owner | Verification |
|---|---|---|---|
| 0.1 | Deploy `main.bicep` to the target environment.  This is the standard staging/prod deploy — no ad-hoc commands needed.  The new Cosmos container + the SB queue land idempotently. | SRE | `az cosmosdb sql container show -g <rg> -a <cosmos> -d appraisal-management -n ai-autopilot` succeeds; `az servicebus queue show -g <rg> --namespace-name <sb> -n autopilot-tasks` returns the queue |
| 0.2 | Confirm Managed Identity on the API App Service has `Azure Service Bus Data Sender` + `Azure Service Bus Data Receiver` roles on the namespace.  Already covered by `servicebus-role-assignments.bicep` if Bicep was deployed end-to-end. | SRE | `az role assignment list --assignee <api-msi-objectId> --scope <sb-namespace-id>` shows both roles |
| 0.3 | Push App Config keys for cost rates: `services.openai.cost-per-1k-input-usd` (default `0.005`) + `services.openai.cost-per-1k-output-usd` (default `0.015`). | Platform admin | `az appconfig kv list` shows both keys |
| 0.4 | Set the global default: `AI_AUTOPILOT_DEFAULT_ENABLED=false` on all environments (canary opt-in via per-tenant flag).  Without this the sweep job is OFF for tenants that haven't explicitly opted in. | SRE | env var present on `appraisal-management-backend` App Service |
| 0.5 | Confirm `AI_AUTOPILOT_ENABLED` is not set to `false` on the API service (the global kill switch).  Default = on. | SRE | env var absent or `true` |

---

## 1. Pick the canary tenant

| Criteria | Notes |
|---|---|
| Internal-only (employees, no external users) | Reduces blast radius if something misbehaves |
| Existing AI Assistant usage > 50 prompts/week | We want signal; a dead tenant gives no learning |
| At least one sponsoring user with admin role | Recipe sponsorship requires an active admin |
| Cost-budget tolerance: ≤ $50/month exhausted is acceptable to the business | Keeps the financial blast radius bounded |

Record the chosen tenantId in `docs/AI_AUTOPILOT_CANARY_TENANT.md` (not in this repo — internal ops doc).

---

## 2. Per-tenant flag flip

Upsert the `ai-feature-flags` document for the canary tenant:

```bash
# Use the existing admin-only endpoint.  Auth as a tenant-admin user.
curl -X POST 'https://<staging-base>/api/ai/settings/flags' \
  -H 'Authorization: Bearer <admin-token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "enabled": true,
    "tools": {
      "messaging": true,
      "navigation": true,
      "negotiation": true,
      "composites": true,
      "mopVendorMatching": true,
      "axiomTools": true,
      "autonomous": true
    },
    "autopilot": { "enabled": true, "maxChainDepth": 3 },
    "costBudget": { "hardLimitUsd": 50, "warnThresholdUsd": 40, "periodDays": 30 }
  }'
```

Verify:
```bash
curl 'https://<staging-base>/api/ai/cost/snapshot' \
  -H 'Authorization: Bearer <canary-tenant-user-token>' \
  | jq '.data.hardLimitUsd'  # should print 50
```

---

## 3. Create the first recipe

Replace the prompt + intent + payload with the canary use case.  Below is the "stuck-order triage" example.

```bash
curl -X POST 'https://<staging-base>/api/ai/autopilot/recipes' \
  -H 'Authorization: Bearer <sponsor-admin-token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Stuck order triage",
    "description": "Every 2h scan stuck orders, propose remediation, require human approval before dispatch.",
    "policy": { "mode": "approve", "approvalTimeoutMinutes": 1440 },
    "trigger": { "kind": "cron", "cron": "every-2h" },
    "request": { "prompt": "Find orders past SLA in this tenant.  Propose remediation per order.  Do NOT execute writes — queue for approval." }
  }'
```

Verify on `/ai-audit` → Autopilot tab → Recipes that the row appears with `status: active`.

---

## 4. First-fire observation

| # | Within | Expected signal | Where to look |
|---|---|---|---|
| 4.1 | 2 minutes | Sweep job picks up the recipe + publishes one autopilot-task message. | App Service log stream — `AiAutopilotSweepJob` → `Published autopilot task` |
| 4.2 | 5 minutes | Consumer processes the message; creates one AutopilotRun row in status `awaiting-approval` (because policy=approve). | `/ai-audit` → Autopilot tab → Approval queue |
| 4.3 | Same | Audit row written with `source: 'autopilot'` + `triggeredBy.sponsorUserId` set to the recipe sponsor. | `/ai-audit` → Audit feed (filter by source) |
| 4.4 | 24h | The approval-timeout cancels the run if no human acts.  Verify cancellation produces a `cancelled` row, not a silent drop. | Autopilot tab → Recent runs |

---

## 5. Acceptance criteria for "canary green"

The canary is GREEN after **one week** of these conditions:

- [ ] Zero `failed` runs whose `error.code === 'DISPATCH_FAILED'` from anything other than legitimate downstream errors (vendor 500s etc).
- [ ] Zero audit rows with `source: 'autopilot'` and `success: false` whose `errorMessage` includes `'scope'`, `'fail-open'`, or `'cross-tenant'`.
- [ ] Cost-budget exhausted **0** times for the tenant (or, if exhausted once, the run was correctly refused and a banner appeared).
- [ ] No rate-limit 429 cascades — refusal rate < 1% of total AI calls in the tenant.
- [ ] Approval queue never grew beyond 20 pending decisions (signals SLO breach in the approver workflow).
- [ ] Sponsor-missing pause triggered correctly when we test-disable a sponsor user (see §6.2 below).

---

## 6. Adversarial verification (recommended during week 1)

### 6.1 Hit the rate limit
Run the live-fire suite `e2e/live-fire/ai-autopilot.live-fire.spec.ts` test #3 ("autopilot:3").  Verify 429 response carries the right family/limit/retryInMs envelope.

### 6.2 Sponsor offboarding
- Manually set the canary recipe's sponsor user `isActive=false` in Cosmos `users` container.
- Wait for the next sweep tick (≤ 2 minutes).
- Verify the recipe transitioned to `status: sponsor-missing` automatically.
- Verify NO autopilot task was published or processed for that recipe.
- Restore `isActive=true` + reset recipe `status: active` to clear.

### 6.3 Cost-budget exhaustion
- Lower the canary's `costBudget.hardLimitUsd` to `0.01` via the flags endpoint.
- Send 5 prompts via the tray.
- Verify all 5 are refused with the "AI budget exhausted" message (FE) and `exhausted: true` in the cost-snapshot response (BE).
- Restore `hardLimitUsd` to its real value.

### 6.4 Global kill switch
- Set `AI_AUTOPILOT_ENABLED=false` on the API service.  Restart.
- Verify the sweep job + consumer do NOT start (log line `AiAutopilotSweepJob already running` is absent on next restart).
- The CRUD endpoints for recipes + runs STAY live (so existing recipes can be paused/inspected).
- Unset the env var, restart, verify sweep + consumer come back up.

---

## 7. Rollback procedure

If something is on fire:

```bash
# Tenant-level: remove the per-tenant flag (autopilot defaults to OFF without it)
curl -X POST 'https://<staging-base>/api/ai/settings/flags' \
  -H 'Authorization: Bearer <admin-token>' \
  -H 'Content-Type: application/json' \
  -d '{ "autopilot": { "enabled": false } }'

# Pause every active recipe in one tenant
for id in $(curl -s '/api/ai/autopilot/recipes' | jq -r '.data[].id'); do
  curl -X POST "/api/ai/autopilot/recipes/$id/pause"
done

# Global: flip the kill switch (affects every tenant)
az webapp config appsettings set --name <app-service> --resource-group <rg> \
  --settings AI_AUTOPILOT_ENABLED=false
# Restart the app service to pick up the new value.
```

---

## 8. Cohort plan (post-canary)

| Week | Cohort | Tenants |
|---|---|---|
| 0–1 | Internal canary | 1 internal tenant (this runbook) |
| 2–3 | Friendly customers | 3 design-partner tenants, hand-picked |
| 4–6 | Broader rollout | 10–20 tenants opted-in via support |
| 7+ | GA | autopilot.enabled default flips to opt-OUT |

Pentest sign-off (security team) is required before the week-4 broader-rollout step.
