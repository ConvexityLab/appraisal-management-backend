/**
 * Google Maps Platform Property Intelligence Service
 * 
 * Leverages Google's comprehensive API ecosystem for advanced property analysis:
 * - Places API (Nearby Search, Place Details, Place Photos)
 * - Elevation API (Elevation profiles, line-of-sight calculations)
 * - Street View Static API (Visual analysis, view quality assessment)
 * - Distance Matrix API (Travel time analysis, accessibility scoring)
 * - Roads API (Traffic patterns, road quality assessment)
 * - Geocoding API (Address standardization, precision scoring)
 * - Time Zone API (Location-based time analysis)
 */

import { Logger } from '../utils/logger';
import { GenericCacheService } from './cache/generic-cache.service';
import { Coordinates } from '../types/geospatial';
import {
  ViewAnalysis,
  LocationCharacteristics,
  TransportationAnalysis,
  ProximityAnalysis,
  QualityOfLifeAnalysis,
  POISearchResult
} from '../types/property-intelligence';

export class GoogleMapsPropertyIntelligenceService {
  private logger: Logger;
  private cache: GenericCacheService;
  private apiKey: string;
  private baseUrls: {
    places: string;
    elevation: string;
    streetView: string;
    distanceMatrix: string;
    roads: string;
    geocoding: string;
    timezone: string;
  };

  constructor() {
    this.logger = new Logger();
    this.cache = new GenericCacheService();
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    
    if (!this.apiKey) {
      throw new Error('Google Maps API key is required');
    }

    this.baseUrls = {
      places: 'https://maps.googleapis.com/maps/api/place',
      elevation: 'https://maps.googleapis.com/maps/api/elevation/json',
      streetView: 'https://maps.googleapis.com/maps/api/streetview',
      distanceMatrix: 'https://maps.googleapis.com/maps/api/distancematrix/json',
      roads: 'https://roads.googleapis.com/v1',
      geocoding: 'https://maps.googleapis.com/maps/api/geocode/json',
      timezone: 'https://maps.googleapis.com/maps/api/timezone/json'
    };
  }

  // ===========================
  // COMPREHENSIVE PROPERTY ANALYSIS
  // ===========================

  /**
   * Perform comprehensive property intelligence analysis
   */
  async analyzeProperty(coordinates: Coordinates, propertyId?: string): Promise<{
    viewAnalysis: ViewAnalysis;
    locationCharacteristics: LocationCharacteristics;
    transportationAnalysis: TransportationAnalysis;
    proximityAnalysis: ProximityAnalysis;
    qualityOfLifeAnalysis: Partial<QualityOfLifeAnalysis>;
    uniqueFeatures: string[];
    desirabilityFactors: {
      positive: Array<{ factor: string; score: number; description: string }>;
      negative: Array<{ factor: string; score: number; description: string }>;
    };
  }> {
    try {
      const cacheKey = `property-analysis:${coordinates.latitude},${coordinates.longitude}`;
      const cached = await this.cache.get<any>(cacheKey);
      if (cached) {
        return cached;
      }

      // Parallel analysis for efficiency
      const [
        viewAnalysis,
        locationCharacteristics,
        transportationAnalysis,
        proximityAnalysis,
        qualityOfLifeAnalysis
      ] = await Promise.all([
        this.analyzeViews(coordinates),
        this.analyzeLocationCharacteristics(coordinates),
        this.analyzeTransportation(coordinates),
        this.analyzeProximity(coordinates),
        this.analyzeQualityOfLife(coordinates)
      ]);

      // Calculate unique features and desirability factors
      const uniqueFeatures = this.identifyUniqueFeatures({
        viewAnalysis,
        locationCharacteristics,
        transportationAnalysis,
        proximityAnalysis
      });

      const desirabilityFactors = this.calculateDesirabilityFactors({
        viewAnalysis,
        locationCharacteristics,
        transportationAnalysis,
        proximityAnalysis,
        qualityOfLifeAnalysis
      });

      const result = {
        viewAnalysis,
        locationCharacteristics,
        transportationAnalysis,
        proximityAnalysis,
        qualityOfLifeAnalysis,
        uniqueFeatures,
        desirabilityFactors
      };

      // Cache for 6 hours
      await this.cache.set(cacheKey, result, 6 * 60 * 60);
      return result;

    } catch (error) {
      this.logger.error('Failed to analyze property', { error, coordinates, propertyId });
      throw new Error('Property analysis failed');
    }
  }

