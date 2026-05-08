import { IVueitInspectionProvider } from './ivueit.provider.js';
import type { InspectionProvider } from './inspection-provider.interface.js';

/**
 * Returns the configured inspection provider based on the INSPECTION_PROVIDER
 * environment variable.
 *
 * Supported values:
 *   - 'ivueit'    — live iVueit integration (requires IVUEIT_API_KEY, IVUEIT_SECRET, IVUEIT_BASE_URL)
 *   - 'disabled'  — explicit opt-out; every method throws HTTP 501 at call time.
 *                   Use this in environments where no inspection vendor is contracted.
 *
 * Throws with a clear message if the variable is missing or unrecognised so
 * that misconfiguration is caught at startup, not at the first API call.
 */
export function createInspectionProvider(): InspectionProvider {
  const providerName = process.env['INSPECTION_PROVIDER'];

  if (!providerName) {
    throw new Error(
      'Missing required env var INSPECTION_PROVIDER. ' +
        "Set it to the inspection vendor to use (e.g. 'ivueit') or 'disabled' to opt out."
    );
  }

  switch (providerName.toLowerCase()) {
    case 'ivueit':
      return new IVueitInspectionProvider();

    case 'disabled':
      return new DisabledInspectionProvider();

    default:
      throw new Error(
        `Unsupported INSPECTION_PROVIDER value: "${providerName}". ` +
          "Supported values: 'ivueit', 'disabled'."
      );
  }
}

/**
 * Stub provider returned when INSPECTION_PROVIDER=disabled.
 * Every operation throws a clear 501-style error so callers surface a useful
 * message rather than silently doing nothing.
 */
class DisabledInspectionProvider implements InspectionProvider {
  readonly name = 'disabled';
  readonly supportsMessaging = false;

  isAvailable(): boolean { return false; }

  private notConfigured(): never {
    throw new Error(
      'Inspection provider is disabled (INSPECTION_PROVIDER=disabled). ' +
        "Set INSPECTION_PROVIDER=ivueit and supply the required credentials to enable inspections.",
    );
  }

  getToken(): Promise<string> { return Promise.reject(this.notConfigured()); }
  createOrder(): Promise<never> { return Promise.reject(this.notConfigured()); }
  getOrder(): Promise<never> { return Promise.reject(this.notConfigured()); }
  getSubmissionData(): Promise<never> { return Promise.reject(this.notConfigured()); }
  getFileDownloadUrl(): Promise<never> { return Promise.reject(this.notConfigured()); }
  uploadFile(): Promise<never> { return Promise.reject(this.notConfigured()); }
  cancelOrder(): Promise<never> { return Promise.reject(this.notConfigured()); }
}
