/**
 * Completion Report XML Generator
 *
 * Generates UAD 3.6 / MISMO 3.4 compliant XML for a Completion Report
 * (Appendix B-3) for submission to Fannie Mae UCDP / Freddie Mac EAD.
 *
 * Entry point: generateCompletionReportXml(doc, submissionInfo)
 *
 * Architecture:
 *  - Accepts a CanonicalCompletionReport (from Cosmos `reporting` container)
 *  - Uses CompletionReportMapper to validate and produce a generation context
 *  - Builds MISMO XML via xmlbuilder2 (same library as MismoXmlGenerator)
 *  - Returns the XML string — callers upload it to Blob storage
 *
 * MISMO document structure (DocumentType = "Completion Report"):
 *   MESSAGE
 *   └─ DEAL_SETS / DEAL_SET / DEALS / DEAL
 *      ├─ COLLATERALS / COLLATERAL / PROPERTIES / PROPERTY  (Section 01)
 *      ├─ LOANS / LOAN  (submissionInfo + fees)
 *      ├─ PARTIES  (appraiser, supervisory appraiser, clients)
 *      ├─ RELATIONSHIPS  (INSPECTION→ROLE, SIGNATORY→ROLE)
 *      └─ SERVICES / SERVICE / VALUATION
 *         ├─ ABOUT_VERSIONS
 *         ├─ APPRAISAL  (Sections 02, 06, 08-assignment)
 *         ├─ VALUATION_COMPLETION_DETAIL  (Section 06 commentary)
 *         ├─ DEFECT[]  (Section 03 + Section 04 items with images)
 *         ├─ SUBJECT_TO_COMPLETION_ITEM[]  (Section 05 inconsistent features)
 *         └─ VALUATION_CERTIFICATIONS  (Section 09)
 *
 * @see docs/URAR_V1.3_COMPLIANCE_AUDIT.md § Appendix C
 * @see docs/samples/Appendix B-3 Completion Report Implementation Guide.txt
 */

import { create } from 'xmlbuilder2';
import type { XMLBuilder } from 'xmlbuilder2/lib/interfaces.js';
import { Logger } from '../utils/logger.js';
import {
  CanonicalCompletionReport,
  CrRepairItem,
  CrInconsistentFeature,
  CrContactParty,
  CrAppraiserAssignment,
  generateFinalValueConditionStatement,
} from '@l1/shared-types';
import {
  CompletionReportMapper,
  CompletionReportGenerationContext,
} from '../mappers/completion-report.mapper.js';
import type { SubmissionInfo } from './mismo-xml-generator.service.js';

// ─── Constants ─────────────────────────────────────────────────────────────────

const MISMO_NS        = 'http://www.mismo.org/residential/2009/schemas';
const MISMO_VERSION   = '3.4';
const UAD_VERSION     = '3.6';
const DOC_FORM_ID     = 'Completion Report';
const FORM_VERSION    = '1.0';           // Appendix B-3 form version
const FORM_ISSUER     = 'FannieMae';     // DocumentFormIssuingEntityNameType

// ArcroleType constants
const ARCROLE_INSPECTION_ROLE =
  'urn:fdc:mismo.org:2009:residential/INSPECTION_CompletedBy_ROLE';
const ARCROLE_SIGNATORY_ROLE =
  'urn:fdc:mismo.org:2009:residential/SIGNATORY_IsAssociatedWith_ROLE';

// ─── Generator ─────────────────────────────────────────────────────────────────

export class CompletionReportXmlGenerator {
  private readonly logger = new Logger('CompletionReportXmlGenerator');
  private readonly mapper = new CompletionReportMapper();

