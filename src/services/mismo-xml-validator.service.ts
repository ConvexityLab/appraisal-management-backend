/**
 * MISMO XML Validation Service (Phase 1.4)
 *
 * Validates inbound MISMO 3.4 XML from vendor submissions.
 * Parses structured data and auto-populates canonical schema fields.
 * Returns structured validation errors for vendor resubmission.
 */

import { Logger } from '../utils/logger.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface MISMOValidationRequest {
  /** Raw XML string from vendor submission */
  xmlContent: string;
  /** Expected MISMO version (default: '3.4') */
  expectedVersion?: string;
  /** Order ID for context */
  orderId?: string;
}

export interface MISMOValidationError {
  code: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  path: string;
  message: string;
  expected?: string;
  actual?: string;
}

export interface MISMOParsedData {
  /** Subject property address */
  subjectAddress?: {
    streetAddress: string;
    city: string;
    state: string;
    zipCode: string;
    county?: string;
  };
  /** Borrower information */
  borrower?: {
    firstName: string;
    lastName: string;
  };
  /** Loan information */
  loan?: {
    loanAmount: number;
    loanType: string;
    loanPurpose: string;
  };
  /** Appraiser information */
  appraiser?: {
    name: string;
    licenseNumber: string;
    licenseState: string;
    companyName?: string;
  };
  /** Property details */
  property?: {
    propertyType: string;
    yearBuilt?: number;
    grossLivingArea?: number;
    lotSize?: number;
    bedrooms?: number;
    bathrooms?: number;
  };
  /** Appraisal result */
  appraisalResult?: {
    appraiserOpinionOfValue: number;
    effectiveDate: string;
    formType: string;
  };
  /** Comparables */
  comparables?: Array<{
    address: string;
    salePrice: number;
    saleDate: string;
    adjustedPrice: number;
  }>;
}

export interface MISMOValidationResult {
  isValid: boolean;
  errors: MISMOValidationError[];
  warnings: MISMOValidationError[];
  parsedData: MISMOParsedData | null;
  mismoVersion: string | null;
  validatedAt: string;
}

// ── Service ──────────────────────────────────────────────────────────────────

