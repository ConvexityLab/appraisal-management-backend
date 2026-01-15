# GitHub Actions Workflow Logic

## Overview
The deployment workflow uses path-based detection to run only the necessary jobs:
- **Infrastructure changes** → Only deploy infrastructure
- **Code changes** → Build, test, and deploy containers
- **Workflow changes** → Nothing deploys (paths-ignore)
- **Documentation changes** → Nothing deploys (paths-ignore)

## How It Works

### 1. Change Detection (`detect-changes` job)
Uses the `dorny/paths-filter@v3` action to detect what files changed:

```yaml
detect-changes:
  outputs:
    infrastructure: true/false  # Did infrastructure/** change?
    code: true/false            # Did src/**, package.json, Dockerfile, etc. change?
```

**Monitored Paths:**
- `infrastructure`: infrastructure/**
- `code`: src/**, package.json, package-lock.json, Dockerfile, tsconfig*.json

### 2. Conditional Job Execution

**CI/Build/Deploy Jobs** (run only if code changed):
```yaml
build-and-test:
  needs: detect-changes
  if: needs.detect-changes.outputs.code == 'true'

run-ci-pipeline:
  needs: [determine-environment, detect-changes]
  if: needs.detect-changes.outputs.code == 'true'

build-and-push-container:
  needs: [determine-environment, run-ci-pipeline, detect-changes]
  if: |
    needs.detect-changes.outputs.code == 'true' &&
    needs.run-ci-pipeline.result == 'success'

deploy-container-app:
  needs: [determine-environment, deploy-infrastructure, build-and-push-container, detect-changes]
  if: needs.detect-changes.outputs.code == 'true'
```

**Infrastructure Job** (runs if infrastructure changed OR manual deploy requested):
```yaml
deploy-infrastructure:
  needs: [determine-environment, detect-changes]
  if: |
    needs.detect-changes.outputs.infrastructure == 'true' ||
    needs.determine-environment.outputs.deploy-infrastructure == 'true'
```

## Deployment Scenarios

| Files Changed | Jobs That Run | Duration |
|--------------|---------------|----------|
| `src/**` only | CI → Build → Deploy Containers | ~5-7 minutes |
| `infrastructure/**` only | Deploy Infrastructure | ~3-5 minutes |
| Both src & infrastructure | All jobs | ~15 minutes |
| `.github/workflows/**` | NOTHING (paths-ignore) | 0 minutes |
| `docs/**` or `*.md` | NOTHING (paths-ignore) | 0 minutes |

## Manual Overrides

### Workflow Dispatch (Manual Trigger)
You can manually trigger with options:
```yaml
environment: dev/staging/prod
deploy_infrastructure: true/false
```

This overrides the auto-detection and forces infrastructure deployment if requested.

## Critical Safeguards

1. **No Duplicate Triggers**: `infrastructure.yml` uses ONLY `workflow_call` (no push trigger)
2. **Workflow Changes Don't Deploy**: `.github/workflows/**` in paths-ignore
3. **Conditional Dependencies**: Jobs depend on change detection, preventing unnecessary runs
4. **Manual Override Available**: workflow_dispatch allows forcing infrastructure deployment

## Why This Design?

**Problem We Solved:**
- Original: Every push ran full 15-minute pipeline
- Attempted fix: paths-ignore for infrastructure/** → broke infrastructure deployments
- Attempted fix 2: Added push trigger to infrastructure.yml → infinite deployment loop

**Current Solution:**
- Change detection job determines what to run
- Each job conditionally executes based on detection
- No duplicate triggers
- Infrastructure changes deploy ONLY infrastructure
- Code changes deploy ONLY code

## Monitoring

Check what ran: https://github.com/ConvexityLab/appraisal-management-backend/actions

Expected behavior:
- Infrastructure commit → Only "Deploy Infrastructure" job runs (green)
- Code commit → CI, Build, Deploy Container jobs run; Infrastructure skipped (gray)
- Workflow commit → No workflow triggered at all
