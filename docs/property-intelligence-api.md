# Enhanced Property Intelligence API Documentation

## Overview

The Enhanced Property Intelligence API provides comprehensive property analysis capabilities by integrating multiple premium geospatial data providers. This API goes beyond traditional property characteristics to include creative features, lifestyle scoring, and sophisticated location intelligence.

## Supported Data Providers

### Primary Providers
- **Google Maps Platform**: Places API, Elevation API, Street View, Distance Matrix, Roads API
- **Azure Maps**: Search API, Route API, Weather API, Traffic API, Demographics
- **OpenStreetMap**: Community-driven data, cycling infrastructure, public transport, green spaces
- **SmartyStreets**: Premium US address validation, demographic data, property intelligence
- **USPS**: Official address verification and delivery data

### Intelligent Provider Selection
The API automatically selects the optimal data provider based on:
- Data quality requirements
- Cost optimization
- Response time needs
- Geographic coverage
- Feature availability

## Authentication & Rate Limiting

### API Key (Optional)
```http
X-API-Key: your-api-key-here
```

### Rate Limits
- **Standard**: 100 requests/minute
- **Premium**: 500 requests/minute
- **Batch Operations**: 5 requests/minute
- **Expensive Operations**: 20 requests/minute

## API Endpoints

### Address Services

#### Geocode Address
Convert address to coordinates using multiple providers with intelligent fallback.

```http
POST /api/property-intelligence/address/geocode
Content-Type: application/json

{
  "address": "1600 Amphitheatre Parkway, Mountain View, CA 94043"
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "provider": "Google",
      "coordinates": {
        "latitude": 37.4224764,
        "longitude": -122.0842499
      },
      "formattedAddress": "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA",
      "confidence": 0.95,
      "addressComponents": {
        "streetNumber": "1600",
        "streetName": "Amphitheatre Parkway",
        "city": "Mountain View",
        "state": "CA",
        "postalCode": "94043",
        "country": "US"
      }
    }
  ],
  "metadata": {
    "processingTime": 245,
    "dataSourcesUsed": ["Google", "SmartyStreets"],
    "lastUpdated": "2024-01-20T10:30:00Z",
    "cacheHit": false
  }
}
```

#### Validate Address
Comprehensive address validation using premium services.

```http
POST /api/property-intelligence/address/validate
Content-Type: application/json

{
  "address": "1600 Amphitheatre Parkway, Mountain View, CA 94043"
}
```

#### Address Suggestions
Autocomplete suggestions for partial addresses.

```http
GET /api/property-intelligence/address/suggest?q=1600%20Amphitheatre&limit=5
```

### Property Analysis

#### Comprehensive Analysis
Complete property intelligence analysis using all available providers.

```http
POST /api/property-intelligence/analyze/comprehensive
Content-Type: application/json

{
  "latitude": 37.4224764,
  "longitude": -122.0842499,
  "propertyId": "optional-property-id",
  "strategy": "quality_first"
}
```

**Response includes:**
- Location characteristics
- View analysis (water, city, mountain, nature)
- Creative property features
- Transportation accessibility
- Neighborhood intelligence
- Demographics and community data
- Investment potential scoring

#### Creative Features Analysis
Analyze unique property characteristics including lifestyle factors.

```http
POST /api/property-intelligence/analyze/creative-features
Content-Type: application/json

{
  "latitude": 37.4224764,
  "longitude": -122.0842499,
  "propertyId": "optional-property-id"
}
```

**Creative Features Include:**
- **Coffee Accessibility Score**: Proximity and quality of coffee shops
- **Dining Diversity Index**: Variety and quality of restaurants
- **Shopping Convenience**: Access to retail and services
- **Entertainment Access**: Proximity to entertainment venues
- **Instagrammability Score**: Visual appeal and landmark proximity
- **Professional Environment**: Coworking spaces and business districts
- **Wellness Ecosystem**: Gyms, spas, health services
- **Unique Characteristics**: Historic significance, architectural interest

#### Batch Analysis
Analyze multiple properties in a single request (up to 50 properties).

```http
POST /api/property-intelligence/analyze/batch
Content-Type: application/json

{
  "properties": [
    {
      "latitude": 37.4224764,
      "longitude": -122.0842499,
      "propertyId": "property-001"
    },
    {
      "latitude": 37.7749295,
      "longitude": -122.4194155,
      "propertyId": "property-002"
    }
  ],
  "strategy": "cost_optimized"
}
```

### Specialized Analysis

#### View Analysis
Comprehensive analysis of property views and visual characteristics.

```http
POST /api/property-intelligence/analyze/views
Content-Type: application/json

{
  "latitude": 37.4224764,
  "longitude": -122.0842499
}
```

**View Types Analyzed:**
- Water views (ocean, lake, river)
- City skyline views
- Mountain and hill views
- Nature and park views
- Elevation analysis
- Visual obstruction assessment

#### Transportation Analysis
Transportation accessibility and route optimization analysis.

```http
POST /api/property-intelligence/analyze/transportation
Content-Type: application/json

{
  "latitude": 37.4224764,
  "longitude": -122.0842499
}
```

#### Neighborhood Analysis
Comprehensive neighborhood intelligence using multiple data sources.

```http
POST /api/property-intelligence/analyze/neighborhood
Content-Type: application/json

{
  "latitude": 37.4224764,
  "longitude": -122.0842499
}
```

## Advanced Features

### Provider Selection Strategies

#### Quality First
Prioritizes data accuracy and completeness over cost.
```json
{
  "strategy": "quality_first"
}
```

#### Cost Optimized
Balances data quality with cost efficiency.
```json
{
  "strategy": "cost_optimized"
}
```

