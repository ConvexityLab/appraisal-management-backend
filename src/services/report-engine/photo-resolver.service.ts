/**
 * PhotoResolverService
 *
 * Resolves which photos are available for an order and returns a list of
 * ReportPhotoAsset objects. Does NOT download photo bytes here — the
 * HtmlRenderStrategy fetches the actual bytes at render time.
 *
 * Photo blobs are expected to live under the path:
 *   orders/{orderId}/photos/{photoType}/{filename}
 * e.g.
 *   orders/abc-123/photos/SUBJECT_FRONT/front.jpg
 *   orders/abc-123/photos/COMP_FRONT/1/comp1.jpg
 *
 * Phase 8: Only blob enumeration is implemented. OCR/GPS metadata extraction
 * is deferred to Phase 8e.
 */

import { BlobStorageService } from '../blob-storage.service';
import { ReportPhotoAsset } from '../../types/canonical-schema';
import { ReportSectionConfig } from '../../types/final-report.types';

const ORDERS_CONTAINER = 'orders';

type PhotoType = ReportPhotoAsset['photoType'];

/** Map from section config flag → list of photo types it enables. */
const SECTION_TO_PHOTO_TYPES: Array<{
  flag: keyof ReportSectionConfig;
  types: PhotoType[];
}> = [
  { flag: 'requiresSubjectPhotos', types: ['SUBJECT_FRONT', 'SUBJECT_REAR', 'SUBJECT_STREET', 'SUBJECT_INTERIOR'] },
  { flag: 'requiresCompPhotos',    types: ['COMP_FRONT'] },
  { flag: 'requiresAerialMap',     types: ['AERIAL'] },
  { flag: 'requiresFloorPlan',     types: ['FLOOR_PLAN'] },
];

export class PhotoResolverService {
  constructor(private readonly blobStorage: BlobStorageService) {}

  /**
   * Lists available photo assets for this order that match the section config.
   *
   * @param orderId         - The order to resolve photos for
   * @param sectionConfig   - Effective section config (template default + per-gen overrides)
   * @returns               - ReportPhotoAsset[] with blobPath populated (no byte data)
   */
  async resolveForOrder(
    orderId: string,
    sectionConfig: ReportSectionConfig,
  ): Promise<ReportPhotoAsset[]> {
    const wantedTypes = new Set<PhotoType>(
      SECTION_TO_PHOTO_TYPES
        .filter(entry => sectionConfig[entry.flag])
        .flatMap(entry => entry.types),
    );

    if (wantedTypes.size === 0) return [];

    const allBlobs = await this._listOrderPhotoBlobs(orderId);
    const assets: ReportPhotoAsset[] = [];

    for (const blobPath of allBlobs) {
      const parsed = this._parseBlobPath(orderId, blobPath);
      if (parsed && wantedTypes.has(parsed.photoType)) {
        assets.push({
          orderId,
          blobPath,
          photoType: parsed.photoType,
          ...(parsed.compIndex != null ? { compIndex: parsed.compIndex } : {}),
        });
      }
    }

    // Sort: subject photos first (front, rear, street, interior), then comps by index, then others
    assets.sort((a, b) => {
      const order: PhotoType[] = [
        'SUBJECT_FRONT', 'SUBJECT_REAR', 'SUBJECT_STREET', 'SUBJECT_INTERIOR',
        'COMP_FRONT', 'AERIAL', 'FLOOR_PLAN', 'ADDITIONAL',
      ];
      const ai = order.indexOf(a.photoType);
      const bi = order.indexOf(b.photoType);
      if (ai !== bi) return ai - bi;
      return (a.compIndex ?? 0) - (b.compIndex ?? 0);
    });

    return assets;
  }

  private async _listOrderPhotoBlobs(orderId: string): Promise<string[]> {
    const prefix = `orders/${orderId}/photos/`;
    try {
      return await this.blobStorage.listBlobs(ORDERS_CONTAINER, prefix);
    } catch {
      // No photos uploaded yet — return empty list rather than crashing generation.
      return [];
    }
  }

  /**
   * Extracts the photoType (and optional compIndex) from a blob path.
   *
   * Supported path patterns:
   *   orders/{orderId}/photos/SUBJECT_FRONT/filename.jpg
   *   orders/{orderId}/photos/COMP_FRONT/{compIndex}/filename.jpg
   */
  private _parseBlobPath(
    orderId: string,
    blobPath: string,
  ): { photoType: PhotoType; compIndex?: number } | null {
    const prefix = `orders/${orderId}/photos/`;
    if (!blobPath.startsWith(prefix)) return null;

    const rest = blobPath.slice(prefix.length); // e.g. "SUBJECT_FRONT/front.jpg" or "COMP_FRONT/2/comp.jpg"
    const parts = rest.split('/');

    const rawType = parts[0]?.toUpperCase() as PhotoType;
    const knownTypes: PhotoType[] = [
      'SUBJECT_FRONT', 'SUBJECT_REAR', 'SUBJECT_STREET', 'SUBJECT_INTERIOR',
      'COMP_FRONT', 'AERIAL', 'FLOOR_PLAN', 'ADDITIONAL',
    ];
    if (!knownTypes.includes(rawType)) return null;

    // Comp photos have an extra numeric segment: COMP_FRONT/{compIndex}/filename
    if (rawType === 'COMP_FRONT' && parts.length >= 3) {
      const idx = parseInt(parts[1] ?? '', 10);
      if (!Number.isNaN(idx)) return { photoType: rawType, compIndex: idx };
    }

    return { photoType: rawType };
  }
}
