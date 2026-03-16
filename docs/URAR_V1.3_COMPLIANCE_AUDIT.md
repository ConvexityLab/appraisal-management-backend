# URAR v1.3 Compliance Audit — Gap Analysis

**Audit Date:** 2026-06-12  
**Spec Version:** URAR v1.3 (Fannie Mae / Freddie Mac, March 10, 2026)  
**Reference Documents:**
- `docs/samples/URAR-with-Field-IDs-v1.3.txt` — Field ID annotations (FIDs 1.000–N.NNN)
- `docs/samples/URAR-without-Field-IDs-v1.3.txt` — Clean field labels, 43 pages
- `docs/samples/form1004-fields.txt` — Legacy Form 1004 AcroForm (505 fields)

**Files Audited:**
- Frontend: `src/types/canonical-schema.ts` (v1.1.0, 890 lines)
- Frontend: `src/components/appraisal-form/urar-form-config.ts` (1,063 lines)
- Backend: `src/types/uad-3.6.ts` (686 lines)
- Backend: `src/services/uad-validation.service.ts` (735 lines)
- Backend: `src/mappers/canonical-to-uad.mapper.ts` (794 lines)
- Backend: `src/services/mismo-xml-generator.service.ts` (601 lines)

---

## Executive Summary

**Our implementation is modeled on the legacy 6-page Form 1004.** The new URAR v1.3 is a fundamentally restructured ~43-page form. The delta is massive:

| Metric | Our Current State | URAR v1.3 Requirement |
|---|---|---|
| Sections | 13 (subject through addenda) | 27+ distinct sections |
| Fields on CanonicalPropertyCore/Subject | ~50 | 150+ |
| Sales Comp fields per comparable | ~30 | 100+ |
| New sections we don't have at all | 0 | **14** |
| Missing fields on existing sections | 0 | **100+** |

**Bottom line:** Our codebase covers roughly 30-40% of the v1.3 URAR field set. The structure is directionally correct (sections, types, visibility predicates) but the content needs substantial expansion.

---

## Part 1: Entirely Missing Sections

These sections do not exist anywhere in our schema, form config, or backend types.

### 1.1 Disaster Mitigation (URAR Page 9)

New section tracking disaster preparedness features.

**Required data model:**
```
DisasterMitigationFeature {
  disasterCategory: string;       // e.g., "Wildfire", "Flood", "Earthquake", "Wind"
  mitigationFeature: string;      // e.g., "Fire-resistant roofing", "Flood barrier"
  detail: string;
}
communityLevelMitigationPrograms: string;
disasterMitigationCommentary: string;
```

**Impact:** New interface, new form section, new MISMO XML element, new validation rules.

---

### 1.2 Energy Efficient & Green Features (URAR Page 10)

Entirely new section for sustainability and energy features.

**Required data model:**
```
EnergyFeature {
  feature: string;                // e.g., "Solar Panels", "Geothermal", "Triple-pane windows"  
  detail: string;
  impact: string;                 // Impact on value
  comment: string;
}
renewableEnergyComponent: string; // Solar PV, Wind, Geothermal, etc.
buildingCertification: string;    // LEED, ENERGY STAR, etc.
energyEfficiencyRating: string;   // HERS, EUI, etc.
```

**Impact:** New interface, new form section, new comp grid column, new MISMO elements.

---

### 1.3 Sketch (URAR Page 11)

Building sketch / floor plan page. Asset reference (uploaded image or drawn in-app).

**Impact:** Primarily a photo/asset section. We already have `ReportPhotoAsset` with `'FLOOR_PLAN'` type — may just need a dedicated section in the form config.

---

### 1.4 Manufactured Home (URAR Page 13)

Entire section for manufactured/mobile homes. Currently we just have `propertyType: 'Manufactured'` but no structured data.

**Required data model:**
```
ManufacturedHomeDetail {
  hudDataPlateNumber: string;
  hudLabelNumbers: string[];
  manufacturer: string;
  modelName: string;
  serialNumber: string;
  yearManufactured: number;
  width: string;                  // "Single-wide", "Double-wide", "Multi-wide"
  invoicePrice: number | null;
  deliveryCost: number | null;
  installationCost: number | null;
  setupCost: number | null;
  foundationType: string;         // "Permanent", "Non-permanent"
}
```

**Impact:** New interface, new form section (conditional on `propertyType`), new MISMO XML section.

---

### 1.5 Functional Obsolescence (URAR Page 15)

Table-driven section for recording functional issues.

**Required data model:**
```
FunctionalObsolescenceItem {
  feature: string;                // e.g., "Floor plan layout"
  description: string;
  curable: boolean;
  detail: string;
  impact: string;                 // Impact to value
  comment: string;
}
```

**Impact:** New interface, new form section, feeds into cost approach depreciation.

---

### 1.6 Outbuilding (URAR Page 16)

Replaces part of the old "other features" area. Each outbuilding is a distinct entry.

**Required data model:**
```
Outbuilding {
  outbuildingType: string;        // "Detached Garage", "Barn", "Workshop", "Guest House"
  grossBuildingArea: number;
  finishedArea: number;
  unfinishedArea: number;
  structureVolume: number | null;
  bathsFull: number;
  bathsHalf: number;
  kitchens: number;
  heating: string;
  cooling: string;
  utilities: string;
  features: OutbuildingFeature[];
}
OutbuildingFeature {
  feature: string;
  detail: string;
  impact: string;
  comment: string;
}
```

**Impact:** New array-type interface on subject, separate form section with add/remove rows, feeds into cost approach depreciation, appears in comp grid.

---

### 1.7 Vehicle Storage (URAR Page 17)

Replaces our simple `garageType` + `garageSpaces` fields. Multi-entry table.

**Required data model:**
```
VehicleStorage {
  type: string;                   // "Attached Garage", "Detached Garage", "Carport", "Built-In"
  spaces: number;
  detail: string;
  impact: string;
  comment: string;
  yearBuilt: number | null;
  surfaceArea: number | null;
  interiorStorage: boolean;
}
```

**Impact:** Replaces `garageType`/`garageSpaces`/`carportSpaces` on `CanonicalPropertyCore`. Breaking change to existing fields.

---

### 1.8 Subject Property Amenities (URAR Page 18)

Structured amenity table replacing our simple `porchPatioDeck`/`pool` fields.

**Required data model:**
```
PropertyAmenity {
  category: 'Outdoor Accessories' | 'Outdoor Living' | 'Water Features' | 'Whole Home' | 'Miscellaneous';
  feature: string;
  detail: string;
  impact: string;
  comment: string;
}
```

**Impact:** Replaces `porchPatioDeck`, `pool` on `CanonicalPropertyCore`. Breaking change.

---

### 1.9 Overall Quality & Condition (URAR Page 19)

Separate page with per-structure and per-unit quality/condition breakdowns.

**Required data model:**
```
OverallQualityCondition {
  overallQuality: string;                    // Q1-Q6
  exteriorQuality: Record<string, string>;   // structureId → Q1-Q6
  interiorQuality: Record<string, string>;   // unitId → Q1-Q6
  overallCondition: string;                  // C1-C6
  exteriorCondition: Record<string, string>; // structureId → C1-C6
  interiorCondition: Record<string, string>; // unitId → C1-C6
  reconciliationNarrative: string;
}
```

**Impact:** Our current single `quality`/`condition` on `CanonicalPropertyCore` becomes a subset of this richer model. Per-feature detail (exterior walls, foundation, roof, windows / interior kitchen, bathrooms, flooring, walls) also needed for the comp grid.

---

### 1.10 Subject Listing Information (URAR Page 23)

Separate section for current and historical listings.

**Required data model:**
```
SubjectListing {
  dataSource: string;
  listingStatus: string;          // "Active", "Pending", "Sold", "Withdrawn", "Expired"
  listingType: string;
  listingId: string;
  startDate: string;
  endDate: string | null;
  daysOnMarket: number | null;
  startingListPrice: number | null;
  currentOrFinalListPrice: number | null;
}
totalDaysOnMarket: number | null;
listingHistoryAnalysis: string;
```

**Impact:** New array on subject property, new form section, feeds into reconciliation.

---

### 1.11 Prior Sale & Transfer History (URAR Page 25)

Currently we have `subjectPriorSaleDate1/2` on metadata and `priorSalePrice/Date` on comps. The v1.3 URAR structures this as a full separate section with analysis.

**Required data model:**
```
SubjectTransferHistory {
  transfers: TransferRecord[];    // minimum 3-year lookback
  analysis: string;
}
ComparableTransferHistory {
  compNumber: number;
  transfers: TransferRecord[];    // minimum 1-year lookback
  analysis: string;
}
TransferRecord {
  dataSource: string;
  transferTerms: string;
  date: string;
  amount: number | null;
}
```

**Impact:** Replaces existing prior sale fields, new form section, new comp grid section.

---

### 1.12 Rental Information (URAR Pages 32-34)

Full rental analysis section for multi-unit and income properties.

**Required data model:**
```
RentalInformation {
  rentSchedule: UnitRentalInfo[];
  actualIncome: UnitIncome[];
  opinionOfMarketIncome: UnitIncome[];
  rentalComparables: RentalComparable[];  // up to 5
  rentalAnalysisCommentary: string;
}
UnitRentalInfo {
  unitIdentifier: string;
  currentlyRented: boolean;
  occupancy: string;
  monthlyRent: number;
  monthToMonth: boolean;
  leaseStart: string;
  rentControl: boolean;
  rentConcessions: string;
  utilitiesIncluded: string;
  furnished: boolean;
}
```

