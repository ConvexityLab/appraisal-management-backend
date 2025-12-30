/**
 * Google Places API (New) Service
 * 
 * Modern implementation using Places API v1 with comprehensive features:
 * - Field masking for cost optimization
 * - Address descriptors with landmark context
 * - Rich metadata (editorial summaries, reviews, photos)
 * - Accessibility and EV charging information
 * - Moved place tracking
 * - Enhanced search with natural language understanding
 */

import { Logger } from '../utils/logger';
import { GenericCacheService } from './cache/generic-cache.service';
import { Coordinates } from '../types/geospatial';

// ===========================
// TYPE DEFINITIONS
// ===========================

export interface PlacesNewSearchOptions {
  includedTypes?: string[];
  excludedTypes?: string[];
  maxResultCount?: number;
  locationRestriction?: {
    circle?: {
      center: { latitude: number; longitude: number };
      radius: number;
    };
    rectangle?: {
      low: { latitude: number; longitude: number };
      high: { latitude: number; longitude: number };
    };
  };
  rankPreference?: 'RANK_PREFERENCE_UNSPECIFIED' | 'DISTANCE' | 'POPULARITY';
  languageCode?: string;
  regionCode?: string;
}

export interface PlaceDetailsFieldMask {
  // ID Only SKU (cheapest)
  basic?: boolean; // id, name, photos, attributions
  
  // Essentials SKU
  essentials?: boolean; // addressComponents, location, types, viewport, etc.
  
  // Pro SKU
  pro?: boolean; // displayName, businessStatus, googleMapsUri, primaryType, etc.
  
  // Enterprise SKU
  enterprise?: boolean; // hours, phone, rating, reviews, website, etc.
  
  // Enterprise + Atmosphere SKU (most expensive)
  atmosphere?: boolean; // amenities, ambiance, services, etc.
  
  // Custom field selection
  customFields?: string[];
}

export interface AddressDescriptor {
  landmarks: Array<{
    name: string;
    placeId: string;
    displayName: { text: string; languageCode: string };
    types: string[];
    spatialRelationship?: 'NEAR' | 'WITHIN' | 'BESIDE' | 'ACROSS_THE_ROAD';
    straightLineDistanceMeters: number;
  }>;
  areas: Array<{
    name: string;
    placeId: string;
    displayName: { text: string; languageCode: string };
    containment: 'WITHIN' | 'OUTSKIRTS';
  }>;
}

export interface PlaceDetails {
  // Core identification
  id: string;
  name: string; // Resource name (places/ChIJ...)
  displayName: { text: string; languageCode: string };
  
  // Location & Address
  formattedAddress?: string;
  shortFormattedAddress?: string;
  addressComponents?: Array<{
    longText: string;
    shortText: string;
    types: string[];
  }>;
  addressDescriptor?: AddressDescriptor;
  location?: { latitude: number; longitude: number };
  viewport?: {
    low: { latitude: number; longitude: number };
    high: { latitude: number; longitude: number };
  };
  plusCode?: {
    globalCode: string;
    compoundCode: string;
  };
  
  // Business Information
  businessStatus?: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY';
  primaryType?: string;
  primaryTypeDisplayName?: { text: string; languageCode: string };
  types?: string[];
  
  // Moved Place Tracking
  movedPlace?: string; // New place resource name
  movedPlaceId?: string; // New place ID
  
  // Contact & Web Presence
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  googleMapsLinks?: {
    directionsUri: string;
    photosUri: string;
    placeUri: string;
    reviewsUri: string;
    writeReviewUri: string;
  };
  
  // Hours & Availability
  currentOpeningHours?: OpeningHours;
  regularOpeningHours?: OpeningHours;
  currentSecondaryOpeningHours?: OpeningHours[];
  regularSecondaryOpeningHours?: OpeningHours[];
  
  // Ratings & Reviews
  rating?: number;
  userRatingCount?: number;
  reviews?: Review[];
  reviewSummary?: {
    rating: number;
    text: string;
  };
  
