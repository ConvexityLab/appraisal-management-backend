import { Logger } from '../utils/logger.js';

/**
 * Bridge Interactive MLS Data Service
 * Provides access to MLS listings, public records, and market data via RESO Web API
 * Documentation: https://bridgedataoutput.com/docs/platform/
 */
export class BridgeInteractiveService {
  private readonly logger: Logger;
  private readonly baseUrl: string;
  private readonly publicDataBaseUrl: string;
  private readonly zestimatesBaseUrl: string;
  private readonly econDataBaseUrl: string;
  private readonly reviewsBaseUrl: string;
  private readonly serverToken?: string;
  private readonly testDatasetId = 'test';

  constructor() {
    this.logger = new Logger();
    this.baseUrl = 'https://api.bridgedataoutput.com/api/v2/OData';
    this.publicDataBaseUrl = 'https://api.bridgedataoutput.com/api/v2/pub';
    this.zestimatesBaseUrl = 'https://api.bridgedataoutput.com/api/v2/zestimates_v2';
    this.econDataBaseUrl = 'https://api.bridgedataoutput.com/api/v2/zgecon';
    this.reviewsBaseUrl = 'https://api.bridgedataoutput.com/api/v2/OData/reviews';
    this.serverToken = process.env.BRIDGE_SERVER_TOKEN || '';

    if (!this.serverToken) {
      this.logger.warn('BRIDGE_SERVER_TOKEN not configured, using test dataset only');
    }
  }

  /**
   * Get active residential listings near a location
   */
  async getActiveListings(params: {
    latitude: number;
    longitude: number;
    radiusMiles?: number;
    minPrice?: number;
    maxPrice?: number;
    propertyType?: string;
    limit?: number;
    datasetId?: string;
  }): Promise<any> {
    try {
      const {
        latitude,
        longitude,
        radiusMiles = 0.5,
        minPrice,
        maxPrice,
        propertyType = 'Residential',
        limit = 50,
        datasetId = this.testDatasetId,
      } = params;

      // Build OData filter
      const filters: string[] = [
        `StandardStatus eq 'Active'`,
        `PropertyType eq '${propertyType}'`,
        `geo.distance(Coordinates, POINT(${longitude} ${latitude})) lt ${radiusMiles}`,
      ];

      if (minPrice) {
        filters.push(`ListPrice ge ${minPrice}`);
      }
      if (maxPrice) {
        filters.push(`ListPrice le ${maxPrice}`);
      }

      const filterString = filters.join(' and ');
      const url = `${this.baseUrl}/${datasetId}/Property?$filter=${encodeURIComponent(filterString)}&$top=${limit}&$orderby=ListPrice desc`;

      const response = await this.makeRequest(url);
      return this.parseResponse(response);
    } catch (error) {
      this.logger.error('Failed to get active listings', { error, params });
      throw error;
    }
  }

