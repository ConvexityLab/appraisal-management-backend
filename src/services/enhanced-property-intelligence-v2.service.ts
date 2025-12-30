/**
 * Enhanced Property Intelligence Service V2
 * 
 * Comprehensive property analysis using Google Places API (New) with:
 * - Address descriptors and landmark context
 * - Rich metadata (editorial summaries, reviews, neighborhood info)
 * - Accessibility and EV charging analysis
 * - Fuel station pricing
 * - Enhanced photos and visual analysis
 * - Moved place tracking
 * - Pure service area business detection
 */

import { Logger } from '../utils/logger';
import { GenericCacheService } from './cache/generic-cache.service';
import { Coordinates } from '../types/geospatial';
import { GooglePlacesNewService, PlaceDetails, AddressDescriptor } from './google-places-new.service';

// ===========================
// TYPE DEFINITIONS
// ===========================

export interface PropertyIntelligenceAnalysis {
  // Location Context
  locationContext: {
    addressDescriptor: AddressDescriptor | null;
    nearbyLandmarks: Array<{
      name: string;
      type: string;
      distance: number;
      spatialRelationship: string;
      description: string;
    }>;
    containingAreas: Array<{
      name: string;
      type: string;
      containment: string;
    }>;
    neighborhoodSummary: string | null;
  };

  // Amenities & Services
  amenitiesAnalysis: {
    essential: {
      groceryStores: PlaceAnalysis[];
      schools: PlaceAnalysis[];
      hospitals: PlaceAnalysis[];
      pharmacies: PlaceAnalysis[];
    };
    convenience: {
      restaurants: PlaceAnalysis[];
      cafes: PlaceAnalysis[];
      banks: PlaceAnalysis[];
      gasStations: GasStationAnalysis[];
    };
    recreation: {
      parks: PlaceAnalysis[];
      gyms: PlaceAnalysis[];
      entertainment: PlaceAnalysis[];
    };
    transportation: {
      transitStations: PlaceAnalysis[];
      evChargingStations: EVChargingAnalysis[];
    };
  };

  // Accessibility
  accessibilityScore: {
    overall: number;
    wheelchairAccessibleVenues: number;
    accessibleParking: number;
    accessibleTransit: number;
    accessibilityRating: 'excellent' | 'good' | 'fair' | 'limited' | 'poor';
    details: string[];
  };

  // Sustainability
  sustainabilityScore: {
    evChargingAvailability: number;
    evStationsWithin1km: number;
    evStationsWithin5km: number;
    transitAccessibility: number;
    walkability: number;
    bikeability: number;
    sustainabilityRating: 'excellent' | 'good' | 'fair' | 'limited' | 'poor';
    details: string[];
  };

  // Safety & Quality
  qualityIndicators: {
    averageRating: number;
    numberOfReviews: number;
    premiumEstablishments: number;
    chainVsLocal: {
      chains: number;
      local: number;
      ratio: number;
    };
    editorialSummaries: string[];
    generativeSummaries: string[];
  };

  // Desirability Score
  desirabilityScore: {
    overall: number; // 0-100
    components: {
      locationContext: number;
      amenityAccess: number;
      accessibility: number;
      sustainability: number;
      quality: number;
    };
    strengths: string[];
    weaknesses: string[];
    uniqueFeatures: string[];
  };

  // Market Intelligence
  marketIntelligence: {
    demographicIndicators: string[];
    lifestyleIndicators: string[];
    priceLevel: string;
    comparableAreas: string[];
  };

  // Relocation Tracking
  relocatedBusinesses: Array<{
    originalName: string;
    originalId: string;
    newName: string;
    newId: string;
    newAddress: string;
  }>;
}

interface PlaceAnalysis {
  id: string;
  name: string;
  type: string;
  distance: number;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  isAccessible?: boolean;
  hasParking?: boolean;
  isOperational: boolean;
  editorialSummary?: string;
  generativeSummary?: string;
  hours?: {
    openNow: boolean;
    weekdayText?: string[];
  };
  amenities?: string[];
  movedTo?: {
    id: string;
    name: string;
    address: string;
  };
}

