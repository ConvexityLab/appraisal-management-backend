/**
 * U.S. Census Bureau Intelligence Service
 * 
 * Comprehensive demographic, economic, and housing analysis using official U.S. Census data
 * Provides hyper-local insights at the block group level for property intelligence
 */

import { Logger } from '../utils/logger.js';
import { GenericCacheService } from './cache/generic-cache.service';
import { Coordinates } from '../types/geospatial.js';
import {
  DemographicIntelligence,
  EconomicIntelligence,
  HousingIntelligence,
  EducationIntelligence,
  MobilityIntelligence,
  CensusGeographicIdentifier,
  CensusDataRequest
} from '../types/property-intelligence.js';

export class CensusIntelligenceService {
  private logger: Logger;
  private cache: GenericCacheService;
  
  // Census API base URLs
  private readonly ACS5_BASE_URL = 'https://api.census.gov/data/2022/acs/acs5';
  private readonly DECENNIAL_BASE_URL = 'https://api.census.gov/data/2020/dec/sf1';
  private readonly GEOCODING_BASE_URL = 'https://geocoding.geo.census.gov/geocoder/geographies/coordinates';

  constructor() {
    this.logger = new Logger();
    this.cache = new GenericCacheService();
  }

  // ===========================
  // PUBLIC ANALYSIS METHODS
  // ===========================

  /**
   * Comprehensive demographic analysis using Census ACS data
   */
  async analyzeDemographics(coordinates: Coordinates, propertyId?: string): Promise<DemographicIntelligence> {
    try {
      const cacheKey = `census_demographics_${coordinates.latitude}_${coordinates.longitude}`;
      const cached = await this.cache.get<DemographicIntelligence>(cacheKey);
      if (cached) {
        this.logger.info('Census demographic data retrieved from cache', { propertyId, coordinates });
        return cached;
      }

      this.logger.info('Starting Census demographic analysis', { propertyId, coordinates });

      // Get geographic identifiers
      const geoId = await this.getGeographicIdentifiers(coordinates);
      
      // Fetch demographic data from multiple ACS tables
      const [
        ageData,
        raceData,
        householdData,
        languageData,
        migrationData
      ] = await Promise.all([
        this.fetchACSData(geoId, ['B01001_001E', 'B01001_003E', 'B01001_007E', 'B01001_012E', 'B01001_017E', 'B01001_022E']), // Age by Sex
        this.fetchACSData(geoId, ['B02001_001E', 'B02001_002E', 'B02001_003E', 'B02001_004E', 'B02001_005E', 'B02001_006E', 'B02001_007E', 'B02001_008E']), // Race
        this.fetchACSData(geoId, ['B11001_001E', 'B11001_002E', 'B11001_003E', 'B11001_007E']), // Household Type
        this.fetchACSData(geoId, ['B16001_001E', 'B16001_002E', 'B16001_003E']), // Language Spoken at Home
        this.fetchACSData(geoId, ['B07001_001E', 'B07001_017E']) // Migration
      ]);

      const analysis = this.calculateDemographicIntelligence(
        ageData,
        raceData,
        householdData,
        languageData,
        migrationData
      );

      // Cache the results for 24 hours
      await this.cache.set(cacheKey, analysis, 24 * 60 * 60);

      this.logger.info('Census demographic analysis completed', { 
        propertyId, 
        coordinates,
        score: analysis.demographicCompatibilityScore 
      });

      return analysis;

    } catch (error) {
      this.logger.error('Census demographic analysis failed', { error, propertyId, coordinates });
      throw new Error('Census demographic analysis service unavailable');
    }
  }

