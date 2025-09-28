# Enhanced Property Intelligence Platform

> **Revolutionary property analysis beyond traditional appraisal methods**

A comprehensive property intelligence platform that integrates multiple premium geospatial data providers to deliver unprecedented insights into property characteristics, neighborhood dynamics, and lifestyle factors.

## 🆕 **Latest Enhancement: Dynamic Code Execution Service**

🚀 **NEW**: Added enterprise-grade **Dynamic JavaScript/Node.js Code Execution Service** - a secure, sandboxed code execution engine that enables runtime business logic, financial calculations, data transformations, and complex rule processing with complete safety and control.

**Key Capabilities:**
- 🔒 **Secure VM Sandboxing** - Safe execution of untrusted code
- ⚡ **Real-time Business Rules** - Dynamic pricing, approval workflows
- 💰 **Financial Calculations** - Loan payments, risk assessments
- 🔄 **Data Transformation** - API response processing, format conversions
- ✅ **Advanced Validation** - Complex data quality checks

**📚 [Complete Documentation](./DYNAMIC_CODE_EXECUTION_SERVICE.md)** | **🧪 [Run Demo](./src/demos/advanced-dynamic-code-demo.ts)**

## 🌟 Key Features

- **🏛️ Census Intelligence** - Official demographic, economic, and housing analysis using U.S. Census data
- **☕ Coffee Accessibility Scoring** - Quantify coffee culture around properties
- **📸 Instagrammability Analysis** - Assess social media appeal and visual attractiveness  
- **🏙️ Comprehensive View Analysis** - Water, city, mountain, and nature view assessment
- **🚗 Multi-Modal Transportation** - Driving, transit, cycling, and walkability analysis
- **🏘️ Neighborhood Intelligence** - Demographics, safety, and community fabric scoring
- **🎭 Entertainment Access** - Proximity to cultural venues and entertainment options
- **💼 Professional Environment** - Coworking spaces and business district analysis
- **🏠 Multi-Provider Address Services** - Validation, geocoding, and standardization

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/ConvexityLab/appraisal-management-backend.git
cd appraisal-management-backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys
```

### Environment Setup

```bash
# Required API Keys
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
AZURE_MAPS_SUBSCRIPTION_KEY=your_azure_maps_key
SMARTYSTREETS_AUTH_ID=your_smartystreets_auth_id
SMARTYSTREETS_AUTH_TOKEN=your_smartystreets_auth_token

# Optional
USPS_USER_ID=your_usps_user_id
```

### Start the Server

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

The API will be available at `http://localhost:3000`

## 📋 API Examples

### Comprehensive Property Analysis

```javascript
// Analyze a property with all features
const response = await fetch('/api/property-intelligence/analyze/comprehensive', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    latitude: 37.4224764,
    longitude: -122.0842499,
    strategy: 'quality_first'
  })
});

const analysis = await response.json();

// Key metrics
console.log('Coffee Score:', analysis.data.creativeFeatures.lifestyle.coffeeAccessibilityScore);
console.log('Instagrammability:', analysis.data.creativeFeatures.uniqueCharacteristics.instagrammabilityScore);
console.log('View Quality:', analysis.data.viewAnalysis.overallViewScore);
```

### Census Intelligence Analysis

```javascript
// Get comprehensive demographic, economic, and housing analysis
const response = await fetch('/api/property-intelligence/census/comprehensive', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    latitude: 40.7589,
    longitude: -73.9851,
    propertyId: 'manhattan-property-123'
  })
});

const analysis = await response.json();

// Key census metrics
console.log('Community Score:', analysis.data.overallCommunityScore + '/100');
console.log('Demographic Compatibility:', analysis.data.demographics.demographicCompatibilityScore);
console.log('Economic Vitality:', analysis.data.economics.economicVitalityScore);
console.log('Housing Market Strength:', analysis.data.housing.housingMarketScore);
```

### Address Validation

```javascript
// Validate and standardize addresses
const response = await fetch('/api/property-intelligence/address/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    address: '1600 amphitheatre pkwy mountain view ca'
  })
});

const result = await response.json();
console.log('Standardized Address:', result.data.standardizedAddress);
```

### Creative Features Analysis

```javascript
// Get unique property characteristics
const response = await fetch('/api/property-intelligence/analyze/creative-features', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    latitude: 40.7580,
    longitude: -73.9855
  })
});

const features = await response.json();
console.log('Coffee Access:', features.data.lifestyle.coffeeAccessibilityScore);
console.log('Dining Diversity:', features.data.lifestyle.diningDiversityIndex);
console.log('Instagram Score:', features.data.uniqueCharacteristics.instagrammabilityScore);
```

## 🗺️ Data Providers

| Provider | Status | Capabilities |
|----------|--------|-------------|
| **Google Maps Platform** | ✅ Active | Places, Elevation, Street View, Routing |
| **Azure Maps** | ✅ Active | Search, Routes, Weather, Traffic |
| **OpenStreetMap** | ✅ Active | Community POI, Cycling, Transit |
| **SmartyStreets** | ✅ Active | Address Validation, Demographics |
| **USPS** | ✅ Active | Official Address Verification |

## 📊 Creative Scoring System

### Coffee Accessibility Score (0-100)
- **90-100**: Coffee lover's paradise 
- **70-89**: Great coffee access
- **50-69**: Moderate coffee access
- **30-49**: Limited coffee access
- **0-29**: Coffee desert

### Instagrammability Score (0-100)
- **90-100**: Highly photogenic with iconic landmarks
- **70-89**: Good photo opportunities
- **50-69**: Moderate visual appeal
- **30-49**: Limited photogenic qualities
- **0-29**: Minimal visual interest

