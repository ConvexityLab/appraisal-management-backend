/**
 * DvrBpoMapper
 *
 * Maps a CanonicalReportDocument to a rich Handlebars template context for the
 * DVR (Desktop Valuation Review) / BPO-style report.
 *
 * The returned object is passed directly to Handlebars.compile() and consumed
 * by src/templates/dvr-v1.hbs. All monetary values are pre-formatted as
 * locale strings so the template does not need any helpers.
 */

import { IFieldMapper } from './field-mapper.interface';
import { CanonicalReportDocument } from '../../../types/canonical-schema';
import { buildAiInsightsContext, buildEnrichmentContext, buildSourceDocumentsContext } from './ai-insights.helpers';

const fmt = (val: number | null | undefined): string =>
  val == null ? '' : val.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const fmtNum = (val: number | null | undefined): string =>
  val == null ? '' : val.toLocaleString('en-US');

const a = (s: string | null | undefined): string => s ?? '';

export class DvrBpoMapper implements IFieldMapper {
  readonly mapperKey = 'dvr-bpo';

  mapToFieldMap(doc: CanonicalReportDocument): Record<string, unknown> {
    // CanonicalSubject extends CanonicalPropertyCore directly — no ".property" sub-key
    const s = doc.subject;
    const addr = s?.address;
    const mkt = s?.neighborhood;
    const dvr = doc.dvrDetail;
    const { comps, valuation, appraiserInfo } = doc;

    return {
      // ── Report metadata ───────────────────────────────────────────────────
      reportDate:       new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      effectiveDate:    a(doc.metadata.effectiveDate),
      orderId:          doc.metadata.orderId,
      orderNumber:      a(doc.metadata.orderNumber),
      clientName:       a(doc.metadata.clientName),
      loanNumber:       a(doc.metadata.loanNumber),

      // ── Subject property ──────────────────────────────────────────────────
      subject: {
        address:        addr ? `${a(addr.streetAddress)}, ${a(addr.city)}, ${a(addr.state)} ${a(addr.zipCode)}` : '',
        streetAddress:  a(addr?.streetAddress),
        city:           a(addr?.city),
        state:          a(addr?.state),
        zip:            a(addr?.zipCode),
        county:         a(addr?.county),
        apn:            a(s?.parcelNumber),
        legalDesc:      a(s?.legalDescription),
        propertyType:   a(s?.propertyType),
        occupancy:      a(s?.occupant),
        propertyRights: a(s?.contractInfo?.propertyRightsAppraised),
        yearBuilt:      s?.yearBuilt?.toString() ?? '',
        gla:            s?.grossLivingArea != null ? fmtNum(s.grossLivingArea) + ' SF' : '',
        style:          a(s?.design),
        stories:        s?.stories?.toString() ?? '',
        bedrooms:       s?.bedrooms?.toString() ?? '',
        bathrooms:      s?.bathrooms?.toFixed(1) ?? '',
        basement:       s?.basementSqFt ? fmtNum(s.basementSqFt) + ' SF' : 'None',
        garage:         s?.garageType ? `${s.garageSpaces ?? ''} ${s.garageType}`.trim() : 'None',
        condition:      a(s?.condition),
        quality:        a(s?.quality),
        siteArea:       s?.lotSizeSqFt != null ? `${fmtNum(s.lotSizeSqFt)} ${a(s?.siteAreaUnit)}`.trim() : '',
        zoning:         a(s?.zoning),
        taxYear:        s?.taxYear?.toString() ?? '',
        annualTaxes:    fmt(s?.annualTaxes),
      },

      // ── DVR-specific ratings ──────────────────────────────────────────────
      dvr: dvr ? {
        overallCondition:       dvr.overallCondition,
        interiorCondition:      dvr.interiorCondition,
        exteriorCondition:      dvr.exteriorCondition,
        repairCostRange:
          dvr.estimatedRepairCostLow != null && dvr.estimatedRepairCostHigh != null
            ? `${fmt(dvr.estimatedRepairCostLow)} – ${fmt(dvr.estimatedRepairCostHigh)}`
            : '',
        majorRepairsNeeded:     a(dvr.majorRepairsNeeded),
        occupancyStatus:        dvr.occupancyStatus,
        occupantCooperation:    a(dvr.occupantCooperation),
        accessType:             dvr.accessType,
        daysToSell:             dvr.daysToSell?.toString() ?? '',
        listingPriceRec:        fmt(dvr.listingPriceRecommendation),
        quickSaleDiscount:      dvr.quickSaleDiscount != null ? `${dvr.quickSaleDiscount}%` : '',
        quickSaleValue:
          dvr.listingPriceRecommendation != null && dvr.quickSaleDiscount != null
            ? fmt(dvr.listingPriceRecommendation * (1 - dvr.quickSaleDiscount / 100))
            : '',
      } : null,

      // ── Valuation ─────────────────────────────────────────────────────────
      valuation: valuation ? {
        indicatedValue:   fmt(valuation.estimatedValue),
        confidenceScore:  valuation.confidenceScore != null
                            ? `${(valuation.confidenceScore).toFixed(0)}%`
                            : '',
        valuationDate:    valuation.effectiveDate ?? '',
        valueRangeLow:    fmt(valuation.lowerBound),
        valueRangeHigh:   fmt(valuation.upperBound),
        approaches:       valuation.approachesUsed?.join(', ') ?? '',
      } : null,

      // ── Market / neighborhood ─────────────────────────────────────────────
      market: mkt ? {
        locationType:       a(mkt.locationType),
        propertyValues:     a(mkt.propertyValues),
        supplyDemand:       a(mkt.demandSupply),
        marketingTimeRange: a(mkt.marketingTime),
        priceLow:           fmt(mkt.singleFamilyPriceRange?.low),
        priceHigh:          fmt(mkt.singleFamilyPriceRange?.high),
        description:        a(mkt.neighborhoodDescription),
        marketConditions:   a(mkt.marketConditionsNotes),
      } : null,

      // ── Comparables ───────────────────────────────────────────────────────
      comps: (comps ?? [])
        .filter(c => c.selected)
        .sort((a, b) => (a.slotIndex ?? 99) - (b.slotIndex ?? 99))
        .slice(0, 6)
        .map((comp, i) => {
          const cAddr = comp.address;
          const adj = comp.adjustments;
          return {
            slotIndex:    i + 1,
            address:      cAddr ? `${a(cAddr.streetAddress)}, ${a(cAddr.city)}, ${a(cAddr.state)}` : '',
            salePrice:    fmt(comp.salePrice),
            adjSalePrice: fmt(adj?.adjustedSalePrice),
            saleDate:     comp.saleDate ?? '',
            proximity:    a(comp.proximityToSubject),
            gla:          comp.grossLivingArea != null ? fmtNum(comp.grossLivingArea) + ' SF' : '',
            yearBuilt:    comp.yearBuilt?.toString() ?? '',
            bedrooms:     comp.bedrooms?.toString() ?? '',
            bathrooms:    comp.bathrooms?.toFixed(1) ?? '',
            condition:    a(comp.condition),
            quality:      a(comp.quality),
            netAdj:       adj?.netAdjustmentTotal != null ? fmt(adj.netAdjustmentTotal) : '',
            grossAdj:     adj?.grossAdjustmentTotal != null ? fmt(adj.grossAdjustmentTotal) : '',
            dataSource:   a(comp.dataSource),
            dom:          comp.mlsData?.daysOnMarket?.toString() ?? '',
          };
        }),

      // ── Photos ────────────────────────────────────────────────────────────
      subjectFrontPhoto:  doc.photos?.find(p => p.photoType === 'SUBJECT_FRONT')  ?? null,
      subjectRearPhoto:   doc.photos?.find(p => p.photoType === 'SUBJECT_REAR')   ?? null,
      subjectStreetPhoto: doc.photos?.find(p => p.photoType === 'SUBJECT_STREET') ?? null,
      aerialPhoto:        doc.photos?.find(p => p.photoType === 'AERIAL')         ?? null,
      compPhotos: (comps ?? [])
        .filter(c => c.selected)
        .sort((a, b) => (a.slotIndex ?? 99) - (b.slotIndex ?? 99))
        .slice(0, 6)
        .map((_, i) =>
          doc.photos?.find(p => p.photoType === 'COMP_FRONT' && p.compIndex === i + 1) ?? null
        ),

      // ── Appraiser / reviewer ──────────────────────────────────────────────
      appraiser: appraiserInfo ? {
        name:          appraiserInfo.name,
        licenseNum:    appraiserInfo.licenseNumber,
        licenseState:  appraiserInfo.licenseState,
        licenseType:   appraiserInfo.licenseType,
        company:       appraiserInfo.companyName,
        address:       appraiserInfo.companyAddress,
        phone:         appraiserInfo.phone,
        email:         appraiserInfo.email,
        signatureDate: appraiserInfo.signatureDate,
      } : null,

      // ── Capability-5: AI insights + enrichment ───────────────────────
      aiInsights:     buildAiInsightsContext(doc),
      enrichmentData: buildEnrichmentContext(doc),
      sourceDocuments: buildSourceDocumentsContext(doc),
    };
  }
}