  /**
   * Get sold comparables (comps) for property valuation
   */
  async getSoldComps(params: {
    latitude: number;
    longitude: number;
    radiusMiles?: number;
    minPrice?: number;
    maxPrice?: number;
    minBeds?: number;
    maxBeds?: number;
    minBaths?: number;
    maxBaths?: number;
    minSqft?: number;
    maxSqft?: number;
    soldWithinDays?: number;
    propertyType?: string;
    limit?: number;
    datasetId?: string;
  }): Promise<any> {
    try {
      const {
        latitude,
        longitude,
        radiusMiles = 0.5,
        minPrice,
        maxPrice,
        minBeds,
        maxBeds,
        minBaths,
        maxBaths,
        minSqft,
        maxSqft,
        soldWithinDays = 180,
        propertyType = 'Residential',
        limit = 25,
        datasetId = this.testDatasetId,
      } = params;

      // Calculate date threshold
      const closeDate = new Date();
      closeDate.setDate(closeDate.getDate() - soldWithinDays);
      const closeDateStr = closeDate.toISOString().split('T')[0];

      // Build comprehensive filter
      const filters: string[] = [
        `StandardStatus eq 'Closed'`,
        `PropertyType eq '${propertyType}'`,
        `geo.distance(Coordinates, POINT(${longitude} ${latitude})) lt ${radiusMiles}`,
        `CloseDate ge ${closeDateStr}`,
      ];

      if (minPrice) filters.push(`ClosePrice ge ${minPrice}`);
      if (maxPrice) filters.push(`ClosePrice le ${maxPrice}`);
      if (minBeds) filters.push(`BedroomsTotal ge ${minBeds}`);
      if (maxBeds) filters.push(`BedroomsTotal le ${maxBeds}`);
      if (minBaths) filters.push(`BathroomsTotalDecimal ge ${minBaths}`);
      if (maxBaths) filters.push(`BathroomsTotalDecimal le ${maxBaths}`);
      if (minSqft) filters.push(`LivingArea ge ${minSqft}`);
      if (maxSqft) filters.push(`LivingArea le ${maxSqft}`);

      const filterString = filters.join(' and ');
      
      // Select most relevant fields for comps
      const selectFields = [
        'ListingKey',
        'ListingId',
        'UnparsedAddress',
        'City',
        'StateOrProvince',
        'PostalCode',
        'Coordinates',
        'ClosePrice',
        'CloseDate',
        'BedroomsTotal',
        'BathroomsTotalDecimal',
        'LivingArea',
        'LotSizeArea',
        'YearBuilt',
        'PropertyType',
        'PropertySubType',
      ].join(',');

      const url = `${this.baseUrl}/${datasetId}/Property?$filter=${encodeURIComponent(filterString)}&$select=${selectFields}&$top=${limit}&$orderby=CloseDate desc`;

      const response = await this.makeRequest(url);
      return this.parseResponse(response);
    } catch (error) {
      this.logger.error('Failed to get sold comps', { error, params });
      throw error;
    }
  }

  /**
   * Search properties by address
   */
  async searchByAddress(params: {
    address: string;
    datasetId?: string;
  }): Promise<any> {
    try {
      const { address, datasetId = this.testDatasetId } = params;

      // Use tolower for case-insensitive search
      const filter = `tolower(UnparsedAddress) eq '${address.toLowerCase()}'`;
      const url = `${this.baseUrl}/${datasetId}/Property?$filter=${encodeURIComponent(filter)}`;

      const response = await this.makeRequest(url);
      return this.parseResponse(response);
    } catch (error) {
      this.logger.error('Failed to search by address', { error, params });
      throw error;
    }
  }

  /**
   * Get property by ListingKey
   */
  async getPropertyByKey(params: {
    listingKey: string;
    datasetId?: string;
    includeMedia?: boolean;
  }): Promise<any> {
    try {
      const { listingKey, datasetId = this.testDatasetId, includeMedia = true } = params;

      let url = `${this.baseUrl}/${datasetId}/Property('${listingKey}')`;
      
      if (!includeMedia) {
        url += '?$unselect=Media';
      }

      const response = await this.makeRequest(url);
      return response;
    } catch (error) {
      this.logger.error('Failed to get property by key', { error, params });
      throw error;
    }
  }

