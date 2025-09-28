import { Logger } from '../../utils/logger.js';
import { 
  Coordinates, 
  FloodRiskData, 
  FloodZone, 
  FloodEvent, 
  DamRisk,
  FemaDisaster
} from '../../types/geospatial.js';

/**
 * FEMA Flood Risk Assessment Service
 * 
 * Integrates with FEMA's National Flood Hazard Layer (NFHL) and 
 * Flood Insurance Rate Maps (FIRM) to provide comprehensive flood risk data
 * 
 * APIs Used:
 * - FEMA NFHL REST Services
 * - FEMA Disaster Declarations API
 * - National Weather Service Flood Data
 */
export class FemaFloodService {
  private logger: Logger;
  private baseUrl: string;
  private disasterApiUrl: string;

  constructor() {
    this.logger = new Logger();
    // FEMA National Flood Hazard Layer REST Service
    this.baseUrl = 'https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer';
    // FEMA Disaster Declarations API
    this.disasterApiUrl = 'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries';
  }

  /**
   * Get comprehensive flood risk data for a location
   */
  async getFloodRiskData(coordinates: Coordinates): Promise<FloodRiskData> {
    try {
      this.logger.info('Fetching FEMA flood risk data', { coordinates });

      const [floodZoneData, historicalFloods, damRiskData] = await Promise.allSettled([
        this.getFloodZoneInfo(coordinates),
        this.getHistoricalFloodEvents(coordinates),
        this.getNearbyDamRisk(coordinates)
      ]);

      const floodZone = this.extractResult(floodZoneData);
      const floodEvents = this.extractResult(historicalFloods, []) || [];
      const damRisk = this.extractResult(damRiskData);

      // Calculate flood risk score based on zone and history
      const floodRiskScore = this.calculateFloodRiskScore(floodZone, floodEvents);
      
      // Determine insurance requirements
      const floodInsuranceRequired = this.isFloodInsuranceRequired(floodZone?.zone);
      const lastMajorFlood = this.getLastMajorFlood(floodEvents);

      return {
        femaFloodZone: floodZone?.zone || null,
        baseFloodElevation: floodZone?.baseFloodElevation,
        floodInsuranceRequired,
        floodRiskScore,
        annualFloodProbability: this.calculateAnnualFloodProbability(floodZone?.zone),
        historicalFloodEvents: floodEvents,

        firmPanelNumber: floodZone?.firmPanel,
        firmEffectiveDate: floodZone?.effectiveDate,
        coastalRisk: this.isCoastalFloodZone(floodZone?.zone),
        leveeProtection: floodZone?.leveeProtection || false,
        ...(lastMajorFlood && { lastMajorFlood }),
        ...(damRisk && { damProximity: damRisk })
      };

    } catch (error) {
      this.logger.error('Failed to fetch FEMA flood risk data', { error, coordinates });
      
      // Return default risk assessment
      return {
        femaFloodZone: null,
        floodInsuranceRequired: false,
        floodRiskScore: 5, // Medium risk when data unavailable
        annualFloodProbability: 1.0, // 1% default
        historicalFloodEvents: [],
        coastalRisk: false,
        leveeProtection: false
      };
    }
  }