interface GasStationAnalysis extends PlaceAnalysis {
  fuelPrices?: Array<{
    type: string;
    price: number;
    currency: string;
    lastUpdate: string;
  }>;
}

interface EVChargingAnalysis extends PlaceAnalysis {
  connectorCount?: number;
  connectorTypes?: Array<{
    type: string;
    count: number;
    maxChargeRateKw: number;
  }>;
  chargingSummary?: string;
}

// ===========================
// SERVICE IMPLEMENTATION
// ===========================

export class EnhancedPropertyIntelligenceV2Service {
  private logger: Logger;
  private cache: GenericCacheService;
  private placesService: GooglePlacesNewService;

  constructor() {
    this.logger = new Logger();
    this.cache = new GenericCacheService();
    this.placesService = new GooglePlacesNewService();
  }

  // ===========================
  // MAIN ANALYSIS
  // ===========================

  /**
   * Comprehensive property intelligence analysis
   */
  async analyzeProperty(
    coordinates: Coordinates,
    propertyAddress?: string
  ): Promise<PropertyIntelligenceAnalysis> {
    try {
      const cacheKey = `property-intelligence-v2:${coordinates.latitude},${coordinates.longitude}`;
      const cached = await this.cache.get<PropertyIntelligenceAnalysis>(cacheKey);
      if (cached) return cached;

      this.logger.info('Starting comprehensive property intelligence analysis', { coordinates });

      // Parallel analysis for efficiency
      const [
        locationContext,
        amenitiesAnalysis,
        accessibilityScore,
        sustainabilityScore,
        relocatedBusinesses
      ] = await Promise.all([
        this.analyzeLocationContext(coordinates, propertyAddress),
        this.analyzeAmenities(coordinates),
        this.analyzeAccessibility(coordinates),
        this.analyzeSustainability(coordinates),
        this.trackRelocatedBusinesses(coordinates)
      ]);

      // Calculate quality indicators
      const qualityIndicators = this.calculateQualityIndicators(amenitiesAnalysis);

      // Calculate overall desirability score
      const desirabilityScore = this.calculateDesirabilityScore({
        locationContext,
        amenitiesAnalysis,
        accessibilityScore,
        sustainabilityScore,
        qualityIndicators
      });

      // Generate market intelligence
      const marketIntelligence = this.generateMarketIntelligence({
        locationContext,
        amenitiesAnalysis,
        qualityIndicators
      });

      const analysis: PropertyIntelligenceAnalysis = {
        locationContext,
        amenitiesAnalysis,
        accessibilityScore,
        sustainabilityScore,
        qualityIndicators,
        desirabilityScore,
        marketIntelligence,
        relocatedBusinesses
      };

      // Cache for 6 hours
      await this.cache.set(cacheKey, analysis, 6 * 60 * 60);

      return analysis;

    } catch (error) {
      this.logger.error('Failed to analyze property', { error, coordinates });
      throw error;
    }
  }

  // ===========================
  // LOCATION CONTEXT ANALYSIS
  // ===========================

  private async analyzeLocationContext(
    coordinates: Coordinates,
    propertyAddress?: string
  ): Promise<PropertyIntelligenceAnalysis['locationContext']> {
    try {
      const locationData = await this.placesService.analyzePropertyLocation(coordinates, propertyAddress);

      const nearbyLandmarks = locationData.addressDescriptor?.landmarks.map(landmark => ({
        name: landmark.displayName.text,
        type: landmark.types[0] || 'landmark',
        distance: landmark.straightLineDistanceMeters,
        spatialRelationship: landmark.spatialRelationship || 'NEAR',
        description: this.generateLandmarkDescription(landmark)
      })) || [];

      const containingAreas = locationData.addressDescriptor?.areas.map(area => ({
        name: area.displayName.text,
        type: 'area',
        containment: area.containment
      })) || [];

      // Try to get neighborhood summary from a nearby place
      const nearbyPlace = locationData.nearbyLandmarks[0];
      let neighborhoodSummary: string | null = null;
      
      if (nearbyPlace) {
        const details = await this.placesService.getPlaceDetails(
          nearbyPlace.id,
          { pro: true, atmosphere: true, customFields: ['neighborhoodSummary'] }
        );
        neighborhoodSummary = details?.neighborhoodSummary?.text || null;
      }

      return {
        addressDescriptor: locationData.addressDescriptor,
        nearbyLandmarks,
        containingAreas,
        neighborhoodSummary
      };

    } catch (error) {
      this.logger.error('Failed to analyze location context', { error, coordinates });
      return {
        addressDescriptor: null,
        nearbyLandmarks: [],
        containingAreas: [],
        neighborhoodSummary: null
      };
    }
  }

