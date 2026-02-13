# Master Implementation Plan - Unified & Comprehensive

**Created:** February 12, 2026  
**Status:** Phase 1-3 Complete, Phase 4 Active  
**Discipline:** No drift - follow this plan sequentially

---

## 🎯 Implementation Strategy

**Rule:** Complete each phase 100% before moving to next. No parallel work. No shortcuts.

---

## ✅ COMPLETED PHASES

### Phase 1: QC Management System ✅
**Status:** COMPLETE (January 2026)  
**Delivered:**
- Comprehensive QC checklist engine (15+ endpoints)
- AI-powered validation with multi-provider support
- Rule-based validation system
- Batch QC operations

**Files:** `comprehensive-qc-validation.service.ts`, `qc-management.types.ts`

---

### Phase 2: Property Intelligence ✅
**Status:** COMPLETE (January 2026)  
**Delivered:**
- Two-level property architecture (Summary + Details)
- External data enrichment (Census, Google Places, NPS)
- Market analysis and comparable selection
- Batch property operations (12+ endpoints)

**Files:** `enhanced-property-cosmos.service.ts`, `property-intelligence.service.ts`

---

### Phase 3: Enhanced Vendor Management ✅
**Status:** COMPLETE (February 12, 2026)  
**Delivered:**
- Certification Management (8 endpoints) ✅
- Payment Processing (6 endpoints, 5/6 passing) ⚠️
- Onboarding Workflow (7 endpoints, 6/7 passing) ⚠️
- Performance Analytics (5 endpoints) ✅
- **Total:** 26 endpoints, 24/26 passing (92%)

**Files:**
- `vendor-certification.service.ts` (516 LOC)
- `vendor-payment.service.ts` (428 LOC)
- `vendor-onboarding.service.ts` (706 LOC)
- `vendor-analytics.service.ts` (624 LOC)
- Controllers + Types (1,858 LOC)
- Infrastructure: `storage-role-assignments.bicep`

**Remaining Issues:**
1. Invoice email - ACS permission config
2. Background check - validation error

---

## 🚧 ACTIVE PHASE

### Phase 4: Core Order Workflow Foundation
**Status:** IN PROGRESS  
**Sprint:** 2 weeks (Feb 12 - Feb 26)  
**Goal:** Complete order happy path from intake to inspection

#### 4.1 Unified Communication Platform ⏸️
**Priority:** CRITICAL (90% complete, unblocks everything)

**Tasks:**
- [ ] Complete Azure Communication Services deployment
- [ ] Finish SMS service (`src/services/acs-sms.service.ts`)
- [ ] Email template system with Handlebars
- [ ] Teams notification integration (already 80% done)
- [ ] Conversation transcript storage in Cosmos
- [ ] Test all 3 channels (Email, SMS, Teams)

**Deliverables:**
- POST `/api/communications/email` - Send email
- POST `/api/communications/sms` - Send SMS
- POST `/api/communications/teams` - Send Teams message
- GET `/api/communications/history/:orderId` - Get conversation history

**Success Criteria:**
- All 3 channels working end-to-end
- Messages stored in `communications` Cosmos container
- Email templates rendering correctly
- Teams notifications deliver within 5 seconds

**Files to Complete:**
- `src/services/acs-email.service.ts` (finish)
- `src/services/acs-sms.service.ts` (finish)
- `src/controllers/communication.controller.ts` (create)

---

#### 4.2 Vendor Acceptance Workflow
**Priority:** CRITICAL

**Tasks:**
- [ ] 4-hour acceptance timeout window
- [ ] Counter-offer capability (price/turnaround)
- [ ] Auto-reassignment on timeout/decline
- [ ] Acceptance confirmation notifications (email + SMS)
- [ ] Vendor acceptance history tracking

**Deliverables:**
- POST `/api/orders/:orderId/vendor-response` - Accept/decline/counter
- GET `/api/orders/:orderId/vendor-status` - Check acceptance status
- Background job: timeout checker (every 5 minutes)

**Success Criteria:**
- Vendor can accept/decline within 4 hours
- Counter-offers captured and routed for approval
- Auto-reassignment triggered on timeout
- Notifications sent on all state changes

**Files to Create:**
- `src/services/vendor-acceptance.service.ts`
- `src/controllers/vendor-acceptance.controller.ts`
- `src/jobs/vendor-timeout-checker.job.ts`

---

#### 4.3 Appraiser Entity & Assignment
**Priority:** HIGH

