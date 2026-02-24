# Portfolio Analytics Service - Architecture Plan
## Using Loom for Batch Orchestration

---

## Overview

Portfolio Analytics processes **thousands of properties** in parallel with fault tolerance, progress tracking, and exactly-once semantics. This is where Loom's actor model provides real value over simple REST APIs.

## Use Cases

### Primary Features
1. **Portfolio-Wide Valuation**
   - Update AVM values for entire portfolio (10,000+ properties)
   - Compare current values to last appraisal
   - Identify properties with significant value changes

2. **Risk Stratification**
   - Categorize properties by risk level (A, B, C, D)
   - Calculate portfolio-wide LTV ratios
   - Identify pre-distressed assets (LTV > 90%)

3. **Fraud Screening**
   - Batch fraud analysis across all recent appraisals
   - Pattern detection across multiple appraisals
   - Appraiser performance analytics

4. **Market Monitoring**
   - Track portfolio value trends over time
   - Geographic concentration analysis
   - Property type distribution and risk

---

## Why Loom for Portfolio Analytics?

| Challenge | How Loom Solves It |
|-----------|-------------------|
| **Long-running** (hours for large portfolios) | Journal-based persistence - resume from crash |
| **Partial failures** (some properties fail) | Actor isolation - failures don't cascade |
| **Progress tracking** | Actor state - real-time progress updates |
| **Idempotency** (don't reprocess) | Built-in idempotency store with TTL |
| **Parallel processing** | Multiple actor instances working concurrently |
| **Cost control** | Track API costs per job, estimate before running |

**Without Loom:** Simple batch API would lose progress on crash, harder to scale, no built-in fault tolerance.

---

## Architecture

### Actor Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                    REST API Layer                           │
│  POST /api/portfolio/analyze  (starts Loom workflow)       │
│  GET  /api/portfolio/jobs/:id (check progress)             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│           Portfolio Orchestrator Actor                      │
│  - Receives job request (10,000 properties)                 │
│  - Breaks into chunks (100 properties per chunk)            │
│  - Sends messages to processing queue                       │
│  - Tracks overall progress                                  │
│  - Handles job completion/failure                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Message Queue (BullMQ/Redis)                   │
│  Queue: "portfolio-processing"                              │
│  - 100 chunks queued                                        │
│  - Concurrency: 10 (10 actors processing simultaneously)   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│        Property Batch Processor Actors (10 instances)       │
│  - Process 100 properties per chunk                         │
│  - Call AVM Service for each property                       │
│  - Call Fraud Detection if needed                           │
│  - Store results with idempotency key                       │
│  - Report progress back to orchestrator                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Result Aggregator Actor                        │
│  - Collects all chunk results                               │
│  - Calculates portfolio-wide metrics                        │
│  - Generates summary report                                 │
│  - Stores final results in Cosmos DB                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Loom Actor Implementations

### 1. Portfolio Orchestrator Actor

**Responsibility:** Coordinate entire portfolio analysis job

```typescript
// src/actors/portfolio-orchestrator.actor.ts

import { Actor } from '@certo-ventures/loom';
import type { ActorContext } from '@certo-ventures/loom';

export interface PortfolioAnalysisJob {
  jobId: string;
  portfolioId: string;
  properties: Array<{
    propertyId: string;
    address: string;
    latitude?: number;
    longitude?: number;
    lastAppraisedValue?: number;
    lastAppraisalDate?: string;
  }>;
  analysisType: 'valuation' | 'fraud' | 'risk' | 'comprehensive';
  priority: 'standard' | 'high';
  estimatedCost?: number;
}

export interface OrchestratorState {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  totalProperties: number;
  processedProperties: number;
  failedProperties: number;
  chunks: Array<{
    chunkId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    properties: number;
  }>;
  startTime: string;
  endTime?: string;
  results?: {
    totalValue: number;
    avgValue: number;
    riskDistribution: Record<string, number>;
    fraudFlagged: number;
  };
}

export class PortfolioOrchestratorActor extends Actor {
  protected getDefaultState(): Record<string, unknown> {
    return {
      status: 'queued',
      processedProperties: 0,
      failedProperties: 0,
      chunks: [],
    };
  }

  async execute(input: unknown): Promise<void> {
    const job = input as PortfolioAnalysisJob;
    const state = this.state as OrchestratorState;

    // Initialize job
    state.jobId = job.jobId;
    state.totalProperties = job.properties.length;
    state.startTime = new Date().toISOString();
    state.status = 'processing';

    // Break portfolio into chunks (100 properties per chunk)
    const chunkSize = 100;
    const chunks = [];
    
    for (let i = 0; i < job.properties.length; i += chunkSize) {
      const chunkProperties = job.properties.slice(i, i + chunkSize);
      const chunkId = `${job.jobId}-chunk-${Math.floor(i / chunkSize)}`;
      
      chunks.push({
        chunkId,
        status: 'pending' as const,
        properties: chunkProperties.length,
      });

      // Send message to processing queue with idempotency key
      await this.sendMessage('property-batch-processor', {
        chunkId,
        jobId: job.jobId,
        properties: chunkProperties,
        analysisType: job.analysisType,
      }, {
        idempotencyKey: chunkId, // Exactly-once processing
      });
    }

    state.chunks = chunks;
    this.updateState(state);
  }

  // Called by batch processors when chunk completes
  async handleChunkComplete(chunkId: string, results: any): Promise<void> {
    const state = this.state as OrchestratorState;
    
    const chunk = state.chunks.find(c => c.chunkId === chunkId);
    if (chunk) {
      chunk.status = 'completed';
      state.processedProperties += chunk.properties;
    }

    // Check if all chunks complete
    if (state.chunks.every(c => c.status === 'completed' || c.status === 'failed')) {
      state.status = 'completed';
      state.endTime = new Date().toISOString();
      
      // Trigger aggregation
      await this.sendMessage('result-aggregator', {
        jobId: state.jobId,
      });
    }

    this.updateState(state);
  }
}
```

### 2. Property Batch Processor Actor

**Responsibility:** Process batch of properties (calls our AVM/Fraud services)

```typescript
// src/actors/property-batch-processor.actor.ts

import { Actor } from '@certo-ventures/loom';
import type { ActorContext } from '@certo-ventures/loom';
import { AVMCascadeService } from '../services/avm-cascade.service';
import { FraudDetectionService } from '../services/fraud-detection.service';

export interface BatchProcessorInput {
  chunkId: string;
  jobId: string;
  properties: Array<{
    propertyId: string;
    address: string;
    latitude?: number;
    longitude?: number;
  }>;
  analysisType: 'valuation' | 'fraud' | 'risk' | 'comprehensive';
}

export class PropertyBatchProcessorActor extends Actor {
  private avmService: AVMCascadeService;
  private fraudService: FraudDetectionService;

  constructor(context: ActorContext) {
    super(context);
    this.avmService = new AVMCascadeService();
    this.fraudService = new FraudDetectionService();
  }

  async execute(input: unknown): Promise<void> {
    const batch = input as BatchProcessorInput;
    const results = [];

    // Process each property with idempotency
    for (const property of batch.properties) {
      const idempotencyKey = `${batch.jobId}-${property.propertyId}`;
      
      // Check if already processed
      if (await this.checkIdempotency(idempotencyKey)) {
        continue; // Skip already processed
      }

      try {
        let result: any = { propertyId: property.propertyId };

        // Run valuation if needed
        if (batch.analysisType === 'valuation' || batch.analysisType === 'comprehensive') {
          const valuation = await this.avmService.getValuation({
            address: property.address,
            latitude: property.latitude,
            longitude: property.longitude,
            strategy: 'quality',
          });
          result.valuation = valuation.result;
        }

        // Run fraud detection if needed
        if (batch.analysisType === 'fraud' || batch.analysisType === 'comprehensive') {
          // Would need full appraisal data for fraud detection
          // For now, mark as skipped
          result.fraudAnalysis = { skipped: true };
        }

        results.push(result);
        
        // Store with idempotency
        await this.storeIdempotency(idempotencyKey, result);

      } catch (error) {
        results.push({
          propertyId: property.propertyId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Report completion back to orchestrator
    await this.sendMessage('portfolio-orchestrator', {
      event: 'chunk-complete',
      chunkId: batch.chunkId,
      results,
    });

    this.updateState({ 
      processed: true, 
      count: results.length,
      timestamp: new Date().toISOString(),
    });
  }
}
```

### 3. Result Aggregator Actor

**Responsibility:** Collect and summarize all results

```typescript
// src/actors/result-aggregator.actor.ts

import { Actor } from '@certo-ventures/loom';
import type { ActorContext } from '@certo-ventures/loom';
import { CosmosDbService } from '../services/cosmos-db.service';

export class ResultAggregatorActor extends Actor {
  private dbService: CosmosDbService;

  constructor(context: ActorContext) {
    super(context);
    this.dbService = new CosmosDbService();
  }

  async execute(input: { jobId: string }): Promise<void> {
    const { jobId } = input;

    // Fetch all results from idempotency store
    const allResults = await this.fetchAllResults(jobId);

    // Calculate portfolio metrics
    const metrics = this.calculateMetrics(allResults);

    // Store final report
    await this.dbService.createDocument('portfolio-reports', {
      id: `report-${jobId}`,
      jobId,
      completedAt: new Date().toISOString(),
      totalProperties: allResults.length,
      metrics,
      results: allResults,
    });

    this.updateState({ 
      aggregated: true, 
      totalProperties: allResults.length,
      metrics,
    });
  }

  private calculateMetrics(results: any[]): any {
    const successful = results.filter(r => !r.error);
    const failed = results.filter(r => r.error);

    const totalValue = successful
      .filter(r => r.valuation?.result?.estimatedValue)
      .reduce((sum, r) => sum + r.valuation.result.estimatedValue, 0);

    return {
      totalProperties: results.length,
      successful: successful.length,
      failed: failed.length,
      totalValue,
      avgValue: successful.length > 0 ? totalValue / successful.length : 0,
      riskDistribution: this.calculateRiskDistribution(successful),
    };
  }

  private calculateRiskDistribution(results: any[]): Record<string, number> {
    // Categorize by value ranges
    return {
      'under-200k': results.filter(r => r.valuation?.result?.estimatedValue < 200000).length,
      '200k-500k': results.filter(r => {
        const v = r.valuation?.result?.estimatedValue;
        return v >= 200000 && v < 500000;
      }).length,
      '500k-1m': results.filter(r => {
        const v = r.valuation?.result?.estimatedValue;
        return v >= 500000 && v < 1000000;
      }).length,
      'over-1m': results.filter(r => r.valuation?.result?.estimatedValue >= 1000000).length,
    };
  }

  private async fetchAllResults(jobId: string): Promise<any[]> {
    // Implementation would fetch from idempotency store or database
    // Simplified for planning purposes
    return [];
  }
}
```

---

## REST API Service Layer

### Portfolio Analytics Service (Orchestration Layer)

```typescript
// src/services/portfolio-analytics.service.ts

import { ActorRuntime } from '@certo-ventures/loom';
import { Logger } from '../utils/logger';
import { CosmosDbService } from './cosmos-db.service';

export interface PortfolioAnalysisRequest {
  portfolioId: string;
  properties: Array<{
    propertyId: string;
    address: string;
    latitude?: number;
    longitude?: number;
  }>;
  analysisType: 'valuation' | 'fraud' | 'risk' | 'comprehensive';
  priority?: 'standard' | 'high';
}

export interface PortfolioJobStatus {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: {
    total: number;
    processed: number;
    failed: number;
    percentComplete: number;
  };
  startTime: string;
  endTime?: string;
  estimatedTimeRemaining?: string;
  results?: any;
}

export class PortfolioAnalyticsService {
  private logger: Logger;
  private dbService: CosmosDbService;
  private actorRuntime: ActorRuntime;

  constructor() {
    this.logger = new Logger();
    this.dbService = new CosmosDbService();
    // Initialize Loom runtime with Redis for production
    this.actorRuntime = new ActorRuntime({
      /* Redis, message queue config */
    });
  }

  /**
   * Start a new portfolio analysis job
   */
  async startAnalysis(request: PortfolioAnalysisRequest): Promise<{ jobId: string; estimatedCost: number }> {
    const jobId = `portfolio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Estimate cost
    const estimatedCost = this.estimateCost(request);

    // Create job record
    await this.dbService.createDocument('portfolio-jobs', {
      id: jobId,
      portfolioId: request.portfolioId,
      status: 'queued',
      totalProperties: request.properties.length,
      analysisType: request.analysisType,
      estimatedCost,
      createdAt: new Date().toISOString(),
    });

    // Start Loom workflow - create orchestrator actor
    await this.actorRuntime.sendMessage({
      actorType: 'PortfolioOrchestrator',
      actorId: jobId,
      body: {
        jobId,
        portfolioId: request.portfolioId,
        properties: request.properties,
        analysisType: request.analysisType,
        priority: request.priority || 'standard',
        estimatedCost,
      },
      idempotencyKey: `start-${jobId}`,
    });

    return { jobId, estimatedCost };
  }

  /**
   * Get job status and progress
   */
  async getJobStatus(jobId: string): Promise<PortfolioJobStatus | null> {
    // Fetch from Loom actor state
    const orchestratorState = await this.actorRuntime.getActorState(
      'PortfolioOrchestrator',
      jobId
    );

    if (!orchestratorState) {
      return null;
    }

    const progress = {
      total: orchestratorState.totalProperties,
      processed: orchestratorState.processedProperties,
      failed: orchestratorState.failedProperties,
      percentComplete: (orchestratorState.processedProperties / orchestratorState.totalProperties) * 100,
    };

    return {
      jobId,
      status: orchestratorState.status,
      progress,
      startTime: orchestratorState.startTime,
      endTime: orchestratorState.endTime,
      results: orchestratorState.results,
    };
  }

  /**
   * Cancel a running job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    // Implementation would stop the orchestrator actor
    return true;
  }

  /**
   * Estimate cost before running
   */
  private estimateCost(request: PortfolioAnalysisRequest): number {
    // Cost breakdown:
    // - AVM valuation: $0.02 per property (Bridge API cost)
    // - Fraud detection: $0.05 per property (AI cost)
    // - Risk analysis: $0.01 per property (computation only)

    const count = request.properties.length;
    let cost = 0;

    switch (request.analysisType) {
      case 'valuation':
        cost = count * 0.02;
        break;
      case 'fraud':
        cost = count * 0.05;
        break;
      case 'risk':
        cost = count * 0.01;
        break;
      case 'comprehensive':
        cost = count * (0.02 + 0.05 + 0.01); // All three
        break;
    }

    return Math.round(cost * 100) / 100; // Round to cents
  }
}
```

---

## REST API Controller

```typescript
// src/controllers/portfolio-analytics.controller.ts