  // ===========================
  // AMENITIES ANALYSIS
  // ===========================

  private async analyzeAmenities(
    coordinates: Coordinates
  ): Promise<PropertyIntelligenceAnalysis['amenitiesAnalysis']> {
    try {
      const [
        groceryStores,
        schools,
        hospitals,
        pharmacies,
        restaurants,
        cafes,
        banks,
        gasStations,
        parks,
        gyms,
        entertainment,
        transitStations,
        evChargingStations
      ] = await Promise.all([
        this.findAndAnalyzePlaces(coordinates, ['grocery_store', 'supermarket'], 2000),
        this.findAndAnalyzePlaces(coordinates, ['school', 'primary_school', 'secondary_school'], 3000),
        this.findAndAnalyzePlaces(coordinates, ['hospital', 'doctor', 'clinic'], 5000),
        this.findAndAnalyzePlaces(coordinates, ['pharmacy', 'drugstore'], 2000),
        this.findAndAnalyzePlaces(coordinates, ['restaurant'], 1000, 10),
        this.findAndAnalyzePlaces(coordinates, ['cafe', 'coffee_shop'], 1000, 10),
        this.findAndAnalyzePlaces(coordinates, ['bank', 'atm'], 2000),
        this.findGasStations(coordinates, 5000),
        this.findAndAnalyzePlaces(coordinates, ['park'], 2000),
        this.findAndAnalyzePlaces(coordinates, ['gym', 'fitness_center'], 3000),
        this.findAndAnalyzePlaces(coordinates, ['movie_theater', 'shopping_mall', 'museum', 'art_gallery'], 5000),
        this.findAndAnalyzePlaces(coordinates, ['transit_station', 'subway_station', 'train_station', 'bus_station'], 2000),
        this.findEVChargingStations(coordinates, 5000)
      ]);

      return {
        essential: {
          groceryStores,
          schools,
          hospitals,
          pharmacies
        },
        convenience: {
          restaurants,
          cafes,
          banks,
          gasStations
        },
        recreation: {
          parks,
          gyms,
          entertainment
        },
        transportation: {
          transitStations,
          evChargingStations
        }
      };

    } catch (error) {
      this.logger.error('Failed to analyze amenities', { error, coordinates });
      throw error;
    }
  }

  // ===========================
  // ACCESSIBILITY ANALYSIS
  // ===========================

  private async analyzeAccessibility(
    coordinates: Coordinates
  ): Promise<PropertyIntelligenceAnalysis['accessibilityScore']> {
    try {
      const accessiblePlaces = await this.placesService.findAccessiblePlaces(
        coordinates,
        ['restaurant', 'grocery_store', 'pharmacy', 'hospital', 'bank', 'transit_station'],
        2000
      );

      const wheelchairAccessibleVenues = accessiblePlaces.length;
      const accessibleParking = accessiblePlaces.filter(p => 
        p.accessibilityOptions?.wheelchairAccessibleParking === true
      ).length;
      const accessibleTransit = accessiblePlaces.filter(p => 
        p.primaryType === 'transit_station' && 
        p.accessibilityOptions?.wheelchairAccessibleEntrance === true
      ).length;

      const overall = this.calculateAccessibilityScore({
        wheelchairAccessibleVenues,
        accessibleParking,
        accessibleTransit
      });

      const rating = this.getAccessibilityRating(overall);

      const details = [
        `${wheelchairAccessibleVenues} wheelchair-accessible venues within 2km`,
        `${accessibleParking} venues with accessible parking`,
        `${accessibleTransit} accessible transit stations`
      ];

      return {
        overall,
        wheelchairAccessibleVenues,
        accessibleParking,
        accessibleTransit,
        accessibilityRating: rating,
        details
      };

    } catch (error) {
      this.logger.error('Failed to analyze accessibility', { error, coordinates });
      return {
        overall: 0,
        wheelchairAccessibleVenues: 0,
        accessibleParking: 0,
        accessibleTransit: 0,
        accessibilityRating: 'poor',
        details: []
      };
    }
  }