  /**
   * Generate MISMO 3.4 XML for a Completion Report.
   *
   * @param doc - Fully-loaded CanonicalCompletionReport from Cosmos `reporting`
   * @param submissionInfo - Loan / submission metadata
   * @returns Well-formed XML string ready for UCDP/EAD upload
   * @throws Error if validation fails — callers should surface as HTTP 422
   */
  generateCompletionReportXml(
    doc: CanonicalCompletionReport,
    submissionInfo: SubmissionInfo,
  ): string {
    this.logger.info('Generating Completion Report MISMO XML', {
      reportId: doc.reportId,
      orderId: doc.orderId,
    });

    const ctx = this.mapper.map(doc);

    const root = create({ version: '1.0', encoding: 'UTF-8' }).ele('MESSAGE', {
      xmlns: MISMO_NS,
      'xmlns:xlink': 'http://www.w3.org/1999/xlink',
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      'xsi:schemaLocation': `${MISMO_NS} MISMO_3_4.xsd`,
      MISMOVersionID: MISMO_VERSION,
    });

    // ABOUT_VERSIONS
    this._buildAboutVersions(root, doc);

    // DEAL_SETS → DEAL
    const deal = root
      .ele('DEAL_SETS')
      .ele('DEAL_SET')
      .ele('DEALS')
      .ele('DEAL');

    this._buildCollateral(deal, ctx);
    this._buildLoans(deal, doc, submissionInfo);
    this._buildParties(deal, ctx);
    this._buildRelationships(deal, ctx);
    this._buildServices(deal, ctx, submissionInfo);

    const xml = root.end({ prettyPrint: true, indent: '  ' });
    this.logger.info('Completion Report MISMO XML generation complete', {
      reportId: doc.reportId,
    });
    return xml;
  }

  // ─── ABOUT_VERSIONS ──────────────────────────────────────────────────────────

  private _buildAboutVersions(root: XMLBuilder, doc: CanonicalCompletionReport): void {
    const av = root.ele('ABOUT_VERSIONS');
    av.ele('ABOUT_VERSION', {
      CreatedDatetime: new Date().toISOString(),
      DataVersionIdentifier: doc.schemaVersion,
      DataVersionName: `UAD ${UAD_VERSION}`,
    });
  }

  // ─── COLLATERAL (Section 01 — Subject Property) ───────────────────────────────

  private _buildCollateral(deal: XMLBuilder, ctx: CompletionReportGenerationContext): void {
    const { doc } = ctx;
    const addr = doc.subjectProperty.address;

    const collateral = deal
      .ele('COLLATERALS')
      .ele('COLLATERAL');

    collateral.ele('SubjectPropertyIdentifier').txt( 'SUBJECT');

    const property = collateral
      .ele('PROPERTIES')
      .ele('PROPERTY');

    // Address
    const addrNode = property.ele('ADDRESS');
    addrNode.ele('AddressLineText').txt( addr.streetAddress);
    if (addr.unitIdentifier) {
      addrNode.ele('AddressUnitIdentifier').txt( addr.unitIdentifier);
      addrNode.ele('AddressUnitDesignatorType').txt( 'Unit');
    }
    addrNode.ele('CityName').txt( addr.city);
    addrNode.ele('PostalCode').txt( addr.postalCode);
    addrNode.ele('StateCode').txt( addr.state);
    addrNode.ele('CountyName').txt( addr.county);

    // Legal description — text form
    if (doc.subjectProperty.legalDescriptionText) {
      property
        .ele('PROPERTY_DETAIL')
        .ele('PropertyLegalDescription').txt( doc.subjectProperty.legalDescriptionText);
    }

    // Legal description image — stored as an IMAGE on the PROPERTY
    if (doc.subjectProperty.legalDescriptionImageUrl) {
      const imgNode = property.ele('IMAGES').ele('IMAGE');
      imgNode.ele('ImageCategoryType').txt( 'LegalDescription');
      imgNode.ele('ImageFileLocationURL').txt( doc.subjectProperty.legalDescriptionImageUrl);
      if (doc.subjectProperty.legalDescriptionCaption) {
        imgNode.ele('ImageCaptionCommentDescription').txt( doc.subjectProperty.legalDescriptionCaption);
      }
    }

    // Subject photo (Section 01 only — does NOT re-appear in Exhibits)
    if (doc.subjectProperty.subjectPhotoUrl) {
      const imgNode = property.ele('IMAGES').ele('IMAGE');
      imgNode.ele('ImageCategoryType').txt( 'PropertyPhoto');
      imgNode.ele('ImageFileLocationURL').txt( doc.subjectProperty.subjectPhotoUrl);
    }
  }

  // ─── LOANS ────────────────────────────────────────────────────────────────────

