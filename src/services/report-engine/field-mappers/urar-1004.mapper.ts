/**
 * Urar1004Mapper
 *
 * Maps CanonicalReportDocument → rich Handlebars context object for the
 * urar-v1.hbs HTML template (html-render strategy).
 *
 * This mapper does NOT produce AcroForm field keys.  Field names follow
 * our internal canonical schema (UAD 3.6 aligned) and the Handlebars
 * template helpers expect exactly the structure returned here.
 *
 * DVR / Vision BPO: handled by dvr-bpo.mapper.ts.
 */

import { IFieldMapper } from './field-mapper.interface';
import {
  CanonicalReportDocument,
  CanonicalComp,
  CanonicalAdjustments,
  CanonicalAppraiserInfo,
  HighestAndBestUse,
  ValueType,
} from '../../../types/canonical-schema';
import { buildAiInsightsContext, buildEnrichmentContext, buildSourceDocumentsContext } from './ai-insights.helpers';

// ── Helpers ──────────────────────────────────────────────────────────────────

const a = (s: string | null | undefined): string => s ?? '';

const currency = (v: number | null | undefined): string =>
  v != null ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '';

const currencySigned = (v: number | null | undefined): string => {
  if (v == null) return '';
  const abs = `$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  return v >= 0 ? `+${abs}` : `-${abs}`;
};

const pct = (v: number | null | undefined, digits = 1): string =>
  v != null ? `${v.toFixed(digits)}%` : '';

const num = (v: number | null | undefined, digits = 0): string =>
  v != null ? v.toFixed(digits) : '';

/** Format ISO date string as "Month DD, YYYY" */
const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
};

/** Format ISO date string as "MM/DD/YYYY" */
const shortDate = (iso: string | null | undefined): string => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US');
  } catch {
    return iso;
  }
};

// ── Comp helpers ──────────────────────────────────────────────────────────────

/** CSS classes for coloring adjustment cells by sign. */
function buildAdjSignContext(adj: CanonicalAdjustments | null | undefined): Record<string, string> {
  const sign = (v: number | null | undefined): string =>
    v == null ? '' : v > 0 ? 'adj-p' : v < 0 ? 'adj-n' : '';
  if (!adj) return {};
  return {
    saleOrFinancingConcessions:   sign(adj.saleOrFinancingConcessions),
    dateOfSaleTime:               sign(adj.dateOfSaleTime),
    locationAdj:                  sign(adj.locationAdj),
    leaseholdFeeSimple:           sign(adj.leaseholdFeeSimple),
    site:                         sign(adj.site),
    viewAdj:                      sign(adj.viewAdj),
    designAndAppeal:              sign(adj.designAndAppeal),
    qualityOfConstruction:        sign(adj.qualityOfConstruction),
    actualAge:                    sign(adj.actualAge),
    conditionAdj:                 sign(adj.conditionAdj),
    aboveGradeRoomCount:          sign(adj.aboveGradeRoomCount),
    grossLivingAreaAdj:           sign(adj.grossLivingAreaAdj),
    basementAndFinishedRooms:     sign(adj.basementAndFinishedRooms),
    heatingCooling:               sign(adj.heatingCooling),
    energyEfficiency:             sign(adj.energyEfficiency),
    garageCarport:                sign(adj.garageCarport),
    porchPatioPool:               sign(adj.porchPatioPool),
    otherAdj1:                    sign(adj.otherAdj1),
    netAdjustmentTotal:           sign(adj.netAdjustmentTotal),
  };
}

function buildAdjContext(adj: CanonicalAdjustments | null | undefined) {
  if (!adj) return null;
  return {
    saleOrFinancingConcessions:   currencySigned(adj.saleOrFinancingConcessions),
    dateOfSaleTime:               currencySigned(adj.dateOfSaleTime),
    locationAdj:                  currencySigned(adj.locationAdj),
    leaseholdFeeSimple:           currencySigned(adj.leaseholdFeeSimple),
    site:                         currencySigned(adj.site),
    viewAdj:                      currencySigned(adj.viewAdj),
    designAndAppeal:              currencySigned(adj.designAndAppeal),
    qualityOfConstruction:        currencySigned(adj.qualityOfConstruction),
    actualAge:                    currencySigned(adj.actualAge),
    conditionAdj:                 currencySigned(adj.conditionAdj),
    aboveGradeRoomCount:          currencySigned(adj.aboveGradeRoomCount),
    aboveGradeBedroom:            currencySigned(adj.aboveGradeBedroom),
    aboveGradeBathroom:           currencySigned(adj.aboveGradeBathroom),
    grossLivingAreaAdj:           currencySigned(adj.grossLivingAreaAdj),
    basementAndFinishedRooms:     currencySigned(adj.basementAndFinishedRooms),
    functionalUtility:            currencySigned(adj.functionalUtility),
    heatingCooling:               currencySigned(adj.heatingCooling),
    energyEfficiency:             currencySigned(adj.energyEfficiency),
    garageCarport:                currencySigned(adj.garageCarport),
    porchPatioPool:               currencySigned(adj.porchPatioPool),
    otherAdj1:                    currencySigned(adj.otherAdj1),
    otherAdj2:                    currencySigned(adj.otherAdj2),
    otherAdj3:                    currencySigned(adj.otherAdj3),
    netAdjustmentTotal:           currencySigned(adj.netAdjustmentTotal),
    grossAdjustmentTotal:         currency(adj.grossAdjustmentTotal),
    adjustedSalePrice:            currency(adj.adjustedSalePrice),
    netAdjustmentPct:             pct(adj.netAdjustmentPct),
    grossAdjustmentPct:           pct(adj.grossAdjustmentPct),
  };
}

function buildCompContext(comp: CanonicalComp | null | undefined, slotLabel: string) {
  if (!comp) return { slotLabel, empty: true };
  const addr = comp.address;
  return {
    slotLabel,
    empty: false,
    compId:               comp.compId,
    address:              a(addr.streetAddress),
    city:                 a(addr.city),
    state:                a(addr.state),
    zipCode:              a(addr.zipCode),
    fullAddress:          `${a(addr.streetAddress)}, ${a(addr.city)}, ${a(addr.state)} ${a(addr.zipCode)}`,
    proximityToSubject:   a(comp.proximityToSubject),
    salePrice:            currency(comp.salePrice),
    salePriceRaw:         comp.salePrice,
    saleDate:             shortDate(comp.saleDate),
    priorSalePrice:       currency(comp.priorSalePrice),
    priorSaleDate:        shortDate(comp.priorSaleDate),
    priorSalePrice2:      currency(comp.priorSalePrice2),
    priorSaleDate2:       shortDate(comp.priorSaleDate2),
    listPrice:            currency(comp.listPrice),
    dataSource:           a(comp.dataSource),
    verificationSource:   a(comp.verificationSource),
    financingType:        a(comp.financingType),
    saleType:             a(comp.saleType),
    concessionsAmount:    currencySigned(comp.concessionsAmount),
    saleFinancingConcessions: a(comp.saleFinancingConcessions),
    propertyRights:       a(comp.propertyRights),
    grossLivingArea:      num(comp.grossLivingArea),
    totalRooms:           num(comp.totalRooms),
    bedrooms:             num(comp.bedrooms),
    bathrooms:            num(comp.bathrooms, 1),
    stories:              num(comp.stories, 1),
    lotSizeSqFt:          num(comp.lotSizeSqFt),
    propertyType:         a(comp.propertyType),
    condition:            a(comp.condition),
    quality:              a(comp.quality),
    design:               a(comp.design),
    yearBuilt:            num(comp.yearBuilt),
    effectiveAge:         num(comp.effectiveAge),
    foundationType:       a(comp.foundationType),
    exteriorWalls:        a(comp.exteriorWalls),
    roofSurface:          a(comp.roofSurface),
    basement:             a(comp.basement),
    basementSqFt:         num(comp.basementSqFt),
    basementFinishedSqFt: num(comp.basementFinishedSqFt),
    heating:              a(comp.heating),
    cooling:              a(comp.cooling),
    fireplaces:           num(comp.fireplaces),
    garageType:           a(comp.garageType),
    garageSpaces:         num(comp.garageSpaces),
    porchPatioDeck:       a(comp.porchPatioDeck),
    pool:                 comp.pool ? 'Yes' : 'No',
    view:                 a(comp.view),
    locationRating:       a(comp.locationRating),
    adjustments:          buildAdjContext(comp.adjustments),
    adjSign:              buildAdjSignContext(comp.adjustments),
  };
}

// ── Main mapper ───────────────────────────────────────────────────────────────

export class Urar1004Mapper implements IFieldMapper {
  readonly mapperKey = 'urar-1004';

  mapToFieldMap(doc: CanonicalReportDocument): Record<string, unknown> {
    const { subject, comps, valuation, reconciliation, appraiserInfo, costApproach, incomeApproach } = doc;
    const m = doc.metadata;
    const addr = subject?.address;
    const nbhd = subject?.neighborhood;
    const contract = subject?.contractInfo;
    const utilities = subject?.utilities;

    // ── Selected comps ordered by slotIndex ──────────────────────────────────
    const selectedComps = (comps ?? [])
      .filter(c => c.selected && c.slotIndex != null)
      .sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0));

    const primaryComps = [1, 2, 3].map(slot =>
      buildCompContext(selectedComps.find(c => c.slotIndex === slot), `Comparable ${slot}`)
    );
    const secondaryComps = [4, 5, 6].map(slot =>
      buildCompContext(selectedComps.find(c => c.slotIndex === slot), `Comparable ${slot}`)
    );

    // ── Prior sales analysis lines ────────────────────────────────────────────
    const priorSalesAnalysisLines = [
      m.subjectPriorSaleDate1 || m.subjectPriorSalePrice1
        ? `Prior sale 1: ${shortDate(m.subjectPriorSaleDate1)} / ${currency(m.subjectPriorSalePrice1)}`
        : 'No prior sale within 36 months.',
      m.subjectPriorSaleDate2 || m.subjectPriorSalePrice2
        ? `Prior sale 2: ${shortDate(m.subjectPriorSaleDate2)} / ${currency(m.subjectPriorSalePrice2)}`
        : null,
    ].filter(Boolean);

    // ── Cost approach context ─────────────────────────────────────────────────
    const costCtx = costApproach
      ? {
          estimatedLandValue:               currency(costApproach.estimatedLandValue),
          landValueSource:                  a(costApproach.landValueSource),
          landValueMethod:                  a(costApproach.landValueMethod),
          landValueEvidence:                a(costApproach.landValueEvidence),
          replacementCostNew:               currency(costApproach.replacementCostNew),
          costFactorSource:                 a(costApproach.costFactorSource),
          softCosts:                        currency(costApproach.softCosts),
          entrepreneurialProfit:            currency(costApproach.entrepreneurialProfit),
          siteImprovementsCost:             currency(costApproach.siteImprovementsCost),
          depreciationAmount:               currency(costApproach.depreciationAmount),
          depreciationType:                 a(costApproach.depreciationType),
          physicalDepreciationCurable:      currency(costApproach.physicalDepreciationCurable),
          physicalDepreciationIncurable:    currency(costApproach.physicalDepreciationIncurable),
          functionalObsolescence:           currency(costApproach.functionalObsolescence),
          externalObsolescence:             currency(costApproach.externalObsolescence),
          effectiveAge:                     num(costApproach.effectiveAge),
          economicLife:                     num(costApproach.economicLife),
          depreciatedCostOfImprovements:    currency(costApproach.depreciatedCostOfImprovements),
          indicatedValueByCostApproach:     currency(costApproach.indicatedValueByCostApproach),
          indicatedValueRaw:                costApproach.indicatedValueByCostApproach,
          comments:                         a(costApproach.comments),
        }
      : null;

    const hasCostDepreciationBreakdown = !!(costApproach?.physicalDepreciationCurable != null ||
      costApproach?.physicalDepreciationIncurable != null ||
      costApproach?.functionalObsolescence != null ||
      costApproach?.externalObsolescence != null);

    // ── Income approach context ───────────────────────────────────────────────
    const rentComps = incomeApproach?.rentComps
      ? incomeApproach.rentComps.map(rc => ({
          address:             a(rc.address),
          proximityToSubject:  a(rc.proximityToSubject),
          monthlyRent:         currency(rc.monthlyRent),
          adjustedRent:        currency(rc.adjustedRent),
          propertyDescription: a(rc.propertyDescription),
          dataSource:          a(rc.dataSource),
        }))
      : [];

    const incomeCtx = incomeApproach
      ? {
          estimatedMonthlyMarketRent:       currency(incomeApproach.estimatedMonthlyMarketRent),
          grossRentMultiplier:              num(incomeApproach.grossRentMultiplier, 2),
          vacancyRate:                      incomeApproach.vacancyRate != null ? `${(incomeApproach.vacancyRate * 100).toFixed(1)}%` : '',
          potentialGrossIncome:             currency(incomeApproach.potentialGrossIncome),
          effectiveGrossIncome:             currency(incomeApproach.effectiveGrossIncome),
          netOperatingIncome:               currency(incomeApproach.netOperatingIncome),
          capRate:                          incomeApproach.capRate != null ? `${(incomeApproach.capRate * 100).toFixed(2)}%` : '',
          indicatedValueByIncomeApproach:   currency(incomeApproach.indicatedValueByIncomeApproach),
          indicatedValueRaw:                incomeApproach.indicatedValueByIncomeApproach,
          comments:                         a(incomeApproach.comments),
          rentComps,
        }
      : null;

    // ── Reconciliation context ────────────────────────────────────────────────
    const confClass = (score: number | null | undefined): string =>
      score == null ? '' : score >= 80 ? 'conf-high' : score >= 60 ? 'conf-medium' : 'conf-low';
    const weightPct = (w: number | null | undefined): string =>
      w != null ? `${Math.round(w * 100)}%` : '0%';

    const reconcCtx = reconciliation
      ? {
          salesCompApproachValue:   currency(reconciliation.salesCompApproachValue),
          costApproachValue:        currency(reconciliation.costApproachValue),
          incomeApproachValue:      currency(reconciliation.incomeApproachValue),
          finalOpinionOfValue:      currency(reconciliation.finalOpinionOfValue),
          finalOpinionOfValueRaw:   reconciliation.finalOpinionOfValue,
          effectiveDate:            formatDate(reconciliation.effectiveDate),
          effectiveDateShort:       shortDate(reconciliation.effectiveDate),
          reconciliationNarrative:  a(reconciliation.reconciliationNarrative),
          exposureTime:             a(reconciliation.exposureTime),
          marketingTime:            a(reconciliation.marketingTime),
          // UAD 3.6 — Approach weighting
          salesCompWeight:          reconciliation.salesCompWeight != null ? `${Math.round((reconciliation.salesCompWeight ?? 0) * 100)}%` : null,
          costWeight:               reconciliation.costWeight != null ? `${Math.round((reconciliation.costWeight ?? 0) * 100)}%` : null,
          incomeWeight:             reconciliation.incomeWeight != null ? `${Math.round((reconciliation.incomeWeight ?? 0) * 100)}%` : null,
          salesCompWeightPct:       weightPct(reconciliation.salesCompWeight),
          costWeightPct:            weightPct(reconciliation.costWeight),
          incomeWeightPct:          weightPct(reconciliation.incomeWeight),
          hasWeights:               reconciliation.salesCompWeight != null,
          confidenceScore:          reconciliation.confidenceScore,
          confidenceClass:          confClass(reconciliation.confidenceScore),
          approachSpreadPct:        pct(reconciliation.approachSpreadPct),
        }
      : valuation
      ? {
          salesCompApproachValue:   currency(valuation.estimatedValue),
          costApproachValue:        null,
          incomeApproachValue:      null,
          finalOpinionOfValue:      currency(valuation.estimatedValue),
          finalOpinionOfValueRaw:   valuation.estimatedValue,
          effectiveDate:            formatDate(valuation.effectiveDate),
          effectiveDateShort:       shortDate(valuation.effectiveDate),
          reconciliationNarrative:  a(valuation.reconciliationNotes),
          exposureTime:             null,
          marketingTime:            null,
          salesCompWeight:          null,
          costWeight:               null,
          incomeWeight:             null,
          salesCompWeightPct:       '100%',
          costWeightPct:            '0%',
          incomeWeightPct:          '0%',
          hasWeights:               false,
          confidenceScore:          valuation.confidenceScore,
          confidenceClass:          confClass(valuation.confidenceScore),
          approachSpreadPct:        null,
        }
      : null;

    // ── Appraiser context ─────────────────────────────────────────────────────
    const buildAppraiserCtx = (info: CanonicalAppraiserInfo | undefined): Record<string, unknown> | null => {
      if (!info) return null;
      const isCertified =
        info.licenseType === 'Certified Residential' ||
        info.licenseType === 'Certified General';
      return {
        name:                     info.name,
        licenseType:              info.licenseType,
        isCertified,
        licenseNumber:            info.licenseNumber,
        licenseState:             info.licenseState,
        licenseExpirationDate:    shortDate(info.licenseExpirationDate),
        companyName:              info.companyName,
        companyAddress:           info.companyAddress,
        phone:                    info.phone,
        email:                    info.email,
        signatureDate:            formatDate(info.signatureDate),
        signatureDateShort:       shortDate(info.signatureDate),
        supervisory:              info.supervisoryAppraiser
          ? buildAppraiserCtx(info.supervisoryAppraiser as CanonicalAppraiserInfo)
          : null,
      };
    };
    const appraiserCtx = buildAppraiserCtx(appraiserInfo);

    // ── Photo slots ───────────────────────────────────────────────────────────
    const photos = {
      subjectFront:  doc.photos?.find(p => p.photoType === 'SUBJECT_FRONT')  ?? null,
      subjectRear:   doc.photos?.find(p => p.photoType === 'SUBJECT_REAR')   ?? null,
      subjectStreet: doc.photos?.find(p => p.photoType === 'SUBJECT_STREET') ?? null,
      aerial:        doc.photos?.find(p => p.photoType === 'AERIAL')         ?? null,
      comp: [1, 2, 3, 4, 5, 6].map(i =>
        doc.photos?.find(p => p.photoType === 'COMP_FRONT' && p.compIndex === i) ?? null
      ),
    };

    // ── Market / neighborhood context ─────────────────────────────────────────
    const marketCtx = nbhd
      ? {
          locationType:             a(nbhd.locationType),
          builtUp:                  a(nbhd.builtUp),
          growth:                   a(nbhd.growth),
          propertyValues:           a(nbhd.propertyValues),
          demandSupply:             a(nbhd.demandSupply),
          marketingTime:            a(nbhd.marketingTime),
          predominantOccupancy:     a(nbhd.predominantOccupancy),
          priceLow:                 currency(nbhd.singleFamilyPriceRange?.low),
          priceHigh:                currency(nbhd.singleFamilyPriceRange?.high),
          predominantAge:           a(nbhd.predominantAge),
          landUseSingleFamily:      num(nbhd.presentLandUse?.singleFamily),
          landUseMultifamily:       num(nbhd.presentLandUse?.multifamily),
          landUseCommercial:        num(nbhd.presentLandUse?.commercial),
          landUseOther:             num(nbhd.presentLandUse?.other),
          boundaryDescription:      a(nbhd.boundaryDescription),
          neighborhoodDescription:  a(nbhd.neighborhoodDescription),
          marketConditionsNotes:    a(nbhd.marketConditionsNotes),
          // Location checkboxes
          isUrban:    nbhd.locationType === 'Urban',
          isSuburban: nbhd.locationType === 'Suburban',
          isRural:    nbhd.locationType === 'Rural',
          // Property values checkboxes
          isIncreasing: nbhd.propertyValues === 'Increasing',
          isStable:     nbhd.propertyValues === 'Stable',
          isDeclining:  nbhd.propertyValues === 'Declining',
          // Built-up checkboxes (UAD v2)
          isOver75:    nbhd.builtUp === 'Over 75%',
          is25to75:    nbhd.builtUp === '25-75%',
          isUnder25:   nbhd.builtUp === 'Under 25%',
          // Growth checkboxes
          isRapid:       nbhd.growth === 'Rapid',
          isGrowthStable: nbhd.growth === 'Stable',
          isSlow:        nbhd.growth === 'Slow',
        }
      : null;

    // ── Subject context ───────────────────────────────────────────────────────
    const subjectCtx = {
      streetAddress:        a(addr?.streetAddress),
      city:                 a(addr?.city),
      state:                a(addr?.state),
      zipCode:              a(addr?.zipCode),
      county:               a(addr?.county),
      fullAddress:          addr
        ? `${a(addr.streetAddress)}, ${a(addr.city)}, ${a(addr.state)} ${a(addr.zipCode)}`
        : '',
      parcelNumber:         a(subject?.parcelNumber),
      censusTract:          a(subject?.censusTract),
      mapReference:         a(subject?.mapReference),
      currentOwner:         a(subject?.currentOwner),
      occupant:             a(subject?.occupant),
      legalDescription:     a(subject?.legalDescription),
      zoning:               a(subject?.zoning),
      zoningCompliance:     a(subject?.zoningCompliance),
      highestAndBestUse:    a(subject?.highestAndBestUse),
      zoningDescription:    a(subject?.zoningDescription),
      floodZone:            a(subject?.floodZone),
      floodMapNumber:       a(subject?.floodMapNumber),
      floodMapDate:         shortDate(subject?.floodMapDate),
      lotSizeSqFt:          num(subject?.lotSizeSqFt),
      siteDimensions:       a(subject?.siteDimensions),
      siteShape:            a(subject?.siteShape),
      siteAreaUnit:         a(subject?.siteAreaUnit),
      utilities: utilities
        ? {
            electricity: a(utilities.electricity),
            gas:         a(utilities.gas),
            water:       a(utilities.water),
            sewer:       a(utilities.sewer),
          }
        : null,
      taxYear:              num(subject?.taxYear),
      annualTaxes:          currency(subject?.annualTaxes),
      isSubjectPurchase:    m.isSubjectPurchase,
      contractPrice:        currency(contract?.contractPrice ?? m.contractPrice),
      contractDate:         shortDate(contract?.contractDate ?? m.contractDate),
      propertyRightsAppraised: a(contract?.propertyRightsAppraised),
      financingConcessions: a(contract?.financingConcessions),
      propertyType:         a(subject?.propertyType),
      yearBuilt:            num(subject?.yearBuilt),
      effectiveAge:         num(subject?.effectiveAge),
      grossLivingArea:      num(subject?.grossLivingArea),
      totalRooms:           num(subject?.totalRooms),
      bedrooms:             num(subject?.bedrooms),
      bathrooms:            num(subject?.bathrooms, 1),
      stories:              num(subject?.stories, 1),
      design:               a(subject?.design),
      quality:              a(subject?.quality),
      condition:            a(subject?.condition),
      conditionDescription: a(subject?.conditionDescription),
      foundationType:       a(subject?.foundationType),
      exteriorWalls:        a(subject?.exteriorWalls),
      roofSurface:          a(subject?.roofSurface),
      basement:             a(subject?.basement),
      basementSqFt:         num(subject?.basementSqFt),
      basementFinishedSqFt: num(subject?.basementFinishedSqFt),
      heating:              a(subject?.heating),
      heatingFuel:          a(subject?.heatingFuel),
      cooling:              a(subject?.cooling),
      fireplaces:           num(subject?.fireplaces),
      garageType:           a(subject?.garageType),
      garageSpaces:         num(subject?.garageSpaces),
      carportSpaces:        num(subject?.carportSpaces),
      porchPatioDeck:       a(subject?.porchPatioDeck),
      pool:                 subject?.pool ? 'Yes' : 'No',
      attic:                a(subject?.attic),
      drivewaySurface:      a(subject?.drivewaySurface),
      interiorFloors:       a(subject?.interiorFloors),
      interiorWalls:        a(subject?.interiorWalls),
      trimFinish:           a(subject?.trimFinish),
      bathFloor:            a(subject?.bathFloor),
      bathWainscot:         a(subject?.bathWainscot),
      windowType:           a(subject?.windowType),
      stormWindows:         a(subject?.stormWindows),
      screens:              a(subject?.screens),
      gutters:              a(subject?.gutters),
      view:                 a(subject?.view),
      viewDescription:      a(subject?.viewDescription),
      locationRating:       a(subject?.locationRating),
      additionalFeatures:   a(subject?.additionalFeatures),
      hpiTrend:             a(subject?.hpiTrend),
    };

    // ── Report metadata context ───────────────────────────────────────────────
    const metaCtx = {
      orderId:               m.orderId,
      orderNumber:           a(m.orderNumber),
      borrowerName:          a(m.borrowerName),
      ownerOfPublicRecord:   a(m.ownerOfPublicRecord),
      clientName:            a(m.clientName),
      clientCompanyName:     a(m.clientCompanyName),
      clientAddress:         a(m.clientAddress),
      clientEmail:           a(m.clientEmail),
      loanNumber:            a(m.loanNumber),
      effectiveDate:         formatDate(m.effectiveDate),
      effectiveDateShort:    shortDate(m.effectiveDate),
      inspectionDate:        formatDate(m.inspectionDate),
      inspectionDateShort:   shortDate(m.inspectionDate),
      subjectPriorSaleDate1:  shortDate(m.subjectPriorSaleDate1),
      subjectPriorSalePrice1: currency(m.subjectPriorSalePrice1),
      subjectPriorSaleDate2:  shortDate(m.subjectPriorSaleDate2),
      subjectPriorSalePrice2: currency(m.subjectPriorSalePrice2),
      axiomEvaluationId:      a(m.axiomEvaluationId),
      axiomCompletedAt:       formatDate(m.axiomCompletedAt),
      hasAxiomRef:            !!m.axiomEvaluationId,
    };

    // ── H&BU context (UAD 3.6 — 4-test framework) ──────────────────────────────
    const hbuRaw: HighestAndBestUse | null | undefined = subject?.highestAndBestUseAnalysis;
    const buildTestCtx = (t: { passed: boolean; narrative: string | null; supportingEvidence?: string | null } | null | undefined) =>
      t ? { passed: t.passed, narrative: a(t.narrative), evidence: a(t.supportingEvidence) } : { passed: false, narrative: '', evidence: '' };
    const hbuCtx = hbuRaw
      ? {
          asVacant: {
            legallyPermissible:  buildTestCtx(hbuRaw.asVacant.legallyPermissible),
            physicallyPossible:  buildTestCtx(hbuRaw.asVacant.physicallyPossible),
            financiallyFeasible: buildTestCtx(hbuRaw.asVacant.financiallyFeasible),
            maximallyProductive: buildTestCtx(hbuRaw.asVacant.maximallyProductive),
          },
          asImproved: {
            legallyPermissible:  buildTestCtx(hbuRaw.asImproved.legallyPermissible),
            physicallyPossible:  buildTestCtx(hbuRaw.asImproved.physicallyPossible),
            financiallyFeasible: buildTestCtx(hbuRaw.asImproved.financiallyFeasible),
            maximallyProductive: buildTestCtx(hbuRaw.asImproved.maximallyProductive),
          },
          conclusion:        a(hbuRaw.conclusion),
          currentUseIsHbu:   hbuRaw.currentUseIsHbu,
          alternativeUse:    a(hbuRaw.alternativeUse),
        }
      : null;

    // ── Multi-value-type context (UAD 3.6) ────────────────────────────────────
    const vtMap: Partial<Record<ValueType, string>> = doc.effectiveDates ?? {};
    const valueTypesBlock = (doc.valueTypes ?? [])
      .map((vt: ValueType) => ({
        valueType:     vt.replace(/_/g, ' '),
        vtClass:       vt.startsWith('PROSPECTIVE') ? 'prospective' : vt === 'RETROSPECTIVE' ? 'retrospective' : '',
        effectiveDate: shortDate(vtMap[vt] ?? null),
        indicatedValue: vt === 'AS_IS' && reconcCtx ? (reconcCtx as Record<string, unknown>).finalOpinionOfValue as string : '',
        notes:         '',
      }));

    // ── EA / HC context (UAD 3.6) ─────────────────────────────────────────────
    const eaList: string[] = reconciliation?.extraordinaryAssumptions?.filter((s): s is string => !!s) ?? [];
    const hcList: string[] = reconciliation?.hypotheticalConditions?.filter((s): s is string => !!s) ?? [];

    // ── Final context object ──────────────────────────────────────────────────
    return {
      reportId:            doc.reportId,
      reportType:          doc.reportType,
      schemaVersion:       doc.schemaVersion,
      metadata:            metaCtx,
      subject:             subjectCtx,
      market:              marketCtx,
      primaryComps,
      secondaryComps,
      costApproach:        costCtx,
      incomeApproach:      incomeCtx,
      reconciliation:      reconcCtx,
      appraiser:           appraiserCtx,
      photos,
      priorSalesAnalysisLines,
      // H&BU
      hbu:                 hbuCtx,
      hasHbu:              !!hbuCtx,
      // Multi-value-type
      valueTypesBlock,
      hasMultipleValueTypes: valueTypesBlock.length > 1,
      // EA / HC
      extraordinaryAssumptions: eaList.length > 0 ? eaList : null,
      hypotheticalConditions:   hcList.length > 0 ? hcList : null,
      hasEA:               eaList.length > 0,
      hasHC:               hcList.length > 0,
      // Cost / Income flags
      hasCostApproach:     !!costCtx,
      hasIncomeApproach:   !!incomeCtx,
      hasCostDepreciationBreakdown,
      hasRentComps:        ((incomeCtx as { rentComps?: unknown[] } | null)?.rentComps?.length ?? 0) > 0,
      hasSecondaryComps:   secondaryComps.some(c => !(c as { empty?: boolean }).empty),
      generatedAt:         new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      }),

      // ── Capability-5: AI insights + enrichment ────────────────────
      aiInsights:      buildAiInsightsContext(doc),
      enrichmentData:  buildEnrichmentContext(doc),
      sourceDocuments: buildSourceDocumentsContext(doc),
    };
  }
}
