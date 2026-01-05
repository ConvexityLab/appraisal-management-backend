/**
 * Comprehensive Address Services
 * Multi-provider address lookup, verification, geocoding, and standardization
 */

import { Logger } from '../utils/logger.js';
import { GenericCacheService } from './cache/generic-cache.service';
import { 
  AddressComponents, 
  GeocodingResult, 
  AddressValidationResult
} from '../types/property-intelligence.js';
import { Coordinates } from '../types/geospatial.js';

export class AddressService {
  private logger: Logger;
  private cache: GenericCacheService;
  
  // Provider configurations
  private providers: {
    google: {
      apiKey: string;
      baseUrl: string;
      enabled: boolean;
    };
    mapbox: {
      apiKey: string;
      baseUrl: string;
      enabled: boolean;
    };
    here: {
      apiKey: string;
      baseUrl: string;
      enabled: boolean;
    };
    usps: {
      userId: string;
      baseUrl: string;
      enabled: boolean;
    };
    smartystreets: {
      authId: string;
      authToken: string;
      baseUrl: string;
      enabled: boolean;
    };
  };

  constructor() {
    this.logger = new Logger();
    this.cache = new GenericCacheService();
    
    this.providers = {
      google: {
        apiKey: process.env.GOOGLE_GEOCODING_API_KEY || '',
        baseUrl: 'https://maps.googleapis.com/maps/api/geocode/json',
        enabled: !!process.env.GOOGLE_GEOCODING_API_KEY
      },
      mapbox: {
        apiKey: process.env.MAPBOX_ACCESS_TOKEN || '',
        baseUrl: 'https://api.mapbox.com/geocoding/v5/mapbox.places',
        enabled: !!process.env.MAPBOX_ACCESS_TOKEN
      },
      here: {
        apiKey: process.env.HERE_API_KEY || '',
        baseUrl: 'https://geocode.search.hereapi.com/v1/geocode',
        enabled: !!process.env.HERE_API_KEY
      },
      usps: {
        userId: process.env.USPS_USER_ID || '',
        baseUrl: 'https://secure.shippingapis.com/ShippingAPI.dll',
        enabled: !!process.env.USPS_USER_ID
      },
      smartystreets: {
        authId: process.env.SMARTYSTREETS_AUTH_ID || '',
        authToken: process.env.SMARTYSTREETS_AUTH_TOKEN || '',
        baseUrl: 'https://us-street.api.smartystreets.com/street-address',
        enabled: !!(process.env.SMARTYSTREETS_AUTH_ID && process.env.SMARTYSTREETS_AUTH_TOKEN)
      }
    };
  }