  private _buildLoans(
    deal: XMLBuilder,
    doc: CanonicalCompletionReport,
    submissionInfo: SubmissionInfo,
  ): void {
    const ai = doc.assignmentInformation;
    const loan = deal.ele('LOANS').ele('LOAN');

    // Document identification
    loan.ele('DOCUMENT_SPECIFIC_DATA_SETS')
      .ele('DOCUMENT_SPECIFIC_DATA_SET')
      .ele('APPRAISAL_DOCUMENT')
      .ele('AppraisalDocumentType').txt( DOC_FORM_ID);

    // Header/footer reference IDs (UID: 2100.0029-0025)
    const hf = doc.headerFooterIds;
    const identifiers = loan.ele('LOAN_IDENTIFIERS');
    identifiers.ele('LOAN_IDENTIFIER').ele('LoanIdentifier').txt( submissionInfo.loanNumber);
    if (hf.appraiserFileIdentifier) {
      identifiers.ele('LOAN_IDENTIFIER', {
        LoanIdentifierType: 'AppraiserFile',
      }).ele('LoanIdentifier').txt( hf.appraiserFileIdentifier);
    }
    if (hf.agencyCaseFileId) {
      identifiers.ele('LOAN_IDENTIFIER', {
        LoanIdentifierType: 'GovernmentAgency',
      }).ele('LoanIdentifier').txt( hf.agencyCaseFileId);
    }
    if (hf.clientReferenceId) {
      identifiers.ele('LOAN_IDENTIFIER', {
        LoanIdentifierType: 'Client',
      }).ele('LoanIdentifier').txt( hf.clientReferenceId);
    }
    if (hf.amcReferenceId) {
      identifiers.ele('LOAN_IDENTIFIER', {
        LoanIdentifierType: 'ManagementCompany',
      }).ele('LoanIdentifier').txt( hf.amcReferenceId);
    }

    // Borrower (FID 08.001)
    if (ai.borrowerFirstName || ai.borrowerLegalEntityName) {
      const borrower = loan.ele('BORROWERS').ele('BORROWER');
      if (ai.borrowerLegalEntityName) {
        borrower.ele('NAME').ele('FullName').txt( ai.borrowerLegalEntityName);
      } else {
        const name = borrower.ele('NAME');
        if (ai.borrowerFirstName) name.ele('FirstName').txt( ai.borrowerFirstName);
        if (ai.borrowerMiddleName) name.ele('MiddleName').txt( ai.borrowerMiddleName);
        if (ai.borrowerLastName) name.ele('LastName').txt( ai.borrowerLastName);
        if (ai.borrowerSuffix) name.ele('SuffixName').txt( ai.borrowerSuffix);
      }
    }

    // Fees (FID 08.002-08.003)
    if (ai.appraisalFee != null || ai.amcFee != null) {
      const fees = loan.ele('FEES');
      if (ai.appraisalFee != null) {
        fees.ele('FEE', { FeeType: 'AppraisalFee' })
          .ele('ProvidedServiceActualCostAmount').txt( String(ai.appraisalFee));
      }
      if (ai.amcFee != null) {
        fees.ele('FEE', { FeeType: 'AppraisalManagementCompanyFee' })
          .ele('ProvidedServiceActualCostAmount').txt( String(ai.amcFee));
      }
    }

    // Government agency (FID 08.004)
    if (ai.governmentAgencyAppraisal) {
      const gov = loan.ele('GOVERNMENT_LOAN_INDICATORS');
      gov.ele('GovernmentAgencyAppraisalIndicator').txt( 'true');
      if (ai.governmentAgencyType) {
        gov.ele('GovernmentAgencyAppraisalType').txt( ai.governmentAgencyType);
      }
    }

    // Investor ID (FID 08.005)
    if (ai.investorRequestedId) {
      loan.ele('InvestorRequestedIdentificationCode').txt( ai.investorRequestedId);
    }
  }

  // ─── PARTIES (Section 08 contacts, appraiser, supervisory appraiser) ─────────

  private _buildParties(deal: XMLBuilder, ctx: CompletionReportGenerationContext): void {
    const { doc } = ctx;
    const ai = doc.assignmentInformation;
    const parties = deal.ele('PARTIES');

    // Client parties (FID 08.006-08.012)
    ai.clientParties.forEach((cp, idx) => {
      this._buildClientParty(parties, cp, idx);
    });

    // Appraiser (FID 08.013-08.027) — ROLE label used in RELATIONSHIPS
    this._buildAppraiserParty(parties, ai.appraiser, 'Appraiser');

    // Supervisory Appraiser (FID 08.028-08.042)
    if (ai.supervisoryAppraiser) {
      this._buildAppraiserParty(parties, ai.supervisoryAppraiser, 'AppraiserSupervisor');
    }
  }