  // Rich Content
  photos?: Photo[];
  editorialSummary?: { text: string; languageCode: string };
  generativeSummary?: { overview: { text: string; languageCode: string } };
  neighborhoodSummary?: { text: string; languageCode: string };
  
  // Pricing
  priceLevel?: 'PRICE_LEVEL_FREE' | 'PRICE_LEVEL_INEXPENSIVE' | 'PRICE_LEVEL_MODERATE' | 'PRICE_LEVEL_EXPENSIVE' | 'PRICE_LEVEL_VERY_EXPENSIVE';
  priceRange?: {
    startPrice: { currencyCode: string; units: string };
    endPrice: { currencyCode: string; units: string };
  };
  
  // Accessibility
  accessibilityOptions?: {
    wheelchairAccessibleParking?: boolean;
    wheelchairAccessibleEntrance?: boolean;
    wheelchairAccessibleRestroom?: boolean;
    wheelchairAccessibleSeating?: boolean;
  };
  
  // Parking
  parkingOptions?: {
    freeGarageParking?: boolean;
    freeParkingLot?: boolean;
    freeStreetParking?: boolean;
    paidGarageParking?: boolean;
    paidParkingLot?: boolean;
    paidStreetParking?: boolean;
    valetParking?: boolean;
  };
  
  // EV Charging
  evChargeOptions?: {
    connectorCount: number;
    connectorAggregation: Array<{
      type: string;
      count: number;
      maxChargeRateKw: number;
    }>;
  };
  evChargeAmenitySummary?: {
    summary: string;
  };
  
  // Fuel Options (for gas stations)
  fuelOptions?: {
    fuelPrices: Array<{
      type: string;
      price: { currencyCode: string; units: string; nanos: number };
      updateTime: string;
    }>;
  };
  
  // Services & Amenities
  allowsDogs?: boolean;
  curbsidePickup?: boolean;
  delivery?: boolean;
  dineIn?: boolean;
  goodForChildren?: boolean;
  goodForGroups?: boolean;
  goodForWatchingSports?: boolean;
  liveMusic?: boolean;
  menuForChildren?: boolean;
  outdoorSeating?: boolean;
  reservable?: boolean;
  restroom?: boolean;
  servesBeer?: boolean;
  servesBreakfast?: boolean;
  servesBrunch?: boolean;
  servesCocktails?: boolean;
  servesCoffee?: boolean;
  servesDessert?: boolean;
  servesDinner?: boolean;
  servesLunch?: boolean;
  servesVegetarianFood?: boolean;
  servesWine?: boolean;
  takeout?: boolean;
  
  // Payment Options
  paymentOptions?: {
    acceptsCreditCards?: boolean;
    acceptsDebitCards?: boolean;
    acceptsCashOnly?: boolean;
    acceptsNfc?: boolean;
  };
  
  // Hierarchical Relationships
  containingPlaces?: Array<{
    name: string;
    id: string;
    displayName: { text: string; languageCode: string };
  }>;
  subDestinations?: Array<{
    name: string;
    id: string;
    displayName: { text: string; languageCode: string };
  }>;
  
  // Navigation
  routingSummaries?: Array<{
    travelMode: string;
    durationSeconds: number;
    distanceMeters: number;
  }>;
  
  // Metadata
  utcOffsetMinutes?: number;
  adrFormatAddress?: string;
  iconBackgroundColor?: string;
  iconMaskBaseUri?: string;
  pureServiceAreaBusiness?: boolean; // Virtual business with no physical location
  attributions?: Array<{ provider: string; providerUri: string }>;
}

interface OpeningHours {
  openNow?: boolean;
  periods?: Array<{
    open: { day: number; hour: number; minute: number; date?: string };
    close?: { day: number; hour: number; minute: number; date?: string };
  }>;
  weekdayDescriptions?: string[];
  secondaryHoursType?: string;
  specialDays?: Array<{
    date: { year: number; month: number; day: number };
    exceptionalHours?: boolean;
  }>;
}

