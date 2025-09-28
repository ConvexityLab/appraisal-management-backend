# Census Intelligence Service Documentation

## Overview

The Census Intelligence Service provides comprehensive demographic, economic, and housing analysis using official U.S. Census Bureau data. This service integrates American Community Survey (ACS) and Decennial Census data to deliver hyper-local insights at the Census Block Group level.

## Features

### 📊 Demographic Intelligence
- **Population Characteristics**: Age distribution, generational mix, population density and growth
- **Household Composition**: Family structure, household size, living arrangements
- **Diversity Metrics**: Racial/ethnic diversity using Simpson's Diversity Index, language diversity
- **Demographic Compatibility Scoring**: Community balance assessment for property investment

### 💰 Economic Intelligence  
- **Income Analysis**: Median household income, per capita income, income distribution
- **Employment Metrics**: Unemployment rates, labor force participation, industry composition
- **Economic Stability**: Poverty rates, public assistance usage, economic mobility indicators
- **Economic Vitality Scoring**: Overall economic health assessment

### 🏠 Housing Intelligence
- **Housing Stock Analysis**: Total units, occupancy rates, housing types, age of structures  
- **Housing Affordability**: Home values, rent levels, cost burden analysis
- **Market Dynamics**: Ownership vs rental rates, vacancy rates, market velocity
- **Housing Market Scoring**: Investment opportunity assessment

## API Endpoints

### Demographics Analysis
```bash
POST /api/property-intelligence/census/demographics
```

**Request Body:**
```json
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "propertyId": "optional-property-id"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "demographicCompatibilityScore": 78,
    "populationCharacteristics": {
      "totalPopulation": 3242,
      "ageDistribution": {
        "under18": 22.5,
        "age18to34": 28.3,
        "age35to54": 31.2,
        "age55to74": 14.8,
        "over75": 3.2
      },
      "generationalMix": {
        "genZ": 28.1,
        "millennials": 35.4,
        "genX": 24.9,
        "boomers": 14.8,
        "silent": 3.2
      }
    },
    "householdComposition": {
      "averageHouseholdSize": 2.4,
      "familyHouseholds": 68.3,
      "singlePersonHouseholds": 23.7
    },
    "diversityMetrics": {
      "racialDiversityIndex": 72,
      "ethnicComposition": {
        "white": 45.2,
        "black": 23.1,
        "hispanic": 18.7,
        "asian": 9.4,
        "nativeAmerican": 1.2,
        "pacificIslander": 0.3,
        "multiracial": 2.1
      },
      "languageDiversity": {
        "englishOnly": 68.4,
        "spanish": 21.3,
        "otherLanguages": 10.3
      }
    }
  },
  "metadata": {
    "processingTime": 1245,
    "dataSource": "U.S. Census Bureau ACS 2022",
    "geographicLevel": "Census Block Group",
    "lastUpdated": "2024-01-15T10:30:00Z"
  }
}
```

### Economic Analysis
```bash
POST /api/property-intelligence/census/economics
```

**Response:**
```json
{
  "success": true,
  "data": {
    "economicVitalityScore": 82,
    "incomeMetrics": {
      "medianHouseholdIncome": 67500,
      "incomeDistribution": {
        "under25k": 12.3,
        "income25to50k": 18.7,
        "income50to75k": 24.1,
        "income75to100k": 19.8,
        "income100to150k": 16.4,
        "over150k": 8.7
      }
    },
    "employmentCharacteristics": {
      "unemploymentRate": 4.2,
      "laborForceParticipation": 73.8,
      "employmentByIndustry": {
        "professional": 18.3,
        "healthcare": 14.7,
        "retail": 12.1,
        "manufacturing": 8.9,
        "education": 11.2,
        "government": 9.4,
        "technology": 7.8,
        "finance": 6.2
      },
      "workFromHomeRate": 28.4
    },
    "economicStability": {
      "povertyRate": 8.9,
      "economicMobilityIndex": 74
    }
  }
}
```

### Housing Analysis
```bash
POST /api/property-intelligence/census/housing
```

**Response:**
```json
{
  "success": true,
  "data": {
    "housingMarketScore": 75,
    "housingStock": {
      "totalHousingUnits": 1456,
      "occupancyRate": 94.2,
      "vacancyRate": 5.8,
      "ownerOccupiedRate": 72.3,
      "renterOccupiedRate": 27.7,
      "housingAge": {
        "built2020orLater": 3.2,
        "built2010to2019": 12.7,
        "built2000to2009": 18.9,
        "built1990to1999": 24.3,
        "builtBefore1990": 40.9
      }
    },
    "housingAffordability": {
      "medianHomeValue": 385000,
      "medianGrossRent": 1850,
      "housingCostBurden": {
        "under30percent": 62.4,
        "percent30to50": 28.1,
        "over50percent": 9.5
      },
      "homeValueToIncomeRatio": 5.7
    },
    "housingTrends": {
      "newConstructionRate": 3.2
    }
  }
}
```

### Comprehensive Analysis
```bash
POST /api/property-intelligence/census/comprehensive
```

**Response:**
```json
{
  "success": true,
  "data": {
    "demographics": { /* Demographics object */ },
    "economics": { /* Economics object */ },
    "housing": { /* Housing object */ },
    "overallCommunityScore": 78,
    "summary": {
      "overallCommunityScore": 78,
      "demographicCompatibility": 78,
      "economicVitality": 82,
      "housingMarketStrength": 75,
      "keyInsights": [
        "Highly diverse community with strong multicultural presence",
        "Strong economic fundamentals with stable employment base",
        "High homeownership rate suggests stable, established community"
      ],
      "investmentRecommendations": [
        "Strongly recommended for long-term investment",
        "Economic stability supports property value appreciation",
        "Prime demographic for rental property investment"
      ]
    }
  },
  "metadata": {
    "processingTime": 2847,
    "dataSource": "U.S. Census Bureau ACS 2022 + Decennial Census 2020",
    "geographicLevel": "Census Block Group",
    "analysisComponents": ["demographics", "economics", "housing"]
  }
}
```

