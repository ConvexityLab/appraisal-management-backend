import express, { Response } from 'express';
import multer from 'multer';
import { body, param, query, validationResult } from 'express-validator';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { BulkIngestionService } from '../services/bulk-ingestion.service.js';
import { BlobStorageService } from '../services/blob-storage.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type {
  BulkIngestionItemStatus,
  BulkIngestionMode,
  BulkIngestionSharedStorageRef,
  BulkIngestionSubmitRequest,
} from '../types/bulk-ingestion.types.js';
import type {
  BulkIngestionFailureExportFormat,
  BulkIngestionFailureSort,
} from '../services/bulk-ingestion.service.js';

const router = express.Router();
const logger = new Logger('BulkIngestionController');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024,
    files: 501,
  },
});
const blobStorageService = new BlobStorageService();

let service: BulkIngestionService | null = null;

function getService(dbService: CosmosDbService): BulkIngestionService {
  if (!service) {
    service = new BulkIngestionService(dbService);
  }
  return service;
}

function resolveTenantId(req: UnifiedAuthRequest): string {
  // Prefer the explicit x-tenant-id header when present — the caller knows which
  // business tenant they're operating on. Fall back to whatever the auth layer
  // placed on req.user.tenantId (useful for future token-carried claims).
  const tid = (req.headers['x-tenant-id'] as string | undefined) ?? req.user?.tenantId;
  if (!tid) {
    throw new Error('Tenant ID is required but missing from auth token and x-tenant-id header');
  }
  return tid;
}

const validateSubmit = [
  body('clientId').isString().notEmpty().withMessage('clientId is required'),
  body('adapterKey').isString().notEmpty().withMessage('adapterKey is required'),
  body('ingestionMode').optional().isIn(['MULTIPART', 'SHARED_STORAGE']),
  body('items.*.loanNumber').optional().isString(),
  body('items.*.externalId').optional().isString(),
  body('items.*.documentFileName').optional().isString(),
];

type NamedMulterFiles = {
  dataFile?: Express.Multer.File[];
  documents?: Express.Multer.File[];
};

const ALLOWED_DATA_FILE_EXTENSIONS = ['.csv', '.xlsx'];
const ALLOWED_DATA_FILE_MIME_TYPES = [
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const ALLOWED_DOCUMENT_EXTENSIONS = ['.pdf'];
const ALLOWED_DOCUMENT_MIME_TYPES = ['application/pdf'];
const ALLOWED_FAILURE_SORTS: BulkIngestionFailureSort[] = [
  'occurredAt_desc',
  'occurredAt_asc',
  'rowIndex_asc',
  'rowIndex_desc',
  'stage_asc',
  'stage_desc',
  'code_asc',
  'code_desc',
];
const ALLOWED_FAILURE_EXPORT_FORMATS: BulkIngestionFailureExportFormat[] = ['csv', 'xlsx'];
const ALLOWED_ITEM_STATUSES: BulkIngestionItemStatus[] = [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
];

function getLowerFileExtension(fileName: string): string {
  const index = fileName.lastIndexOf('.');
  if (index < 0) {
    return '';
  }
  return fileName.slice(index).toLowerCase();
}

function validateMultipartFileTypes(dataFile: Express.Multer.File | undefined, documents: Express.Multer.File[]): string | null {
  if (dataFile) {
    const dataExt = getLowerFileExtension(dataFile.originalname);
    const dataMime = (dataFile.mimetype || '').toLowerCase();
    if (!ALLOWED_DATA_FILE_EXTENSIONS.includes(dataExt) || !ALLOWED_DATA_FILE_MIME_TYPES.includes(dataMime)) {
      return `dataFile '${dataFile.originalname}' must be CSV/XLSX with supported MIME type`;
    }
  }

  for (const document of documents) {
    const docExt = getLowerFileExtension(document.originalname);
    const docMime = (document.mimetype || '').toLowerCase();
    if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(docExt) || !ALLOWED_DOCUMENT_MIME_TYPES.includes(docMime)) {
      return `document '${document.originalname}' must be PDF with MIME type application/pdf`;
    }
  }

  return null;
}