**Tasks:**
- [ ] Appraiser entity (separate from vendor)
- [ ] License tracking and expiration monitoring
- [ ] State licensing verification (stub for now)
- [ ] Conflict of interest checking (property address matching)
- [ ] Appraiser assignment to accepted orders
- [ ] Assignment notifications

**Deliverables:**
- POST `/api/appraisers` - Create appraiser
- GET `/api/appraisers/:id` - Get appraiser details
- POST `/api/orders/:orderId/assign-appraiser` - Assign appraiser
- GET `/api/appraisers/:id/assignments` - Current assignments

**Success Criteria:**
- Appraiser licenses tracked with expiration dates
- Conflict checking prevents assignments within 10 miles of appraiser address
- License expiration warnings 30/60/90 days out
- Assignment history maintained

**Files to Create:**
- `src/types/appraiser.types.ts`
- `src/services/appraiser.service.ts`
- `src/controllers/appraiser.controller.ts`
- Cosmos container: `appraisers`

---

#### 4.4 Inspection Scheduling
**Priority:** HIGH

**Tasks:**
- [ ] Calendar integration (Outlook/Google Calendar)
- [ ] Borrower self-scheduling portal (simple UI)
- [ ] Automated appointment reminders (24hr, 2hr before)
- [ ] Reschedule/cancel workflow
- [ ] Inspection status tracking

**Deliverables:**
- POST `/api/inspections/schedule` - Schedule inspection
- GET `/api/inspections/:orderId` - Get inspection details
- PUT `/api/inspections/:id/reschedule` - Reschedule
- POST `/api/inspections/:id/cancel` - Cancel

**Success Criteria:**
- Borrower receives scheduling link via SMS/email
- Inspection scheduled with confirmed time
- Reminders sent automatically (SMS preferred)
- Calendar events created for appraiser

**Files to Create:**
- `src/services/inspection-scheduling.service.ts`
- `src/controllers/inspection.controller.ts`
- `src/utils/calendar-integration.ts`
- Cosmos container: `inspections`

---

#### 4.5 Photo Upload & Blob Storage
**Priority:** MEDIUM

**Tasks:**
- [ ] Photo upload endpoint with Azure Blob Storage
- [ ] Image quality validation (min resolution, file size)
- [ ] Metadata extraction (EXIF, geolocation)
- [ ] Thumbnail generation
- [ ] Photo gallery view
- [ ] CDN integration for fast delivery

**Deliverables:**
- POST `/api/orders/:orderId/photos` - Upload photos
- GET `/api/orders/:orderId/photos` - List photos
- DELETE `/api/photos/:id` - Delete photo

**Success Criteria:**
- Photos stored in blob storage (`order-photos` container)
- Thumbnails auto-generated on upload
- EXIF data extracted and stored
- CDN URLs returned for fast access

**Files to Create:**
- `src/services/photo-upload.service.ts`
- `src/controllers/photo.controller.ts`
- `src/utils/image-processing.ts`

---

**Phase 4 Timeline:**
- Week 1: Tasks 4.1-4.2 (Communication + Vendor Acceptance)
- Week 2: Tasks 4.3-4.5 (Appraiser + Scheduling + Photos)

**Phase 4 Exit Criteria:**
- ✅ Order created
- ✅ Vendor accepts within 4 hours
- ✅ Appraiser assigned
- ✅ Inspection scheduled
- ✅ Photos uploaded
- ✅ All communications tracked

---

## 📋 UPCOMING PHASES (Do Not Start Until Phase 4 Complete)

### Phase 5: Axiom AI Integration (PREREQUISITE for Phases 6-8)
**Sprint:** 2 weeks  
**Critical Dependency:** All AI features depend on this

**Tasks:**
- [ ] Axiom API client service
- [ ] Document upload notification to Axiom
- [ ] Evaluation retrieval and storage
- [ ] Cosmos `aiInsights` container integration
- [ ] Webhook handler for completion notifications
- [ ] Error handling and retry logic

**Success Criteria:**
- Document upload → Axiom notification < 5 seconds
- Evaluation results retrieved and persisted
- Risk scores (0-100) generated for all orders

---

### Phase 6: AI Intelligence Layer
**Sprint:** 3 weeks  
**Depends on:** Phase 5 (Axiom)

**Tasks:**
- [ ] AI Pre-Screening Integration (Axiom-powered USPAP validation)
- [ ] Risk-Based Routing (<30, 30-70, >70 thresholds)
- [ ] QC Checklist Auto-Population (70% automation target)

**Success Criteria:**
- 80% of orders auto-triaged
- QC checklists 70% pre-filled
- Risk scores drive routing decisions

---

### Phase 7: QC Workflow Branching
**Sprint:** 3 weeks  
**Depends on:** Phase 6

