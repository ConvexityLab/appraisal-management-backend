# AIM-Port Integration Points

## Purpose

This document describes the current integration surface between AIM-Port and our appraisal platform so it can be shared with AIM-Port for implementation and support alignment.

It covers:
- inbound calls from AIM-Port into our platform
- outbound calls from our platform to AIM-Port
- how the AIM-Port connection is resolved
- where requests are initiated from each side
- where results are stored internally
- where operators review the results
- authentication expectations
- request/response shapes
- the required scheduling payload contract for `OrderScheduledRequest`

---

## Integration Flow Summary

The integration is bidirectional.

### 1. AIM-Port initiates inbound requests to us

AIM-Port sends appraisal lifecycle updates into our inbound integration endpoint.

Examples:
- new order intake
- order accepted / assigned / held / resumed / cancelled
- inspection scheduled / inspected
- revision requests
- file delivery
- message delivery

Those inbound requests are normalized into canonical vendor events before downstream processing.

### 2. We initiate outbound requests to AIM-Port

Our platform initiates outbound AIM-Port calls when our internal workflow publishes a normalized vendor event that maps to an AIM-Port request type.

Examples:
- we mark an order accepted and send `OrderAcceptedRequest`
- we schedule an inspection and send `OrderScheduledRequest`
- we send final files through `OrderFilesRequest`
- we send messages through `MessageRequest`

Outbound delivery is adapter-driven and uses the configured AIM-Port connection for the lender / tenant context.

---

## How The AIM-Port Connection Is Resolved

Each AIM-Port integration is stored as a configured vendor connection in our platform.

For inbound traffic:
- AIM-Port sends `login.client_id`
- we use that identifier to resolve the active AIM-Port connection
- we validate `login.api_key` against the configured inbound secret for that connection

For outbound traffic:
- we resolve the active AIM-Port connection for the event being dispatched
- we use the configured outbound endpoint URL
- we send the configured outbound `client_id` and outbound API key

This means the connection is not hardcoded in request handlers; it is determined from the active vendor-connection configuration.

---

## Where Requests Are Initiated

### Inbound initiation point

AIM-Port initiates inbound requests to:

- `POST /api/v1/integrations/aim-port/inbound`

This is the public entry point for AIM-Port payloads. Each vendor has its own
URL path under `/api/v1/integrations/{vendor}/inbound` so that per-vendor edge
policies (IP allow-list, rate limit, request-size cap) can be applied at the
gateway layer without touching application code.

### Outbound initiation point

We initiate outbound AIM-Port requests from internal workflow events.

The outbound trigger is not a separate public AIM-Port-facing route. Instead, our system:
1. publishes a normalized vendor event
2. resolves the AIM-Port connection
3. builds the AIM-Port payload from that event
4. sends the request to the configured AIM-Port outbound endpoint

Operationally, this means AIM-Port will receive outbound requests from us whenever the corresponding internal order state or document/message workflow reaches that event.

---

## Where Results Are Stored Internally

We store AIM-Port integration results in multiple internal stores depending on the event type.

### 1. Durable vendor event outbox

All normalized inbound AIM-Port events are first persisted to the durable vendor event outbox.

Purpose:
- durable intake record
- replay protection / deduplication support
- retry and dead-letter handling
- operational visibility into what was received

### 2. Order record updates

Lifecycle events update the internal order record.

Examples:
- acceptance status
- hold / resume / cancellation status
- due date changes
- fee changes
- payment status
- inspection scheduled / completed timestamps

### 3. Inspection artifacts

`OrderScheduledRequest` creates an internal inspection artifact tied to the order.

Stored details include:
- scheduled slot
- appraiser reference
- property access details
- scheduling notes
- requested-by source

### 4. Revision artifacts

`RevisionRequest` creates:
- an internal revision record
- an inbound communication record linked to the order

### 5. Documents and files

Vendor file deliveries are stored as:
- document metadata in the `documents` store
- file binaries in Azure Blob Storage

### 6. Communications