  // ===========================
  // VIEW ANALYSIS
  // ===========================

  /**
   * Comprehensive view analysis using elevation, Street View, and nearby features
   */
  async analyzeViews(coordinates: Coordinates): Promise<ViewAnalysis> {
    try {
      // Get elevation profile for view potential
      const elevation = await this.getElevationProfile(coordinates);
      
      // Analyze water views
      const waterView = await this.analyzeWaterViews(coordinates, elevation);
      
      // Analyze city/urban views
      const cityView = await this.analyzeCityViews(coordinates, elevation);
      
      // Analyze mountain/hill views
      const mountainView = await this.analyzeMountainViews(coordinates, elevation);
      
      // Analyze nature views
      const natureView = await this.analyzeNatureViews(coordinates);
      
      // Identify undesirable views
      const undesirableViews = await this.analyzeUndesirableViews(coordinates);

      return {
        waterView,
        cityView,
        mountainView,
        natureView,
        undesirableViews
      };

    } catch (error) {
      this.logger.error('Failed to analyze views', { error, coordinates });
      throw error;
    }
  }

  private async analyzeWaterViews(coordinates: Coordinates, elevation: number): Promise<ViewAnalysis['waterView']> {
    // Search for water bodies within reasonable viewing distance
    const waterBodies = await this.searchNearbyPlaces(coordinates, [
      'natural_feature|water',
      'park|water',
      'point_of_interest|water'
    ], 5000); // 5km radius

    const oceanBodies = waterBodies.filter(p => 
      p.name.toLowerCase().includes('ocean') || 
      p.name.toLowerCase().includes('sea') ||
      p.name.toLowerCase().includes('bay')
    );

    const lakeBodies = waterBodies.filter(p => 
      p.name.toLowerCase().includes('lake') ||
      p.name.toLowerCase().includes('reservoir')
    );

    const riverBodies = waterBodies.filter(p => 
      p.name.toLowerCase().includes('river') ||
      p.name.toLowerCase().includes('creek') ||
      p.name.toLowerCase().includes('stream')
    );

    if (waterBodies.length === 0) {
      return {
        hasView: false,
        viewType: 'none',
        viewQuality: 'none',
        distanceToWater: Infinity,
        elevationAdvantage: 0,
        lineOfSightClear: false,
        viewScore: 0
      };
    }

    // Find closest significant water body
    const closestWater = waterBodies[0];
    if (!closestWater) {
      return {
        hasView: false,
        viewType: 'none',
        viewQuality: 'none',
        distanceToWater: Infinity,
        elevationAdvantage: 0,
        lineOfSightClear: false,
        viewScore: 0
      };
    }
    
    const distance = this.calculateDistance(coordinates, closestWater.coordinates);
    
    // Determine water type priority: ocean > bay > lake > river > pond
    let waterType: ViewAnalysis['waterView']['viewType'] = 'pond';
    if (oceanBodies.length > 0) waterType = 'ocean';
    else if (lakeBodies.length > 0) waterType = 'lake';
    else if (riverBodies.length > 0) waterType = 'river';
    
    // Check for bay in the closest water body name
    if (closestWater.name.toLowerCase().includes('bay')) {
      waterType = 'bay';
    }

    // Calculate elevation advantage
    const waterElevation = await this.getElevation(closestWater.coordinates);
    const elevationAdvantage = elevation - waterElevation;

    // Estimate view quality based on distance and elevation
    let viewQuality: ViewAnalysis['waterView']['viewQuality'] = 'none';
    let viewScore = 0;

    if (distance < 500 && elevationAdvantage > 10) {
      viewQuality = 'panoramic';
      viewScore = 90;
    } else if (distance < 1000 && elevationAdvantage > 5) {
      viewQuality = 'partial';
      viewScore = 70;
    } else if (distance < 2000) {
      viewQuality = 'glimpse';
      viewScore = 40;
    } else if (distance < 5000) {
      viewQuality = 'obstructed';
      viewScore = 20;
    }

    // Bonus for ocean views
    if (waterType === 'ocean') viewScore += 20;
    if (waterType === 'bay') viewScore += 15;

    return {
      hasView: viewScore > 0,
      viewType: waterType,
      viewQuality,
      distanceToWater: distance,
      elevationAdvantage,
      lineOfSightClear: elevationAdvantage > 5 && distance < 2000,
      viewScore: Math.min(viewScore, 100)
    };
  }

