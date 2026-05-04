import { IVueitInspectionProvider } from './ivueit.provider.js';
import type { InspectionProvider } from './inspection-provider.interface.js';

/**
 * Returns the configured inspection provider based on the INSPECTION_PROVIDER
 * environment variable.
 *
 * Supported values:
 *   - 'ivueit'
 *
 * Throws with a clear message if the variable is missing or unrecognised so
 * that misconfiguration is caught at startup, not at the first API call.
 */
export function createInspectionProvider(): InspectionProvider {
  const providerName = process.env['INSPECTION_PROVIDER'];

  if (!providerName) {
    throw new Error(
      'Missing required env var INSPECTION_PROVIDER. ' +
        "Set it to the inspection vendor to use (e.g. 'ivueit')."
    );
  }

  switch (providerName.toLowerCase()) {
    case 'ivueit':
      return new IVueitInspectionProvider();

    default:
      throw new Error(
        `Unsupported INSPECTION_PROVIDER value: "${providerName}". ` +
          "Supported values: 'ivueit'."
      );
  }
}
