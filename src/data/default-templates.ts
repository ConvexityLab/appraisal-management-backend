/**
 * Default Template Seeds
 * Pre-defined templates for ROV responses and appraisal reports (1033, 1004, etc.)
 */

import {
  Template,
  TemplateCategory,
  AppraisalFormType,
  TemplateFormat,
  TemplateStatus,
  TemplatePlaceholder
} from '../types/template.types.js';

/**
 * ROV Response Templates
 */

export const ROV_VALUE_INCREASED_TEMPLATE: Partial<Template> = {
  name: 'ROV Response - Value Increased',
  description: 'Response letter for ROV requests where the appraised value has been increased after review',
  category: TemplateCategory.ROV_RESPONSE,
  format: TemplateFormat.HTML,
  status: TemplateStatus.ACTIVE,
  isDefault: true,
  content: `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <p>{{date}}</p>
  
  <p>
    {{requestorName}}<br>
    {{requestorAddress}}<br>
    {{requestorCity}}, {{requestorState}} {{requestorZip}}
  </p>
  
  <p>Re: Reconsideration of Value - {{propertyAddress}}</p>
  
  <p>Dear {{requestorName}},</p>
  
  <p>
    Thank you for your request for reconsideration of value dated {{requestDate}} for the property 
    located at {{propertyAddress}}.
  </p>
  
  <p>
    I have carefully reviewed the comparable properties you provided, along with additional market 
    research for the subject property area. After thorough analysis, I have determined that an 
    adjustment to the appraised value is warranted.
  </p>
  
  <table style="margin: 20px 0; border-collapse: collapse; width: 100%;">
    <tr>
      <td style="padding: 8px; font-weight: bold;">Original Appraised Value:</td>
      <td style="padding: 8px;">{{originalValue}}</td>
    </tr>
    <tr>
      <td style="padding: 8px; font-weight: bold;">Revised Appraised Value:</td>
      <td style="padding: 8px;">{{newValue}}</td>
    </tr>
    <tr style="background-color: #f0f0f0;">
      <td style="padding: 8px; font-weight: bold;">Value Increase:</td>
      <td style="padding: 8px; color: green;">{{valueChange}} ({{valueChangePercent}})</td>
    </tr>
  </table>
  
  <p><strong>Basis for Adjustment:</strong></p>
  
  <p>{{explanation}}</p>
  
  <p><strong>Supporting Comparable Properties:</strong></p>
  
  {{comparablesList}}
  
  <p>
    An updated appraisal report reflecting this revised value will be provided within {{deliveryDays}} 
    business days. If you have any questions regarding this reconsideration, please contact me at 
    {{appraiserPhone}} or {{appraiserEmail}}.
  </p>
  
  <p>
    Sincerely,<br><br>
    {{appraiserName}}<br>
    {{appraiserTitle}}<br>
    License #: {{appraiserLicense}}<br>
    {{appraiserCompany}}
  </p>
</div>
  `,
  placeholders: [
    { key: 'date', label: 'Current Date', type: 'date', required: true },
    { key: 'requestorName', label: 'Requestor Name', type: 'text', required: true },
    { key: 'requestorAddress', label: 'Requestor Street Address', type: 'address', required: false },
    { key: 'requestorCity', label: 'Requestor City', type: 'text', required: false },
    { key: 'requestorState', label: 'Requestor State', type: 'text', required: false },
    { key: 'requestorZip', label: 'Requestor ZIP', type: 'text', required: false },
    { key: 'propertyAddress', label: 'Property Address', type: 'address', required: true },
    { key: 'requestDate', label: 'Request Date', type: 'date', required: true },
    { key: 'originalValue', label: 'Original Appraised Value', type: 'currency', required: true },
    { key: 'newValue', label: 'New Appraised Value', type: 'currency', required: true },
    { key: 'valueChange', label: 'Value Change Amount', type: 'currency', required: true },
    { key: 'valueChangePercent', label: 'Value Change Percentage', type: 'text', required: true },
    { key: 'explanation', label: 'Explanation for Value Adjustment', type: 'text', required: true },
    { key: 'comparablesList', label: 'List of Comparable Properties', type: 'table', required: true },
    { key: 'deliveryDays', label: 'Delivery Days', type: 'number', required: true, defaultValue: '3' },
    { key: 'appraiserName', label: 'Appraiser Name', type: 'text', required: true },
    { key: 'appraiserTitle', label: 'Appraiser Title', type: 'text', required: false, defaultValue: 'Certified Residential Appraiser' },
    { key: 'appraiserLicense', label: 'Appraiser License Number', type: 'text', required: true },
    { key: 'appraiserCompany', label: 'Appraiser Company', type: 'text', required: false },
    { key: 'appraiserPhone', label: 'Appraiser Phone', type: 'text', required: false },
    { key: 'appraiserEmail', label: 'Appraiser Email', type: 'text', required: false }
  ],
  tags: ['rov', 'value-increased', 'response-letter'],
  version: '1.0.0',
  usageCount: 0,
  requiresApproval: false
};

