## EMAIL

Hi George.  Conceptionally, Ellington is absolutely hearing what I am saying in terms of why we are building VisionONE, but at the same time they ask great questions and are very curious to hear your answers.  This is an important exercise in that they have serious weight that moves markets, and I am not referring to $$ but a blessing and “advertising” that will have a ripple affect across the mortgage spectrum.    These are questions I have answered, but they respectfully have asked you for your input:

 

    Why us, why VisionVMC?
    Where does more robust data come from?  What is the cost, and how will more robust data help us provide a better product? (like a DVR desk review, bpo, 1033)
    What does L1 and VisionONE bring to Vision VMC that we don’t have right now?
        Efficiency? Or more ( I would suggest adding that you believe VisionONE can go well beyond valuations and why)
    What will VisionONE offer that no one else offers?  Why will cap markets institutional investors want VisionONE to be the gold standard in terms of a valuation waterfall of products?
    Where will revenue come from?  L1 has put a year of time into this without compensation,  how will they get paid? What do they think revenue/profit will look like in 1 and 5 years?  (I have explained that VisionONE will be a partnership, and our platform/system could be worth a small fortune. You would know in that you’ve done this already.  There will be opportunities to earn money on click charges (such as any order that flows through the platform), data charges where machine leaning adds more than just info but real intelligence (such as with a 1033),



## L1 TEAM HIGHLIGHTSL1 Analytics Team Highlights
AI/Machine Learning at Scale
• Information Extraction from unstructured documents for a Regional bank. Trained and deployed information extraction pipeline for potentially over 1.5 million (and growing) documents. The models were trained on a bespoke dataset using a decoder-only architecture and deployed as an API. The training and live data set represents a large collection of heterogenous documents used in the origination and servicing of loans. The model’s primary use is to extract key data elements like Identifying numbers, addresses, dates, values and limits and format into a data structure consumable by downstream systems. Models are augmented by our proprietary statistical evaluation framework that provided theoretically valid confidence sets for model predictions – something typically not provided by LLMs.
• Automated Valuations and Quality Control system at Pacific Western Bank (Pac West). Planned and deployed machine learning based system to radically streamline the property valuation process and related quality control functions. Planned extension to broader quality control and regulatory processes. The system aggregates data from dozens of external providers leveraging machine learning to cleans and federate into a common data model (MISMO) and compresses time-to-decision from days to minutes. Novel features include: radical transparency into each processing step with every input and output saved for regulatory and compliance reporting, AI/machine learning based data management, governance and quality control.
• Machine learning document recognition and data extraction pipeline for nCino, a banking infrastructure Fintech company. Platform to extract client data from financial forms (e.g. tax forms regulatory disclosures) and run analytics on results. Transformer-based architecture with novel hybrid self-supervised feature generation. Company incorporated into their production spread analysis offering.
• Architected and built Natural Language Understanding (NLU) model for nCino. Cutting-edge goal-oriented memory network process preserves context in conversations and delivers better responses and actions for user-generated requests. Currently under continued development. Built on AWS originally leveraging Alexa/Lex infrastructure with lambda and step function fulfillment. Moved to Transformer based architecture once it became mature enough for production ML systems.
• Information Extraction for PwC. AI Entity recognition system from securitization deal documents (millions of pages) using natural language processing techniques. Created proprietary AI implementation incorporating latest data programming techniques for training libraries of weakly supervised labeling functions. Model built in Python, interactive code in node.js.
• Natural Language Processing and Understanding due diligence platform for use in Third Party Reviews and Internal Audit of mortgage loan documents transferred in asset sales for Citizens Bank. Created our own corpus, trained an augmented transformer-based set of models and are achieving state of the art performance on document recognition and information retrieval tasks.
• Automated Valuation Methodology (AVM) for residential property used by Bank of America, Citi, Radian, FHA, and Freddie Mac, among others, based on an ensemble of machine learning methods. Concept to production in 6 months. Production version runs in AWS on 50 computer cluster. The AVM is tested quarterly by an independent testing firm and consistently ranks in the top 5 (out of 26) commercially available AVMs. Platform ultimately sold to Radian and is currently still used in production by them.
• Created machine learning methodology and processes to ensure data quality, detect outliers, and cleanse data for use in multi-terabyte Moody's Analytics non-agency mortgage data analytics. Moody’s adopted our data QC methodology into their production process. Utilized large-scale data ingestion into AWS S3 and as well as (at the time) new, distributed database service, Snowflake.
Predictive Analytics
• Built predictive analytics system used for real-time valuation of the securitized Maiden Lane portfolio assets (toxic assets from Bear Stearns and AIG held as collateral) for the Federal Reserve Bank of New York (FRBNY). Windows server backend written in C#, with web- and Excel-based frontends.
• Planned, estimated and deployed into production a proprietary Bank Default prediction model for the Conference of State Banking Supervisors (CSBS). The model included a GAM and boosted tree ensemble of machine learning algorithms. The proprietary data set was cleansed and feature engineered and contained nearly the entire historical call reports data set. The model is currently used in production by the supervisory staff to give early warning indication of troubled banks.
• Build and deployed Agency prepayment, default and loss given default mortgage models and for PwC that the organization currently uses in production with audit and assurance clients. Modeled in pySpark on compute cluster in AWS using an ensemble of machine learning algorithms. The original data set contained nearly two billion rows of data before pruning and sampling.
• Contracted by Federal National Mortgage Association (Fannie Mae/FNMA) post-crisis to help re-build their credit (predicted loss given default) model. After FNMA spent three years and $600 million dollars on a team of 100 people, before shuttering the effort, three members of L1 team and an internal FNMA team of six rewrote the entire system in C++ and Oracle on a 100+ computer cluster in less than six months.
• Built Federal Housing Administration (FHA) risk infrastructure, including an entire suite of interconnected statistical models and multiple, massive multi-billion row databases, in 5 months. Statistical models estimated in R and Python. Production models delivered in C++ on an internal "cloud" of Windows servers. Retained to add features and enhancements to initial production version for several years.
• Built out proprietary predictive models for Jefferies Financial Group (now Jefferies Group LLC) Fixed Income Sales and Trading. Models estimated in SAS and later ported to Python, delivered in production in C++ on Windows servers. Continuous upgrades and enhancements added to systems over several years.
• Federal Deposit Insurance Corporation (FDIC)-commissioned proof of concept for models and analytics to
(1) value distressed assets at failed or failing banks and (2) price the risk in the entire (insured) banking system. From concept to completion 9 months. Ultimately used only for (1); systemic risk functionality not used due to a change in regulatory policy.
• Invited by National Association of Insurance Commissioners (NAIC) to propose overhaul for rating of commercial mortgage assets at all US insurance companies. Ultimately lost to BlackRock Solutions (the only other invited bidder), but prototype system was up and commercially viable in months, not years.
• FHA pilot to detect housing anomalies from geospatial data using neural networks. Estimated in Python, runs on Linux and Windows compute cluster on AWS.
Big Data, Compute, and Infrastructure
• Designed, built and deployed nCino’s AWS cloud infrastructure. We conceived of and then created their non-Salesforce architecture. The platform included careful planning for growth in data ETL between underlying Salesforce storage and multiple AWS landing zones, automated analytical jobs, APIs for interacting with legacy system and a new data infrastructure with fine-grained authorization to accommodate the SaaS
• Fixed income valuation and pricing system for Standard & Poor’s (S&P) used as the infrastructure to process all structured/securitized products (everything but corporate bonds). Planned and built system that generates millions of scenarios and billions of data points. All analytic scenario computations run in hours; ad-hoc scenarios accommodated as well. Deployed on variable cluster of computers in hybrid cloud and on-premises hardware with bank-level security.
• Built and deployed a bond/structured products valuation system for PwC. Platform used enterprise-wide to run their global structured products valuation business. System runs billions of individual calculations when scheduled across the entire universe of structured products: CMOs, CMBS, CLOs, ABS and individual pools comprising more than 100,000 structured securities. Integrated with Intex libraries, Moody’s and Equifax data and our own proprietary suite of loan-level prepayment, default and loss models. Underlying data represented more than 3 billion data “rows” and tens of terabytes of storage.
• Hired personally by the President of Equifax to innovate with their data. Offered carte blanche to produce systems from any of their data offerings -- even internal, proprietary data. Took ‘occupancy score’ product from concept to production in less than 6 months, using early machine learning techniques (random forest, generalized additive models, CRF).
• Built loan analytics system on AWS for PwC. From concept to production in 9 months. Can run hundreds of thousands of loans through hundreds of individual scenarios in seconds. Written in both C++ and C# with web front-end. In production, with continuous improvements, to this day.
• Designed and built a sizeable proof-of-concept for a data sharing platform using Homomorphic Encryption and Secure Multiparty Computation for the Conference of State Banking Supervisors. The platform was designed to use Attribute Based Encryption along with FHE and MPC to allow member State Regulatory bodies to securely but anonymously have banks share data, calculations and documents required in their oversight duties. The prototype accepted a standard subset of loan fields and documents in encrypted form. It could then perform calculations on the encrypted data using FHE that member Regulators and banks could provably but anonymously use. Using MPC, any group of regulators could aggregate and share portfolio level data anonymously, thus enabling regulators to create calculations on data that would otherwise be withheld.
• Cash flow anomaly detection system based on convolutional neural networks for PwC. POC completed in 4 months. Models built in R and transferred to Python.




## The Platform at a Glance

| Product | What It Is | Core Tech |
|---------|-----------|-----------|
| **Sentinel** | Orchestration hub — 87 API controllers, 158 UI pages, event-driven automation | TypeScript/Fastify, Cosmos DB |
| **Axiom** | Agentic AI document intelligence — 40+ virtual actors, dual-model extraction, autonomous expert agents, PowerGraph Gather-Apply-Scatter cooperation | Bespoke finetuned text + vision models with curated training datasets, BullMQ durable execution, RLM recursive agents |
| **MOP** | Mortgage pricing engine — 8 loan programs, LLPA grids, DSCR sizing | C++17, sub-millisecond pricing |
| **Prio** | RETE-NT forward-chaining rule engine — TMS, ECOA-compliant explanation generation | C++17, JSON DSL, WASM extensibility, hot-reload |
| **Prixer** | Quantitative risk & ML platform — prepayment, default, AVM, Monte Carlo, convex optimization | C++20/QuantLib, CatBoost/GAM/RF ensemble, OSQP optimizer |
| **Structura** | Structured products engine — replaces Intex & Trepp, 11 asset classes, FlatBuffer zero-copy | C++20, 1,397 tests, JSON deal DSL, WASM-portable waterfalls |
| **Foundry** | Fast LLM inference engine (vLLM-class) | Optimized model serving, batched inference, GPU-accelerated |
| **Verax** | Verifiable compute infrastructure — zkVM, MPC, FHE proof generation | RISC Zero cryptographic receipts, tamper-evident ledger |
| **Aegis** | Authorization & verifiable identity — W3C VCs, OPA policy, agent delegation | ES256 signing, DID:web trust, delegation chains |
| **Eventra** | Event-Condition-Action engine — 46 emission rules, 60+ subscriptions | Cosmos-backed, circuit breakers, dead letter queues |

---



## Product Applications

Sentinel is organized as a configurable **Application Platform**. Tenants subscribe to applications, and tenant admins can compose navigation and feature access per user role, department, or custom attributes.

| Application | Description | Key Capabilities |
|-------------|-------------|------------------|
| **Loan Origination (OneLend)** | End-to-end DSCR and CRE origination — borrower intake through automated decision | Borrower portal, document upload & AI extraction, income/asset calculators, DSCR sizing, automated underwriting, program eligibility, rate lock management, condition tracking, closing |
| **Capital Markets** | Loan pricing, deal structuring, secondary market execution | Rate sheet management, relationship pricing, bid tape import, offering tape assembly, marketplace (bids, counters, acceptance), loan sale settlement, R&W breach tracking |
| **Credit Risk** | Enterprise risk analytics and regulatory compliance | CECL allowance modeling, ALM interest rate risk, stress testing, fair lending analysis, commercial credit assessment |
| **Loan Servicing** | Post-funding lifecycle management | Payment processing, delinquency monitoring, construction draws, annual reviews, covenant surveillance |
| **Compliance** | Regulatory workflow and audit | AML/KYC, HMDA reporting, TRID disclosure tracking, QC programs, condition workflows, audit trails |
| **Enterprise Intelligence** | AI-powered analytics and data lineage | Cross-document fact reconciliation, proactive finding detection, field provenance, pipeline observability |

### Application Maker

Tenant administrators can customize each application's navigation, pages, and feature visibility:

- **Per-tenant composition** — replace or overlay navigation items for any application
- **Attribute-based visibility** — show/hide pages based on user role, department, license type, or custom attributes (evaluated server-side via JSONLogic)
- **Per-user overrides** — individuals can pin or hide items from their tenant-resolved navigation
- **30+ capabilities** map 1:1 to UI pages/widgets and can be embedded in automated workflows

---

## Automation Fabric — How Everything Connects

Sentinel's automation is powered by the **Eventra** Event-Condition-Action (ECA) engine. Every meaningful action in the platform emits a structured event. Emission rules evaluate whether those events should produce downstream system events. Subscriptions match events to action handlers that drive automation — calling AI pipelines, evaluating pricing, transitioning loan state, or notifying stakeholders.

### Event Flow

```
Controller action (e.g., document upload)
    │
    ▼
publishEvent("document.uploaded", context)
    │
    ├──► Persisted to Cosmos (audit trail)
    ├──► SSE broadcast to connected clients (real-time UI)
    │
    ▼
Eventra Emission Rules (JSONLogic conditions)
    │
    ▼
System Events emitted
    │
    ▼
Subscription Matching
    │
    ▼
Condition Evaluation (none, JSONLogic, or Prio RETE-NT rules)
    │
    ▼
Action Execution
    ├──► submit_pipeline  → Axiom AI pipeline
    ├──► evaluate_mop     → MOP pricing/DSCR evaluation
    ├──► evaluate_structura → Structura deal analysis
    ├──► evaluate_prixer   → Prixer bond pricing
    ├──► transition_disposition → Loan/deal state machine advance
    ├──► notify_stakeholder → Internal team notification
    ├──► notify_counterparty → Borrower/counterparty notification
    ├──► webhook            → External system callback
    ├──► queue_job          → Background work
    └──► log                → Structured audit entry
```

### Safety Rails

| Mechanism | Purpose |
|-----------|---------|
| **Circuit Breakers** | Per-subscription failure tracking; auto-opens after threshold failures to prevent cascading damage |
| **Rate Limiters** | Per-tenant throttling to prevent runaway automation |
| **Dead Letter Queue** | Failed actions captured with full context for replay |
| **Cycle Detection** | Max trigger depth of 3 prevents infinite event loops |
| **Schema Validation** | Ajv validation on event payloads at every boundary |

---

## Canonical Journeys

The following journeys describe the major automated paths through the platform — the zero-touch happy path, human-in-the-loop checkpoints, failure recovery, and rewind mechanics.

---

### Journey 1: Document Ingestion & Automated Extraction

**Scenario:** A correspondent lender uploads a 47-page loan file package (1003 application, W-2s, bank statements, appraisal, title commitment) for a DSCR investment property loan.

**What happens automatically:**

1. **Upload & Authorization** — Borrower uploads via Sentinel portal. Aegis verifies upload permission. File stored in tenant-scoped Azure Blob.
2. **Event-Driven Pipeline Launch** — `publishEvent("document.uploaded")` fires ECA emission rules, which trigger an Axiom document intelligence pipeline (12 stages).
3. **AI Classification** — Every page is classified (W-2, Bank Statement, Appraisal, etc.) using text-based or vision-based models (Qwen3-VL for scanned documents).
4. **Schema-Constrained Extraction** — Typed key-value pairs extracted per document type using GPT-4o-mini with JSON schema constraints. Multi-page extractions consolidated into a canonical loan context.
5. **Criteria Evaluation** — Extracted data validated against tenant-configured rules (e.g., "W-2 income matches stated income ± 10%").
6. **Persistence & Downstream Triggers** — Results persisted. Webhook to Sentinel. If confidence ≥ threshold, ECA auto-triggers pricing evaluation.

**Human-in-the-Loop:**
- Low-confidence extractions surface for underwriter review with source PDF page alongside extracted values
- Missing document types generate a checklist and auto-drafted borrower email
- Schema violations highlighted for manual correction

**Rewind:** If a borrower re-uploads a document, only the affected document type is re-extracted. If an analyst corrects a field, downstream pricing is automatically re-evaluated.

---

### Journey 2: Automated Underwriting, Pricing & Program Selection

**Scenario:** Extraction complete. Loan context: FICO 720, DSCR 1.25, LTV 75%, Multi-Family, Cash-Out Refi, $2.1M.

**What happens automatically:**

1. **ECA Trigger** — Extraction completion (high-confidence) or analyst approval fires `evaluate_mop` action.
2. **Multi-Program Comparison** — MOP evaluates all 8 lending programs simultaneously. For each: base rate + LLPA grid adjustments (FICO × LTV × property type × purpose × DSCR band).
3. **Results Presentation** — Ranked program comparison with adjustment breakdowns. Best rate: 7.125% (DSCR 30-Year). Notification sent to loan officer.

**Built-in Programs:** 30-Year Fixed, 15-Year Fixed, 5/1 ARM, 7/1 ARM, FHA 30-Year, VA 30-Year, DSCR 30-Year, Fix & Flip Bridge

**Human-in-the-Loop:**
- Rate lock decision — loan officer reviews and clicks "Lock Rate"
- Exception requests — near-misses routed to credit committee
- Rate overrides — pricing desk adjustments with full audit trail

**Rewind:** If extraction correction changes FICO/LTV/DSCR, MOP reprices automatically. If a rate lock is active, the system alerts when repriced values differ materially from locked pricing.

---

### Journey 3: Condition Clearing & Closing

**Scenario:** Loan is priced and locked. Underwriting generates 12 conditions (employment verification, flood cert, title exception clearance, etc.).

**What happens automatically:**

1. Conditions created with assigned roles and required document types
2. Borrower uploads satisfying documents → targeted extraction pipeline runs
3. Extracted data auto-matched to open conditions; auto-cleared when criteria met
4. When all conditions are satisfied, ECA fires `transition_disposition` to advance loan to **Clear to Close**
5. Notifications sent to loan officer and borrower

**Human-in-the-Loop:**
- Auto-cleared conditions of certain types (e.g., employment verification) still require underwriter sign-off
- Final Clear-to-Close requires senior underwriter approval

---

### Journey 4: Diligence Pool Assembly & Certification

**Scenario:** A bulk loan purchaser delivers a tape of 150 loans for pre-purchase diligence review.

**What happens automatically:**

1. Diligence pool created. ECA fans out Axiom AI pipelines across all 150 loans (collateral review, credit analysis, etc.).
2. Each loan automatically graded: PASS, WAIVE, CONDITION, FAIL
3. Pool marked review-ready when all loans complete. Analyst notified.
4. HMDA rollup aggregated. Fair lending statistical tests executed.

**Human-in-the-Loop:**
- Exception override (FAIL → WAIVE) requires senior analyst
- Pool certification requires head of diligence
- Fair lending red flags block certification pending compliance officer review

---

### Journey 5: Document Custody & Chain of Title

**Scenario:** Post-funding, original notes and closing packages enter the custodial chain.

**What happens automatically:**

1. Custody records track every physical document location and status
2. Bailee letters auto-generated for warehouse bank release
3. SLA enforcement: missing-in-transit alerts after 5 business days; unsigned bailee letter escalation after 48 hours
4. Chain of title confirmed when documents reach final expected location

**Human-in-the-Loop:**
- Location update confirmation by custodian
- Exception resolution by ops manager

---

### Journey 6: Secondary Market — Loan Trading & Marketplace

**Scenario:** Sell a package of 50 funded bridge loans through the marketplace.

**What happens automatically:**

1. Loan package listed with data room. Bidders browse and submit bids.
2. Full bid/counter/accept negotiation cycle with notifications at every step.
3. Transfer workflow: legal review → wire instructions → settlement.
4. Post-settlement: R&W tracking activated. Breach filing if post-sale defects discovered.

**Human-in-the-Loop:**
- Bid acceptance (binding commitment) requires head of trading
- Settlement approval requires treasury

---

### Journey 7: Capital Markets — Securitization

**Scenario:** 50 loans become part of a CMBS 2026-Q2 deal. Define tranches (AAA through First Loss), configure waterfall, run simulations.

**What happens automatically:**

1. Loans promoted to **Central Asset Repository (CAR)** and assigned to deal.
2. Sentinel translates loan data to Structura's deal format. Structura runs N-period waterfall simulation (120–360 months): collect interest + principal → distribute per waterfall rules → check OC/IC triggers → calculate DSCR/LTV performance.
3. Analytics computed: IRR, WAL, modified duration per tranche.
4. **Stress testing:** Replay with stressed assumptions (2× default, CPR-15 prepayment).
5. **Monte Carlo:** 1,000+ path simulation with correlated random variables. "95th percentile: Class BBB receives only 72% of principal."

**Structura Capabilities:**

| Feature | Detail |
|---------|--------|
| Deal Types | CLO (complete), CMBS (complete), MBS (partial), ABS (partial) |
| Asset Classes | Corporate Loan, Commercial Mortgage, Mortgage, Auto Loan, Credit Card, Lease, Receivable |
| Trigger Types | Date, Threshold, Cumulative, Performance, Compound, Custom |
| Trigger Effects | Change waterfall, Change rate, Call deal, Modify reserves |
| Simulation | Multi-threaded Monte Carlo with 7 distribution types |

**Human-in-the-Loop:**
- Tranche sizing is iterative human judgment guided by Structura math
- Final deal approval by head of capital markets
- Rating agency submission requires compliance sign-off

---

### Journey 8: Servicing & Ongoing Surveillance

**Scenario:** A DSCR loan funded 18 months ago misses a payment. The servicer reports delinquency.

**What happens automatically:**

1. Delinquency reported via servicing API. ECA triggers assessment pipeline.
2. Axiom re-assesses DSCR with updated history. Prio evaluates delinquency facts against servicing rule set.
3. Results: delinquency grade, covenant breaches, recommended action (e.g., "SPECIAL_SERVICING").
4. If loan is securitized, Structura recalculates waterfall distributions. Subordinate tranche distributions reduced if OC trigger breached.

**Human-in-the-Loop:**
- Special servicer referral requires asset manager approval
- Modification/workout requires credit committee
- Loss recognition requires CFO sign-off

---

### Journey 9: AI-Native Process Framework

**Scenario:** Credit officer defines a multi-step approval process: "For any CRE loan > $5M, require automated DSCR check, AI appraisal review, environmental report review, and credit committee vote."

**What happens automatically:**

1. Process template defined with step types: `automated`, `ai_pipeline`, `approval`
2. When a qualifying loan enters underwriting, the process launches
3. Automated steps (MOP DSCR check) and AI steps (Axiom pipelines) execute without intervention
4. Approval steps pause the process and notify designated approvers
5. Quorum-based voting (approval, rejection, or rewind to a prior step)

**Human-in-the-Loop:** Every `approval`-type step is inherently human-in-the-loop by design.

---

### Journey 10: Annual Review & Portfolio Surveillance

**Scenario:** All funded CRE loans undergo annual review.

**What happens automatically:**

1. Scheduled scan detects loans due for annual review
2. Auto-generated email to borrower requesting updated financials (T12, Rent Roll)
3. Borrower uploads → extraction pipeline → year-over-year metric comparison
4. Flags: "NOI declined 12% YoY", "DSCR dropped from 1.35 to 1.18"
5. If DSCR below covenant threshold → triggers deeper assessment pipeline
6. Portfolio-level Monte Carlo, CECL allowance recalculation, stress testing

**Human-in-the-Loop:**
- Annual review approval
- Immediate escalation if DSCR drops below 1.0

---

## Central Asset Repository (CAR)

The **Central Asset Repository** is the canonical store for all asset-level information in capital markets operations. Every other Sentinel capability — diligence, structuring, servicing, analytics — references assets via their CAR ID.

### Portfolio Lifecycle

```
bid_tape → available_for_sale → warehouse → securitized
                              → held_for_investment
                              → sold
                              → retained
         → did_not_buy
```

### Key Capabilities

- **Bid tape import** — bulk CSV/Excel/PDF ingestion with AI-powered column mapping
- **Cross-portfolio asset search** — filter by FICO, LTV, UPB, state, loan type, status
- **Offering tape assembly** — create offering tapes from asset selections
- **Deal collateral management** — assign/remove assets to/from deals
- **Portfolio stratification** — WAC, WAM, WALA, avg FICO, avg LTV, concentration analysis
- **Portfolio comparison** — side-by-side metrics for 2–4 portfolios
- **Performance tracking** — monthly activity, delinquency distribution, DSCR trends
- **Loan sale execution** — irreversible mark-sold with full audit trail

---

## AI & Intelligence Capabilities

### Document Intelligence (Axiom)

| Capability | Detail |
|------------|--------|
| **80+ AI Actors** | PDF processing, classification, extraction, criteria evaluation, agentic reasoning |
| **25+ Sentinel Pipelines** | Loan case assembly, credit analysis, collateral review, diligence aggregation, marketplace transfer, portfolio coordination |
| **Vision Models** | Qwen3-VL for scanned/image-based documents |
| **Schema-Constrained Extraction** | GPT-4o-mini with JSON schema enforcement — prevents hallucination |
| **Durable Execution** | BullMQ + Loom checkpointing — resume from last checkpoint after failure |
| **Confidence Scoring** | Auto-apply (>90%), Review (70-90%), Manual (<70%) |

### Intelligent Origination

- **Cross-document fact reconciliation** — detects inconsistencies across documents in a loan file
- **Proactive finding detection** — AI surfaces issues before human review
- **Field provenance** — trace every extracted value to its source page and bounding box

### AI Tray Assistant

- Page-aware, multi-turn chat assistant available across the platform
- Criterion-specific Q&A for underwriting decisions
- Deal economics analysis for structured finance

### Autonomous Agents

- Agent gateway proxying to Axiom autonomous agent runtime
- Scoped delegation tokens via Aegis for agent data access
- Exception analysis, pool remediation, delinquency assessment

---

## Rule Engine (Prio)

Prio is a high-performance C++ RETE-NT forward-chaining rule engine providing:

- **Stateless evaluation** — submit rules + facts → get asserted facts
- **Evidence tracking** — TMS (Truth Maintenance System) with cascading retraction
- **Explanation generation** — ECOA/GDPR-compliant explanations for every decision
- **Multi-tenant** — namespace isolation via `X-Namespace` header
- **Hot-reload** — versioned rule sets with canary traffic splits
- **21 rule sets** for decision routing across the platform

---

## Authorization (Aegis)

Aegis provides fine-grained authorization across the entire platform:

### Authorization Model

| Layer | Mechanism |
|-------|-----------|
| **Module Gates** | Tenant must subscribe to the relevant application module (e.g., OneLend requires `loan-origination`) |
| **Permission Sets (RBAC)** | Role-based access: `canRead`, `canWrite`, `canApprove`, `canConfigure`, `canExport` per resource type |
| **Grants** | Fine-grained, resource-scoped permissions (e.g., "User X can `approve` `rate-lock` resources") |
| **Agent Scopes** | Time-boxed, action-scoped permissions for AI agents with max delegation depth of 3 |
| **Delegation Chains** | Ceiling actions (intersection), time-boxed, RS256 JWTs for agent-to-agent delegation |

### 10 Standard Actions

`read` · `create` · `update` · `delete` · `export` · `import` · `approve` · `submit` · `configure` · `invoke`

### Permissioning Matrix (excerpt)

| Resource | Read | Create | Approve | Export |
|----------|------|--------|---------|--------|
| Document | Analyst+ | Borrower+ | Underwriter | Compliance |
| Application | Loan Officer+ | Loan Officer+ | — | Compliance |
| Rate Lock | Loan Officer+ | Loan Officer+ | Pricing/Credit Officer | — |
| Diligence Pool | Analyst+ | Analyst | Sr. Analyst / Head | Compliance |
| Deal | Trader+ | Trader | Head of Trading | Compliance |
| Servicing | Asset Manager+ | Servicer | Credit Committee | — |

---

## Observability

Every action in Sentinel is observable, auditable, and queryable.

| Layer | What's Captured | Query Surface |
|-------|----------------|---------------|
| **API Gateway** | Every HTTP request/response (status, latency, tenant, user) | Azure Monitor / KQL |
| **Event Bus** | Every `publishEvent()` with entity type, entity ID, event type, payload | REST API (paginated, filterable), SSE (real-time), Timeline view |
| **ECA Execution** | Every trigger evaluation, rules fired, subscriptions matched, actions executed | Execution log API with time-range filtering |
| **Dead Letters** | Every failed action with full event context | Dead letter API with replay capability |
| **AI Pipelines** | Every actor stage: input/output, duration, LLM tokens, confidence | Real-time SSE streaming + batch query |
| **Rule Evaluation** | Facts asserted, rules fired, explanation tree | Prio explanation API + Sentinel decisions API |
| **Authorization** | Every check/filter decision | Structured logs + OPA decision logs |
| **Data Provenance** | Which document → which extracted field → which pricing decision | Provenance API per entity |

---

## Data Provenance — Complete Lineage for Every Input, Decision & State Change

Sentinel implements a **comprehensive provenance system** that captures the full lineage of every input, event, state change, decision, artifact, and extracted value across the entire platform. This is not retrofitted logging — provenance is a first-class data model with its own Cosmos DB container, dedicated taxonomy, retention policies, and a purpose-built UI for auditors, compliance officers, and operations teams.

Every piece of data in Sentinel can be traced back to its origin: which document it came from, which page, which AI model extracted it, who reviewed it, what decision it influenced, and what downstream actions it triggered.

### Provenance Data Model

Every provenance record captures:

| Field | Purpose |
|-------|---------|
| **Entity Reference** | Container, type, and ID of the affected entity (loan, deal, pool, etc.) |
| **Change Type** | What kind of change: `create`, `update`, `delete`, `status_change`, `decision`, `document`, `financial`, `compliance`, `process_step`, `system`, `audit` (11 types) |
| **Domain** | Which business domain: `origination`, `underwriting`, `document`, `rate_lock`, `closing`, `warehousing`, `secondary_market`, `diligence`, `structuring`, `servicing`, `transfer`, `portfolio`, `risk`, `compliance`, `ai_pipeline`, `system`, `audit` (17 domains) |
| **Event** | Specific named event from a taxonomy of **255 provenance events** spanning the entire loan lifecycle — from `inquiry` through `foreclosure_sale_completed` to `regulatory_hold_released` |
| **Field-Level Diffs** | Before and after values for every changed field |
| **Post-Change Snapshot** | Optional full entity snapshot after the change |
| **Actor & Actor Type** | Who or what made the change: `user`, `system`, or `process` |
| **Source System** | Which system originated the change: `sentinel`, `axiom`, `loom`, `mop`, `prixer`, `structura`, `external`, `migration` (8 systems) |
| **Process Context** | Process instance ID, process key, step ID — links to the workflow that drove the change |
| **Triggering Rule/Criterion** | Which ECA rule or evaluation criterion triggered this change |
| **Correlation ID** | Links related provenance records across systems into a single causal chain |
| **Severity** | `info`, `notice`, `warning`, `critical` — drives UI alerting and SLA tracking |
| **Regulatory Reference** | Applicable regulation (TRID, ECOA, HMDA, etc.) |
| **Retention Category** | `operational`, `regulatory_3yr`, `regulatory_5yr`, `regulatory_7yr`, `permanent` — governs data lifecycle |

### The 255-Event Provenance Taxonomy

Sentinel's provenance taxonomy covers every meaningful event in the mortgage and structured finance lifecycle. Events are grouped by domain:

| Domain | Example Events | Count |
|--------|---------------|-------|
| **Origination** | `inquiry`, `pre_qualification`, `application_received`, `credit_pull_soft`, `credit_pull_hard`, `program_assigned`, `program_changed` | ~25 |
| **Underwriting** | `uw_assigned`, `criteria_evaluated`, `rule_evaluated`, `exception_requested`, `exception_approved`, `decision_approved`, `decision_declined` | ~15 |
| **Documents** | `document_uploaded`, `document_classified`, `document_extracted`, `document_stacking_complete`, `document_deficiency_raised`, `document_deficiency_cured` | ~10 |
| **Rate Lock** | `rate_locked`, `rate_lock_extended`, `rate_lock_expired`, `rate_lock_cancelled`, `rate_relocked`, `float_down_exercised` | ~8 |
| **Closing** | `closing_disclosure_issued`, `closing_scheduled`, `closing_docs_signed`, `disbursement_authorized`, `funds_disbursed`, `loan_funded`, `notarization_completed` | ~15 |
| **Warehousing** | `warehouse_line_assigned`, `wet_funded`, `dry_funded`, `bailee_letter_sent`, `original_note_shipped`, `warehouse_paid_off`, `position_aged_warning` | ~8 |
| **Secondary Market** | `tape_submitted`, `bid_received`, `bid_accepted`, `bid_countered`, `mlpa_executed`, `purchase_price_settled`, `loan_transferred_sold`, `trade_settled` | ~18 |
| **Diligence** | `diligence_pool_created`, `diligence_loan_assigned`, `finding_raised`, `finding_graded`, `finding_cured`, `grade_overridden`, `pool_certified`, `pool_rejected` | ~15 |
| **Structuring** | `deal_structured`, `bond_created`, `waterfall_modified`, `collateral_added`, `scenario_run`, `assumptions_locked`, `deal_priced` | ~10 |
| **Servicing** | `payment_received`, `payment_applied`, `advance_made`, `escrow_analysis_complete`, `late_charge_assessed`, `payoff_received`, `interest_rate_reset` | ~30 |
| **Loss Mitigation** | `delinquency_30` through `120_plus`, `forbearance_granted`, `modification_approved`, `short_sale_completed`, `foreclosure_initiated`, `reo_acquired`, `liquidation_complete` | ~35 |
| **Transfers & Custody** | `transfer_initiated`, `transfer_completed`, `mers_registration`, `note_endorsed`, `servicing_transferred_in`, `custody_transferred` | ~15 |
| **Portfolio & Accounting** | `portfolio_created`, `hfi_designated`, `locom_adjustment`, `fair_value_mark_down`, `impairment_recognized`, `premium_amortized` | ~18 |
| **Risk** | `watch_list_added`, `risk_rating_changed`, `stress_test_run`, `concentration_limit_flagged`, `regulatory_capital_impact` | ~6 |
| **Compliance** | `hmda_lar_submitted`, `trid_le_issued`, `ecoa_notice_issued`, `qm_determination`, `adverse_action_notice`, `cra_classification` | ~15 |
| **AI Pipeline** | `extraction_run`, `intelligence_analysis_run`, `reconciliation_run`, `proactive_finding_raised`, `axiom_pipeline_started`, `axiom_pipeline_completed`, `cml_context_assembled` | ~12 |
| **Audit** | `record_accessed`, `record_exported`, `pii_accessed`, `data_correction_requested`, `data_correction_applied`, `regulatory_hold_placed`, `legal_hold_released` | ~15 |

### Three Layers of Provenance

Sentinel captures provenance at three distinct layers, each serving a different purpose:

#### Layer 1: Data Provenance — Immutable Audit Trail

Every state mutation across the platform writes an append-only `DataProvenanceRecord` to a dedicated Cosmos DB container. This captures who changed what, when, and why — with field-level before/after diffs, process context, triggering rules, and regulatory classification.

Records are **append-only** — they cannot be updated or deleted. IDs and timestamps are generated server-side to prevent tampering. The full chronological trail for any entity is queryable via API, and cross-entity search enables compliance officers to find all changes by a specific actor, process, or date range.

#### Layer 2: Field Provenance — Extraction Lineage

Every extracted data value on a loan is traced back to its physical source:

| Attribute | Example |
|-----------|---------|
| **Source document** | "Smith_W2_2025.pdf" |
| **Source page** | Page 1 |
| **Bounding box** | Pixel coordinates (120, 340, 280, 360) on the page |
| **Confidence** | 0.96 |
| **Extraction method** | `hybrid` (OCR + vision) |
| **Excerpt** | "Wages, tips, other compensation: $185,000.00" |

Field provenance is stored directly on the loan record as a map of field path to provenance entry. For example, `"borrower.fico"` maps to the exact page and bounding box in the credit report where the score was extracted.

#### Layer 3: Criterion Provenance — Decision Traceability

Every evaluation criterion (underwriting guideline, diligence finding, compliance check) tracks:

- Source document and page numbers
- Source fragment node IDs and embedding coherence scores
- Extraction pipeline job ID and actor
- AI model used (e.g., "gpt-4o-mini") and confidence score
- Human review status: `pending`, `approved`, `rejected`, or `edited`
- Who reviewed it, when, and their comment
- Which fields were manually edited

### How Provenance Flows Through Journeys — Concrete Examples

#### Example 1: Document Extraction → Field Provenance → Pricing Decision

```
1. Borrower uploads "Smith_W2_2025.pdf"
   ├─ Provenance: document_uploaded (actor: borrower, domain: document)

2. Axiom extracts annual income = $185,000 from page 1, box (120, 340, 280, 360)
   ├─ FieldProvenance written to loan.fieldProvenance["borrower.annualIncome"]:
   │   sourceFileName: "Smith_W2_2025.pdf"
   │   sourcePage: 1
   │   boundingBox: { x: 120, y: 340, width: 280, height: 360 }
   │   confidence: 0.96
   │   extractionMethod: "hybrid"
   │   excerpt: "Wages, tips, other compensation: $185,000.00"
   ├─ Provenance: document_extracted (actor: system/axiom, domain: ai_pipeline)

3. MOP uses annualIncome to compute DSCR = 1.32, qualifies for dscr-30-year at 7.125%
   ├─ Provenance: program_assigned (actor: system/mop, domain: origination)
   │   fieldChanges: [{ field: "programId", before: null, after: "dscr-30-year" }]
   │   details: { dscr: 1.32, rate: 7.125, baseRate: 6.50 }

4. Underwriter reviews and approves
   ├─ Provenance: decision_approved (actor: user/jane.doe, domain: underwriting)
   │   severity: notice
   │   regulatoryRef: "ECOA"
```

**Result:** An auditor can click on the loan's DSCR of 1.32 and trace it back through the pricing calculation to the W-2 income value, to the exact page and pixel region of the original PDF, to the AI model and confidence score that extracted it, to the underwriter who approved it. Every link in the chain is a queryable provenance record.

#### Example 2: Rate Lock Lifecycle — Correction Cascade

```
1. Loan officer locks rate at 7.125% on dscr-30-year
   ├─ Provenance: rate_locked (actor: user/john.officer, domain: rate_lock)
   │   fieldChanges: [{ field: "rateLockStatus", before: null, after: "ACTIVE" }]
   │   details: { rate: 7.125, lockDays: 45, expiresAt: "2026-05-23" }
   │   retentionCategory: regulatory_7yr

2. Analyst corrects appraisal value after review
   ├─ Provenance: data_correction_applied (actor: user/analyst, domain: document)
   │   fieldChanges: [{ field: "appraisedValue", before: 2800000, after: 2650000 }]
   │   triggeringCriterionId: "criterion-appraisal-review-42"

3. ECA auto-triggers MOP re-price → LTV now 79.2% instead of 75%
   ├─ Provenance: program_changed (actor: system/sentinel, domain: origination)
   │   fieldChanges: [{ field: "finalRate", before: 7.125, after: 7.250 }]
   │   correlationId: "correction-chain-abc123"  ← links all 3 records

4. Rate lock price differs from new price → warning alert
   ├─ Provenance: rate_lock (severity: warning, "repriced_after_correction")
```

**Result:** When the rate desk sees the warning, they can follow the correlation chain backward: the rate change was caused by a re-price, which was triggered by an appraisal correction, which was made by a specific analyst reviewing a specific criterion. Every decision is traceable and defensible.

#### Example 3: Diligence Pool — AI Findings Through Certification

```
1. Pool created with 150 loans
   ├─ Provenance: diligence_pool_created (actor: user/analyst, domain: diligence)

2. Axiom AI reviews each loan → 150 × extraction_run + criteria_evaluated
   ├─ CriterionProvenance per finding:
   │   sourceDocumentId, sourcePageNumbers: [3, 4, 7]
   │   extractionMetadata: { model: "gpt-4o-mini", confidence: 0.91 }
   │   humanReview: { status: "pending" }

3. Finding raised: "Appraisal dated > 120 days"
   ├─ Provenance: finding_raised (domain: diligence, severity: warning)

4. Senior analyst overrides grade from FAIL to WAIVE
   ├─ Provenance: grade_overridden (actor: user/senior.analyst, domain: diligence)
   │   CriterionProvenance.humanReview:
   │     status: "edited", reviewedBy: "senior.analyst"
   │     comment: "Appraisal dated 125 days — within borrower extension tolerance"

5. Pool certified by head of diligence
   ├─ Provenance: pool_certified (actor: user/head.diligence, domain: diligence)
   │   retentionCategory: regulatory_5yr
```

**Result:** A post-trade auditor reviewing this pool can see every AI finding, every human override, who approved each exception with their reasoning, and the complete certification chain — all linked to source documents with page-level citations.

#### Example 4: Custody Chain of Title

```
1. Original note shipped from warehouse bank
   ├─ Provenance: original_note_shipped (domain: warehousing)
   │   details: { from: "warehouse_bank_a", to: "permanent_custodian", trackingNumber: "..." }

2. Bailee letter generated and sent
   ├─ Provenance: bailee_letter_sent (domain: warehousing)

3. Custodian confirms receipt 3 days later
   ├─ Provenance: custody_transferred (actor: external/custodian, domain: transfer)
   │   fieldChanges: [{ field: "currentLocation", before: "in_transit", after: "permanent_custodian" }]

4. MERS registration updated
   ├─ Provenance: mers_registration (domain: transfer, retentionCategory: permanent)
```

**Result:** Complete chain-of-title documentation with every physical movement, every hand-off, and every registration captured with timestamps, actors, and permanent retention.

### Provenance Automation via ECA

Provenance is not just passively recorded — it actively drives automation through the ECA engine:

1. **`EmitExtractionFactsHandler`** — When an Axiom pipeline completes, this handler looks up the extraction record, publishes all extracted fact values as a structured event, preserving the link between pipeline execution and loan facts.

2. **`WriteFieldProvenanceHandler`** — Subscribes to the facts-ready event and writes a `FieldProvenance` entry per extracted field, linking each value to its source document, extraction method, and confidence score. This is additive — new extractions merge with existing provenance without overwriting prior entries.

3. **Downstream chain** — The `sentinel.loan.field-provenance-updated` trigger point fires after provenance is written, enabling ECA subscriptions to auto-trigger condition clearance checks, pricing re-evaluations, or review status transitions based on what was just extracted and where it came from.

4. **Custody provenance pipeline** — When a custody transfer is recorded, ECA triggers a dedicated Axiom pipeline to write chain-of-custody provenance entries with full document movement tracking.

### Provenance UI

The Provenance page provides two views:

- **Entity Trail** — Full chronological history of any entity. Every record rendered as an expandable card with color-coded change type badges (green = create, blue = update, red = delete, purple = status change, orange = process step), actor identification (user vs. system icon), field-level diffs with before/after highlighting, optional post-change snapshots, and direct links to triggering processes.

- **Cross-Entity Search** — Find provenance records across all entities by actor, process key, change type, or date range. Used by compliance officers to answer questions like "What did analyst Jane Doe change last Tuesday?" or "Show me all grade overrides on pool DUE-2026-042."

### Regulatory Retention

Every provenance record carries a retention category that governs its lifecycle:

| Category | Retention | Typical Events |
|----------|-----------|----------------|
| **Operational** | Active use | Routine status changes, system events |
| **Regulatory 3-Year** | 3 years | Standard servicing records |
| **Regulatory 5-Year** | 5 years | Diligence findings, compliance decisions |
| **Regulatory 7-Year** | 7 years | Rate lock decisions, underwriting approvals, TRID disclosures |
| **Permanent** | Indefinite | MERS registrations, legal holds, regulatory holds |

---

## Data Architecture

### Storage

| Store | Technology | Purpose |
|-------|-----------|---------|
| **Cosmos DB** | Azure Cosmos DB (NoSQL) | All domain entities, events, ECA configuration, tenant configuration, user preferences |
| **Azure Blob Storage** | Tenant-scoped containers | Original documents, generated reports, data room files |
| **Redis** | Azure Cache for Redis | BullMQ job queues, session cache, configuration cache |

### Key Cosmos Containers

| Container | Partition Key | Contents |
|-----------|--------------|----------|
| `loans` | `/tenantId` | Loan records with full lifecycle state |
| `car-portfolios` | `/tenantId` | Portfolio groupings for capital markets |
| `car-assets` | `/portfolioId` | Canonical asset records (60+ fields each) |
| `events` | `/tenantId` | Immutable event log — every `publishEvent()` |
| `eca-execution-log` | `/tenantId` | Automation execution audit trail |
| `tenant-configurations` | `/tenantId` | Per-tenant feature, resource, and throttling config |
| `platform-applications` | `/id` | Application definitions and capabilities |

### Identity & Authentication

- **Azure AD / Entra ID** — SSO for all user authentication
- **SCIM provisioning** — automated user provisioning/deprovisioning via SCIM 2.0 endpoint
- **DefaultAzureCredential** — Managed Identity for all Azure SDK clients (Cosmos, Blob, Key Vault)
- **API keys** — used exclusively for LLM provider access (OpenAI, Azure OpenAI)

---

## Infrastructure

| Component | Technology | Notes |
|-----------|-----------|-------|
| **Compute** | Azure Container Apps | Auto-scaling, blue-green deployment |
| **API Gateway** | Azure API Management | Header-based versioning, central routing |
| **Database** | Azure Cosmos DB | Multi-region, automatic indexing |
| **Blob Storage** | Azure Blob Storage | Tenant-isolated containers |
| **Cache** | Azure Cache for Redis | Job queues, ephemeral state |
| **Monitoring** | Azure Application Insights | Distributed tracing, custom metrics |
| **IaC** | Bicep | All infrastructure defined as code — no infra provisioned from application code |
| **CI/CD** | GitHub Actions | Automated build, test, deploy per environment |

### Deployment Environments

| Environment | Purpose |
|-------------|---------|
| `dev` | Development and integration testing |
| `staging` | Pre-production validation |
| `prod` | Production |

---

## Scale & Coverage

| Metric | Count |
|--------|-------|
| API Controllers | 87 |
| UI Pages | 158 |
| ECA Trigger Points | 40+ |
| ECA Emission Rules | 46 |
| ECA Subscriptions | 60+ |
| ECA Action Handlers | 12 |
| Axiom AI Actors | 80+ |
| Axiom Sentinel Pipelines | 28 |
| Prio Rule Sets | 21 |
| MOP Loan Programs | 8 |
| SLA Scanners | 7 |
| Lending Calculators | Income, Asset, DSCR Sizer |
| Backend Tests | 2,887 |

---

## Summary of Differentiators

1. **AI-Native, Not AI-Bolted** — Document intelligence, extraction, criteria evaluation, and agentic reasoning are woven into every workflow, not added as an afterthought.

2. **Event-Driven Automation Fabric** — Every action emits events that drive downstream automation through configurable, auditable rules — with circuit breakers, dead letters, and cycle detection.

3. **Purpose-Built Engines** — Pricing (MOP, C++), rule evaluation (Prio, C++ RETE-NT), and structured finance simulation (Structura, C++/QuantLib) are high-performance native engines, not interpreted scripts.

4. **Full Lifecycle Coverage** — A single platform from borrower intake through securitization, servicing, and surveillance. No system-of-systems integration headaches.

5. **Configuration-Driven Multi-Tenancy** — Application composition, feature access, pricing rules, diligence thresholds, and workflow definitions are all tenant-configurable in the database — not hardcoded.

6. **Policy-Based Authorization** — OPA-backed RBAC with fine-grained grants, agent delegation, and module gating. Every action at every boundary is authorized.

7. **Full Observability** — Every event, every rule evaluation, every AI pipeline stage, every authorization decision is persisted, queryable, and replayable.

8. **Human-in-the-Loop by Design** — Automation handles the work; humans make the judgments. Every HITL checkpoint is explicit, role-gated, and auditable.

---