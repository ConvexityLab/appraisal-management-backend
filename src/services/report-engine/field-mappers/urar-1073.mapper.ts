/**
 * Urar1073Mapper
 *
 * Field mapper for the Individual Condominium Unit Appraisal Report (Form 1073).
 * Extends Urar1004Mapper with condo-project and HOA sections that are only
 * applicable to CanonicalReportDocuments with propertyType === 'Condo'.
 *
 * Extra context keys added on top of the urar-1004 base:
 *   condo   — CanonicalCondoDetail fields (project name, unit counts, litigation …)
 *   hoa     — CanonicalHoaDetail fields (fees, frequency, inclusions …)
 */

import { IFieldMapper } from './field-mapper.interface';
import { CanonicalReportDocument } from '@l1/shared-types';
import { Urar1004Mapper } from './urar-1004.mapper';

const a = (s: string | null | undefined): string => s ?? '';

const currency = (v: number | null | undefined): string =>
  v != null
    ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : '';

const num = (v: number | null | undefined, digits = 0): string =>
  v != null ? v.toFixed(digits) : '';

const pct = (v: number | null | undefined, digits = 1): string =>
  v != null ? `${v.toFixed(digits)}%` : '';

const boolYesNo = (v: boolean | null | undefined): string =>
  v == null ? '' : v ? 'Yes' : 'No';

// ── Base mapper (shared with SFR urar-1004) ───────────────────────────────────

const _base = new Urar1004Mapper();

// ── Urar1073Mapper ────────────────────────────────────────────────────────────

export class Urar1073Mapper implements IFieldMapper {
  readonly mapperKey = 'urar-1073';

  mapToFieldMap(doc: CanonicalReportDocument): Record<string, unknown> {
    // Inherit all URAR-1004 context (subject, comps, reconciliation, etc.)
    const base = _base.mapToFieldMap(doc);

    const condo = doc.subject?.condoDetail ?? null;
    const hoa   = doc.subject?.hoaDetail   ?? null;

    // ── Condo project section ─────────────────────────────────────────────────
    const condoCtx = condo
      ? {
          projectName:                  a(condo.projectName),
          projectType:                  a(condo.projectType),
          totalUnits:                   num(condo.totalUnits),
          unitsSold:                    num(condo.unitsSold),
          unitsForSale:                 num(condo.unitsForSale),
          unitsRented:                  num(condo.unitsRented),
          ownerOccupancyPct:            pct(condo.ownerOccupancyPct),
          isPhased:                     boolYesNo(condo.isPhased),
          commonElementsComplete:       boolYesNo(condo.commonElementsComplete),
          pendingLitigation:            boolYesNo(condo.pendingLitigation),
          pendingLitigationDetails:     a(condo.pendingLitigationDetails),
          specialAssessment:            currency(condo.specialAssessment),
          specialAssessmentDetails:     a(condo.specialAssessmentDetails),
          developerControlled:          boolYesNo(condo.developerControlled),
          unitFloorLevel:               num(condo.unitFloorLevel),
          buildingTotalFloors:          num(condo.buildingTotalFloors),
          comments:                     a(condo.comments),
          // Phase 7B-6 expansion
          projectInfoDataSource:        a(condo.projectInfoDataSource),
          projectComplete:              boolYesNo(condo.projectComplete),
          buildingComplete:             boolYesNo(condo.buildingComplete),
          convertedInPast3Years:        boolYesNo(condo.convertedInPast3Years),
          yearConverted:                condo.yearConverted != null ? String(condo.yearConverted) : '',
          observedDeficiencies:         boolYesNo(condo.observedDeficiencies),
          observedDeficienciesDesc:     a(condo.observedDeficienciesDescription),
          nonResidentialUsePct:         pct(condo.nonResidentialUsePct),
          commercialUseDescription:     a(condo.commercialUseDescription),
          singleEntityOwnedCount:       num(condo.singleEntityOwnedCount),
          singleEntityOwnershipPct:     pct(condo.singleEntityOwnershipPct),
          isHotelMotel:                 boolYesNo(condo.isHotelMotel),
          isTimeshare:                  boolYesNo(condo.isTimeshare),
          hasIncomeRestrictions:        boolYesNo(condo.hasIncomeRestrictions),
          ageRestrictedCommunity:       boolYesNo(condo.ageRestrictedCommunity),
          groundRent:                   boolYesNo(condo.groundRent),
          groundRentAmount:             currency(condo.groundRentAmount),
        }
      : null;

    // ── HOA section ──────────────────────────────────────────────────────────
    const hoaCtx = hoa
      ? {
          hoaName:                      a(hoa.hoaName),
          hoaFee:                       currency(hoa.hoaFee),
          hoaFrequency:                 a(hoa.hoaFrequency),
          hoaIncludes:                  a(hoa.hoaIncludes),
          specialAssessmentAmount:      currency(hoa.specialAssessmentAmount),
          managementCompany:            a(hoa.managementCompany),
          mandatoryFees:                currency(hoa.mandatoryFees),
          mandatoryFeeDescription:      a(hoa.mandatoryFeeDescription),
          utilitiesIncluded:            a(hoa.utilitiesIncluded),
          hoaContactPhone:              a(hoa.hoaContactPhone),
          reserveFundBalance:           currency(hoa.reserveFundBalance),
          reserveFundAdequacy:          a(hoa.reserveFundAdequacy),
          annualBudgetAmount:           currency(hoa.annualBudgetAmount),
          reserveAllocationPct:         pct(hoa.reserveAllocationPct),
          delinquentDues60Day:          num(hoa.delinquentDues60Day),
          delinquentDuesPct:            pct(hoa.delinquentDuesPct),
          masterInsurancePremium:       currency(hoa.masterInsurancePremium),
          masterInsuranceCoverage:      a(hoa.masterInsuranceCoverage),
          fidelityBondCoverage:         currency(hoa.fidelityBondCoverage),
        }
      : null;

    return {
      ...base,
      condo:      condoCtx,
      hasCondo:   !!condoCtx,
      hoa:        hoaCtx,
      hasHoa:     !!hoaCtx,
    };
  }
}