  // ===========================
  // SUSTAINABILITY ANALYSIS
  // ===========================

  private async analyzeSustainability(
    coordinates: Coordinates
  ): Promise<PropertyIntelligenceAnalysis['sustainabilityScore']> {
    try {
      const [evStations1km, evStations5km, transitStations] = await Promise.all([
        this.placesService.findEVChargingStations(coordinates, 1000),
        this.placesService.findEVChargingStations(coordinates, 5000),
        this.placesService.searchNearby(
          coordinates,
          {
            includedTypes: ['transit_station', 'subway_station', 'train_station'],
            maxResultCount: 10,
            locationRestriction: { circle: { center: coordinates, radius: 1000 } }
          },
          { essentials: true, pro: true }
        )
      ]);

      const evChargingAvailability = Math.min(100, (evStations5km.length / 10) * 100);
      const transitAccessibility = Math.min(100, (transitStations.length / 5) * 100);
      
      // Walkability based on nearby amenities
      const walkability = await this.calculateWalkability(coordinates);
      const bikeability = 70; // Placeholder - would need bike lane data

      const overall = (
        evChargingAvailability * 0.2 +
        transitAccessibility * 0.3 +
        walkability * 0.3 +
        bikeability * 0.2
      );

      const rating = this.getSustainabilityRating(overall);

      const details = [
        `${evStations1km.length} EV charging stations within 1km`,
        `${evStations5km.length} EV charging stations within 5km`,
        `${transitStations.length} transit stations within 1km`,
        `Walkability score: ${walkability.toFixed(0)}/100`
      ];

      return {
        evChargingAvailability,
        evStationsWithin1km: evStations1km.length,
        evStationsWithin5km: evStations5km.length,
        transitAccessibility,
        walkability,
        bikeability,
        sustainabilityRating: rating,
        details
      };

    } catch (error) {
      this.logger.error('Failed to analyze sustainability', { error, coordinates });
      return {
        evChargingAvailability: 0,
        evStationsWithin1km: 0,
        evStationsWithin5km: 0,
        transitAccessibility: 0,
        walkability: 0,
        bikeability: 0,
        sustainabilityRating: 'poor',
        details: []
      };
    }
  }

  // ===========================
  // RELOCATION TRACKING
  // ===========================

  private async trackRelocatedBusinesses(
    coordinates: Coordinates
  ): Promise<PropertyIntelligenceAnalysis['relocatedBusinesses']> {
    try {
      // Search for closed businesses nearby
      const places = await this.placesService.searchNearby(
        coordinates,
        {
          maxResultCount: 20,
          locationRestriction: {
            circle: { center: coordinates, radius: 1000 }
          }
        },
        { basic: true, essentials: true, pro: true }
      );

      const relocated: PropertyIntelligenceAnalysis['relocatedBusinesses'] = [];

      for (const place of places) {
        if (place.businessStatus === 'CLOSED_PERMANENTLY' && place.movedPlaceId) {
          const newLocation = await this.placesService.getPlaceDetails(
            place.movedPlaceId,
            { essentials: true, pro: true }
          );

          if (newLocation) {
            relocated.push({
              originalName: place.displayName?.text || 'Unknown',
              originalId: place.id,
              newName: newLocation.displayName?.text || 'Unknown',
              newId: newLocation.id,
              newAddress: newLocation.formattedAddress || 'Unknown'
            });
          }
        }
      }

      return relocated;

    } catch (error) {
      this.logger.error('Failed to track relocated businesses', { error, coordinates });
      return [];
    }
  }

  // ===========================
  // HELPER METHODS
  // ===========================

