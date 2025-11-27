# Divorce Decree

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
Divorce Decree
Suggest Edits

This is a legal document issued by a court that finalizes the dissolution of a marriage. It outlines the terms and conditions of the divorce settlement, including matters such as child custody, visitation rights, child support, alimony (spousal support), division of assets, and any other relevant agreements reached between the divorcing parties. The divorce decree serves as an official record of the court's decision regarding the termination of the marriage and the resolution of related issues.

To use the Upload PDF endpoint for this document, you must use DIVORCE_DECREE in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
divorce_decree-Part1-General:effectiveDate	Date	Date Of Judgement Filing
divorce_decree-Part1-General:petitioner(Plaintiff)	Text	Petitioner (Plaintiff Or Beneficiary) Name
divorce_decree-Part1-General:address:addressLine1	Text	Petitioner Address
divorce_decree-Part1-General:address:addressLine2	Text	Petitioner Address
divorce_decree-Part1-General:address:city	Text	Petitioner Address
divorce_decree-Part1-General:address:state	State	Petitioner Address
divorce_decree-Part1-General:address:zipCode	ZIP Code	Petitioner Address
divorce_decree-Part1-General:responder(Respondent)	Text	Responder (Respondent) Name
divorce_decree-Part1-General:responder(Respondent)Address:addressLine1	Text	Responder (Respondent) Address
divorce_decree-Part1-General:responder(Respondent)Address:addressLine2	Text	Responder (Respondent) Address
divorce_decree-Part1-General:responder(Respondent)Address:city	Text	Responder (Respondent) Address
divorce_decree-Part1-General:responder(Respondent)Address:state	State	Responder (Respondent) Address
divorce_decree-Part1-General:responder(Respondent)Address:zipCode	ZIP Code	Responder (Respondent) Address
divorce_decree-Part2-Date&Amount:spousalMaintenanceStartDate	Date	Spousal Maintenance Start Date
divorce_decree-Part2-Date&Amount:spousalMaintenanceEndDate	Date	Spousal Maintenance End Date
divorce_decree-Part2-Date&Amount:spousalMonthlyMaintenanceAmount	Money	Spousal Monthly Maintenance Amount
divorce_decree-Part2-Date&Amount:childSupportStartDate	Date	Child Support Start Date
divorce_decree-Part2-Date&Amount:childSupportEndDate	Date	Child Support End Date
divorce_decree-Part2-Date&Amount:grossMonthlyChildSupportAmount	Money	Gross Monthly Child Support Amount
divorce_decree-Part2-Date&Amount:dobOfChild1	Date	DOB Of Child 1
divorce_decree-Part2-Date&Amount:dobOfChild2	Date	DOB Of Child 2
divorce_decree-Part2-Date&Amount:dobOfChild3	Date	DOB Of Child 3
divorce_decree-Part2-Date&Amount:ageOfChild1FromMarriage	Text	Age Of Child 1 From Marriage
divorce_decree-Part2-Date&Amount:ageOfChild2FromMarriage	Text	Age Of Child 2 From Marriage
divorce_decree-Part2-Date&Amount:ageOfChild3FromMarriage	Text	Age Of Child 3 From Marriage
Sample form
drive.google.com
DIVORCE_DECREE.pdf
Sample JSON result
JSON
{
  "pk": 47599949,
  "uuid": "e6a1fa79-6b77-4cc4-9369-40671897b010",
  "name": "DIVORCE_DECREE (API)",
  "created": "2024-03-15T04:15:10Z",
  "created_ts": "2024-03-15T04:15:10Z",
  "verified_pages_count": 4,
  "book_status": "ACTIVE",
  "id": 47599949,
  "forms": [
    {
      "pk": 53732704,
      "uuid": "f0193988-57f2-490f-8452-19e028fd30b2",
      "uploaded_doc_pk": 68370363,
      "form_type": "DIVORCE_DECREE",
      "raw_fields": {
        "divorce_decree-Part1-General:address:city": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "DIVORCE_DECREE.pdf",
          "confidence": 1.0
        },
        "divorce_decree-Part1-General:address:state": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "DIVORCE_DECREE.pdf",
          "confidence": 1.0
        },
        "divorce_decree-Part1-General:effectiveDate": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "DIVORCE_DECREE.pdf",
          "confidence": 1.0
        },
        "divorce_decree-Part1-General:address:zipCode": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "DIVORCE_DECREE.pdf",
          "confidence": 1.0
        },
        "divorce_decree-Part2-Date&Amount:dobOfChild1": {
          "value": "01/07/2016",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DIVORCE_DECREE.pdf",
          "confidence": 1.0
        },
        "divorce_decree-Part2-Date&Amount:dobOfChild2": {
          "value": "01/08/2018",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DIVORCE_DECREE.pdf",
          "confidence": 1.0
        },
        "divorce_decree-Part2-Date&Amount:dobOfChild3": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "DIVORCE_DECREE.pdf",
          "confidence": 1.0
        },
        "divorce_decree-Part1-General:address:addressLine1": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "DIVORCE_DECREE.pdf",
          "confidence": 1.0
        },
        "divorce_decree-Part1-General:address:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "DIVORCE_DECREE.pdf",
          "confidence": 1.0
        },
        "divorce_decree-Part1-General:petitioner(Plaintiff)": {
          "value": "MARY FAKE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DIVORCE_DECREE.pdf",
          "confidence": 1.0
        },
        "divorce_decree-Part1-General:responder(Respondent)": {
          "value": "JOHN FAKE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DIVORCE_DECREE.pdf",
          "confidence": 1.0
        },
        "divorce_decree-Part2-Date&Amount:ageOfChild1FromMarriage": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "DIVORCE_DECREE.pdf",
          "confidence": 1.0
        },
        "divorce_decree-Part2-Date&Amount:ageOfChild2FromMarriage": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "DIVORCE_DECREE.pdf",
          "confidence": 1.0
        },
        "divorce_decree-Part2-Date&Amount:ageOfChild3FromMarriage": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "DIVORCE_DECREE.pdf",
          "confidence": 1.0
        },
        "divorce_decree-Part1-General:responder(Respondent)Address:city": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "DIVORCE_DECREE.pdf",
          "confidence": 1.0
        },
        "divorce_decree-Part1-General:responder(Respondent)Address:state": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "DIVORCE_DECREE.pdf",
          "confidence": 1.0
        },
        "divorce_decree-Part1-General:responder(Respondent)Address:zipCode": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "DIVORCE_DECREE.pdf",
          "confidence": 1.0
        },
        "divorce_decree-Part1-General:responder(Respondent)Address:addressLine1": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "DIVORCE_DECREE.pdf",
          "confidence": 1.0
        },
        "divorce_decree-Part1-General:responder(Respondent)Address:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "DIVORCE_DECREE.pdf",
          "confidence": 1.0
        },
        "divorce_decree-Part2-Date&Amount:childSupportEndDate": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "DIVORCE_DECREE.pdf",
          "confidence": 1.0
        },
        "divorce_decree-Part2-Date&Amount:childSupportStartDate": {
          "value": "02/15/2022",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DIVORCE_DECREE.pdf",
          "confidence": 1.0
        },
        "divorce_decree-Part2-Date&Amount:grossMonthlyChildSupportAmount": {
          "value": "3762.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DIVORCE_DECREE.pdf",
          "confidence": 1.0
        },
        "divorce_decree-Part2-Date&Amount:spousalMaintenanceEndDate": {
          "value": "02/15/2027",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DIVORCE_DECREE.pdf",
          "confidence": 1.0
        },
        "divorce_decree-Part2-Date&Amount:spousalMaintenanceStartDate": {
          "value": "02/15/2022",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DIVORCE_DECREE.pdf",
          "confidence": 1.0
        },
        "divorce_decree-Part2-Date&Amount:spousalMonthlyMaintenanceAmount": {
          "value": "2100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DIVORCE_DECREE.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 471008,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Closing Protection Letter
Federal Supporting Statements - Other Deductions
Did this page help you?
Yes
No
TABLE OF CONTENTS
Field descriptions
Sample form
Sample JSON result
Home
Guides
API
Supported documents
Release notes

Ocrolus © 2025. All rights reserved. Legal | Privacy Policy