export const ROV_VALUE_UNCHANGED_TEMPLATE: Partial<Template> = {
  name: 'ROV Response - Value Unchanged',
  description: 'Response letter for ROV requests where the original value remains supported',
  category: TemplateCategory.ROV_RESPONSE,
  format: TemplateFormat.HTML,
  status: TemplateStatus.ACTIVE,
  content: `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <p>{{date}}</p>
  
  <p>
    {{requestorName}}<br>
    {{requestorAddress}}
  </p>
  
  <p>Re: Reconsideration of Value - {{propertyAddress}}</p>
  
  <p>Dear {{requestorName}},</p>
  
  <p>
    Thank you for your request for reconsideration of value for the property located at {{propertyAddress}}.
  </p>
  
  <p>
    I have carefully reviewed the comparable properties and market data you provided, along with 
    additional research for the subject property area. After thorough analysis, I have determined 
    that the original appraised value of {{originalValue}} remains well-supported by current market conditions.
  </p>
  
  <p><strong>Rationale:</strong></p>
  
  <p>{{explanation}}</p>
  
  <p>
    The comparable properties used in the original appraisal represent the most similar and recent sales 
    in the subject property's market area. The adjustments made in the original analysis remain appropriate 
    and reflect accurate market conditions as of the effective date of {{appraisalDate}}.
  </p>
  
  <p>
    If you have additional information or market data that was not considered in this review, please feel 
    free to contact me at {{appraiserPhone}} or {{appraiserEmail}}.
  </p>
  
  <p>
    Sincerely,<br><br>
    {{appraiserName}}<br>
    License #: {{appraiserLicense}}
  </p>
</div>
  `,
  placeholders: [
    { key: 'date', label: 'Current Date', type: 'date', required: true },
    { key: 'requestorName', label: 'Requestor Name', type: 'text', required: true },
    { key: 'requestorAddress', label: 'Requestor Address', type: 'address', required: false },
    { key: 'propertyAddress', label: 'Property Address', type: 'address', required: true },
    { key: 'originalValue', label: 'Original Appraised Value', type: 'currency', required: true },
    { key: 'appraisalDate', label: 'Appraisal Date', type: 'date', required: true },
    { key: 'explanation', label: 'Explanation for Unchanged Value', type: 'text', required: true },
    { key: 'appraiserName', label: 'Appraiser Name', type: 'text', required: true },
    { key: 'appraiserLicense', label: 'Appraiser License Number', type: 'text', required: true },
    { key: 'appraiserPhone', label: 'Appraiser Phone', type: 'text', required: false },
    { key: 'appraiserEmail', label: 'Appraiser Email', type: 'text', required: false }
  ],
  tags: ['rov', 'value-unchanged', 'response-letter'],
  version: '1.0.0',
  usageCount: 0,
  requiresApproval: false
};

/**
 * Appraisal Form 1033 Template (Individual Condominium Unit Appraisal Report)
 */