  /**
   * Get FEMA disaster history for a location
   */
  async getDisasterHistory(coordinates: Coordinates): Promise<FemaDisaster[]> {
    try {
      this.logger.info('Fetching FEMA disaster history', { coordinates });

      // Get county FIPS code for disaster lookup
      const county = await this.getCountyFromCoordinates(coordinates);
      if (!county) {
        return [];
      }

      const response = await fetch(
        `${this.disasterApiUrl}?$filter=fipsStateCode eq '${county.stateFips}' and fipsCountyCode eq '${county.countyFips}'&$orderby=declarationDate desc&$top=50`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'AppraisalManagementPlatform/1.0'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`FEMA API error: ${response.status}`);
      }

      const data = await response.json();
      
      return data.DisasterDeclarationsSummaries?.map((disaster: any) => ({
        disasterNumber: disaster.disasterNumber,
        declarationType: disaster.declarationType,
        declarationDate: new Date(disaster.declarationDate),
        disasterType: disaster.incidentType,
        affectedAreas: [disaster.designatedArea],
        federalFunding: disaster.totalObligatedAmountPa || 0
      })) || [];

    } catch (error) {
      this.logger.error('Failed to fetch FEMA disaster history', { error, coordinates });
      return [];
    }
  }

  // ===============================
  // Private Helper Methods
  // ===============================

  /**
   * Get flood zone information from FEMA NFHL
   */
  private async getFloodZoneInfo(coordinates: Coordinates): Promise<any> {
    const { latitude, longitude } = coordinates;
    
    // FEMA NFHL MapServer identify request
    const params = new URLSearchParams({
      geometry: `${longitude},${latitude}`,
      geometryType: 'esriGeometryPoint',
      layers: 'all:28', // Flood hazard areas layer
      sr: '4326', // WGS84
      f: 'json',
      returnGeometry: 'false',
      tolerance: '1',
      mapExtent: `${longitude-0.01},${latitude-0.01},${longitude+0.01},${latitude+0.01}`
    });

    const response = await fetch(`${this.baseUrl}/identify?${params}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AppraisalManagementPlatform/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`FEMA NFHL API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const floodData = data.results[0].attributes;
      
      return {
        zone: this.mapFemaFloodZone(floodData.FLD_ZONE),
        baseFloodElevation: floodData.STATIC_BFE,
        firmPanel: floodData.FIRM_PAN,
        effectiveDate: floodData.EFF_DATE ? new Date(floodData.EFF_DATE) : undefined,
        leveeProtection: floodData.AR_REVERT === 'LeveeProtected'
      };
    }

    return null;
  }

  /**
   * Get historical flood events for the area
   */
  private async getHistoricalFloodEvents(coordinates: Coordinates): Promise<FloodEvent[]> {
    // In a real implementation, this would query NOAA/NWS historical flood data
    // For now, return mock data based on flood zone severity
    
    const mockEvents: FloodEvent[] = [
      {
        date: new Date('2019-09-15'),
        severity: 'moderate',
        waterLevel: 3.2,
        femaDeclaration: 'DR-4468',
        damageEstimate: 2500000
      },
      {
        date: new Date('2016-04-10'),
        severity: 'minor',
        waterLevel: 1.8,
        damageEstimate: 850000
      }
    ];

    return mockEvents;
  }

  /**
   * Get nearby dam risk information
   */
  private async getNearbyDamRisk(coordinates: Coordinates): Promise<DamRisk | undefined> {
    // In a real implementation, this would query the National Inventory of Dams
    // Mock implementation for now
    
    // Simulate dam proximity check
    const hasNearbyDam = Math.random() > 0.7; // 30% chance of nearby dam
    
    if (hasNearbyDam) {
      return {
        distanceMiles: 2.3,
        damName: 'Example Dam',
        hazardClassification: 'significant',
        lastInspection: new Date('2023-06-15')
      };
    }

    return undefined;
  }

  /**
   * Get county information from coordinates for disaster lookup
   */
  private async getCountyFromCoordinates(coordinates: Coordinates): Promise<{stateFips: string, countyFips: string} | null> {
    // This would typically use Census Geocoding API or similar
    // Mock implementation for now
    return {
      stateFips: '06', // California example
      countyFips: '037' // Los Angeles County example
    };
  }

  /**
   * Map FEMA flood zone codes to our enum values
   */
  private mapFemaFloodZone(femaZone: string): FloodZone | null {
    if (!femaZone) return null;
    
    const zoneMap: Record<string, FloodZone> = {
      'A': 'A',
      'AE': 'AE',
      'AH': 'AH',
      'AO': 'AO',
      'AR': 'AR',
      'VE': 'VE',
      'V': 'VE', // Map V to VE
      'X': 'X',
      'X500': 'X', // Map X500 to X
      'D': 'D'
    };

    return zoneMap[femaZone.toUpperCase()] || null;
  }

  /**
   * Calculate flood risk score based on zone and historical events
   */
  private calculateFloodRiskScore(floodZone: any, events: FloodEvent[]): number {
    let score = 5; // Default medium risk

    // Adjust based on flood zone
    if (floodZone?.zone) {
      switch (floodZone.zone) {
        case 'VE':
        case 'V':
          score = 9; // Very high risk - coastal flooding
          break;
        case 'AE':
        case 'A':
          score = 8; // High risk - 1% annual chance
          break;
        case 'AH':
        case 'AO':
          score = 7; // High risk - shallow flooding
          break;
        case 'AR':
          score = 6; // Moderate-high risk - levee protection
          break;
        case 'X':
          score = 3; // Low-moderate risk
          break;
        case 'D':
          score = 5; // Unknown risk
          break;
      }
    }

    // Adjust based on historical events
    const recentEvents = events.filter(e => 
      new Date().getFullYear() - e.date.getFullYear() <= 10
    );

    if (recentEvents.length > 2) {
      score = Math.min(10, score + 1); // Increase risk for frequent events
    }

    const majorEvents = events.filter(e => 
      e.severity === 'major' || e.severity === 'catastrophic'
    );
    
    if (majorEvents.length > 0) {
      score = Math.min(10, score + 1); // Increase risk for major historical events
    }

    return Math.max(1, Math.min(10, score)); // Clamp between 1-10
  }

  /**
   * Calculate annual flood probability percentage
   */
  private calculateAnnualFloodProbability(floodZone: FloodZone | null): number {
    const probabilities: Record<FloodZone, number> = {
      'VE': 1.0, // 1% annual chance
      'A': 1.0,  // 1% annual chance
      'AE': 1.0, // 1% annual chance
      'AH': 1.0, // 1% annual chance
      'AO': 1.0, // 1% annual chance
      'AR': 1.0, // 1% annual chance (with levee)
      'X': 0.2,  // 0.2% annual chance
      'D': 0.5   // Unknown, assume moderate
    };

    return floodZone ? probabilities[floodZone] : 0.5;
  }

  /**
   * Determine if flood insurance is required
   */
  private isFloodInsuranceRequired(floodZone: FloodZone | null): boolean {
    // FEMA requires flood insurance for mortgages in Special Flood Hazard Areas (SFHA)
    const sfhaZones: FloodZone[] = ['A', 'AE', 'AH', 'AO', 'AR', 'VE'];
    return floodZone ? sfhaZones.includes(floodZone) : false;
  }

  /**
   * Check if flood zone is coastal
   */
  private isCoastalFloodZone(floodZone: FloodZone | null): boolean {
    return floodZone === 'VE';
  }

  /**
   * Get the date of the last major flood event
   */
  private getLastMajorFlood(events: FloodEvent[]): Date | undefined {
    const majorEvents = events
      .filter(e => e.severity === 'major' || e.severity === 'catastrophic')
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    
    return majorEvents.length > 0 ? majorEvents[0]?.date : undefined;
  }

  /**
   * Extract result from Promise.allSettled with fallback
   */
  private extractResult<T>(result: PromiseSettledResult<T>, fallback?: T): T | undefined {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      this.logger.warn('Promise rejected in FEMA service', { error: result.reason });
      return fallback;
    }
  }
}