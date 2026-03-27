/**
 * DvrNooDesktopMapper
 *
 * Maps a CanonicalReportDocument to the Handlebars context for the
 * DVR Non-Owner Occupied Desktop Review form (dvr-noo-desktop-v1.hbs).
 *
 * Identical field set to DvrNooReviewMapper — same appraisal review fields,
 * different visual template (URAR v2 navy/gold design system).
 *
 * Reviewer-entered fields (originalAppraisalValue, originalAppraisalDate,
 * originalFormType, appraisalGrade, adminQ1–adminQ6, comments, loanPurpose)
 * default to empty / false and are populated via field overrides in the
 * Generate Report panel.
 */

import { IFieldMapper } from './field-mapper.interface';
import { CanonicalReportDocument } from '../../../types/canonical-schema';

// ── Formatting helpers ──────────────────────────────────────────────────────

const fmt = (val: number | null | undefined): string =>
  val == null
    ? ''
    : val.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const fmtPct = (val: number | null | undefined): string =>
  val == null ? '' : `${val.toFixed(1)}%`;

const a = (s: string | null | undefined): string => s ?? '';

// ── Mapper ──────────────────────────────────────────────────────────────────

export class DvrNooDesktopMapper implements IFieldMapper {
  readonly mapperKey = 'dvr-noo-desktop';

  mapToFieldMap(doc: CanonicalReportDocument): Record<string, unknown> {
    const s    = doc.subject;
    const addr = s?.address;
    const mkt  = s?.neighborhood;
    const val  = doc.valuation;
    const ai   = doc.appraiserInfo;
    const meta = doc.metadata;

    // ── Property photo ────────────────────────────────────────────────────
    const photos       = doc.photos ?? [];
    const subjectPhoto = photos.find(p => p.photoType === 'SUBJECT_FRONT') ?? null;

    // ── Review value = our canonical valuation opinion ────────────────────
    const reviewValue = val?.estimatedValue;

    // ── Prior sale data ───────────────────────────────────────────────────
    const priorSalesPrice = meta.subjectPriorSalePrice1;
    const priorSaleDate   = a(meta.subjectPriorSaleDate1);

    // ── Variance: computable only when both values present ────────────────
    // originalAppraisalValue is supplied by reviewer via field overrides.
    const variancePct =
      val?.estimatedValue && val.lowerBound && val.upperBound
        ? fmtPct(
            Math.abs((val.estimatedValue - val.lowerBound) / val.lowerBound) * 100,
          )
        : '';

    // ── Lot size: canonical stores sq ft; this form uses acres ───────────
    const lotSizeAcres =
      s?.lotSizeSqFt != null ? (s.lotSizeSqFt / 43560).toFixed(2) : '';

    return {
      // ── Metadata ─────────────────────────────────────────────────────
      reportDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      }),
      metadata: {
        orderId:     a(meta.orderId),
        orderNumber: a(meta.orderNumber),
        loanNumber:  a(meta.loanNumber),
      },

      // ── Original appraisal (filled by reviewer via field overrides) ──
      originalAppraisalValue: '',
      originalAppraisalDate:  '',
      originalFormType:       '',

      // ── Review opinion ───────────────────────────────────────────────
      reviewValue:  reviewValue != null ? fmt(reviewValue) : '',
      reviewDate:   a(meta.effectiveDate),
      variancePct,

      // ── Appraisal grade (sourced from metadata, set by reviewer) ────
      appraisalGrade: doc.metadata.appraisalGrade ?? '',
      gradeIsA: doc.metadata.appraisalGrade === 'A',
      gradeIsB: doc.metadata.appraisalGrade === 'B',
      gradeIsC: doc.metadata.appraisalGrade === 'C',
      gradeIsD: doc.metadata.appraisalGrade === 'D',

      // ── Additional analysis flag (set by reviewer) ───────────────────
      additionalAnalysisYes: false,

      // ── Property details ─────────────────────────────────────────────
      loanId:        a(meta.loanNumber),
      streetAddress: a(addr?.streetAddress),
      city:          a(addr?.city),
      state:         a(addr?.state),
      zipCode:       a(addr?.zipCode),

      // ── Loan purpose / prior sale ────────────────────────────────────
      loanPurpose:    '',
      priorSalesPrice: priorSalesPrice != null ? fmt(priorSalesPrice) : '',
      priorSaleDate,

      // ── Property stats ───────────────────────────────────────────────
      propertyType: a(s?.propertyType),
      condition:    a(s?.condition),
      units:        '1',
      yearBuilt:    s?.yearBuilt?.toString() ?? '',
      lotSizeAcres,
      rooms:        s?.totalRooms?.toString() ?? '',
      bedrooms:     s?.bedrooms?.toString() ?? '',
      bathrooms:    s?.bathsFull != null
        ? (s.bathsFull + (s.bathsHalf ?? 0) * 0.5).toFixed(1)
        : s?.bathrooms?.toString() ?? '',

      // ── Neighborhood ─────────────────────────────────────────────────
      locationType:   a(mkt?.locationType),
      propertyValues: a(mkt?.propertyValues),
      demandSupply:   a(mkt?.demandSupply),
      marketingTime:  a(mkt?.marketingTime),
      quality:        a(s?.quality),

      // ── Admin review questions (set by reviewer via field overrides) ─
      adminQ1: false,
      adminQ2: false,
      adminQ3: false,
      adminQ4: false,
      adminQ5: false,
      adminQ6: false,

      // ── Comments (set by reviewer via field overrides) ───────────────
      comments: '',

      // ── Subject photo ────────────────────────────────────────────────
      subjectPhoto,

      // ── Reviewer info ────────────────────────────────────────────────
      reviewerName:              a(ai?.name),
      reviewerLicenseNumber:     a(ai?.licenseNumber),
      reviewerLicenseState:      a(ai?.licenseState),
      reviewerLicenseExpiration: a(ai?.licenseExpirationDate),
      reviewerSignatureLine:     '',
    };
  }
}
