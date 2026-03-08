/**
 * Construction Cost Catalog Service
 *
 * Handles full-text search across the RSMeans-style unit cost catalog stored in
 * the `construction-cost-catalog` Cosmos container (partition key: /division).
 *
 * All queries are read-only. Catalog items are seeded via
 * src/scripts/seed-construction-catalog.ts and maintained offline.
 */

import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type {
  CostCatalogItem,
  CatalogSearchParams,
  CatalogSearchResult,
  CsiDivision,
} from '../types/construction-cost-catalog.types.js';

const CATALOG_CONTAINER = 'construction-cost-catalog';
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export class ConstructionCostCatalogService {
  private readonly logger = new Logger('ConstructionCostCatalogService');

  constructor(private readonly db: CosmosDbService) {}

  /**
   * Full-text + filtered search of catalog items.
   *
   * Supports filtering by division and/or sectionCode in addition to free-text.
   * The free-text match is performed client-side after fetching the filtered
   * super-set from Cosmos (Cosmos free-text search requires dedicated indexing
   * policies; this keeps the implementation simple without infrastructure changes).
   *
   * Performance note: The catalog is small (~300 items). Fetching the filtered
   * set and doing in-process scoring is acceptable for this use case.
   */
  async search(params: CatalogSearchParams): Promise<CatalogSearchResult> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));

    // Build parameterised Cosmos query
    const conditions: string[] = ["c.type = 'construction-cost-catalog-item'"];
    const cosmosParams: Array<{ name: string; value: unknown }> = [];

    if (params.division) {
      conditions.push('c.division = @division');
      cosmosParams.push({ name: '@division', value: params.division });
    }

    if (params.sectionCode) {
      conditions.push('c.sectionCode = @sectionCode');
      cosmosParams.push({ name: '@sectionCode', value: params.sectionCode });
    }

    const whereClause = conditions.join(' AND ');
    const cosmosQuery = `SELECT * FROM c WHERE ${whereClause} ORDER BY c.sectionCode`;

    const allItems = await this.db.queryDocuments<CostCatalogItem>(
      CATALOG_CONTAINER,
      cosmosQuery,
      cosmosParams
    );

    // Apply free-text filter in process
    let filtered = allItems;
    if (params.q && params.q.trim().length > 0) {
      const needle = params.q.trim().toLowerCase();
      const tokens = needle.split(/\s+/);
      filtered = allItems.filter((item) => {
        const haystack = [
          item.description,
          item.sectionName,
          item.divisionName,
          item.sectionCode,
          ...(item.keywords ?? []),
        ]
          .join(' ')
          .toLowerCase();
        // All tokens must appear somewhere in the haystack
        return tokens.every((t) => haystack.includes(t));
      });
    }

    const total = filtered.length;
    const offset = (page - 1) * pageSize;
    const items = filtered.slice(offset, offset + pageSize);

    return { items, total, page, pageSize };
  }

  /** Retrieve a single catalog item by its ID. */
  async getById(id: string, division: CsiDivision): Promise<CostCatalogItem> {
    const results = await this.db.queryDocuments<CostCatalogItem>(
      CATALOG_CONTAINER,
      'SELECT * FROM c WHERE c.id = @id AND c.division = @division',
      [
        { name: '@id', value: id },
        { name: '@division', value: division },
      ]
    );

    if (!results.length) {
      throw new Error(`Catalog item not found: id=${id}`);
    }
    return results[0]!;
  }

  /**
   * Retrieve all items for a CSI division — used for bulk budget review.
   */
  async listByDivision(division: CsiDivision): Promise<CostCatalogItem[]> {
    return this.db.queryDocuments<CostCatalogItem>(
      CATALOG_CONTAINER,
      "SELECT * FROM c WHERE c.division = @division AND c.type = 'construction-cost-catalog-item' ORDER BY c.sectionCode",
      [{ name: '@division', value: division }]
    );
  }
}
