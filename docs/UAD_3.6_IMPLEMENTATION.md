# UAD 3.6 Implementation Guide

## Overview

This platform now supports the **Uniform Appraisal Dataset (UAD) 3.6** specification for submitting residential appraisal reports to:
- **Fannie Mae UCDP** (Uniform Collateral Data Portal)
- **Freddie Mac EAD** (Electronic Appraisal Delivery)

UAD ensures standardized appraisal data collection and reporting across the mortgage industry, making it easier for GSEs to assess loan quality and collateral risk.

---

## Architecture

### Components

1. **Type Definitions** (`src/types/uad-3.6.ts`)
   - Complete TypeScript interfaces for UAD 3.6 data structures
   - Enums for all standardized fields (Quality Ratings, Condition Ratings, Property Types, etc.)
   - Full support for FNMA Form 1004 (URAR) and related forms

2. **Validation Service** (`src/services/uad-validation.service.ts`)
   - Comprehensive validation against UAD 3.6 rules
   - Field-level validation with specific error codes
   - USPAP compliance checking
   - Comparable adjustment validation

3. **MISMO XML Generator** (`src/services/mismo-xml-generator.service.ts`)
   - Generates MISMO 3.4 compliant XML for GSE submission
   - Supports both UCDP and EAD formats
   - Handles subject property, comparables, approaches to value, and appraiser certifications

---

## Key UAD 3.6 Requirements

### Quality and Condition Ratings (Required)

**Quality Ratings (Q1-Q6):**
- `Q1` - Best quality: superior materials and workmanship
- `Q2` - Excellent: high quality materials, above average workmanship
- `Q3` - Good quality: good materials, average workmanship
- `Q4` - Average quality: adequate materials and workmanship
- `Q5` - Fair quality: low cost materials with average workmanship
- `Q6` - Poor quality: minimum standards, often distressed

**Condition Ratings (C1-C6):**
- `C1` - New/Never occupied: like new condition
- `C2` - Like new: minimal wear and tear
- `C3` - Well maintained: normal wear and tear
- `C4` - Average: deferred maintenance apparent
- `C5` - Fair: ongoing deferred maintenance
- `C6` - Poor: substantial damage/deferred maintenance

### Required Subject Property Fields

```typescript
{
  // Address (all required)
  streetAddress: string;
  city: string;
  state: string; // Two-letter code
  zipCode: string; // 5 or 9 digits
  county: string;
  
  // Property Classification
  propertyType: UadPropertyType; // Detached, SemiDetached, RowHouse, etc.
  occupancyType: UadOccupancyType; // PrincipalResidence, SecondHome, Investment
  
  // Physical Characteristics
  yearBuilt: number;
  grossLivingArea: number; // Above grade square feet
  totalRooms: number;
  totalBedrooms: number;
  totalBathrooms: number;
  
  // UAD Ratings (Required)
  qualityRating: UadQualityRating; // Q1-Q6
  conditionRating: UadConditionRating; // C1-C6
}
```

### Comparables Requirements

- **Minimum 3 comparables** required for Sales Comparison Approach
- Each comparable must have:
  - Sale price and date
  - Data source (MLS, PublicRecords, Appraiser, etc.)
  - Physical characteristics (GLA, bed/bath, year built)
  - Quality and condition ratings (Q/C scale)
  - **Adjustments** for all differences from subject
  - Net and gross adjustment amounts
  - Adjusted sale price

### Adjustments (Required for Each Comparable)

```typescript
{
  dateOfSale: number; // Time adjustment
  locationAdjustment: number; // Use 0 if no adjustment
  grossLivingArea: number; // Required
  // Optional but recommended:
  siteSize?: number;
  view?: number;
  qualityOfConstruction?: number;
  condition?: number;
  functionalUtility?: number;
  garageCarport?: number;
  pool?: number;
}
```

---

## Usage Examples

### 1. Create UAD Compliant Appraisal Report

