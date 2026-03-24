# Axiom Document Processing & Integration Plan
**Date:** March 20, 2026

## Overview
This document outlines the comprehensive, component-level architectural plan for the end-to-end Axiom Document Processing Journey. It models Axiom as a robust, stateful pipeline engine across our UI, Platform Backend, and the Axiom API engine itself.

## Phase 1: Backend Data Layer & State Management (Current)
Establish the underlying data structures to track files, executions, and multiplexed processes.

- [x] **Task 1.1:** Define `AxiomExecutionRecord` interface/schema in the backend to store execution states (`executionId`, `documentIds`, `axiomFileSetId`, `axiomJobId`, `pipelineMode`, `status`, results).
- [x] **Task 1.2:** Create or update the Cosmos DB repository layer (`AxiomExecutionRepository`) to handle CRUD operations for execution records.
- [x] **Task 1.3:** Modify `DocumentController` / `DocumentService` to trigger `AxiomExecutionRecord` creation natively upon relevant file uploads.

## Phase 2: The API Bridges (Platform Backend $\leftrightarrow$ Axiom)
Build the server-to-server communication layer to safely and reliably transmit files and process commands.

- [x] **Task 2.1:** Implement robust Axios/HTTP client for `/api/documents` (FileSet creation and deduplication).
- [x] **Task 2.2:** Implement client for `/api/pipelines` (Submission of standard or inline Loom pipelines). 
- [x] **Task 2.3:** Implement secure SSE Proxy route (`/api/documents/stream/:executionId`) in the Platform Backend to mirror Axiom's `GET /api/pipelines/:jobId/stream` to authenticated UI clients.
- [x] **Task 2.4:** Implement webhook intake or polling watchdog to capture final processing results and update the `AxiomExecutionRecord` to `COMPLETED` or `FAILED`.

## Phase 3: Real-Time UI Telemetry & State Hub
Connect the frontend UI components to the SSE bridges and manage loading states elegantly.

- [x] **Task 3.1:** Hook up `<AxiomProgressPanel />` to the backend SSE endpoint via EventSource/WebSockets.
- [x] **Task 3.2:** Build vertical stepper visualizations mapping precisely to Axiom's pipeline stages (Classifying $\rightarrow$ Extracting $\rightarrow$ Consolidating $\rightarrow$ Evaluating).
- [x] **Task 3.3:** Implement granular `<AxiomProcessingStatus />` inline for the surgical QC workflows.
- [x] **Task 3.4:** Handle UI failure states (Pipeline Engine Timeout, Extraction Failure) gracefully, allowing user retry.

## Phase 4: Full User Journeys & UI Integrations
Wire the final human interactions using our existing UI scaffolding.

- [x] **Task 4.1: The Intelligent Drop** Update `<EnhancedDocumentUpload />` and `<DocumentUploadZone />` to support the "Auto-Process via Axiom Brain" flow.
- [x] **Task 4.2: The Results Viewer** Update `<AxiomInsightsPanel />` to render the extracted JSON. Integrate with `<DocumentPreviewModal />` to allow cross-referencing extracted data with page bounding boxes or specific document sections.
- [x] **Task 4.3: The Surgical QC Strike** Add Axiom Actions dropdown to the document list inside `<QCReviewContent />` to explicitly re-run pipelines or trigger deep extractions.
- [x] **Task 4.4: The Agentic Exception** Link the `<AIAssistantStreaming />` to Axiom's synchronous `/api/agent/run` endpoint using the `fileSetId` as memory context for interactive Q&A.

---
*Created by AI Assistant based on workspace state & Axiom integration design.*