  private _buildClientParty(parties: XMLBuilder, cp: CrContactParty, idx: number): void {
    const party = parties.ele('PARTY', { label: `PARTY_CLIENT_${idx}` });
    const roles = party.ele('ROLES');
    roles.ele('ROLE').ele('PartyRoleType').txt( cp.primaryRole);
    if (cp.secondaryRole) {
      roles.ele('ROLE').ele('PartyRoleType').txt( cp.secondaryRole);
    }
    const contact = party.ele('CONTACT_INFORMATION');
    contact.ele('Name').ele('FullName').txt( cp.companyName);
    if (cp.addressLine) {
      const addr = contact.ele('ADDRESS');
      addr.ele('AddressLineText').txt( cp.addressLine);
      if (cp.city) addr.ele('CityName').txt( cp.city);
      if (cp.state) addr.ele('StateCode').txt( cp.state);
      if (cp.postalCode) addr.ele('PostalCode').txt( cp.postalCode);
    }
    // AMC credentials (UID: 2400.0362-0364)
    if (cp.licenseId) {
      const creds = party.ele('INDIVIDUAL');
      creds.ele('LicenseIdentifier').txt( cp.licenseId);
      if (cp.licenseState) creds.ele('LicenseIssuingAuthorityStateCode').txt( cp.licenseState);
      if (cp.licenseExpires) creds.ele('LicenseExpirationDate').txt( cp.licenseExpires);
    }
  }

  private _buildAppraiserParty(
    parties: XMLBuilder,
    app: CrAppraiserAssignment,
    role: 'Appraiser' | 'AppraiserSupervisor',
  ): void {
    const label = role === 'Appraiser' ? 'PARTY_APPRAISER' : 'PARTY_SUPERVISOR';
    const party = parties.ele('PARTY', { label });
    party.ele('ROLES').ele('ROLE', { label: `ROLE_${role}` }).ele('PartyRoleType').txt( role);

    // Name
    const individual = party.ele('INDIVIDUAL');
    const name = individual.ele('NAME');
    name.ele('FirstName').txt( app.firstName);
    if (app.middleName) name.ele('MiddleName').txt( app.middleName);
    name.ele('LastName').txt( app.lastName);
    if (app.suffixName) name.ele('SuffixName').txt( app.suffixName);

    // License / credentials (FID 08.020-08.024)
    individual.ele('LicenseIdentifier').txt( app.licenseId);
    individual.ele('LicenseIssuingAuthorityStateCode').txt( app.licenseState);
    individual.ele('LicenseExpirationDate').txt( app.licenseExpires);
    individual.ele('AppraiserLicenseType').txt( app.licenseType);

    if (app.ascId) individual.ele('AppraisalSubCommitteeAppraiserIdentifier').txt( app.ascId);
    if (app.designation) individual.ele('AppraiserDesignationType').txt( app.designation);
    if (app.agencyAppraiserId) {
      individual.ele('AgencyAppraiserIdentifier').txt( app.agencyAppraiserId);
      if (app.agencyAppraiserIdType) {
        individual.ele('AgencyAppraiserIdentifierType').txt( app.agencyAppraiserIdType);
      }
    }
    if (app.vaEmploymentType) individual.ele('AppraiserEmploymentType').txt( app.vaEmploymentType);

    // Company
    if (app.companyName) {
      const contact = party.ele('CONTACT_INFORMATION');
      contact.ele('Name').ele('FullName').txt( app.companyName);
      if (app.companyAddressLine) {
        const addr = contact.ele('ADDRESS');
        addr.ele('AddressLineText').txt( app.companyAddressLine);
        if (app.companyCity) addr.ele('CityName').txt( app.companyCity);
        if (app.companyState) addr.ele('StateCode').txt( app.companyState);
        if (app.companyPostalCode) addr.ele('PostalCode').txt( app.companyPostalCode);
      }
    }

    // Inspection (FID 08.017-08.019) — linked via RELATIONSHIPS
    if (app.exteriorInspectionMethod || app.interiorInspectionMethod || app.inspectionDate) {
      const inspection = party.ele('INSPECTION', { label: `INSPECTION_${role}` });
      if (app.exteriorInspectionMethod) {
        inspection.ele('PropertyExteriorInspectionMethodType').txt( app.exteriorInspectionMethod);
      }
      if (app.interiorInspectionMethod) {
        inspection.ele('PropertyInteriorInspectionMethodType').txt( app.interiorInspectionMethod);
      }
      if (app.inspectionDate) {
        inspection.ele('InspectionDate').txt( app.inspectionDate);
      }
    }

    // Personal inspection indicator (drives Cert 6 text) (UID: 2200.0027)
    individual.ele('PersonalInspectionPerformedIndicator').txt(
      app.personalInspectionPerformed ? 'true' : 'false',
    );
    // Verification statement when inspection not performed (UID: 2200.0026)
    if (!app.personalInspectionPerformed && app.conditionsSatisfiedVerificationDescription) {
      individual.ele('AppraisalConditionsSatisfiedVerificationDescription').txt(
        app.conditionsSatisfiedVerificationDescription,
      );
    }
  }