```typescript
import { UadAppraisalReport, UadQualityRating, UadConditionRating } from './types/uad-3.6';

const appraisalReport: UadAppraisalReport = {
  appraisalReportIdentifier: 'APR-2026-001',
  uadVersion: '3.6',
  mismoVersion: '3.4',
  formType: '1004',
  
  subjectProperty: {
    streetAddress: '123 Main Street',
    city: 'Springfield',
    state: 'IL',
    zipCode: '62701',
    county: 'Sangamon',
    
    propertyType: UadPropertyType.DETACHED,
    occupancyType: UadOccupancyType.PRINCIPAL_RESIDENCE,
    currentUse: 'Single Family Residence',
    buildingStatus: UadBuildingStatusType.EXISTING,
    
    yearBuilt: 2010,
    effectiveAge: 12,
    
    grossLivingArea: 2400,
    totalRooms: 8,
    totalBedrooms: 4,
    totalBathrooms: 2,
    halfBathrooms: 1,
    
    qualityRating: UadQualityRating.Q3, // Good quality
    conditionRating: UadConditionRating.C3, // Well maintained
    
    siteSizeSquareFeet: 10000,
    siteShape: 'Rectangular',
    view: [UadViewType.RESIDENTIAL],
    
    foundationType: 'Slab',
    exteriorWalls: 'Vinyl Siding',
    roofSurface: 'Asphalt Shingle',
    
    heating: 'Forced Air',
    cooling: 'Central A/C',
    fireplaces: 1,
    
    garageType: 'Attached',
    garageCars: 2,
    
    basementArea: 1200,
    basementFinishedArea: 600,
    
    pool: 'None',
    
    locationRating: 'Neutral',
    zoningCompliance: 'Legal',
    highestAndBestUse: 'Present',
    
    publicUtilities: {
      electricity: 'Public',
      gas: 'Public',
      water: 'Public',
      sanitary: 'Public'
    },
    
    street: {
      paved: true,
      surfaceType: 'Asphalt'
    },
    
    femaFloodZone: 'X',
    femaMapNumber: '17167C0123F',
    femaMapDate: new Date('2020-01-15')
  },
  
  appraisalInfo: {
    clientName: 'ABC Mortgage Company',
    clientAddress: '456 Bank Street, Chicago, IL 60601',
    
    appraisalOrderDate: new Date('2026-01-05'),
    inspectionDate: new Date('2026-01-08'),
    reportDate: new Date('2026-01-10'),
    
    intendedUse: 'To evaluate property for mortgage financing',
    intendedUser: 'Lender/Client',
    
    propertyRightsAppraised: 'FeeSimple',
    
    loanNumber: 'LOAN-123456',
    fileNumber: 'FILE-789',
    
    salePrice: 385000,
    salePriceDate: new Date('2026-01-05'),
    
    neighborhood: {
      location: 'Suburban',
      builtUp: '25-75%',
      growth: 'Stable',
      propertyValues: 'Stable',
      demandSupply: 'In Balance',
      marketingTime: '3-6 months',
      predominantOccupancy: 'Owner',
      singleFamilyPriceRange: { low: 300000, high: 500000 },
      predominantAge: '10-20 years',
      presentLandUse: {
        singleFamily: 85,
        multifamily: 5,
        commercial: 8,
        other: 2
      },
      landUseChange: 'Not Likely',
      neighborhoodBoundaries: 'N: Oak St, S: Elm St, E: Park Rd, W: River Rd',
      neighborhoodDescription: 'Established residential subdivision with good schools and amenities',
      marketConditionsDescription: 'Market is balanced with steady demand and moderate supply'
    },
    
    marketConditions: {
      competingPropertiesCurrentlyOnMarket: 12,
      competingPropertiesInLast12Months: 45,
      competingPropertiesAbsorptionRate: '3.75 months',
      overallMarketTrend: 'Stable',
      priceRangeLow: 300000,
      priceRangeHigh: 500000,
      averageDaysOnMarket: 45
    },
    
    highestAndBestUse: 'Current use as single-family residence is the highest and best use'
  },
  
  salesComparisonApproach: {
    comparables: [
      {
        comparableNumber: 1,
        proximityToSubject: '0.3 miles N',
        address: {
          streetAddress: '456 Oak Street',
          city: 'Springfield',
          state: 'IL',
          zipCode: '62701'
        },
        salePrice: 395000,
        salePricePerGLA: 165,
        saleDate: new Date('2025-11-15'),
        dataSource: UadDataSourceType.MLS,
        verificationSource: 'Multiple Listing Service',
        saleType: UadSaleType.ARM_LENGTH,
        financingType: UadFinancingType.CONVENTIONAL,
        propertyType: UadPropertyType.DETACHED,
        yearBuilt: 2008,
        effectiveAge: 14,
        grossLivingArea: 2400,
        siteSizeSquareFeet: 9500,
        roomCount: 8,
        bedroomCount: 4,
        bathroomCount: 2.5,
        basementArea: 1200,
        basementFinishedArea: 600,
        functionalUtility: 'Good',
        garageType: 'Attached',
        garageCars: 2,
        pool: 'None',
        qualityRating: UadQualityRating.Q3,
        conditionRating: UadConditionRating.C3,
        view: [UadViewType.RESIDENTIAL],
        locationRating: 'Neutral',
        adjustments: {
          dateOfSale: 5000, // Market has appreciated 1.27%
          locationAdjustment: 0,
          siteSize: 500,
          grossLivingArea: 0,
          condition: 0,
          functionalUtility: 0,
          garageCarport: 0,
          pool: 0
        },
        netAdjustment: 5500,
        grossAdjustment: 5500,
        adjustedSalePrice: 400500
      },
      {
        comparableNumber: 2,
        proximityToSubject: '0.5 miles E',
        address: {
          streetAddress: '789 Maple Avenue',
          city: 'Springfield',
          state: 'IL',
          zipCode: '62702'
        },
        salePrice: 378000,
        salePricePerGLA: 162,
        saleDate: new Date('2025-12-10'),
        dataSource: UadDataSourceType.MLS,
        verificationSource: 'MLS and Public Records',
        saleType: UadSaleType.ARM_LENGTH,
        financingType: UadFinancingType.CONVENTIONAL,
        propertyType: UadPropertyType.DETACHED,
        yearBuilt: 2012,
        effectiveAge: 10,
        grossLivingArea: 2330,
        siteSizeSquareFeet: 10500,
        roomCount: 7,
        bedroomCount: 3,
        bathroomCount: 2.5,
        basementArea: 1165,
        basementFinishedArea: 500,
        functionalUtility: 'Good',
        garageType: 'Attached',
        garageCars: 2,
        pool: 'None',
        qualityRating: UadQualityRating.Q3,
        conditionRating: UadConditionRating.C2,
        view: [UadViewType.RESIDENTIAL],
        locationRating: 'Neutral',
        adjustments: {
          dateOfSale: 2500,
          locationAdjustment: 0,
          siteSize: -500,
          grossLivingArea: 7000, // +70 sq ft @ $100/sq ft
          condition: 5000, // Subject is C3 vs C2
          functionalUtility: 0,
          garageCarport: 0,
          pool: 0,
          basementBelowGrade: 3000 // 100 sq ft less finished
        },
        netAdjustment: 17000,
        grossAdjustment: 18000,
        adjustedSalePrice: 395000
      },
      {
        comparableNumber: 3,
        proximityToSubject: '0.7 miles W',
        address: {
          streetAddress: '321 Elm Drive',
          city: 'Springfield',
          state: 'IL',
          zipCode: '62701'
        },
        salePrice: 410000,
        salePricePerGLA: 163,
        saleDate: new Date('2025-10-22'),
        dataSource: UadDataSourceType.MLS,
        verificationSource: 'MLS #456789',
        saleType: UadSaleType.ARM_LENGTH,
        financingType: UadFinancingType.CONVENTIONAL,
        propertyType: UadPropertyType.DETACHED,
        yearBuilt: 2010,
        effectiveAge: 12,
        grossLivingArea: 2520,
        siteSizeSquareFeet: 11000,
        roomCount: 9,
        bedroomCount: 4,
        bathroomCount: 3,
        basementArea: 1260,
        basementFinishedArea: 700,
        functionalUtility: 'Good',
        garageType: 'Attached',
        garageCars: 3,
        pool: 'None',
        qualityRating: UadQualityRating.Q3,
        conditionRating: UadConditionRating.C3,
        view: [UadViewType.PARK],
        locationRating: 'Beneficial',
        adjustments: {
          dateOfSale: 8200, // 2% appreciation
          locationAdjustment: -5000, // Beneficial location
          siteSize: -1000,
          view: -3000,
          grossLivingArea: -12000, // -120 sq ft @ $100/sq ft
          condition: 0,
          functionalUtility: 0,
          garageCarport: -5000, // 3 vs 2 car garage
          pool: 0,
          basementBelowGrade: -3000 // 100 sq ft more finished
        },
        netAdjustment: -20800,
        grossAdjustment: 37200,
        adjustedSalePrice: 389200
      }
    ],
    reconciliation: 'All three comparables are recent sales of similar properties in the same market area. After adjustments, the indicated value range is $389,200 to $400,500. Greatest weight given to Comparable 1 due to minimal adjustments and similarity to subject.',
    indicatedValueBySalesComparison: 395000
  },
  
  reconciliation: {
    salesComparisonApproachUsed: true,
    salesComparisonValue: 395000,
    salesComparisonWeight: 100,
    
    costApproachUsed: false,
    incomeApproachUsed: false,
    
    finalOpinionOfValue: 395000,
    effectiveDate: new Date('2026-01-08'),
    
    reconciliationComments: 'The Sales Comparison Approach was given primary weight in arriving at the final value conclusion. The subject property is a typical single-family residence in an established neighborhood with good comparable sales data available. All three comparables are recent arm\'s length transactions requiring reasonable adjustments. The indicated value of $395,000 is well supported by the market data.',
    
    subjectPropertyInspected: true,
    interiorInspected: true,
    
    extraordinaryAssumptions: [],
    hypotheticalConditions: []
  },
  
  appraiserInfo: {
    name: 'John Smith',
    companyName: 'Professional Appraisal Services LLC',
    companyAddress: '123 Professional Plaza, Springfield, IL 62701',
    telephoneNumber: '217-555-0123',
    emailAddress: 'jsmith@proappraisecom',
    
    stateCertificationNumber: 'IL-12345678',
    stateOfCertification: 'IL',
    certificationType: 'Certified Residential',
    expirationDate: new Date('2027-06-30'),
    
    signatureDate: new Date('2026-01-10')
  },
  
  certifications: {
    personalInspectionOfSubjectProperty: true,
    personalInspectionOfExteriorOfComparables: true,
    noCurrentOrProspectiveInterestInProperty: true,
    noPersonalInterestOrBias: true,
    feeNotContingentOnValueReported: true,
    complianceWithUSPAP: true,
    developedInAccordanceWithUSPAP: true,
    reportedAllKnownAdverseFactors: true,
    propertyInspectionDate: new Date('2026-01-08'),
    appraiserStatement: 'I certify that, to the best of my knowledge and belief, the statements of fact contained in this appraisal report are true and correct.',
    certificationDate: new Date('2026-01-10')
  }
};
```