interface Review {
  name: string;
  relativePublishTimeDescription: string;
  rating: number;
  text: { text: string; languageCode: string };
  originalText?: { text: string; languageCode: string };
  authorAttribution: {
    displayName: string;
    uri: string;
    photoUri: string;
  };
  publishTime: string;
}

interface Photo {
  name: string;
  widthPx: number;
  heightPx: number;
  authorAttributions: Array<{
    displayName: string;
    uri: string;
    photoUri: string;
  }>;
}

export interface TextSearchRequest {
  textQuery: string;
  languageCode?: string;
  regionCode?: string;
  rankPreference?: 'RELEVANCE' | 'DISTANCE';
  locationBias?: {
    circle?: {
      center: { latitude: number; longitude: number };
      radius: number;
    };
    rectangle?: {
      low: { latitude: number; longitude: number };
      high: { latitude: number; longitude: number };
    };
  };
  includedType?: string;
  openNow?: boolean;
  minRating?: number;
  maxResultCount?: number;
  priceLevels?: string[];
  strictTypeFiltering?: boolean;
}

// ===========================
// SERVICE IMPLEMENTATION
// ===========================

export class GooglePlacesNewService {
  private logger: Logger;
  private cache: GenericCacheService;
  private apiKey: string;
  private baseUrl = 'https://places.googleapis.com/v1';

  constructor() {
    this.logger = new Logger();
    this.cache = new GenericCacheService();
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    
    if (!this.apiKey) {
      const error = 'Google Maps API key is required. Configure GOOGLE_MAPS_API_KEY environment variable.';
      this.logger.error(error);
      if (process.env.NODE_ENV === 'production') {
        throw new Error(error);
      }
      this.logger.warn('Running in development mode without Google Maps API - limited functionality');
    }
  }

  // ===========================
  // PLACE DETAILS
  // ===========================

