/**
 * Seed Review Programs — one-time migration script.
 *
 * Upserts the platform-wide default ReviewProgram documents into the
 * `review-programs` Cosmos container.
 *
 * PREREQUISITES:
 *   1. The `review-programs` container must already exist — provisioned via
 *      cosmos-review-containers.bicep.  This script never creates containers.
 *   2. Set COSMOS_ENDPOINT (and COSMOS_KEY or use Managed Identity) in your
 *      environment / .env file before running.
 *
 * Run with:
 *   npx tsx src/scripts/seed-review-programs.ts
 *
 * Safe to re-run: uses upsert so existing documents with the same id are
 * overwritten with the current seed values.  Intentional — the seed data is
 * the canonical "factory default" for the platform.
 */

import 'dotenv/config';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import { REVIEW_PROGRAM_SEEDS } from '../data/review-programs.js';

const logger = new Logger('SeedReviewPrograms');

/**
 * Global programs have clientId === null in the seed data.
 * The container's partition key is /clientId, so null is illegal as a stored
 * value.  We use this synthetic sentinel instead.
 */
const GLOBAL_CLIENT_ID = '__global__';

async function main(): Promise<void> {
  const cosmosDb = new CosmosDbService();
  await cosmosDb.initialize();

  const container = cosmosDb.getReviewProgramsContainer();

  logger.info(`Seeding ${REVIEW_PROGRAM_SEEDS.length} review program(s)…`);

  for (const program of REVIEW_PROGRAM_SEEDS) {
    const doc = {
      ...program,
      clientId: program.clientId ?? GLOBAL_CLIENT_ID,
    };

    await container.items.upsert(doc);

    logger.info('Upserted review program', {
      id: program.id,
      name: program.name,
      version: program.version,
      programType: program.programType,
    });
  }

  logger.info('Review program seeding complete.', {
    count: REVIEW_PROGRAM_SEEDS.length,
  });
}

main().catch((err) => {
  logger.error('Seed failed', { error: err });
  process.exit(1);
});
