/**
 * Urar1025Mapper
 *
 * Field mapper for the Small Residential Income Property Appraisal Report
 * (Form 1025 / Multi-Family 2–4 units).
 *
 * Extends Urar1004Mapper with income approach and rental schedule sections:
 *   rentalSchedule — per-unit rent schedule from CanonicalRentalInformation
 *   incomeApproach — full GRM / direct-cap build-up from CanonicalIncomeApproach
 *   rentComps      — market-rent comparable rentals
 *
 * The base urar-1004 context (subject, comps, reconciliation, cost approach …)
 * is preserved unchanged; 1025-specific keys are merged on top.
 */

import { IFieldMapper } from './field-mapper.interface';
import {
  CanonicalReportDocument,
  CanonicalRentComp,
  CanonicalUnitRentalInfo,
} from '@l1/shared-types';
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

// ── Unit rental schedule builder ─────────────────────────────────────────────

function buildUnitRentalContext(unit: CanonicalUnitRentalInfo) {
  return {
    unitIdentifier:    a(unit.unitIdentifier),
    currentlyRented:   boolYesNo(unit.currentlyRented),
    occupancy:         a(unit.occupancy),
    monthlyRent:       currency(unit.monthlyRent),
    monthlyRentRaw:    unit.monthlyRent,
    monthToMonth:      boolYesNo(unit.monthToMonth),
    leaseStart:        a(unit.leaseStart),
    rentControl:       boolYesNo(unit.rentControl),
    rentConcessions:   a(unit.rentConcessions),
    utilitiesIncluded: a(unit.utilitiesIncluded),
    furnished:         boolYesNo(unit.furnished),
  };
}

// ── Rent-comp builder ─────────────────────────────────────────────────────────

function buildRentCompContext(comp: CanonicalRentComp, index: number) {
  return {
    label:               `Comparable Rental ${index + 1}`,
    address:             a(comp.address),
    proximityToSubject:  a(comp.proximityToSubject),
    monthlyRent:         currency(comp.monthlyRent),
    monthlyRentRaw:      comp.monthlyRent,
    adjustedRent:        comp.adjustedRent != null ? currency(comp.adjustedRent) : '',
    dataSource:          a(comp.dataSource),
    propertyDescription: a(comp.propertyDescription),
  };
}

// ── Urar1025Mapper ────────────────────────────────────────────────────────────

export class Urar1025Mapper implements IFieldMapper {
  readonly mapperKey = 'urar-1025';

  mapToFieldMap(doc: CanonicalReportDocument): Record<string, unknown> {
    // Inherit all URAR-1004 context (subject, comps, reconciliation, etc.)
    const base = _base.mapToFieldMap(doc);

    const income  = doc.incomeApproach ?? null;
    const rental  = doc.rentalInformation ?? null;

    // ── Per-unit rental schedule ──────────────────────────────────────────────
    const rentSchedule = (rental?.rentSchedule ?? []).map(buildUnitRentalContext);

    const totalMonthlyRentRaw = rental?.rentSchedule.reduce(
      (sum, u) => sum + (u.monthlyRent ?? 0),
      0,
    ) ?? 0;

    // ── Rent comparables ─────────────────────────────────────────────────────
    const rentComps = (income?.rentComps ?? []).slice(0, 5).map(buildRentCompContext);

    // ── Income approach context ───────────────────────────────────────────────
    const incomeCtx = income
      ? {
          estimatedMonthlyMarketRent:    currency(income.estimatedMonthlyMarketRent),
          estimatedMonthlyMarketRentRaw: income.estimatedMonthlyMarketRent,
          grossRentMultiplier:           num(income.grossRentMultiplier, 2),
          grossRentMultiplierRaw:        income.grossRentMultiplier,

          // Direct capitalization build-up
          potentialGrossIncome:          currency(income.potentialGrossIncome),
          vacancyRate:                   pct(
                                           income.vacancyRate != null
                                             ? income.vacancyRate * 100
                                             : null,
                                         ),
          effectiveGrossIncome:          currency(income.effectiveGrossIncome),
          operatingExpenses:             currency(income.operatingExpenses),
          replacementReserves:           currency(income.replacementReserves),
          netOperatingIncome:            currency(income.netOperatingIncome),
          capRate:                       pct(
                                           income.capRate != null
                                             ? income.capRate * 100
                                             : null,
                                         ),
          capRateSource:                 a(income.capRateSource),

          indicatedValueByIncomeApproach: currency(income.indicatedValueByIncomeApproach),
          indicatedValueByIncomeApproachRaw: income.indicatedValueByIncomeApproach,
          comments:                       a(income.comments),
        }
      : null;

    return {
      ...base,

      // Rental schedule
      rentalSchedule:        rentSchedule,
      hasRentalSchedule:     rentSchedule.length > 0,
      totalMonthlyRent:      currency(totalMonthlyRentRaw),
      totalMonthlyRentRaw,
      rentalAnalysisCommentary: a(rental?.rentalAnalysisCommentary),

      // Income approach
      incomeApproach:        incomeCtx,
      hasIncomeApproach:     !!incomeCtx,

      // Market-rent comps
      rentComps,
      hasRentComps:          rentComps.length > 0,
    };
  }
}