**Impact:** New section, required for Form 1025 (income properties). Our `CanonicalIncomeApproach` has `rentComps` but not the full structured rental schedule.

---

### 1.13 Revision History / Reconsideration of Value (URAR Page 38)

New tracking for report revisions and reconsiderations.

**Required data model:**
```
RevisionEntry {
  revisionDate: string;
  urarSection: string;
  description: string;
}
ReconsiderationOfValue {
  type: string;
  date: string;
  result: string;
  commentary: string;
}
```

**Impact:** New metadata-level fields on the report document.

---

### 1.14 Apparent Defects, Damages, Deficiencies (URAR Pages 4, 37)

Table appearing on both the Summary and Reconciliation pages.

**Required data model:**
```
DefectItem {
  feature: string;                // Section reference (Site, Dwelling Exterior, Unit Interior, etc.)
  location: string;               // Structure/Unit identifier
  description: string;
  affectsSoundnessOrStructuralIntegrity: boolean;
  recommendedAction: string;
  estimatedCostToRepair: number | null;
}
asIsOverallConditionRating: string;   // C1-C6
totalEstimatedCostOfRepairs: number;
```

**Impact:** New array on the report document, cross-referenced from multiple sections.

---

## Part 2: Missing Fields on Existing Sections

### 2.1 Subject / Summary (URAR Pages 3, 6)

| Field | URAR v1.3 | Our Schema | Status |
|---|---|---|---|
| `assignmentReason` | Purchase / Refinance / Other | `isSubjectPurchase` (boolean) | **WRONG TYPE** — needs enum |
| `listingStatus` | Active / Pending / Sold / etc. | ❌ Missing | **ADD** |
| `propertyValuationMethod` | New field | ❌ Missing | **ADD** |
| `constructionMethod` | Site Built / Modular / Manufactured / etc. | ❌ Missing | **ADD** |
| `attachmentType` | Attached / Detached / Semi-Detached | ❌ Missing | **ADD** |
| `structureDesign` | 1-story / 2-story / Split-Level / etc. | `design` (free text) | **PARTIAL** — needs standardized enum |
| `condop` | Property type option | ❌ Missing from `PROPERTY_TYPE_OPTIONS` | **ADD** |
| `siteOwnedInCommon` | Yes/No | ❌ Missing | **ADD** |
| `unitsExcludingAdus` | Number | ❌ Missing | **ADD** |
| `accessoryDwellingUnits` | Number | ❌ Missing | **ADD** |
| `propertyRestriction` | Description | ❌ Missing | **ADD** |
| `encroachment` | Description | ❌ Missing | **ADD** |
| `hudDataPlate` | Yes/No | ❌ Missing | **ADD** |
| `hudLabel` | Yes/No | ❌ Missing | **ADD** |
| `fhaReoInsurabilityLevel` | Rating | ❌ Missing | **ADD** |
| `bathsFull` | Number | Combined as `bathrooms` | **SPLIT** |
| `bathsHalf` | Number | Combined as `bathrooms` | **SPLIT** |
| `finishedAreaAboveGrade` | Number | `grossLivingArea` (partial) | **ADD** (v1.3 distinguishes these) |
| `grossBuildingFinishedArea` | Number | ❌ Missing (includes below-grade) | **ADD** |
| `alternatePhysicalAddress` | Full address | ❌ Missing | **ADD** |
| `propertyOnNativeAmericanLands` | Yes/No | ❌ Missing | **ADD** |
| `homeownerResponsibleForExteriorMaintenance` | Yes/No | ❌ Missing | **ADD** |
| `apnDescription` | Text | ❌ Missing | **ADD** |
| `specialTaxAssessments` | Amount/Description | ❌ Missing | **ADD** |
| `newConstruction` | Yes/No | ❌ Missing | **ADD** |
| `constructionStage` | Proposed / Under Construction / Complete | ❌ Missing | **ADD** |
| `communityLandTrust` | Yes/No | ❌ Missing | **ADD** |
| `groundRent` | Annual Amount / Renewable / Term / Expires | ❌ Missing | **ADD** |
| `mineralRightsLeased` | Yes/No | ❌ Missing | **ADD** |
| `allRightsIncluded` | Yes/No | ❌ Missing | **ADD** |
| `rightsNotIncluded` | Description | ❌ Missing | **ADD** |

### 2.2 Site (URAR Pages 7-8)

| Field | URAR v1.3 | Our Schema | Status |
|---|---|---|---|
| `numberOfParcels` | Number | ❌ Missing | **ADD** |
| `contiguous` | Yes/No | ❌ Missing | **ADD** |
| `elementsDividingParcels` | Text | ❌ Missing | **ADD** |
| `primaryAccess` | Text | ❌ Missing | **ADD** |
| `streetType` | Paved / Gravel / Dirt / etc. | ❌ Missing | **ADD** |
| `streetSurface` | Text | ❌ Missing | **ADD** |
| `maintenanceAgreement` | Yes/No | ❌ Missing | **ADD** |
| Site Influence table | Influence/Proximity/Detail/Impact/Comment | ❌ Missing | **ADD** (array of objects) |
| `apparentEnvironmentalConditions` | Text | ❌ Missing | **ADD** |
| `hazardZone` | Text | `floodZone` only | **EXPAND** |
| `hazardZoneDescription` | Text | ❌ Missing | **ADD** |
| Water Frontage section | Private Access / Permanent Feature / Right to Build / Linear Measurement / Natural or Man-Made | ❌ Missing entirely | **ADD** |
| View `rangeOfView` | Text | `view` (single text) | **EXPAND** |
| View `viewImpact` | Beneficial/Neutral/Adverse | `locationRating` (different concept) | **ADD** |
| Site Features table | Feature/Detail/Impact/Comment | ❌ Missing | **ADD** (array) |
| `broadbandInternetAvailable` | Yes/No | ❌ Missing | **ADD** |
| `dwellingWithinUtilityEasement` | Yes/No | ❌ Missing | **ADD** |
| Utilities Public/Private distinction | Each utility has Public vs Private | Public/Other/None only | **EXPAND** |

### 2.3 Dwelling Exterior — our "Improvements" section (URAR Page 12)

| Field | URAR v1.3 | Our Schema | Status |
|---|---|---|---|
| `structureIdentifier` | Multi-structure support ID | ❌ Missing | **ADD** |
| `subjectPropertyUnitsInStructure` | Number | ❌ Missing | **ADD** |
| `floorsInBuilding` | Number | `stories` (similar but not identical) | **VERIFY** |
| `dwellingStyle` | Standardized | `design` (free text) | **STANDARDIZE** |
| `frontDoorElevation` | Floor level | ❌ Missing | **ADD** |
| Townhouse: `endUnit` | Yes/No | ❌ Missing | **ADD** |
| Townhouse: `backToBack` | Yes/No | ❌ Missing | **ADD** |
| Townhouse: `unitsAbove` | Number | ❌ Missing | **ADD** |
| Townhouse: `unitsBelow` | Number | ❌ Missing | **ADD** |
| Townhouse: `townhouseLocation` | Interior/End/Other | ❌ Missing | **ADD** |
| `factoryBuiltCertification` | Text | ❌ Missing | **ADD** |
| `structureVolume` | Cubic feet | ❌ Missing | **ADD** |
| `windowSurfaceArea` | Square feet | ❌ Missing | **ADD** |
| `remainingEconomicLife` | Years | ❌ Missing (have `effectiveAge` only) | **ADD** |
| `constructionMethod` | Site Built / Modular / Manufactured | ❌ Missing | **ADD** |
| `attachmentType` | Attached / Detached / Semi-Detached | ❌ Missing | **ADD** |
| Per-feature exterior Q/C | Walls, Foundation, Roof, Windows each get Quality + Condition | Single overall Q/C | **EXPAND** |
| Noncontinuous Finished Area table | Area(s) not connected to main dwelling | ❌ Missing | **ADD** |
| Mechanical System Details | Expanded HVAC detail | `heating`/`cooling` (basic) | **EXPAND** |

### 2.4 Unit Interior (URAR Page 14)

| Field | URAR v1.3 | Our Schema | Status |
|---|---|---|---|
| `finishedAreaAboveGrade` | Number | `grossLivingArea` | **PARTIAL** |
| `finishedAreaAboveGradeNonstandard` | Number | ❌ Missing | **ADD** |
| `unfinishedAreaAboveGrade` | Number | ❌ Missing | **ADD** |
| `finishedAreaBelowGrade` | Number | `basementFinishedSqFt` | **RENAME** |
| `finishedAreaBelowGradeNonstandard` | Number | ❌ Missing | **ADD** |
| `unfinishedAreaBelowGrade` | Number | ❌ Missing | **ADD** |
| `isAdu` | Yes/No | ❌ Missing | **ADD** |
| `legallyRentable` | Yes/No | ❌ Missing | **ADD** |
| `separatePostalAddress` | Yes/No | ❌ Missing | **ADD** |
| `cornerUnit` | Yes/No | ❌ Missing | **ADD** |
| `floorNumber` | Number | ❌ Missing (have `unitFloorLevel` on CondoDetail only) | **PROMOTE** |
| `levelsInUnit` | Number | ❌ Missing | **ADD** |
| Level/Room Detail | Room name / Count / Grade Level per level | `totalRooms`/`bedrooms`/`bathrooms` (flat) | **RESTRUCTURE** |
| Kitchen Update Status | Time frame / Quality / Condition | ❌ Missing | **ADD** |
| Bathroom Update Status | Time frame / Quality / Condition | ❌ Missing | **ADD** |
| Interior Features table | Feature/Detail/Impact/Comment | ❌ Missing | **ADD** (array) |
| `accessibilityFeatures` | Description | ❌ Missing | **ADD** |
| Per-feature interior Q/C | Kitchen, Bathrooms, Flooring, Walls/Ceiling | Single overall Q/C | **EXPAND** |