Inbound AIM-Port messages are stored as internal communication records tied to the order and vendor thread.

---

## Where Results Are Viewed

The main internal review surfaces are:

### Vendor outbox monitor

Used to review inbound processing state, retries, and dead-letter items.

UI route:
- `/admin/vendor-outbox`

Used for:
- backlog visibility
- failed event review
- dead-letter acknowledgment
- requeue operations

### Revision management

Used to review revision artifacts created from AIM-Port revision requests.

UI routes:
- `/revision-management`
- `/revision-management/:id`

### Inspection queue

Used to review inspection appointments created from AIM-Port scheduling events.

UI route:
- `/construction/inspections`

### Order-linked documents and communications

Files, messages, and status effects are also available through the platform's normal order detail, document, and communication experiences.

---

## Base Endpoint

AIM-Port should send inbound API calls to the APIM gateway:

- `POST https://{apim-gateway}/api/v1/integrations/aim-port/inbound`

The gateway URL per environment (output as `aimPortInboundUrl` from the Bicep
deployment):

- dev:     `https://apim-appraisal-dev-{suffix}.azure-api.net/api/v1/integrations/aim-port/inbound`
- staging: `https://apim-appraisal-staging-{suffix}.azure-api.net/api/v1/integrations/aim-port/inbound`
- prod:    `https://apim-appraisal-prod-{suffix}.azure-api.net/api/v1/integrations/aim-port/inbound`

Notes:
- Requests must be JSON.
- AIM-Port authentication is handled inside the integration layer, not by standard app-user auth or APIM subscription keys (the APIM API has `subscriptionRequired: false`).
- The vendor adapter is selected from the URL path (`aim-port`); the request body shape is sanity-checked against that adapter and a 400 is returned on mismatch.
- The connection (tenant) is resolved from `login.client_id` inside the body.
- **Dev tier note:** dev is on APIM Consumption tier with a 1 MB request-body cap. Large `OrderFilesRequest` payloads will 413 in dev — staging and prod (Basic tier) accept up to 250 MB.

---

## Authentication

### Inbound AIM-Port → Our Platform

Each AIM-Port request must include a `login` object with:

- `client_id` — the AIM-Port client/account identifier
- `api_key` — the AIM-Port shared secret for that client
- `order_id` — required on update/event-style requests

Example:

```json
{
  "OrderAcceptedRequest": {
    "login": {
      "client_id": "501102",
      "api_key": "<shared-secret>",
      "order_id": "AP-1001"
    },
    "order": {
      "vendor_first_name": "Pat",
      "vendor_last_name": "Appraiser"
    }
  }
}
```

Validation rules:
- `login.client_id` must match the connection configured for AIM-Port.
- `login.api_key` must match the configured inbound AIM-Port secret for that connection.
- If either is missing or invalid, the request is rejected.

### Outbound Our Platform → AIM-Port

For outbound AIM-Port calls, our platform sends:

- `login.client_id`
- `login.api_key`
- `login.order_id`

These values are resolved from the configured AIM-Port connection.

---

## Response Contract

### Success Response

On successful processing, the platform returns an AIM-Port-style acknowledgment.

Typical response:

```json
{
  "client_id": "501102",
  "success": "true",
  "order_id": "AP-1001"
}
```

For initial `OrderRequest`, the response may also include:

- `order_id` — our internal mapped order reference when created/resolved
- `fee` — disclosed fee if available

Example:

```json
{
  "client_id": "501102",
  "success": "true",
  "order_id": "order-123",
  "fee": 550
}
```

### Error Response

On failure, the platform returns standard JSON:

```json
{
  "success": false,
  "error": {
    "code": "VENDOR_INTEGRATION_INBOUND_FAILED",
    "message": "<reason>"
  }
}
```

Typical status codes:
- `400` — malformed payload, missing required fields, or unsupported request shape
- `401` — authentication failure
- `404` — referenced connection or resource could not be resolved
- `500` — unexpected internal error

---