  /**
   * Comprehensive address geocoding using multiple providers
   */
  async geocodeAddress(address: string): Promise<GeocodingResult[]> {
    const cacheKey = `geocode:${address.toLowerCase().trim()}`;
    
    try {
      // Check cache first
      const cached = await this.cache.get<GeocodingResult[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const results: GeocodingResult[] = [];
      
      // Try multiple providers for better accuracy
      const providers = [
        { name: 'google', method: this.geocodeWithGoogle.bind(this) },
        { name: 'mapbox', method: this.geocodeWithMapbox.bind(this) },
        { name: 'here', method: this.geocodeWithHere.bind(this) }
      ];

      for (const provider of providers) {
        if (this.providers[provider.name as keyof typeof this.providers]?.enabled) {
          try {
            const result = await provider.method(address);
            if (result) {
              results.push(result);
            }
          } catch (error) {
            this.logger.warn(`Geocoding failed for provider ${provider.name}`, { error, address });
          }
        }
      }

      // Sort by confidence and precision
      results.sort((a, b) => {
        if (a.precision !== b.precision) {
          const precisionOrder = ['exact', 'interpolated', 'geometric_center', 'approximate'];
          return precisionOrder.indexOf(a.precision) - precisionOrder.indexOf(b.precision);
        }
        return b.confidence - a.confidence;
      });

      // Cache results for 24 hours
      await this.cache.set(cacheKey, results, 24 * 60 * 60);
      
      return results;

    } catch (error) {
      this.logger.error('Failed to geocode address', { error, address });
      throw new Error('Geocoding service unavailable');
    }
  }

  /**
   * Reverse geocoding - convert coordinates to address
   */
  async reverseGeocode(coordinates: Coordinates): Promise<AddressComponents | null> {
    const cacheKey = `reverse:${coordinates.latitude},${coordinates.longitude}`;
    
    try {
      // Check cache first
      const cached = await this.cache.get<AddressComponents>(cacheKey);
      if (cached) {
        return cached;
      }

      // Try Google first (usually most accurate for addresses)
      if (this.providers.google.enabled) {
        const result = await this.reverseGeocodeWithGoogle(coordinates);
        if (result) {
          await this.cache.set(cacheKey, result, 24 * 60 * 60);
          return result;
        }
      }

      // Fallback to other providers
      if (this.providers.mapbox.enabled) {
        const result = await this.reverseGeocodeWithMapbox(coordinates);
        if (result) {
          await this.cache.set(cacheKey, result, 24 * 60 * 60);
          return result;
        }
      }

      return null;

    } catch (error) {
      this.logger.error('Failed to reverse geocode coordinates', { error, coordinates });
      return null;
    }
  }

  /**
   * Comprehensive address validation and standardization
   */
  async validateAddress(address: string): Promise<AddressValidationResult> {
    try {
      const results: Partial<AddressValidationResult> = {
        originalAddress: address,
        validationIssues: [],
        isValid: false,
        deliverabilityScore: 0
      };

      // Use SmartyStreets for USPS validation (most accurate for US addresses)
      if (this.providers.smartystreets.enabled) {
        const smartyResult = await this.validateWithSmartyStreets(address);
        if (smartyResult) {
          return smartyResult;
        }
      }

      // Fallback to USPS direct
      if (this.providers.usps.enabled) {
        const uspsResult = await this.validateWithUSPS(address);
        if (uspsResult) {
          return uspsResult;
        }
      }

      // Basic validation using geocoding
      const geocodeResults = await this.geocodeAddress(address);
      results.validationIssues = results.validationIssues || [];
      
      if (geocodeResults.length > 0) {
        const best = geocodeResults[0];
        if (best) {
          results.isValid = best.confidence > 0.8;
          results.standardizedAddress = best.address;
          results.deliverabilityScore = best.confidence;
          
          if (best.precision === 'approximate') {
            results.validationIssues.push('Address precision is approximate');
          }
        }
      } else {
        results.validationIssues.push('Address could not be geocoded');
      }

      return results as AddressValidationResult;

    } catch (error) {
      this.logger.error('Failed to validate address', { error, address });
      return {
        isValid: false,
        originalAddress: address,
        validationIssues: ['Validation service error'],
        deliverabilityScore: 0
      };
    }
  }

  /**
   * Address suggestion/autocomplete
   */
  async suggestAddresses(partial: string, limit: number = 5): Promise<string[]> {
    try {
      const suggestions: string[] = [];

      // Use Google Places Autocomplete
      if (this.providers.google.enabled) {
        const googleSuggestions = await this.suggestWithGoogle(partial, limit);
        suggestions.push(...googleSuggestions);
      }

      // Use Mapbox for additional suggestions
      if (this.providers.mapbox.enabled && suggestions.length < limit) {
        const mapboxSuggestions = await this.suggestWithMapbox(partial, limit - suggestions.length);
        suggestions.push(...mapboxSuggestions);
      }

      // Remove duplicates and return
      return [...new Set(suggestions)].slice(0, limit);

    } catch (error) {
      this.logger.error('Failed to get address suggestions', { error, partial });
      return [];
    }
  }

  // ===========================
  // PROVIDER-SPECIFIC METHODS
  // ===========================

  private async geocodeWithGoogle(address: string): Promise<GeocodingResult | null> {
    try {
      const url = `${this.providers.google.baseUrl}?address=${encodeURIComponent(address)}&key=${this.providers.google.apiKey}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        
        const geocodingResult: GeocodingResult = {
          address: this.parseGoogleAddress(result.address_components, result.formatted_address),
          coordinates: {
            latitude: result.geometry.location.lat,
            longitude: result.geometry.location.lng
          },
          precision: this.mapGooglePrecision(result.geometry.location_type),
          confidence: this.calculateGoogleConfidence(result),
          provider: 'google',
          placeId: result.place_id
        };
        
        if (result.geometry.viewport) {
          geocodingResult.boundingBox = {
            northeast: {
              latitude: result.geometry.viewport.northeast.lat,
              longitude: result.geometry.viewport.northeast.lng
            },
            southwest: {
              latitude: result.geometry.viewport.southwest.lat,
              longitude: result.geometry.viewport.southwest.lng
            }
          };
        }
        
        return geocodingResult;
      }
      
      return null;
    } catch (error) {
      this.logger.error('Google geocoding failed', { error, address });
      return null;
    }
  }

  private async geocodeWithMapbox(address: string): Promise<GeocodingResult | null> {
    try {
      const url = `${this.providers.mapbox.baseUrl}/${encodeURIComponent(address)}.json?access_token=${this.providers.mapbox.apiKey}&types=address&limit=1`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        
        const geocodingResult: GeocodingResult = {
          address: this.parseMapboxAddress(feature),
          coordinates: {
            latitude: feature.geometry.coordinates[1],
            longitude: feature.geometry.coordinates[0]
          },
          precision: this.mapMapboxPrecision(feature.properties.accuracy),
          confidence: feature.relevance || 0.8,
          provider: 'mapbox',
          placeId: feature.id
        };
        
        if (feature.bbox) {
          geocodingResult.boundingBox = {
            northeast: {
              latitude: feature.bbox[3],
              longitude: feature.bbox[2]
            },
            southwest: {
              latitude: feature.bbox[1],
              longitude: feature.bbox[0]
            }
          };
        }
        
        return geocodingResult;
      }
      
      return null;
    } catch (error) {
      this.logger.error('Mapbox geocoding failed', { error, address });
      return null;
    }
  }

  private async geocodeWithHere(address: string): Promise<GeocodingResult | null> {
    try {
      const url = `${this.providers.here.baseUrl}?q=${encodeURIComponent(address)}&apiKey=${this.providers.here.apiKey}&limit=1`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        const item = data.items[0];
        
        return {
          address: this.parseHereAddress(item.address),
          coordinates: {
            latitude: item.position.lat,
            longitude: item.position.lng
          },
          precision: this.mapHerePrecision(item.resultType),
          confidence: item.scoring?.queryScore || 0.8,
          provider: 'here',
          placeId: item.id
        };
      }
      
      return null;
    } catch (error) {
      this.logger.error('HERE geocoding failed', { error, address });
      return null;
    }
  }

  private async validateWithSmartyStreets(address: string): Promise<AddressValidationResult | null> {
    try {
      const url = `${this.providers.smartystreets.baseUrl}?auth-id=${this.providers.smartystreets.authId}&auth-token=${this.providers.smartystreets.authToken}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([{
          street: address,
          candidates: 1
        }])
      });
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        const result = data[0];
        
        return {
          isValid: true,
          originalAddress: address,
          standardizedAddress: {
            streetNumber: result.components.primary_number || '',
            streetName: result.components.street_name || '',
            unitNumber: result.components.secondary_number || undefined,
            city: result.components.city_name || '',
            state: result.components.state_abbreviation || '',
            postalCode: result.components.zipcode || '',
            county: result.metadata.county_name || '',
            country: 'US',
            formattedAddress: result.delivery_line_1 + (result.delivery_line_2 ? ` ${result.delivery_line_2}` : '') + `, ${result.last_line}`
          },
          validationIssues: result.analysis.dpv_footnotes ? this.parseSmartyStreetsFootnotes(result.analysis.dpv_footnotes) : [],
          deliverabilityScore: result.analysis.dpv_match_y ? 1.0 : (result.analysis.dpv_match_n ? 0.0 : 0.5),
          uspsData: {
            dpvConfirmed: result.analysis.dpv_match_y === 'Y',
            vacant: result.analysis.vacant === 'Y',
            businessAddress: result.metadata.record_type === 'C'
          }
        };
      }
      
