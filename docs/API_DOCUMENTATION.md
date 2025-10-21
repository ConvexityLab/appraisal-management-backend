# Enterprise Appraisal Management System - API Documentation

## Table of Contents
- [Overview](#overview)
- [Authentication](#authentication)
- [Two-Level Property Architecture](#two-level-property-architecture)
- [Property Summary API](#property-summary-api)
- [Property Details API](#property-details-api)
- [Order Management API](#order-management-api)
- [Vendor Management API](#vendor-management-api)
- [Advanced Search API](#advanced-search-api)
- [Performance Guidelines](#performance-guidelines)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Examples](#examples)

## Overview

The Enterprise Appraisal Management System provides a comprehensive REST API for managing property appraisals, vendors, and orders. The system implements a **Two-Level Property Architecture** optimized for performance and scalability.

### Base URL
- **Production**: `https://api.appraisalmanagement.com/v1`
- **Staging**: `https://staging-api.appraisalmanagement.com/v1`
- **Development**: `https://dev-api.appraisalmanagement.com/v1`

### API Version
Current version: **v1**

All endpoints are prefixed with `/api/v1/`

## Authentication

The API uses **Bearer Token** authentication with JWT tokens.

### Headers
```http
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
Accept: application/json
```

### Getting an Access Token
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@company.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "refresh-token-here",
    "expiresIn": 3600,
    "user": {
      "id": "user-123",
      "email": "user@company.com",
      "role": "appraiser"
    }
  }
}
```

## Two-Level Property Architecture

Our system implements a **Two-Level Property Architecture** for optimal performance:

### Level 1: PropertySummary (Lightweight)
- **Purpose**: Fast listings, searches, mobile apps
- **Data Size**: ~1-2KB per property
- **Fields**: ~15 essential fields
- **Use Cases**: Property listings, search results, quick operations

### Level 2: PropertyDetails (Comprehensive)
- **Purpose**: Detailed analysis, appraisals, reports
- **Data Size**: ~15-30KB per property  
- **Fields**: 50+ comprehensive fields
- **Use Cases**: Property detail pages, market analysis, appraisals

### Performance Comparison
| Operation | PropertySummary | PropertyDetails | Performance Gain |
|-----------|----------------|-----------------|------------------|
| Listing 100 properties | ~200KB | ~3MB | **15x faster** |
| Search response time | <100ms | <500ms | **5x faster** |
| Mobile bandwidth | Minimal | High | **90% reduction** |

## Property Summary API

### Get Property Summary
```http
GET /api/v1/properties/summary/{id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "prop-123",
    "address": {
      "street": "123 Main Street",
      "city": "San Francisco",
      "state": "CA",
      "zip": "94102",
      "county": "San Francisco",
      "latitude": 37.7749,
      "longitude": -122.4194
    },
    "propertyType": "single_family_residential",
    "condition": "good",
    "building": {
      "yearBuilt": 2000,
      "livingAreaSquareFeet": 2500,
      "bedroomCount": 3,
      "bathroomCount": 2,
      "storyCount": 2,
      "garageParkingSpaceCount": 2
    },
    "valuation": {
      "estimatedValue": 1200000,
      "priceRangeMin": 1100000,
      "priceRangeMax": 1300000,
      "confidenceScore": 88,
      "asOfDate": "2024-12-27T10:00:00Z"
    },
    "owner": {
      "fullName": "John Smith",
      "ownerOccupied": true
    },
    "quickLists": {
      "vacant": false,
      "ownerOccupied": true,
      "freeAndClear": false,
      "highEquity": true,
      "activeForSale": false,
      "recentlySold": false
    },
    "lastUpdated": "2024-12-27T10:00:00Z",
    "dataSource": "internal"
  }
}
```

### Search Property Summaries
```http
GET /api/v1/properties/summary
```

**Query Parameters:**
- `propertyType[]`: Array of property types
- `state`: State abbreviation
- `city`: City name
- `minPrice`: Minimum estimated value
- `maxPrice`: Maximum estimated value
- `minYear`: Minimum year built
- `maxYear`: Maximum year built
- `minSqft`: Minimum square footage
- `maxSqft`: Maximum square footage
- `limit`: Results per page (default: 50, max: 100)
- `offset`: Pagination offset

**Example:**
```http
GET /api/v1/properties/summary?propertyType[]=single_family_residential&propertyType[]=condominium&state=CA&minPrice=500000&maxPrice=2000000&limit=25
```

**Response:**
```json
{
  "success": true,
  "data": {
    "properties": [
      {
        "id": "prop-123",
        // ... property summary data
      }
    ],
    "total": 1247,
    "aggregations": {
      "byPropertyType": {
        "single_family_residential": 845,
        "condominium": 234,
        "townhome": 125,
        "multi_family": 43
      },
      "byPriceRange": {
        "under_500k": 156,
        "500k_1m": 423,
        "1m_2m": 512,
        "over_2m": 156
      },
      "byCondition": {
        "excellent": 224,
        "good": 623,
        "average": 312,
        "fair": 67,
        "poor": 21
      }
    }
  },
  "metadata": {
    "total": 1247,
    "offset": 0,
    "limit": 25,
    "hasMore": true
  }
}
```

### Create Property Summary
```http
POST /api/v1/properties/summary
Content-Type: application/json

{
  "address": {
    "street": "456 Oak Avenue",
    "city": "Los Angeles",
    "state": "CA",
    "zip": "90210",
    "county": "Los Angeles"
  },
  "propertyType": "condominium",
  "condition": "excellent",
  "building": {
    "yearBuilt": 2010,
    "livingAreaSquareFeet": 1800,
    "bedroomCount": 2,
    "bathroomCount": 2
  },
  "valuation": {
    "estimatedValue": 850000
  }
}
```

### Update Property Summary
```http
PUT /api/v1/properties/summary/{id}
Content-Type: application/json

{
  "condition": "excellent",
  "valuation": {
    "estimatedValue": 1300000,
    "confidenceScore": 92
  }
}
```

### Batch Get Property Summaries
```http
POST /api/v1/properties/summary/batch
Content-Type: application/json

{
  "ids": ["prop-123", "prop-456", "prop-789"]
}
```

## Property Details API

### Get Property Details
```http
GET /api/v1/properties/detailed/{id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    // All PropertySummary fields plus:
    "assessment": {
      "totalAssessedValue": 450000,
      "assessmentYear": 2024,
      "totalMarketValue": 1200000,
      "landValue": 400000,
      "improvementValue": 800000
    },
    "deedHistory": [
      {
        "recordingDate": "2020-03-15T00:00:00Z",
        "salePrice": 950000,
        "documentType": "Grant Deed",
        "grantor": "Previous Owner LLC",
        "grantee": "John Smith"
      }
    ],
    "demographics": {
      "medianIncome": 75000,
      "populationDensity": 2500,
      "ageDistribution": {
        "under18": 22.5,
        "18to65": 62.3,
        "over65": 15.2
      }
    },
    "foreclosure": {
      "isForeclosure": false,
      "foreclosureDate": null,
      "foreclosureType": null
    },
    "legal": {
      "legalDescription": "LOT 15 BLOCK 3 SUNSET SUBDIVISION",
      "zoning": "R1-5000",
      "landUse": "Single Family Residential"
    },
    "lot": {
      "lotSizeSquareFeet": 7200,
      "lotSizeAcres": 0.165,
      "frontage": 60,
      "depth": 120
    },
    "listing": {
      "brokerage": {
        "name": "Premier Realty",
        "phone": "555-123-4567"
      },
      "agents": {
        "listingAgent": "Jane Doe",
        "sellingAgent": "Bob Wilson"
      }
    },
    "mortgageHistory": [
      {
        "recordingDate": "2020-03-15T00:00:00Z",
        "loanAmount": 760000,
        "lender": "First National Bank",
        "interestRate": 3.25,
        "loanType": "Conventional"
      }
    ],
    "openLien": {
      "totalOpenLienCount": 1,
      "allLoanTypes": ["First Mortgage"],
      "juniorLoanTypes": [],
      "mortgages": {
        "firstMortgage": {
          "balance": 680000,
          "interestRate": 3.25,
          "monthlyPayment": 2950
        }
      }
    },
    "propertyOwnerProfile": {
      "ownershipType": "Individual",
      "ownershipDate": "2020-03-15T00:00:00Z",
      "mailingAddress": {
        "street": "123 Main Street",
        "city": "San Francisco",
        "state": "CA",
        "zip": "94102"
      }
    },
    "sale": {
      "lastSaleDate": "2020-03-15T00:00:00Z",
      "lastSalePrice": 950000,
      "pricePerSquareFoot": 380,
      "saleHistory": [
        {
          "date": "2020-03-15T00:00:00Z",
          "price": 950000,
          "documentType": "Grant Deed"
        }
      ]
    },
    "tax": {
      "annualTaxAmount": 14400,
      "taxYear": 2024,
      "millRate": 1.2,
      "exemptions": [],
      "delinquent": false
    },
    "meta": {
      "propertyDateModified": "2024-12-27T10:00:00Z",
      "apiVersion": "1.0",
      "dataProvider": "PropertyData Inc",
      "requestId": "req-789"
    }
  }
}
```

### Search Property Details
```http
GET /api/v1/properties/detailed
```

**Query Parameters:** Same as Property Summary search, plus:
- `minAssessedValue`: Minimum assessed value
- `maxAssessedValue`: Maximum assessed value
- `zoning`: Zoning classification
- `ownerOccupied`: Owner occupancy filter

### Enrich Property with External Data
```http
POST /api/v1/properties/{id}/enrich
```

**Response:**
```json
{
  "success": true,
  "data": {
    // Complete PropertyDetails with enriched external data
  },
  "metadata": {
    "enrichmentSources": ["PropertyData Inc", "Census Bureau", "MLS"],
    "enrichmentDate": "2024-12-27T10:00:00Z",
    "dataFreshness": "current"
  }
}
```

### Property Market Analysis
```http
GET /api/v1/properties/{id}/market-analysis?radius=1.0
```

**Response:**
```json
{
  "success": true,
  "data": {
    "subject": {
      // PropertyDetails of subject property
    },
    "comparables": [
      {
        // PropertySummary objects of comparable properties
      }
    ],
    "marketTrends": {
      "averagePrice": 1150000,
      "pricePerSqFt": 485,
      "priceAppreciation": 0.057,
      "marketVelocity": 28,
      "inventoryLevel": "balanced"
    },
    "analysis": {
      "pricePerSqFt": 480,
      "marketPosition": "at_market",
      "recommendations": [
        "Strong market appreciation expected",
        "Consider market timing for optimal valuation"
      ]
    }
  }
}
```

### Batch Update Property Valuations
```http
POST /api/v1/properties/batch/valuations
Content-Type: application/json

{
  "propertyIds": ["prop-123", "prop-456", "prop-789"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "updated": 2,
    "failed": 1,
    "errors": [
      "prop-789: Property not found"
    ]
  }
}
```

## Order Management API

### Create Order
```http
POST /api/v1/orders
Content-Type: application/json

{
  "clientId": "client-123",
  "orderNumber": "ORD-2024-001",
  "propertyAddress": {
    "streetAddress": "123 Main Street",
    "city": "San Francisco",
    "state": "CA",
    "zipCode": "94102",
    "county": "San Francisco"
  },
  "orderType": "appraisal",
  "productType": "exterior_only",
  "dueDate": "2024-12-30T17:00:00Z",
  "rushOrder": false,
  "borrowerInformation": {
    "name": "John Doe",
    "phone": "555-123-4567",
    "email": "john.doe@email.com"
  },
  "loanInformation": {
    "loanNumber": "LOAN-789",
    "loanAmount": 800000,
    "loanType": "purchase"
  }
}
```

### Get Order
```http
GET /api/v1/orders/{id}
```

### Search Orders
```http
GET /api/v1/orders?status[]=new&status[]=in_progress&assignedVendorId=vendor-123&limit=25
```

### Update Order
```http
PUT /api/v1/orders/{id}
Content-Type: application/json

{
  "status": "in_progress",
  "assignedVendorId": "vendor-456"
}
```

## Vendor Management API

### Create Vendor
```http
POST /api/v1/vendors
Content-Type: application/json

{
  "name": "Premier Appraisal Services",
  "email": "contact@premierappraisal.com",
  "phone": "555-987-6543",
  "licenseNumber": "CA-12345",
  "licenseState": "CA",
  "licenseExpiry": "2025-12-31T00:00:00Z",
  "productTypes": ["full_appraisal", "exterior_only", "desktop_review"],
  "serviceAreas": ["San Francisco", "Oakland", "San Jose"],
  "status": "active"
}
```

### Get Vendor
```http
GET /api/v1/vendors/{id}
```

### Search Vendors
```http
GET /api/v1/vendors?status=active&licenseState=CA&productTypes[]=full_appraisal
```

## Advanced Search API

### Universal Search
```http
GET /api/v1/search?q=123+Main+Street+San+Francisco&type[]=properties&type[]=orders
```

**Response:**
```json
{
  "success": true,
  "data": {
    "properties": {
      "results": [/* property results */],
      "total": 15
    },
    "orders": {
      "results": [/* order results */],
      "total": 3
    },
    "vendors": {
      "results": [/* vendor results */],
      "total": 0
    }
  },
  "metadata": {
    "query": "123 Main Street San Francisco",
    "totalResults": 18,
    "executionTime": 45
  }
}
```

### Faceted Property Search
```http
GET /api/v1/search/properties/faceted
```

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [/* property results */],
    "facets": {
      "propertyType": {
        "single_family_residential": { "count": 1247, "selected": false },
        "condominium": { "count": 456, "selected": true },
        "townhome": { "count": 234, "selected": false }
      },
      "priceRange": {
        "0-500000": { "count": 123, "selected": false },
        "500000-1000000": { "count": 456, "selected": true },
        "1000000-2000000": { "count": 789, "selected": false }
      },
      "condition": {
        "excellent": { "count": 234, "selected": false },
        "good": { "count": 567, "selected": false },
        "average": { "count": 345, "selected": false }
      }
    }
  }
}
```

## Performance Guidelines

### Property Summary vs Details Usage

| Use Case | Recommended API | Reason |
|----------|----------------|--------|
| Property listings | Summary | 15x faster, 90% less bandwidth |
| Search results | Summary | Optimal user experience |
| Map view markers | Summary | Minimal data transfer |
| Mobile applications | Summary | Reduced data usage |
| Property detail page | Details | Comprehensive information |
| Appraisal forms | Details | All required fields |
| Market analysis | Details | Advanced calculations |
| Investment analysis | Details | Complete property profile |

### Pagination Best Practices
- Use `limit` parameter (max 100 for summaries, max 50 for details)
- Implement cursor-based pagination for large datasets
- Cache frequently accessed pages

### Caching Recommendations
- Property Summaries: Cache for 15 minutes
- Property Details: Cache for 1 hour
- Search results: Cache for 5 minutes
- Static data (vendors, etc.): Cache for 24 hours

## Error Handling

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "PROPERTY_NOT_FOUND",
    "message": "Property with ID 'prop-123' was not found",
    "timestamp": "2024-12-27T10:00:00Z",
    "details": {
      "propertyId": "prop-123",
      "searchedIn": "property-summaries"
    }
  }
}
```

### Common Error Codes
- `PROPERTY_NOT_FOUND` (404): Property does not exist
- `INVALID_PROPERTY_TYPE` (400): Invalid property type specified
- `VALIDATION_ERROR` (400): Request validation failed
- `UNAUTHORIZED` (401): Authentication required
- `FORBIDDEN` (403): Insufficient permissions
- `RATE_LIMIT_EXCEEDED` (429): Too many requests
- `INTERNAL_SERVER_ERROR` (500): Server error

## Rate Limiting

### Limits by Endpoint Type
- **Property Summary**: 1000 requests/hour
- **Property Details**: 500 requests/hour
- **Search**: 200 requests/hour
- **Create/Update**: 100 requests/hour

### Rate Limit Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1640606400
```

## Examples

### Complete Property Workflow

1. **Search for properties**:
```javascript
const response = await fetch('/api/v1/properties/summary?state=CA&propertyType[]=single_family_residential&limit=20');
const properties = await response.json();
```

2. **Get detailed information**:
```javascript
const propertyId = properties.data.properties[0].id;
const details = await fetch(`/api/v1/properties/detailed/${propertyId}`);
const propertyDetails = await details.json();
```

3. **Get market analysis**:
```javascript
const analysis = await fetch(`/api/v1/properties/${propertyId}/market-analysis?radius=1.0`);
const marketData = await analysis.json();
```

### Batch Operations

**Batch get property summaries**:
```javascript
const batchResponse = await fetch('/api/v1/properties/summary/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ids: ['prop-123', 'prop-456', 'prop-789']
  })
});
```

**Batch update valuations**:
```javascript
const updateResponse = await fetch('/api/v1/properties/batch/valuations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    propertyIds: ['prop-123', 'prop-456']
  })
});
```

## SDK and Integration

### JavaScript/TypeScript SDK
```bash
npm install @appraisal-management/api-client
```

```javascript
import { AppraisalManagementClient } from '@appraisal-management/api-client';

const client = new AppraisalManagementClient({
  baseURL: 'https://api.appraisalmanagement.com/v1',
  apiKey: 'your-api-key'
});

// Search property summaries
const properties = await client.properties.searchSummaries({
  state: 'CA',
  propertyType: ['single_family_residential'],
  priceRange: { min: 500000, max: 2000000 }
});

// Get property details
const details = await client.properties.getDetails('prop-123');
```

### Python SDK
```bash
pip install appraisal-management-client
```

```python
from appraisal_management import Client

client = Client(
    base_url='https://api.appraisalmanagement.com/v1',
    api_key='your-api-key'
)

# Search properties
properties = client.properties.search_summaries(
    state='CA',
    property_type=['single_family_residential'],
    price_range={'min': 500000, 'max': 2000000}
)

# Get property details
details = client.properties.get_details('prop-123')
```

---

## Support

- **Documentation**: [https://docs.appraisalmanagement.com](https://docs.appraisalmanagement.com)
- **Support Email**: api-support@appraisalmanagement.com
- **Status Page**: [https://status.appraisalmanagement.com](https://status.appraisalmanagement.com)

---

**Last Updated**: December 27, 2024  
**API Version**: v1  
**Document Version**: 1.0