  private async findAndAnalyzePlaces(
    coordinates: Coordinates,
    types: string[],
    radiusMeters: number,
    maxCount: number = 5
  ): Promise<PlaceAnalysis[]> {
    try {
      const places = await this.placesService.searchNearby(
        coordinates,
        {
          includedTypes: types,
          maxResultCount: maxCount,
          rankPreference: 'DISTANCE',
          locationRestriction: {
            circle: { center: coordinates, radius: radiusMeters }
          }
        },
        {
          essentials: true,
          pro: true,
          enterprise: true,
          atmosphere: true
        }
      );

      return places.map(place => this.convertToPlaceAnalysis(place, coordinates));

    } catch (error) {
      this.logger.error('Failed to find and analyze places', { error, types });
      return [];
    }
  }

  private async findGasStations(
    coordinates: Coordinates,
    radiusMeters: number
  ): Promise<GasStationAnalysis[]> {
    try {
      const stations = await this.placesService.findGasStations(coordinates, radiusMeters);

      return stations.map(station => ({
        ...this.convertToPlaceAnalysis(station, coordinates),
        ...(station.fuelOptions?.fuelPrices && {
          fuelPrices: station.fuelOptions.fuelPrices.map(fp => ({
            type: fp.type,
            price: parseFloat(fp.price.units) + (fp.price.nanos / 1e9),
            currency: fp.price.currencyCode,
            lastUpdate: fp.updateTime
          }))
        })
      }));

    } catch (error) {
      this.logger.error('Failed to find gas stations', { error });
      return [];
    }
  }

  private async findEVChargingStations(
    coordinates: Coordinates,
    radiusMeters: number
  ): Promise<EVChargingAnalysis[]> {
    try {
      const stations = await this.placesService.findEVChargingStations(coordinates, radiusMeters);

      return stations.map(station => ({
        ...this.convertToPlaceAnalysis(station, coordinates),
        connectorCount: station.evChargeOptions?.connectorCount || 0,
        ...(station.evChargeOptions?.connectorAggregation && {
          connectorTypes: station.evChargeOptions.connectorAggregation.map(ca => ({
            type: ca.type,
            count: ca.count,
            maxChargeRateKw: ca.maxChargeRateKw
          }))
        }),
        ...(station.evChargeAmenitySummary?.summary && {
          chargingSummary: station.evChargeAmenitySummary.summary
        })
      }));

    } catch (error) {
      this.logger.error('Failed to find EV charging stations', { error });
      return [];
    }
  }

  private convertToPlaceAnalysis(
    place: PlaceDetails,
    fromCoordinates: Coordinates
  ): PlaceAnalysis {
    const distance = place.location 
      ? this.haversineDistance(fromCoordinates, place.location)
      : 0;

    return {
      id: place.id,
      name: place.displayName?.text || 'Unknown',
      type: place.primaryType || place.types?.[0] || 'unknown',
      distance,
      ...(place.rating !== undefined && { rating: place.rating }),
      ...(place.userRatingCount !== undefined && { userRatingCount: place.userRatingCount }),
      ...(place.priceLevel && { priceLevel: place.priceLevel }),
      ...(place.accessibilityOptions?.wheelchairAccessibleEntrance !== undefined && { 
        isAccessible: place.accessibilityOptions.wheelchairAccessibleEntrance 
      }),
      ...(place.parkingOptions && {
        hasParking: !!(place.parkingOptions.freeParkingLot || place.parkingOptions.freeStreetParking || 
                       place.parkingOptions.paidParkingLot || place.parkingOptions.paidStreetParking)
      }),
      isOperational: place.businessStatus === 'OPERATIONAL',
      ...(place.editorialSummary?.text && { editorialSummary: place.editorialSummary.text }),
      ...(place.generativeSummary?.overview?.text && { generativeSummary: place.generativeSummary.overview.text }),
      ...(place.currentOpeningHours && {
        hours: {
          openNow: place.currentOpeningHours.openNow || false,
          ...(place.currentOpeningHours.weekdayDescriptions && {
            weekdayText: place.currentOpeningHours.weekdayDescriptions
          })
        }
      }),
      amenities: this.extractAmenities(place),
      ...(place.movedPlaceId && {
        movedTo: {
          id: place.movedPlaceId,
          name: 'Relocated',
          address: ''
        }
      })
    };
  }