export const FORM_1033_TEMPLATE: Partial<Template> = {
  name: 'FNMA Form 1033 - Individual Condominium Unit Appraisal Report',
  description: 'Standard Fannie Mae Form 1033 for individual condominium unit appraisals',
  category: TemplateCategory.APPRAISAL_REPORT,
  formType: AppraisalFormType.FORM_1033,
  format: TemplateFormat.HTML,
  status: TemplateStatus.ACTIVE,
  isDefault: true,
  content: `
<div style="font-family: Arial, sans-serif; font-size: 12px;">
  <h2>INDIVIDUAL CONDOMINIUM UNIT APPRAISAL REPORT</h2>
  <p style="font-size: 10px;">Fannie Mae Form 1033 - Freddie Mac Form 465</p>
  
  <h3>SUBJECT PROPERTY INFORMATION</h3>
  <table style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="border: 1px solid #000; padding: 5px;"><strong>Property Address:</strong></td>
      <td style="border: 1px solid #000; padding: 5px;">{{propertyAddress}}</td>
      <td style="border: 1px solid #000; padding: 5px;"><strong>Unit #:</strong></td>
      <td style="border: 1px solid #000; padding: 5px;">{{unitNumber}}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000; padding: 5px;"><strong>City:</strong></td>
      <td style="border: 1px solid #000; padding: 5px;">{{city}}</td>
      <td style="border: 1px solid #000; padding: 5px;"><strong>State:</strong></td>
      <td style="border: 1px solid #000; padding: 5px;">{{state}}</td>
      <td style="border: 1px solid #000; padding: 5px;"><strong>ZIP:</strong></td>
      <td style="border: 1px solid #000; padding: 5px;">{{zipCode}}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000; padding: 5px;"><strong>Legal Description:</strong></td>
      <td colspan="5" style="border: 1px solid #000; padding: 5px;">{{legalDescription}}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000; padding: 5px;"><strong>Borrower:</strong></td>
      <td style="border: 1px solid #000; padding: 5px;">{{borrowerName}}</td>
      <td style="border: 1px solid #000; padding: 5px;"><strong>Lender:</strong></td>
      <td colspan="3" style="border: 1px solid #000; padding: 5px;">{{lenderName}}</td>
    </tr>
  </table>
  
  <h3>PROPERTY DATA</h3>
  <table style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="border: 1px solid #000; padding: 5px;"><strong>Gross Living Area:</strong></td>
      <td style="border: 1px solid #000; padding: 5px;">{{gla}} sq ft</td>
      <td style="border: 1px solid #000; padding: 5px;"><strong>Bedrooms:</strong></td>
      <td style="border: 1px solid #000; padding: 5px;">{{bedrooms}}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000; padding: 5px;"><strong>Bathrooms:</strong></td>
      <td style="border: 1px solid #000; padding: 5px;">{{bathrooms}}</td>
      <td style="border: 1px solid #000; padding: 5px;"><strong>Year Built:</strong></td>
      <td style="border: 1px solid #000; padding: 5px;">{{yearBuilt}}</td>
    </tr>
  </table>
  
  <h3>CONDOMINIUM PROJECT INFORMATION</h3>
  <table style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="border: 1px solid #000; padding: 5px;"><strong>Project Name:</strong></td>
      <td colspan="3" style="border: 1px solid #000; padding: 5px;">{{projectName}}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000; padding: 5px;"><strong>Total Units:</strong></td>
      <td style="border: 1px solid #000; padding: 5px;">{{totalUnits}}</td>
      <td style="border: 1px solid #000; padding: 5px;"><strong>Units Sold:</strong></td>
      <td style="border: 1px solid #000; padding: 5px;">{{unitsSold}}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000; padding: 5px;"><strong>HOA Fees:</strong></td>
      <td style="border: 1px solid #000; padding: 5px;">{{hoaFees}}/month</td>
      <td style="border: 1px solid #000; padding: 5px;"><strong>Special Assessments:</strong></td>
      <td style="border: 1px solid #000; padding: 5px;">{{specialAssessments}}</td>
    </tr>
  </table>
  
  <h3>SALES COMPARISON APPROACH</h3>
  {{salesComparisonTable}}
  
  <h3>VALUATION CONCLUSION</h3>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr style="background-color: #f0f0f0;">
      <td style="border: 1px solid #000; padding: 10px; font-weight: bold; font-size: 14px;">
        AS-IS MARKET VALUE:
      </td>
      <td style="border: 1px solid #000; padding: 10px; font-size: 14px;">
        {{marketValue}}
      </td>
    </tr>
  </table>
  
  <h3>APPRAISER CERTIFICATION</h3>
  <p style="font-size: 10px;">
    I certify that, to the best of my knowledge and belief, the statements of fact contained in this 
    appraisal report are true and correct. This appraisal was prepared in accordance with the Uniform 
    Standards of Professional Appraisal Practice (USPAP).
  </p>
  
  <table style="width: 100%; margin-top: 20px;">
    <tr>
      <td style="padding: 5px;"><strong>Appraiser:</strong></td>
      <td style="padding: 5px;">{{appraiserName}}</td>
    </tr>
    <tr>
      <td style="padding: 5px;"><strong>License:</strong></td>
      <td style="padding: 5px;">{{appraiserLicense}}</td>
    </tr>
    <tr>
      <td style="padding: 5px;"><strong>Date:</strong></td>
      <td style="padding: 5px;">{{appraisalDate}}</td>
    </tr>
    <tr>
      <td style="padding: 5px;"><strong>Signature:</strong></td>
      <td style="padding: 5px; border-bottom: 1px solid #000; height: 40px;"></td>
    </tr>
  </table>
</div>
  `,
  placeholders: [
    { key: 'propertyAddress', label: 'Property Address', type: 'address', required: true },
    { key: 'unitNumber', label: 'Unit Number', type: 'text', required: true },
    { key: 'city', label: 'City', type: 'text', required: true },
    { key: 'state', label: 'State', type: 'text', required: true },
    { key: 'zipCode', label: 'ZIP Code', type: 'text', required: true },
    { key: 'legalDescription', label: 'Legal Description', type: 'text', required: true },
    { key: 'borrowerName', label: 'Borrower Name', type: 'text', required: true },
    { key: 'lenderName', label: 'Lender Name', type: 'text', required: true },
    { key: 'gla', label: 'Gross Living Area (sq ft)', type: 'number', required: true },
    { key: 'bedrooms', label: 'Number of Bedrooms', type: 'number', required: true },
    { key: 'bathrooms', label: 'Number of Bathrooms', type: 'number', required: true },
    { key: 'yearBuilt', label: 'Year Built', type: 'number', required: true },
    { key: 'projectName', label: 'Condominium Project Name', type: 'text', required: true },
    { key: 'totalUnits', label: 'Total Units in Project', type: 'number', required: true },
    { key: 'unitsSold', label: 'Units Sold', type: 'number', required: true },
    { key: 'hoaFees', label: 'HOA Monthly Fees', type: 'currency', required: true },
    { key: 'specialAssessments', label: 'Special Assessments', type: 'currency', required: false, defaultValue: '$0' },
    { key: 'salesComparisonTable', label: 'Sales Comparison Table', type: 'table', required: true },
    { key: 'marketValue', label: 'As-Is Market Value', type: 'currency', required: true },
    { key: 'appraiserName', label: 'Appraiser Name', type: 'text', required: true },
    { key: 'appraiserLicense', label: 'Appraiser License Number', type: 'text', required: true },
    { key: 'appraisalDate', label: 'Appraisal Date', type: 'date', required: true }
  ],
  tags: ['fnma', 'form-1033', 'condominium', 'appraisal-report'],
  version: '1.0.0',
  usageCount: 0,
  requiresApproval: true
};