### 2.5 Sales Contract (URAR Page 24)

| Field | URAR v1.3 | Our Schema | Status |
|---|---|---|---|
| `isSalesContract` | Yes/No | Implicit (section visibility) | **ADD** explicit |
| `wasContractAnalyzed` | Yes/No | ❌ Missing | **ADD** |
| `isArmLengthTransaction` | Yes/No | ❌ Missing | **ADD** |
| `nonArmLengthCommentary` | Text | ❌ Missing | **ADD** |
| `transferTerms` | Text | ❌ Missing | **ADD** |
| `personalPropertyConveyed` | Text | ❌ Missing | **ADD** |
| `knownSalesConcessions` | Text | `financingConcessions` (partial) | **EXPAND** |
| `totalSalesConcessions` | Number | `concessionsAmount` on comp only | **ADD to subject** |
| `typicalForMarket` | Yes/No | ❌ Missing | **ADD** |
| `salesContractAnalysis` | Narrative | ❌ Missing | **ADD** |

### 2.6 Market (URAR Page 21) — vs our Neighborhood

| Field | URAR v1.3 | Our Schema | Status |
|---|---|---|---|
| `marketAreaBoundary` | Text/Map | `boundaryDescription` | **RENAME/VERIFY** |
| `searchCriteriaDescription` | Text | ❌ Missing | **ADD** |
| Active Listings metrics | Median DOM, Low/Median/High Price | ❌ Missing (structured) | **ADD** |
| Pending Sales metrics | Count | ❌ Missing | **ADD** |
| Sales in Past X Months | Count, Low/Median/High | ❌ Missing | **ADD** |
| `distressedMarketCompetition` | Text | ❌ Missing | **ADD** |
| `priceTrendSource` | Text | ❌ Missing | **ADD** |
| `priceTrendAnalysisCommentary` | Text | ❌ Missing | **ADD** |
| `housingTrends` | Demand/Supply/Marketing Time | `demandSupply`/`marketingTime` | **PARTIAL** — restructure |
| `marketCommentary` | Text | `marketConditionsNotes` | **RENAME** |

*Note:* The v1.3 Market section is significantly restructured from our `CanonicalNeighborhood`. The old neighborhood characteristics (Urban/Suburban/Rural, Built Up %, Growth, Present Land Use) are largely gone from this section. Some of this data may now be captured differently or is implicit in the Search Result Metrics.

### 2.7 Project Information (URAR Page 22) — vs our Condo/PUD/HOA

| Field | URAR v1.3 | Our Schema | Status |
|---|---|---|---|
| `projectInfoDataSource` | Text | ❌ Missing | **ADD** |
| `reasonUnitsRentedIsEstimated` | Text | ❌ Missing | **ADD** |
| `mandatoryFees` monthly amount | Number | `hoaFee` | **RENAME** (broader concept) |
| `commonAmenities` | Text | `hoaIncludes` (partial) | **VERIFY** |
| `utilitiesIncluded` | Yes/No + list | ❌ Missing | **ADD** |
| `observedDeficiencies` + description | Yes/No + Text | `observedProjectDeficiencies` concept exists | **ADD** |
| `projectComplete` / `buildingComplete` | Yes/No each | `commonElementsComplete` (partial) | **EXPAND** |
| `convertedInPast3Years` | Yes/No | ❌ Missing | **ADD** |
| `groundRent` at project level | Annual + Expires | ❌ Missing | **ADD** |
| Cooperative: `sharesIssued` | Number | ❌ Missing entirely | **ADD** |
| Cooperative: `sharesAttributableToSubject` | Number | ❌ Missing | **ADD** |
| Cooperative: `proprietaryLeaseExpires` | Date | ❌ Missing | **ADD** |
| Cooperative: `blanketFinancing` | Yes/No | ❌ Missing | **ADD** |
| Cooperative: Pro Rata Share + Lien Detail | Complex nested (4 liens × 7 fields) | ❌ Missing | **ADD** |
| Project Factors table | 10 factors with Detail/Impact/Comment | ❌ Missing | **ADD** (array) |

### 2.8 Sales Comparison Grid (URAR Pages 26-29)

The v1.3 comp grid is massively expanded. Our `CanonicalComp` (extending `CanonicalPropertyCore`) has ~30 fields. The v1.3 grid has **100+ fields per comparable**, organized as:

**New comp fields NOT in our `CanonicalComp`:**
- `transferTerms`, `financingType` (partially covered)
- `contractPrice` (separate from `salePrice`)
- `saleToListPriceRatio`
- `attachedDetached`, `propertyRightsAppraised`
- `annualGroundRent`, `nativeAmericanLands`
- `allRightsIncluded`, `rightsNotIncluded`
- `sameBuilderAsSubject`
- Project info: `projectName`, `sameProjectAsSubject`, `monthlyFee`, `commonAmenities`, `specialAssessments`
- Site: `siteOwnedInCommon`, `neighborhoodName`, `zoningCompliance`, `hazardZone`, `primaryAccess`, `streetType`, `propertyRestriction`, `easement`, `topography`, `drainage`, `siteCharacteristics`, `siteInfluence`, `apparentEnvironmentalConditions`, `viewRange`, Water Frontage details
- Dwelling: `structureDesign`, `grossBuildingFinishedArea`, `noncontinuousFinishedArea`, Townhouse details, `constructionMethod`, `manufacturedHomeWidth`, `dwellingStyle`, `totalDwellingVolume`, `windowSurfaceArea`, `functionalIssues`, `disasterMitigation`, Mechanical details, Energy/Green features, `renewableEnergyComponent`, `buildingCertification`, `efficiencyRating`
- Unit: `structureId`, `unitId`, `aduLocation`, `floorNumber`, `cornerUnit`, `levelsInUnit`, `bathsFull`, `bathsHalf`, `finishedAreaAboveGrade`, `finishedAreaAboveGradeNonstandard`, `unfinishedAreaAboveGrade`, `finishedAreaBelowGrade`, `finishedAreaBelowGradeNonstandard`, `unfinishedAreaBelowGrade`, `accessibilityFeatures`
- Per-feature Q/C: Exterior (walls/foundation/roof/windows), Interior (kitchen/bathrooms/flooring/walls), ADU Interior Q/C
- Overall Q/C ratings
- Property Amenities: Outdoor Accessories/Living/Water/Whole Home/Misc categories
- Vehicle Storage: Type/Spaces/Detail
- Outbuilding: Type/GBA/Finished/Unfinished/Volume/Baths/Kitchens/HVAC/Utilities
- Summary: `adjustedPricePerUnit`, `adjustedPricePerBedroom`, `pricePerGrossBuildingFinishedArea`, `pricePerFinishedAreaAboveGrade`, `comparableWeight`

**Additional Properties Analyzed Not Used:** New table for additional comps considered but excluded (Address, Sale Date, Status, Reason Not Used, Comment).

### 2.9 Cost Approach (URAR Page 36)

| Field | URAR v1.3 | Our Schema | Status |
|---|---|---|---|
| Per-structure depreciation | `[Structure Identifier]` → Physical/Functional/External + Total | Single flat depreciation | **RESTRUCTURE** |
| Per-outbuilding depreciation | `[Outbuilding Type]` → Physical/Functional/External + Total | ❌ Missing | **ADD** |
| Manufactured Home delivery costs | Delivery + Installation + Setup | ❌ Missing | **ADD** |
| `remainingEconomicLife` | Per structure | ❌ Missing | **ADD** |
| `effectiveAge` | Per structure | Single flat | **RESTRUCTURE** |
| `commentaryOnRemainingEconomicLife` | Narrative | ❌ Missing | **ADD** |
| `commentaryOnEffectiveAge` | Narrative | ❌ Missing | **ADD** |
| Site Improvements table | Description + Amount per item | `siteImprovementsCost` (single number) | **EXPAND** |
| Land Comparables table | Address/County/APN/Site Size/Sale Date/Price | `landValueEvidence` (text) | **RESTRUCTURE** |
| `costType` | Replacement/Reproduction | ❌ Missing | **ADD** |
| `costMethod` | Method description | ❌ Missing (have `costFactorSource`) | **ADD** |
| `depreciationMethod` | Separate from type | `depreciationType` | **VERIFY/EXPAND** |

### 2.10 Reconciliation (URAR Page 37)

| Field | URAR v1.3 | Our Schema | Status |
|---|---|---|---|
| Per-approach `reasonForExclusion` | Text per approach | ❌ Missing | **ADD** |
| `opinionOfMarketValueCooperativeInterest` | Number | ❌ Missing | **ADD** |
| `proRataShareCalculationMethod` | Text | ❌ Missing | **ADD** |
| `marketValueCondition` | Text | ❌ Missing | **ADD** |
| `reasonableExposureTime` | Text | `exposureTime` | **RENAME/VERIFY** |
| `fhaReoInsurabilityLevel` | Rating | ❌ Missing | **ADD** |
| `finalValueConditionStatement` | Long text | ❌ Missing | **ADD** |
| Client Requested Conditions | Value Condition / Marketing Time / Duration / Alternate Opinion / Commentary | ❌ Missing entirely | **ADD** |