### 2. Validate UAD Compliance

```typescript
import { UadValidationService } from './services/uad-validation.service';

const validator = new UadValidationService();

// Full validation
const result = await validator.validateAppraisalReport(appraisalReport);

console.log(validator.getValidationSummary(result));
// Output: "✓ UAD 3.6 Validation Passed (0 warnings)"

if (!result.isValid) {
  console.log('Errors:');
  result.errors.forEach(error => {
    console.log(`  [${error.errorCode}] ${error.fieldPath}: ${error.errorMessage}`);
  });
}

if (result.warnings.length > 0) {
  console.log('Warnings:');
  result.warnings.forEach(warning => {
    console.log(`  [${warning.errorCode}] ${warning.fieldPath}: ${warning.errorMessage}`);
  });
}

// Quick validation (boolean only)
const isValid = await validator.quickValidate(appraisalReport);
console.log(`Valid: ${isValid}`);
```

### 3. Generate MISMO XML for Submission

```typescript
import { MismoXmlGenerator } from './services/mismo-xml-generator.service';

const xmlGenerator = new MismoXmlGenerator();

const submissionInfo = {
  loanNumber: 'LOAN-123456',
  lenderName: 'ABC Mortgage Company',
  lenderIdentifier: 'ABC123',
  submittingUserName: 'Jane Doe',
  submittingUserId: 'jdoe'
};

const xml = xmlGenerator.generateMismoXml(appraisalReport, submissionInfo);

// Save to file or send to UCDP/EAD
fs.writeFileSync('appraisal-submission.xml', xml);

// Or preview XML without submission
const previewXml = xmlGenerator.generatePreviewXml(appraisalReport);
```

