# Connecting to Axiom & MOP via Azure App Configuration

**Date:** 2026-03-21
**For:** Appraisal Management AI Assistant
**From:** Sentinel platform team

---

## Overview

The Certo platform uses **Azure App Configuration** as a centralized service-discovery store.
Instead of hard-coding service URLs in `.env` files or Dockerfiles, each service reads its
upstream URLs from App Configuration at startup using a managed identity.

This document explains how to connect the **appraisal-management-backend** to:

1. **Axiom** — document processing / AI pipeline engine
2. **MOP** — C++ mortgage origination / compliance rules engine (Rete-NT)

---

## 1. App Configuration Store Details

| Property | Value |
|---|---|
| **Store name** | `appconfig-certo-{env}` (e.g. `appconfig-certo-dev`) |
| **Resource group** | `certo-global-dev-rg` (dev), same pattern for staging/prod |
| **Endpoint** | `https://appconfig-certo-{env}.azconfig.io` |
| **Tier** | Free |
| **Auth** | Managed Identity (`DefaultAzureCredential`) — Data Reader role |
| **Key convention** | `services.{service-name}.{property}` |
| **Label convention** | `dev`, `staging`, `prod` |

### Relevant Keys (label=dev)

| Key | Current Value | Notes |
|---|---|---|
| `services.axiom-api.base-url` | `https://certo-backend-api-dev.nicesea-0f99f3a9.eastus2.azurecontainerapps.io/api/v1` | External FQDN — reachable from any network |
| `services.mop-api.internal-url` | `http://ca-mop-dev.internal.delightfulbush-a7c589f7.eastus2.azurecontainerapps.io` | **Internal** to sentinel's CAE — see networking note below |
| `services.sentinel-api.fqdn` | `https://ca-sentinel-api-dev.delightfulbush-a7c589f7.eastus2.azurecontainerapps.io` | Sentinel API (external) |
| `services.prio.internal-url` | `http://ca-prio-dev.internal.delightfulbush-a7c589f7.eastus2.azurecontainerapps.io` | Internal to sentinel's CAE |

---

## 2. Networking Constraints — IMPORTANT

The appraisal-management containers run in a **different** Container App Environment
(`cae-appraisal-{env}` in `rg-appraisal-mgmt-{env}-eastus`) from sentinel's services
(`delightfulbush-a7c589f7` in `rg-sentinel-dev`).

**What this means:**

| Service | URL type | Reachable from appraisal CAE? |
|---|---|---|
| **Axiom** (`services.axiom-api.base-url`) | External FQDN | **Yes** — public HTTPS endpoint |
| **MOP** (`services.mop-api.internal-url`) | Internal (`*.internal.*`) | **No** — internal URLs are scoped to sentinel's CAE only |
| **Sentinel API** (`services.sentinel-api.fqdn`) | External FQDN | **Yes** — public HTTPS endpoint |

### Axiom Connectivity

Axiom's URL in App Config is an **external** FQDN. The appraisal-management-backend can
call it directly over HTTPS. This replaces the current hard-coded `.env` value:

```
# BEFORE (hard-coded in .env):
AXIOM_API_BASE_URL=https://axiom-dev-api.ambitioushill-a89e4aa0.eastus.azurecontainerapps.io

# AFTER (from App Config, key: services.axiom-api.base-url):
AXIOM_API_BASE_URL=https://certo-backend-api-dev.nicesea-0f99f3a9.eastus2.azurecontainerapps.io/api/v1
```

> **Note:** The App Config URL points to the **certo** Axiom deployment, not the older
> `axiom-dev-api` deployment. Confirm with the team which deployment is canonical before switching.
> The `/api/v1` suffix is included in the App Config value.

### MOP Connectivity

MOP (`ca-mop-dev`) has `ingress.external: false` — it is **only** reachable from within
sentinel's Container App Environment. The appraisal-management-backend **cannot** call
MOP directly using the internal URL from App Config.

**Options (choose one):**

1. **Route through Sentinel API** — Sentinel can reach MOP (same CAE). If sentinel-api
   exposes a proxy or compliance-check endpoint that fans out to MOP, call sentinel's
   external FQDN instead. The sentinel FQDN is available in App Config at
   `services.sentinel-api.fqdn`.

2. **Request external ingress on MOP** — Ask the sentinel team to flip `external: true`
   on `ca-mop-dev`. This makes it reachable via
   `https://ca-mop-dev.delightfulbush-a7c589f7.eastus2.azurecontainerapps.io`.
   Security implications must be evaluated (auth, rate-limiting, etc.).

3. **VNet peering** — More complex, likely overkill for dev. Involves linking the two
   CAE virtual networks. Skip unless prod-grade isolation is required.

