/**
 * AddressServiceGeocoder
 *
 * Adapter that satisfies `Geocoder` (port used by `PropertyEnrichmentService`)
 * by delegating to the existing multi-provider `AddressService.geocodeAddress`.
 *
 * Picks the highest-confidence result returned by `AddressService` and exposes
 * only `{ latitude, longitude }`. Returns `null` when no provider produced a
 * result (treated as a "no-match" miss). Lets exceptions thrown by
 * `AddressService` propagate so the caller can log them as a transient
 * failure instead of a no-match.
 */

import type { Geocoder } from './property-enrichment.service.js';
import { AddressService } from './address.service.js';

export class AddressServiceGeocoder implements Geocoder {
  constructor(private readonly addressService: AddressService = new AddressService()) {}

  async geocode(address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  }): Promise<{ latitude: number; longitude: number } | null> {
    const formatted = `${address.street}, ${address.city}, ${address.state} ${address.zip}`.trim();
    const results = await this.addressService.geocodeAddress(formatted);
    if (!results || results.length === 0) return null;

    // AddressService already sorts by precision then confidence — take the top.
    const top = results[0];
    if (top === undefined || !top.coordinates) return null;
    const { latitude, longitude } = top.coordinates;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
    return { latitude, longitude };
  }
}
