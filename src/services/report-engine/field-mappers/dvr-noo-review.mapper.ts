/**
 * DvrNooReviewMapper
 *
 * Maps a CanonicalReportDocument to the Handlebars context for the
 * DVR Non-Owner Occupied Review form (dvr-noo-review-v1.hbs).
 *
 * This is an APPRAISAL REVIEW form — the reviewer is evaluating a third-party
 * appraiser's value conclusion, not producing a new valuation from scratch.
 *
 * Context fields that are not present in the canonical schema
 * (originalAppraisalValue, originalAppraisalDate, originalFormType,
 * appraisalGrade, adminQ1–adminQ6, comments, loanPurpose) will be
 * empty strings / false by default. They are intended to be populated
 * by the reviewer via field overrides in the Generate Report panel.
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

export class DvrNooReviewMapper implements IFieldMapper {
  readonly mapperKey = 'dvr-noo-review';

  mapToFieldMap(doc: CanonicalReportDocument): Record<string, unknown> {
    const s     = doc.subject;
    const addr  = s?.address;
    const mkt   = s?.neighborhood;
    const val   = doc.valuation;
    const ai    = doc.appraiserInfo;
    const meta  = doc.metadata;

    // ── Property photo (subject front from MLS / public record) ──────────
    const photos     = doc.photos ?? [];
    const subjectPhoto = photos.find(p => p.photoType === 'SUBJECT_FRONT') ?? null;

    // ── Review value = our opinion from canonical valuation ──────────────
    const reviewValue = val?.estimatedValue;

    // ── Prior sale data ──────────────────────────────────────────────────
    const priorSalesPrice = meta.subjectPriorSalePrice1;
    const priorSaleDate   = a(meta.subjectPriorSaleDate1);

    // ── Variance calculation — only computable if both values known ───────
    // originalAppraisalValue is not stored in canonical; it would be
    // supplied by the reviewer via field overrides. Default to empty.
    const variancePct = (val?.estimatedValue && val.lowerBound && val.upperBound)
      ? fmtPct(
          Math.abs((val.estimatedValue - val.lowerBound) / val.lowerBound) * 100,
        )
      : '';

    // ── Lot size: canonical stores sq ft; convert to acres for this form ─
    const lotSizeAcres =
      s?.lotSizeSqFt != null
        ? (s.lotSizeSqFt / 43560).toFixed(2)
        : '';

    return {
      // ── Metadata ──────────────────────────────────────────────────────
      reportDate:    new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      metadata: {
        orderId:     a(meta.orderId),
        orderNumber: a(meta.orderNumber),
        loanNumber:  a(meta.loanNumber),
      },

      // ── Original appraisal (filled by reviewer via field overrides) ───
      originalAppraisalValue: '',
      originalAppraisalDate:  '',
      originalFormType:       '',

      // ── Review value (our canonical opinion) ──────────────────────────
      reviewValue: reviewValue != null ? fmt(reviewValue) : '',
      reviewDate:  a(meta.effectiveDate),
      variancePct,

      // ── Appraisal grade (set by reviewer via field overrides) ─────────
      // Grade is A / B / C / D; template uses gradeIsA/B/C/D booleans.
      appraisalGrade: doc.metadata.appraisalGrade ?? '',
      gradeIsA: doc.metadata.appraisalGrade === 'A',
      gradeIsB: doc.metadata.appraisalGrade === 'B',
      gradeIsC: doc.metadata.appraisalGrade === 'C',
      gradeIsD: doc.metadata.appraisalGrade === 'D',

      // ── Additional analysis flag (set by reviewer) ────────────────────
      additionalAnalysisYes: false,

      // ── Property details ──────────────────────────────────────────────
      loanId:        a(meta.loanNumber),
      streetAddress: a(addr?.streetAddress),
      city:          a(addr?.city),
      state:         a(addr?.state),
      zipCode:       a(addr?.zipCode),

      // ── Loan purpose / prior sale ─────────────────────────────────────
      loanPurpose:     '',
      priorSalesPrice: priorSalesPrice != null ? fmt(priorSalesPrice) : '',
      priorSaleDate,

      // ── Property stats ────────────────────────────────────────────────
      propertyType: a(s?.propertyType),
      condition:    a(s?.condition),
      units:        '1',
      yearBuilt:    s?.yearBuilt?.toString() ?? '',
      lotSizeAcres,
      rooms:        s?.totalRooms?.toString() ?? '',
      bedrooms:     s?.bedrooms?.toString() ?? '',
      bathrooms:    s?.bathsFull != null
        ? (s.bathsFull + (s.bathsHalf ?? 0) * 0.5).toFixed(1)
        : s?.bathrooms?.toFixed(1) ?? '',

      // ── Neighborhood ──────────────────────────────────────────────────
      locationType:    a(mkt?.locationType),
      propertyValues:  a(mkt?.propertyValues),
      demandSupply:    a(mkt?.demandSupply),
      marketingTime:   a(mkt?.marketingTime),
      quality:         a(s?.quality),

      // ── Administrative review Q&A (set by reviewer via field overrides) ─
      adminQ1: false,
      adminQ2: false,
      adminQ3: false,
      adminQ4: false,
      adminQ5: false,
      adminQ6: false,

      // ── Comments (page 2 text box) ────────────────────────────────────
      comments: '',

      // ── Subject photo ─────────────────────────────────────────────────
      subjectPhoto,

      // ── Reviewer / appraiser info ─────────────────────────────────────
      reviewerName:             a(ai?.name),
      reviewerLicenseNumber:    a(ai?.licenseNumber),
      reviewerLicenseState:     a(ai?.licenseState),
      reviewerLicenseExpiration: a(ai?.licenseExpirationDate),
      reviewerSignatureLine:    '',   // signature is ink-signed on printed copy
    };
  }
}
