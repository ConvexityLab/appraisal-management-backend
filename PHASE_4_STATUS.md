# Phase 4: Core Order Workflow - Current Status

**Date:** February 12, 2026  
**Assessment:** Phase 4 is ~40% complete. We have foundation pieces but missing critical integration.

---

## 📊 Task-by-Task Status

### ✅ 4.1 Unified Communication Platform - **70% Complete**

**What Exists:**
- ✅ `azure-communication.service.ts` - Email/SMS/Chat client wrapper
- ✅ `unified-communication.service.ts` - Chat + Calls orchestration
- ✅ `teams.service.ts` - Microsoft Teams meetings integration (699 LOC)
- ✅ `acs-chat.service.ts` - ACS chat threads
- ✅ `acs-identity.service.ts` - ACS user token exchange

**What's Missing:**
- ❌ **Communication controller** - No REST API endpoints exposed
- ❌ **Email templates system** - No Handlebars template engine
- ❌ **Simple send endpoints** - No direct "send email" or "send SMS" endpoints
- ❌ **History/transcript retrieval** - No GET `/api/communications/history/:orderId`
- ❌ **Testing** - No test script for email/SMS/Teams

**Files to Create:**
```
src/controllers/communication.controller.ts (NEW)
src/templates/email/ (NEW directory)
  - vendor-assignment.hbs
  - inspection-reminder.hbs
  - order-accepted.hbs
scripts/test-communications.js (NEW)
```

**Next Actions:**
1. Create `communication.controller.ts` with 4 endpoints:
   - POST `/api/communications/email` - Send email
   - POST `/api/communications/sms` - Send SMS  
   - POST `/api/communications/teams` - Send Teams notification
   - GET `/api/communications/history/:orderId` - Get history
2. Create email template system with Handlebars
3. Test all 3 channels end-to-end

---

### ✅ 4.2 Vendor Acceptance Workflow - **90% Complete**

**What Exists:**
- ✅ `order-negotiation.service.ts` - Accept/reject/counter-offer logic
- ✅ `order-negotiation.controller.ts` - Full REST API (451 LOC)
- ✅ POST `/api/negotiations/accept` - Vendor accepts order
- ✅ POST `/api/negotiations/reject` - Vendor rejects with reason
- ✅ POST `/api/negotiations/counter-offer` - Submit counter-offer
- ✅ POST `/api/negotiations/:id/accept-counter` - AMC accepts counter
- ✅ POST `/api/negotiations/:id/reject-counter` - AMC rejects counter

**What's Missing:**
- ❌ **4-hour timeout mechanism** - No background job checking timeouts
- ❌ **Auto-reassignment** - No automatic vendor reassignment on timeout/decline
- ❌ **Notifications** - Accept/reject doesn't trigger email/SMS (not integrated with 4.1)

**Files to Create:**
```
src/jobs/vendor-timeout-checker.job.ts (NEW)
```

**Files to Modify:**
```
src/services/order-negotiation.service.ts
  - Integrate with communication service for notifications
  - Add auto-reassignment logic on timeout
```

**Next Actions:**
1. Create background job to check for timeouts (every 5 minutes)
2. Add auto-reassignment when vendor doesn't respond in 4 hours
3. Integrate with communication service (Task 4.1) for notifications
4. Test: Order assigned → Vendor accepts → SMS sent

---

### ❌ 4.3 Appraiser Entity & Assignment - **10% Complete**

**What Exists:**
- ✅ Some appraiser fields in order types
- ✅ Basic assignment concept in order controller

**What's Missing:**
- ❌ **Appraiser entity** - No separate appraiser type/schema
- ❌ **Appraiser service** - No service layer
- ❌ **Appraiser controller** - No REST API
- ❌ **License tracking** - No license expiration monitoring
- ❌ **Conflict checking** - No property proximity checks
- ❌ **Assignment workflow** - No formal assignment process

