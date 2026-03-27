/**
 * TemplateRegistryService
 *
 * Loads ReportTemplate records from the Cosmos DB `document-templates` container
 * (partitioned by type = 'pdf-report-template').
 *
 * Templates are cached in-process after first load; the cache is invalidated after
 * CACHE_TTL_MS milliseconds. This is intentionally simple: for multi-replica
 * deployments a Redis-backed cache should be added in Phase 8f.
 */

import { CosmosDbService } from '../../cosmos-db.service';
import { ReportTemplate } from '../../../types/final-report.types';

/** Document type discriminator stored in the `document-templates` container. */
const TEMPLATE_DOCUMENT_TYPE = 'pdf-report-template';

/** Templates container name in Cosmos DB. */
const TEMPLATES_CONTAINER = 'document-templates';

/** How long to keep templates in the local process cache before re-fetching. */
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  templates: ReportTemplate[];
  loadedAt: number;
}

export class TemplateRegistryService {
  private _cache: CacheEntry | null = null;

  constructor(private readonly cosmosDb: CosmosDbService) {}

  /**
   * Returns the single active template with the given ID.
   * Throws if the template is not found or is inactive.
   */
  async getTemplate(templateId: string): Promise<ReportTemplate> {
    const all = await this._loadAll();
    const template = all.find(t => t.id === templateId);

    if (!template) {
      throw new Error(
        `Report template "${templateId}" not found in the "${TEMPLATES_CONTAINER}" container ` +
        `(type="${TEMPLATE_DOCUMENT_TYPE}"). Ensure the template document has been seeded.`,
      );
    }

    if (!template.isActive) {
      throw new Error(
        `Report template "${templateId}" is inactive (isActive=false). ` +
        `Activate the template document in Cosmos or choose a different templateId.`,
      );
    }

    return template;
  }

  /**
   * Returns all active templates. Used by the GET /final-reports/templates endpoint.
   */
  async listActiveTemplates(): Promise<ReportTemplate[]> {
    const all = await this._loadAll();
    return all.filter(t => t.isActive);
  }

  /** Evict the in-process cache, forcing the next call to re-query Cosmos. */
  invalidateCache(): void {
    this._cache = null;
  }

  private async _loadAll(): Promise<ReportTemplate[]> {
    const now = Date.now();
    if (this._cache && now - this._cache.loadedAt < CACHE_TTL_MS) {
      return this._cache.templates;
    }

    const query = `SELECT * FROM c WHERE c.type = "${TEMPLATE_DOCUMENT_TYPE}"`;
    const response = await this.cosmosDb.queryItems<ReportTemplate>(
      TEMPLATES_CONTAINER,
      query,
    );

    if (!response.success || response.data === undefined) {
      throw new Error(
        `Failed to load report templates from "${TEMPLATES_CONTAINER}": ` +
        `${response.error?.message ?? 'unknown Cosmos DB error'}`,
      );
    }

    this._cache = { templates: response.data, loadedAt: now };
    return response.data;
  }
}