  /**
   * Get comprehensive place details with field masking for cost control
   */
  async getPlaceDetails(
    placeId: string,
    fieldMask: PlaceDetailsFieldMask = { essentials: true, pro: true },
    options: {
      languageCode?: string;
      regionCode?: string;
      sessionToken?: string;
    } = {}
  ): Promise<PlaceDetails | null> {
    try {
      const cacheKey = `places-new:details:${placeId}:${JSON.stringify(fieldMask)}`;
      const cached = await this.cache.get<PlaceDetails>(cacheKey);
      if (cached) return cached;

      const fields = this.buildFieldMask(fieldMask);
      const url = `${this.baseUrl}/places/${placeId}`;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': fields
      };

      if (options.languageCode) {
        headers['Accept-Language'] = options.languageCode;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        this.logger.error('Place details request failed', {
          status: response.status,
          statusText: response.statusText,
          placeId
        });
        return null;
      }

      const placeDetails = await response.json() as PlaceDetails;
      
      // Cache for 6 hours (place details are relatively stable)
      await this.cache.set(cacheKey, placeDetails, 6 * 60 * 60);
      
      return placeDetails;

    } catch (error) {
      this.logger.error('Failed to get place details', { error, placeId });
      return null;
    }
  }

  /**
   * Follow moved place chain to get current location
   */
  async getMovedPlaceDetails(
    originalPlaceId: string,
    maxHops: number = 5
  ): Promise<PlaceDetails | null> {
    try {
      let currentPlaceId = originalPlaceId;
      let hops = 0;
      const visitedPlaces = new Set<string>();

      while (hops < maxHops) {
        if (visitedPlaces.has(currentPlaceId)) {
          this.logger.warn('Circular moved place reference detected', { originalPlaceId, currentPlaceId });
          break;
        }
        visitedPlaces.add(currentPlaceId);

        const details = await this.getPlaceDetails(
          currentPlaceId,
          { basic: true, essentials: true },
          {}
        );

        if (!details) {
          return null;
        }

        // If place is operational or has no moved location, this is the final place
        if (details.businessStatus === 'OPERATIONAL' || !details.movedPlaceId) {
          return details;
        }

        // Continue following the chain
        currentPlaceId = details.movedPlaceId;
        hops++;
      }

      this.logger.warn('Max hops reached following moved places', { originalPlaceId, hops });
      return null;

    } catch (error) {
      this.logger.error('Failed to follow moved place chain', { error, originalPlaceId });
      return null;
    }
  }

  // ===========================
  // NEARBY SEARCH
  // ===========================

  /**
   * Search for places near a location with field masking for cost optimization
   */
  async searchNearby(
    location: Coordinates,
    options: PlacesNewSearchOptions = {},
    fieldMask: PlaceDetailsFieldMask = { essentials: true, pro: true }
  ): Promise<PlaceDetails[]> {
    try {
      const cacheKey = `places-new:nearby:${location.latitude},${location.longitude}:${JSON.stringify(options)}`;
      const cached = await this.cache.get<PlaceDetails[]>(cacheKey);
      if (cached) return cached;

      const fields = this.buildFieldMask(fieldMask, true); // Add 'places.' prefix for search
      const url = `${this.baseUrl}/places:searchNearby`;
      
      const requestBody: any = {
        locationRestriction: options.locationRestriction || {
          circle: {
            center: {
              latitude: location.latitude,
              longitude: location.longitude
            },
            radius: 5000 // Default 5km radius
          }
        }
      };

      if (options.includedTypes && options.includedTypes.length > 0) {
        requestBody.includedTypes = options.includedTypes;
      }

      if (options.excludedTypes && options.excludedTypes.length > 0) {
        requestBody.excludedTypes = options.excludedTypes;
      }

      if (options.maxResultCount) {
        requestBody.maxResultCount = Math.min(options.maxResultCount, 20);
      }

      if (options.rankPreference) {
        requestBody.rankPreference = options.rankPreference;
      }

      if (options.languageCode) {
        requestBody.languageCode = options.languageCode;
      }

      if (options.regionCode) {
        requestBody.regionCode = options.regionCode;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': fields
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        this.logger.error('Nearby search request failed', {
          status: response.status,
          statusText: response.statusText,
          location
        });
        return [];
      }

      const data = await response.json();
      const places = data.places || [];
      
      // Cache for 1 hour (search results can change)
      await this.cache.set(cacheKey, places, 60 * 60);
      
      return places;

    } catch (error) {
      this.logger.error('Failed to search nearby places', { error, location });
      return [];
    }
  }

  // ===========================
  // TEXT SEARCH
  // ===========================

  /**
   * Search for places using natural language query
   */
  async searchText(
    request: TextSearchRequest,
    fieldMask: PlaceDetailsFieldMask = { essentials: true, pro: true }
  ): Promise<PlaceDetails[]> {
    try {
      const cacheKey = `places-new:text:${JSON.stringify(request)}`;
      const cached = await this.cache.get<PlaceDetails[]>(cacheKey);
      if (cached) return cached;

      const fields = this.buildFieldMask(fieldMask, true); // Add 'places.' prefix
      const url = `${this.baseUrl}/places:searchText`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': fields
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        this.logger.error('Text search request failed', {
          status: response.status,
          statusText: response.statusText,
          query: request.textQuery
        });
        return [];
      }

      const data = await response.json();
      const places = data.places || [];
      
      // Cache for 30 minutes (text search results can vary)
      await this.cache.set(cacheKey, places, 30 * 60);
      
      return places;

    } catch (error) {
      this.logger.error('Failed to text search places', { error, request });
      return [];
    }
  }

  // ===========================
  // PLACE PHOTOS
  // ===========================

  /**
   * Get place photo URL with specified dimensions
   */
  getPhotoUrl(
    photoName: string,
    options: {
      maxWidthPx?: number;
      maxHeightPx?: number;
      skipHttpRedirect?: boolean;
    } = {}
  ): string {
    const params = new URLSearchParams({
      key: this.apiKey
    });

    if (options.maxWidthPx) {
      params.append('maxWidthPx', options.maxWidthPx.toString());
    }

    if (options.maxHeightPx) {
      params.append('maxHeightPx', options.maxHeightPx.toString());
    }

    if (options.skipHttpRedirect) {
      params.append('skipHttpRedirect', 'true');
    }

    return `${this.baseUrl}/${photoName}/media?${params.toString()}`;
  }

  /**
   * Get photo metadata
   */
  async getPhotoMetadata(photoName: string): Promise<Photo | null> {
    try {
      const url = `${this.baseUrl}/${photoName}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey
        }
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();

    } catch (error) {
      this.logger.error('Failed to get photo metadata', { error, photoName });
      return null;
    }
  }

  // ===========================
  // AUTOCOMPLETE (NEW)
  // ===========================

  /**
   * Get autocomplete suggestions with session token support
   */
  async autocomplete(
    input: string,
    options: {
      locationBias?: {
        circle?: {
          center: { latitude: number; longitude: number };
          radius: number;
        };
        rectangle?: {
          low: { latitude: number; longitude: number };
          high: { latitude: number; longitude: number };
        };
      };
      locationRestriction?: {
        circle?: {
          center: { latitude: number; longitude: number };
          radius: number;
        };
        rectangle?: {
          low: { latitude: number; longitude: number };
          high: { latitude: number; longitude: number };
        };
      };
      includedPrimaryTypes?: string[];
      includedRegionCodes?: string[];
      languageCode?: string;
      regionCode?: string;
      origin?: { latitude: number; longitude: number };
      inputOffset?: number;
      includeQueryPredictions?: boolean;
      sessionToken?: string;
    } = {}
  ): Promise<any> {
    try {
      const url = `${this.baseUrl}/places:autocomplete`;
      
      const requestBody: any = {
        input
      };

      Object.assign(requestBody, options);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        this.logger.error('Autocomplete request failed', {
          status: response.status,
          statusText: response.statusText,
          input
        });
        return null;
      }

      return await response.json();

    } catch (error) {
      this.logger.error('Failed to get autocomplete suggestions', { error, input });
      return null;
    }
  }

  // ===========================
  // PROPERTY INTELLIGENCE HELPERS
  // ===========================

  /**
   * Analyze property with address descriptors for landmark context
   */
  async analyzePropertyLocation(
    coordinates: Coordinates,
    propertyAddress?: string
  ): Promise<{
    addressDescriptor: AddressDescriptor | null;
    nearbyLandmarks: PlaceDetails[];
    containingAreas: PlaceDetails[];
    proximityAnalysis: {
      nearestSchool?: { place: PlaceDetails; distanceMeters: number };
      nearestGrocery?: { place: PlaceDetails; distanceMeters: number };
      nearestTransit?: { place: PlaceDetails; distanceMeters: number };
      nearestPark?: { place: PlaceDetails; distanceMeters: number };
      nearestHospital?: { place: PlaceDetails; distanceMeters: number };
    };
  }> {
    try {
      // Search for place at exact coordinates to get address descriptor
      const places = await this.searchNearby(
        coordinates,
        {
          maxResultCount: 1,
          locationRestriction: {
            circle: {
              center: coordinates,
              radius: 50 // Very tight radius
            }
          }
        },
        { essentials: true, pro: true, customFields: ['addressDescriptor'] }
      );

      const addressDescriptor = places[0]?.addressDescriptor || null;

      // Get nearby important places for proximity analysis
      const [schools, groceries, transit, parks, hospitals] = await Promise.all([
        this.searchNearby(coordinates, {
          includedTypes: ['school', 'primary_school', 'secondary_school'],
          maxResultCount: 3,
          rankPreference: 'DISTANCE'
        }, { essentials: true, pro: true, enterprise: true }),
        
        this.searchNearby(coordinates, {
          includedTypes: ['grocery_store', 'supermarket'],
          maxResultCount: 3,
          rankPreference: 'DISTANCE'
        }, { essentials: true, pro: true, enterprise: true }),
        
        this.searchNearby(coordinates, {
          includedTypes: ['transit_station', 'subway_station', 'train_station', 'bus_station'],
          maxResultCount: 3,
          rankPreference: 'DISTANCE'
        }, { essentials: true, pro: true }),
        
        this.searchNearby(coordinates, {
          includedTypes: ['park'],
          maxResultCount: 3,
          rankPreference: 'DISTANCE'
        }, { essentials: true, pro: true, atmosphere: true }),
        
        this.searchNearby(coordinates, {
          includedTypes: ['hospital', 'doctor'],
          maxResultCount: 3,
          rankPreference: 'DISTANCE'
        }, { essentials: true, pro: true, enterprise: true })
      ]);

      const calculateDistance = (place: PlaceDetails): number => {
        if (!place.location) return Infinity;
        return this.haversineDistance(
          coordinates,
          place.location
        );
      };

      return {
        addressDescriptor,
        nearbyLandmarks: addressDescriptor?.landmarks.map(l => ({
          id: l.placeId,
          name: l.name,
          displayName: l.displayName
        } as PlaceDetails)) || [],
        containingAreas: addressDescriptor?.areas.map(a => ({
          id: a.placeId,
          name: a.name,
          displayName: a.displayName
        } as PlaceDetails)) || [],
        proximityAnalysis: {
          ...(schools[0] && { nearestSchool: { place: schools[0], distanceMeters: calculateDistance(schools[0]) } }),
          ...(groceries[0] && { nearestGrocery: { place: groceries[0], distanceMeters: calculateDistance(groceries[0]) } }),
          ...(transit[0] && { nearestTransit: { place: transit[0], distanceMeters: calculateDistance(transit[0]) } }),
          ...(parks[0] && { nearestPark: { place: parks[0], distanceMeters: calculateDistance(parks[0]) } }),
          ...(hospitals[0] && { nearestHospital: { place: hospitals[0], distanceMeters: calculateDistance(hospitals[0]) } })
        }
      };

    } catch (error) {
      this.logger.error('Failed to analyze property location', { error, coordinates });
      return {
        addressDescriptor: null,
        nearbyLandmarks: [],
        containingAreas: [],
        proximityAnalysis: {}
      };
    }
  }

  /**
   * Search for EV charging stations near property
   */
  async findEVChargingStations(
    coordinates: Coordinates,
    radiusMeters: number = 5000
  ): Promise<Array<PlaceDetails & { distance: number }>> {
    try {
      const stations = await this.searchNearby(
        coordinates,
        {
          includedTypes: ['electric_vehicle_charging_station'],
          maxResultCount: 20,
          rankPreference: 'DISTANCE',
          locationRestriction: {
            circle: {
              center: coordinates,
              radius: radiusMeters
            }
          }
        },
        {
          essentials: true,
          pro: true,
          enterprise: true,
          customFields: ['evChargeOptions', 'evChargeAmenitySummary']
        }
      );

      return stations
        .filter(s => s.location)
        .map(station => ({
          ...station,
          distance: this.haversineDistance(coordinates, station.location!)
        }))
        .sort((a, b) => a.distance - b.distance);

    } catch (error) {
      this.logger.error('Failed to find EV charging stations', { error, coordinates });
      return [];
    }
  }

  /**
   * Search for gas stations with fuel prices
   */
  async findGasStations(
    coordinates: Coordinates,
    radiusMeters: number = 5000
  ): Promise<Array<PlaceDetails & { distance: number }>> {
    try {
      const stations = await this.searchNearby(
        coordinates,
        {
          includedTypes: ['gas_station'],
          maxResultCount: 20,
          rankPreference: 'DISTANCE',
          locationRestriction: {
            circle: {
              center: coordinates,
              radius: radiusMeters
            }
          }
        },
        {
          essentials: true,
          pro: true,
          enterprise: true,
          customFields: ['fuelOptions']
        }
      );

      return stations
        .filter(s => s.location)
        .map(station => ({
          ...station,
          distance: this.haversineDistance(coordinates, station.location!)
        }))
        .sort((a, b) => a.distance - b.distance);

    } catch (error) {
      this.logger.error('Failed to find gas stations', { error, coordinates });
      return [];
    }
  }

  /**
   * Get accessibility-friendly places near property
   */
  async findAccessiblePlaces(
    coordinates: Coordinates,
    placeTypes: string[] = ['restaurant', 'grocery_store', 'pharmacy', 'hospital'],
    radiusMeters: number = 2000
  ): Promise<PlaceDetails[]> {
    try {
      const places = await this.searchNearby(
        coordinates,
        {
          includedTypes: placeTypes,
          maxResultCount: 20,
          rankPreference: 'DISTANCE',
          locationRestriction: {
            circle: {
              center: coordinates,
              radius: radiusMeters
            }
          }
        },
        {
          essentials: true,
          pro: true,
          customFields: ['accessibilityOptions', 'parkingOptions']
        }
      );

      // Filter to places with wheelchair accessibility
      return places.filter(place => 
        place.accessibilityOptions?.wheelchairAccessibleEntrance === true
      );

    } catch (error) {
      this.logger.error('Failed to find accessible places', { error, coordinates });
      return [];
    }
  }

  // ===========================
  // UTILITY METHODS
  // ===========================

  /**
   * Build field mask string from field mask options
   */
  private buildFieldMask(
    mask: PlaceDetailsFieldMask,
    forSearch: boolean = false
  ): string {
    const prefix = forSearch ? 'places.' : '';
    const fields: string[] = [];

    if (mask.customFields && mask.customFields.length > 0) {
      return mask.customFields.map(f => `${prefix}${f}`).join(',');
    }

    // ID Only SKU
    if (mask.basic) {
      fields.push('id', 'name', 'photos', 'attributions', 'moved_place', 'moved_place_id');
    }

    // Essentials SKU
    if (mask.essentials) {
      fields.push(
        'addressComponents',
        'addressDescriptor',
        'adrFormatAddress',
        'formattedAddress',
        'location',
        'plusCode',
        'shortFormattedAddress',
        'types',
        'viewport'
      );
    }

    // Pro SKU
    if (mask.pro) {
      fields.push(
        'accessibilityOptions',
        'businessStatus',
        'containingPlaces',
        'displayName',
        'googleMapsLinks',
        'googleMapsUri',
        'iconBackgroundColor',
        'iconMaskBaseUri',
        'primaryType',
        'primaryTypeDisplayName',
        'pureServiceAreaBusiness',
        'subDestinations',
        'utcOffsetMinutes'
      );
    }

    // Enterprise SKU
    if (mask.enterprise) {
      fields.push(
        'currentOpeningHours',
        'currentSecondaryOpeningHours',
        'internationalPhoneNumber',
        'nationalPhoneNumber',
        'priceLevel',
        'priceRange',
        'rating',
        'regularOpeningHours',
        'regularSecondaryOpeningHours',
        'userRatingCount',
        'websiteUri'
      );
    }

    // Enterprise + Atmosphere SKU
    if (mask.atmosphere) {
      fields.push(
        'allowsDogs',
        'curbsidePickup',
        'delivery',
        'dineIn',
        'editorialSummary',
        'evChargeOptions',
        'evChargeAmenitySummary',
        'fuelOptions',
        'generativeSummary',
        'goodForChildren',
        'goodForGroups',
        'goodForWatchingSports',
        'liveMusic',
        'menuForChildren',
        'neighborhoodSummary',
        'outdoorSeating',
        'parkingOptions',
        'paymentOptions',
        'reservable',
        'restroom',
        'reviews',
        'reviewSummary',
        'routingSummaries',
        'servesBeer',
        'servesBreakfast',
        'servesBrunch',
        'servesCocktails',
        'servesCoffee',
        'servesDessert',
        'servesDinner',
        'servesLunch',
        'servesVegetarianFood',
        'servesWine',
        'takeout'
      );
    }

    // Remove duplicates and add prefix
    const uniqueFields = [...new Set(fields)];
    return uniqueFields.map(f => `${prefix}${f}`).join(',');
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
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
