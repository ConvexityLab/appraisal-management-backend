/**
 * DvrDeskReviewMapper
 *
 * Maps a CanonicalReportDocument to the Handlebars context for the
 * DVR Non-Owner Occupied Review form (DVR-10 / dvr-desk-review-v1.hbs).
 *
 * This form is an APPRAISAL REVIEW product — Vision VMC reviewers use it
 * to assess whether an original appraiser's value is supported. Layout:
 *   p1 — subject photo, original appraisal value, review value, grade A-D,
 *         property details, property stats, neighborhood, admin Y/N checklist
 *   p2 — comments text box + static scope of work boilerplate
 *   p3 — static legal / limiting conditions text (continued)
 *   p4 — limiting conditions 7-8 + reviewer signature block
 *
 * Review-specific fields (originalAppraisalValue, reviewValue, appraisalGrade,
 * adminReview Y/N answers) are sourced from reconciliation / valuation where
 * they exist; otherwise they render as blank lines — correct for a newly
 * generated review form awaiting reviewer input.
 */

import { IFieldMapper } from './field-mapper.interface';
import { CanonicalReportDocument } from '@l1/shared-types';
import { buildAiInsightsContext, buildEnrichmentContext, buildSourceDocumentsContext } from './ai-insights.helpers';

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (val: number | null | undefined): string =>
  val == null
    ? ''
    : val.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const fmtNum = (val: number | null | undefined): string =>
  val == null ? '' : val.toLocaleString('en-US');

const fmtPct = (val: number | null | undefined): string =>
  val == null ? '' : `${val.toFixed(1)}%`;

const a = (s: string | null | undefined): string => s ?? '';

// ── Mapper ────────────────────────────────────────────────────────────────────

/** Maps a condition string to the CSS badge class used in the template. */
const conditionClass = (c: string | null | undefined): string => {
  const map: Record<string, string> = {
    Excellent: 'excellent',
    Good: 'good',
    Average: 'average',
    Fair: 'fair',
    Poor: 'poor',
  };
  return map[c ?? ''] ?? 'average';
};

// ── Default limiting-conditions text for desktop reviews ───────────────────

const DEFAULT_DESKTOP_LIMITING_CONDITIONS =
  'This review is a desktop valuation based solely on available data sources ' +
  '(MLS history, public records, tax assessor data, AVM outputs, and aerial/satellite ' +
  'imagery) without a physical inspection of the subject property. The reviewer has not ' +
  'personally inspected the interior or exterior of the property. All conclusions are ' +
  'subject to the accuracy and completeness of the data sources available at the effective ' +
  'date. This report is intended solely for use by the client identified herein for the ' +
  'purpose of evaluating a non-owner-occupied investment property.';

// ── Mapper ─────────────────────────────────────────────────────────────────

export class DvrDeskReviewMapper implements IFieldMapper {
  readonly mapperKey = 'dvr-desk-review';