#### Speed Optimized
Prioritizes response time over comprehensive analysis.
```json
{
  "strategy": "speed_optimized"
}
```

### Lifestyle Scoring Metrics

#### Coffee Accessibility Score (0-100)
- **90-100**: Coffee lover's paradise (multiple high-quality options within walking distance)
- **70-89**: Great coffee access (good variety within reasonable distance)
- **50-69**: Moderate coffee access (basic options available)
- **30-49**: Limited coffee access (few options, may require travel)
- **0-29**: Coffee desert (very limited or no nearby coffee options)

#### Instagrammability Score (0-100)
- **90-100**: Highly photogenic location with iconic landmarks or stunning views
- **70-89**: Good photo opportunities with interesting architecture or scenery
- **50-69**: Moderate visual appeal with some noteworthy features
- **30-49**: Limited photogenic qualities
- **0-29**: Minimal visual interest for social media

### Error Handling

All endpoints return standardized error responses:

```json
{
  "success": false,
  "error": "Error description",
  "metadata": {
    "processingTime": 0,
    "dataSourcesUsed": [],
    "lastUpdated": "2024-01-20T10:30:00Z",
    "cacheHit": false
  }
}
```

### Common HTTP Status Codes
- `200` - Success
- `400` - Bad Request (invalid coordinates, missing required fields)
- `429` - Rate Limit Exceeded
- `500` - Internal Server Error

## Integration Examples

### JavaScript/Node.js
```javascript
const axios = require('axios');

async function analyzeProperty(latitude, longitude) {
  try {
    const response = await axios.post(
      'http://localhost:3000/api/property-intelligence/analyze/comprehensive',
      {
        latitude,
        longitude,
        strategy: 'quality_first'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'your-api-key'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Property analysis failed:', error.response?.data || error.message);
    throw error;
  }
}

// Usage
analyzeProperty(37.4224764, -122.0842499)
  .then(analysis => {
    console.log('Property Analysis:', analysis);
    console.log('Coffee Score:', analysis.data.creativeFeatures?.lifestyle?.coffeeAccessibilityScore);
    console.log('View Quality:', analysis.data.viewAnalysis?.overallViewScore);
  })
  .catch(console.error);
```

### Python
```python
import requests
import json

def analyze_property(latitude, longitude, api_key=None):
    url = "http://localhost:3000/api/property-intelligence/analyze/comprehensive"
    
    headers = {
        "Content-Type": "application/json"
    }
    
    if api_key:
        headers["X-API-Key"] = api_key
    
    payload = {
        "latitude": latitude,
        "longitude": longitude,
        "strategy": "quality_first"
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Property analysis failed: {e}")
        raise

# Usage
analysis = analyze_property(37.4224764, -122.0842499)
print(f"Coffee Score: {analysis['data']['creativeFeatures']['lifestyle']['coffeeAccessibilityScore']}")
print(f"Instagrammability: {analysis['data']['creativeFeatures']['uniqueCharacteristics']['instagrammabilityScore']}")
```

### cURL
```bash
# Comprehensive property analysis
curl -X POST "http://localhost:3000/api/property-intelligence/analyze/comprehensive" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "latitude": 37.4224764,
    "longitude": -122.0842499,
    "strategy": "quality_first"
  }'

# Address geocoding
curl -X POST "http://localhost:3000/api/property-intelligence/address/geocode" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "1600 Amphitheatre Parkway, Mountain View, CA 94043"
  }'
```

## Monitoring & Health Checks

### Health Check
```http
GET /api/property-intelligence/health
```

### Provider Status
```http
GET /api/property-intelligence/providers/status
```

### Rate Limit Statistics
```http
GET /api/stats/rate-limits
```

## Environment Configuration

### Required Environment Variables
```bash
# Google Maps Platform
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Azure Maps
AZURE_MAPS_SUBSCRIPTION_KEY=your_azure_maps_key

# SmartyStreets
SMARTYSTREETS_AUTH_ID=your_smartystreets_auth_id
SMARTYSTREETS_AUTH_TOKEN=your_smartystreets_auth_token

# USPS
USPS_USER_ID=your_usps_user_id

# Application Settings
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=https://yourdomain.com,https://api.yourdomain.com
```

### Optional Configuration
```bash
# Cache Settings
CACHE_TTL_SECONDS=3600
CACHE_MAX_ENTRIES=10000

# Rate Limiting
STANDARD_RATE_LIMIT=100
PREMIUM_RATE_LIMIT=500
BATCH_RATE_LIMIT=5
```

## Best Practices

1. **Use Batch Endpoints**: For multiple properties, use batch analysis to reduce API calls
2. **Implement Caching**: Cache results locally to minimize redundant requests
3. **Handle Rate Limits**: Implement exponential backoff for rate limit responses
4. **Monitor Provider Status**: Check provider status before making critical requests
5. **Use Appropriate Strategy**: Choose the right analysis strategy for your use case
6. **Validate Coordinates**: Always validate latitude/longitude ranges before requests
7. **Handle Errors Gracefully**: Implement proper error handling for all scenarios

## Support & Troubleshooting

### Common Issues

**Invalid Coordinates**
- Ensure latitude is between -90 and 90
- Ensure longitude is between -180 and 180

**Rate Limit Exceeded**
- Implement request queuing with delays
- Consider upgrading to premium tier
- Use batch endpoints for multiple properties

**Provider Unavailable**
- The API automatically fails over to available providers
- Check provider status endpoint for real-time availability

**Empty or Invalid Results**
- Some rural or remote locations may have limited data
- Try different provider strategies
- Verify coordinates are accurate

### Support Contact
For technical support or feature requests, please contact the development team.