  private extractAmenities(place: PlaceDetails): string[] {
    const amenities: string[] = [];

    if (place.delivery) amenities.push('Delivery');
    if (place.takeout) amenities.push('Takeout');
    if (place.dineIn) amenities.push('Dine-in');
    if (place.reservable) amenities.push('Reservations');
    if (place.outdoorSeating) amenities.push('Outdoor Seating');
    if (place.liveMusic) amenities.push('Live Music');
    if (place.goodForChildren) amenities.push('Kid-Friendly');
    if (place.goodForGroups) amenities.push('Group-Friendly');
    if (place.allowsDogs) amenities.push('Pet-Friendly');
    if (place.servesVegetarianFood) amenities.push('Vegetarian Options');

    return amenities;
  }

  private calculateQualityIndicators(
    amenitiesAnalysis: PropertyIntelligenceAnalysis['amenitiesAnalysis']
  ): PropertyIntelligenceAnalysis['qualityIndicators'] {
    const allPlaces = [
      ...amenitiesAnalysis.essential.groceryStores,
      ...amenitiesAnalysis.essential.schools,
      ...amenitiesAnalysis.essential.hospitals,
      ...amenitiesAnalysis.essential.pharmacies,
      ...amenitiesAnalysis.convenience.restaurants,
      ...amenitiesAnalysis.convenience.cafes,
      ...amenitiesAnalysis.convenience.banks,
      ...amenitiesAnalysis.recreation.parks,
      ...amenitiesAnalysis.recreation.gyms,
      ...amenitiesAnalysis.recreation.entertainment
    ];

    const placesWithRating = allPlaces.filter(p => p.rating && p.rating > 0);
    const averageRating = placesWithRating.length > 0
      ? placesWithRating.reduce((sum, p) => sum + (p.rating || 0), 0) / placesWithRating.length
      : 0;

    const numberOfReviews = allPlaces.reduce((sum, p) => sum + (p.userRatingCount || 0), 0);
    
    const premiumEstablishments = allPlaces.filter(p => 
      p.priceLevel === 'PRICE_LEVEL_EXPENSIVE' || p.priceLevel === 'PRICE_LEVEL_VERY_EXPENSIVE'
    ).length;

    const editorialSummaries = allPlaces
      .map(p => p.editorialSummary)
      .filter((s): s is string => !!s);

    const generativeSummaries = allPlaces
      .map(p => p.generativeSummary)
      .filter((s): s is string => !!s);

    return {
      averageRating,
      numberOfReviews,
      premiumEstablishments,
      chainVsLocal: {
        chains: 0, // Would need chain detection logic
        local: allPlaces.length,
        ratio: 1
      },
      editorialSummaries,
      generativeSummaries
    };
  }

  private calculateDesirabilityScore(data: {
    locationContext: PropertyIntelligenceAnalysis['locationContext'];
    amenitiesAnalysis: PropertyIntelligenceAnalysis['amenitiesAnalysis'];
    accessibilityScore: PropertyIntelligenceAnalysis['accessibilityScore'];
    sustainabilityScore: PropertyIntelligenceAnalysis['sustainabilityScore'];
    qualityIndicators: PropertyIntelligenceAnalysis['qualityIndicators'];
  }): PropertyIntelligenceAnalysis['desirabilityScore'] {
    const components = {
      locationContext: this.scoreLocationContext(data.locationContext),
      amenityAccess: this.scoreAmenityAccess(data.amenitiesAnalysis),
      accessibility: data.accessibilityScore.overall,
      sustainability: (
        data.sustainabilityScore.evChargingAvailability +
        data.sustainabilityScore.transitAccessibility +
        data.sustainabilityScore.walkability
      ) / 3,
      quality: (data.qualityIndicators.averageRating / 5) * 100
    };

    const overall = (
      components.locationContext * 0.25 +
      components.amenityAccess * 0.25 +
      components.accessibility * 0.15 +
      components.sustainability * 0.2 +
      components.quality * 0.15
    );

    const strengths = this.identifyStrengths(components, data);
    const weaknesses = this.identifyWeaknesses(components, data);
    const uniqueFeatures = this.identifyUniqueFeatures(data);

    return {
      overall,
      components,
      strengths,
      weaknesses,
      uniqueFeatures
    };
  }