  mapToFieldMap(doc: CanonicalReportDocument): Record<string, unknown> {
    const s = doc.subject;
    const addr = s?.address;
    const mkt = s?.neighborhood;
    const val = doc.valuation;
    const reconciliation = doc.reconciliation;
    const appraiserInfo = doc.appraiserInfo;
    const { comps } = doc;

    // ── Photos ──────────────────────────────────────────────────────────
    const photos = doc.photos ?? [];
    const subjectFrontPhoto    = photos.find(p => p.photoType === 'SUBJECT_FRONT');
    const subjectRearPhoto     = photos.find(p => p.photoType === 'SUBJECT_REAR');
    const subjectInteriorPhoto = photos.find(p => p.photoType === 'SUBJECT_INTERIOR');
    const aerialPhoto          = photos.find(p => p.photoType === 'AERIAL');
    const compPhotos           = photos
      .filter(p => p.photoType === 'COMP_FRONT')
      .sort((a, b) => (a.compIndex ?? 99) - (b.compIndex ?? 99))
      .slice(0, 6);

    // ── MLS data from first selected comp or from subject contract ───────
    // The canonical schema doesn't have a top-level dataSources object,
    // so we derive the display values from the subject and available fields.
    const mlsNumbers = (comps ?? [])
      .filter(c => c.selected && c.mlsData?.mlsNumber)
      .map(c => c.mlsData!.mlsNumber)
      .join(', ');

    const lastMlsDate = (comps ?? [])
      .filter(c => c.selected && c.mlsData?.soldDate)
      .map(c => c.mlsData!.soldDate)
      .sort()
      .pop() ?? '';

    // ── Selected comps for the grid ──────────────────────────────────────
    const selectedComps = (comps ?? [])
      .filter(c => c.selected)
      .sort((a, b) => (a.slotIndex ?? 99) - (b.slotIndex ?? 99))
      .map(c => {
        const adj = c.adjustments;
        const ca = c.address;
        const salePrice = c.salePrice ?? 0;
        const pricePerSqFt =
          salePrice > 0 && c.grossLivingArea
            ? (salePrice / c.grossLivingArea).toFixed(0)
            : '';

        return {
          fullAddress: ca
            ? `${a(ca.streetAddress)}, ${a(ca.city)}, ${a(ca.state)} ${a(ca.zipCode)}`
            : '',
          proximityToSubject: a(c.proximityToSubject),
          saleDate:           a(c.saleDate),
          salePrice:          fmt(c.salePrice),
          grossLivingArea:    fmtNum(c.grossLivingArea),
          bedrooms:           c.bedrooms?.toString() ?? '',
          bathrooms:          c.bathsFull != null
            ? (c.bathsFull + (c.bathsHalf ?? 0) * 0.5).toFixed(1)
            : c.bathrooms?.toFixed(1) ?? '',
          yearBuilt:          c.yearBuilt?.toString() ?? '',
          condition:          a(c.condition),
          daysOnMarket:       c.mlsData?.daysOnMarket?.toString() ?? '',
          pricePerSqFt:       pricePerSqFt ? `$${pricePerSqFt}` : '',
          adjSalePrice:       adj ? fmt(adj.adjustedSalePrice) : fmt(c.salePrice),
          verificationSource: c.mlsData?.mlsNumber
            ? `MLS #${c.mlsData.mlsNumber}`
            : a(c.verificationSource),
        };
      });

    // ── Valuation ────────────────────────────────────────────────────────
    const finalValue   = reconciliation?.finalOpinionOfValue ?? val?.estimatedValue;
    const lowerBound   = val?.lowerBound;
    const upperBound   = val?.upperBound;
    const reconcNarr   = reconciliation?.reconciliationNarrative ?? val?.reconciliationNotes;

    // ── Rental / income fields — derived from income approach if present ─
    const incomeApproach = doc.incomeApproach;
    const estimatedMonthlyRent = incomeApproach?.estimatedMonthlyMarketRent;
    const grossRentMultiplier  =
      finalValue && estimatedMonthlyRent && estimatedMonthlyRent > 0
        ? (finalValue / (estimatedMonthlyRent * 12)).toFixed(2)
        : '';

    return {
      // ── Report metadata ─────────────────────────────────────────────
      reportDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),

      metadata: {
        orderId:           a(doc.metadata.orderId),
        orderNumber:       a(doc.metadata.orderNumber),
        clientName:        a(doc.metadata.clientName),
        clientCompanyName: a(doc.metadata.clientCompanyName),
        loanNumber:        a(doc.metadata.loanNumber),
        effectiveDate:     a(doc.metadata.effectiveDate),
      },

      // ── Subject ─────────────────────────────────────────────────────
      subject: {
        fullAddress:      addr
          ? `${a(addr.streetAddress)}, ${a(addr.city)}, ${a(addr.state)} ${a(addr.zipCode)}`
          : '',
        streetAddress:    a(addr?.streetAddress),
        city:             a(addr?.city),
        state:            a(addr?.state),
        zipCode:          a(addr?.zipCode),
        county:           a(addr?.county),
        parcelNumber:     a(s?.parcelNumber),
        legalDescription: a(s?.legalDescription),
        propertyType:     a(s?.propertyType),
        occupant:         a(s?.occupant),
        yearBuilt:        s?.yearBuilt?.toString() ?? '',
        grossLivingArea:  s?.grossLivingArea != null ? `${fmtNum(s.grossLivingArea)} SF` : '',
        bedrooms:         s?.bedrooms?.toString() ?? '',
        bathrooms:        s?.bathsFull != null
          ? (s.bathsFull + (s.bathsHalf ?? 0) * 0.5).toFixed(1)
          : s?.bathrooms?.toFixed(1) ?? '',
        basementSqFt:     s?.basementSqFt ? `${fmtNum(s.basementSqFt)} SF` : 'None',
        lotSizeSqFt:      s?.lotSizeSqFt != null ? fmtNum(s.lotSizeSqFt) : '',
        garageType:       a(s?.garageType),
        garageSpaces:     s?.garageSpaces?.toString() ?? '',
        condition:        a(s?.condition),
        conditionClass:   conditionClass(s?.condition),
        quality:          a(s?.quality),
        zoning:           a(s?.zoning),
      },

      // ── Data sources (derived from available canonical fields) ───────
      dataSources: {
        mls:              mlsNumbers.length > 0,
        publicRecords:    true,   // always checked for a desk review
        avm:              val?.avmProvider != null,
        taxRecords:       s?.annualTaxes != null,
        priorAppraisal:   false,
        permitHistory:    false,
        satelliteImagery: true,   // aerial photo sourced from satellite
        mlsListingNumbers:    mlsNumbers,
        lastMlsActivityDate:  a(lastMlsDate),
        avmProvider:          a(val?.avmProvider),
        sourceComments:       '',
        priorAppraisalNotes:  '',
      },

      // ── Rental / income analysis ─────────────────────────────────────
      rental: {
        estimatedMonthlyRent: estimatedMonthlyRent != null ? fmt(estimatedMonthlyRent) : '',
        grossRentMultiplier:  grossRentMultiplier,
        rentSource:           incomeApproach ? 'Income Approach Analysis' : '',
        currentOccupancy:     a(s?.occupant),
        currentRent:          incomeApproach?.estimatedMonthlyMarketRent ? fmt(incomeApproach.estimatedMonthlyMarketRent) : '',
        rentalMarketComments:  '',
        investorComments:      '',
      },

      // ── Neighborhood / market ────────────────────────────────────────
      market: mkt ? {
        locationType:      a(mkt.locationType),
        builtUp:           a(mkt.builtUp),
        growth:            a(mkt.growth),
        propertyValues:    a(mkt.propertyValues),
        supplyDemand:      a(mkt.demandSupply),
        marketingTimeRange: a(mkt.marketingTime),
        priceLow:          fmt(mkt.singleFamilyPriceRange?.low),
        priceHigh:         fmt(mkt.singleFamilyPriceRange?.high),
        absorptionRate:    '',
        investorDemand:    '',
        description:       a(mkt.neighborhoodDescription) || a(mkt.marketConditionsNotes),
      } : null,

      // ── Comparables ─────────────────────────────────────────────────
      comps: selectedComps,

      // ── Comp photos ─────────────────────────────────────────────────
      compPhotos,

      // ── Valuation ───────────────────────────────────────────────────
      valuation: val ? {
        indicatedValue:          fmt(finalValue),
        valueRangeLow:           fmt(lowerBound),
        valueRangeHigh:          fmt(upperBound),
        confidenceScore:         fmtPct(val.confidenceScore),
        approaches:              val.approachesUsed?.join(', ') ?? '',
        reconciliationNarrative: a(reconcNarr),
      } : null,

      // ── Subject photos ──────────────────────────────────────────────
      subjectFrontPhoto,
      subjectFrontPhotoSource:    subjectFrontPhoto ? 'MLS / Public Record' : '',
      subjectRearPhoto,
      subjectRearPhotoSource:     subjectRearPhoto  ? 'MLS / Public Record' : '',
      subjectInteriorPhoto,
      subjectInteriorPhotoSource: subjectInteriorPhoto ? 'MLS / Public Record' : '',
      aerialPhoto,
      aerialPhotoSource:          aerialPhoto ? 'Aerial / Satellite Imagery' : '',

      // ── Appraiser / reviewer ─────────────────────────────────────────
      appraiser: appraiserInfo ? {
        name:                   a(appraiserInfo.name),
        companyName:            a(appraiserInfo.companyName),
        companyAddress:         a(appraiserInfo.companyAddress),
        phone:                  a(appraiserInfo.phone),
        email:                  a(appraiserInfo.email),
        licenseType:            a(appraiserInfo.licenseType),
        licenseNumber:          a(appraiserInfo.licenseNumber),
        licenseState:           a(appraiserInfo.licenseState),
        licenseExpirationDate:  a(appraiserInfo.licenseExpirationDate),
        isCertified:            appraiserInfo.licenseType?.startsWith('Certified') ?? false,
        signatureDate:          a(appraiserInfo.signatureDate),
      } : null,

      // ── Limiting conditions ──────────────────────────────────────────
      limitingConditions: DEFAULT_DESKTOP_LIMITING_CONDITIONS,
      // ── Capability-5: AI insights + enrichment ────────────────────
      aiInsights:      buildAiInsightsContext(doc),
      enrichmentData:  buildEnrichmentContext(doc),
      sourceDocuments: buildSourceDocumentsContext(doc),    };
  }
}
