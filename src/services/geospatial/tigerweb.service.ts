import { Logger } from '../../utils/logger';
import { 
  Coordinates, 
  TribalLandData, 
  CensusData, 
  TribalJurisdiction,
  HistoricalDesignations 
} from '../../types/geospatial';

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
    try {
      // Use Census Geocoding API which is more reliable
      const geoUrl = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${longitude}&y=${latitude}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
      
      this.logger.debug('Calling Census Geocoding API for geographic identifiers', { url: geoUrl });
      const response = await fetch(geoUrl);
      
      if (!response.ok) {
        this.logger.warn('Census Geocoding API failed', { status: response.status });
        return {};
      }
      
      const data = await response.json();
      this.logger.debug('Census geocoding response for identifiers', { data });
      
      const block = data.result?.geographies?.['2020 Census Blocks']?.[0];
      const tract = data.result?.geographies?.['Census Tracts']?.[0];
      const county = data.result?.geographies?.['Counties']?.[0];
      const congressional = data.result?.geographies?.['118th Congressional Districts']?.[0];
      
      const result = {
        fipsCode: county?.GEOID || (tract?.GEOID ? tract.GEOID.substring(0, 5) : null),
        censusTract: tract?.GEOID,
        censusBlock: block?.GEOID,
        county: county?.NAME,
        congressionalDistrict: congressional?.BASENAME
      };
      
      this.logger.info('Parsed geographic identifiers', { result });
      return result;
      
    } catch (error) {
      this.logger.error('Failed to fetch geographic identifiers', { error, longitude, latitude });
      return {};
    }
  }

  /**
   * Get demographic data for the area
   */
  private async getDemographicData(coordinates: Coordinates): Promise<any> {
    try {
      // First get census tract for this location
      const geoUrl = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${coordinates.longitude}&y=${coordinates.latitude}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
      
      this.logger.debug('Calling Census Geocoding API', { url: geoUrl });
      const geoResponse = await fetch(geoUrl);
      if (!geoResponse.ok) {
        this.logger.warn('Census Geocoding API failed', { status: geoResponse.status });
        return this.getDefaultDemographics();
      }
      
      const geoData = await geoResponse.json();
      this.logger.debug('Census geocoding response', { geoData });
      
      const tract = geoData.result?.geographies?.['Census Tracts']?.[0];
      
      if (!tract) {
        this.logger.warn('No census tract found for coordinates', { coordinates });
        return this.getDefaultDemographics();
      }
      
      const { STATE, COUNTY, TRACT } = tract;
      this.logger.info('Found census tract', { STATE, COUNTY, TRACT, tractName: tract.NAME });
      
      // Use Census Data API to get ACS 5-Year estimates
      // Variables: B01003_001E (population), B19013_001E (median income), B25077_001E (median home value)
      const apiKey = this.censusApiKey || '';
      const variables = 'B01003_001E,B11001_001E,B19013_001E,B17001_002E,B17001_001E,B25077_001E,B25003_002E,B25003_001E,B25001_001E';
      const dataUrl = `https://api.census.gov/data/2022/acs/acs5?get=NAME,${variables}&for=tract:${TRACT}&in=state:${STATE}+county:${COUNTY}${apiKey ? `&key=${apiKey}` : ''}`;
      
      this.logger.debug('Calling Census Data API', { url: dataUrl });
      const dataResponse = await fetch(dataUrl);
      if (!dataResponse.ok) {
        this.logger.warn('Census Data API failed', { status: dataResponse.status, statusText: dataResponse.statusText });
        return this.getDefaultDemographics();
      }
      
      const censusData = await dataResponse.json();
      this.logger.debug('Census Data API raw response', { censusData });
      
      if (censusData.length < 2) {
        this.logger.warn('Census Data API returned no data', { censusData });
        return this.getDefaultDemographics();
      }
      
      const [headers, values] = censusData;
      const data: any = {};
      headers.forEach((header: string, index: number) => {
        data[header] = values[index];
      });
      
      this.logger.info('Census Data API parsed values', { data });
      
      // Census API returns -666666666 for null/missing values - need to filter these out
      const parseValidNumber = (val: string, defaultVal: number = 0): number => {
        const num = parseInt(val);
        if (isNaN(num) || num < -999999) return defaultVal; // Treat -666666666 as null
        return num;
      };
      
      const population = parseValidNumber(data.B01003_001E);
      const householdCount = parseValidNumber(data.B11001_001E);
      const medianIncome = parseValidNumber(data.B19013_001E);
      const povertyCount = parseValidNumber(data.B17001_002E);
      const povertyTotal = parseValidNumber(data.B17001_001E, 1);
      const medianHomeValue = parseValidNumber(data.B25077_001E);
      const ownerOccupied = parseValidNumber(data.B25003_002E);
      const totalOccupied = parseValidNumber(data.B25003_001E, 1);
      const housingUnits = parseValidNumber(data.B25001_001E);
      
      const result = {
        population,
        householdCount,
        medianIncome,
        povertyRate: povertyTotal > 0 ? (povertyCount / povertyTotal) * 100 : 0,
        medianHomeValue,
        ownerOccupancyRate: totalOccupied > 0 ? (ownerOccupied / totalOccupied) * 100 : 0,
        rentVsOwnRatio: totalOccupied > 0 ? ((totalOccupied - ownerOccupied) / totalOccupied) * 100 : 0,
        housingUnitsCount: housingUnits
      };
      
      this.logger.info('Parsed demographic data', { result });
      return result;
      
    } catch (error) {
      this.logger.error('Failed to fetch Census demographic data', { error, coordinates });
      return this.getDefaultDemographics();
    }
  }
  
  private getDefaultDemographics() {
    return {
      population: 0,
      householdCount: 0,
      medianIncome: 0,
      povertyRate: 0,
      medianHomeValue: 0,
      ownerOccupancyRate: 0,
      rentVsOwnRatio: 0,
      housingUnitsCount: 0
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