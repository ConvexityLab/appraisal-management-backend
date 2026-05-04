import type {
  CreateInspectionOrderInput,
  ExternalOrderRef,
  ExternalOrderStatus,
  UploadFileInput,
} from '../../types/inspection-vendor.types.js';

/**
 * Generic interface every inspection-vendor provider must implement.
 *
 * Design notes:
 * - `sendMessage` is optional because not all vendors expose a messaging API.
 *   Check `supportsMessaging` before calling it; the service layer returns
 *   HTTP 501 when the provider sets it to false.
 * - All network calls must throw on non-2xx responses with a descriptive message.
 */
export interface InspectionProvider {
  /** Human-readable name stored in InspectionVendorData.externalProvider. */
  readonly name: string;

  /** Whether the vendor exposes a send-message API endpoint. */
  readonly supportsMessaging: boolean;

  /** True when all required env vars are present and the provider can operate. */
  isAvailable(): boolean;

  /**
   * Return a valid auth token, refreshing from the vendor API when necessary.
   * Callers within this file should use `authHeader()` instead.
   */
  getToken(): Promise<string>;

  /** Place a new inspection order. Returns vendor-assigned identifiers. */
  createOrder(input: CreateInspectionOrderInput): Promise<ExternalOrderRef>;

  /** Poll the vendor for the current order state. */
  getOrder(externalOrderId: string): Promise<ExternalOrderStatus>;

  /**
   * Retrieve the full survey submission data by vendor submission ID.
   * Returns the raw vendor JSON (caller stores it to blob as-is).
   */
  getSubmissionData(submissionId: string): Promise<unknown>;

  /**
   * Get a short-lived signed download URL for a vendor file ID.
   * Used to download PDF reports.
   */
  getFileDownloadUrl(fileId: string): Promise<string>;

  /**
   * Upload a supplementary file to the vendor.
   * Returns the vendor-assigned file ID.
   */
  uploadFile(input: UploadFileInput): Promise<string>;

  /** Cancel an active order on the vendor side. */
  cancelOrder(externalOrderId: string, reason: string): Promise<void>;

  /**
   * Send a message to the inspector via the vendor platform.
   * Only call when `supportsMessaging === true`.
   * Providers that do not support messaging may omit this or throw.
   */
  sendMessage?(externalOrderId: string, message: string): Promise<void>;
}