function parseArrayField<T>(value: unknown, fieldName: string): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error(`${fieldName} must be an array`);
      }
      return parsed as T[];
    } catch (error) {
      throw new Error(`Invalid JSON in '${fieldName}': ${error instanceof Error ? error.message : 'parse error'}`);
    }
  }

  throw new Error(`${fieldName} is required and must be an array or JSON array string`);
}

function parseObjectField<T>(value: unknown, fieldName: string): T {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as T;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`${fieldName} must be an object`);
      }
      return parsed as T;
    } catch (error) {
      throw new Error(`Invalid JSON in '${fieldName}': ${error instanceof Error ? error.message : 'parse error'}`);
    }
  }

  throw new Error(`${fieldName} is required and must be an object or JSON object string`);
}

async function uploadStagedFile(
  tenantId: string,
  jobPrefix: string,
  file: Express.Multer.File,
  category: 'data' | 'document',
): Promise<{ blobName: string; url: string }> {
  const containerName = process.env.STORAGE_CONTAINER_DOCUMENTS;
  if (!containerName) {
    throw new Error('STORAGE_CONTAINER_DOCUMENTS environment variable is required for bulk ingestion staging');
  }

  const fileName = file.originalname.replace(/\s+/g, '_');
  const blobName = `${jobPrefix}/${category}/${Date.now()}-${fileName}`;

  const result = await blobStorageService.uploadBlob({
    containerName,
    blobName,
    data: file.buffer,
    contentType: file.mimetype || 'application/octet-stream',
    metadata: {
      tenantId,
      category,
      originalFileName: file.originalname,
    },
  });

  return { blobName: result.blobName, url: result.url };
}

async function uploadDocumentsWithConcurrency(
  tenantId: string,
  jobPrefix: string,
  documents: Express.Multer.File[],
  concurrencyLimit: number,
): Promise<Record<string, string>> {
  const blobMap: Record<string, string> = {};
  for (let index = 0; index < documents.length; index += concurrencyLimit) {
    const batch = documents.slice(index, index + concurrencyLimit);
    const uploadedBatch = await Promise.all(
      batch.map(async (documentFile) => {
        const uploadedDoc = await uploadStagedFile(tenantId, jobPrefix, documentFile, 'document');
        return { originalName: documentFile.originalname, blobName: uploadedDoc.blobName };
      }),
    );

    for (const uploaded of uploadedBatch) {
      blobMap[uploaded.originalName] = uploaded.blobName;
    }
  }

  return blobMap;
}