### Lifestyle Categories
- **🍽️ Dining Diversity** - Restaurant variety and quality
- **🛍️ Shopping Convenience** - Retail and essential services access
- **🎭 Entertainment Access** - Cultural venues and nightlife
- **💼 Professional Environment** - Coworking and business districts
- **💪 Wellness Ecosystem** - Health and fitness amenities

## 🔌 API Endpoints

### Address Services
- `POST /api/property-intelligence/address/geocode` - Multi-provider geocoding
- `POST /api/property-intelligence/address/validate` - Address validation  
- `GET /api/property-intelligence/address/suggest` - Address autocomplete
- `POST /api/property-intelligence/address/reverse-geocode` - Coordinates to address

### Property Analysis
- `POST /api/property-intelligence/analyze/comprehensive` - Complete analysis
- `POST /api/property-intelligence/analyze/creative-features` - Lifestyle analysis
- `POST /api/property-intelligence/analyze/views` - View assessment
- `POST /api/property-intelligence/analyze/transportation` - Transit analysis
- `POST /api/property-intelligence/analyze/neighborhood` - Area intelligence
- `POST /api/property-intelligence/analyze/batch` - Multiple properties

### Utilities
- `GET /api/property-intelligence/providers/status` - Provider availability
- `GET /api/property-intelligence/health` - API health check

## 🛠️ Architecture

```
┌─────────────────────────────────────────┐
│           API Controller Layer          │
│  • Authentication  • Rate Limiting      │
│  • Validation     • Error Handling     │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│        Multi-Provider Service           │
│  • Provider Selection • Failover        │
│  • Cost Optimization • Quality Control │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│          Specialized Services           │
│  Address  │ Google Maps │ Creative      │
│  Service  │ Service     │ Intelligence  │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│             Data Providers              │
│  Google │ Azure │ OSM │ SmartyStreets   │
└─────────────────────────────────────────┘
```

## 🔧 Configuration

### Provider Strategies

**Quality First** - Prioritizes data accuracy over cost
```javascript
{ "strategy": "quality_first" }
```

**Cost Optimized** - Balances quality and operational costs  
```javascript
{ "strategy": "cost_optimized" }
```

**Speed Optimized** - Prioritizes response time
```javascript
{ "strategy": "speed_optimized" }
```

### Rate Limits

| Endpoint Category | Standard | Premium |
|-------------------|----------|---------|
| Address Services | 100/min | 500/min |
| Property Analysis | 20/min | 100/min |
| Batch Processing | 5/min | 20/min |
| Creative Features | 30/min | 150/min |

## 📚 Documentation

- **[Complete Feature Guide](docs/FEATURES.md)** - Comprehensive feature documentation
- **[API Documentation](docs/property-intelligence-api.md)** - Detailed API reference
- **[Demo Examples](examples/property-intelligence-demo.ts)** - Working code examples
- **[Type Definitions](src/types/property-intelligence.ts)** - TypeScript interfaces

## 🧪 Testing

```bash
# Run the demo script
npm run demo

# Test specific features
npm run test:address-services
npm run test:creative-features
npm run test:batch-analysis
```

## 🎯 Use Cases

### Real Estate Professionals
- **Enhanced Listings** - Add lifestyle scores to property descriptions
- **Market Analysis** - Identify undervalued areas with high lifestyle potential
- **Client Matching** - Match buyers with properties that fit their lifestyle

### Property Investors
- **Investment Intelligence** - Quantify factors that drive property demand
- **Portfolio Analysis** - Assess lifestyle appeal across property holdings
- **Market Trends** - Track changing preferences in location desirability

### Technology Platforms
- **Property Portals** - Enhance listings with unique characteristics
- **Valuation Tools** - Incorporate lifestyle factors into pricing models
- **Location Intelligence** - Add sophisticated location analysis to apps

## 🔐 Security & Privacy

- **🔒 HTTPS/TLS** - All communications encrypted
- **🛡️ Rate Limiting** - Abuse prevention and fair usage
- **🔑 API Key Auth** - Optional authentication for premium features
- **🎭 Privacy First** - No permanent storage of user locations
- **📋 GDPR Compliant** - European data protection standards

## 🚀 Performance

### Response Times
- **Address Services**: 200-500ms
- **Creative Analysis**: 800-1500ms  
- **Comprehensive Analysis**: 1500-3000ms
- **Batch Processing**: 30-60 seconds (50 properties)

### Caching
- **Cache Hit Rate**: ~70% for popular locations
- **Performance Boost**: 5-10x faster for cached results
- **Cost Savings**: Significant reduction in provider API calls

## 📈 Roadmap

### 2024 Q1
- [ ] Machine learning property scoring
- [ ] Real estate market integration
- [ ] Mobile SDK development
- [ ] GraphQL API support

### 2024 Q2  
- [ ] Drone imagery analysis
- [ ] Predictive property values
- [ ] Climate risk assessment
- [ ] International expansion

### 2024 Q3
- [ ] AI property descriptions
- [ ] Virtual tour integration
- [ ] Blockchain verification
- [ ] ESG scoring system

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- **📧 Email**: support@convexitylab.com
- **📚 Documentation**: [Complete API Docs](docs/property-intelligence-api.md)
- **🐛 Issues**: [GitHub Issues](https://github.com/ConvexityLab/appraisal-management-backend/issues)
- **💬 Community**: [Developer Forum](https://forum.convexitylab.com)

---

**Built with ❤️ by the ConvexityLab Team**

*Revolutionizing property intelligence through advanced geospatial analytics and creative lifestyle scoring*