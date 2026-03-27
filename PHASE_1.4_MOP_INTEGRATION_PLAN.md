# Phase 1.4: MOP Rules Engine Integration Plan

This document outlines the step-by-step comprehensive implementation plan for integrating the C++ Mortgage Origination Platform (MOP) Rete-NT engine into our Node.js Appraisal Management backend to power our Automated Compliance Rules.

## 1. MOP Rules Configuration (Appraisal Context)
- [x] Create `appraisal-compliance.json` inside MOP `config/rules/`.
- [ ] Define full set of USPAP/UAD compliance rules in the JSON DSL:
  - Net adjustment > 15% / Gross adjustment > 25%
  - Property condition C6 (Severe deficiencies)
  - Zoning issues (e.g., Commercial)
  - Missing mandatory fields (e.g., effective date, license numbers)
- [ ] Define the exact expected Input "Fact" payload schema for MOP corresponding to these rules.

## 2. Backend Data Transformation Layer (Node.js)
- [ ] Create `src/services/mop/MopMapperService.ts` in the Node backend.
- [ ] Implement `mapAppraisalToMopFacts(appraisal: CanonicalAppraisal)` method to transform our nested appraisal schema into the flat JSON structure expected by the MOP engine.
- [ ] Add unit tests (`MopMapperService.test.ts`) using mock `CanonicalAppraisal` objects.

## 3. MOP API Client Integration (Node.js)
- [ ] Create `src/services/mop/MopApiClient.ts`.
- [ ] Implement robust REST client (using `fetch` or `axios`) targeted at MOP's evaluation endpoint (e.g., `POST http://localhost:8090/api/v1/quote` or similar).
- [ ] Implement explicit error handling, retries, and timeouts (since cross-service comms can fail).
- [ ] Implement response parsing: map the Rete-NT rule violations/actions (`assert` actions) back into an internal `ComplianceResult[]` interface.

## 4. App Integration & Service Layer
- [ ] Create `src/services/ComplianceService.ts` to orchestrate:
  1. Fetching `CanonicalAppraisal` from CosmosDB.
  2. Calling `MopMapperService`.
  3. Passing payload to `MopApiClient`.
  4. Saving the `ComplianceResult` output back to the Appraisal record in CosmosDB.
- [ ] Update CosmosDB schema/types (`AppraisalDocument`) to include a `compliance` array field.

## 5. Backend Routes
- [ ] Add Express route `POST /api/appraisals/:id/compliance-check` for triggering manual evaluations.
- [ ] Add trigger to run the compliance check automatically when an appraisal is submitted/uploaded.
- [ ] Update Swagger/OpenAPI documentation for the new endpoints.

## 6. Frontend Integration
- [ ] Add the `POST` API call to the UI's service layer.
- [ ] Create a "Compliance Stops" UI component on the Appraisal details page to prominently display hard stops versus warnings.
- [ ] Ensure the UI handles the loading states while the `ComplianceService` queries the MOP engine.

## 7. Testing & Verification
- [ ] Ensure all Node.js unit tests pass (`pnpm vitest`).
- [ ] Write integration test mocking the MOP API response to ensure standard compliance violations stop the appraisal acceptance logic.
- [ ] Perform end-to-end test manually against a running MOP instance.