  /**
   * Economic vitality analysis using Census economic data
   */
  async analyzeEconomicVitality(coordinates: Coordinates, propertyId?: string): Promise<EconomicIntelligence> {
    try {
      const cacheKey = `census_economics_${coordinates.latitude}_${coordinates.longitude}`;
      const cached = await this.cache.get<EconomicIntelligence>(cacheKey);
      if (cached) {
        return cached;
      }

      this.logger.info('Starting Census economic analysis', { propertyId, coordinates });

      const geoId = await this.getGeographicIdentifiers(coordinates);
      
      // Fetch economic data
      const [
        incomeData,
        employmentData,
        povertyData,
        commuteData,
        industryData
      ] = await Promise.all([
        this.fetchACSData(geoId, ['B19013_001E', 'B19001_002E', 'B19001_003E', 'B19001_004E', 'B19001_005E', 'B19001_006E', 'B19001_007E']), // Income
        this.fetchACSData(geoId, ['B23025_001E', 'B23025_002E', 'B23025_005E']), // Employment Status
        this.fetchACSData(geoId, ['B17001_001E', 'B17001_002E']), // Poverty Status
        this.fetchACSData(geoId, ['B08301_001E', 'B08301_010E', 'B08301_021E']), // Commuting
        this.fetchACSData(geoId, ['C24030_001E', 'C24030_003E', 'C24030_007E', 'C24030_015E', 'C24030_019E']) // Industry
      ]);

      const analysis = this.calculateEconomicIntelligence(
        incomeData,
        employmentData,
        povertyData,
        commuteData,
        industryData
      );

      await this.cache.set(cacheKey, analysis, 24 * 60 * 60);

      this.logger.info('Census economic analysis completed', { 
        propertyId, 
        coordinates,
        score: analysis.economicVitalityScore 
      });

      return analysis;

    } catch (error) {
      this.logger.error('Census economic analysis failed', { error, propertyId, coordinates });
      throw new Error('Census economic analysis service unavailable');
    }
  }

  /**
   * Housing market analysis using Census housing data
   */
  async analyzeHousingMarket(coordinates: Coordinates, propertyId?: string): Promise<HousingIntelligence> {
    try {
      const cacheKey = `census_housing_${coordinates.latitude}_${coordinates.longitude}`;
      const cached = await this.cache.get<HousingIntelligence>(cacheKey);
      if (cached) {
        return cached;
      }

      this.logger.info('Starting Census housing analysis', { propertyId, coordinates });

      const geoId = await this.getGeographicIdentifiers(coordinates);
      
      // Fetch housing data
      const [
        housingStockData,
        housingValueData,
        housingCostData,
        housingAgeData,
        occupancyData
      ] = await Promise.all([
        this.fetchACSData(geoId, ['B25001_001E', 'B25002_001E', 'B25002_002E', 'B25002_003E']), // Housing Stock
        this.fetchACSData(geoId, ['B25077_001E', 'B25064_001E']), // Home Value and Rent
        this.fetchACSData(geoId, ['B25070_001E', 'B25070_007E', 'B25070_008E', 'B25070_009E', 'B25070_010E']), // Housing Cost Burden
        this.fetchACSData(geoId, ['B25034_001E', 'B25034_002E', 'B25034_003E', 'B25034_004E', 'B25034_005E']), // Year Structure Built
        this.fetchACSData(geoId, ['B25003_001E', 'B25003_002E', 'B25003_003E']) // Tenure (Own/Rent)
      ]);

      const analysis = this.calculateHousingIntelligence(
        housingStockData,
        housingValueData,
        housingCostData,
        housingAgeData,
        occupancyData
      );

      await this.cache.set(cacheKey, analysis, 24 * 60 * 60);

      this.logger.info('Census housing analysis completed', { 
        propertyId, 
        coordinates,
        score: analysis.housingMarketScore 
      });

      return analysis;

    } catch (error) {
      this.logger.error('Census housing analysis failed', { error, propertyId, coordinates });
      throw new Error('Census housing analysis service unavailable');
    }
  }

  // ===========================
  // GEOGRAPHIC IDENTIFICATION
  // ===========================