  // ─── RELATIONSHIPS (INSPECTION→ROLE, SIGNATORY→ROLE) ──────────────────────────

  private _buildRelationships(deal: XMLBuilder, ctx: CompletionReportGenerationContext): void {
    const { doc } = ctx;
    const ai = doc.assignmentInformation;
    const relationships = deal.ele('RELATIONSHIPS');

    // Appraiser INSPECTION → ROLE
    if (this._hasInspection(ai.appraiser)) {
      relationships.ele('RELATIONSHIP', {
        'xlink:arcrole': ARCROLE_INSPECTION_ROLE,
        'xlink:from': 'INSPECTION_Appraiser',
        'xlink:to': 'ROLE_Appraiser',
        'xlink:type': 'arc',
      });
    }

    // Supervisory INSPECTION → ROLE
    if (ai.supervisoryAppraiser && this._hasInspection(ai.supervisoryAppraiser)) {
      relationships.ele('RELATIONSHIP', {
        'xlink:arcrole': ARCROLE_INSPECTION_ROLE,
        'xlink:from': 'INSPECTION_AppraiserSupervisor',
        'xlink:to': 'ROLE_AppraiserSupervisor',
        'xlink:type': 'arc',
      });
    }

    // Appraiser SIGNATORY → ROLE
    relationships.ele('RELATIONSHIP', {
      'xlink:arcrole': ARCROLE_SIGNATORY_ROLE,
      'xlink:from': 'SIGNATORY_Appraiser',
      'xlink:to': 'ROLE_Appraiser',
      'xlink:type': 'arc',
    });

    // Supervisory SIGNATORY → ROLE
    if (ai.supervisoryAppraiser && doc.certifications.supervisoryAppraiserSignature) {
      relationships.ele('RELATIONSHIP', {
        'xlink:arcrole': ARCROLE_SIGNATORY_ROLE,
        'xlink:from': 'SIGNATORY_AppraiserSupervisor',
        'xlink:to': 'ROLE_AppraiserSupervisor',
        'xlink:type': 'arc',
      });
    }
  }

  private _hasInspection(app: CrAppraiserAssignment): boolean {
    return !!(
      app.exteriorInspectionMethod ||
      app.interiorInspectionMethod ||
      app.inspectionDate
    );
  }

  // ─── SERVICES (main appraisal content) ───────────────────────────────────────