---

## Part 3: Structural / Conceptual Differences

### 3.1 Breaking Changes Required

| Current | v1.3 Requirement | Migration Impact |
|---|---|---|
| `bathrooms: number` (combined) | `bathsFull: number` + `bathsHalf: number` | **HIGH** — every mapper, comp, form field, validation rule |
| `garageType` + `garageSpaces` + `carportSpaces` | Vehicle Storage array (Type/Spaces/Detail) | **HIGH** — replaces 3 fields with array |
| `porchPatioDeck` + `pool` + `attic` | Property Amenities table (5 categories) | **MEDIUM** — replaces 3 fields with array |
| `isSubjectPurchase: boolean` | `assignmentReason: 'Purchase' \| 'Refinance' \| 'Other'` | **MEDIUM** — visibility predicates rely on boolean |
| Single `quality` / `condition` (Q/C) | Per-feature exterior + interior + overall (+ADU) | **HIGH** — fundamental change to Q/C model |
| Single "improvements" section | Dwelling Exterior + Unit Interior + Outbuilding + Vehicle Storage + Amenities | **HIGH** — section restructuring |
| `CanonicalNeighborhood` | Market section (restructured) + Site Influence table | **MEDIUM** — data model change |
| Flat depreciation | Per-structure + per-outbuilding depreciation breakdown | **MEDIUM** — cost approach restructuring |

### 3.2 Multi-Structure / ADU Support

The v1.3 URAR introduces `[Structure Identifier]` and `[Unit Identifier]` placeholders throughout the form, indicating the form is designed for:
- Multiple structures on a single property (main dwelling + ADU + outbuildings)
- Multiple units within a structure (multi-unit properties)
- Per-structure quality/condition tracking
- Per-structure depreciation in cost approach

This is a **fundamental architectural concept** not present in our current schema. Most of our interfaces assume a single structure.

### 3.3 Table-Driven Sections

Many v1.3 sections use repeating table patterns (rows of Feature/Detail/Impact/Comment). This requires array-type fields and dynamic row add/remove UI. Our current `FormFieldConfig` system handles single-value fields only.

Sections using this pattern:
- Site Influence, Site Features
- Disaster Mitigation
- Energy Efficient Features
- Functional Obsolescence
- Outbuilding Features
- Property Amenities
- Project Factors
- Apparent Defects/Damages/Deficiencies
- Subject Listing Information
- Prior Sale/Transfer History

---

## Part 4: What We Got Right

| Area | Assessment |
|---|---|
| `CanonicalAddress` basic fields | ✅ Correct |
| Quality Q1-Q6 / Condition C1-C6 scales | ✅ Correct (but need per-feature granularity) |
| `HighestAndBestUse` 4-test framework | ✅ Good match to Page 20 |
| `CanonicalCostApproach` basic structure | ✅ Directionally correct (needs expansion) |
| `CanonicalIncomeApproach` GRM | ✅ Correct approach |
| `CanonicalReconciliation` core fields | ✅ Core values present |
| `CanonicalAppraiserInfo` basic fields | ✅ Core present (needs credential expansion) |
| Form type system (1004/1073/1025/2055/1075) | ✅ Correct |
| Visibility predicate pattern | ✅ Sound architecture |
| `FormSectionConfig` / `FormFieldConfig` types | ✅ Good pattern (needs array-field extension) |
| `CanonicalCondoDetail` / `CanonicalPudDetail` | ✅ Partial match — good start |
| Adjustment grid line items | ✅ Most rows present |
| Cost approach depreciation breakdown | ✅ Good start (needs per-structure) |
| Income approach (GRM + direct cap + DCF) | ✅ Comprehensive |
| Photo assets / addenda | ✅ Present and functional |

---

## Part 5: Recommended Phasing

Given the scale of the gap (~14 missing sections, ~100+ missing fields, several breaking changes), we recommend the following phased approach:

### Phase 6A: Foundation — Schema Expansion (Breaking Changes)
**Priority: CRITICAL — unblocks everything else**
1. Split `bathrooms` → `bathsFull` + `bathsHalf` (on `CanonicalPropertyCore`)
2. Add `assignmentReason` enum, deprecate `isSubjectPurchase`
3. Add `constructionMethod`, `attachmentType`, `structureDesign` to Subject
4. Add `grossBuildingFinishedArea`, `finishedAreaAboveGrade` (v1.3 area model)
5. Add `bathsFull`/`bathsHalf` to comp grid fields
6. Extend `FormFieldConfig` with array/table field type

### Phase 6B: New Core Sections
**Priority: HIGH — required for URAR completeness**
1. Vehicle Storage section (replace garage fields)
2. Subject Property Amenities section
3. Outbuilding section
4. Apparent Defects/Damages/Deficiencies section
5. Subject Listing Information section
6. Prior Sale & Transfer History section

