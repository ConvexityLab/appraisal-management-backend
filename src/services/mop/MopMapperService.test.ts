import { describe, it, expect, vi } from 'vitest';
import { MopMapperService } from './MopMapperService';
import { CanonicalReportDocument } from '@l1/shared-types';

describe('MopMapperService', () => {
    it('should correctly map canonical appraisal to MOP facts', () => {
        const service = new MopMapperService();
        
        const mockAppraisal: Partial<CanonicalReportDocument> = {
            subject: {
                condition: 'C6',
                zoning: 'Commercial'
            } as any,
            comps: [
                { adjustments: { netAdjustmentPct: 10, grossAdjustmentPct: 20 } },
                { adjustments: { netAdjustmentPct: 16, grossAdjustmentPct: 26 } },
            ] as any,
            metadata: { effectiveDate: '2026-03-10' } as any,
            appraiserInfo: {} as any // missing license number
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
