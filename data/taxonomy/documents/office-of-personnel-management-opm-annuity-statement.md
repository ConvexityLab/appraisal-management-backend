# Office of Personnel Management (OPM) Annuity Statement

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
Office of Personnel Management (OPM) Annuity Statement
Suggest Edits

This form type, issued by the OPM, details monthly annuity payments and related information. It includes gross annuity amount, potential deductions or additions (like income tax withholding), and net amount. This statement records retirement income and is crucial for understanding retirement benefits and tax purposes.

To use the Upload PDF endpoint for this document, you must use OFFICE_OF_PERSONNEL_MANAGEMENT_ANNUITY_STATEMENT in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
office_of_personnel_management_annuity_statement-Part01-General:nameOfAnnuitant	Text	Name Of Annuitant
office_of_personnel_management_annuity_statement-Part01-General:annuitantAddress:addressLine1	Text	Annuitant Address
office_of_personnel_management_annuity_statement-Part01-General:annuitantAddress:addressLine2	Text	Annuitant Address
office_of_personnel_management_annuity_statement-Part01-General:annuitantAddress:city	Text	Annuitant Address
office_of_personnel_management_annuity_statement-Part01-General:annuitantAddress:state	State	Annuitant Address
office_of_personnel_management_annuity_statement-Part01-General:annuitantAddress:zip	ZIP Code	Annuitant Address
office_of_personnel_management_annuity_statement-Part01-General:paymentDated	Date	Payment Dated
office_of_personnel_management_annuity_statement-Part01-General:grossAmountOfAnnuity	Money	Gross Amount Of Annuity
office_of_personnel_management_annuity_statement-Part01-General:netAmountOfAnnuity	Money	Net Amount Of Annuity
Sample document
drive.google.com
OFFICE OF PERSONNEL MANAGEMENT ANNUITY STATEMENT.pdf
Sample JSON result
JSON
{
  "pk": 61387565,
  "uuid": "70740119-4651-4fa6-a2b5-fdf305108e26",
  "name": "OFFICE_OF_PERSONNEL_MANAGEMENT_ANNUITY_STATEMENT",
  "created": "2025-05-22T21:43:23Z",
  "created_ts": "2025-05-22T21:43:23Z",
  "verified_pages_count": 1,
  "book_status": "ACTIVE",
  "id": 61387565,
  "forms": [
    {
      "pk": 67813889,
      "uuid": "1446e187-4780-4ac2-86bd-5dd69dd82ce2",
      "uploaded_doc_pk": 99571915,
      "form_type": "OFFICE_OF_PERSONNEL_MANAGEMENT_ANNUITY_STATEMENT",
      "form_config_pk": 1558781,
      "tables": [],
      "attribute_data": null,
      "raw_fields": {
        "office_of_personnel_management_annuity_statement-Part01-General:paymentDated": {
          "value": "01/02/2020",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "OFFICE OF PERSONNEL MANAGEMENT ANNUITY STATEMENT.pdf",
          "confidence": 1.0
        },
        "office_of_personnel_management_annuity_statement-Part01-General:nameOfAnnuitant": {
          "value": "JOHN SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "OFFICE OF PERSONNEL MANAGEMENT ANNUITY STATEMENT.pdf",
          "confidence": 1.0
        },
        "office_of_personnel_management_annuity_statement-Part01-General:netAmountOfAnnuity": {
          "value": "90.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "OFFICE OF PERSONNEL MANAGEMENT ANNUITY STATEMENT.pdf",
          "confidence": 1.0
        },
        "office_of_personnel_management_annuity_statement-Part01-General:annuitantAddress:zip": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "OFFICE OF PERSONNEL MANAGEMENT ANNUITY STATEMENT.pdf",
          "confidence": 1.0
        },
        "office_of_personnel_management_annuity_statement-Part01-General:grossAmountOfAnnuity": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "OFFICE OF PERSONNEL MANAGEMENT ANNUITY STATEMENT.pdf",
          "confidence": 1.0
        },
        "office_of_personnel_management_annuity_statement-Part01-General:annuitantAddress:city": {
          "value": "NEW CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "OFFICE OF PERSONNEL MANAGEMENT ANNUITY STATEMENT.pdf",
          "confidence": 1.0
        },
        "office_of_personnel_management_annuity_statement-Part01-General:annuitantAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "OFFICE OF PERSONNEL MANAGEMENT ANNUITY STATEMENT.pdf",
          "confidence": 1.0
        },
        "office_of_personnel_management_annuity_statement-Part01-General:annuitantAddress:addressLine1": {
          "value": "123ANY SW STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "OFFICE OF PERSONNEL MANAGEMENT ANNUITY STATEMENT.pdf",
          "confidence": 1.0
        },
        "office_of_personnel_management_annuity_statement-Part01-General:annuitantAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "OFFICE OF PERSONNEL MANAGEMENT ANNUITY STATEMENT.pdf",
          "confidence": 1.0
        }
      }
    }
  ],
  "book_is_complete": true
}


Updated about 1 month ago

Member Data Summary
Income calculation definitions
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