import express, { Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { PortfolioAnalyticsService } from '../services/portfolio-analytics.service';
import { Logger } from '../utils/logger';

const router = express.Router();
const logger = new Logger();
const portfolioService = new PortfolioAnalyticsService();

/**
 * POST /api/portfolio/analyze
 * Start a new portfolio analysis job
 */
router.post(
  '/analyze',
  [
    body('portfolioId').notEmpty(),
    body('properties').isArray({ min: 1, max: 100000 }),
    body('properties.*.propertyId').notEmpty(),
    body('properties.*.address').notEmpty(),
    body('analysisType').isIn(['valuation', 'fraud', 'risk', 'comprehensive']),
    body('priority').optional().isIn(['standard', 'high']),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      logger.info(`Starting portfolio analysis for ${req.body.properties.length} properties`);

      const result = await portfolioService.startAnalysis(req.body);

      return res.status(202).json({
        success: true,
        jobId: result.jobId,
        estimatedCost: result.estimatedCost,
        message: 'Portfolio analysis job started',
        statusUrl: `/api/portfolio/jobs/${result.jobId}`,
      });
    } catch (error) {
      logger.error(`Portfolio analysis start failed: ${error}`);
      return res.status(500).json({
        error: 'Failed to start portfolio analysis',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/portfolio/jobs/:jobId
 * Get job status and progress
 */
router.get(
  '/jobs/:jobId',
  [param('jobId').notEmpty()],
  async (req: Request, res: Response) => {
    try {
      const status = await portfolioService.getJobStatus(req.params.jobId);

      if (!status) {
        return res.status(404).json({ error: 'Job not found' });
      }

      return res.json({
        success: true,
        job: status,
      });
    } catch (error) {
      logger.error(`Failed to get job status: ${error}`);
      return res.status(500).json({
        error: 'Failed to retrieve job status',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * DELETE /api/portfolio/jobs/:jobId
 * Cancel a running job
 */
router.delete(
  '/jobs/:jobId',
  [param('jobId').notEmpty()],
  async (req: Request, res: Response) => {
    try {
      const cancelled = await portfolioService.cancelJob(req.params.jobId);

      if (!cancelled) {
        return res.status(404).json({ error: 'Job not found or already completed' });
      }

      return res.json({
        success: true,
        message: 'Job cancellation initiated',
      });
    } catch (error) {
      logger.error(`Failed to cancel job: ${error}`);
      return res.status(500).json({
        error: 'Failed to cancel job',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/portfolio/jobs/:jobId/results
 * Get final results (only when complete)
 */
router.get(
  '/jobs/:jobId/results',
  [param('jobId').notEmpty()],
  async (req: Request, res: Response) => {
    try {
      const status = await portfolioService.getJobStatus(req.params.jobId);

      if (!status) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (status.status !== 'completed') {
        return res.status(400).json({
          error: 'Job not completed',
          status: status.status,
          progress: status.progress,
        });
      }

      return res.json({
        success: true,
        results: status.results,
      });
    } catch (error) {
      logger.error(`Failed to get job results: ${error}`);
      return res.status(500).json({
        error: 'Failed to retrieve job results',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;
```

---

## Deployment Configuration

### Loom Runtime Setup

```typescript
// src/infrastructure/loom-runtime.ts

import { ActorRuntime } from '@certo-ventures/loom';
import { RedisStateAdapter } from '@certo-ventures/loom/adapters';
import { BullMQMessageAdapter } from '@certo-ventures/loom/adapters';
import Redis from 'ioredis';

// Import actors
import { PortfolioOrchestratorActor } from '../actors/portfolio-orchestrator.actor';
import { PropertyBatchProcessorActor } from '../actors/property-batch-processor.actor';
import { ResultAggregatorActor } from '../actors/result-aggregator.actor';

export function createLoomRuntime(): ActorRuntime {
  // Redis connection
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  });

  // Create runtime
  const runtime = new ActorRuntime({
    stateAdapter: new RedisStateAdapter(redis),
    messageAdapter: new BullMQMessageAdapter(redis),
    
    // Actor pool configuration
    maxActorInstances: 50, // Max 50 concurrent batch processors
    actorIdleTimeout: 300000, // 5 minutes
    
    // Message queue configuration
    queues: {
      'portfolio-processing': {
        concurrency: 10, // 10 batch processors working simultaneously
        retryAttempts: 3,
        retryDelay: 5000,
      },
    },
  });

  // Register actor types
  runtime.registerActorType('PortfolioOrchestrator', PortfolioOrchestratorActor);
  runtime.registerActorType('PropertyBatchProcessor', PropertyBatchProcessorActor);
  runtime.registerActorType('ResultAggregator', ResultAggregatorActor);

  return runtime;
}
```

---

## Key Benefits of Loom Architecture

### 1. **Fault Tolerance**
```
If system crashes while processing 10,000 properties:
- Loom's journal records which properties completed
- On restart, resume from last checkpoint
- Idempotency keys prevent duplicate processing
- No properties processed twice
```

### 2. **Progress Tracking**
```
User calls GET /api/portfolio/jobs/{jobId}:
- Real-time progress: 6,234 / 10,000 (62.3%)
- Estimated time remaining: 12 minutes
- Current status per chunk
- Can see which properties failed
```

### 3. **Cost Control**
```
Before starting job:
- Estimate cost: 10,000 properties × $0.08 = $800
- Get user approval
- Track actual cost during processing
- Alert if exceeding budget
```

### 4. **Scalability**
```
- Concurrency: 10 batch processors × 100 properties = 1,000 at a time
- For 100,000 properties: Add more workers dynamically
- Loom handles work distribution automatically
- No manual load balancing needed
```

### 5. **Exactly-Once Processing**
```
Idempotency key: portfolio-job-12345-property-98765
- First time: Process and store result
- Retry after failure: Check key, skip processing
- No duplicate AVM API calls (saves money!)
```

---

## Cost Estimation

### Processing 10,000 Properties (Comprehensive Analysis)

| Component | Cost per Property | Total Cost |
|-----------|------------------|------------|
| AVM Valuation (Bridge API) | $0.02 | $200 |
| Fraud Detection (Azure OpenAI) | $0.05 | $500 |
| Risk Analysis (Computation) | $0.01 | $100 |
| **Total** | **$0.08** | **$800** |

**Processing Time:** ~30 minutes with 10 concurrent workers

---

## Implementation Phases

### Phase 1: Core Infrastructure (1 week)
- [ ] Set up Loom runtime with Redis
- [ ] Implement PortfolioOrchestrator actor
- [ ] Implement PropertyBatchProcessor actor
- [ ] Basic progress tracking

### Phase 2: Services Integration (1 week)
- [ ] Integrate AVM Cascade Service
- [ ] Integrate Fraud Detection Service
- [ ] Result aggregation and reporting
- [ ] Cost tracking

### Phase 3: API & UX (3 days)
- [ ] REST API controller
- [ ] Job status endpoints
- [ ] Result retrieval
- [ ] Swagger documentation

### Phase 4: Production Hardening (1 week)
- [ ] Error handling and retries
- [ ] Cost estimation and budgets
- [ ] Performance optimization
- [ ] Monitoring and alerting

---

## When to Use vs Not Use Portfolio Analytics

### ✅ Use Portfolio Analytics (Loom) When:
- Processing **hundreds or thousands** of properties
- Need **fault tolerance** (can't lose progress)
- Need **progress tracking** (show % complete)
- Long-running operation (> 1 minute)
- Need **idempotency** (no duplicates)
- Want **distributed processing** (scale horizontally)

### ❌ Use Simple REST APIs When:
- Processing < 50 properties
- Quick operations (< 30 seconds)
- One-off analysis
- Don't need progress tracking
- Stateless operations

---

## Next Steps

1. **Decide if needed:** Do you have portfolios with 1,000+ properties?
2. **Redis setup:** Need Redis for Loom's state and message queue
3. **Actor implementation:** Build the 3 actor classes
4. **Service integration:** Connect to existing AVM/Fraud services
5. **API deployment:** Add routes to api-server.ts

**Estimated Total Implementation:** 3-4 weeks for production-ready system