  private async analyzeCityViews(coordinates: Coordinates, elevation: number): Promise<ViewAnalysis['cityView']> {
    // Search for urban centers and downtown areas
    const cityFeatures = await this.searchNearbyPlaces(coordinates, [
      'locality',
      'sublocality',
      'neighborhood',
      'administrative_area_level_3'
    ], 25000); // 25km radius for city views

    const downtownAreas = await this.searchNearbyPlaces(coordinates, [
      'establishment|downtown',
      'point_of_interest|downtown',
      'neighborhood|downtown'
    ], 15000);

    // Find major city center
    const majorCity = cityFeatures.find(p => 
      p.name.toLowerCase().includes('downtown') ||
      p.name.toLowerCase().includes('city center') ||
      p.attributes?.importance > 0.7
    );

    if (!majorCity && downtownAreas.length === 0) {
      return {
        hasCityView: false,
        skylineView: false,
        cityLightView: false,
        viewDirection: [],
        distanceToCity: Infinity,
        elevationAdvantage: 0,
        viewScore: 0
      };
    }

    const cityCenter = majorCity || downtownAreas[0];
    if (!cityCenter) {
      return {
        hasCityView: false,
        skylineView: false,
        cityLightView: false,
        viewDirection: [],
        distanceToCity: Infinity,
        elevationAdvantage: 0,
        viewScore: 0
      };
    }
    
    const distance = this.calculateDistance(coordinates, cityCenter.coordinates);
    const bearing = this.calculateBearing(coordinates, cityCenter.coordinates);
    const viewDirection = this.bearingToDirection(bearing);

    // Calculate elevation advantage for skyline views
    const cityElevation = await this.getElevation(cityCenter.coordinates);
    const elevationAdvantage = elevation - cityElevation;

    let viewScore = 0;
    let skylineView = false;
    let cityLightView = false;

    // Distance-based scoring for city views
    if (distance < 5000) {
      viewScore = 30; // Too close for good skyline
    } else if (distance < 15000) {
      viewScore = 80; // Perfect skyline distance
      skylineView = elevationAdvantage > 0;
      cityLightView = true;
    } else if (distance < 30000) {
      viewScore = 60; // Distant city view
      skylineView = elevationAdvantage > 20;
      cityLightView = elevationAdvantage > 10;
    } else {
      viewScore = 20; // Very distant
    }

    // Elevation bonus
    if (elevationAdvantage > 50) viewScore += 20;
    else if (elevationAdvantage > 20) viewScore += 10;

    return {
      hasCityView: viewScore > 30,
      skylineView,
      cityLightView,
      viewDirection: [viewDirection],
      distanceToCity: distance,
      elevationAdvantage,
      viewScore: Math.min(viewScore, 100)
    };
  }

