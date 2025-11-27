# Federal Supporting Statements - Other Deductions

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
Legal
Mortgage specific forms
1003 (2009) - Uniform Residential Loan Application
1003 (2020) - Uniform Residential Loan Application
1003 (2020) - Uniform Residential Loan Application (Additional Borrower)
1003 (2020) - Uniform Residential Loan Application (Lender Loan Information)
1008 (2009) - Uniform Underwriting and Transmittal Summary
1008 (2018) - Uniform Underwriting and Transmittal Summary
Borrower Certification and Authorization
CAIVRS Authorization
Closing Disclosure
Closing Protection Letter
Divorce Decree
Federal Supporting Statements - Other Deductions
FHA Case Number Assignment
FHA Case Query
Flood Elevation Certificate
Gift Letter
IRS Form 4506-C - IVES Request for Transcript of Tax Return
IRS Form 4506-T - Request for Transcript of Tax Return
Loan Estimate
Mortgage Insurance Certificate
Mortgage Note
Pre-Approval Letter
Private Mortgage Payment
Standard Flood Hazard Determination Form
Title Insurance Policy
VA 26-8937 Verification of VA Benefits
VA Certificate of Eligibility
Wiring Instructions
Other
Property
Tax forms
Data types
Federal Supporting Statements - Other Deductions
Suggest Edits

Certain IRS income tax returns include Federal Supporting Statements that serve to itemize deductions. These statements break down and provide detailed information about the deductions, which are then consolidated and reflected on the main parent tax return.

To use the Upload PDF endpoint for this document, you must use FEDERAL_SUPPORTING_STATEMENTS_OTHER_DEDUCTIONS in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
federal_supporting_statements_other_deductions-Part1-General:year	Integer	Year
federal_supporting_statements_other_deductions-Part1-General:supportingStatement#	Integer	Supporting Statement #
federal_supporting_statements_other_deductions-Part1-General:parentFormName	1065, 1120, 1120S	Parent Form Name
federal_supporting_statements_other_deductions-Part1-General:entityName(S)AsShownOnReturn	Text	Entity Name(s) As Shown On Return
federal_supporting_statements_other_deductions-Part1-General:entityTaxId#	EIN	Entity Tax ID #
federal_supporting_statements_other_deductions-Part1-General:amortization	Money	Amortization
federal_supporting_statements_other_deductions-Part1-General:casualtyLoss	Money	Casualty Loss
federal_supporting_statements_other_deductions-Part1-General:otherDeductionsTotal	Money	Other Deductions Total
Sample document
drive.google.com
FEDERAL SUPPORTING STATEMENTS OTHER DEDUCTIONS.pdf
Sample JSON result
JSON
{
  "pk": 40915897,
  "uuid": "c1b0cf80-5734-4d20-884c-40e636798326",
  "name": "API documentations",
  "created": "2023-10-25T17:58:37Z",
  "created_ts": "2023-10-25T17:58:37Z",
  "verified_pages_count": 35,
  "book_status": "ACTIVE",
  "id": 40915897,
  "forms": [
    {
      "pk": 50924491,
      "uuid": "e19524fa-0fcb-4979-ac30-ec3deec188a8",
      "uploaded_doc_pk": 62051945,
      "form_type": "FEDERAL_SUPPORTING_STATEMENTS_OTHER_DEDUCTIONS",
      "raw_fields": {
        "federal_supporting_statements_other_deductions-Part1-General:year": {
          "value": "2022",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "FEDERAL SUPPORTING STATEMENTS OTHER DEDUCTIONS.pdf",
          "confidence": 1.0
        },
        "federal_supporting_statements_other_deductions-Part1-General:amortization": {
          "value": "589.80",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "FEDERAL SUPPORTING STATEMENTS OTHER DEDUCTIONS.pdf",
          "confidence": 1.0
        },
        "federal_supporting_statements_other_deductions-Part1-General:casualtyLoss": {
          "value": "230.56",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "FEDERAL SUPPORTING STATEMENTS OTHER DEDUCTIONS.pdf",
          "confidence": 1.0
        },
        "federal_supporting_statements_other_deductions-Part1-General:entityTaxId#": {
          "value": "12-3456789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "FEDERAL SUPPORTING STATEMENTS OTHER DEDUCTIONS.pdf",
          "confidence": 1.0
        },
        "federal_supporting_statements_other_deductions-Part1-General:parentFormName": {
          "value": "1065",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "FEDERAL SUPPORTING STATEMENTS OTHER DEDUCTIONS.pdf",
          "confidence": 1.0
        },
        "federal_supporting_statements_other_deductions-Part1-General:otherDeductionsTotal": {
          "value": "50000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "FEDERAL SUPPORTING STATEMENTS OTHER DEDUCTIONS.pdf",
          "confidence": 1.0
        },
        "federal_supporting_statements_other_deductions-Part1-General:supportingStatement#": {
          "value": "2",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "FEDERAL SUPPORTING STATEMENTS OTHER DEDUCTIONS.pdf",
          "confidence": 1.0
        },
        "federal_supporting_statements_other_deductions-Part1-General:entityName(S)AsShownOnReturn": {
          "value": "ANY COMPANY LLC",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "FEDERAL SUPPORTING STATEMENTS OTHER DEDUCTIONS.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 290592,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Divorce Decree
FHA Case Number Assignment
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