### Phase 6C: Expanded Existing Sections
**Priority: HIGH**
1. Site section expansion (parcels, access, influences, water frontage, features)
2. Dwelling Exterior / Unit Interior split (from single improvements)
3. Sales Contract expansion (arm's length, concessions detail)
4. Market section restructuring
5. Overall Quality & Condition (per-feature model)
6. Project Information unification (PUD/Condo/Coop/Condop)

### Phase 6D: Specialized Sections
**Priority: MEDIUM**
1. Energy Efficient & Green Features
2. Disaster Mitigation
3. Manufactured Home detail
4. Functional Obsolescence
5. Rental Information (full schedule)
6. Revision History / Reconsideration of Value

### Phase 6E: Comp Grid Expansion
**Priority: MEDIUM — large effort**
1. Expand `CanonicalComp` with all new v1.3 fields
2. Update sales comparison grid UI component
3. Add per-feature Q/C to comp grid
4. Add amenities/vehicle storage/outbuilding to comp grid
5. Additional Properties Analyzed Not Used table

### Phase 6F: Backend Alignment
**Priority: HIGH — parallel with frontend**
1. Update `uad-3.6.ts` types to match v1.3
2. Update `canonical-to-uad.mapper.ts` for new fields
3. Update `mismo-xml-generator.service.ts` for MISMO 3.4 v1.3 elements
4. Update `uad-validation.service.ts` with new validation rules
5. Update UCDP/EAD submission for new fields

---

## Appendix A: URAR v1.3 Page Map

| Page | Section | Our Coverage |
|---|---|---|
| 1-2 | Title + Revision History | N/A (metadata) |
| 3 | Summary | ~40% |
| 4 | Apparent Defects | ❌ 0% |
| 5 | Assignment Information | ~50% |
| 6 | Subject Property | ~40% |
| 7-8 | Site | ~30% |
| 9 | Disaster Mitigation | ❌ 0% |
| 10 | Energy Efficient Features | ❌ 0% |
| 11 | Sketch | ~50% (photo asset) |
| 12 | Dwelling Exterior | ~50% (in improvements) |
| 13 | Manufactured Home | ❌ 0% |
| 14 | Unit Interior | ~40% (in improvements) |
| 15 | Functional Obsolescence | ❌ 0% |
| 16 | Outbuilding | ❌ 0% |
| 17 | Vehicle Storage | ~20% (garage fields) |
| 18 | Subject Property Amenities | ~10% (pool/porch) |
| 19 | Overall Quality & Condition | ~20% (single Q/C) |
| 20 | Highest & Best Use | ✅ ~90% |
| 21 | Market | ~40% (neighborhood) |
| 22 | Project Information | ~35% (condo/PUD/HOA) |
| 23 | Subject Listing Info | ❌ 0% |
| 24 | Sales Contract | ~50% (contract section) |
| 25 | Prior Sale & Transfer | ~20% (metadata fields) |
| 26-29 | Sales Comparison | ~25% |
| 30-31 | Sales Comp Map + Exhibits | ~50% (photos) |
| 32-34 | Rental Information | ~15% (income approach) |
| 35 | Income Approach | ~70% |
| 36 | Cost Approach | ~50% |
| 37 | Reconciliation | ~60% |
| 38 | Revision / Reconsideration | ❌ 0% |
| 39 | Supplemental Information | ~50% (addenda) |
| 40-43 | Scope / Certifications | ~60% |

**Weighted Overall Coverage: ~35%**

---

## Appendix B: Field ID Cross-Reference (Selected)

From `URAR-with-Field-IDs-v1.3.txt`, key FID ranges:

| FID Range | Section |
|---|---|
| 1.000–1.085 | Summary (Page 3) |
| 2.000–2.0XX | Apparent Defects (Page 4) |
| 3.000–3.0XX | Assignment Information (Page 5) |
| 4.000–4.0XX | Subject Property (Page 6) |
| 5.000–5.0XX | Site (Pages 7-8) |
| 6.000–6.0XX | Disaster Mitigation (Page 9) |
| 7.000–7.0XX | Energy Efficient (Page 10) |
| 8.000–8.0XX | Sketch (Page 11) |
| 9.000–9.0XX | Dwelling Exterior (Page 12) |
| 10.000–10.0XX | Manufactured Home (Page 13) |
| 11.000–11.0XX | Unit Interior (Page 14) |
| 12.000–12.0XX | Functional Obsolescence (Page 15) |
| 13.000–13.0XX | Outbuilding (Page 16) |
| 14.000–14.0XX | Vehicle Storage (Page 17) |
| 15.000–15.0XX | Amenities (Page 18) |
| 16.000–16.0XX | Overall Q&C (Page 19) |
| 17.000–17.0XX | Highest & Best Use (Page 20) |
| 18.000–18.0XX | Market (Page 21) |
| 19.000–19.0XX | Project Information (Page 22) |
| 20.000–20.0XX | Subject Listing (Page 23) |
| 21.000–21.0XX | Sales Contract (Page 24) |
| 22.000–22.0XX | Prior Sale History (Page 25) |
| 23.000–23.0XX | Sales Comparison (Pages 26-29) |
| 24.000–24.0XX | Rental Information (Pages 32-34) |
| 25.000–25.0XX | Income Approach (Page 35) |
| 26.000–26.0XX | Cost Approach (Page 36) |
| 27.000–27.0XX | Reconciliation (Page 37) |
| 28.000–28.0XX | Revision History (Page 38) |

*Full FID-to-field mapping requires cleaner extraction of the with-Field-IDs document (FIDs are positional overlays on form images, challenging to parse from text extraction).*

---

## Appendix C: Completion Report (Appendix B-3) — Gap Analysis

**Source:** UAD Specification, Appendix B-3: Completion Report Implementation Guide, Document Version 1.4, March 10, 2026  
**Extracted text:** `docs/samples/Appendix B-3 Completion Report Implementation Guide.txt`  
**Added:** 2026-03-15

### C.0 Overview

The **Completion Report** is a **distinct UAD 3.6 report type** — separate from the URAR. It is submitted to UCDP to certify that conditions from an original "subject to" appraisal have been satisfied (e.g., subject to repair, subject to completion per plans, subject to inspection).

**Current implementation status: 0% — the Completion Report does not exist anywhere in our codebase.**

Specific absences:
- No `CompletionReport` report type in our report type enum or `CanonicalReportDocument`
- No `CanonicalCompletionReport` data type or schema
- No defect/repair item schema (`DefectItem`, `DefectItemLocationType`, etc.)
- No completion status fields (`PropertyImprovementsCompletedIndicator`, `SubjectToCompletionFeature*`)
- No original appraisal reference fields (`OriginalAppraisalEffectiveDate`, `OriginalAppraisedValueAmount`, etc.)
- No `AppraisalCompletionCommentText`
- No `CompletionReportNewDefectIndicator` discriminator
- No dynamic Final Value Condition Statement text generation
- No `mismo-xml-generator` path for Completion Report XML
- No completion-specific image categories (`CompletedConstruction`, `ManufacturedHomeHUDDataPlate`, `ValuationCompletionExhibit`, etc.)
- No INSPECTION→ROLE or SIGNATORY→ROLE arcrole relationships specific to completion reports

The 9 sections of the Completion Report are described below with full data model requirements and our current coverage.

---

### C.1 Header and Footer (FID: HF.001–HF.008)

Every page. Always displays.

| FID | Field Label | UID | MISMO Data Point | Display Rule |
|---|---|---|---|---|
| HF.001 | Document Type | 2800.0036 | DocumentType | Always = "Completion Report" |
| HF.002 | Completion Version # | 2100.0030 | AboutVersionIdentifier | Always |
| HF.003 | Fannie Mae \| Freddie Mac | 2100.0052 | DocumentFormIssuingEntityNameType | Always |
| HF.004 | September 2024 | 2100.0053 | DocumentFormIssuingEntityVersionIdentifier | Always |
| HF.005 | Appraiser Reference ID | 2100.0029 | AppraiserFileIdentifier | Always |
| HF.006 | Agency Case File ID | 2100.0023 | AdditionalValuationIdentifier | When type = "GovernmentAgency" |
| HF.007 | Client Reference ID | 2100.0021 | AdditionalValuationIdentifier | When type = "Client" |
| HF.008 | AMC Reference ID | 2100.0025 | AdditionalValuationIdentifier | When type = "ManagementCompany" |

**Note:** Footer allows optional vendor branding text provided it does not overlap predefined fields.

**Our coverage: 0%** — none of these header/footer fields exist on a Completion Report document type.

---

### C.2 Section 01 — Subject Property (FID: 01.001–01.003.2) — Always displays

| FID | Field Label | UID | MISMO Data Point | Display Rule |
|---|---|---|---|---|
| 01.001 | Physical Address | 2800.0024 | AddressLineText | Always |
| 01.001 | Unit Identifier | 2800.0025 | AddressUnitIdentifier | When provided (requires AddressUnitDesignatorType = "Unit") |
| 01.001 | City | 2800.0026 | CityName | Always |
| 01.001 | Postal Code | 2800.0028 | PostalCode | Always |
| 01.001 | State | 2800.0029 | StateCode | Always |
| 01.002 | County | 2800.0027 | CountyName | Always; multi-county note goes to Commentary |
| — | Subject Photo | 1400.0842 | ImageCategoryType = "PropertyPhoto" | Always; does NOT redisplay in Exhibits |
| 01.003 | Legal Description (text) | 2800.0049 | ParcelsLegalDescription | When text provided |
| 01.003 | Legal Description (image) | 1400.0543 | ImageCategoryType = "LegalDescription" | When image provided |
| 01.003.2 | Legal Description caption | 1400.0545 | ImageCaptionCommentDescription | When image provided; displays above image in bold |

**Required data model addition:**
```typescript
interface CanonicalCompletionReportSubject {
  physicalAddress: CanonicalAddress;
  county: string;
  legalDescriptionText?: string;          // UID: 2800.0049
  legalDescriptionImageUrl?: string;      // ImageCategoryType = "LegalDescription"
  legalDescriptionCaption?: string;       // UID: 1400.0545
  subjectPhotoUrl?: string;               // ImageCategoryType = "PropertyPhoto"
}
```

---

### C.3 Section 02 — Original Appraisal (FID: 02.001–02.007) — Always displays

| FID | Field Label | UID | MISMO Data Point | Display Rule |
|---|---|---|---|---|
| 02.001 | Effective Date of Appraisal | 2800.0032 | OriginalAppraisalEffectiveDate | Always |
| 02.002 | Opinion of Market Value | 2800.0033 | OriginalAppraisedValueAmount | Always |
| 02.003 | Market Value Condition | 2800.0002 | PropertyValuationConditionalConclusionType | Always; multiple values stack |
| 02.004 | Appraiser | 2800.0034 | OriginalAppraiserUnparsedName | Always |
| 02.005 | Reference ID | 2800.0035 | OriginalAppraiserFileIdentifier | Always |
| 02.006 | Original Lender | 2800.0046 | OriginalLenderUnparsedName | Always |
| 02.007 | Final Value Condition Statement | — | Derived text | When PropertyValuationConditionalConclusionType ≠ "AsIs" |

**Final Value Condition Statement — dynamic text generation rules:**

The statement is auto-composed from `PropertyValuationConditionalConclusionType` value(s):
- Always begins: `"This appraisal is made"`
- Per value, append corresponding phrase:
  - `SubjectToCompletionPerPlans` → `"subject to completion per plans and specifications on the basis of a hypothetical condition that the improvements have been completed"`
  - `SubjectToInspection` → `"subject to the itemized list of required inspections below based on the extraordinary assumption that the condition or deficiency does not require alteration or repair"`
  - `SubjectToRepair` → `"subject to the itemized list of repairs recommended below on the basis of a hypothetical condition that the repairs or alterations have been completed in a professional manner"`
- Multiple values joined by `", and"`
- Always ends with: `". This might have affected the assignment results."`
- When `AsIs`: statement does not display

**`PropertyValuationConditionalConclusionType` valid values:** `AsIs`, `SubjectToCompletionPerPlans`, `SubjectToInspection`, `SubjectToRepair`  
*(Note: Two enumerations removed in 2024-021 per revision history)*

**Required data model addition:**
```typescript
interface CanonicalCompletionReportOriginalAppraisal {
  effectiveDate: string;                                    // UID: 2800.0032
  appraisedValue: number;                                   // UID: 2800.0033
  marketValueConditions: PropertyValuationConditionalConclusionType[]; // UID: 2800.0002
  appraiserName: string;                                    // UID: 2800.0034
  appraiserReferenceId: string;                             // UID: 2800.0035
  originalLenderName: string;                               // UID: 2800.0046
  // finalValueConditionStatement is derived — do not store, generate at render time
}

type PropertyValuationConditionalConclusionType =
  | 'AsIs'
  | 'SubjectToCompletionPerPlans'
  | 'SubjectToInspection'
  | 'SubjectToRepair';
```

---

### C.4 Section 03 — Itemized List of Repairs (FID: 03.001–03.007)

Displays when `PropertyValuationConditionalConclusionType` = `SubjectToRepair`.  
Each row represents one **original appraisal repair item** (`CompletionReportNewDefectIndicator` = `false`).

| FID | Field Label | UID | MISMO Data Point | Display Rule |
|---|---|---|---|---|
| 03.001 | Feature | 3900.0117 | DefectComponentLabelType | Per row; repeat row when same feature has multiple items |
| 03.002 | Location | 3900.0010 | DefectItemLocationType | Per row; non-kitchen/bath → "Other" + OtherDescription (3900.0162) |
| 03.003 | Description | 3900.0011 | DefectItemDescription | Per row |
| 03.004 | Affects Soundness or Structural Integrity | 3900.0012 | DefectItemAffectsSoundnessStructuralIntegrityIndicator | Per row |
| 03.005 | Repair Completed | 3900.0016 | DefectItemRecommendedActionCompletedIndicator | Per row |
| 03.006 | Inspection Date | 3900.0017 | DefectItemRecommendedActionInspectionDate | Per row |
| 03.007 | Completion Comment | 3900.0018 | DefectItemRecommendedActionCompletionDescription | When completed = false OR when exists |

Images for each repair item **must** be provided and display in Completion Report Exhibits (Section 07).

**Required data model addition:**
```typescript
interface CompletionReportRepairItem {
  isNewlyObserved: boolean;              // CompletionReportNewDefectIndicator; false = original repair
  feature: string;                       // DefectComponentLabelType
  locationType: string;                  // DefectItemLocationType
  locationOtherDescription?: string;     // DefectItemLocationTypeOtherDescription
  description: string;                   // DefectItemDescription
  affectsSoundnessOrStructuralIntegrity: boolean;
  repairCompleted?: boolean;             // DefectItemRecommendedActionCompletedIndicator
  inspectionDate?: string;               // DefectItemRecommendedActionInspectionDate
  completionComment?: string;            // DefectItemRecommendedActionCompletionDescription
  photoUrls: string[];                   // Required images
}
```

---

### C.5 Section 04 — New Observed Items for Repair (FID: 04.001–04.006)

Displays when new items are observed during the completion inspection (`CompletionReportNewDefectIndicator` = `true`).  
Uses the same `CompletionReportRepairItem` model (above) with `isNewlyObserved: true`.

| FID | Field Label | UID | MISMO Data Point |
|---|---|---|---|
| 04.001 | Feature | 2800.0052 | DefectComponentLabelType |
| 04.002 | Location | 2800.0056 | DefectItemLocationType (+ OtherDescription: 2800.0057) |
| 04.003 | Description | 2800.0055 | DefectItemDescription |
| 04.004 | Affects Soundness or Structural Integrity | 2800.0054 | DefectItemAffectsSoundnessStructuralIntegrityIndicator |
| 04.005 | Recommended Action | 3900.0013 | DefectItemRecommendedActionType |
| 04.006 | Inspection Date | 2800.0058 | DefectItemRecommendedActionInspectionDate |

**Note:** New items use different UIDs from original repair items (2800.xxxx vs 3900.xxxx for the same logical fields).

---

### C.6 Section 05 — Completion Status (FID: 05.001–05.006)

Displays when `PropertyValuationConditionalConclusionType` = `SubjectToCompletionPerPlans`.

| FID | Field Label | UID | MISMO Data Point | Display Rule |
|---|---|---|---|---|
| 05.001 | Is construction complete? | 2800.0010 | PropertyImprovementsCompletedIndicator | Always in this section; images required in Exhibits |
| 05.002 | Completed consistent with original plans? | 2800.0011 | PropertyImprovementsCompletedPerPlansIndicator | When 05.001 = true |
| 05.003 | Feature | 2800.0003 | SubjectToCompletionFeatureDescription | When 05.002 = false; images required in Exhibits |
| 05.004 | Location | 2800.0004 | SubjectToCompletionFeatureLocationDescription | When 05.002 = false |
| 05.005 | Comparison to Original Plans/Specs | 2800.0005 | SubjectToCompletionFeatureComparisonType | When 05.002 = false |
| 05.006 | Comment | 2800.0006 | SubjectToCompletionFeatureIncompleteOrInconsistentDescription | When 05.002 = false |

**Three display scenarios:**
1. Construction complete + per plans → checklist only
2. Construction not complete → commentary required
3. Construction complete but not per plans → per-feature table of each discrepancy

**Required data model addition:**
```typescript
interface CompletionStatus {
  constructionComplete: boolean;                      // PropertyImprovementsCompletedIndicator
  completedPerPlans?: boolean;                        // PropertyImprovementsCompletedPerPlansIndicator
  completedConstructionPhotoUrls: string[];           // ImageCategoryType = "CompletedConstruction"
  inconsistentFeatures?: CompletionInconsistentFeature[];
}

interface CompletionInconsistentFeature {
  feature: string;                                    // SubjectToCompletionFeatureDescription
  location: string;                                   // SubjectToCompletionFeatureLocationDescription
  comparisonToPlans: string;                          // SubjectToCompletionFeatureComparisonType
  comment: string;                                    // SubjectToCompletionFeatureIncompleteOrInconsistentDescription
  photoUrls: string[];                                // Per-feature images in Exhibits
}
```

---

### C.7 Section 06 — Completion Report Commentary (FID: 06.001)

Displays when comments are provided.

| FID | Field Label | UID | MISMO Data Point |
|---|---|---|---|
| 06.001 | Commentary | 2800.0007 | AppraisalCompletionCommentText |

XML container: `<VALUATION_COMPLETION_DETAIL><AppraisalCompletionCommentText>...</AppraisalCompletionCommentText></VALUATION_COMPLETION_DETAIL>`

---

### C.8 Section 07 — Completion Report Exhibits (No FID on report)

Displays when images are provided. Image types and their delivery mechanisms:

| Exhibit Category | ImageCategoryType UID | Value | Caption FID | Caption UID | Bold Prefix on Report |
|---|---|---|---|---|---|
| Itemized List of Repairs | 3900.0015 (via DEFECT container, `NewDefect=false`) | — | 03.001.2 | 1400.0878 | "Itemized List of Repairs - {Feature}" |
| New Observed Items | 3900.0015 (via DEFECT container, `NewDefect=true`) | — | 04.001.2 | 4000.1001 | "New Observed Items for Repair - {Feature}" |
| Completed Construction | 1400.0849 | "CompletedConstruction" | 05.001.2 | 1400.0851 | "Completed Construction" |
| Inconsistent with Plans | (via SUBJECT_TO_COMPLETION_ITEM container) | — | 05.003.2 | 1400.0943 | "Inconsistent Item - {Feature}" |
| Subject Property Photo | 1400.0842 | "PropertyPhoto" | — | — | (in Section 01 only) |
| Dwelling Front | 1400.0944 | "DwellingFront" | 07.001.2 | 1400.0943 | "Dwelling Front -" |
| Dwelling Rear | 1400.0944 | "DwellingRear" | 07.001.2 | 1400.0943 | "Dwelling Rear -" |
| HUD Data Plate | 1400.0944 | "ManufacturedHomeHUDDataPlate" | 07.001.2 | 1400.0943 | "HUD Data Plate -" |
| HUD Certification Label | 1400.0944 | "ManufacturedHomeHUDCertificationLabel" | 07.001.2 | 1400.0943 | "HUD Certification Label -" |
| Manufactured Home Certification | 1400.0944 | "ManufacturedHomeFinancingProgramEligibilityCertification" | 07.001.2 | 1400.0943 | "Manufactured Home Certification -" |
| Other Valuation Completion | 1400.0944 | "ValuationCompletionExhibit" | 07.001.2 | 1400.0943 | (caption only) |

**Key rule:** All captions display **above** the image in bold font.

**None of these `ImageCategoryType` values exist in our current `ReportPhotoAsset` or photo upload system.**

---

### C.9 Section 08 — Assignment Information (FID: 08.001–08.043) — Always displays

This section is structurally similar to URAR Section 08 but uses **different UIDs** for completion-report-specific instances.

#### C.9.1 General Information

| FID | Field Label | UID | MISMO Data Point | Display Rule |
|---|---|---|---|---|
| 08.001 | Borrower Name | 1000.0147-.0151 | FirstName/MiddleName/LastName/SuffixName or FullName | When provided; individual or legal entity |
| 08.002 | Appraiser Fee | 1000.0166-0167 | FeeType="AppraisalFee" + ProvidedServiceActualCostAmount | When provided |
| 08.003 | AMC Fee | 1000.0156-0157 | FeeType="AppraisalManagementCompanyFee" + Amount | When provided |
| 08.004 | Government Agency | 1000.0122-0123 | GovernmentAgencyAppraisalIndicator + Type | When GovernmentAgencyAppraisalIndicator = true |
| 08.005 | Investor Requested Special ID | 1000.0126 | InvestorRequestedIdentificationCode | When provided |

#### C.9.2 Contact Information — Clients (FID: 08.006–08.012)

Multi-role PARTY container. Subheading shows combined roles (e.g., "Client/Lender", "Client/Appraisal Management Company").

| FID | Field | UID | Notes |
|---|---|---|---|
| 08.006 | Primary role | 2400.0367 | PartyRoleType = "Client" |
| 08.007 | Secondary role | 2400.0365 | "Lender", "ManagementCompany", "Attorney", "Investor", "Other" |
| 08.008 | Company Name | 2400.0357 | FullName |
| 08.009 | Company Address | 2400.0358-.0361 | AddressLineText, City, State, PostalCode |
| 08.010 | Credentials — ID | 2400.0363 | LicenseIdentifier (ManagementCompany only) |
| 08.011 | Credentials — State | 2400.0364 | LicenseIssuingAuthorityStateCode (ManagementCompany only) |
| 08.012 | Credentials — Expires | 2400.0362 | LicenseExpirationDate (ManagementCompany only) |

Non-client Lender/AMC uses different UIDs (2400.0368–0372, 0403–0404, 0402).

#### C.9.3 Appraiser (FID: 08.013–08.027)

| FID | Field | UID | Notes |
|---|---|---|---|
| 08.013 | Name | 2200.0126-.0129 | First/Middle/Last/Suffix |
| 08.014 | Designation | 2400.0475 | AppraiserDesignationType |
| 08.015 | Company Name | 2400.0471 | AppraiserCompanyName |
| 08.016 | Company Address | 2400.0466-.0469 | Address/City/State/PostalCode |
| 08.017 | Scope: Exterior Inspection | 2400.0293 | PropertyExteriorInspectionMethodType |
| 08.018 | Scope: Interior Inspection | 2400.0294 | PropertyInteriorInspectionMethodType |
| 08.019 | Inspection Date | 2400.0292 | InspectionDate |
| 08.020 | License Level | 2200.0131 | AppraiserLicenseType |
| 08.021 | License ID | 2200.0134 | LicenseIdentifier |
| 08.022 | License State | 2200.0135 | LicenseIssuingAuthorityStateCode |
| 08.023 | License Expires | 2200.0133 | LicenseExpirationDate |
| 08.024 | ASC Identifier | 2400.0470 | AppraisalSubCommitteeAppraiserIdentifier |
| 08.025/26 | VA/FHA Appraiser ID | 2400.0473-0474 | AgencyAppraiserIdentifier + Type |
| 08.027 | Employment Type | 2400.0472 | AppaiserEmploymentType (VA only) |

#### C.9.4 Supervisory Appraiser (FID: 08.028–08.042)

Same structure as Appraiser but with `PartyRoleType = "AppraiserSupervisor"` and different UIDs (2200.0137–0151, 2400.0477–0512).  
Displays only when a supervisory appraiser is present.

Updated in v1.4 (2026-009): clarified display rules for Supervisory Appraiser ID (UID: 2200.0145, FID: 08.036), State (UID: 2200.0146, FID: 08.037), Expires (UID: 2200.0144, FID: 08.038).

#### C.9.5 Scope of Work Commentary (FID: 08.043)

`ValuationCommentText` (UID: 1000.0131) with `ValuationAnalysisCategoryType` (UID: 1000.0130) = `"Assignment"`. Displays when provided.

---

### C.10 Section 09 — Certifications and Intended Use/User (FID: 09.001–09.036) — Always displays

#### C.10.1 Intended Use

| FID | Text | Display Rule |
|---|---|---|
| 09.001 | "The intended use of this certification of completion is for the lender/client to confirm that the requirements or conditions stated in the appraisal report referenced above have been met." | Always |
| 09.002 | Sub-header: "Additional Intended Use" | When `ValuationIntendedUseDescription` provided AND GovernmentAgencyAppraisalType = "FHA" |
| 09.003 | `ValuationIntendedUseDescription` (UID: 2200.0012) | When provided and FHA |

#### C.10.2 Intended User

| FID | Text | Display Rule |
|---|---|---|
| 09.004 | "The intended user of this report is the lender/client." | Always |
| 09.005 | FHA/USDA/VA specific user text (3 variants) | When GovernmentAgencyAppraisalType matches |
| 09.006 | Sub-header: "Additional Intended Users" | When `ValuationAdditionalIntendedUserIndicator` (UID: 2200.0055) = true |
| 09.007 | `ValuationAdditionalIntendedUserDescription` (UID: 2200.0011) | When above = true |

#### C.10.3 Appraiser Certifications (FID: 09.008–09.018) — Always display

Seven standard certifications (no conflicts of interest, unbiased, legal compliance, no fair housing violations, personal analysis, personal inspection statement, e-signature agreement).

**Cert 6 has two variants** based on `PersonalInspectionPerformedIndicator` (UID: 2200.0027):
- `true` → "I certify that I did perform a personal onsite inspection of the subject property..."
- `false` → "I certify that I did not perform a personal onsite inspection..." + requires `AppraisalConditionsSatisfiedVerificationDescription` (UID: 2200.0026, FID: 09.015)

Additional certifications via `AppraiserAdditionalCertificationIndicator` (UID: 2200.0052).

#### C.10.4 Supervisory Appraiser Certifications (FID: 09.019–09.024)

Six certifications displaying when `PartyRoleType = "AppraiserSupervisor"` present.  
Cert 4 unique to completion report: "I accept full responsibility for this certification of completion."

#### C.10.5 Signature (FID: 09.025–09.032)

Signature block for each signing party (`Appraiser` and/or `AppraiserSupervisor`).

| FID | Field | UID |
|---|---|---|
| 09.025 | [Role] | 2200.0136 / 2200.0147 (PartyRoleType) |
| 09.027 | Date of Signature and Report | 2200.0002 (ExecutionDate) |
| 09.028 | Contact name | 2400.0041-.0044 (First/Middle/Last/Suffix) |
| 09.029 | Level | 2400.0051 (AppraiserLicenseType) |
| 09.030 | ID | 2400.0054 (LicenseIdentifier) |
| 09.031 | State | 2400.0055 (LicenseIssuingAuthorityStateCode) |
| 09.032 | Expires | 2400.0053 (LicenseExpirationDate) |

---

### C.11 Arcrole Relationships (MISMO XML)

Two arcrole relationship types are required in the Completion Report XML — currently absent from our `mismo-xml-generator.service.ts`:

**INSPECTION → ROLE** (`urn:fdc:mismo.org:2009:residential/INSPECTION_CompletedBy_ROLE`)

Links each INSPECTION container to the PARTY/ROLE that performed it.

| Party | UID (from) | UID (to) |
|---|---|---|
| Appraiser | 2400.0278 (@xlink:from = INSPECTION_n) | 2400.0279 (@xlink:to = ROLE_n) / ROLE label: 2200.0130 |
| Supervisory Appraiser | 2400.0499 (@xlink:from = INSPECTION_n) | 2400.0500 (@xlink:to = ROLE_n) / ROLE label: 2200.0141 |

**SIGNATORY → ROLE** (`urn:fdc:mismo.org:2009:residential/SIGNATORY_IsAssociatedWith_ROLE`)

Links each SIGNATORY container to the PARTY/ROLE that signed. One RELATIONSHIP per signing party.

| Party | UID (from) | UID (to) |
|---|---|---|
| Appraiser | 2200.0049 (@xlink:from = SIGNATORY_n) | 2200.0050 (@xlink:to = ROLE_n) / SIGNATORY label: 2200.0071, ROLE label: 2200.0130 |
| Supervisory Appraiser | 2200.0149 (@xlink:from = SIGNATORY_n) | 2200.0150 (@xlink:to = ROLE_n) / SIGNATORY label: 2200.0151, ROLE label: 2200.0141 |

---

### C.12 Completion Report — Required Data Model (Full)

```typescript
/** Top-level Completion Report document */
interface CanonicalCompletionReport {
  reportType: 'CompletionReport';
  
  // Header/Footer reference IDs
  appraiserFileIdentifier: string;                    // HF.005
  agencyCaseFileId?: string;                          // HF.006
  clientReferenceId?: string;                         // HF.007
  amcReferenceId?: string;                            // HF.008

  // Section 01
  subjectProperty: CompletionReportSubject;

  // Section 02
  originalAppraisal: CompletionReportOriginalAppraisal;

  // Section 03 — original repair items (CompletionReportNewDefectIndicator = false)
  repairItems: CompletionReportRepairItem[];

  // Section 04 — newly observed items (CompletionReportNewDefectIndicator = true)
  newlyObservedItems: CompletionReportRepairItem[];

  // Section 05 — conditional on SubjectToCompletionPerPlans
  completionStatus?: CompletionStatus;

  // Section 06
  completionCommentary?: string;                      // UID: 2800.0007

  // Section 07 — images are attached to their respective items; additional exhibits here
  additionalExhibits: CompletionReportExhibit[];

  // Section 08
  assignmentInformation: CompletionReportAssignment;

  // Section 09
  certifications: CompletionReportCertifications;
}

interface CompletionReportSubject {
  physicalAddress: CanonicalAddress;
  county: string;
  legalDescriptionText?: string;                      // UID: 2800.0049
  legalDescriptionImageUrl?: string;
  legalDescriptionCaption?: string;                   // UID: 1400.0545
  subjectPhotoUrl?: string;
}

interface CompletionReportOriginalAppraisal {
  effectiveDate: string;                              // UID: 2800.0032
  appraisedValue: number;                             // UID: 2800.0033
  marketValueConditions: PropertyValuationConditionalConclusionType[]; // UID: 2800.0002
  appraiserName: string;                              // UID: 2800.0034
  appraiserReferenceId: string;                       // UID: 2800.0035
  originalLenderName: string;                         // UID: 2800.0046
}

type PropertyValuationConditionalConclusionType =
  | 'AsIs'
  | 'SubjectToCompletionPerPlans'
  | 'SubjectToInspection'
  | 'SubjectToRepair';

interface CompletionReportRepairItem {
  isNewlyObserved: boolean;                           // CompletionReportNewDefectIndicator
  feature: string;                                    // DefectComponentLabelType
  locationType: string;                               // DefectItemLocationType
  locationOtherDescription?: string;
  description: string;                                // DefectItemDescription
  affectsSoundnessOrStructuralIntegrity: boolean;
  recommendedActionType?: string;                     // Section 04 only: DefectItemRecommendedActionType
  repairCompleted?: boolean;                          // Section 03 only
  inspectionDate?: string;
  completionComment?: string;                         // Section 03 when repairCompleted = false
  photoUrls: string[];                                // Required
}

interface CompletionStatus {
  constructionComplete: boolean;                      // UID: 2800.0010
  completedPerPlans?: boolean;                        // UID: 2800.0011
  completedConstructionPhotoUrls: string[];
  inconsistentFeatures: CompletionInconsistentFeature[];
}

interface CompletionInconsistentFeature {
  feature: string;                                    // UID: 2800.0003
  location: string;                                   // UID: 2800.0004
  comparisonToPlans: string;                          // UID: 2800.0005
  comment: string;                                    // UID: 2800.0006
  photoUrls: string[];
}

interface CompletionReportExhibit {
  imageUrl: string;
  imageCategoryType: CompletionReportImageCategory;
  caption?: string;
}

type CompletionReportImageCategory =
  | 'PropertyPhoto'
  | 'LegalDescription'
  | 'CompletedConstruction'
  | 'DwellingFront'
  | 'DwellingRear'
  | 'ManufacturedHomeHUDDataPlate'
  | 'ManufacturedHomeHUDCertificationLabel'
  | 'ManufacturedHomeFinancingProgramEligibilityCertification'
  | 'ValuationCompletionExhibit';
```

---

### C.13 Implementation Impact on Existing Files

| File | Required Change | Effort |
|---|---|---|
| `src/types/canonical-schema.ts` | Add `CanonicalCompletionReport` + all sub-interfaces above; add `PropertyValuationConditionalConclusionType` type | **HIGH** |
| `src/types/uad-3.6.ts` | Add Completion Report section types; validate UID mappings | **MEDIUM** |
| `src/services/mismo-xml-generator.service.ts` | New document entry point for Completion Report XML (separate from URAR path); add arcrole RELATIONSHIP containers (INSPECTION→ROLE, SIGNATORY→ROLE) | **HIGH** |
| `src/mappers/canonical-to-uad.mapper.ts` | New mapper function `mapCanonicalToCompletionReport()` | **HIGH** |
| `src/services/final-report.service.ts` | New `generateCompletionReportXml()` method; route by report type | **MEDIUM** |
| `src/services/uad-validation.service.ts` | New validation rules: SubjectToRepair → repairItems required; SubjectToCompletionPerPlans → completionStatus required; Cert 6 conditional; etc. | **MEDIUM** |
| Frontend: `src/types/canonical-schema.ts` | Sync with backend (same types) | **LOW** |
| Frontend: form config | New `CompletionReportFormConfig` with conditional section visibility | **HIGH** |
| Frontend: new sections | CompletionReportSection.tsx, RepairItemsSection.tsx, CompletionStatusSection.tsx, CertificationsSection.tsx | **HIGH** |

### C.14 Section Visibility Matrix

| Section | Display Condition |
|---|---|
| 01 Subject Property | Always |
| 02 Original Appraisal | Always |
| 03 Itemized List of Repairs | Only when `marketValueConditions` includes `SubjectToRepair` |
| 04 New Observed Items | Only when `newlyObservedItems.length > 0` |
| 05 Completion Status | Only when `marketValueConditions` includes `SubjectToCompletionPerPlans` |
| 06 Commentary | Only when `completionCommentary` provided |
| 07 Exhibits | Only when any images provided |
| 08 Assignment Information | Always |
| 09 Certifications | Always |

### C.15 Final Value Condition Statement — Text Generation Function

```typescript
function generateFinalValueConditionStatement(
  conditions: PropertyValuationConditionalConclusionType[]
): string | null {
  const phraseMap: Record<string, string> = {
    SubjectToCompletionPerPlans:
      'subject to completion per plans and specifications on the basis of a hypothetical condition that the improvements have been completed',
    SubjectToInspection:
      'subject to the itemized list of required inspections below based on the extraordinary assumption that the condition or deficiency does not require alteration or repair',
    SubjectToRepair:
      'subject to the itemized list of repairs recommended below on the basis of a hypothetical condition that the repairs or alterations have been completed in a professional manner',
  };

  const applicable = conditions.filter((c) => c !== 'AsIs' && phraseMap[c]);
  if (applicable.length === 0) return null;

  const phrases = applicable.map((c) => phraseMap[c]).join(', and ');
  return `This appraisal is made ${phrases}. This might have affected the assignment results.`;
}
```

---

### C.16 Coverage Summary

> **Last updated:** implementation sprint — Tasks 1–10 complete (types → mapper → XML generator → routing → tests → frontend)

| Completion Report Section | Coverage | Notes |
|---|---|---|
| HF — Header/Footer | ✅ ~90% | `CrHeaderFooterIds` typed; all FIDs mapped through `_buildLoans()` in XML generator. Remaining 10%: form version/issuer fields auto-populated. |
| 01 — Subject Property | ✅ 100% | `CrSubjectProperty` + `CrAddress` typed; `_buildCollateral()` emits address, legal description text/image, subject photo. `CrSubjectPropertySection.tsx` data-entry form complete. |
| 02 — Original Appraisal | ✅ 100% | `CrOriginalAppraisal` typed; `_buildOriginalAppraisalSection()` emits all UIDs (2800.0032–0046). `CrOriginalAppraisalSection.tsx` data-entry form complete. |
| 03 — Itemized List of Repairs | ✅ 100% | `CrRepairItem` (`isNewlyObserved: false`); `_buildDefect()` emits all Sec-03 UIDs (3900.0117, 0010–0018). `CrRepairItemsSection.tsx` covers both Sec 03+04. |
| 04 — New Observed Items | ✅ 100% | `CrRepairItem` (`isNewlyObserved: true`); same `_buildDefect()` with Sec-04 UIDs (2800.0052–0058). |
| 05 — Completion Status | ✅ 100% | `CrCompletionStatus` + `CrInconsistentFeature` typed; `_buildCompletionStatus()` emits all UIDs. `CrCompletionStatusSection.tsx` complete. |
| 06 — Completion Commentary | ✅ 100% | `VALUATION_COMPLETION_DETAIL / AppraisalCompletionCommentText` (UID 2800.0007). `CrCommentarySection.tsx` covers Sec 06+07. |
| 07 — Exhibits | ✅ 100% | `CrExhibit` typed with 9-value `CrImageCategoryType`; `_buildExhibits()` emits `IMAGE` containers. |
| 08 — Assignment Information | ✅ 100% | All typed; `_buildParties()` + `_buildLoans()` emit all FIDs. `CrAssignmentSection.tsx` covers Sec 08+09. `GovernmentAgencyAppraisalType` narrowed. |
| 09 — Certifications | ✅ 100% | `CrCertifications` + `CrSignature` typed; Cert 6 text computed from `personalInspectionPerformed`. Signature date data-entry in `CrAssignmentSection.tsx`. |
| **Overall** | **✅ ~100%** | **All sections implemented: backend types + mapper + MISMO XML generator + routing + unit tests + frontend Redux slice + 6 React form sections + orchestrator.** |

#### Implemented files (all sprints)

| File | Purpose |
|---|---|
| `src/types/canonical-completion-report.ts` | All 9 sections fully typed; `Cr`-prefixed interfaces; `GovernmentAgencyAppraisalType` union; `generateFinalValueConditionStatement()` pure helper |
| `src/mappers/completion-report.mapper.ts` | Validates `CanonicalCompletionReport`; produces `CompletionReportGenerationContext` with section-visibility flags |
| `src/services/completion-report-xml-generator.service.ts` | Standalone MISMO 3.4 XML generator; complete `MESSAGE → DEAL → COLLATERAL / PARTIES / RELATIONSHIPS / SERVICES` tree |
| `src/services/final-report.service.ts` | +2 imports; routing branch in `_firePostGenerationEvents()` |
| `src/types/template.types.ts` | Added `COMPLETION_REPORT = 'COMPLETION_REPORT'` to `AppraisalFormType` enum |
| `tests/completion-report.mapper.test.ts` | Full unit test coverage — happy path + every required-field throw |
| `tests/completion-report-xml-generator.test.ts` | XML output tests — all 9 sections, PARTIES/RELATIONSHIPS, SIGNATORY, LOANS |
| *(frontend)* `src/store/slices/completionReportSlice.ts` | Redux Toolkit slice — state, reducers, and selectors for all 9 sections |
| *(frontend)* `src/store/rootReducer.ts` | Registered `completionReport` slice |
| *(frontend)* `src/components/completion-report/sections/CrSubjectPropertySection.tsx` | Section 01 data-entry |
| *(frontend)* `src/components/completion-report/sections/CrOriginalAppraisalSection.tsx` | Section 02 data-entry |
| *(frontend)* `src/components/completion-report/sections/CrRepairItemsSection.tsx` | Sections 03 & 04 combined |
| *(frontend)* `src/components/completion-report/sections/CrCompletionStatusSection.tsx` | Section 05 data-entry |
| *(frontend)* `src/components/completion-report/sections/CrCommentarySection.tsx` | Sections 06 & 07 combined |
| *(frontend)* `src/components/completion-report/sections/CrAssignmentSection.tsx` | Sections 08 & 09 combined |
| *(frontend)* `src/components/completion-report/CompletionReportForm.tsx` | Tab orchestrator — 6 tabs, save/dirty indicator |

#### Resolved gaps

1. ✅ **Frontend form components** — 6 section components + `CompletionReportForm.tsx` orchestrator
2. ✅ **`GovernmentAgencyAppraisalType` enum** — narrowed from `string` to `'FHA' | 'VA' | 'USDA' | 'Other'`
3. ✅ **Mapper test coverage** — `tests/completion-report.mapper.test.ts` covers happy path + all required-field violations
4. ✅ **XML snapshot tests** — `tests/completion-report-xml-generator.test.ts` covers all 9 sections
5. ✅ **On-demand MISMO route** — patched in prior sprint