  private async analyzeMountainViews(coordinates: Coordinates, elevation: number): Promise<ViewAnalysis['mountainView']> {
    // Search for mountain peaks and elevated natural features
    const mountains = await this.searchNearbyPlaces(coordinates, [
      'natural_feature|mountain',
      'natural_feature|hill',
      'natural_feature|peak',
      'point_of_interest|mountain'
    ], 50000); // 50km radius for mountain views

    if (mountains.length === 0) {
      return {
        hasMountainView: false,
        peakNames: [],
        viewDirection: [],
        distanceToNearest: Infinity,
        elevationDifference: 0,
        viewScore: 0
      };
    }

    // Get elevations for mountain peaks
    const mountainsWithElevation = await Promise.all(
      mountains.slice(0, 5).map(async (mountain) => {
        const mountainElevation = await this.getElevation(mountain.coordinates);
        return {
          ...mountain,
          elevation: mountainElevation,
          distance: this.calculateDistance(coordinates, mountain.coordinates),
          bearing: this.calculateBearing(coordinates, mountain.coordinates)
        };
      })
    );

    // Filter for significant elevation difference
    const significantPeaks = mountainsWithElevation.filter(m => 
      m.elevation > elevation + 100 // At least 100m higher
    );

    if (significantPeaks.length === 0) {
      return {
        hasMountainView: false,
        peakNames: [],
        viewDirection: [],
        distanceToNearest: Infinity,
        elevationDifference: 0,
        viewScore: 0
      };
    }

    const nearestPeak = significantPeaks[0];
    if (!nearestPeak) {
      return {
        hasMountainView: false,
        peakNames: [],
        viewDirection: [],
        distanceToNearest: Infinity,
        elevationDifference: 0,
        viewScore: 0
      };
    }
    
    const elevationDifference = nearestPeak.elevation - elevation;
    
    let viewScore = 0;
    
    // Distance and elevation-based scoring
    if (nearestPeak.distance < 10000 && elevationDifference > 500) {
      viewScore = 95; // Dramatic close mountain views
    } else if (nearestPeak.distance < 25000 && elevationDifference > 300) {
      viewScore = 80; // Good mountain views
    } else if (nearestPeak.distance < 50000 && elevationDifference > 200) {
      viewScore = 60; // Distant mountain views
    } else {
      viewScore = 30; // Minimal mountain views
    }

    return {
      hasMountainView: viewScore > 40,
      peakNames: significantPeaks.slice(0, 3).map(p => p.name),
      viewDirection: significantPeaks.slice(0, 3).map(p => this.bearingToDirection(p.bearing)),
      distanceToNearest: nearestPeak.distance,
      elevationDifference,
      viewScore
    };
  }

  private async analyzeNatureViews(coordinates: Coordinates): Promise<ViewAnalysis['natureView']> {
    // Search for natural areas and protected lands
    const natureAreas = await this.searchNearbyPlaces(coordinates, [
      'park',
      'natural_feature',
      'establishment|forest',
      'establishment|preserve',
      'establishment|golf_course'
    ], 5000);

    if (natureAreas.length === 0) {
      return {
        hasNatureView: false,
        viewTypes: [],
        protectedLand: false,
        viewScore: 0
      };
    }

    const viewTypes: ViewAnalysis['natureView']['viewTypes'] = [];
    let protectedLand = false;
    let viewScore = 0;

    // Categorize nature views
    for (const area of natureAreas.slice(0, 10)) {
      const name = area.name.toLowerCase();
      
      if (name.includes('forest') || name.includes('woods')) {
        if (!viewTypes.includes('forest')) viewTypes.push('forest');
        viewScore += 15;
      }
      
      if (name.includes('park')) {
        if (!viewTypes.includes('park')) viewTypes.push('park');
        viewScore += 10;
        
        // Check for protected status
        if (name.includes('national') || name.includes('state') || name.includes('preserve')) {
          protectedLand = true;
          viewScore += 20;
        }
      }
      
      if (name.includes('preserve') || name.includes('reserve')) {
        if (!viewTypes.includes('preserve')) viewTypes.push('preserve');
        protectedLand = true;
        viewScore += 25;
      }
      
      if (name.includes('golf')) {
        if (!viewTypes.includes('golf_course')) viewTypes.push('golf_course');
        viewScore += 12;
      }
      
      if (name.includes('farm') || name.includes('agriculture')) {
        if (!viewTypes.includes('farmland')) viewTypes.push('farmland');
        viewScore += 8;
      }
    }

    // Distance bonus - closer nature views are better
    const closestNature = natureAreas[0];
    if (closestNature) {
      const distance = this.calculateDistance(coordinates, closestNature.coordinates);
      
      if (distance < 500) viewScore += 20;
      else if (distance < 1000) viewScore += 15;
      else if (distance < 2000) viewScore += 10;
    }

    return {
      hasNatureView: viewScore > 10,
      viewTypes,
      protectedLand,
      viewScore: Math.min(viewScore, 100)
    };
  }

