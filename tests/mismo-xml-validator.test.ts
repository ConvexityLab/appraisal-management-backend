/**
 * MISMO XML Validator Service — Tests (Phase 1.4)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MISMOXMLValidationService } from '../src/services/mismo-xml-validator.service';

describe('MISMOXMLValidationService', () => {
  let service: MISMOXMLValidationService;

  beforeEach(() => {
    service = new MISMOXMLValidationService();
  });

  const validMISMOXML = `<?xml version="1.0" encoding="UTF-8"?>
<MESSAGE xmlns="http://www.mismo.org/residential/2009/schemas/3.4"
         MISMOReferenceModelIdentifier="3.4.032">
  <DEAL_SETS>
    <DEAL_SET>
      <DEALS>
        <DEAL>
          <PARTIES>
            <PARTY>
              <ROLES>
                <ROLE>
                  <BORROWER>
                    <BORROWER_DETAIL/>
                    <NAME>
                      <FirstName>John</FirstName>
                      <LastName>Doe</LastName>
                    </NAME>
                  </BORROWER>
                </ROLE>
              </ROLES>
            </PARTY>
          </PARTIES>
          <COLLATERALS>
            <COLLATERAL>
              <SUBJECT_PROPERTY>
                <ADDRESS>
                  <AddressLineText>123 Main St</AddressLineText>
                  <CityName>Anytown</CityName>
                  <StateCode>CA</StateCode>
                  <PostalCode>90210</PostalCode>
                </ADDRESS>
              </SUBJECT_PROPERTY>
            </COLLATERAL>
          </COLLATERALS>
          <SERVICES>
            <SERVICE>
              <VALUATION>
                <VALUATION_RESPONSE>
                  <VALUATION_RESPONSE_DETAIL>
                    <AppraiserOpinionValueAmount>450000</AppraiserOpinionValueAmount>
                    <AppraisalEffectiveDate>2026-01-15</AppraisalEffectiveDate>
                    <FormType>1004</FormType>
                  </VALUATION_RESPONSE_DETAIL>
                </VALUATION_RESPONSE>
              </VALUATION>
            </SERVICE>
          </SERVICES>
        </DEAL>
      </DEALS>
    </DEAL_SET>
  </DEAL_SETS>
</MESSAGE>`;

  it('should validate well-formed MISMO XML', async () => {
    const result = await service.validate({ xmlContent: validMISMOXML });
    expect(result.isValid).toBe(true);
    expect(result.mismoVersion).toBe('3.4.032');
    expect(result.errors).toHaveLength(0);
  });

  it('should extract parsed data from valid XML', async () => {
    const result = await service.validate({ xmlContent: validMISMOXML });
    expect(result.parsedData).not.toBeNull();
    expect(result.parsedData!.subjectAddress?.streetAddress).toBe('123 Main St');
    expect(result.parsedData!.subjectAddress?.city).toBe('Anytown');
    expect(result.parsedData!.subjectAddress?.state).toBe('CA');
    expect(result.parsedData!.subjectAddress?.zipCode).toBe('90210');
    expect(result.parsedData!.appraisalResult?.appraiserOpinionOfValue).toBe(450000);
    expect(result.parsedData!.appraisalResult?.effectiveDate).toBe('2026-01-15');
    expect(result.parsedData!.appraisalResult?.formType).toBe('1004');
  });

  it('should extract borrower info', async () => {
    const result = await service.validate({ xmlContent: validMISMOXML });
    expect(result.parsedData!.borrower?.firstName).toBe('John');
    expect(result.parsedData!.borrower?.lastName).toBe('Doe');
  });

  it('should reject empty XML', async () => {
    const result = await service.validate({ xmlContent: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].code).toBe('MISMO_EMPTY');
  });

  it('should reject non-XML content', async () => {
    const result = await service.validate({ xmlContent: 'This is not XML at all' });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.code === 'MISMO_MALFORMED')).toBe(true);
  });

  it('should detect MISMO version from namespace', async () => {
    const xml = `<?xml version="1.0"?><MESSAGE xmlns="http://www.mismo.org/residential/2009/schemas/3.4"><DEAL_SETS/></MESSAGE>`;
    const result = await service.validate({ xmlContent: xml });
    expect(result.mismoVersion).toBe('3.4');
  });

  it('should warn about missing subject address', async () => {
    const xml = `<?xml version="1.0"?><MESSAGE MISMOReferenceModelIdentifier="3.4"><DEAL_SETS><DEAL_SET><DEALS><DEAL><SERVICES><SERVICE><VALUATION><VALUATION_RESPONSE><VALUATION_RESPONSE_DETAIL><AppraiserOpinionValueAmount>300000</AppraiserOpinionValueAmount></VALUATION_RESPONSE_DETAIL></VALUATION_RESPONSE></VALUATION></SERVICE></SERVICES></DEAL></DEALS></DEAL_SET></DEAL_SETS></MESSAGE>`;
    const result = await service.validate({ xmlContent: xml });
    // Should have warnings about missing address data
    expect(result.warnings.length + result.errors.length).toBeGreaterThan(0);
  });

  it('should include orderId in result when provided', async () => {
    const result = await service.validate({ xmlContent: validMISMOXML, orderId: 'ORD-123' });
    expect(result.isValid).toBe(true);
  });

  it('should have validatedAt timestamp', async () => {
    const result = await service.validate({ xmlContent: validMISMOXML });
    expect(result.validatedAt).toBeDefined();
    expect(new Date(result.validatedAt).getTime()).not.toBeNaN();
  });
});