export function createBulkIngestionRouter(dbService: CosmosDbService) {
  router.post(
    '/submit',
    upload.fields([
      { name: 'dataFile', maxCount: 1 },
      { name: 'documents', maxCount: 500 },
    ]),
    ...validateSubmit,
    async (req: UnifiedAuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const tenantId = resolveTenantId(req);
      const submittedBy = req.user?.id ?? 'unknown';
      const ingestionService = getService(dbService);

      const files = (req.files || {}) as NamedMulterFiles;
      const dataFile = files.dataFile?.[0];
      const documents = files.documents || [];

      const multipartFileValidationError = validateMultipartFileTypes(dataFile, documents);
      if (multipartFileValidationError) {
        return res.status(400).json({ error: multipartFileValidationError });
      }

      const requestBody = req.body as Record<string, unknown>;
      if (!requestBody.items) {
        return res.status(400).json({ error: "'items' is required and must be an array or JSON array string" });
      }

      const explicitMode =
        typeof requestBody.ingestionMode === 'string'
          ? requestBody.ingestionMode.toUpperCase()
          : undefined;
      const hasUploadFiles = Boolean(dataFile) || documents.length > 0;
      const hasSharedStorage = requestBody.sharedStorage !== undefined;

      let ingestionMode: BulkIngestionMode;
      if (explicitMode === 'MULTIPART' || explicitMode === 'SHARED_STORAGE') {
        ingestionMode = explicitMode;
      } else if (hasUploadFiles) {
        ingestionMode = 'MULTIPART';
      } else if (hasSharedStorage) {
        ingestionMode = 'SHARED_STORAGE';
      } else {
        return res.status(400).json({
          error:
            "ingestionMode is required when no files are uploaded. Supported modes: 'MULTIPART' | 'SHARED_STORAGE'.",
        });
      }

      const baseRequest: BulkIngestionSubmitRequest = {
        clientId: String(requestBody.clientId || ''),
        ...(requestBody.jobName ? { jobName: String(requestBody.jobName) } : {}),
        ingestionMode,
        dataFileName: String(requestBody.dataFileName || dataFile?.originalname || ''),
        adapterKey: String(requestBody.adapterKey || ''),
        documentFileNames: requestBody.documentFileNames
          ? parseArrayField<string>(requestBody.documentFileNames, 'documentFileNames')
          : documents.map((d) => d.originalname),
        items: parseArrayField(requestBody.items, 'items'),
      };

      if (ingestionMode === 'MULTIPART' && !dataFile) {
        return res.status(400).json({
          error: "MULTIPART mode requires a 'dataFile' upload (CSV or XLSX)",
        });
      }

      if (ingestionMode === 'SHARED_STORAGE') {
        if (!requestBody.sharedStorage) {
          return res.status(400).json({
            error: "SHARED_STORAGE mode requires 'sharedStorage' payload",
          });
        }

        const sharedStorage = parseObjectField<BulkIngestionSharedStorageRef>(
          requestBody.sharedStorage,
          'sharedStorage',
        );

        if (!sharedStorage.storageAccountName?.trim()) {
          return res.status(400).json({ error: 'sharedStorage.storageAccountName is required' });
        }
        if (!sharedStorage.containerName?.trim()) {
          return res.status(400).json({ error: 'sharedStorage.containerName is required' });
        }
        if (!sharedStorage.dataFileBlobName?.trim()) {
          return res.status(400).json({ error: 'sharedStorage.dataFileBlobName is required' });
        }
        if (!Array.isArray(sharedStorage.documentBlobNames)) {
          return res.status(400).json({ error: 'sharedStorage.documentBlobNames must be an array' });
        }

        baseRequest.sharedStorage = sharedStorage;
        baseRequest.dataFileName = baseRequest.dataFileName || sharedStorage.dataFileBlobName;

        if (baseRequest.documentFileNames.length === 0) {
          baseRequest.documentFileNames = sharedStorage.documentBlobNames;
        }
      }

      if (ingestionMode === 'MULTIPART') {
        const jobPrefix = `bulk-ingestion/${tenantId}/${Date.now()}`;
        const documentUploadConcurrency = Number.parseInt(
          process.env.BULK_INGESTION_DOCUMENT_UPLOAD_CONCURRENCY ?? '16',
          10,
        );
        const effectiveConcurrency = Number.isFinite(documentUploadConcurrency) && documentUploadConcurrency > 0
          ? documentUploadConcurrency
          : 16;

        if (dataFile) {
          const uploadedData = await uploadStagedFile(tenantId, jobPrefix, dataFile, 'data');
          baseRequest.dataFileBlobName = uploadedData.blobName;
          baseRequest.dataFileBlobUrl = uploadedData.url;
        }

        if (documents.length > 0) {
          baseRequest.documentBlobMap = await uploadDocumentsWithConcurrency(
            tenantId,
            jobPrefix,
            documents,
            effectiveConcurrency,
          );
        }
      }

      const job = await ingestionService.submit(baseRequest, tenantId, submittedBy);

      return res.status(202).json({
        job,
        message: `Bulk ingestion queued with ${job.totalItems} item(s)`,
      });
    } catch (err) {
      logger.error('bulk-ingestion submit failed', { error: err });
      return res.status(500).json({
        error: 'Bulk ingestion submit failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });

  router.get('/', query('clientId').optional().isString(), async (req: UnifiedAuthRequest, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const clientId = typeof req.query.clientId === 'string' ? req.query.clientId : undefined;
      const ingestionService = getService(dbService);
      const jobs = await ingestionService.listJobs(tenantId, clientId);
      return res.json(jobs);
    } catch (err) {
      logger.error('bulk-ingestion list failed', { error: err });
      return res.status(500).json({ error: 'Failed to list bulk ingestion jobs' });
    }
  });

  router.get('/:jobId/canonicalization', param('jobId').isString().notEmpty(), async (req: UnifiedAuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const tenantId = resolveTenantId(req);
      const ingestionService = getService(dbService);
      const jobId = req.params['jobId']!;

      const job = await ingestionService.getJob(jobId, tenantId);
      if (!job) {
        return res.status(404).json({ error: 'Bulk ingestion job not found' });
      }

      const canonicalization = await ingestionService.getCanonicalizationByJobId(jobId, tenantId);

      return res.json({
        jobId,
        adapterKey: job.adapterKey,
        status: job.status,
        summary: canonicalization.summary,
        records: canonicalization.records,
      });
    } catch (err) {
      logger.error('bulk-ingestion canonicalization get failed', { error: err });
      return res.status(500).json({
        error: 'Failed to retrieve bulk ingestion canonicalization results',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });

  router.get(
    '/:jobId/failures',
    param('jobId').isString().notEmpty(),
    query('stage').optional().isString(),
    query('code').optional().isString(),
    query('retryable').optional().isIn(['true', 'false']),
    query('itemStatus').optional().isIn(ALLOWED_ITEM_STATUSES),
    query('search').optional().isString(),
    query('sort').optional().isIn(ALLOWED_FAILURE_SORTS),
    query('cursor').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 500 }),
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      try {
        const tenantId = resolveTenantId(req);
        const ingestionService = getService(dbService);
        const jobId = req.params['jobId']!;

        const response = await ingestionService.listFailures(jobId, tenantId, {
          ...(typeof req.query['stage'] === 'string' ? { stage: req.query['stage'] } : {}),
          ...(typeof req.query['code'] === 'string' ? { code: req.query['code'] } : {}),
          ...(typeof req.query['retryable'] === 'string' ? { retryable: req.query['retryable'] === 'true' } : {}),
          ...(typeof req.query['itemStatus'] === 'string'
            ? { itemStatus: req.query['itemStatus'] as BulkIngestionItemStatus }
            : {}),
          ...(typeof req.query['search'] === 'string' ? { search: req.query['search'] } : {}),
          ...(typeof req.query['sort'] === 'string' ? { sort: req.query['sort'] as BulkIngestionFailureSort } : {}),
          ...(typeof req.query['cursor'] === 'string' ? { cursor: req.query['cursor'] } : {}),
          ...(typeof req.query['limit'] === 'string' ? { limit: Number.parseInt(req.query['limit'], 10) } : {}),
        });

        return res.status(200).json(response);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (message.includes('Invalid cursor')) {
          return res.status(400).json({ error: message });
        }
        if (message.includes('not found')) {
          return res.status(404).json({ error: message });
        }
        logger.error('bulk-ingestion failures list failed', { error: err });
        return res.status(500).json({
          error: 'Failed to list bulk ingestion failures',
          message,
        });
      }
    },
  );

  router.get(
    '/:jobId/failures/export',
    param('jobId').isString().notEmpty(),
    query('format').optional().isIn(ALLOWED_FAILURE_EXPORT_FORMATS),
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      try {
        const tenantId = resolveTenantId(req);
        const ingestionService = getService(dbService);
        const jobId = req.params['jobId']!;
        const format =
          typeof req.query['format'] === 'string'
            ? (req.query['format'].toLowerCase() as BulkIngestionFailureExportFormat)
            : 'csv';

        const exported = await ingestionService.exportFailures(jobId, tenantId, format);
        res.setHeader('Content-Type', exported.contentType);
        res.setHeader('Content-Disposition', `attachment; filename=\"${exported.fileName}\"`);
        return res.status(200).send(exported.content);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (message.includes('not found')) {
          return res.status(404).json({ error: message });
        }
        logger.error('bulk-ingestion failures export failed', { error: err });
        return res.status(500).json({
          error: 'Failed to export bulk ingestion failures',
          message,
        });
      }
    },
  );

  router.get('/:jobId', param('jobId').isString().notEmpty(), async (req: UnifiedAuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const tenantId = resolveTenantId(req);
      const ingestionService = getService(dbService);
      const job = await ingestionService.getJob(req.params['jobId']!, tenantId);
      if (!job) {
        return res.status(404).json({ error: 'Bulk ingestion job not found' });
      }
      return res.json(job);
    } catch (err) {
      logger.error('bulk-ingestion get failed', { error: err });
      return res.status(500).json({
        error: 'Failed to retrieve bulk ingestion job',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });

  router.post(
    '/:jobId/items/:itemId/retry',
    param('jobId').isString().notEmpty(),
    param('itemId').isString().notEmpty(),
    async (req: UnifiedAuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      try {
        const tenantId = resolveTenantId(req);
        const requestedBy = req.user?.id ?? 'unknown';
        const ingestionService = getService(dbService);
        const job = await ingestionService.retryItem(
          req.params['jobId']!,
          req.params['itemId']!,
          tenantId,
          requestedBy,
        );

        return res.status(202).json({
          job,
          message: `Retry request accepted for item '${req.params['itemId']!}'`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (message.includes('not found')) {
          return res.status(404).json({ error: message });
        }
        if (message.includes('Only FAILED items can be retried') || message.includes('Retry')) {
          return res.status(409).json({ error: message });
        }
        logger.error('bulk-ingestion retry-item failed', { error: err });
        return res.status(500).json({ error: 'Failed to retry item', message });
      }
    },
  );

  router.post('/:jobId/retry-failed', param('jobId').isString().notEmpty(), async (req: UnifiedAuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const tenantId = resolveTenantId(req);
      const requestedBy = req.user?.id ?? 'unknown';
      const ingestionService = getService(dbService);
      const job = await ingestionService.retryFailedItems(req.params['jobId']!, tenantId, requestedBy);
      return res.status(202).json({
        job,
        message: 'Retry request accepted for failed items',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('not found')) {
        return res.status(404).json({ error: message });
      }
      logger.error('bulk-ingestion retry-failed failed', { error: err });
      return res.status(500).json({ error: 'Failed to retry failed items', message });
    }
  });

  router.post('/:jobId/pause', param('jobId').isString().notEmpty(), async (req: UnifiedAuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const tenantId = resolveTenantId(req);
      const requestedBy = req.user?.id ?? 'unknown';
      const ingestionService = getService(dbService);
      const job = await ingestionService.pauseJob(req.params['jobId']!, tenantId, requestedBy);
      return res.status(202).json({
        job,
        message: 'Pause request accepted for bulk ingestion job',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('not found')) {
        return res.status(404).json({ error: message });
      }
      if (message.includes('Cannot pause')) {
        return res.status(409).json({ error: message });
      }
      logger.error('bulk-ingestion pause failed', { error: err });
      return res.status(500).json({ error: 'Failed to pause bulk ingestion job', message });
    }
  });

  router.post('/:jobId/resume', param('jobId').isString().notEmpty(), async (req: UnifiedAuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const tenantId = resolveTenantId(req);
      const requestedBy = req.user?.id ?? 'unknown';
      const ingestionService = getService(dbService);
      const job = await ingestionService.resumeJob(req.params['jobId']!, tenantId, requestedBy);
      return res.status(202).json({
        job,
        message: 'Resume request accepted for bulk ingestion job',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('not found')) {
        return res.status(404).json({ error: message });
      }
      if (message.includes('Cannot resume')) {
        return res.status(409).json({ error: message });
      }
      logger.error('bulk-ingestion resume failed', { error: err });
      return res.status(500).json({ error: 'Failed to resume bulk ingestion job', message });
    }
  });

  router.post('/:jobId/cancel', param('jobId').isString().notEmpty(), async (req: UnifiedAuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const tenantId = resolveTenantId(req);
      const requestedBy = req.user?.id ?? 'unknown';
      const ingestionService = getService(dbService);
      const job = await ingestionService.cancelJob(req.params['jobId']!, tenantId, requestedBy);
      return res.status(202).json({
        job,
        message: 'Cancel request accepted for bulk ingestion job',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('not found')) {
        return res.status(404).json({ error: message });
      }
      if (message.includes('Cannot cancel')) {
        return res.status(409).json({ error: message });
      }
      logger.error('bulk-ingestion cancel failed', { error: err });
      return res.status(500).json({ error: 'Failed to cancel bulk ingestion job', message });
    }
  });

  return router;
}
