/**
 * STR Regulation Lookup Service
 *
 * Looks up the StrRegulatoryProfile for a given property's jurisdiction.
 * Profiles are seeded into the Cosmos `str-regulations` container and cached
 * in a Map for the process lifetime (regulatory data changes rarely).
 *
 * Lookup priority:
 *   1. Exact match: state + county + city
 *   2. County-level fallback: state + county (for unincorporated areas)
 *   3. State-level fallback: state only (generic FL guidance if no local data)
 *   4. null — caller must handle missing profile gracefully
 *
 * Seeding: call StrRegulationService.seedIfEmpty() at startup to load the
 * FL_REGULATORY_PROFILES seed data if the container is empty.
 * DO NOT call createContainer — infrastructure must exist before deployment.
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import type { StrRegulatoryProfile } from '../types/str-feasibility.types.js';
import { FL_REGULATORY_PROFILES } from '../seed-data/str-regulations/fl-jurisdictions.js';

const CONTAINER_NAME = 'str-regulations';

export class StrRegulationService {
  private readonly logger: Logger;
  private readonly db: CosmosDbService;
  /** Process-lifetime cache: Cosmos id → profile */
  private readonly cache = new Map<string, StrRegulatoryProfile>();

  constructor(db: CosmosDbService) {
    this.logger = new Logger('StrRegulationService');
    this.db = db;
  }

  /**
   * Look up the regulatory profile for a property jurisdiction.
   * Returns null if no profile is found — the caller decides how to proceed
   * (include a "regulation data not available" note on the report).
   */
  async lookup(params: {
    city: string;
    state: string;
    county?: string;
  }): Promise<StrRegulatoryProfile | null> {
    const { city, state, county } = params;

    // 1. Exact city match
    const cityId = this.buildId(state, county ?? '', city);
    const exact = await this.fetchById(cityId);
    if (exact) return exact;

    // 2. County-level fallback (unincorporated areas)
    if (county) {
      const countyId = this.buildId(state, county, '');
      const byCounty = await this.fetchById(countyId);
      if (byCounty) return byCounty;
    }

    // 3. Try matching by normalized city+state query (handles minor spelling differences)
    const byQuery = await this.queryByCityState(city, state);
    if (byQuery) return byQuery;

    this.logger.debug('StrRegulationService: no profile found', { city, state, county });
    return null;
  }

  /**
   * Loads seed data into the str-regulations container if it contains no documents.
   * Called once at app startup — safe to call repeatedly (idempotent check first).
   */
  async seedIfEmpty(): Promise<void> {
    try {
      const existing = await this.db.queryDocuments<StrRegulatoryProfile>(
        CONTAINER_NAME,
        'SELECT TOP 1 c.id FROM c',
      );
      if (existing.length > 0) {
        this.logger.debug('StrRegulationService: container already seeded');
        return;
      }

      this.logger.info('StrRegulationService: seeding regulatory profiles', {
        count: FL_REGULATORY_PROFILES.length,
      });

      for (const profile of FL_REGULATORY_PROFILES) {
        await this.db.upsertDocument(CONTAINER_NAME, profile);
        this.cache.set(profile.id, profile);
      }

      this.logger.info('StrRegulationService: seeding complete');
    } catch (err) {
      // Non-fatal — report generation continues without regulatory data
      this.logger.warn('StrRegulationService: seed failed (non-fatal)', { err });
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private buildId(state: string, county: string, city: string): string {
    const normalize = (s: string) =>
      s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return `${normalize(state)}-${normalize(county)}-${normalize(city)}`.replace(/-+/g, '-').replace(/-$/, '');
  }

  private async fetchById(id: string): Promise<StrRegulatoryProfile | null> {
    if (this.cache.has(id)) return this.cache.get(id)!;

    try {
      const doc = await this.db.getDocument<StrRegulatoryProfile>(CONTAINER_NAME, id, undefined);
      if (doc) {
        this.cache.set(id, doc);
        return doc;
      }
    } catch {
      // Document not found — not an error
    }
    return null;
  }

  private async queryByCityState(city: string, state: string): Promise<StrRegulatoryProfile | null> {
    try {
      const results = await this.db.queryDocuments<StrRegulatoryProfile>(
        CONTAINER_NAME,
        `SELECT TOP 1 * FROM c WHERE LOWER(c.city) = LOWER(@city) AND LOWER(c.state) = LOWER(@state)`,
        [
          { name: '@city',  value: city },
          { name: '@state', value: state },
        ],
      );
      const profile = results[0] ?? null;
      if (profile) this.cache.set(profile.id, profile);
      return profile;
    } catch {
      return null;
    }
  }
}