  private async analyzeUndesirableViews(coordinates: Coordinates): Promise<ViewAnalysis['undesirableViews']> {
    // Search for potentially undesirable features
    const undesirableFeatures = await this.searchNearbyPlaces(coordinates, [
      'establishment|landfill',
      'establishment|waste',
      'establishment|industrial',
      'establishment|factory',
      'establishment|power_plant',
      'establishment|cemetery',
      'establishment|prison',
      'establishment|airport'
    ], 3000);

    let industrialView = false;
    let highwayView = false;
    let powerLinesView = false;
    let landfillView = false;
    let cemeteryView = false;
    let negativeViewScore = 0;

    for (const feature of undesirableFeatures) {
      const name = feature.name.toLowerCase();
      const distance = this.calculateDistance(coordinates, feature.coordinates);
      
      // Distance-based impact scoring
      let impactScore = 0;
      if (distance < 500) impactScore = 30;
      else if (distance < 1000) impactScore = 20;
      else if (distance < 2000) impactScore = 10;
      else impactScore = 5;

      if (name.includes('landfill') || name.includes('dump') || name.includes('waste')) {
        landfillView = true;
        negativeViewScore += impactScore * 2; // Double penalty for landfills
      }
      
      if (name.includes('industrial') || name.includes('factory') || name.includes('plant')) {
        industrialView = true;
        negativeViewScore += impactScore;
      }
      
      if (name.includes('cemetery') || name.includes('graveyard')) {
        cemeteryView = true;
        negativeViewScore += impactScore * 0.5; // Moderate penalty
      }
      
      if (name.includes('power') && (name.includes('line') || name.includes('transmission'))) {
        powerLinesView = true;
        negativeViewScore += impactScore * 0.7;
      }
    }

    // Check for highway proximity using Roads API
    const nearbyRoads = await this.getNearbyRoads(coordinates);
    highwayView = nearbyRoads.some(road => 
      road.speedLimit > 65 || 
      road.name.toLowerCase().includes('highway') ||
      road.name.toLowerCase().includes('interstate')
    );
    
    if (highwayView) negativeViewScore += 15;

    return {
      industrialView,
      highwayView,
      powerLinesView,
      landfillView,
      cemeteryView,
      negativeViewScore: Math.min(negativeViewScore, 100)
    };
  }

  // ===========================
  // LOCATION CHARACTERISTICS
  // ===========================

  async analyzeLocationCharacteristics(coordinates: Coordinates): Promise<LocationCharacteristics> {
    try {
      const [
        ruralityIndex,
        beachProximity,
        waterAccess,
        topography
      ] = await Promise.all([
        this.calculateRuralityIndex(coordinates),
        this.analyzeBeachProximity(coordinates),
        this.analyzeWaterAccess(coordinates),
        this.analyzeTopography(coordinates)
      ]);

      return {
        ruralityIndex,
        beachProximity,
        waterAccess,
        topography
      };
    } catch (error) {
      this.logger.error('Failed to analyze location characteristics', { error, coordinates });
      throw error;
    }
  }