**Tasks:**
- [ ] Revision Request Workflow
- [ ] Vendor Response & Re-Review (Axiom change detection)
- [ ] Rejection & Remediation
- [ ] Dispute Resolution

**Success Criteria:**
- All QC outcomes handled systematically
- Revision tracking with version comparison
- 50% faster re-review time

---

### Phase 8: Final Delivery & ROV
**Sprint:** 3 weeks  
**Depends on:** Phase 7

**Tasks:**
- [ ] ROV Workflow (Axiom-powered comp analysis)
- [ ] Report Packaging & PDF Generation
- [ ] Multi-Channel Delivery (Portal, LOS, GSE)

**Success Criteria:**
- ROV requests analyzed with value impact prediction
- PDF/XML generated automatically
- Orders delivered to all client channels

---

### Phase 9: Business Operations
**Sprint:** 4 weeks

**Tasks:**
- [ ] Vendor Marketplace (bidding, dynamic pricing)
- [ ] SLA Monitoring & Alerting
- [ ] Performance Metrics & Analytics
- [ ] Payment Processing (Stripe/ACH)
- [ ] Bridge API Integration (MLS comps)

**Success Criteria:**
- Zero manual invoicing
- SLA breaches predicted 24hr ahead
- Automated comp retrieval

---

### Phase 10: Enterprise Maturity
**Sprint:** 4 weeks

**Tasks:**
- [ ] Client Self-Service Portal
- [ ] Advanced AI Features (computer vision, GPT-4)
- [ ] OpenAPI/Swagger Documentation
- [ ] API Rate Limiting & Analytics
- [ ] Comprehensive Test Suite (>80% coverage)

**Success Criteria:**
- Portal live for client access
- API docs published
- Full test automation in CI/CD

---

## 🎯 Current Focus: Phase 4 Only

**DO NOT:**
- Start Phase 5 (Axiom) until Phase 4 is 100% complete
- Work on multiple phases in parallel
- Skip any tasks within Phase 4
- Add scope to Phase 4

**DO:**
- Complete Phase 4 tasks sequentially (4.1 → 4.2 → 4.3 → 4.4 → 4.5)
- Test each task thoroughly before moving to next
- Update this document when tasks complete
- Ask before deviating from plan

---

## 📊 Overall Progress

| Phase | Name | Status | Completion |
|-------|------|--------|------------|
| 1 | QC Management | ✅ Complete | 100% |
| 2 | Property Intelligence | ✅ Complete | 100% |
| 3 | Vendor Management | ✅ Complete | 92% |
| 4 | **Order Workflow** | **🚧 Active** | **0%** |
| 5 | Axiom AI Integration | ⏸️ Planned | 0% |
| 6 | AI Intelligence | ⏸️ Planned | 0% |
| 7 | QC Branching | ⏸️ Planned | 0% |
| 8 | Delivery & ROV | ⏸️ Planned | 0% |
| 9 | Business Ops | ⏸️ Planned | 0% |
| 10 | Enterprise | ⏸️ Planned | 0% |

**Total Platform Completion:** 29% (3 of 10 phases)

---

## 📝 Daily Standup Format

**Every day, report:**
1. What task(s) completed yesterday
2. What task starting today
3. Any blockers
4. % completion of current phase

**Example:**
```
Date: Feb 13, 2026
Completed: Task 4.1.1 - ACS Email service
Starting: Task 4.1.2 - SMS service
Blockers: None
Phase 4 Progress: 10%
```

---

## 🚨 Red Flags - Stop & Reassess

- Working on tasks from Phase 5+ while Phase 4 incomplete
- Adding "quick wins" outside current phase
- Skipping tests to move faster
- Reducing scope of current task to finish early
- Starting new feature exploration

**If any of these occur: STOP. Return to current phase task.**

---

## ✅ Definition of "Complete"

A phase is complete when:
1. All tasks have working code deployed
2. All endpoints tested (95%+ passing)
3. All Cosmos containers created
4. All documentation updated
5. Integration tests pass
6. Performance validated (<500ms p95)

**Not complete until ALL criteria met.**

---

## 🎯 Next Action (Right Now)

**Start Phase 4, Task 4.1: Unified Communication Platform**

1. Review `src/services/acs-email.service.ts` - what's incomplete?
2. Review `src/services/acs-sms.service.ts` - does it exist?
3. Create `src/controllers/communication.controller.ts`
4. Create test script for all 3 channels
5. Test end-to-end: Order created → Notifications sent

**Do not proceed past this until email, SMS, Teams all work.**
