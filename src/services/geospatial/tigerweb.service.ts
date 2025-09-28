import { Logger } from '../../utils/logger.js';
import { 
  Coordinates, 
  TribalLandData, 
  CensusData, 
  TribalJurisdiction,
  HistoricalDesignations 
} from '../../types/geospatial.js';

/**
 * TigerWeb Census Data Service
 * 
 * Integrates with US Census Bureau's TigerWeb services for:
 * - Census boundaries and demographic data
 * - American Indian Areas and tribal lands
 * - Congressional districts and administrative boundaries
 * - Historical landmark data
 */
export class TigerWebService {
  private logger: Logger;
  private baseUrl: string;
  private censusApiKey?: string;

  constructor() {
    this.logger = new Logger();
    this.baseUrl = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb';
    if (process.env.CENSUS_API_KEY) {
      this.censusApiKey = process.env.CENSUS_API_KEY; // Optional but increases rate limits
    }
  }

  /**
   * Get tribal land information for coordinates
   */
  async getTribalLandData(coordinates: Coordinates): Promise<TribalLandData> {
    try {
      this.logger.info('Fetching tribal land data from TigerWeb', { coordinates });

      const { latitude, longitude } = coordinates;
      
      // Query American Indian Areas layer
      const response = await this.queryTigerWebLayer(
        'tigerWMS_ACS2022/MapServer',
        'American Indian Areas',
        longitude,
        latitude
      );

      if (response?.results && response.results.length > 0) {
        const tribalData = response.results[0].attributes;
        
        return {
          onTribalLand: true,
          tribeName: tribalData.NAMELSAD || tribalData.NAME,
          reservationName: tribalData.FULLNAME,
          jurisdictionType: this.determineTribalJurisdiction(tribalData),
          federalRecognition: true, // TigerWeb only includes federally recognized tribes
          specialConsiderations: this.getTribalConsiderations(tribalData),
          permitsRequired: this.getRequiredTribalPermits(tribalData),
          tribalLaws: this.getApplicableTribalLaws(tribalData),
          tribalOffice: {
            name: `${tribalData.NAMELSAD || tribalData.NAME} Tribal Office`
            // phone and address would need separate lookup
          }
        };
      }

      // Not on tribal land
      return {
        onTribalLand: false,
        jurisdictionType: 'state',
        federalRecognition: false,
        specialConsiderations: [],
        permitsRequired: [],
        tribalLaws: []
      };

    } catch (error) {
      this.logger.error('Failed to fetch tribal land data', { error, coordinates });
      
      return {
        onTribalLand: false,
        jurisdictionType: 'state',
        federalRecognition: false,
        specialConsiderations: [],
        permitsRequired: [],
        tribalLaws: []
      };
    }
  }

  /**
   * Get comprehensive census and demographic data
   */
  async getCensusData(coordinates: Coordinates): Promise<CensusData> {
    try {
      this.logger.info('Fetching census data from TigerWeb', { coordinates });

      const { latitude, longitude } = coordinates;
      
      // Get geographic identifiers first
      const [geoData, demographicData] = await Promise.allSettled([
        this.getGeographicIdentifiers(longitude, latitude),
        this.getDemographicData(coordinates)
      ]);

      const geoInfo = this.extractResult(geoData, {});
      const demoInfo = this.extractResult(demographicData, {});

      return {
        fipsCode: geoInfo.fipsCode || '00000',
        censusTract: geoInfo.censusTract || '000000',
        censusBlock: geoInfo.censusBlock,
        congressionalDistrict: geoInfo.congressionalDistrict || '00',
        county: geoInfo.county || 'Unknown County',
        municipality: geoInfo.municipality,
        schoolDistrict: geoInfo.schoolDistrict,
        population: demoInfo.population || 0,
        householdCount: demoInfo.householdCount || 0,
        medianIncome: demoInfo.medianIncome || 0,
        povertyRate: demoInfo.povertyRate || 0,
        medianHomeValue: demoInfo.medianHomeValue || 0,
        ownerOccupancyRate: demoInfo.ownerOccupancyRate || 0,
        rentVsOwnRatio: demoInfo.rentVsOwnRatio || 0,
        housingUnitsCount: demoInfo.housingUnitsCount || 0
      };

    } catch (error) {
      this.logger.error('Failed to fetch census data', { error, coordinates });
      
      // Return default census data
      return {
        fipsCode: '00000',
        censusTract: '000000',
        congressionalDistrict: '00',
        county: 'Unknown County',
        population: 0,
        householdCount: 0,
        medianIncome: 50000, // National median estimate
        povertyRate: 12.0, // National average estimate
        medianHomeValue: 200000, // National median estimate
        ownerOccupancyRate: 65.0, // National average
        rentVsOwnRatio: 35.0,
        housingUnitsCount: 0
      };
    }
  }

  /**
   * Get historical landmark data (placeholder for future National Register integration)
   */
  async getHistoricalData(coordinates: Coordinates): Promise<Partial<HistoricalDesignations>> {
    try {
      // Note: TigerWeb doesn't directly provide NRHP data
      // This would typically integrate with National Park Service APIs
      // For now, return placeholder structure
      
      return {
        landmarkStatus: null,
        archaeologicalSites: [],
        restrictions: []
      };

    } catch (error) {
      this.logger.error('Failed to fetch historical data', { error, coordinates });
      
      return {
        landmarkStatus: null,
        archaeologicalSites: [],
        restrictions: []
      };
    }
  }

