import { Logger } from '../../utils/logger.js';
import type { InspectionProvider } from './inspection-provider.interface.js';
import type {
  CreateInspectionOrderInput,
  ExternalOrderRef,
  ExternalOrderStatus,
  InspectionPdfFileIds,
  UploadFileInput,
} from '../../types/inspection-vendor.types.js';

// ──────────────────────────────────────────────────────────────────────────────
// Private iVueit API shapes
// ──────────────────────────────────────────────────────────────────────────────

interface IVueitAuthResponse {
  /** The JWT token string. */
  body: string;
}

interface IVueitVue {
  id: string;
  canonicalId: string;
  title?: string;
  description?: string;
  notes?: string;
  address?: string;
  pdfFileId?: string | null;
  pdfFileIdSurvey?: string | null;
  pdfFileIdPhotos?: string | null;
  pdfFileIdOrdered?: string | null;
  submissionId?: string | null;
  meta?: Record<string, string>;
  escalated?: boolean;
  escalationNotes?: string | null;
  expiresAt?: string | null;
}

interface IVueitCreateBatchResponse {
  batchId: string;
  createdAt: string;
  vueId: string;
}

interface IVueitFileUrlResponse {
  url: string;
}

interface IVueitFileUploadResponse {
  assignedId: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// IVueitInspectionProvider
// ──────────────────────────────────────────────────────────────────────────────

export class IVueitInspectionProvider implements InspectionProvider {
  readonly name = 'ivueit';
  readonly supportsMessaging = false;

  private readonly logger = new Logger('IVueitInspectionProvider');
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly secret: string;

  private cachedToken: string | null = null;
  private tokenExpiresAtMs: number = 0;

  constructor() {
    const apiKey = process.env['IVUEIT_API_KEY'];
    const secret = process.env['IVUEIT_SECRET'];
    const baseUrl = process.env['IVUEIT_BASE_URL'];

    if (!apiKey) {
      throw new Error(
        'Missing required env var IVUEIT_API_KEY. ' +
          'Set it to the iVueit client API key from Key Vault.'
      );
    }
    if (!secret) {
      throw new Error(
        'Missing required env var IVUEIT_SECRET. ' +
          'Set it to the iVueit client secret from Key Vault.'
      );
    }
    if (!baseUrl) {
      throw new Error(
        'Missing required env var IVUEIT_BASE_URL. ' +
          'Set it to the iVueit API base URL (e.g. https://api.staging.ivueit.services).'  
      );
    }

    this.apiKey = apiKey;
    this.secret = secret;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  isAvailable(): boolean {
    return !!(
      process.env['IVUEIT_API_KEY'] &&
      process.env['IVUEIT_SECRET'] &&
      process.env['IVUEIT_BASE_URL']
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Auth
  // ──────────────────────────────────────────────────────────────────────────

  async getToken(): Promise<string> {
    const nowMs = Date.now();
    const bufferMs = 60_000; // refresh 60 s before expiry

    if (this.cachedToken && nowMs < this.tokenExpiresAtMs - bufferMs) {
      return this.cachedToken;
    }

    this.logger.info('Refreshing iVueit auth token');

    const response = await fetch(`${this.baseUrl}/login/v1/service`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: this.apiKey, secret: this.secret }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `iVueit authentication failed: HTTP ${response.status} — ${body}`
      );
    }

    const data = (await response.json()) as IVueitAuthResponse;

    if (!data.body) {
      throw new Error(
        'iVueit authentication returned an empty token. ' +
          'Verify IVUEIT_API_KEY and IVUEIT_SECRET are correct.'
      );
    }

    this.cachedToken = data.body;
    this.tokenExpiresAtMs = this.decodeJwtExpiry(data.body);

    if (!this.tokenExpiresAtMs) {
      // Fallback when exp claim is missing or malformed
      this.tokenExpiresAtMs = nowMs + 60 * 60 * 1000; // assume 1 h
    }

    return this.cachedToken;
  }

  /**
   * Decode the `exp` claim from a JWT (no signature verification — for caching
   * purposes only). Returns the expiry as milliseconds-since-epoch, or 0 on
   * failure.
   */
  private decodeJwtExpiry(jwt: string): number {
    const parts = jwt.split('.');
    if (parts.length !== 3 || !parts[1]) return 0;

    try {
      const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = Buffer.from(padded, 'base64').toString('utf8');
      const payload = JSON.parse(json) as { exp?: unknown };

      if (typeof payload.exp === 'number') {
        return payload.exp * 1000;
      }
    } catch {
      this.logger.warn('Failed to decode JWT expiry claim; will use 1-hour fallback');
    }

    return 0;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────────

  private async authHeader(): Promise<{ x_ivueit_auth_token: string }> {
    const token = await this.getToken();
    return { x_ivueit_auth_token: token };
  }

  private async apiFetch(
    path: string,
    init: RequestInit = {}
  ): Promise<Response> {
    const auth = await this.authHeader();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...auth,
      ...(init.headers as Record<string, string> | undefined),
    };

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `iVueit API error [${init.method ?? 'GET'} ${path}]: ` +
          `HTTP ${response.status} — ${body}`
      );
    }

