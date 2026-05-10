#!/usr/bin/env tsx
/**
 * Unified Seed Orchestrator
 *
 * Seeds the entire Appraisal Management platform with consistent, cross-linked
 * demo data. All documents use IDs prefixed with `seed-` for easy cleanup.
 *
 * Usage:
 *   npx tsx src/scripts/seed/index.ts              # Seed everything
 *   npx tsx src/scripts/seed/index.ts --module clients  # Seed one module
 *   npx tsx src/scripts/seed/index.ts --clean       # Wipe seed data, then re-seed
 *   npx tsx src/scripts/seed/index.ts --clean-only  # Wipe seed data only
 *   npx tsx src/scripts/seed/index.ts --list        # List available modules
 *
 * Environment:
 *   COSMOS_ENDPOINT or AZURE_COSMOS_ENDPOINT  (required)
 *   AZURE_TENANT_ID                           (required)
 *   AZURE_STORAGE_ACCOUNT_NAME                (optional — for blob-based seeds)
 */

import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import type { SeedModule, SeedModuleResult, SeedContext } from './seed-types.js';

// ─── Module registry (dependency order) ────────────────────────────────────────

import { module as clientsModule } from './modules/clients.js';
import { module as productsModule } from './modules/products.js';
import { module as usersModule } from './modules/users.js';
import { module as authorizationCapabilitiesModule } from './modules/authorization-capabilities.js';
import { module as vendorsModule } from './modules/vendors.js';
import { module as ordersModule } from './modules/orders.js';
import { module as documentsModule } from './modules/documents.js';
import { module as qcChecklistsModule } from './modules/qc-checklists.js';
import { module as qcReviewsModule } from './modules/qc-reviews.js';
import { module as assignmentsModule } from './modules/assignments.js';
import { module as communicationsModule } from './modules/communications.js';
import { module as constructionModule } from './modules/construction.js';
import { module as bulkPortfoliosModule } from './modules/bulk-portfolios.js';
import { module as matchingCriteriaModule } from './modules/matching-criteria.js';
import { module as timelineModule } from './modules/timeline.js';
import { module as mopCriteriaModule } from './modules/mop-criteria-seed.js';
import { module as reviewProgramsModule } from './modules/review-programs.js';
import { module as pdfTemplatesModule } from './modules/pdf-templates.js';
import { module as escalationsModule } from './modules/escalations.js';
import { module as revisionsModule } from './modules/revisions.js';
import { module as slaConfigModule } from './modules/sla-config.js';
import { module as propertiesModule } from './modules/properties.js';
import { module as engagementsModule } from './modules/engagements.js';
import { module as inspectionsModule } from './modules/inspections.js';
import { module as reportsModule } from './modules/reports.js';
import { module as arvAnalysesModule } from './modules/arv-analyses.js';
import { module as communicationPlatformModule } from './modules/communication-platform.js';
import { module as constructionCatalogModule } from './modules/construction-catalog.js';
import { module as reportTemplatesModule } from './modules/report-templates.js';
import { module as auditEventsModule } from './modules/audit-events.js';
import { module as quickbooksModule } from './modules/quickbooks.js';

/** Ordered list — phases run top-to-bottom. */
const ALL_MODULES: SeedModule[] = [
  clientsModule,        // Phase 1
  productsModule,       // Phase 2
  usersModule,          // Phase 2b — UserProfile documents (users container)
  authorizationCapabilitiesModule, // Phase 2c — Casbin capability materialization
  vendorsModule,        // Phase 3
  ordersModule,         // Phase 4
  documentsModule,      // Phase 5
  qcChecklistsModule,   // Phase 6
  qcReviewsModule,      // Phase 7
  assignmentsModule,    // Phase 8
  communicationsModule,  // Phase 9
  constructionModule,   // Phase 10
  bulkPortfoliosModule, // Phase 11
  matchingCriteriaModule, // Phase 12
  timelineModule,       // Phase 13
  mopCriteriaModule,   // Phase 14 (must precede review-programs so refs resolve)
  reviewProgramsModule, // Phase 15
  pdfTemplatesModule,   // Phase 15
  escalationsModule,    // Phase 16
  revisionsModule,      // Phase 17
  slaConfigModule,      // Phase 18
  propertiesModule,     // Phase 19
  engagementsModule,    // Phase 20
  inspectionsModule,    // Phase 21
  reportsModule,        // Phase 22
  arvAnalysesModule,    // Phase 23
  communicationPlatformModule, // Phase 24
  constructionCatalogModule,   // Phase 25
  reportTemplatesModule,        // Phase 26
  auditEventsModule,            // Phase 27
  quickbooksModule,             // Phase 28 (External Sync)
];