**Files to Create:**
```
src/types/appraiser.types.ts (NEW)
src/services/appraiser.service.ts (NEW)
src/controllers/appraiser.controller.ts (NEW)
tests/appraiser.test.ts (NEW)
```

**Cosmos Containers to Create:**
```
appraisers - Store appraiser profiles, licenses, assignments
```

**Next Actions:**
1. Define appraiser types (license, certifications, specialties)
2. Create appraiser service with CRUD operations
3. Implement license expiration monitoring
4. Add conflict-of-interest checking (10-mile radius)
5. Create assignment workflow
6. Build REST API with 4 endpoints

---

### ❌ 4.4 Inspection Scheduling - **5% Complete**

**What Exists:**
- ✅ Inspection date fields in order types
- ✅ Basic scheduling concept

**What's Missing:**
- ❌ **Inspection entity** - No formal inspection schema
- ❌ **Scheduling service** - No service layer
- ❌ **Calendar integration** - No Outlook/Google Calendar sync
- ❌ **Borrower self-scheduling** - No scheduling portal/link
- ❌ **Reminders** - No automated SMS/email reminders
- ❌ **Reschedule workflow** - No reschedule/cancel logic

**Files to Create:**
```
src/types/inspection.types.ts (NEW)
src/services/inspection-scheduling.service.ts (NEW)
src/controllers/inspection.controller.ts (NEW)
src/utils/calendar-integration.ts (NEW)
tests/inspection-scheduling.test.ts (NEW)
```

**Cosmos Containers to Create:**
```
inspections - Store inspection appointments, history
```

**Next Actions:**
1. Define inspection types and workflow states
2. Create scheduling service with calendar integration
3. Generate borrower self-scheduling links
4. Implement reminder system (24hr, 2hr before)
5. Add reschedule/cancel capabilities
6. Build REST API with 4 endpoints

---

### ❌ 4.5 Photo Upload & Blob Storage - **20% Complete**

**What Exists:**
- ✅ `blob-storage.service.ts` - Basic blob upload (working at 92%)
- ✅ Azure Blob Storage account configured
- ✅ Storage RBAC roles assigned

**What's Missing:**
- ❌ **Photo-specific service** - No photo validation/processing
- ❌ **Image quality checks** - No resolution/size validation
- ❌ **EXIF extraction** - No metadata extraction
- ❌ **Thumbnail generation** - No thumbnails created
- ❌ **Photo controller** - No REST API
- ❌ **CDN integration** - No CDN for fast delivery

**Files to Create:**
```
src/services/photo-upload.service.ts (NEW)
src/controllers/photo.controller.ts (NEW)
src/utils/image-processing.ts (NEW)
tests/photo-upload.test.ts (NEW)
```

**Azure Resources Needed:**
```
- Blob container: order-photos
- Azure CDN profile + endpoint
```

**Next Actions:**
1. Create photo service wrapping blob-storage.service
2. Add image validation (min 1920x1080, max 10MB)
3. Extract EXIF data (GPS, timestamp, camera info)
4. Generate thumbnails (200x200, 800x600)
5. Set up CDN for fast delivery
6. Build REST API with 3 endpoints

---

## 📈 Phase 4 Overall Completion: ~40%

| Task | Status | % Complete | LOC Existing | LOC Needed |
|------|--------|-----------|--------------|------------|
| 4.1 Communication | 🟡 Partial | 70% | ~1,500 | ~500 |
| 4.2 Vendor Acceptance | 🟡 Partial | 90% | 900 | ~100 |
| 4.3 Appraiser | 🔴 Not Started | 10% | 0 | ~800 |
| 4.4 Inspection | 🔴 Not Started | 5% | 0 | ~600 |
| 4.5 Photos | 🟡 Partial | 20% | 300 | ~700 |

**Total LOC:** 2,700 existing, ~2,700 needed = **40% complete**

---

## 🎯 Recommended Sequence (No Drift!)

