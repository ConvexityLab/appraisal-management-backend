# Bridge Interactive API Examples

All Bridge Interactive endpoints require authentication. Add your Server Token to the `.env` file:

```env
BRIDGE_SERVER_TOKEN=your-server-token-here
```

Get your token from: https://bridgedataoutput.com/login

## Authentication Format

**PowerShell Examples:**

### MLS Listings

```powershell
# Get active listings near San Francisco
$body = @{
    latitude = 37.7749
    longitude = -122.4194
    radiusMiles = 0.5
    minPrice = 500000
    maxPrice = 1000000
    propertyType = "Residential"
    limit = 25
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/bridge-mls/active-listings" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

```powershell
# Get sold comparables for valuation
$body = @{
    latitude = 37.7749
    longitude = -122.4194
    radiusMiles = 0.5
    minBeds = 3
    maxBeds = 4
    minBaths = 2
    soldWithinDays = 180
    limit = 25
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/bridge-mls/sold-comps" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

```powershell
# Search property by address
$body = @{
    address = "123 Market St, San Francisco, CA"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/bridge-mls/search-address" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

```powershell
# Get market statistics for an area
$body = @{
    latitude = 37.7749
    longitude = -122.4194
    radiusMiles = 1.0
    propertyType = "Residential"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/bridge-mls/market-stats" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

### Public Records (Tax Assessments & Transaction History)

```powershell
# Search parcels by address
$body = @{
    address = "123 Market St, San Francisco, CA"
    limit = 10
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/bridge-mls/parcels/search" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

```powershell
# Search tax assessments
$body = @{
    address = "123 Market St, San Francisco, CA"
    year = 2024
    limit = 10
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/bridge-mls/assessments/search" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

```powershell
# Search transaction history
$body = @{
    address = "123 Market St, San Francisco, CA"
    startDate = "2020-01-01"
    endDate = "2024-12-31"
    limit = 20
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/bridge-mls/transactions/search" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

### Zestimates (Zillow Valuations)

```powershell
# Get Zestimate by address
$body = @{
    address = "123 Market St, San Francisco, CA"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/bridge-mls/zestimate" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

```powershell
# Get Zestimates for multiple properties (by ZPID)
$body = @{
    zpids = "123456,654321,789012"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/bridge-mls/zestimate" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

### Market Reports (Zillow Group Economic Data)

```powershell
# Get market report for California (FIPS code 06)
$body = @{
    stateCodeFIPS = "06"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/bridge-mls/market-report" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

```powershell
# Get region metadata
$body = @{
    stateCodeFIPS = "06"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/bridge-mls/region" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

### Agent Reviews

```powershell
# Get all reviews for a specific agent
Invoke-RestMethod -Uri "http://localhost:3000/api/bridge-mls/reviews?revieweeEmail=agent@example.com&limit=50" `
    -Method GET
```

```powershell
# Get agent with all their reviews
Invoke-RestMethod -Uri "http://localhost:3000/api/bridge-mls/reviewees?email=agent@example.com&expandReviews=true" `
    -Method GET
```

### Other Endpoints

```powershell
# Get available datasets
Invoke-RestMethod -Uri "http://localhost:3000/api/bridge-mls/datasets" -Method GET
```

```powershell
# Get property by ListingKey
Invoke-RestMethod -Uri "http://localhost:3000/api/bridge-mls/property/ABC123?includeMedia=false" -Method GET
```

```powershell
# Get agent/member info
Invoke-RestMethod -Uri "http://localhost:3000/api/bridge-mls/member/MEMBER123" -Method GET
```

```powershell
# Get office info
Invoke-RestMethod -Uri "http://localhost:3000/api/bridge-mls/office/OFFICE123" -Method GET
```

```powershell
# Get available metric types
Invoke-RestMethod -Uri "http://localhost:3000/api/bridge-mls/metric-types" -Method GET
```

## cURL Examples (Linux/Mac)

```bash
# Get active listings
curl -X POST http://localhost:3000/api/bridge-mls/active-listings \
  -H "Content-Type: application/json" \
  -d '{"latitude":37.7749,"longitude":-122.4194,"radiusMiles":0.5,"limit":25}'
```

```bash
# Get sold comps
curl -X POST http://localhost:3000/api/bridge-mls/sold-comps \
  -H "Content-Type: application/json" \
  -d '{"latitude":37.7749,"longitude":-122.4194,"radiusMiles":0.5,"minBeds":3,"soldWithinDays":180}'
```

```bash
# Get Zestimate
curl -X POST http://localhost:3000/api/bridge-mls/zestimate \
  -H "Content-Type: application/json" \
  -d '{"address":"123 Market St, San Francisco, CA"}'
```

## Response Format

All responses follow this structure:

```json
{
  "success": true,
  "count": 25,
  "data": [...],
  "message": "Optional message"
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error description",
  "message": "Detailed error message"
}
```

## Notes

- The API automatically includes Bearer token authentication from `BRIDGE_SERVER_TOKEN`
- Test dataset is available without authentication (datasetId: "test")
- Rate limits: 5,000 requests/hour, 334 requests/minute burst
- Most endpoints support pagination with `limit` parameter (max 200)
- Geographic searches use miles for radius
- Dates should be in ISO format: "YYYY-MM-DD"
