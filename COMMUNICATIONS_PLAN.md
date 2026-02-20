# Communications System — Architecture Plan

## 1. Who We Talk To and How

| Constituent | Relationship | Primary Channels | Why |
|---|---|---|---|
| **AMC Internal Staff** (operations, QC analysts, managers) | Internal — all have Entra ID + Teams licenses | **Teams** (channels, meetings, 1:1 chat), **in-app notifications** | They live in Teams and the platform. Real-time collaboration on QC, escalations, dispute resolution. |
| **Vendors** (appraisal firms) | External — contracted partners, no Teams license | **Email** (primary), **SMS** (urgent), **ACS Chat** (embedded in portal) | They use their own systems. Email for formal comms (assignments, counter-offers). SMS for time-sensitive (4-hour acceptance windows, deadline reminders). ACS Chat for ongoing order discussion. |
| **Appraisers** (licensed individuals working for vendors) | External — field workers, mobile-first | **SMS** (primary), **Email** (formal), **ACS Chat** (order-contextual) | Mobile in the field. SMS for scheduling, reminders. Email for revision requests, report feedback. |
| **Clients / Lenders** (banks, credit unions) | External — B2B customers | **Email** (primary), **in-app portal** | Formal business communications. Order status, delivery notifications, ROV correspondence. They don't need real-time chat. |
| **Borrowers** (homeowners/buyers) | External — end consumers | **SMS** (primary), **Email** (confirmation) | Inspection scheduling only. SMS for appointment reminders, rescheduling. Minimal, privacy-conscious contact. |

## 2. What Actually Works Today

### ✅ Confirmed Working
| Component | Status | Evidence |
|---|---|---|
| ACS Token Exchange | ✅ | `GET /api/acs/token` → returns `acsUserId` + `token` with `chat` + `voip` scopes |
| ACS Identity Service | ✅ | Creates ACS users, maps Azure AD → ACS IDs in Cosmos `acsUserMappings` |
| ACS Email Sending | ✅ | `POST /api/communications/email` → uses `EmailClient` with `DoNotReply@loneanalytics.com` |
| Communication History | ✅ | CRUD in Cosmos `communications` container, History tab works |
| Cosmos DB | ✅ | All containers declared, staging endpoint working |
| Frontend Auth (MSAL) | ✅ | JWT tokens, tenant ID, user info all flow correctly |
| RTK Query API Layer | ✅ | `baseApi` with auth headers, cache tags, error handling |
| ACS React Composites | ✅ | `@azure/communication-react@1.31.0` installed, imports verified |

