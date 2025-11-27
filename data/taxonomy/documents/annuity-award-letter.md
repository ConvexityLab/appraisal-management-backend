# Annuity Award Letter

Jump to Content
Start free trial
Raise a request
Guides
Recipes
API
Release notes
Supported documents
CTRL-K
Home
Guide
Quick start guides
Ocrolus API
Webhooks
Product guide
Encompass integration
Plaid integration
Supported documents
Getting started with supported documents
All supported documents
Assets
Closing
Disclosure
Identification
Income/Employment
Annuity Award Letter
Balance Sheet
Career Data Brief
Change in Benefits Notice
Combat-Related Special Compensation (CRSC) Pay Statement
Disability Award Letter
IRS Form SSA-1099 - Social Security Benefit Statement
Member Data Summary
Office of Personnel Management (OPM) Annuity Statement
Income calculation definitions
Pay Stub
Pension Award Letter
Profit and Loss Statement
Social Security Award Letter
Soldier Talent Profile
Veterans Affairs (VA) Award Letter
VOE (1005) - Request for Verification of Employment
VOE (generic) - Verification of Employment Report
VOE (work number) - The Work Number Verification of Employment Report
VOIE (Finicity) - Finicity Verification of Income and Employment
Legal
Mortgage specific forms
Other
Property
Tax forms
Data types
Annuity Award Letter
Suggest Edits

It is a document that confirms the details of an annuity payment arrangement. Annuities are financial products that provide a steady income stream, typically used for retirement planning.

To use the Upload PDF endpoint endpoint for this document, you must use ANNUITY_AWARD_LETTER in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
annuity_award_letter-Part1-General:issueDate	Date	Issue Date
annuity_award_letter-Part1-General:claimNumber	Text	Claim Number
annuity_award_letter-Part1-General:beneficiaryName	Text	Beneficiary Name
annuity_award_letter-Part1-General:beneficiaryAddress:addressLine1	Text	Beneficiary Address
annuity_award_letter-Part1-General:beneficiaryAddress:addressLine2	Text	Beneficiary Address
annuity_award_letter-Part1-General:beneficiaryAddress:city	Text	Beneficiary Address
annuity_award_letter-Part1-General:beneficiaryAddress:state	State	Beneficiary Address
annuity_award_letter-Part1-General:beneficiaryAddress:zipCode	ZIP Code	Beneficiary Address
annuity_award_letter-Part1-General:socialSecurityNumber	Social Security Number	Social Security Number
annuity_award_letter-Part1-General:lumpSumBenefit	Money	Lump Sum Benefit
annuity_award_letter-Part1-General:issuingCompanyName	Text	Issuing Company Name
annuity_award_letter-Part1-General:typeOfIncome	FIXED ANNUITY, VARIABLE ANNUITY, OTHER	Type Of Income
annuity_award_letter-Part1-General:typeOfIncome-IfOther	Text	Type Of Income - If Other
annuity_award_letter-Part1-General:totalMonthlyGrossIncome	Money	Total Monthly Gross Income
annuity_award_letter-Part1-General:benefit1StartDate	Date	Benefit 1 Start Date
annuity_award_letter-Part1-General:benefit1EndDate	Date	Benefit 1 End Date
annuity_award_letter-Part1-General:benefit1Amount	Money	Benefit 1 Amount
annuity_award_letter-Part1-General:benefit2StartDate	Date	Benefit 2 Start Date
annuity_award_letter-Part1-General:benefit2EndDate	Date	Benefit 2 End Date
annuity_award_letter-Part1-General:benefit2Amount	Money	Benefit 2 Amount
annuity_award_letter-Part1-General:benefit3StartDate	Date	Benefit 3 Start Date
annuity_award_letter-Part1-General:benefit3EndDate	Date	Benefit 3 End Date
annuity_award_letter-Part1-General:benefit3Amount	Money	Benefit 3 Amount
Sample document
drive.google.com
ANNUITY_AWARD_LETTER.pdf
Sample JSON result
JSON
{
  "pk": 47591652,
  "uuid": "c57be131-f169-4fcb-92e5-f50cc7d923c4",
  "name": "ANNUITY_AWARD_LETTER",
  "created": "2024-03-14T22:46:07Z",
  "created_ts": "2024-03-14T22:46:07Z",
  "verified_pages_count": 1,
  "book_status": "ACTIVE",
  "id": 47591652,
  "forms": [
    {
      "pk": 53728412,
      "uuid": "d0b83d13-ab61-4e25-a139-4d1e4bfe4a77",
      "uploaded_doc_pk": 68363830,
      "form_type": "ANNUITY_AWARD_LETTER",
      "raw_fields": {
        "annuity_award_letter-Part1-General:issueDate": {
          "value": "11/21/2022",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "ANNUITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "annuity_award_letter-Part1-General:claimNumber": {
          "value": "123456",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "ANNUITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "annuity_award_letter-Part1-General:typeOfIncome": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "ANNUITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "annuity_award_letter-Part1-General:benefit1Amount": {
          "value": "75.03",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "ANNUITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "annuity_award_letter-Part1-General:benefit2Amount": {
          "value": "332.36",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "ANNUITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "annuity_award_letter-Part1-General:benefit3Amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "ANNUITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "annuity_award_letter-Part1-General:lumpSumBenefit": {
          "value": "27308.92",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "ANNUITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "annuity_award_letter-Part1-General:beneficiaryName": {
          "value": "CHARLES DOE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "ANNUITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "annuity_award_letter-Part1-General:benefit1EndDate": {
          "value": "08/02/2035",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "ANNUITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "annuity_award_letter-Part1-General:benefit2EndDate": {
          "value": "04/01/2032",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "ANNUITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "annuity_award_letter-Part1-General:benefit3EndDate": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "ANNUITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "annuity_award_letter-Part1-General:benefit1StartDate": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "ANNUITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "annuity_award_letter-Part1-General:benefit2StartDate": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "ANNUITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "annuity_award_letter-Part1-General:benefit3StartDate": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "ANNUITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "annuity_award_letter-Part1-General:issuingCompanyName": {
          "value": "NEW FAKE COMPANY & ANNUITY CORPORATION",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "ANNUITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "annuity_award_letter-Part1-General:socialSecurityNumber": {
          "value": "123-45-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "ANNUITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "annuity_award_letter-Part1-General:typeOfIncome-IfOther": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "ANNUITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "annuity_award_letter-Part1-General:beneficiaryAddress:city": {
          "value": "FAKE CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "ANNUITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "annuity_award_letter-Part1-General:totalMonthlyGrossIncome": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "ANNUITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "annuity_award_letter-Part1-General:beneficiaryAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "ANNUITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "annuity_award_letter-Part1-General:beneficiaryAddress:zipCode": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "ANNUITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "annuity_award_letter-Part1-General:beneficiaryAddress:addressLine1": {
          "value": "123 FAKE STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "ANNUITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "annuity_award_letter-Part1-General:beneficiaryAddress:addressLine2": {
          "value": "FL 1",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "ANNUITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 328528,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Income/Employment
Balance Sheet
Did this page help you?
Yes
No
TABLE OF CONTENTS
Field descriptions
Sample document
Sample JSON result
Home
Guides
API
Supported documents
Release notes

Ocrolus © 2025. All rights reserved. Legal | Privacy Policy