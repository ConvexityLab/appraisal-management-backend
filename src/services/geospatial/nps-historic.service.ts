import { Logger } from '../../utils/logger';

/**
 * Coordinates interface
 */
interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * National Park Service Historic Places Service
 * Provides access to National Register of Historic Places data
 * API Documentation: https://www.nps.gov/subjects/developer/api-documentation.htm
 */
export class NpsHistoricService {
  private readonly logger: Logger;
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor() {
    this.logger = new Logger();
    this.baseUrl = 'https://developer.nps.gov/api/v1';
    this.apiKey = process.env.NPS_API_KEY || '';

    if (!this.apiKey) {
      this.logger.warn('NPS_API_KEY not configured, historic places data will be limited');
    } else {
      this.logger.info('NPS Historic Service initialized', { 
        apiKeyPresent: !!this.apiKey, 
        apiKeyLength: this.apiKey?.length 
      });
    }
  }

  /**
   * Check if property is in or near historic places
   */
  async getHistoricPlacesNearby(coordinates: Coordinates, radiusMiles: number = 0.25): Promise<any> {
    try {
      if (!this.apiKey) {
        return this.getMockHistoricData(coordinates, 'NPS API key not configured');
      }

      const { latitude, longitude } = coordinates;

      // Try NPS Parks API first
      const url = `${this.baseUrl}/parks?limit=50&api_key=${this.apiKey}`;
      
      this.logger.debug('Calling NPS API', { url: url.replace(this.apiKey, '***') });
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        this.logger.error('NPS API returned error', { 
          status: response.status, 
          statusText: response.statusText,
          error: errorText 
        });
        
        if (response.status === 403) {
          return this.getMockHistoricData(coordinates, 'NPS API key is invalid or expired (403 Forbidden)');
        } else if (response.status === 429) {
          return this.getMockHistoricData(coordinates, 'NPS API rate limit exceeded');
        } else {
          return this.getMockHistoricData(coordinates, `NPS API error: ${response.status} ${response.statusText}`);
        }
      }

      const data = await response.json();
      
      // Filter results by distance
      const nearbyPlaces = this.filterByDistance(
        data.data || [],
        coordinates,
        radiusMiles
      );

      return {
        hasHistoricDesignation: nearbyPlaces.length > 0,
        nearbyHistoricPlaces: nearbyPlaces.map((place: any) => ({
          id: place.id,
          name: place.title || place.fullName,
          description: place.description,
          designation: this.extractDesignation(place),
          distance: this.calculateDistance(coordinates, place),
          significance: place.significance || 'Historic',
          url: place.url,
          images: place.images?.map((img: any) => ({
            url: img.url,
            title: img.title,
            altText: img.altText,
          })) || [],
        })),
        historicDistricts: this.extractHistoricDistricts(nearbyPlaces),
        restrictions: this.getHistoricRestrictions(nearbyPlaces),
        valuationImpact: this.assessValuationImpact(nearbyPlaces),
      };
    } catch (error) {
      this.logger.error('Failed to get historic places', { error, coordinates });
      return this.getMockHistoricData(coordinates);
    }
  }

  /**
   * Search historic places by state and county
   */
  async searchByStateCounty(stateCode: string, county?: string): Promise<any> {
    try {
      if (!this.apiKey) {
        return { places: [], total: 0 };
      }

      const url = `${this.baseUrl}/places?stateCode=${stateCode}&limit=100&api_key=${this.apiKey}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`NPS API error: ${response.status}`);
      }

      const data = await response.json();
      let places = data.data || [];

      // Filter by county if provided
      if (county) {
        places = places.filter((place: any) => 
          place.addresses?.some((addr: any) => 
            addr.city?.toLowerCase().includes(county.toLowerCase()) ||
            addr.line1?.toLowerCase().includes(county.toLowerCase())
          )
        );
      }

      return {
        places: places.map((place: any) => ({
          id: place.id,
          name: place.title || place.fullName,
          description: place.description,
          stateCode: place.states,
          designation: this.extractDesignation(place),
          url: place.url,
        })),
        total: places.length,
      };
    } catch (error) {
      this.logger.error('Failed to search by state/county', { error, stateCode, county });
      return { places: [], total: 0 };
    }
  }

  /**
   * Get detailed information about a specific historic place
   */
  async getPlaceDetails(placeId: string): Promise<any> {
    try {
      if (!this.apiKey) {
        return null;
      }

      const url = `${this.baseUrl}/places/${placeId}?api_key=${this.apiKey}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`NPS API error: ${response.status}`);
      }

      const data = await response.json();
      const place = data.data?.[0];

      if (!place) {
        return null;
      }

      return {
        id: place.id,
        name: place.title || place.fullName,
        description: place.description,
        designation: this.extractDesignation(place),
        significance: place.significance,
        listingDate: place.listingDate,
        addresses: place.addresses,
        contacts: place.contacts,
        images: place.images,
        url: place.url,
        restrictions: this.getPlaceRestrictions(place),
        valuationNotes: this.getValuationNotes(place),
      };
    } catch (error) {
      this.logger.error('Failed to get place details', { error, placeId });
      return null;
    }
  }

  /**
   * Filter places by distance from coordinates
   */
  private filterByDistance(places: any[], coordinates: Coordinates, radiusMiles: number): any[] {
    return places.filter((place: any) => {
      const distance = this.calculateDistance(coordinates, place);
      return distance !== null && distance <= radiusMiles;
    });
  }

  /**
   * Calculate distance from coordinates to place (in miles)
   */
  private calculateDistance(coordinates: Coordinates, place: any): number | null {
    try {
      // Try to extract coordinates from place
      const placeLat = place.latitude || place.lat;
      const placeLng = place.longitude || place.lng || place.lon;

      if (!placeLat || !placeLng) {
        return null;
      }

      const R = 3959; // Earth's radius in miles
      const dLat = this.toRad(placeLat - coordinates.latitude);
      const dLon = this.toRad(placeLng - coordinates.longitude);
      
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(this.toRad(coordinates.latitude)) * 
        Math.cos(this.toRad(placeLat)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      return Math.round(distance * 100) / 100;
    } catch (error) {
      return null;
    }
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Extract designation type from place data
   */
  private extractDesignation(place: any): string {
    if (place.designation) {
      return place.designation;
    }
    
    if (place.title?.toLowerCase().includes('district')) {
      return 'Historic District';
    }
    
    if (place.title?.toLowerCase().includes('national park')) {
      return 'National Park';
    }
    
    if (place.title?.toLowerCase().includes('monument')) {
      return 'National Monument';
    }
    
    return 'National Register of Historic Places';
  }

  /**
   * Extract historic districts from places
   */
  private extractHistoricDistricts(places: any[]): any[] {
    return places
      .filter(place => 
        place.title?.toLowerCase().includes('district') ||
        place.designation === 'Historic District'
      )
      .map(district => ({
        name: district.title || district.fullName,
        significance: district.significance,
      }));
  }

  /**
   * Get historic preservation restrictions
   */
  private getHistoricRestrictions(places: any[]): string[] {
    if (places.length === 0) {
      return [];
    }

    const restrictions: string[] = [
      'Property may be subject to local historic preservation ordinances',
      'Exterior modifications may require historic review board approval',
      'Certain tax credits may be available for certified rehabilitation',
    ];

    if (places.some(p => p.designation === 'Historic District')) {
      restrictions.push('Property is within a designated historic district');
      restrictions.push('Additional design guidelines may apply to new construction or renovations');
    }

    return restrictions;
  }

  /**
   * Get place-specific restrictions
   */
  private getPlaceRestrictions(place: any): string[] {
    const restrictions: string[] = [];

    if (place.designation?.includes('National Register')) {
      restrictions.push('Listed on National Register of Historic Places');
      restrictions.push('May qualify for historic preservation tax credits');
    }

    if (place.designation?.includes('District')) {
      restrictions.push('Subject to historic district regulations');
    }

    return restrictions;
  }

  /**
   * Assess valuation impact of historic designation
   */
  private assessValuationImpact(places: any[]): any {
    if (places.length === 0) {
      return {
        impact: 'none',
        factors: [],
      };
    }

    const factors: string[] = [];
    let impact = 'neutral';

    if (places.some(p => p.designation === 'Historic District')) {
      impact = 'positive';
      factors.push('Location in historic district often increases property values');
      factors.push('Enhanced neighborhood character and preservation');
      factors.push('Tourist attraction potential in some areas');
    }

    factors.push('Renovation restrictions may limit modernization options');
    factors.push('Potential access to historic preservation tax incentives');
    factors.push('Review board approval required for exterior changes');

    return { impact, factors };
  }

  /**
   * Get valuation notes for specific place
   */
  private getValuationNotes(place: any): string[] {
    const notes: string[] = [];

    if (place.designation) {
      notes.push(`Designated as: ${place.designation}`);
    }

    if (place.significance) {
      notes.push(`Historic significance: ${place.significance}`);
    }

    notes.push('Appraiser should verify current local preservation restrictions');
    notes.push('Consider impact on property marketability and buyer pool');
    notes.push('Research available tax credits for historic rehabilitation');

    return notes;
  }

  /**
   * Get mock historic data when API is not available
   */
  private getMockHistoricData(coordinates: Coordinates, reason?: string): any {
    return {
      hasHistoricDesignation: false,
      nearbyHistoricPlaces: [],
      historicDistricts: [],
      restrictions: [],
      valuationImpact: {
        impact: 'unknown',
        factors: [reason || 'NPS API not available - unable to verify historic status'],
      },
    };
  }
}