### 4. API Endpoint for UAD Validation

```typescript
// src/controllers/uad-controller.ts
import express from 'express';
import { UadValidationService } from '../services/uad-validation.service';
import { MismoXmlGenerator } from '../services/mismo-xml-generator.service';

export const createUadRouter = () => {
  const router = express.Router();
  const validator = new UadValidationService();
  const xmlGenerator = new MismoXmlGenerator();

  // Validate appraisal report
  router.post('/validate', async (req, res) => {
    try {
      const appraisalReport = req.body;
      const result = await validator.validateAppraisalReport(appraisalReport);
      
      res.json({
        success: true,
        validation: {
          isValid: result.isValid,
          summary: validator.getValidationSummary(result),
          errors: result.errors,
          warnings: result.warnings,
          validatedAt: result.validatedAt
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // Generate MISMO XML preview
  router.post('/generate-xml', async (req, res) => {
    try {
      const { appraisalReport, submissionInfo } = req.body;
      
      // Validate first
      const validationResult = await validator.validateAppraisalReport(appraisalReport);
      if (!validationResult.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          validation: validationResult
        });
      }
      
      const xml = xmlGenerator.generateMismoXml(appraisalReport, submissionInfo);
      
      res.json({
        success: true,
        xml,
        validation: validationResult
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
};
```