## Data Sources

### American Community Survey (ACS) 2022 5-Year Estimates
- **Demographics**: Age (B01001), Race (B02001), Household Type (B11001), Language (B16001)
- **Economics**: Income (B19013, B19001), Employment (B23025), Poverty (B17001), Industry (C24030)
- **Housing**: Housing Stock (B25001-B25003), Home Values (B25077), Rent (B25064), Cost Burden (B25070)

### Decennial Census 2020
- **Geographic Boundaries**: Census Tracts and Block Groups for precise location mapping
- **Population Counts**: Official population counts for demographic calculations

## Geographic Coverage

- **United States**: All 50 states plus District of Columbia and Puerto Rico
- **Geographic Level**: Census Block Group (most detailed available)
- **Data Resolution**: Approximately 600-3,000 people per geographic unit
- **Coordinate System**: WGS84 (latitude/longitude)

## Scoring Methodologies

### Demographic Compatibility Score (0-100)
- **Diversity Component (30%)**: Racial/ethnic diversity using Simpson's Index
- **Age Balance Component (40%)**: Working-age population concentration  
- **Stability Component (30%)**: Residential stability based on migration patterns

### Economic Vitality Score (0-100)
- **Income Component (40%)**: Median household income normalized to national average
- **Employment Component (30%)**: Employment rate and labor force participation
- **Stability Component (30%)**: Low poverty rate and economic mobility indicators

### Housing Market Score (0-100)
- **Availability Component (30%)**: Low vacancy rate indicating demand
- **Value Component (40%)**: Home values relative to regional benchmarks
- **Stability Component (30%)**: High homeownership rate indicating community stability

## Usage Examples

### Property Investment Analysis
```typescript
const censusService = new CensusIntelligenceService();

// Analyze investment potential
const analysis = await censusService.getComprehensiveCensusIntelligence(
  { latitude: 40.7128, longitude: -74.0060 },
  'property-123'
);

console.log(`Community Score: ${analysis.overallCommunityScore}/100`);
console.log(`Investment Recommendations: ${analysis.summary.investmentRecommendations}`);
```

### Neighborhood Comparison
```typescript
// Compare multiple locations
const locations = [
  { lat: 40.7128, lng: -74.0060, name: 'Manhattan' },
  { lat: 40.6892, lng: -74.0445, name: 'Brooklyn' },
  { lat: 40.7831, lng: -73.9712, name: 'Bronx' }
];

const comparisons = await Promise.all(
  locations.map(loc => 
    censusService.getComprehensiveCensusIntelligence({ 
      latitude: loc.lat, 
      longitude: loc.lng 
    })
  )
);

// Rank by overall community score
comparisons.sort((a, b) => b.overallCommunityScore - a.overallCommunityScore);
```

## Rate Limits

- **Demographics**: 30 requests/minute per IP
- **Economics**: 30 requests/minute per IP  
- **Housing**: 30 requests/minute per IP
- **Comprehensive**: 20 requests/minute per IP (more intensive)

## Caching Strategy

- **Geographic Identifiers**: 7 days (FIPS codes don't change)
- **Census Data**: 24 hours (annual data updates)
- **Cache Keys**: Based on latitude/longitude with 6 decimal precision

## Error Handling

### Common Error Scenarios
1. **Geographic Not Found**: Coordinates outside U.S. or territories
2. **Census API Unavailable**: Government service outages (rare)
3. **Invalid Coordinates**: Malformed latitude/longitude values
4. **Rate Limit Exceeded**: Too many requests per minute

### Error Response Format
```json
{
  "success": false,
  "error": "Census demographic analysis service unavailable",
  "metadata": {
    "processingTime": 0,
    "dataSource": null,
    "lastUpdated": "2024-01-15T10:30:00Z"
  }
}
```

## Integration Notes

### Multi-Provider Architecture
The Census Intelligence Service integrates seamlessly with the Multi-Provider Property Intelligence Service, providing government-sourced demographic data alongside commercial services like Google Maps, Azure Maps, and SmartyStreets.

### Complementary Services
- **Google Maps**: Real-time POI data and accessibility analysis
- **Azure Maps**: Weather, traffic, and routing information
- **SmartyStreets**: Address validation and enhanced demographic insights
- **OpenStreetMap**: Community-driven amenity and infrastructure data

### Data Quality Assurance
- **Official Source**: All data sourced directly from U.S. Census Bureau APIs
- **Regular Updates**: ACS data updated annually, Decennial Census every 10 years
- **Geographic Precision**: Block Group level provides neighborhood-scale insights
- **Comprehensive Coverage**: Standardized methodology across all U.S. geographies

## Performance Characteristics

- **Response Time**: 800-2000ms for comprehensive analysis
- **Data Freshness**: ACS 2022 (most recent available)
- **Geographic Resolution**: ~1,500 people average per Block Group
- **API Reliability**: 99.9% uptime (U.S. Census Bureau infrastructure)
- **Concurrent Requests**: Unlimited (subject to rate limiting)

This Census Intelligence Service provides unprecedented access to official U.S. demographic, economic, and housing data, enabling sophisticated property intelligence analysis backed by authoritative government statistics.