## Inbound AIM-Port Request Types

The following AIM-Port request types are implemented for inbound processing.

| AIM-Port request type | Normalized event | Purpose |
|---|---|---|
| `OrderRequest` | `vendor.order.received` | Create or resolve the internal order reference and ingest initial order details |
| `MessageRequest` | `vendor.message.received` | Persist inbound partner/order messages |
| `NewFilesRequest` | `vendor.file.received` | Persist incremental vendor files |
| `LoanNumUpdateRequest` | `vendor.loan_number.updated` | Update internal loan number |
| `FHANumUpdateRequest` | `vendor.fha_case_number.updated` | Update internal FHA case number |
| `RevisionRequest` | `vendor.revision.requested` | Create internal revision artifact and communication record |
| `OrderAssignedRequest` | `vendor.order.assigned` | Mark assignment state |
| `OrderAcceptedRequest` | `vendor.order.accepted` | Mark acceptance state and store vendor acceptance metadata |
| `OrderHoldRequest` | `vendor.order.held` | Mark order on hold |
| `OrderResumeRequest` | `vendor.order.resumed` | Resume in-progress work |
| `OrderCancelledRequest` | `vendor.order.cancelled` | Cancel order |
| `OrderScheduledRequest` | `vendor.order.scheduled` | Create internal inspection artifact and mark inspection scheduled |
| `OrderInspectedRequest` | `vendor.order.inspected` | Mark inspection complete |
| `OrderDueDateRequest` | `vendor.order.due_date_changed` | Update due date |
| `OrderFeeChangeRequest` | `vendor.order.fee_changed` | Update vendor fee |
| `OrderPaidRequest` | `vendor.order.paid` | Mark payment received |
| `DocsNoCompletionRequest` | `vendor.file.received_no_completion` | Persist documents without full completion event |
| `OrderFilesRequest` | `vendor.order.completed` | Persist final files and mark order submitted |

Currently recognized but not used for downstream business processing:
- `ProductListRequest`
- `GetOrderRequest`
- `OrderUpdateRequest`

---

## Outbound Request Types We Can Send To AIM-Port

The following outbound AIM-Port request types are implemented when our platform publishes the corresponding normalized vendor event.

| Normalized event | AIM-Port request type |
|---|---|
| `vendor.order.assigned` | `OrderAssignedRequest` |
| `vendor.order.accepted` | `OrderAcceptedRequest` |
| `vendor.order.held` | `OrderHoldRequest` |
| `vendor.order.resumed` | `OrderResumeRequest` |
| `vendor.order.cancelled` | `OrderCancelledRequest` |
| `vendor.order.scheduled` | `OrderScheduledRequest` |
| `vendor.order.inspected` | `OrderInspectedRequest` |
| `vendor.order.due_date_changed` | `OrderDueDateRequest` |
| `vendor.order.fee_changed` | `OrderFeeChangeRequest` |
| `vendor.order.paid` | `OrderPaidRequest` |
| `vendor.file.received_no_completion` | `DocsNoCompletionRequest` |
| `vendor.order.completed` | `OrderFilesRequest` |
| `vendor.message.received` | `MessageRequest` |

---

## Required Scheduling Contract For `OrderScheduledRequest`

This is the current required contract for inspection scheduling.

### Required AIM-Port Fields

Inside `OrderScheduledRequest.order`, AIM-Port must provide:

- `inspection_date` — ISO date, example: `2026-04-25`
- `appraiser_id` — the internal/partner appraiser identifier that both sides agree on
- `scheduled_start_time` — 24-hour `HH:mm`, example: `09:00`
- `scheduled_end_time` — 24-hour `HH:mm`, example: `11:00`
- `scheduled_timezone` — IANA timezone, example: `America/Chicago`
- `requested_by` — one of:
  - `appraiser`
  - `client`
  - `system`
  - `homeowner`
- `property_access` — object with required contact details

### Required `property_access` Fields

Inside `order.property_access`, AIM-Port must provide:

- `name` — access/contact name
- one of phone values:
  - `cell_phone`, or
  - `home_phone`, or
  - `work_phone`

### Optional Scheduling Fields

Optional but supported:

- `inspection_notes`
- `appointment_type` — one of:
  - `property_inspection`
  - `appraisal_appointment`
  - `bpo_site_visit`
- `property_access.email`
- `property_access.access_instructions`
- `property_access.requires_escort`
- `property_access.pet_warning`
- `property_access.parking_instructions`
- `property_access.special_requirements`
- `property_access.other_description`

### Example `OrderScheduledRequest`

```json
{
  "OrderScheduledRequest": {
    "login": {
      "client_id": "501102",
      "api_key": "<shared-secret>",
      "order_id": "AP-1001"
    },
    "order": {
      "inspection_date": "2026-04-25",
      "appraiser_id": "appraiser-42",
      "scheduled_start_time": "09:00",
      "scheduled_end_time": "11:00",
      "scheduled_timezone": "America/Chicago",
      "requested_by": "client",
      "inspection_notes": "Morning appointment only",
      "appointment_type": "property_inspection",
      "property_access": {
        "type": "scheduled_access",
        "name": "Jane Borrower",
        "cell_phone": "555-0100",
        "email": "jane@example.com",
        "access_instructions": "Gate code 1234",
        "requires_escort": false,
        "pet_warning": "Dog in yard",
        "parking_instructions": "Street parking only",
        "special_requirements": ["Call on arrival"]
      }
    }
  }
}
```

### Validation Behavior

If any required scheduling field is missing, the request is rejected with `400`.

Example failure message:

```json
{
  "success": false,
  "error": {
    "code": "VENDOR_INTEGRATION_INBOUND_FAILED",
    "message": "AIM-Port OrderScheduledRequest is missing required scheduling fields: appraiser_id, scheduled_start_time, scheduled_end_time, scheduled_timezone, requested_by, property_access"
  }
}
```

---

## Files Payload

For `NewFilesRequest`, `DocsNoCompletionRequest`, and `OrderFilesRequest`, files are expected in AIM-Port file format:

```json
{
  "file_id": "file-1",
  "content": "<base64>",
  "filename": "report.pdf",
  "category": "appraisal",
  "category_label": "Appraisal Report",
  "description": "Final signed report"
}
```

---

## Revision Messages

For `RevisionRequest`, the platform expects:

```json
{
  "RevisionRequest": {
    "login": {
      "client_id": "501102",
      "api_key": "<shared-secret>",
      "order_id": "AP-1001"
    },
    "message": {
      "subject": "Revision requested",
      "content": "Please revise the report for condition comments."
    }
  }
}
```

This creates:
- an internal communication record
- an internal revision artifact linked to the order
- an order status transition to `REVISION_REQUESTED`

---

## Delivery / Processing Semantics

### Inbound
- Inbound AIM-Port requests are normalized into canonical vendor events.
- Normalized events are persisted to the vendor-event outbox before downstream processing.
- Downstream consumers then create internal artifacts such as communications, revisions, documents, and inspections.

### Outbound
- Outbound AIM-Port calls are built from normalized vendor events and sent synchronously using the configured AIM-Port endpoint.

---

## Operational Notes

- The integration is connection-based, so each AIM-Port client/account must have a configured active connection.
- `client_id` is the primary inbound connection lookup key.
- Scheduling events now create internal inspection appointments, so the scheduling contract above must remain stable.
- If AIM-Port wants to add new request types or fields, they should be versioned and reviewed before rollout.

---

## Change Coordination

If AIM-Port plans to change any of the following, coordination is required before release:
- `login` structure
- request wrapper names such as `OrderScheduledRequest`
- required scheduling field names
- file payload shape
- accepted enum values for `requested_by` or `appointment_type`

Recommended process:
1. Share sample payloads in advance.
2. Validate in a lower environment.
3. Confirm acknowledgment and downstream artifact behavior.
4. Promote after successful end-to-end verification.