  private generateMarketIntelligence(data: {
    locationContext: PropertyIntelligenceAnalysis['locationContext'];
    amenitiesAnalysis: PropertyIntelligenceAnalysis['amenitiesAnalysis'];
    qualityIndicators: PropertyIntelligenceAnalysis['qualityIndicators'];
  }): PropertyIntelligenceAnalysis['marketIntelligence'] {
    const demographicIndicators: string[] = [];
    const lifestyleIndicators: string[] = [];

    // Analyze restaurant/cafe density for demographic insights
    const restaurantCount = data.amenitiesAnalysis.convenience.restaurants.length;
    const cafeCount = data.amenitiesAnalysis.convenience.cafes.length;

    if (restaurantCount > 10) {
      demographicIndicators.push('High restaurant density suggests urban/commercial area');
      lifestyleIndicators.push('Dining-centric lifestyle');
    }

    if (cafeCount > 5) {
      lifestyleIndicators.push('Coffee culture, potential coworking presence');
    }

    // Analyze quality indicators
    if (data.qualityIndicators.premiumEstablishments > 3) {
      demographicIndicators.push('Affluent area with upscale establishments');
      lifestyleIndicators.push('Premium lifestyle preferences');
    }

    if (data.qualityIndicators.averageRating > 4.2) {
      lifestyleIndicators.push('Quality-conscious community');
    }

    // Determine price level
    const premiumRatio = data.qualityIndicators.premiumEstablishments / 
      (restaurantCount + cafeCount || 1);
    const priceLevel = premiumRatio > 0.3 ? 'Premium' : 
                       premiumRatio > 0.15 ? 'Above Average' : 'Average';

    // Comparable areas from containingAreas
    const comparableAreas = data.locationContext.containingAreas.map(a => a.name);

    return {
      demographicIndicators,
      lifestyleIndicators,
      priceLevel,
      comparableAreas
    };
  }

  // Additional helper methods...
  
  private scoreLocationContext(context: PropertyIntelligenceAnalysis['locationContext']): number {
    let score = 50; // Base score

    if (context.addressDescriptor) {
      score += 20; // Has address descriptor
      score += Math.min(20, context.nearbyLandmarks.length * 5); // Up to 20 points for landmarks
      score += Math.min(10, context.containingAreas.length * 5); // Up to 10 points for areas
    }

    return Math.min(100, score);
  }

  private scoreAmenityAccess(amenities: PropertyIntelligenceAnalysis['amenitiesAnalysis']): number {
    const weights = {
      groceryStores: 15,
      schools: 10,
      hospitals: 10,
      pharmacies: 5,
      restaurants: 10,
      cafes: 5,
      banks: 5,
      parks: 10,
      gyms: 5,
      entertainment: 10,
      transitStations: 15
    };

    let score = 0;

    score += Math.min(weights.groceryStores, amenities.essential.groceryStores.length * 5);
    score += Math.min(weights.schools, amenities.essential.schools.length * 3);
    score += Math.min(weights.hospitals, amenities.essential.hospitals.length * 5);
    score += Math.min(weights.pharmacies, amenities.essential.pharmacies.length * 2.5);
    score += Math.min(weights.restaurants, amenities.convenience.restaurants.length * 2);
    score += Math.min(weights.cafes, amenities.convenience.cafes.length * 2);
    score += Math.min(weights.banks, amenities.convenience.banks.length * 2.5);
    score += Math.min(weights.parks, amenities.recreation.parks.length * 5);
    score += Math.min(weights.gyms, amenities.recreation.gyms.length * 2.5);
    score += Math.min(weights.entertainment, amenities.recreation.entertainment.length * 3);
    score += Math.min(weights.transitStations, amenities.transportation.transitStations.length * 5);

    return Math.min(100, score);
  }