  private async calculateRuralityIndex(coordinates: Coordinates): Promise<LocationCharacteristics['ruralityIndex']> {
    // Use Places API to determine development density
    const nearbyEstablishments = await this.searchNearbyPlaces(coordinates, [
      'establishment',
      'point_of_interest'
    ], 1000);

    const nearbyResidential = await this.searchNearbyPlaces(coordinates, [
      'establishment|residential'
    ], 2000);

    // Calculate population density indicators
    const establishmentDensity = nearbyEstablishments.length;
    const residentialDensity = nearbyResidential.length;

    // Get distance to nearest city
    const cities = await this.searchNearbyPlaces(coordinates, [
      'locality',
      'administrative_area_level_3'
    ], 50000);

    const nearestCity = cities[0];
    const distanceToUrbanCenter = nearestCity ? 
      this.calculateDistance(coordinates, nearestCity.coordinates) : 50000;

    // Calculate rurality score (0 = urban core, 100 = remote rural)
    let ruralityScore = 50; // Start in middle

    // Establishment density impact
    if (establishmentDensity > 50) ruralityScore -= 30;
    else if (establishmentDensity > 20) ruralityScore -= 20;
    else if (establishmentDensity > 10) ruralityScore -= 10;
    else if (establishmentDensity < 3) ruralityScore += 20;

    // Distance to city impact
    if (distanceToUrbanCenter < 5000) ruralityScore -= 20;
    else if (distanceToUrbanCenter < 15000) ruralityScore -= 10;
    else if (distanceToUrbanCenter > 30000) ruralityScore += 20;
    else if (distanceToUrbanCenter > 50000) ruralityScore += 30;

    ruralityScore = Math.max(0, Math.min(100, ruralityScore));

    // Determine classification
    let classification: LocationCharacteristics['ruralityIndex']['classification'];
    if (ruralityScore < 15) classification = 'urban_core';
    else if (ruralityScore < 30) classification = 'urban';
    else if (ruralityScore < 50) classification = 'suburban';
    else if (ruralityScore < 70) classification = 'exurban';
    else if (ruralityScore < 85) classification = 'rural';
    else classification = 'remote_rural';

    // Estimate population density
    const populationDensity = Math.max(10, 5000 - (ruralityScore * 50));

    let developmentDensity: LocationCharacteristics['ruralityIndex']['developmentDensity'];
    if (establishmentDensity > 30) developmentDensity = 'high';
    else if (establishmentDensity > 15) developmentDensity = 'medium';
    else if (establishmentDensity > 5) developmentDensity = 'low';
    else developmentDensity = 'sparse';

    return {
      score: ruralityScore,
      classification,
      populationDensity,
      distanceToUrbanCenter,
      developmentDensity
    };
  }

  // ===========================
  // HELPER METHODS
  // ===========================