// ─── CLI argument parsing ─────────────────────────────────────────────────────

function parseArgs(): { modules: string[]; clean: boolean; cleanOnly: boolean; list: boolean } {
  const args = process.argv.slice(2);
  const clean = args.includes('--clean');
  const cleanOnly = args.includes('--clean-only');
  const list = args.includes('--list');

  const moduleIdx = args.indexOf('--module');
  const modules: string[] = [];
  if (moduleIdx !== -1) {
    const moduleName = args[moduleIdx + 1];
    if (moduleName) modules.push(moduleName);
  }

  return { modules, clean, cleanOnly, list };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

/**
 * Container → partition key path mapping.
 * Used by the ensure-containers step so `createIfNotExists` picks the right key.
 * Default is '/tenantId' if not listed here.
 */
const CONTAINER_PARTITION_KEYS: Record<string, string> = {
  'orders':                   '/tenantId',
  'vendors':                  '/tenantId',
  'clients':                  '/tenantId',
  'products':                 '/tenantId',
  'documents':                '/tenantId',
  'communications':           '/tenantId',
  'engagements':              '/tenantId',
  'construction-loans':       '/tenantId',
  'contractors':              '/tenantId',
  'bulk-portfolio-jobs':      '/tenantId',
  'matching-criteria-sets':   '/tenantId',
  'arv-analyses':             '/tenantId',
  'qc-reviews':               '/orderId',
  'qc-checklists':            '/tenantId',
  'revisions':                '/orderId',
  'escalations':              '/orderId',
  'rfb-requests':             '/orderId',
  'sla-tracking':             '/orderId',
  'sla-configurations':       '/clientId',
  'review-programs':          '/clientId',
  'mop-criteria':             '/clientId',
  'review-results':           '/jobId',
  'properties':               '/address/state',
  'property-summaries':       '/propertyType',
  'property-records':         '/tenantId',
  'comparable-sales':         '/tenantId',
  'comparable-analyses':      '/reviewId',
  'analytics':                '/reportType',
  'users':                    '/organizationId',
  'results':                  '/orderId',
  'sessions':                 '/userId',
  'templates':                '/category',
  'document-templates':       '/id',
  'reporting':                '/id',
  'draws':                    '/constructionLoanId',
  'construction-cost-catalog':'/division',
  'audit-trail':              '/orderId',
  'pdf-templates':            '/tenantId',
  'inspections':              '/tenantId',
  'reports':                  '/tenantId',
  'engagement-audit-events':  '/engagementId',
  'appraisal-drafts':         '/orderId',
  'integrations':             '/tenantId',
};

async function main(): Promise<void> {
  const opts = parseArgs();

  // --list: print available modules and exit
  if (opts.list) {
    console.log('\nAvailable seed modules:\n');
    ALL_MODULES.forEach((m, i) => {
      console.log(`  ${String(i + 1).padStart(2)}. ${m.name.padEnd(24)} → ${m.containers.join(', ')}`);
    });
    console.log('');
    process.exit(0);
  }

  // Validate required env vars
  const cosmosEndpoint = process.env.COSMOS_ENDPOINT ?? process.env.AZURE_COSMOS_ENDPOINT;
  if (!cosmosEndpoint) {
    console.error('❌ COSMOS_ENDPOINT (or AZURE_COSMOS_ENDPOINT) is required. Set it in .env or environment.');
    process.exit(1);
  }

  const tenantId = process.env.AZURE_TENANT_ID;
  if (!tenantId) {
    console.error('❌ AZURE_TENANT_ID is required. Set it in .env or environment.');
    process.exit(1);
  }

  const clientId = process.env.AXIOM_CLIENT_ID;
  if (!clientId) {
    console.error('❌ AXIOM_CLIENT_ID is required. Set it in .env or environment.');
    process.exit(1);
  }

  const subClientId = process.env.AXIOM_SUB_CLIENT_ID;
  if (!subClientId) {
    console.error('❌ AXIOM_SUB_CLIENT_ID is required. Set it in .env or environment.');
    process.exit(1);
  }

  const storageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME ?? '';

  // Build Cosmos client
  const isEmulator = cosmosEndpoint.includes('localhost') || cosmosEndpoint.includes('127.0.0.1');
  let cosmosClient: CosmosClient;

  if (isEmulator) {
    const https = await import('https');
    cosmosClient = new CosmosClient({
      endpoint: cosmosEndpoint,
      key: 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==',
      agent: new https.Agent({ rejectUnauthorized: false }),
      connectionPolicy: { requestTimeout: 30000, enableEndpointDiscovery: false },
    } as any);
    console.log('🔧 Cosmos DB Emulator detected — using emulator key');
  } else {
    const credential = new DefaultAzureCredential();
    cosmosClient = new CosmosClient({
      endpoint: cosmosEndpoint,
      aadCredentials: credential,
      connectionPolicy: { requestTimeout: 30000, enableEndpointDiscovery: true },
    } as any);
    console.log('🔐 Using DefaultAzureCredential for Cosmos DB');
  }

  const db = cosmosClient.database('appraisal-management');

  // ── Ensure containers exist ───────────────────────────────────────────────
  // Collect every unique container name referenced by seed modules.
  // For each one, call createIfNotExists so seeding works against a fresh db.
  const allContainerNames = [...new Set(ALL_MODULES.flatMap(m => m.containers))];
  console.log(`\n🔧 Ensuring ${allContainerNames.length} containers exist...`);
  for (const name of allContainerNames) {
    try {
      await db.containers.createIfNotExists({ id: name, partitionKey: CONTAINER_PARTITION_KEYS[name] ?? '/tenantId' });
      process.stdout.write('.');
    } catch (err: unknown) {
      // Container may already exist — that's fine
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('already exists')) {
        console.warn(`\n  ⚠️  Could not ensure container "${name}": ${msg}`);
      }
    }
  }
  console.log(' done');

  const ctx: SeedContext = {
    cosmosClient,
    db,
    tenantId,
    clientId,
    subClientId,
    now: new Date().toISOString(),
    clean: opts.clean || opts.cleanOnly,
    cleanOnly: opts.cleanOnly,
    storageAccountName,
  };

  // Resolve which modules to run
  const modulesToRun = opts.modules.length > 0
    ? ALL_MODULES.filter(m => opts.modules.some(name =>
        m.name.toLowerCase().includes(name.toLowerCase())))
    : ALL_MODULES;

  if (modulesToRun.length === 0) {
    console.error(`❌ No module found matching "${opts.modules.join(', ')}". Use --list to see available modules.`);
    process.exit(1);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🌱  Appraisal Management Platform — Seed Orchestrator');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Tenant:     ${tenantId}`);
  console.log(`  Client:     ${clientId} / ${subClientId}`);
  console.log(`  Endpoint:   ${cosmosEndpoint.substring(0, 50)}...`);
  console.log(`  Storage:    ${storageAccountName || '(not configured — blob seeds will skip)'}`);
  console.log(`  Clean:      ${ctx.clean ? 'YES' : 'no'}`);
  console.log(`  Modules:    ${modulesToRun.length} of ${ALL_MODULES.length}`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const totals: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };
  const startTime = Date.now();

  for (let i = 0; i < modulesToRun.length; i++) {
    const mod = modulesToRun[i]!;
    const phase = i + 1;
    console.log(`\n📦 Phase ${phase}/${modulesToRun.length}: ${mod.name}`);
    console.log(`   Containers: ${mod.containers.join(', ')}`);

    try {
      const result = await mod.run(ctx);
      totals.created += result.created;
      totals.failed += result.failed;
      totals.skipped += result.skipped;
      totals.cleaned += result.cleaned;

      console.log(`\n   ✅ ${mod.name}: ${result.created} created, ${result.failed} failed, ${result.skipped} skipped${result.cleaned > 0 ? `, ${result.cleaned} cleaned` : ''}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n   ❌ ${mod.name} FAILED: ${msg}`);
      totals.failed++;
    }
  }

  if (opts.cleanOnly) {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(`  🧹  Clean-only complete: ${totals.cleaned} documents removed`);
    console.log('═══════════════════════════════════════════════════════════════');
  } else {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  📊  Seed Summary');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  ✅ Created:  ${totals.created}`);
    console.log(`  ❌ Failed:   ${totals.failed}`);
    console.log(`  ⏭  Skipped:  ${totals.skipped}`);
    console.log(`  🧹 Cleaned:  ${totals.cleaned}`);
    console.log(`  ⏱  Duration: ${elapsed}s`);
    console.log('═══════════════════════════════════════════════════════════════');

    if (totals.failed > 0) {
      console.log('\n⚠️  Some items failed — check logs above for details.');
      process.exit(1);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n💥 Unexpected error:', err);
    process.exit(1);
  });