      return null;
    } catch (error) {
      this.logger.error('SmartyStreets validation failed', { error, address });
      return null;
    }
  }

  // ===========================
  // HELPER METHODS
  // ===========================

  private parseGoogleAddress(components: any[], formatted: string): AddressComponents {
    const parsed: Partial<AddressComponents> = {
      formattedAddress: formatted
    };

    for (const component of components) {
      const types = component.types;
      
      if (types.includes('street_number')) {
        parsed.streetNumber = component.long_name;
      } else if (types.includes('route')) {
        parsed.streetName = component.long_name;
      } else if (types.includes('subpremise')) {
        parsed.unitNumber = component.long_name;
      } else if (types.includes('locality')) {
        parsed.city = component.long_name;
      } else if (types.includes('administrative_area_level_1')) {
        parsed.state = component.short_name;
      } else if (types.includes('postal_code')) {
        parsed.postalCode = component.long_name;
      } else if (types.includes('administrative_area_level_2')) {
        parsed.county = component.long_name;
      } else if (types.includes('country')) {
        parsed.country = component.short_name;
      }
    }

    return parsed as AddressComponents;
  }

  private parseMapboxAddress(feature: any): AddressComponents {
    const context = feature.context || [];
    const properties = feature.properties || {};
    
    const address: Partial<AddressComponents> = {
      formattedAddress: feature.place_name,
      streetNumber: properties.address || '',
      streetName: feature.text || '',
      country: 'US' // Mapbox US geocoding
    };

    for (const item of context) {
      if (item.id.startsWith('place')) {
        address.city = item.text;
      } else if (item.id.startsWith('region')) {
        address.state = item.short_code?.replace('us-', '').toUpperCase() || item.text;
      } else if (item.id.startsWith('postcode')) {
        address.postalCode = item.text;
      } else if (item.id.startsWith('district')) {
        address.county = item.text;
      }
    }

    return address as AddressComponents;
  }

  private parseHereAddress(hereAddress: any): AddressComponents {
    return {
      streetNumber: hereAddress.houseNumber || '',
      streetName: hereAddress.street || '',
      city: hereAddress.city || '',
      state: hereAddress.stateCode || hereAddress.state || '',
      postalCode: hereAddress.postalCode || '',
      county: hereAddress.county || '',
      country: hereAddress.countryCode || 'US',
      formattedAddress: hereAddress.label || ''
    };
  }

  private mapGooglePrecision(locationType: string): 'exact' | 'interpolated' | 'geometric_center' | 'approximate' {
    switch (locationType) {
      case 'ROOFTOP': return 'exact';
      case 'RANGE_INTERPOLATED': return 'interpolated';
      case 'GEOMETRIC_CENTER': return 'geometric_center';
      case 'APPROXIMATE': return 'approximate';
      default: return 'approximate';
    }
  }

  private mapMapboxPrecision(accuracy?: string): 'exact' | 'interpolated' | 'geometric_center' | 'approximate' {
    if (!accuracy) return 'approximate';
    if (accuracy === 'rooftop' || accuracy === 'parcel') return 'exact';
    if (accuracy === 'point') return 'interpolated';
    return 'approximate';
  }

  private mapHerePrecision(resultType: string): 'exact' | 'interpolated' | 'geometric_center' | 'approximate' {
    switch (resultType) {
      case 'houseNumber': return 'exact';
      case 'street': return 'interpolated';
      case 'locality': return 'geometric_center';
      default: return 'approximate';
    }
  }

  private calculateGoogleConfidence(result: any): number {
    // Google doesn't provide explicit confidence, so we calculate based on available data
    let confidence = 0.5;
    
    if (result.geometry.location_type === 'ROOFTOP') confidence += 0.4;
    else if (result.geometry.location_type === 'RANGE_INTERPOLATED') confidence += 0.3;
    else if (result.geometry.location_type === 'GEOMETRIC_CENTER') confidence += 0.2;
    
    if (result.partial_match !== true) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  private parseSmartyStreetsFootnotes(footnotes: string): string[] {
    const issues: string[] = [];
    
    if (footnotes.includes('N1')) issues.push('Address not found in USPS database');
    if (footnotes.includes('M1')) issues.push('Primary number missing');
    if (footnotes.includes('M3')) issues.push('Primary number invalid');
    if (footnotes.includes('P1')) issues.push('PO Box address');
    if (footnotes.includes('F1')) issues.push('Address is a military or diplomatic address');
    
    return issues;
  }

  private async reverseGeocodeWithGoogle(coordinates: Coordinates): Promise<AddressComponents | null> {
    try {
      const url = `${this.providers.google.baseUrl}?latlng=${coordinates.latitude},${coordinates.longitude}&key=${this.providers.google.apiKey}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results.length > 0) {
        // Find the most precise address result
        const addressResult = data.results.find((r: any) => 
          r.types.includes('street_address') || r.types.includes('premise')
        ) || data.results[0];
        
        return this.parseGoogleAddress(addressResult.address_components, addressResult.formatted_address);
      }
      
      return null;
    } catch (error) {
      this.logger.error('Google reverse geocoding failed', { error, coordinates });
      return null;
    }
  }

  private async reverseGeocodeWithMapbox(coordinates: Coordinates): Promise<AddressComponents | null> {
    try {
      const url = `${this.providers.mapbox.baseUrl}/${coordinates.longitude},${coordinates.latitude}.json?access_token=${this.providers.mapbox.apiKey}&types=address&limit=1`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        return this.parseMapboxAddress(data.features[0]);
      }
      
      return null;
    } catch (error) {
      this.logger.error('Mapbox reverse geocoding failed', { error, coordinates });
      return null;
    }
  }

  private async suggestWithGoogle(partial: string, limit: number): Promise<string[]> {
    // Implementation would use Google Places Autocomplete API
    // Placeholder for now
    return [];
  }

  private async suggestWithMapbox(partial: string, limit: number): Promise<string[]> {
    // Implementation would use Mapbox Search API
    // Placeholder for now
    return [];
  }

  private async validateWithUSPS(address: string): Promise<AddressValidationResult | null> {
    // Implementation would use USPS Address Validation API
    // Placeholder for now
    return null;
  }
}