export class MISMOXMLValidationService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('MISMOXMLValidationService');
  }

  /**
   * Validate and parse inbound MISMO XML.
   */
  async validate(request: MISMOValidationRequest): Promise<MISMOValidationResult> {
    const validatedAt = new Date().toISOString();
    const errors: MISMOValidationError[] = [];
    const warnings: MISMOValidationError[] = [];
    const expectedVersion = request.expectedVersion ?? '3.4';

    try {
      const { xmlContent } = request;

      if (!xmlContent || xmlContent.trim().length === 0) {
        errors.push({
          code: 'MISMO_EMPTY',
          severity: 'ERROR',
          path: '/',
          message: 'XML content is empty',
        });
        return { isValid: false, errors, warnings, parsedData: null, mismoVersion: null, validatedAt };
      }

      // Basic XML well-formedness check
      if (!this.isWellFormedXML(xmlContent)) {
        errors.push({
          code: 'MISMO_MALFORMED',
          severity: 'ERROR',
          path: '/',
          message: 'XML is not well-formed. Check for unclosed tags, invalid characters, or encoding issues.',
        });
        return { isValid: false, errors, warnings, parsedData: null, mismoVersion: null, validatedAt };
      }

      // Check for MISMO root element
      const mismoVersion = this.extractMISMOVersion(xmlContent);
      if (!mismoVersion) {
        errors.push({
          code: 'MISMO_NO_ROOT',
          severity: 'ERROR',
          path: '/',
          message: 'No MISMO root element found. Expected <MESSAGE> or <MISMO> root with MISMO namespace.',
        });
        return { isValid: false, errors, warnings, parsedData: null, mismoVersion: null, validatedAt };
      }

      if (mismoVersion !== expectedVersion) {
        warnings.push({
          code: 'MISMO_VERSION_MISMATCH',
          severity: 'WARNING',
          path: '/MESSAGE/@MISMOReferenceModelIdentifier',
          message: `MISMO version mismatch`,
          expected: expectedVersion,
          actual: mismoVersion,
        });
      }

      // Parse and extract structured data
      const parsedData = this.parseStructuredData(xmlContent);

      // Validate required fields
      this.validateRequiredFields(parsedData, errors, warnings);

      const isValid = errors.length === 0;

      this.logger.info('MISMO XML validation completed', {
        orderId: request.orderId,
        isValid,
        errorCount: errors.length,
        warningCount: warnings.length,
        version: mismoVersion,
      });

      return {
        isValid,
        errors,
        warnings,
        parsedData,
        mismoVersion,
        validatedAt,
      };
    } catch (error) {
      this.logger.error('MISMO XML validation error', { error, orderId: request.orderId });
      errors.push({
        code: 'MISMO_INTERNAL_ERROR',
        severity: 'ERROR',
        path: '/',
        message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      return { isValid: false, errors, warnings, parsedData: null, mismoVersion: null, validatedAt };
    }
  }

  /**
   * Basic XML well-formedness check.
   * Uses regex heuristics since we don't want to pull in a full XML parser dependency.
   * For production XSD validation, consider xmllint or a streaming SAX parser.
   */
  private isWellFormedXML(xml: string): boolean {
    const trimmed = xml.trim();
    // Must start with XML declaration or root element
    if (!trimmed.startsWith('<?xml') && !trimmed.startsWith('<')) {
      return false;
    }
    // Basic balanced tag check (heuristic — not a full parser)
    const openTags = (trimmed.match(/<[a-zA-Z][^\/\?>]*[^\/]>/g) || []).length;
    const closeTags = (trimmed.match(/<\/[a-zA-Z][^>]*>/g) || []).length;
    const selfClosingTags = (trimmed.match(/<[a-zA-Z][^>]*\/>/g) || []).length;
    // Allow some tolerance for attributes and namespaces
    return Math.abs(openTags - selfClosingTags - closeTags) <= 2;
  }

  /**
   * Extract MISMO version from the XML namespace or attribute.
   */
  private extractMISMOVersion(xml: string): string | null {
    // Check for MISMOReferenceModelIdentifier attribute
    const versionMatch = xml.match(/MISMOReferenceModelIdentifier\s*=\s*["']([^"']+)["']/);
    if (versionMatch?.[1]) return versionMatch[1];

    // Check for MISMO namespace version
    const nsMatch = xml.match(/xmlns(?::mismo)?\s*=\s*["'].*mismo\.org.*?(\d+\.\d+).*?["']/i);
    if (nsMatch?.[1]) return nsMatch[1];

    // Check for generic MESSAGE element (MISMO standard root)
    if (xml.includes('<MESSAGE') || xml.includes('<MISMO')) {
      return '3.4'; // Assume 3.4 if MISMO structure present but no version
    }

    return null;
  }

  /**
   * Parse structured data from MISMO XML using regex extraction.
   * In production, use a proper XML parser (xmlbuilder2 or fast-xml-parser).
   */
  private parseStructuredData(xml: string): MISMOParsedData {
    const data: MISMOParsedData = {};

    // Subject address
    const streetMatch = xml.match(/<AddressLineText[^>]*>([^<]+)<\/AddressLineText>/);
    const cityMatch = xml.match(/<CityName[^>]*>([^<]+)<\/CityName>/);
    const stateMatch = xml.match(/<StateCode[^>]*>([^<]+)<\/StateCode>/);
    const zipMatch = xml.match(/<PostalCode[^>]*>([^<]+)<\/PostalCode>/);
    const countyMatch = xml.match(/<CountyName[^>]*>([^<]+)<\/CountyName>/);
    if (streetMatch || cityMatch || stateMatch || zipMatch) {
      const addr: MISMOParsedData['subjectAddress'] = {
        streetAddress: streetMatch?.[1] ?? '',
        city: cityMatch?.[1] ?? '',
        state: stateMatch?.[1] ?? '',
        zipCode: zipMatch?.[1] ?? '',
      };
      if (countyMatch?.[1]) addr!.county = countyMatch[1];
      data.subjectAddress = addr;
    }

    // Borrower
    const bFnMatch = xml.match(/<BORROWER[^>]*>[\s\S]*?<FirstName[^>]*>([^<]+)<\/FirstName>/);
    const bLnMatch = xml.match(/<BORROWER[^>]*>[\s\S]*?<LastName[^>]*>([^<]+)<\/LastName>/);
    if (bFnMatch || bLnMatch) {
      data.borrower = {
        firstName: bFnMatch?.[1] ?? '',
        lastName: bLnMatch?.[1] ?? '',
      };
    }

    // Appraiser opinion of value
    const valueMatch = xml.match(/<AppraiserOpinionValueAmount[^>]*>([^<]+)<\/AppraiserOpinionValueAmount>/);
    const effDateMatch = xml.match(/<AppraisalEffectiveDate[^>]*>([^<]+)<\/AppraisalEffectiveDate>/);
    const formMatch = xml.match(/<FormType[^>]*>([^<]+)<\/FormType>/);
    if (valueMatch) {
      data.appraisalResult = {
        appraiserOpinionOfValue: parseFloat(valueMatch[1] ?? '0') || 0,
        effectiveDate: effDateMatch?.[1] ?? '',
        formType: formMatch?.[1] ?? '',
      };
    }

    // Property details
    const yearBuiltMatch = xml.match(/<PropertyStructureBuiltYear[^>]*>([^<]+)<\/PropertyStructureBuiltYear>/);
    const glaMatch = xml.match(/<GrossLivingAreaSquareFeetCount[^>]*>([^<]+)<\/GrossLivingAreaSquareFeetCount>/);
    const bedroomMatch = xml.match(/<BedroomCount[^>]*>([^<]+)<\/BedroomCount>/);
    const bathroomMatch = xml.match(/<BathroomCount[^>]*>([^<]+)<\/BathroomCount>/);
    if (yearBuiltMatch || glaMatch) {
      const prop: NonNullable<MISMOParsedData['property']> = { propertyType: '' };
      if (yearBuiltMatch?.[1]) prop.yearBuilt = parseInt(yearBuiltMatch[1], 10);
      if (glaMatch?.[1]) prop.grossLivingArea = parseInt(glaMatch[1], 10);
      if (bedroomMatch?.[1]) prop.bedrooms = parseInt(bedroomMatch[1], 10);
      if (bathroomMatch?.[1]) prop.bathrooms = parseInt(bathroomMatch[1], 10);
      data.property = prop;
    }

    return data;
  }

  /**
   * Validate required fields are present in parsed data.
   */
  private validateRequiredFields(
    data: MISMOParsedData,
    errors: MISMOValidationError[],
    warnings: MISMOValidationError[],
  ): void {
    // Subject address is required
    if (!data.subjectAddress || !data.subjectAddress.streetAddress) {
      errors.push({
        code: 'MISMO_MISSING_ADDRESS',
        severity: 'ERROR',
        path: '/SUBJECT/ADDRESS',
        message: 'Subject property address is required',
      });
    }

    // State code required
    if (!data.subjectAddress?.state) {
      errors.push({
        code: 'MISMO_MISSING_STATE',
        severity: 'ERROR',
        path: '/SUBJECT/ADDRESS/StateCode',
        message: 'Subject property state code is required',
      });
    }

    // Appraiser opinion of value recommended
    if (!data.appraisalResult?.appraiserOpinionOfValue) {
      warnings.push({
        code: 'MISMO_MISSING_VALUE',
        severity: 'WARNING',
        path: '/APPRAISAL/AppraiserOpinionValueAmount',
        message: 'Appraiser opinion of value not found — may cause QC issues',
      });
    }

    // Effective date recommended
    if (!data.appraisalResult?.effectiveDate) {
      warnings.push({
        code: 'MISMO_MISSING_DATE',
        severity: 'WARNING',
        path: '/APPRAISAL/AppraisalEffectiveDate',
        message: 'Appraisal effective date not found',
      });
    }
  }
}