**Current state in this codebase:** `ComplianceService` hard-codes `http://localhost:8090`
in the `MopApiClient` constructor. This must be replaced with an env var regardless of
which connectivity option is chosen.

---

## 3. Implementation Steps

### Step 3.1 — Add `@azure/app-configuration` dependency

```bash
pnpm add @azure/app-configuration
```

`@azure/identity` is already in `package.json` — no need to add it.

### Step 3.2 — Create an App Config loader module

Create a module (e.g. `src/config/appConfigLoader.ts`) that reads service URLs from
App Configuration at startup and populates `process.env`.

**Reference implementation (from sentinel-api):**

```typescript
// src/config/appConfigLoader.ts

import { AppConfigurationClient } from '@azure/app-configuration';
import { DefaultAzureCredential } from '@azure/identity';

/**
 * App Config key → process.env variable name
 *
 * Add entries here for every service URL this app needs from App Config.
 */
const KEY_TO_ENV: Record<string, string> = {
  'services.axiom-api.base-url': 'AXIOM_API_BASE_URL',
  // When MOP connectivity is resolved (see networking section):
  // 'services.mop-api.internal-url': 'MOP_API_BASE_URL',
  // Sentinel API (if you need to call it as a proxy):
  // 'services.sentinel-api.fqdn': 'SENTINEL_API_BASE_URL',
};

/**
 * Load service discovery URLs from Azure App Configuration into process.env.
 *
 * - Skips entirely if AZURE_APP_CONFIGURATION_ENDPOINT is not set (local dev / tests).
 * - Never overwrites an env var that already has a value.
 * - Errors are logged but do not crash startup.
 */
export async function loadAppConfig(): Promise<void> {
  const endpoint = process.env['AZURE_APP_CONFIGURATION_ENDPOINT'];
  if (!endpoint) {
    return; // Not configured — local dev or tests
  }

  const label = process.env['APP_CONFIG_LABEL'] ?? 'dev';

  try {
    const client = new AppConfigurationClient(
      endpoint,
      new DefaultAzureCredential()
    );

    for (const [appConfigKey, envVar] of Object.entries(KEY_TO_ENV)) {
      try {
        const setting = await client.getConfigurationSetting({
          key: appConfigKey,
          label,
        });

        if (!setting.value) continue;

        if (process.env[envVar]) {
          console.log(`[appconfig] Skipped ${envVar} (already set)`);
        } else {
          process.env[envVar] = setting.value;
          console.log(`[appconfig] Set ${envVar} = ${setting.value}`);
        }
      } catch (err: unknown) {
        if (
          err instanceof Error &&
          'statusCode' in err &&
          (err as { statusCode: number }).statusCode === 404
        ) {
          continue; // Key doesn't exist for this label
        }
        console.warn(`[appconfig] Failed to read "${appConfigKey}":`, err);
      }
    }
  } catch (err) {
    console.warn('[appconfig] Could not connect — continuing with env vars:', err);
  }
}
```

### Step 3.3 — Wire the loader into application startup

Call `loadAppConfig()` **before** any service constructors that read `process.env`:

```typescript
// In your main entry point (e.g. src/index.ts or src/server.ts), BEFORE express app setup:

import { loadAppConfig } from './config/appConfigLoader.js';

async function main() {
  // 1. Load .env (if using dotenv)
  // 2. Load App Config (fills any gaps)
  await loadAppConfig();
  // 3. Now build the Express app (services read process.env here)
  // ...
}
```

### Step 3.4 — Fix the MOP hard-coded URL

In `ComplianceService` (or wherever `MopApiClient` is instantiated), replace the
hard-coded `http://localhost:8090` with an environment variable:

```typescript
// BEFORE:
this.apiClient = new MopApiClient('http://localhost:8090');

// AFTER:
const mopBaseUrl = process.env['MOP_API_BASE_URL'];
if (!mopBaseUrl) {
  throw new Error(
    'MOP_API_BASE_URL is required but not set. ' +
    'Set it via env var or Azure App Configuration.'
  );
}
this.apiClient = new MopApiClient(mopBaseUrl);
```

### Step 3.5 — Add RBAC: App Configuration Data Reader

The appraisal-management managed identity needs **App Configuration Data Reader** on the
App Config store. Add a Bicep module:

```bicep
// infrastructure/modules/appconfig-reader-role.bicep

@description('Principal ID of the managed identity that needs read access.')
param principalId string

@description('Name of the App Configuration store.')
param appConfigName string

// App Configuration Data Reader built-in role
var appConfigDataReaderRoleId = '516239f1-63e1-4d78-a4de-a74fb236a071'

resource appConfig 'Microsoft.AppConfiguration/configurationStores@2023-03-01' existing = {
  name: appConfigName
}

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(appConfig.id, principalId, appConfigDataReaderRoleId)
  scope: appConfig
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      appConfigDataReaderRoleId
    )
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}
```