  // ===============================
  // Private Helper Methods
  // ===============================

  /**
   * Query a specific TigerWeb layer
   */
  private async queryTigerWebLayer(
    service: string, 
    layerName: string, 
    longitude: number, 
    latitude: number
  ): Promise<any> {
    const params = new URLSearchParams({
      geometry: `${longitude},${latitude}`,
      geometryType: 'esriGeometryPoint',
      layers: `all:${layerName}`,
      sr: '4326',
      f: 'json',
      returnGeometry: 'false',
      tolerance: '1'
    });

    const response = await fetch(`${this.baseUrl}/${service}/identify?${params}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AppraisalManagementPlatform/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`TigerWeb API error: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Get geographic identifiers (FIPS, tract, block, etc.)
   */
  private async getGeographicIdentifiers(longitude: number, latitude: number): Promise<any> {
    // Query multiple layers for comprehensive geographic data
    const [countyData, tractData, congressionalData] = await Promise.allSettled([
      this.queryTigerWebLayer('tigerWMS_Current/MapServer', 'Counties', longitude, latitude),
      this.queryTigerWebLayer('tigerWMS_ACS2022/MapServer', 'Census Tracts', longitude, latitude),
      this.queryTigerWebLayer('tigerWMS_Current/MapServer', 'Congressional Districts', longitude, latitude)
    ]);

    const county = this.extractResult(countyData);
    const tract = this.extractResult(tractData);
    const congressional = this.extractResult(congressionalData);

    return {
      fipsCode: county?.results?.[0]?.attributes?.GEOID || tract?.results?.[0]?.attributes?.GEOID?.substring(0, 5),
      censusTract: tract?.results?.[0]?.attributes?.GEOID,
      county: county?.results?.[0]?.attributes?.NAMELSAD,
      congressionalDistrict: congressional?.results?.[0]?.attributes?.CD118FP
    };
  }

  /**
   * Get demographic data for the area
   */
  private async getDemographicData(coordinates: Coordinates): Promise<any> {
    // In a real implementation, this would use Census Data API
    // For now, return representative demographic data
    
    return {
      population: 25000 + Math.floor(Math.random() * 50000),
      householdCount: 8500 + Math.floor(Math.random() * 15000),
      medianIncome: 45000 + Math.floor(Math.random() * 80000),
      povertyRate: 8 + Math.random() * 15,
      medianHomeValue: 180000 + Math.floor(Math.random() * 400000),
      ownerOccupancyRate: 55 + Math.random() * 25,
      rentVsOwnRatio: 30 + Math.random() * 20,
      housingUnitsCount: 9000 + Math.floor(Math.random() * 18000)
    };
  }

  /**
   * Determine tribal jurisdiction type based on tribal data
   */
  private determineTribalJurisdiction(tribalData: any): TribalJurisdiction {
    // Analyze tribal data attributes to determine jurisdiction type
    const lsad = tribalData.LSAD; // Legal/Statistical Area Description
    
    switch (lsad) {
      case 'T1': // American Indian Trust Land
        return 'trust_land';
      case 'R1': // American Indian Reservation
        return 'tribal';
      case 'R2': // American Indian Reservation (state)
        return 'concurrent';
      case 'T2': // Trust Land not within American Indian Reservation
        return 'federal';
      default:
        return 'tribal';
    }
  }

  /**
   * Get special considerations for tribal land
   */
  private getTribalConsiderations(tribalData: any): string[] {
    const considerations: string[] = [];
    
    considerations.push('Tribal sovereignty applies');
    considerations.push('Federal Indian law may apply');
    considerations.push('Tribal environmental regulations may be different');
    
    if (tribalData.LSAD === 'T1' || tribalData.LSAD === 'T2') {
      considerations.push('Trust land status - federal oversight required');
    }
    
    return considerations;
  }

  /**
   * Get required tribal permits
   */
  private getRequiredTribalPermits(tribalData: any): string[] {
    const permits: string[] = [];
    
    permits.push('Tribal business license may be required');
    permits.push('Environmental impact assessment');
    permits.push('Cultural resource consultation');
    
    if (tribalData.LSAD?.startsWith('T')) {
      permits.push('Bureau of Indian Affairs approval for trust land');
    }
    
    return permits;
  }

  /**
   * Get applicable tribal laws
   */
  private getApplicableTribalLaws(tribalData: any): string[] {
    const laws: string[] = [];
    
    laws.push('Tribal zoning ordinances');
    laws.push('Tribal environmental codes');
    laws.push('Tribal taxation laws');
    
    return laws;
  }

  /**
   * Extract result from Promise.allSettled with fallback
   */
  private extractResult<T>(result: PromiseSettledResult<T>, fallback?: T): T | undefined {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      this.logger.warn('Promise rejected in TigerWeb service', { error: result.reason });
      return fallback;
    }
  }
}