  private identifyStrengths(
    components: PropertyIntelligenceAnalysis['desirabilityScore']['components'],
    data: any
  ): string[] {
    const strengths: string[] = [];

    if (components.locationContext > 80) {
      strengths.push('Excellent location with strong landmark presence');
    }

    if (components.amenityAccess > 80) {
      strengths.push('Outstanding amenity access and convenience');
    }

    if (components.accessibility > 75) {
      strengths.push('Highly accessible area with wheelchair-friendly venues');
    }

    if (components.sustainability > 75) {
      strengths.push('Strong sustainability infrastructure (EV charging, transit)');
    }

    if (components.quality > 80) {
      strengths.push('High-quality establishments with excellent ratings');
    }

    return strengths;
  }

  private identifyWeaknesses(
    components: PropertyIntelligenceAnalysis['desirabilityScore']['components'],
    data: any
  ): string[] {
    const weaknesses: string[] = [];

    if (components.locationContext < 40) {
      weaknesses.push('Limited landmark presence or area definition');
    }

    if (components.amenityAccess < 40) {
      weaknesses.push('Limited nearby amenities and services');
    }

    if (components.accessibility < 40) {
      weaknesses.push('Poor accessibility infrastructure');
    }

    if (components.sustainability < 40) {
      weaknesses.push('Limited sustainable transportation options');
    }

    if (components.quality < 60) {
      weaknesses.push('Lower-rated establishments in the area');
    }

    return weaknesses;
  }

  private identifyUniqueFeatures(data: any): string[] {
    const features: string[] = [];

    // Check for unique amenities or characteristics
    if (data.amenitiesAnalysis.transportation.evChargingStations.length > 5) {
      features.push('Exceptional EV charging infrastructure');
    }

    if (data.locationContext.neighborhoodSummary) {
      features.push(`Distinctive neighborhood: ${data.locationContext.neighborhoodSummary}`);
    }

    if (data.qualityIndicators.premiumEstablishments > 5) {
      features.push('Premium retail and dining district');
    }

    if (data.relocatedBusinesses.length > 0) {
      features.push('Active business relocation activity in area');
    }

    return features;
  }

  private calculateAccessibilityScore(data: {
    wheelchairAccessibleVenues: number;
    accessibleParking: number;
    accessibleTransit: number;
  }): number {
    return Math.min(100, (
      (data.wheelchairAccessibleVenues / 20) * 50 +
      (data.accessibleParking / 10) * 30 +
      (data.accessibleTransit / 3) * 20
    ));
  }

  private getAccessibilityRating(score: number): 'excellent' | 'good' | 'fair' | 'limited' | 'poor' {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    if (score >= 20) return 'limited';
    return 'poor';
  }

  private getSustainabilityRating(score: number): 'excellent' | 'good' | 'fair' | 'limited' | 'poor' {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    if (score >= 20) return 'limited';
    return 'poor';
  }

  private async calculateWalkability(coordinates: Coordinates): Promise<number> {
    // Simple walkability based on nearby amenities within walking distance (800m)
    const nearbyPlaces = await this.placesService.searchNearby(
      coordinates,
      {
        includedTypes: ['restaurant', 'grocery_store', 'pharmacy', 'cafe', 'park'],
        maxResultCount: 20,
        locationRestriction: {
          circle: { center: coordinates, radius: 800 }
        }
      },
      { essentials: true }
    );

    return Math.min(100, (nearbyPlaces.length / 15) * 100);
  }

  private generateLandmarkDescription(landmark: any): string {
    const relationship = landmark.spatialRelationship || 'near';
    const distance = landmark.straightLineDistanceMeters;
    const distanceText = distance < 100 ? 'very close to' :
                        distance < 300 ? 'close to' :
                        distance < 500 ? 'near' : 'within walking distance of';

    return `${distanceText} ${landmark.displayName.text} (${relationship.toLowerCase()})`;
  }

  private haversineDistance(
    coord1: { latitude: number; longitude: number },
    coord2: { latitude: number; longitude: number }
  ): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = coord1.latitude * Math.PI / 180;
    const φ2 = coord2.latitude * Math.PI / 180;
    const Δφ = (coord2.latitude - coord1.latitude) * Math.PI / 180;
    const Δλ = (coord2.longitude - coord1.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}