---

## Common Validation Errors

### 1. Missing Quality/Condition Ratings
```
Error: QUALITY_RATING_INVALID
Field: subjectProperty.qualityRating
Message: Quality rating must be Q1-Q6
Solution: Set qualityRating to one of Q1, Q2, Q3, Q4, Q5, Q6
```

### 2. Insufficient Comparables
```
Error: INSUFFICIENT_COMPARABLES
Field: salesComparisonApproach.comparables
Message: At least 3 comparables are required
Solution: Add at least 3 comparable sales
```

### 3. Gross Living Area Adjustment Missing
```
Error: GLA_ADJUSTMENT_REQUIRED
Field: comparables[0].adjustments.grossLivingArea
Message: Gross living area adjustment is required
Solution: Provide GLA adjustment (use 0 if same size)
```

### 4. Adjusted Sale Price Calculation Error
```
Error: ADJUSTED_PRICE_CALCULATION_ERROR
Field: comparables[0].adjustedSalePrice
Message: Expected $395000, got $390000
Solution: Verify adjustedSalePrice = salePrice + netAdjustment
```

### 5. License Expired
```
Error: LICENSE_EXPIRED
Field: appraiserInfo.expirationDate
Message: Appraiser license has expired
Solution: Update appraiser license or use different appraiser
```

---

## UCDP/EAD Submission Workflow

### Phase 1: Data Collection
1. Collect property data from inspection
2. Research and select comparable sales (minimum 3)
3. Calculate adjustments for each comparable
4. Complete all required UAD fields