  /**
   * Get market statistics for an area
   */
  async getMarketStats(params: {
    latitude: number;
    longitude: number;
    radiusMiles?: number;
    propertyType?: string;
    datasetId?: string;
  }): Promise<any> {
    try {
      const {
        latitude,
        longitude,
        radiusMiles = 1.0,
        propertyType = 'Residential',
        datasetId = this.testDatasetId,
      } = params;

      // Get active listings
      const activeFilter = `StandardStatus eq 'Active' and PropertyType eq '${propertyType}' and geo.distance(Coordinates, POINT(${longitude} ${latitude})) lt ${radiusMiles}`;
      const activeUrl = `${this.baseUrl}/${datasetId}/Property?$filter=${encodeURIComponent(activeFilter)}&$select=ListPrice,DaysOnMarket,LivingArea&$top=200`;

      // Get recent sales (last 90 days)
      const soldDate = new Date();
      soldDate.setDate(soldDate.getDate() - 90);
      const soldDateStr = soldDate.toISOString().split('T')[0];
      const soldFilter = `StandardStatus eq 'Closed' and PropertyType eq '${propertyType}' and CloseDate ge ${soldDateStr} and geo.distance(Coordinates, POINT(${longitude} ${latitude})) lt ${radiusMiles}`;
      const soldUrl = `${this.baseUrl}/${datasetId}/Property?$filter=${encodeURIComponent(soldFilter)}&$select=ClosePrice,CloseDate,DaysOnMarket,LivingArea&$top=200`;

      const [activeResponse, soldResponse] = await Promise.all([
        this.makeRequest(activeUrl),
        this.makeRequest(soldUrl),
      ]);

      const activeListings = this.parseResponse(activeResponse);
      const soldListings = this.parseResponse(soldResponse);

      return this.calculateMarketStats(activeListings, soldListings);
    } catch (error) {
      this.logger.error('Failed to get market stats', { error, params });
      throw error;
    }
  }

  /**
   * Get listing agent/member information
   */
  async getMemberInfo(params: {
    memberKey: string;
    datasetId?: string;
  }): Promise<any> {
    try {
      const { memberKey, datasetId = this.testDatasetId } = params;

      const url = `${this.baseUrl}/${datasetId}/Member('${memberKey}')`;
      const response = await this.makeRequest(url);
      return response;
    } catch (error) {
      this.logger.error('Failed to get member info', { error, params });
      throw error;
    }
  }

  /**
   * Get office information
   */
  async getOfficeInfo(params: {
    officeKey: string;
    datasetId?: string;
  }): Promise<any> {
    try {
      const { officeKey, datasetId = this.testDatasetId } = params;

      const url = `${this.baseUrl}/${datasetId}/Office('${officeKey}')`;
      const response = await this.makeRequest(url);
      return response;
    } catch (error) {
      this.logger.error('Failed to get office info', { error, params });
      throw error;
    }
  }

  /**
   * Get available datasets for the authenticated application
   */
  async getAvailableDatasets(): Promise<any> {
    try {
      const url = `${this.baseUrl}/DataSystem`;
      const response = await this.makeRequest(url);
      return this.parseResponse(response);
    } catch (error) {
      this.logger.error('Failed to get available datasets', { error });
      throw error;
    }
  }

  /**
   * Get metadata for a dataset (fields and lookup values)
   */
  async getMetadata(datasetId: string = this.testDatasetId): Promise<any> {
    try {
      const url = `${this.baseUrl}/${datasetId}/$metadata`;
      const response = await fetch(url, {
        headers: this.buildHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Metadata request failed: ${response.status} ${response.statusText}`);
      }

      // Metadata is returned as XML
      const xml = await response.text();
      return xml;
    } catch (error) {
      this.logger.error('Failed to get metadata', { error, datasetId });
      throw error;
    }
  }

  /**
   * Make authenticated request to Bridge API
   */
  private async makeRequest(url: string): Promise<any> {
    try {
      const response = await fetch(url, {
        headers: this.buildHeaders(),
      });

      // Check rate limits
      const rateLimitRemaining = response.headers.get('Application-RateLimit-Remaining');
      const burstRateLimitRemaining = response.headers.get('Burst-RateLimit-Remaining');
      
      if (rateLimitRemaining && parseInt(rateLimitRemaining) < 100) {
        this.logger.warn('Approaching Bridge API rate limit', { rateLimitRemaining, burstRateLimitRemaining });
      }

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Bridge API error: ${response.status} ${response.statusText} - ${errorBody}`);
      }

      return await response.json();
    } catch (error) {
      this.logger.error('Bridge API request failed', { error, url });
      throw error;
    }
  }