  private _buildServices(
    deal: XMLBuilder,
    ctx: CompletionReportGenerationContext,
    submissionInfo: SubmissionInfo,
  ): void {
    const { doc } = ctx;
    const service = deal
      .ele('SERVICES')
      .ele('SERVICE');

    service.ele('SERVICE_IDENTIFIERS')
      .ele('SERVICE_IDENTIFIER')
      .ele('ServiceIdentifier').txt( doc.reportId);

    const valuation = service.ele('VALUATION');

    // Document form metadata (header/footer FIDs HF.001-HF.004)
    const formInfo = valuation.ele('VALUATION_FORM_INFORMATION');
    formInfo.ele('DocumentType').txt( DOC_FORM_ID);
    formInfo.ele('AboutVersionIdentifier').txt( doc.schemaVersion);
    formInfo.ele('DocumentFormIssuingEntityNameType').txt( FORM_ISSUER);
    formInfo.ele('DocumentFormIssuingEntityVersionIdentifier').txt( FORM_VERSION);

    // Section 02 — Original Appraisal
    this._buildOriginalAppraisalSection(valuation, doc);

    // Section 03 — Itemized List of Repairs (original repair items)
    if (ctx.showSection03) {
      ctx.repairItems.forEach((item, idx) => {
        this._buildDefect(valuation, item, idx);
      });
    }

    // Section 04 — New Observed Items
    if (ctx.showSection04) {
      ctx.newlyObservedItems.forEach((item, idx) => {
        this._buildDefect(valuation, item, idx);
      });
    }

    // Section 05 — Completion Status
    if (ctx.showSection05 && doc.completionStatus) {
      this._buildCompletionStatus(valuation, doc);
    }

    // Section 06 — Commentary
    if (ctx.showSection06 && doc.completionCommentary) {
      valuation
        .ele('VALUATION_COMPLETION_DETAIL')
        .ele('AppraisalCompletionCommentText').txt( doc.completionCommentary);
    }

    // Section 07 — Additional Exhibits (standalone images)
    if (ctx.showSection07) {
      this._buildExhibits(valuation, doc);
    }

    // Section 08 — Scope of work commentary
    if (doc.assignmentInformation.scopeOfWorkCommentary) {
      valuation
        .ele('VALUATION_COMMENTS', { ValuationAnalysisCategoryType: 'Assignment' })
        .ele('ValuationCommentText').txt( doc.assignmentInformation.scopeOfWorkCommentary);
    }

    // Section 09 — Certifications and signatures
    this._buildCertifications(valuation, doc, submissionInfo);
  }

  // ─── Section 02 — Original Appraisal ─────────────────────────────────────────

  private _buildOriginalAppraisalSection(
    valuation: XMLBuilder,
    doc: CanonicalCompletionReport,
  ): void {
    const oa = doc.originalAppraisal;
    const appraisal = valuation.ele('APPRAISAL');

    // Effective date (UID: 2800.0032)
    appraisal.ele('OriginalAppraisalEffectiveDate').txt( oa.effectiveDate);

    // Appraised value (UID: 2800.0033)
    appraisal.ele('OriginalAppraisedValueAmount').txt( String(oa.appraisedValue));

    // Market value conditions — one element per condition (UID: 2800.0002)
    oa.marketValueConditions.forEach((cond) => {
      appraisal.ele('PropertyValuationConditionalConclusionType').txt( cond);
    });

    // Original appraiser name (UID: 2800.0034)
    appraisal.ele('OriginalAppraiserUnparsedName').txt( oa.appraiserName);

    // Appraiser reference ID (UID: 2800.0035)
    appraisal.ele('OriginalAppraiserFileIdentifier').txt( oa.appraiserReferenceId);

    // Original lender (UID: 2800.0046)
    appraisal.ele('OriginalLenderUnparsedName').txt( oa.originalLenderName);

    // Final Value Condition Statement (derived — UID: derived from 2800.0002)
    const fvcs = generateFinalValueConditionStatement(oa.marketValueConditions);
    if (fvcs) {
      appraisal.ele('FinalValueConditionStatement').txt( fvcs);
    }
  }

  // ─── Sections 03 & 04 — DEFECT containers ────────────────────────────────────