/**
 * Appraisal Form 1004 Template (Uniform Residential Appraisal Report - URAR)
 */
export const FORM_1004_TEMPLATE: Partial<Template> = {
  name: 'FNMA Form 1004 - Uniform Residential Appraisal Report (URAR)',
  description: 'Standard Fannie Mae Form 1004 (URAR) for single-family residential appraisals',
  category: TemplateCategory.APPRAISAL_REPORT,
  formType: AppraisalFormType.FORM_1004,
  format: TemplateFormat.HTML,
  status: TemplateStatus.ACTIVE,
  isDefault: true,
  content: `
<div style="font-family: Arial, sans-serif; font-size: 12px;">
  <h2>UNIFORM RESIDENTIAL APPRAISAL REPORT</h2>
  <p style="font-size: 10px;">Fannie Mae Form 1004 - Freddie Mac Form 70</p>
  
  <h3>SUBJECT</h3>
  <table style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="border: 1px solid #000; padding: 5px;"><strong>Property Address:</strong></td>
      <td colspan="3" style="border: 1px solid #000; padding: 5px;">{{propertyAddress}}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000; padding: 5px;"><strong>City:</strong></td>
      <td style="border: 1px solid #000; padding: 5px;">{{city}}</td>
      <td style="border: 1px solid #000; padding: 5px;"><strong>State:</strong></td>
      <td style="border: 1px solid #000; padding: 5px;">{{state}}</td>
      <td style="border: 1px solid #000; padding: 5px;"><strong>ZIP:</strong></td>
      <td style="border: 1px solid #000; padding: 5px;">{{zipCode}}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000; padding: 5px;"><strong>Borrower:</strong></td>
      <td colspan="2" style="border: 1px solid #000; padding: 5px;">{{borrowerName}}</td>
      <td style="border: 1px solid #000; padding: 5px;"><strong>Lender:</strong></td>
      <td colspan="2" style="border: 1px solid #000; padding: 5px;">{{lenderName}}</td>
    </tr>
  </table>
  
  <h3>SITE & IMPROVEMENTS</h3>
  <table style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="border: 1px solid #000; padding: 5px;"><strong>Site Area:</strong></td>
      <td style="border: 1px solid #000; padding: 5px;">{{siteArea}} sq ft</td>
      <td style="border: 1px solid #000; padding: 5px;"><strong>Zoning:</strong></td>
      <td style="border: 1px solid #000; padding: 5px;">{{zoning}}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000; padding: 5px;"><strong>Year Built:</strong></td>
      <td style="border: 1px solid #000; padding: 5px;">{{yearBuilt}}</td>
      <td style="border: 1px solid #000; padding: 5px;"><strong>Gross Living Area:</strong></td>
      <td style="border: 1px solid #000; padding: 5px;">{{gla}} sq ft</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000; padding: 5px;"><strong>Bedrooms:</strong></td>
      <td style="border: 1px solid #000; padding: 5px;">{{bedrooms}}</td>
      <td style="border: 1px solid #000; padding: 5px;"><strong>Bathrooms:</strong></td>
      <td style="border: 1px solid #000; padding: 5px;">{{bathrooms}}</td>
    </tr>
  </table>
  
  <h3>SALES COMPARISON APPROACH</h3>
  {{salesComparisonTable}}
  
  <h3>RECONCILIATION & FINAL VALUE ESTIMATE</h3>
  <p>{{reconciliation}}</p>
  
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr style="background-color: #f0f0f0;">
      <td style="border: 1px solid #000; padding: 10px; font-weight: bold; font-size: 14px;">
        INDICATED VALUE BY SALES COMPARISON APPROACH:
      </td>
      <td style="border: 1px solid #000; padding: 10px; font-size: 14px;">
        {{marketValue}}
      </td>
    </tr>
  </table>
  
  <h3>APPRAISER CERTIFICATION</h3>
  <p style="font-size: 10px;">
    The purpose of this appraisal is to estimate the market value of the real property that is the subject 
    of this report, based on the above conditions and the certification, contingent and limiting conditions, 
    and market value definition that are stated in this report. This appraisal was prepared in accordance 
    with the requirements of the Uniform Standards of Professional Appraisal Practice (USPAP).
  </p>
  
  <table style="width: 100%; margin-top: 20px;">
    <tr>
      <td style="padding: 5px;"><strong>Appraiser:</strong></td>
      <td style="padding: 5px;">{{appraiserName}}</td>
    </tr>
    <tr>
      <td style="padding: 5px;"><strong>License/Certification:</strong></td>
      <td style="padding: 5px;">{{appraiserLicense}}</td>
    </tr>
    <tr>
      <td style="padding: 5px;"><strong>Effective Date:</strong></td>
      <td style="padding: 5px;">{{appraisalDate}}</td>
    </tr>
  </table>
</div>
  `,
  placeholders: [
    { key: 'propertyAddress', label: 'Property Address', type: 'address', required: true },
    { key: 'city', label: 'City', type: 'text', required: true },
    { key: 'state', label: 'State', type: 'text', required: true },
    { key: 'zipCode', label: 'ZIP Code', type: 'text', required: true },
    { key: 'borrowerName', label: 'Borrower Name', type: 'text', required: true },
    { key: 'lenderName', label: 'Lender Name', type: 'text', required: true },
    { key: 'siteArea', label: 'Site Area (sq ft or acres)', type: 'text', required: true },
    { key: 'zoning', label: 'Zoning Classification', type: 'text', required: true },
    { key: 'yearBuilt', label: 'Year Built', type: 'number', required: true },
    { key: 'gla', label: 'Gross Living Area (sq ft)', type: 'number', required: true },
    { key: 'bedrooms', label: 'Number of Bedrooms', type: 'number', required: true },
    { key: 'bathrooms', label: 'Number of Bathrooms', type: 'number', required: true },
    { key: 'salesComparisonTable', label: 'Sales Comparison Table', type: 'table', required: true },
    { key: 'reconciliation', label: 'Reconciliation Comments', type: 'text', required: true },
    { key: 'marketValue', label: 'Market Value', type: 'currency', required: true },
    { key: 'appraiserName', label: 'Appraiser Name', type: 'text', required: true },
    { key: 'appraiserLicense', label: 'Appraiser License/Certification Number', type: 'text', required: true },
    { key: 'appraisalDate', label: 'Appraisal Effective Date', type: 'date', required: true }
  ],
  tags: ['fnma', 'form-1004', 'urar', 'residential', 'appraisal-report'],
  version: '1.0.0',
  usageCount: 0,
  requiresApproval: true
};

export const DEFAULT_TEMPLATES = [
  ROV_VALUE_INCREASED_TEMPLATE,
  ROV_VALUE_UNCHANGED_TEMPLATE,
  FORM_1033_TEMPLATE,
  FORM_1004_TEMPLATE
];