### Phase 2: Validation
1. Run UAD validation service
2. Fix all ERROR-level issues
3. Review WARNING-level issues
4. Ensure USPAP compliance

### Phase 3: XML Generation
1. Generate MISMO 3.4 XML
2. Review XML structure
3. Validate XML schema

### Phase 4: Submission (Future Enhancement)
1. Authenticate with UCDP/EAD
2. Submit XML to appropriate GSE
3. Receive submission ID
4. Monitor submission status
5. Handle GSE feedback messages

---

## Best Practices

### 1. Always Validate Before Submission
Never submit appraisals without running validation first. GSE rejections delay loan processing and damage lender relationships.

### 2. Document All Adjustments
Provide clear explanations for all comparable adjustments, especially:
- Location adjustments > $5,000
- Gross adjustments > 25%
- Net adjustments > 15%

### 3. Use Recent Comparables
Prefer comparables sold within 3-6 months. Sales older than 12 months may require additional explanation.

### 4. Maintain Appraiser License Status
Monitor license expiration dates and renew at least 30 days before expiration.

### 5. Follow Q/C Rating Guidelines
Use official UAD definitions for Quality and Condition ratings. Don't inflate ratings without justification.

### 6. Complete Neighborhood Analysis
Provide thorough neighborhood descriptions. Generic statements may trigger GSE review flags.

---

## Testing

### Unit Tests
```typescript
// tests/uad-validation.test.ts
import { UadValidationService } from '../services/uad-validation.service';
import { mockAppraisalReport } from './fixtures/mock-appraisal';

describe('UAD Validation Service', () => {
  let validator: UadValidationService;

  beforeEach(() => {
    validator = new UadValidationService();
  });

  it('should validate compliant appraisal report', async () => {
    const result = await validator.validateAppraisalReport(mockAppraisalReport);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect missing quality rating', async () => {
    const invalid = { ...mockAppraisalReport };
    invalid.subjectProperty.qualityRating = null;
    
    const result = await validator.validateAppraisalReport(invalid);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        errorCode: 'REQUIRED_FIELD_MISSING',
        fieldPath: 'subjectProperty.qualityRating'
      })
    );
  });

  it('should detect insufficient comparables', async () => {
    const invalid = { ...mockAppraisalReport };
    invalid.salesComparisonApproach.comparables = []; // Empty
    
    const result = await validator.validateAppraisalReport(invalid);
    expect(result.errors[0].errorCode).toBe('INSUFFICIENT_COMPARABLES');
  });
});
```

---

## Future Enhancements

### 1. Direct GSE Integration
- Implement UCDP API client for Fannie Mae
- Implement EAD API client for Freddie Mac
- Handle OAuth authentication
- Process GSE feedback messages
- Auto-retry failed submissions

### 2. Form Support
- Add support for Form 1073 (Condominium)
- Add support for Form 1025 (Small Residential Income Property)
- Add support for Form 2055 (Exterior-Only)

### 3. Enhanced Validation
- Market conditions reasonability checks
- Adjustment magnitude warnings
- Comparable proximity analysis
- Sales concessions detection

### 4. Reporting
- Generate PDF appraisal reports from UAD data
- Create submission history reports
- Track GSE acceptance/rejection rates
- Appraiser performance analytics

---

## References

- [Fannie Mae UAD Specification](https://www.fanniemae.com/singlefamily/uniform-appraisal-dataset)
- [Freddie Mac UAD Requirements](https://sf.freddiemac.com/tools-learning/appraisal-topics)
- [MISMO Standards](https://www.mismo.org/)
- [USPAP 2024-2025 Edition](https://www.appraisalfoundation.org/imis/TAF/Standards/Appraisal_Standards/Uniform_Standards_of_Professional_Appraisal_Practice/TAF/USPAP.aspx)

---

## Support

For questions about UAD implementation:
- Email: support@appraisalplatform.com
- Documentation: https://docs.appraisalplatform.com/uad-3.6
- API Reference: https://api.appraisalplatform.com/docs