### Week 1 (Feb 12-18):
**Day 1-2: Complete Task 4.1 (Communication)**
- Create communication.controller.ts
- Add email template system
- Test email/SMS/Teams end-to-end
- **Exit Criteria:** Can send all 3 types of messages

**Day 3-4: Complete Task 4.2 (Vendor Acceptance)**
- Create vendor-timeout-checker.job.ts
- Add notification integration
- Test timeout → auto-reassignment
- **Exit Criteria:** 4-hour timeout enforced, notifications sent

**Day 5: Fix Phase 3 Failing Tests**
- Fix invoice email (ACS permissions)
- Fix background check validation
- **Exit Criteria:** 26/26 Phase 3 tests passing (100%)

### Week 2 (Feb 19-25):
**Day 1-2: Complete Task 4.3 (Appraiser)**
- Create appraiser types, service, controller
- License tracking + expiration
- Conflict checking
- **Exit Criteria:** Can create appraiser, check conflicts, assign to order

**Day 3-4: Complete Task 4.4 (Inspection)**
- Create inspection service + controller
- Calendar integration
- Borrower self-scheduling
- **Exit Criteria:** Inspection scheduled, reminders sent

**Day 5: Complete Task 4.5 (Photos)**
- Create photo service + controller
- Image validation + EXIF
- Thumbnail generation
- **Exit Criteria:** Photos uploaded with thumbnails, metadata extracted

---

## ✅ Phase 4 Exit Criteria (All Must Pass)

1. **Communication (4.1):**
   - ✅ Email sent successfully
   - ✅ SMS delivered
   - ✅ Teams notification posted
   - ✅ History retrieved from Cosmos

2. **Vendor Acceptance (4.2):**
   - ✅ Vendor accepts within 4 hours
   - ✅ Timeout triggers auto-reassignment
   - ✅ Counter-offers handled
   - ✅ Notifications sent on all state changes

3. **Appraiser (4.3):**
   - ✅ Appraiser created with licenses
   - ✅ License expiration warnings work
   - ✅ Conflict checking prevents bad assignments
   - ✅ Appraiser assigned to order

4. **Inspection (4.4):**
   - ✅ Inspection scheduled with calendar event
   - ✅ Borrower receives self-scheduling link
   - ✅ Reminders sent 24hr and 2hr before
   - ✅ Reschedule/cancel works

5. **Photos (4.5):**
   - ✅ Photos uploaded to blob storage
   - ✅ Thumbnails generated
   - ✅ EXIF data extracted
   - ✅ CDN URLs returned

6. **Integration Test:**
   - ✅ End-to-end: Order created → Vendor accepts → Appraiser assigned → Inspection scheduled → Photos uploaded
   - ✅ All notifications sent at each step
   - ✅ All data persisted correctly

---

## 🚫 What NOT to Do (No Drift!)

- ❌ Don't start Phase 5 (Axiom) until Phase 4 is 100% done
- ❌ Don't add "quick win" features outside Phase 4 scope
- ❌ Don't skip tests to move faster
- ❌ Don't reduce scope of any task
- ❌ Don't work on multiple tasks in parallel

---

## 📝 Daily Progress Log

### February 12, 2026
- **Completed:** Phase 3 implementation (24/26 tests passing)
- **Created:** MASTER_PLAN.md, PHASE_4_STATUS.md
- **Starting:** Phase 4, Task 4.1 (Communication Controller)
- **Blockers:** None
- **Phase 4 Progress:** 40% → 40%

### February 13, 2026
- **Plan:** Complete communication.controller.ts, email templates, test script

---

## 🎯 Next Immediate Action

**RIGHT NOW:** Start Task 4.1 - Create Communication Controller

```bash
# 1. Review existing communication services
# 2. Create src/controllers/communication.controller.ts
# 3. Expose 4 REST endpoints
# 4. Create email template directory + sample templates
# 5. Test all 3 channels
```

**Do not proceed past this until email, SMS, and Teams all work end-to-end.**