  /**
   * Get Census geographic identifiers (FIPS codes) from coordinates
   */
  private async getGeographicIdentifiers(coordinates: Coordinates): Promise<CensusGeographicIdentifier> {
    try {
      const cacheKey = `census_geo_${coordinates.latitude}_${coordinates.longitude}`;
      const cached = await this.cache.get<CensusGeographicIdentifier>(cacheKey);
      if (cached) {
        return cached;
      }

      const url = `${this.GEOCODING_BASE_URL}?x=${coordinates.longitude}&y=${coordinates.latitude}&benchmark=2020&vintage=2020&format=json`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Census geocoding API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.result || !data.result.geographies || !data.result.geographies['Census Tracts']) {
        throw new Error('No Census geographic data found for coordinates');
      }

      const tract = data.result.geographies['Census Tracts'][0];
      const blockGroup = data.result.geographies['Census Block Groups']?.[0];

      const geoId: CensusGeographicIdentifier = {
        state: tract.STATE,
        county: tract.COUNTY,
        tract: tract.TRACT,
        blockGroup: blockGroup?.BLKGRP
      };

      // Cache geographic identifiers for a long time (they don't change)
      await this.cache.set(cacheKey, geoId, 7 * 24 * 60 * 60); // 7 days

      return geoId;

    } catch (error) {
      this.logger.error('Census geocoding failed', { error, coordinates });
      throw new Error('Unable to determine Census geography for coordinates');
    }
  }

  // ===========================
  // DATA FETCHING METHODS
  // ===========================

  /**
   * Fetch data from Census American Community Survey (ACS)
   */
  private async fetchACSData(geoId: CensusGeographicIdentifier, variables: string[]): Promise<any[]> {
    try {
      const variableString = variables.join(',');
      const geography = geoId.blockGroup 
        ? `block group:${geoId.blockGroup}&in=state:${geoId.state}&in=county:${geoId.county}&in=tract:${geoId.tract}`
        : `tract:${geoId.tract}&in=state:${geoId.state}&in=county:${geoId.county}`;

      const url = `${this.ACS5_BASE_URL}?get=${variableString}&for=${geography}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Census ACS API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!Array.isArray(data) || data.length < 2) {
        throw new Error('Invalid Census ACS API response format');
      }

      // Return the data row (exclude header row)
      return data[1];

    } catch (error) {
      this.logger.error('Census ACS data fetch failed', { error, geoId, variables });
      throw error;
    }
  }

  // ===========================
  // ANALYSIS CALCULATION METHODS
  // ===========================

  /**
   * Calculate demographic intelligence from raw Census data
   */
  private calculateDemographicIntelligence(
    ageData: any[],
    raceData: any[],
    householdData: any[],
    languageData: any[],
    migrationData: any[]
  ): DemographicIntelligence {
    
    // Parse age data
    const totalPop = parseInt(ageData[0]) || 0;
    const under18 = (parseInt(ageData[1]) || 0) / totalPop * 100;
    const age18to34 = (parseInt(ageData[2]) || 0) / totalPop * 100;
    const age35to54 = (parseInt(ageData[3]) || 0) / totalPop * 100;
    const age55to74 = (parseInt(ageData[4]) || 0) / totalPop * 100;
    const over75 = (parseInt(ageData[5]) || 0) / totalPop * 100;

    // Parse race data
    const totalRace = parseInt(raceData[0]) || 0;
    const white = (parseInt(raceData[1]) || 0) / totalRace * 100;
    const black = (parseInt(raceData[2]) || 0) / totalRace * 100;
    const asian = (parseInt(raceData[4]) || 0) / totalRace * 100;

    // Calculate diversity index (Simpson's Diversity Index)
    const racialDiversityIndex = this.calculateDiversityIndex([
      parseInt(raceData[1]) || 0, // White
      parseInt(raceData[2]) || 0, // Black
      parseInt(raceData[3]) || 0, // Native American
      parseInt(raceData[4]) || 0, // Asian
      parseInt(raceData[5]) || 0, // Pacific Islander
      parseInt(raceData[6]) || 0, // Other
      parseInt(raceData[7]) || 0  // Two or more races
    ]);

    // Parse household data
    const totalHouseholds = parseInt(householdData[0]) || 0;
    const familyHouseholds = (parseInt(householdData[1]) || 0) / totalHouseholds * 100;
    const singlePersonHouseholds = (parseInt(householdData[2]) || 0) / totalHouseholds * 100;

    // Parse language data
    const totalLanguage = parseInt(languageData[0]) || 0;
    const englishOnly = (parseInt(languageData[1]) || 0) / totalLanguage * 100;
    const spanish = (parseInt(languageData[2]) || 0) / totalLanguage * 100;

    // Calculate overall demographic compatibility score
    const diversityScore = racialDiversityIndex;
    const ageBalanceScore = 100 - Math.abs(50 - ((age18to34 + age35to54) / 2)); // Balanced working age population
    const stabilityScore = Math.min(100, (parseInt(migrationData[1]) || 0) / (parseInt(migrationData[0]) || 1) * 100);
    
    const demographicCompatibilityScore = Math.round(
      (diversityScore * 0.3 + ageBalanceScore * 0.4 + stabilityScore * 0.3)
    );

    return {
      demographicCompatibilityScore,
      
      populationCharacteristics: {
        totalPopulation: totalPop,
        populationDensity: 0, // Would need additional geographic area data
        populationGrowthRate: 0, // Would need historical comparison
        ageDistribution: {
          under18,
          age18to34,
          age35to54,
          age55to74,
          over75,
          medianAge: 0 // Would need specific median age variable
        },
        generationalMix: {
          genZ: under18 + (age18to34 * 0.3), // Approximate
          millennials: age18to34 * 0.7 + (age35to54 * 0.2),
          genX: age35to54 * 0.8,
          boomers: age55to74,
          silent: over75
        }
      },

      householdComposition: {
        averageHouseholdSize: totalPop / totalHouseholds,
        familyHouseholds,
        singlePersonHouseholds,
        householdsWithChildren: 0, // Would need specific variable
        marriedCoupleHouseholds: 0, // Would need specific variable
        singleParentHouseholds: 0 // Would need specific variable  
      },

      diversityMetrics: {
        racialDiversityIndex,
        ethnicComposition: {
          white,
          black,
          hispanic: 0, // Would need Hispanic origin data
          asian,
          nativeAmerican: (parseInt(raceData[3]) || 0) / totalRace * 100,
          pacificIslander: (parseInt(raceData[5]) || 0) / totalRace * 100,
          multiracial: (parseInt(raceData[7]) || 0) / totalRace * 100
        },
        languageDiversity: {
          englishOnly,
          spanish,
          otherLanguages: 100 - englishOnly - spanish,
          linguisticIsolation: 0 // Would need specific variable
        }
      }
    };
  }

  /**
   * Calculate economic intelligence from raw Census data
   */
  private calculateEconomicIntelligence(
    incomeData: any[],
    employmentData: any[],
    povertyData: any[],
    commuteData: any[],
    industryData: any[]
  ): EconomicIntelligence {
    
    const medianHouseholdIncome = parseInt(incomeData[0]) || 0;
    const totalEmployment = parseInt(employmentData[0]) || 0;
    const unemployed = parseInt(employmentData[2]) || 0;
    const unemploymentRate = (unemployed / totalEmployment) * 100;
    
    const totalPoverty = parseInt(povertyData[0]) || 0;
    const inPoverty = parseInt(povertyData[1]) || 0;
    const povertyRate = (inPoverty / totalPoverty) * 100;

    // Calculate economic vitality score
    const incomeScore = Math.min(100, (medianHouseholdIncome / 80000) * 100); // Normalized to $80k
    const employmentScore = Math.max(0, 100 - (unemploymentRate * 10));
    const stabilityScore = Math.max(0, 100 - (povertyRate * 5));
    
    const economicVitalityScore = Math.round(
      (incomeScore * 0.4 + employmentScore * 0.3 + stabilityScore * 0.3)
    );

    return {
      economicVitalityScore,
      
      incomeMetrics: {
        medianHouseholdIncome,
        perCapitaIncome: 0, // Would need specific variable
        incomeDistribution: {
          under25k: (parseInt(incomeData[1]) || 0) / (parseInt(incomeData[0]) || 1) * 100,
          income25to50k: (parseInt(incomeData[2]) || 0) / (parseInt(incomeData[0]) || 1) * 100,
          income50to75k: (parseInt(incomeData[3]) || 0) / (parseInt(incomeData[0]) || 1) * 100,
          income75to100k: (parseInt(incomeData[4]) || 0) / (parseInt(incomeData[0]) || 1) * 100,
          income100to150k: (parseInt(incomeData[5]) || 0) / (parseInt(incomeData[0]) || 1) * 100,
          over150k: (parseInt(incomeData[6]) || 0) / (parseInt(incomeData[0]) || 1) * 100
        },
        incomeGrowthRate: 0, // Would need historical comparison
        giniCoefficient: 0 // Would need specific calculation
      },

      employmentCharacteristics: {
        unemploymentRate,
        laborForceParticipation: (parseInt(employmentData[1]) || 0) / totalEmployment * 100,
        employmentByIndustry: {
          professional: (parseInt(industryData[1]) || 0) / (parseInt(industryData[0]) || 1) * 100,
          healthcare: (parseInt(industryData[2]) || 0) / (parseInt(industryData[0]) || 1) * 100,
          retail: (parseInt(industryData[3]) || 0) / (parseInt(industryData[0]) || 1) * 100,
          manufacturing: (parseInt(industryData[4]) || 0) / (parseInt(industryData[0]) || 1) * 100,
          education: 0,
          government: 0,
          technology: 0,
          finance: 0
        },
        workFromHomeRate: (parseInt(commuteData[2]) || 0) / (parseInt(commuteData[0]) || 1) * 100,
        commuteTimes: {
          averageCommuteMinutes: 0, // Would need specific variable
          under15min: 0,
          over60min: 0
        }
      },

      economicStability: {
        povertyRate,
        publicAssistanceRate: 0, // Would need specific variable
        snapBenefitsRate: 0, // Would need specific variable
        medicaidCoverage: 0, // Would need specific variable
        economicMobilityIndex: Math.max(0, 100 - povertyRate) // Simple approximation
      }
    };
  }

  /**
   * Calculate housing intelligence from raw Census data
   */
  private calculateHousingIntelligence(
    housingStockData: any[],
    housingValueData: any[],
    housingCostData: any[],
    housingAgeData: any[],
    occupancyData: any[]
  ): HousingIntelligence {
    
    const totalUnits = parseInt(housingStockData[0]) || 0;
    const occupiedUnits = parseInt(housingStockData[1]) || 0;
    const vacantUnits = parseInt(housingStockData[2]) || 0;
    
    const occupancyRate = (occupiedUnits / totalUnits) * 100;
    const vacancyRate = (vacantUnits / totalUnits) * 100;
    
    const medianHomeValue = parseInt(housingValueData[0]) || 0;
    const medianRent = parseInt(housingValueData[1]) || 0;

    const totalOccupied = parseInt(occupancyData[0]) || 0;
    const ownerOccupied = parseInt(occupancyData[1]) || 0;
    const renterOccupied = parseInt(occupancyData[2]) || 0;
    
    const ownerOccupiedRate = (ownerOccupied / totalOccupied) * 100;
    const renterOccupiedRate = (renterOccupied / totalOccupied) * 100;

    // Calculate housing market score
    const availabilityScore = Math.max(0, 100 - (vacancyRate * 10)); // Lower vacancy = higher demand
    const valueScore = Math.min(100, (medianHomeValue / 500000) * 100); // Normalized to $500k
    const stabilityScore = ownerOccupiedRate; // Higher ownership = more stability
    
    const housingMarketScore = Math.round(
      (availabilityScore * 0.3 + valueScore * 0.4 + stabilityScore * 0.3)
    );

    return {
      housingMarketScore,
      
      housingStock: {
        totalHousingUnits: totalUnits,
        occupancyRate,
        vacancyRate,
        ownerOccupiedRate,
        renterOccupiedRate,
        
        housingTypes: {
          singleFamily: 0, // Would need specific variable
          townhouse: 0,
          smallApartment: 0,
          largeApartment: 0,
          mobileHome: 0,
          other: 0
        },
        
        housingAge: {
          built2020orLater: (parseInt(housingAgeData[1]) || 0) / (parseInt(housingAgeData[0]) || 1) * 100,
          built2010to2019: (parseInt(housingAgeData[2]) || 0) / (parseInt(housingAgeData[0]) || 1) * 100,
          built2000to2009: (parseInt(housingAgeData[3]) || 0) / (parseInt(housingAgeData[0]) || 1) * 100,
          built1990to1999: (parseInt(housingAgeData[4]) || 0) / (parseInt(housingAgeData[0]) || 1) * 100,
          built1980to1989: 0,
          built1970to1979: 0,
          builtBefore1970: 0
        }
      },

      housingAffordability: {
        medianHomeValue,
        medianGrossRent: medianRent,
        housingCostBurden: {
          under30percent: (parseInt(housingCostData[1]) || 0) / (parseInt(housingCostData[0]) || 1) * 100,
          percent30to50: (parseInt(housingCostData[2]) || 0) / (parseInt(housingCostData[0]) || 1) * 100,
          over50percent: (parseInt(housingCostData[3]) || 0) / (parseInt(housingCostData[0]) || 1) * 100
        },
        rentToIncomeRatio: medianRent * 12 / 50000, // Assuming $50k median income
        homeValueToIncomeRatio: medianHomeValue / 80000 // Assuming $80k median income
      },

      housingTrends: {
        homeValueGrowthRate: 0, // Would need historical comparison
        rentGrowthRate: 0, // Would need historical comparison
        newConstructionRate: (parseInt(housingAgeData[1]) || 0) / totalUnits * 100,
        movingTurnoverRate: 0 // Would need mobility data
      }
    };
  }

  // ===========================
  // UTILITY METHODS
  // ===========================

  /**
   * Calculate Simpson's Diversity Index for racial/ethnic diversity
   */
  private calculateDiversityIndex(populations: number[]): number {
    const total = populations.reduce((sum, pop) => sum + pop, 0);
    if (total === 0) return 0;

    const sumSquares = populations.reduce((sum, pop) => {
      const proportion = pop / total;
      return sum + (proportion * proportion);
    }, 0);

    // Simpson's Diversity Index: 1 - Σ(pi²), converted to 0-100 scale
    return Math.round((1 - sumSquares) * 100);
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{ status: string; lastUpdate: Date; coverage: string }> {
    return {
      status: 'operational',
      lastUpdate: new Date(),
      coverage: 'United States (all 50 states + DC + Puerto Rico)'
    };
  }
}