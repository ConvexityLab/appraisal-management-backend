import { describe, it, expect, vi } from 'vitest';
import { MopMapperService } from './MopMapperService';
import { CanonicalReportDocument } from '../../types/canonical-schema';

describe('MopMapperService', () => {
    it('should correctly map canonical appraisal to MOP facts', () => {
        const service = new MopMapperService();
        
        const mockAppraisal: Partial<CanonicalReportDocument> = {
            subjectProperty: {
                conditionRating: 'C6',
                zoningClassification: 'Commercial'
            } as any,
            salesComparisonApproach: {
                comparables: [
                    { netAdjustmentPercentage: 10, grossAdjustmentPercentage: 20 },
                    { netAdjustmentPercentage: 16, grossAdjustmentPercentage: 26 },
                ]
            } as any,
            effectiveDates: ['2026-03-10'],
            appraiser: {} as any // missing license number
        };

        const facts = service.mapAppraisalToMopFacts(mockAppraisal as CanonicalReportDocument);

        expect(facts.program).toBe('appraisal-compliance');
        expect(facts.zoning).toBe('Commercial');
        expect(facts.property_condition).toBe('C6');
        expect(facts.net_adjustment_pct).toBe(16);
        expect(facts.gross_adjustment_pct).toBe(26);
        expect(facts.has_effective_date).toBe(true);
        expect(facts.has_license_number).toBe(false);
    });

    it('should map missing/empty payload safely', () => {
        const service = new MopMapperService();
        const mockAppraisal: Partial<CanonicalReportDocument> = {};
        const facts = service.mapAppraisalToMopFacts(mockAppraisal as CanonicalReportDocument);

        expect(facts.zoning).toBe('Unknown');
        expect(facts.property_condition).toBe('Unknown');
        expect(facts.net_adjustment_pct).toBe(0);
        expect(facts.gross_adjustment_pct).toBe(0);
        expect(facts.has_effective_date).toBe(false);
        expect(facts.has_license_number).toBe(false);
    });
});