  private _buildDefect(
    valuation: XMLBuilder,
    item: CrRepairItem,
    idx: number,
  ): void {
    const defect = valuation.ele('DEFECT');

    // CompletionReportNewDefectIndicator discriminator
    defect.ele('CompletionReportNewDefectIndicator').txt(
      item.isNewlyObserved ? 'true' : 'false',
    );

    // Feature / component label
    // Section 03 UID: 3900.0117 / Section 04 UID: 2800.0052
    defect.ele('DefectComponentLabelType').txt( item.feature);

    // Location
    // Section 03 UID: 3900.0010 / Section 04 UID: 2800.0056
    defect.ele('DefectItemLocationType').txt( item.locationType);
    if (item.locationOtherDescription) {
      // Section 03 UID: 3900.0162 / Section 04 UID: 2800.0057
      defect.ele('DefectItemLocationTypeOtherDescription').txt( item.locationOtherDescription);
    }

    // Description
    // Section 03 UID: 3900.0011 / Section 04 UID: 2800.0055
    defect.ele('DefectItemDescription').txt( item.description);

    // Affects soundness / structural integrity
    // Section 03 UID: 3900.0012 / Section 04 UID: 2800.0054
    defect.ele('DefectItemAffectsSoundnessStructuralIntegrityIndicator').txt(
      item.affectsSoundnessOrStructuralIntegrity ? 'true' : 'false',
    );

    if (!item.isNewlyObserved) {
      // Section 03 only fields
      if (item.repairCompleted != null) {
        // UID: 3900.0016
        defect.ele('DefectItemRecommendedActionCompletedIndicator').txt(
          item.repairCompleted ? 'true' : 'false',
        );
      }
      if (item.inspectionDate) {
        // UID: 3900.0017
        defect.ele('DefectItemRecommendedActionInspectionDate').txt( item.inspectionDate);
      }
      if (item.completionComment) {
        // UID: 3900.0018
        defect.ele('DefectItemRecommendedActionCompletionDescription').txt( item.completionComment);
      }
    } else {
      // Section 04 only fields
      if (item.recommendedActionType) {
        // UID: 3900.0013
        defect.ele('DefectItemRecommendedActionType').txt( item.recommendedActionType);
      }
      if (item.inspectionDate) {
        // UID: 2800.0058
        defect.ele('DefectItemRecommendedActionInspectionDate').txt( item.inspectionDate);
      }
    }

    // Photos for this defect — displayed in Exhibits (Section 07)
    if (item.photoUrls.length > 0) {
      const images = defect.ele('IMAGES');
      item.photoUrls.forEach((url) => {
        images
          .ele('IMAGE')
          .ele('ImageFileLocationURL').txt( url);
      });
    }
  }

  // ─── Section 05 — Completion Status ──────────────────────────────────────────

  private _buildCompletionStatus(valuation: XMLBuilder, doc: CanonicalCompletionReport): void {
    const cs = doc.completionStatus!;
    const detail = valuation.ele('VALUATION_COMPLETION_DETAIL');

    // UID: 2800.0010
    detail.ele('PropertyImprovementsCompletedIndicator').txt(
      cs.constructionComplete ? 'true' : 'false',
    );

    if (cs.constructionComplete && cs.completedPerPlans != null) {
      // UID: 2800.0011
      detail.ele('PropertyImprovementsCompletedPerPlansIndicator').txt(
        cs.completedPerPlans ? 'true' : 'false',
      );
    }

    // Completed construction photos
    if (cs.completedConstructionPhotoUrls.length > 0) {
      const images = detail.ele('IMAGES');
      cs.completedConstructionPhotoUrls.forEach((url) => {
        const img = images.ele('IMAGE');
        img.ele('ImageCategoryType').txt( 'CompletedConstruction');
        img.ele('ImageFileLocationURL').txt( url);
      });
    }

    // Inconsistent features (UID: 2800.0003-0006)
    cs.inconsistentFeatures.forEach((f: CrInconsistentFeature) => {
      this._buildSubjectToCompletionItem(detail, f);
    });
  }

  private _buildSubjectToCompletionItem(
    parent: XMLBuilder,
    f: CrInconsistentFeature,
  ): void {
    const item = parent.ele('SUBJECT_TO_COMPLETION_ITEM');
    item.ele('SubjectToCompletionFeatureDescription').txt( f.feature);            // UID: 2800.0003
    item.ele('SubjectToCompletionFeatureLocationDescription').txt( f.location);   // UID: 2800.0004
    item.ele('SubjectToCompletionFeatureComparisonType').txt( f.comparisonToPlans); // UID: 2800.0005
    item.ele('SubjectToCompletionFeatureIncompleteOrInconsistentDescription').txt( f.comment); // UID: 2800.0006

    // Photos — associated via this container
    if (f.photoUrls.length > 0) {
      const images = item.ele('IMAGES');
      f.photoUrls.forEach((url) => {
        images.ele('IMAGE').ele('ImageFileLocationURL').txt( url);
      });
    }
  }