### ⚠️ Configured But Unverified (needs testing)
| Component | Status | Issue |
|---|---|---|
| MS Graph API | ⚠️ | Client ID + Secret + Tenant are in `.env`, but we haven't verified the app registration has the required Graph permissions granted (OnlineMeetings.ReadWrite.All, Chat.Create, etc.) |
| Teams Meeting Creation | ⚠️ | `TeamsService.createOrderMeeting()` is implemented and calls Graph, but we just saw "Failed to create Teams meeting" — likely a permissions or `organizerUserId` issue |
| ACS Chat Thread Creation | ⚠️ | `AcsChatService.createThread()` is implemented, but depends on the unified context flow which has never been tested end-to-end |
| ACS Calling (VoIP) | ⚠️ | Group call ID generation works (it's just a UUID), but the `CallComposite` needs a real user token with `voip` scope to join — scope IS included in token, so should work |

### ❌ Not Working / Not Configured
| Component | Status | Fix Required |
|---|---|---|
| SMS Sending | ❌ | No `AZURE_COMMUNICATION_SMS_NUMBER` env var. Need to purchase a phone number in the ACS resource in Azure Portal. |
| Teams Channel Email Notifications | ❌ | Uses `EmailService` which needs SMTP/SendGrid config — not present in `.env` |
| `CommunicationsService` in frontend | ❌ | Uses `process.env.REACT_APP_*` which are always empty in Vite. Dead code. |

## 3. Recommended Architecture

### Principle: Don't Boil the Ocean

Instead of trying to make ACS Calling composites, Teams meetings, and real-time chat all work simultaneously, **layer the system by reliability and business value:**

### Layer 1 — Must Work NOW (Email + History + In-App Compose)
**Value:** 90% of business communications are asynchronous. Email is the backbone of AMC operations.

- ✅ **Already working:** Send email via ACS, store in Cosmos, view in History tab, inline compose
- **Fix needed:** None — this is done.

### Layer 2 — Must Work SOON (SMS + Notification Templates)
**Value:** SMS is critical for borrower scheduling, vendor acceptance windows, appraiser reminders.

- **Fix needed:** Purchase an ACS phone number in Azure Portal → set `AZURE_COMMUNICATION_SMS_NUMBER` in `.env`
- **Fix needed:** The SMS backend endpoint works, just needs the phone number
- **Scope:** Template-based SMS (not free-form). Pre-built templates for: inspection scheduling, acceptance reminders, deadline warnings, status updates.

### Layer 3 — Should Work (ACS Chat for Order Context)
**Value:** Real-time chat for ongoing order discussions between AMC staff and vendors/appraisers. Replaces email chains for back-and-forth.

**Architecture:**
```
User clicks "Chat" on order page
  → Frontend calls GET /api/communication/contexts/order/{orderId}
  → If no context exists, POST /api/communication/contexts (creates one)
  → POST /api/communication/contexts/{contextId}/chat (creates ACS thread)
  → Frontend creates ChatAdapter with threadId + user token
  → ChatComposite renders inline in the tray
```

**What needs to work:**
1. Context creation (backend — exists, needs testing)
2. Chat thread creation via ACS SDK (backend — exists, needs testing)
3. ChatAdapter creation (frontend — code exists, just wired to error stubs)
4. Persistent thread association so reopening the tray shows the same chat

**What does NOT need to work for this:**
- No WebSocket server needed — ACS handles real-time via its own infra
- No server-side message handling — messages flow peer-to-peer through ACS
- No in-memory session management — remove the `ChatService.userSessions` pattern

### Layer 4 — Nice to Have (ACS Calling / VoIP)
**Value:** Quick voice/video calls between AMC staff and vendors without leaving the platform. Lower priority because people have phones.

**Architecture:**
```
User clicks "Call"
  → Backend generates groupCallId (UUID)
  → Frontend creates CallAdapter with groupId locator
  → CallComposite renders inline
  → Other participant gets a link/notification to join the same groupId
```

**Key gap:** There's no way to INVITE the other party to the call yet. The caller starts a call in an empty room. We need either:
- A notification mechanism (email/SMS with a join link)
- An in-app notification to the other user's tray

### Layer 5 — Future (Teams Meetings)
**Value:** Formal scheduled meetings for dispute resolution, QC reviews, complex discussions. Important but not daily.

**Architecture:**
```
User fills meeting form (subject, participants, time)
  → Backend calls MS Graph POST /users/{organizerId}/onlineMeetings
  → Returns joinUrl
  → For internal users: Teams meeting notification via Graph
  → For external users: Email with join link (ACS interop — join via browser)
  → In the tray: CallWithChatComposite with meetingLink locator
```

**Blocker:** The "Failed to create Teams meeting" error. Likely causes:
1. The `organizerUserId` must be a valid Azure AD user principal name (e.g., `L1Admin@l1-analytics.com`), NOT an ACS user ID
2. The app registration needs `OnlineMeetings.ReadWrite.All` application permission GRANTED (not just requested)
3. The app needs admin consent for this permission

## 4. Immediate Fix Plan (What to Do RIGHT NOW)

### Step 1: Fix the Teams Meeting Error
The error in your screenshot means the `scheduleMeeting` backend call failed. We need to:
1. Check what error the backend is actually throwing (check the backend console/logs)
2. The `organizerUserId` we're passing is the ACS user ID (`8:acs:...`), but Graph API needs an Azure AD user principal name or object ID
3. Fix the handler to pass the actual Azure AD user ID instead

### Step 2: Remove the "Setup Checklist" Banner
That blue "Azure Communications setup checklist" box is showing even though ACS IS configured. It's a stale check from the old code.

### Step 3: Test Each Channel Independently
- Email: Already works ✅
- Chat: Click "Open Chat" → check backend logs for errors
- Call: Click "Start Call" → check if CallComposite renders (it should — just needs a UUID)
- Meeting: Fix organizer ID → test again

## 5. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Vite + React)                    │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │            CommunicationsTrayWithACS                     │ │
│  │                                                          │ │
│  │  Tab 0: History ──── RTK Query ──── GET /api/comms/...   │ │
│  │  Tab 1: Send ─────── RTK Query ──── POST /api/comms/... │ │
│  │  Tab 2: Call ─────── fetch ───────── POST /api/comm/call │ │
│  │  Tab 3: Meeting ──── fetch ───────── POST /api/comm/mtg  │ │
│  │  Tab 4: Chat ─────── fetch ───────── POST /api/comm/chat │ │
│  │  Tab 5: AI ────────── (standalone)                       │ │
│  └────────────┬─────────────────────────────────────────────┘ │
│               │                                               │
│  ┌────────────▼────────────────────┐                         │
│  │   ACS Token (from /api/acs/token)│                        │
│  │   userId + token + endpoint      │                        │
│  └────────────┬─────────────────────┘                        │
│               │                                               │
│  ┌────────────▼────────────────────────────────────────────┐ │
│  │  ACS React Composites (peer-to-peer via ACS infra)      │ │
│  │  CallComposite ←→ ACS Calling Service (Azure)           │ │
│  │  ChatComposite ←→ ACS Chat Service (Azure)              │ │
│  │  CallWithChatComposite ←→ Teams Meeting (via ACS)       │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND (Node.js + TypeScript)              │
│                                                               │
│  /api/acs/token ──────────── AcsIdentityService               │
│      │                          │                             │
│      │                    CommunicationIdentityClient          │
│      │                    (ACS SDK — creates users, tokens)    │
│      │                          │                             │
│      │                    Cosmos: acsUserMappings              │
│      │                                                        │
│  /api/communications/ ──── CommunicationController            │
│      │                          │                             │
│      ├── POST /email ────── ACS EmailClient                   │
│      ├── POST /sms ──────── ACS SmsClient (needs phone #)     │
│      ├── POST /teams ────── TeamsService (Graph API)          │
│      └── GET  /order/:id ── Cosmos: communications            │
│                                                               │
│  /api/communication/ ───── UnifiedCommunicationController     │
│      │                          │                             │
│      ├── POST /contexts ─── UnifiedCommunicationService       │
│      │                          │                             │
│      ├── POST /chat ─────── AcsChatService                    │
│      │                      (creates ACS thread via SDK)      │
│      │                          │                             │
│      ├── POST /call ─────── generates groupCallId (UUID)      │
│      │                      (frontend joins via ACS Calling)  │
│      │                          │                             │
│      └── POST /meeting ──── TeamsService                      │
│                              (Graph: POST /onlineMeetings)    │
│                                  │                            │
│                              Cosmos: teamsMeetings            │
│                              Cosmos: communicationContexts    │
└─────────────────────────────────────────────────────────────┘
                            │
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    AZURE SERVICES                             │
│                                                               │
│  ACS Resource (acs-appraisal-staging)                        │
│    ├── Identity API (create users, generate tokens)           │
│    ├── Email Service (DoNotReply@loneanalytics.com)           │
│    ├── SMS Service (needs phone number purchase)              │
│    ├── Chat Service (thread mgmt, real-time WebSocket)        │
│    └── Calling Service (VoIP, PSTN, group calls)             │
│                                                               │
│  Microsoft Graph API                                          │
│    ├── Online Meetings (create/update/delete)                 │
│    ├── Teams Channels (send messages)                         │
│    └── Teams Chat (1:1 direct messages)                       │
│                                                               │
│  Cosmos DB (appraisal-management)                            │
│    ├── communications (all sent/received records)             │
│    ├── communicationContexts (per-entity hub)                 │
│    ├── chatThreads (ACS thread metadata)                      │
│    ├── chatMessages (ACS message history)                     │
│    ├── acsUserMappings (AD → ACS user ID)                     │
│    └── teamsMeetings (meeting metadata)                       │
└─────────────────────────────────────────────────────────────┘
```

## 6. What NOT to Build

| Don't Build | Why |
|---|---|
| Custom WebSocket server for chat | ACS handles this. ChatComposite connects directly to ACS infrastructure. |
| Server-side call management | ACS Calling is peer-to-peer. Server just creates metadata. |
| In-memory session management (`ChatService.userSessions`) | This is the wrong pattern. Each request should get its own token-scoped client. The `AcsChatService` already does this correctly — use it instead. |
| Custom chat UI | `ChatComposite` from `@azure/communication-react` handles messages, typing indicators, read receipts, file sharing. |
| Custom calling UI | `CallComposite` handles camera, mic, screen share, participant list, DTMF. |
| SMTP/SendGrid integration | ACS Email already works. Don't maintain two email systems. |
| Push notifications (yet) | Focus on in-app + email + SMS first. Push is a Layer 6 concern. |

## 7. Priority Order

| # | Task | Effort | Value | Dependency |
|---|---|---|---|---|
| 1 | Fix Teams meeting `organizerUserId` (pass AD user ID, not ACS ID) | 30 min | High | None |
| 2 | Remove stale "setup checklist" banner | 5 min | UX | None |
| 3 | Test ACS Chat end-to-end (create context → create thread → render composite) | 1 hr | High | None |
| 4 | Test ACS Call end-to-end (start call → render composite) | 30 min | Medium | None |
| 5 | Purchase ACS phone number → configure SMS | 15 min (portal) | High | Azure Portal access |
| 6 | Build call/chat invitation flow (notify other party to join) | 2 hrs | High | #3, #4 working |
| 7 | Add SMS templates for borrower scheduling | 2 hrs | High | #5 |
| 8 | Add email templates for vendor assignment/revision | 2 hrs | High | None |
| 9 | Verify Graph API permissions in Azure Portal | 15 min | Blocker for #1 | Azure Portal access |