Wire this into your `main.bicep`, passing the managed identity's `principalId` and
targeting the App Config store's resource group (`certo-global-dev-rg`).

**Alternatively**, for a quick one-time dev grant via CLI:

```bash
# Find Your managed identity's principal ID:
az identity show \
  --name <your-managed-identity-name> \
  --resource-group rg-appraisal-mgmt-staging-eastus \
  --query principalId -o tsv

# Grant App Configuration Data Reader:
az role assignment create \
  --assignee "<principal-id>" \
  --role "App Configuration Data Reader" \
  --scope "/subscriptions/58c05da3-214f-4532-a6c2-c5f387728100/resourceGroups/certo-global-dev-rg/providers/Microsoft.AppConfiguration/configurationStores/appconfig-certo-dev"
```

> **Remember:** The CLI grant is for bootstrapping only. Put it in Bicep for production.

### Step 3.6 — Add env vars to Container App (Bicep)

In the Bicep module that defines the appraisal container app, add these env vars:

```bicep
{
  name: 'AZURE_APP_CONFIGURATION_ENDPOINT'
  value: 'https://appconfig-certo-${environment}.azconfig.io'
}
{
  name: 'APP_CONFIG_LABEL'
  value: environment  // 'dev', 'staging', or 'prod'
}
```

Or, if the container app is deployed via `az containerapp update` in the GitHub Actions
workflow, add `--set-env-vars`:

```bash
az containerapp update \
  --name <container-app-name> \
  --resource-group <rg> \
  --set-env-vars \
    "AZURE_APP_CONFIGURATION_ENDPOINT=https://appconfig-certo-${ENV}.azconfig.io" \
    "APP_CONFIG_LABEL=${ENV}"
```

### Step 3.7 — Local development

For **local dev**, you do NOT need App Config. The loader silently skips if
`AZURE_APP_CONFIGURATION_ENDPOINT` is not set. Continue using `.env`:

```dotenv
# .env (local dev)
AXIOM_API_BASE_URL=https://axiom-dev-api.ambitioushill-a89e4aa0.eastus.azurecontainerapps.io
MOP_API_BASE_URL=http://localhost:8090
```

If you **want** to test App Config locally, you can:
1. `az login` (your personal account needs Data Reader role)
2. Set `AZURE_APP_CONFIGURATION_ENDPOINT=https://appconfig-certo-dev.azconfig.io` in `.env`
3. The `DefaultAzureCredential` will use your Azure CLI login

---

## 4. Axiom URL Migration Note

The appraisal-management-backend currently uses:
```
AXIOM_API_BASE_URL=https://axiom-dev-api.ambitioushill-a89e4aa0.eastus.azurecontainerapps.io
```

This points to the **legacy** axiom deployment in `axiom-dev-rg`.

The centralized App Config value (`services.axiom-api.base-url`) points to:
```
https://certo-backend-api-dev.nicesea-0f99f3a9.eastus2.azurecontainerapps.io/api/v1
```

This is the **certo** axiom deployment in `certo-dev-eastus2-rg`.

**Before switching**, confirm with the team:
- Are both deployments functionally equivalent?
- Does the new URL include `/api/v1` (it does — the `AxiomService` constructor needs the
  base URL **without** path prefixes, or needs to handle the suffix)
- Test connectivity from the appraisal container app to the new URL

---

## 5. Summary Checklist

- [ ] `pnpm add @azure/app-configuration`
- [ ] Create `src/config/appConfigLoader.ts` (see Step 3.2)
- [ ] Call `loadAppConfig()` before app/service initialization (Step 3.3)
- [ ] Replace hard-coded MOP URL with `MOP_API_BASE_URL` env var (Step 3.4)
- [ ] Grant `App Configuration Data Reader` RBAC to managed identity (Step 3.5)
- [ ] Add `AZURE_APP_CONFIGURATION_ENDPOINT` and `APP_CONFIG_LABEL` env vars to Bicep / deploy workflow (Step 3.6)
- [ ] Decide on MOP connectivity approach (proxy via sentinel, external ingress, or VNet peering)
- [ ] Validate Axiom URL compatibility (legacy vs certo deployment)
- [ ] Update `.env` for local dev (Step 3.7)
- [ ] Test in deployed environment

---

## 6. Quick Reference — Azure Resource IDs

```
Subscription:  58c05da3-214f-4532-a6c2-c5f387728100
App Config:    /subscriptions/58c05da3-214f-4532-a6c2-c5f387728100/resourceGroups/certo-global-dev-rg/providers/Microsoft.AppConfiguration/configurationStores/appconfig-certo-dev
RBAC Role:     App Configuration Data Reader (516239f1-63e1-4d78-a4de-a74fb236a071)
```