  // ─── Section 07 — Additional Exhibits ────────────────────────────────────────

  private _buildExhibits(valuation: XMLBuilder, doc: CanonicalCompletionReport): void {
    if (!doc.additionalExhibits || doc.additionalExhibits.length === 0) return;

    const images = valuation.ele('IMAGES');
    doc.additionalExhibits.forEach((exhibit) => {
      const img = images.ele('IMAGE');
      img.ele('ImageCategoryType').txt( exhibit.imageCategoryType);
      img.ele('ImageFileLocationURL').txt( exhibit.imageUrl);
      if (exhibit.caption) {
        img.ele('ImageCaptionCommentDescription').txt( exhibit.caption);  // UID: 1400.0943
      }
    });
  }

  // ─── Section 09 — Certifications & Signatures ────────────────────────────────

  private _buildCertifications(
    valuation: XMLBuilder,
    doc: CanonicalCompletionReport,
    _submissionInfo: SubmissionInfo,
  ): void {
    const certs = doc.certifications;
    const ai = doc.assignmentInformation;
    const certNode = valuation.ele('VALUATION_CERTIFICATIONS');

    // Intended use (FID 09.001) — always displayed
    certNode.ele('VALUATION_CERTIFICATION', {
      ValuationCertificationType: 'IntendedUse',
    }).ele('ValuationCertificationText').txt(
      'The intended use of this certification of completion is for the lender/client to confirm that the requirements or conditions stated in the appraisal report referenced above have been met.',
    );

    // Additional intended use for FHA (FID 09.003)
    if (certs.additionalIntendedUse && ai.governmentAgencyAppraisal) {
      certNode.ele('VALUATION_CERTIFICATION', {
        ValuationCertificationType: 'AdditionalIntendedUse',
      }).ele('ValuationIntendedUseDescription').txt( certs.additionalIntendedUse);
    }

    // Additional intended users (FID 09.007)
    if (certs.additionalIntendedUsersPresent && certs.additionalIntendedUsersDescription) {
      certNode.ele('VALUATION_CERTIFICATION', {
        ValuationCertificationType: 'AdditionalIntendedUsers',
      }).ele('ValuationAdditionalIntendedUserDescription').txt( certs.additionalIntendedUsersDescription);
    }

    // Additional certifications
    if (certs.additionalCertifications) {
      certNode.ele('VALUATION_CERTIFICATION', {
        ValuationCertificationType: 'Additional',
      }).ele('ValuationCertificationText').txt( certs.additionalCertifications);
    }

    // Appraiser signature / SIGNATORY containers (FID 09.025-09.032)
    this._buildSignatory(
      certNode,
      ai.appraiser,
      certs.appraiserSignature.executionDate,
      'Appraiser',
    );

    if (ai.supervisoryAppraiser && certs.supervisoryAppraiserSignature) {
      this._buildSignatory(
        certNode,
        ai.supervisoryAppraiser,
        certs.supervisoryAppraiserSignature.executionDate,
        'AppraiserSupervisor',
      );
    }
  }

  private _buildSignatory(
    certNode: XMLBuilder,
    app: CrAppraiserAssignment,
    executionDate: string,
    role: 'Appraiser' | 'AppraiserSupervisor',
  ): void {
    const label = role === 'Appraiser' ? 'SIGNATORY_Appraiser' : 'SIGNATORY_AppraiserSupervisor';
    const signatory = certNode.ele('SIGNATORY', { label });
    signatory.ele('PartyRoleType').txt( role);

    // Execution date (UID: 2200.0002)
    signatory.ele('ExecutionDate').txt( executionDate);

    // Contact info
    const name = signatory.ele('NAME');
    name.ele('FirstName').txt( app.firstName);
    if (app.middleName) name.ele('MiddleName').txt( app.middleName);
    name.ele('LastName').txt( app.lastName);
    if (app.suffixName) name.ele('SuffixName').txt( app.suffixName);

    // License
    signatory.ele('AppraiserLicenseType').txt( app.licenseType);
    signatory.ele('LicenseIdentifier').txt( app.licenseId);
    signatory.ele('LicenseIssuingAuthorityStateCode').txt( app.licenseState);
    signatory.ele('LicenseExpirationDate').txt( app.licenseExpires);
  }
}