    return response;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // InspectionProvider implementation
  // ──────────────────────────────────────────────────────────────────────────

  async createOrder(input: CreateInspectionOrderInput): Promise<ExternalOrderRef> {
    // Only required fields per iVueit API v1.4.0 /api/v1/batch/import docs.
    const payload = {
      surveyTemplate: input.surveyTemplateId,
      startsAt: input.schedulingWindow.startTime,
      endsAt: input.schedulingWindow.endTime,
      publishAt: 0, // 0 = publish immediately
      vueData: {
        vueName: `Order ${input.vendorOrderId}`,
        vueAddress: input.address.street,
        vueCity: input.address.city,
        vueStateOrProvinceTwoCharacterCode: input.address.stateCode,
        vueZipOrPostalCode: input.address.zipCode,
      },
    };

    const response = await this.apiFetch('/api/v1/batch/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const created = (await response.json()) as IVueitCreateBatchResponse;

    // Fetch the newly created Vue to obtain its canonicalId.
    const vue = await this.fetchVue(created.vueId);

    this.logger.info('iVueit order created', {
      vueId: created.vueId,
      canonicalId: vue.canonicalId,
      batchId: created.batchId,
    });

    return {
      externalOrderId: created.vueId,
      externalCanonicalId: vue.canonicalId,
      externalBatchId: created.batchId,
    };
  }

  async getOrder(externalOrderId: string): Promise<ExternalOrderStatus> {
    const vue = await this.fetchVue(externalOrderId);

    const pdfFileIds: InspectionPdfFileIds = {
      ...(vue.pdfFileId && { main: vue.pdfFileId }),
      ...(vue.pdfFileIdSurvey && { survey: vue.pdfFileIdSurvey }),
      ...(vue.pdfFileIdPhotos && { photos: vue.pdfFileIdPhotos }),
      ...(vue.pdfFileIdOrdered && { ordered: vue.pdfFileIdOrdered }),
    };

    // iVueit does not expose a top-level `status` field on the single-Vue
    // endpoint. Completion is determined by the presence of `pdfFileIdOrdered`.
    const isComplete = !!vue.pdfFileIdOrdered;
    const externalStatus = isComplete ? 'Completed' : 'InProgress';

    return {
      externalOrderId: vue.id,
      externalStatus,
      isComplete,
      isCancelled: false,
      escalated: vue.escalated ?? false,
      ...(vue.escalationNotes ? { escalationNotes: vue.escalationNotes } : {}),
      ...(Object.keys(pdfFileIds).length > 0 ? { pdfFileIds } : {}),
      ...(vue.submissionId ? { submissionId: vue.submissionId } : {}),
      ...(vue.expiresAt ? { externalExpiresAt: vue.expiresAt } : {}),
    };
  }

  async getSubmissionData(submissionId: string): Promise<unknown> {
    const response = await this.apiFetch(`/api/v1/surveysubmission/${encodeURIComponent(submissionId)}`);
    return response.json();
  }

  async getFileDownloadUrl(fileId: string): Promise<string> {
    const response = await this.apiFetch(`/api/v1/file/url/${encodeURIComponent(fileId)}`);
    const data = (await response.json()) as IVueitFileUrlResponse;

    if (!data.url) {
      throw new Error(
        `iVueit returned an empty download URL for file ID ${fileId}`
      );
    }

    return data.url;
  }

  async uploadFile(input: UploadFileInput): Promise<string> {
    const payload = {
      filename: input.filename,
      mimeType: input.mimeType,
      data: input.data.toString('base64'),
    };

    const response = await this.apiFetch('/api/v1/file/upload', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const result = (await response.json()) as IVueitFileUploadResponse;

    if (!result.assignedId) {
      throw new Error(
        `iVueit file upload succeeded but returned no assignedId for file "${input.filename}"`
      );
    }

    return result.assignedId;
  }

  async cancelOrder(externalOrderId: string, reason: string): Promise<void> {
    await this.apiFetch(`/api/v1/vue/cancel/${encodeURIComponent(externalOrderId)}`, {
      method: 'PUT',
      body: JSON.stringify({ id: externalOrderId, reason }),
    });

    this.logger.info('iVueit order cancelled', { externalOrderId, reason });
  }

  // sendMessage is intentionally not implemented — supportsMessaging = false.
  // The InspectionVendorService checks supportsMessaging before calling it.

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  private async fetchVue(vueId: string): Promise<IVueitVue> {
    const response = await this.apiFetch(`/api/v1/vue/${encodeURIComponent(vueId)}`);
    return response.json() as Promise<IVueitVue>;
  }
}