  /**
   * Build authorization headers
   */
  private buildHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Accept': 'application/json',
    };

    if (this.serverToken) {
      headers['Authorization'] = `Bearer ${this.serverToken}`;
    }

    return headers;
  }

  /**
   * Parse OData response and extract value array
   */
  private parseResponse(response: any): any[] {
    if (response && response.value && Array.isArray(response.value)) {
      return response.value;
    }
    return [];
  }

  /**
   * Calculate market statistics from listings
   */
  private calculateMarketStats(activeListings: any[], soldListings: any[]): any {
    const stats: any = {
      activeCount: activeListings.length,
      soldCount: soldListings.length,
      active: {},
      sold: {},
    };

    // Active listings stats
    if (activeListings.length > 0) {
      const activePrices = activeListings.map(l => l.ListPrice).filter(p => p > 0);
      const activeDom = activeListings.map(l => l.DaysOnMarket).filter(d => d > 0);

      stats.active = {
        medianListPrice: this.calculateMedian(activePrices),
        averageListPrice: this.calculateAverage(activePrices),
        minListPrice: Math.min(...activePrices),
        maxListPrice: Math.max(...activePrices),
        averageDaysOnMarket: this.calculateAverage(activeDom),
      };
    }

    // Sold listings stats
    if (soldListings.length > 0) {
      const soldPrices = soldListings.map(l => l.ClosePrice).filter(p => p > 0);
      const soldDom = soldListings.map(l => l.DaysOnMarket).filter(d => d > 0);

      stats.sold = {
        medianSalePrice: this.calculateMedian(soldPrices),
        averageSalePrice: this.calculateAverage(soldPrices),
        minSalePrice: Math.min(...soldPrices),
        maxSalePrice: Math.max(...soldPrices),
        averageDaysOnMarket: this.calculateAverage(soldDom),
      };

      // Calculate price per square foot if available
      const pricePerSqft = soldListings
        .filter(l => l.ClosePrice > 0 && l.LivingArea > 0)
        .map(l => l.ClosePrice / l.LivingArea);

      if (pricePerSqft.length > 0) {
        stats.sold.averagePricePerSqft = this.calculateAverage(pricePerSqft);
        stats.sold.medianPricePerSqft = this.calculateMedian(pricePerSqft);
      }
    }

    return stats;
  }

  /**
   * Calculate median of number array
   */
  private calculateMedian(arr: number[]): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? ((sorted[mid - 1] || 0) + (sorted[mid] || 0)) / 2 
      : (sorted[mid] || 0);
  }

  /**
   * Calculate average of number array
   */
  private calculateAverage(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
  }

  // ==================================================================================
  // PUBLIC RECORDS API (Zillow Group Data - 148M+ properties)
  // ==================================================================================

  /**
   * Search parcels by address or coordinates
   */
  async searchParcels(params: {
    address?: string;
    apn?: string;
    zpid?: string;
    latitude?: number;
    longitude?: number;
    limit?: number;
  }): Promise<any> {
    try {
      const { address, apn, zpid, latitude, longitude, limit = 25 } = params;

      let url = `${this.publicDataBaseUrl}/parcels?limit=${limit}`;

      if (address) {
        url += `&address.full=${encodeURIComponent(address)}`;
      }
      if (apn) {
        url += `&apn=${encodeURIComponent(apn)}`;
      }
      if (zpid) {
        url += `&zpid=${zpid}`;
      }
      if (latitude && longitude) {
        url += `&near=${longitude},${latitude}`;
      }

      const response = await this.makeRequest(url);
      return response;
    } catch (error) {
      this.logger.error('Failed to search parcels', { error, params });
      throw error;
    }
  }

  /**
   * Get parcel details by ID
   */
  async getParcelById(parcelId: string): Promise<any> {
    try {
      const url = `${this.publicDataBaseUrl}/parcels/${parcelId}`;
      const response = await this.makeRequest(url);
      return response;
    } catch (error) {
      this.logger.error('Failed to get parcel', { error, parcelId });
      throw error;
    }
  }

  /**
   * Get tax assessments for a parcel
   */
  async getParcelAssessments(parcelId: string): Promise<any> {
    try {
      const url = `${this.publicDataBaseUrl}/parcels/${parcelId}/assessments`;
      const response = await this.makeRequest(url);
      return response;
    } catch (error) {
      this.logger.error('Failed to get assessments', { error, parcelId });
      throw error;
    }
  }

  /**
   * Get transaction history for a parcel
   */
  async getParcelTransactions(parcelId: string): Promise<any> {
    try {
      const url = `${this.publicDataBaseUrl}/parcels/${parcelId}/transactions`;
      const response = await this.makeRequest(url);
      return response;
    } catch (error) {
      this.logger.error('Failed to get transactions', { error, parcelId });
      throw error;
    }
  }

  /**
   * Search assessments by address or filters
   */
  async searchAssessments(params: {
    address?: string;
    zpid?: string;
    year?: number;
    minValue?: number;
    maxValue?: number;
    limit?: number;
  }): Promise<any> {
    try {
      const { address, zpid, year, minValue, maxValue, limit = 25 } = params;

      let url = `${this.publicDataBaseUrl}/assessments?limit=${limit}`;

      if (address) {
        url += `&address.full=${encodeURIComponent(address)}`;
      }
      if (zpid) {
        url += `&zpid=${zpid}`;
      }
      if (year) {
        url += `&year=${year}`;
      }
      if (minValue) {
        url += `&assessedValue.gte=${minValue}`;
      }
      if (maxValue) {
        url += `&assessedValue.lte=${maxValue}`;
      }

      const response = await this.makeRequest(url);
      return response;
    } catch (error) {
      this.logger.error('Failed to search assessments', { error, params });
      throw error;
    }
  }

  /**
   * Search transactions by filters
   */
  async searchTransactions(params: {
    address?: string;
    zpid?: string;
    startDate?: string;
    endDate?: string;
    minPrice?: number;
    maxPrice?: number;
    limit?: number;
  }): Promise<any> {
    try {
      const { address, zpid, startDate, endDate, minPrice, maxPrice, limit = 25 } = params;

      let url = `${this.publicDataBaseUrl}/transactions?limit=${limit}`;

      if (address) {
        url += `&address.full=${encodeURIComponent(address)}`;
      }
      if (zpid) {
        url += `&zpid=${zpid}`;
      }
      if (startDate) {
        url += `&recordingDate.gte=${startDate}`;
      }
      if (endDate) {
        url += `&recordingDate.lte=${endDate}`;
      }
      if (minPrice) {
        url += `&amount.gte=${minPrice}`;
      }
      if (maxPrice) {
        url += `&amount.lte=${maxPrice}`;
      }

      const response = await this.makeRequest(url);
      return response;
    } catch (error) {
      this.logger.error('Failed to search transactions', { error, params });
      throw error;
    }
  }

  // ==================================================================================
  // ZESTIMATES API (Zillow Property Valuations)
  // ==================================================================================

  /**
   * Get Zestimate by address or ZPID
   */
  async getZestimate(params: {
    address?: string;
    zpid?: string | number;
    zpids?: string;
  }): Promise<any> {
    try {
      const { address, zpid, zpids } = params;

      let url = `${this.zestimatesBaseUrl}/zestimates?`;

      if (address) {
        url += `address=${encodeURIComponent(address)}`;
      } else if (zpids) {
        // Multiple ZPIDs comma-separated
        url += `zpid.in=${zpids}`;
      } else if (zpid) {
        url += `zpid=${zpid}`;
      } else {
        throw new Error('Address or ZPID required');
      }

      const response = await this.makeRequest(url);
      return response;
    } catch (error) {
      this.logger.error('Failed to get Zestimate', { error, params });
      throw error;
    }
  }

  // ==================================================================================
  // ZILLOW GROUP ECONOMIC DATA (Market Statistics)
  // ==================================================================================

  /**
   * Get market report for a region
   */
  async getMarketReport(params: {
    stateCodeFIPS?: string;
    regionId?: string;
    metricType?: string;
  }): Promise<any> {
    try {
      const { stateCodeFIPS, regionId, metricType } = params;

      let url = `${this.econDataBaseUrl}/marketreport?`;

      if (stateCodeFIPS) {
        url += `stateCodeFIPS=${stateCodeFIPS}`;
      }
      if (regionId) {
        url += `&regionId=${regionId}`;
      }
      if (metricType) {
        url += `&metricTypeKey=${metricType}`;
      }

      const response = await this.makeRequest(url);
      return response;
    } catch (error) {
      this.logger.error('Failed to get market report', { error, params });
      throw error;
    }
  }

  /**
   * Get region metadata
   */
  async getRegion(params: { stateCodeFIPS?: string; regionId?: string }): Promise<any> {
    try {
      const { stateCodeFIPS, regionId } = params;

      let url = `${this.econDataBaseUrl}/region?`;

      if (stateCodeFIPS) {
        url += `stateCodeFIPS=${stateCodeFIPS}`;
      }
      if (regionId) {
        url += `&regionId=${regionId}`;
      }

      const response = await this.makeRequest(url);
      return response;
    } catch (error) {
      this.logger.error('Failed to get region', { error, params });
      throw error;
    }
  }

  /**
   * Get metric type metadata
   */
  async getMetricType(metricTypeKey?: string): Promise<any> {
    try {
      let url = `${this.econDataBaseUrl}/type`;
      
      if (metricTypeKey) {
        url += `?key=${encodeURIComponent(metricTypeKey)}`;
      }

      const response = await this.makeRequest(url);
      return response;
    } catch (error) {
      this.logger.error('Failed to get metric type', { error, metricTypeKey });
      throw error;
    }
  }

  // ==================================================================================
  // ZILLOW AGENT REVIEWS
  // ==================================================================================

  /**
   * Get all agent reviews
   */
  async getAgentReviews(filters?: {
    revieweeKey?: string;
    revieweeEmail?: string;
    limit?: number;
  }): Promise<any> {
    try {
      let url = `${this.reviewsBaseUrl}/Reviews?`;

      if (filters?.revieweeKey) {
        url += `$filter=RevieweeKey eq '${filters.revieweeKey}'`;
      } else if (filters?.revieweeEmail) {
        url += `$filter=RevieweeEmail eq '${filters.revieweeEmail}'`;
      }

      if (filters?.limit) {
        url += `&$top=${filters.limit}`;
      }

      const response = await this.makeRequest(url);
      return this.parseResponse(response);
    } catch (error) {
      this.logger.error('Failed to get agent reviews', { error, filters });
      throw error;
    }
  }

  /**
   * Get all reviewees (agents with reviews)
   */
  async getReviewees(filters?: {
    email?: string;
    expandReviews?: boolean;
    limit?: number;
  }): Promise<any> {
    try {
      let url = `${this.reviewsBaseUrl}/Reviewees?`;

      if (filters?.email) {
        url += `$filter=RevieweeEmail eq '${filters.email}'`;
      }

      if (filters?.expandReviews) {
        url += `&$expand=Reviews`;
      }

      if (filters?.limit) {
        url += `&$top=${filters.limit}`;
      }

      const response = await this.makeRequest(url);
      return this.parseResponse(response);
    } catch (error) {
      this.logger.error('Failed to get reviewees', { error, filters });
      throw error;
    }
  }
}