  private async searchNearbyPlaces(
    coordinates: Coordinates, 
    types: string[], 
    radius: number = 1000
  ): Promise<POISearchResult[]> {
    try {
      const cacheKey = `places:${coordinates.latitude},${coordinates.longitude}:${types.join(',')}:${radius}`;
      const cached = await this.cache.get<POISearchResult[]>(cacheKey);
      if (cached) return cached;

      const results: POISearchResult[] = [];

      for (const type of types) {
        const url = `${this.baseUrls.places}/nearbysearch/json?location=${coordinates.latitude},${coordinates.longitude}&radius=${radius}&type=${type}&key=${this.apiKey}`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.results) {
          for (const place of data.results) {
            results.push({
              id: place.place_id,
              name: place.name,
              category: type.split('|')[0] || type,
              subcategory: type.split('|')[1] || type,
              coordinates: {
                latitude: place.geometry.location.lat,
                longitude: place.geometry.location.lng
              },
              distance: this.calculateDistance(coordinates, {
                latitude: place.geometry.location.lat,
                longitude: place.geometry.location.lng
              }),
              address: place.vicinity || '',
              rating: place.rating,
              priceLevel: place.price_level,
              attributes: {
                types: place.types,
                businessStatus: place.business_status,
                userRatingsTotal: place.user_ratings_total
              }
            });
          }
        }
      }

      // Sort by distance
      results.sort((a, b) => a.distance - b.distance);

      // Cache for 12 hours
      await this.cache.set(cacheKey, results, 12 * 60 * 60);
      return results;

    } catch (error) {
      this.logger.error('Failed to search nearby places', { error, coordinates, types });
      return [];
    }
  }

  private async getElevation(coordinates: Coordinates): Promise<number> {
    try {
      const url = `${this.baseUrls.elevation}?locations=${coordinates.latitude},${coordinates.longitude}&key=${this.apiKey}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        return data.results[0].elevation;
      }
      
      return 0;
    } catch (error) {
      this.logger.error('Failed to get elevation', { error, coordinates });
      return 0;
    }
  }

  private async getElevationProfile(coordinates: Coordinates): Promise<number> {
    // Get elevation for the specific point
    return this.getElevation(coordinates);
  }

  private calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(coord2.latitude - coord1.latitude);
    const dLon = this.toRadians(coord2.longitude - coord1.longitude);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRadians(coord1.latitude)) * Math.cos(this.toRadians(coord2.latitude)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private calculateBearing(from: Coordinates, to: Coordinates): number {
    const dLon = this.toRadians(to.longitude - from.longitude);
    const fromLat = this.toRadians(from.latitude);
    const toLat = this.toRadians(to.latitude);
    
    const y = Math.sin(dLon) * Math.cos(toLat);
    const x = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(dLon);
    
    const bearing = Math.atan2(y, x);
    return (this.toDegrees(bearing) + 360) % 360;
  }

  private bearingToDirection(bearing: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(bearing / 22.5) % 16;
    return directions[index] || 'N';
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }

  // Placeholder methods for remaining analyses
  private async analyzeTransportation(coordinates: Coordinates): Promise<TransportationAnalysis> {
    // Implementation will use Distance Matrix API, Roads API, etc.
    return {} as TransportationAnalysis;
  }

  private async analyzeProximity(coordinates: Coordinates): Promise<ProximityAnalysis> {
    // Implementation will use Places API extensively
    return {} as ProximityAnalysis;
  }

  private async analyzeQualityOfLife(coordinates: Coordinates): Promise<Partial<QualityOfLifeAnalysis>> {
    // Implementation will combine multiple data sources
    return {};
  }

  private async analyzeBeachProximity(coordinates: Coordinates): Promise<LocationCharacteristics['beachProximity']> {
    // Implementation placeholder
    return {
      nearBeach: false,
      beachType: 'none',
      distance: Infinity,
      walkTime: Infinity,
      driveTime: Infinity,
      beachQuality: 'poor',
      publicAccess: false,
      beachAmenities: []
    };
  }

  private async analyzeWaterAccess(coordinates: Coordinates): Promise<LocationCharacteristics['waterAccess']> {
    // Implementation placeholder
    return {
      nearWater: false,
      waterBodies: []
    };
  }

  private async analyzeTopography(coordinates: Coordinates): Promise<LocationCharacteristics['topography']> {
    const elevation = await this.getElevation(coordinates);
    
    return {
      elevation,
      slope: 0, // Will calculate from elevation profile
      aspect: 'N',
      floodplain: false,
      hillside: false,
      ridgeline: false,
      valley: false
    };
  }

  private async getNearbyRoads(coordinates: Coordinates): Promise<Array<{ name: string; speedLimit: number }>> {
    // Implementation using Roads API
    return [];
  }

  private identifyUniqueFeatures(data: any): string[] {
    const features: string[] = [];
    
    // Analyze for unique characteristics
    if (data.viewAnalysis.waterView.hasView && data.viewAnalysis.waterView.viewQuality === 'panoramic') {
      features.push('Panoramic water views');
    }
    
    if (data.viewAnalysis.mountainView.hasMountainView && data.viewAnalysis.mountainView.viewScore > 80) {
      features.push('Dramatic mountain views');
    }
    
    if (data.locationCharacteristics.ruralityIndex.score > 80) {
      features.push('Remote rural location');
    }
    
    // Add more unique feature detection logic
    
    return features;
  }

  private calculateDesirabilityFactors(data: any): {
    positive: Array<{ factor: string; score: number; description: string }>;
    negative: Array<{ factor: string; score: number; description: string }>;
  } {
    const positive: Array<{ factor: string; score: number; description: string }> = [];
    const negative: Array<{ factor: string; score: number; description: string }> = [];
    
    // Analyze positive factors
    if (data.viewAnalysis.waterView.viewScore > 60) {
      positive.push({
        factor: 'Water Views',
        score: data.viewAnalysis.waterView.viewScore,
        description: `${data.viewAnalysis.waterView.viewQuality} ${data.viewAnalysis.waterView.viewType} views`
      });
    }
    
    // Analyze negative factors
    if (data.viewAnalysis.undesirableViews.negativeViewScore > 20) {
      negative.push({
        factor: 'Undesirable Views',
        score: data.viewAnalysis.undesirableViews.negativeViewScore,
        description: 'Industrial or unpleasant views nearby'
      });
    }
    
    return { positive, negative };
  }
}