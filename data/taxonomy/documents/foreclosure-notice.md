# Foreclosure Notice

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
Car Loan Deed
Court Judgment
Court Order
Deed in Lieu of Foreclosure
Foreclosure Notice
Loan Agreement
Professional Liability Insurance
Release of Judgment or Lien
Solar Panel Lease Agreement
Solar Panel Loan Agreement
Wage Garnishment Order
Mortgage specific forms
Other
Property
Tax forms
Data types
Foreclosure Notice
Suggest Edits

This is a voluntary arrangement between a homeowner and a mortgage lender. In this agreement, the homeowner transfers the property title to the lender to prevent foreclosure. This arrangement is usually in exchange for debt forgiveness or the resolution of outstanding mortgage debt.

To use the Upload PDF endpoint for this document, you must use FORECLOSURE_NOTICE in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
foreclosure_notice-Part1-LenderDetails:foreclosureNoticeDate	Date	Foreclosure Notice Date
foreclosure_notice-Part1-LenderDetails:lenderName	Text	Lender Name
foreclosure_notice-Part1-LenderDetails:lenderAddress:addressLine1	Text	Lender Address
foreclosure_notice-Part1-LenderDetails:lenderAddress:addressLine2	Text	Lender Address
foreclosure_notice-Part1-LenderDetails:lenderAddress:cityOrTown	Text	Lender Address
foreclosure_notice-Part1-LenderDetails:lenderAddress:state	State	Lender Address
foreclosure_notice-Part1-LenderDetails:lenderAddress:zipCode	ZIP Code	Lender Address
foreclosure_notice-Part2-BorrowerDetails:borrowerName	Text	Borrower Name
foreclosure_notice-Part2-BorrowerDetails:borrowerAddress:addressLine1	Text	Borrower Address
foreclosure_notice-Part2-BorrowerDetails:borrowerAddress:addressLine2	Text	Borrower Address
foreclosure_notice-Part2-BorrowerDetails:borrowerAddress:cityOrTown	Text	Borrower Address
foreclosure_notice-Part2-BorrowerDetails:borrowerAddress:state	State	Borrower Address
foreclosure_notice-Part2-BorrowerDetails:borrowerAddress:zipCode	ZIP Code	Borrower Address
foreclosure_notice-Part3-LoanDetails:loanNumber	Text	Loan Number
foreclosure_notice-Part3-LoanDetails:propertyAddressAndDescription:addressLine1	Text	Property Address And Description
foreclosure_notice-Part3-LoanDetails:propertyAddressAndDescription:addressLine2	Text	Property Address And Description
foreclosure_notice-Part3-LoanDetails:propertyAddressAndDescription:cityOrTown	Text	Property Address And Description
foreclosure_notice-Part3-LoanDetails:propertyAddressAndDescription:state	State	Property Address And Description
foreclosure_notice-Part3-LoanDetails:propertyAddressAndDescription:zipCode	ZIP Code	Property Address And Description
foreclosure_notice-Part3-LoanDetails:propertyAddressAndDescription:description	Text	Property Address And Description
foreclosure_notice-Part3-LoanDetails:outstandingAmount	Money	Outstanding Amount
foreclosure_notice-Part3-LoanDetails:defaultAmount	Money	Default Amount
foreclosure_notice-Part3-LoanDetails:defaultCureOrPenaltiesAmount	Money	Default Cure or Penalties Amount
foreclosure_notice-Part3-LoanDetails:defaultDays	Integer	Default Days
Sample document
drive.google.com
API - FORECLOSURE NOTICE.pdf
Sample JSON result
JSON
{
  "pk": 39003158,
  "uuid": "80b9189e-86db-4881-9986-7eb730b94260",
  "name": "API - Q2 All Capture forms",
  "created": "2023-09-08T18:29:49Z",
  "created_ts": "2023-09-08T18:29:48Z",
  "verified_pages_count": 89,
  "book_status": "ACTIVE",
  "id": 39003158,
  "forms": [
    {
      "pk": 49666299,
      "uuid": "567ed599-e208-413d-a558-a7ecee522096",
      "uploaded_doc_pk": 59900215,
      "form_type": "FORECLOSURE_NOTICE",
      "raw_fields": {
        "foreclosure_notice-Part3-LoanDetails:loanNumber": {
          "value": "123546789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - FORECLOSURE NOTICE.pdf",
          "confidence": 1.0
        },
        "foreclosure_notice-Part3-LoanDetails:defaultDays": {
          "value": "90",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - FORECLOSURE NOTICE.pdf",
          "confidence": 1.0
        },
        "foreclosure_notice-Part1-LenderDetails:lenderName": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - FORECLOSURE NOTICE.pdf",
          "confidence": 1.0
        },
        "foreclosure_notice-Part3-LoanDetails:defaultAmount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - FORECLOSURE NOTICE.pdf",
          "confidence": 1.0
        },
        "foreclosure_notice-Part2-BorrowerDetails:borrowerName": {
          "value": "SAMPLE DOE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - FORECLOSURE NOTICE.pdf",
          "confidence": 1.0
        },
        "foreclosure_notice-Part1-LenderDetails:foreclosureNoticeDate": {
          "value": "01/01/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - FORECLOSURE NOTICE.pdf",
          "confidence": 1.0
        },
        "foreclosure_notice-Part2-BorrowerDetails:borrowerAddress:state": {
          "value": "CA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - FORECLOSURE NOTICE.pdf",
          "confidence": 1.0
        },
        "foreclosure_notice-Part2-BorrowerDetails:borrowerAddress:zipCode": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - FORECLOSURE NOTICE.pdf",
          "confidence": 1.0
        },
        "foreclosure_notice-Part2-BorrowerDetails:borrowerAddress:cityOrTown": {
          "value": "ANY CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - FORECLOSURE NOTICE.pdf",
          "confidence": 1.0
        },
        "foreclosure_notice-Part2-BorrowerDetails:borrowerAddress:addressLine1": {
          "value": "12 ANY STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - FORECLOSURE NOTICE.pdf",
          "confidence": 1.0
        },
        "foreclosure_notice-Part2-BorrowerDetails:borrowerAddress:addressLine2": {
          "value": "APT 12",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - FORECLOSURE NOTICE.pdf",
          "confidence": 1.0
        },
        "foreclosure_notice-Part3-LoanDetails:propertyAddressAndDescription:state": {
          "value": "MA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - FORECLOSURE NOTICE.pdf",
          "confidence": 1.0
        },
        "foreclosure_notice-Part3-LoanDetails:propertyAddressAndDescription:zipCode": {
          "value": "54321",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - FORECLOSURE NOTICE.pdf",
          "confidence": 1.0
        },
        "foreclosure_notice-Part3-LoanDetails:propertyAddressAndDescription:cityOrTown": {
          "value": "SAMPLE CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - FORECLOSURE NOTICE.pdf",
          "confidence": 1.0
        },
        "foreclosure_notice-Part3-LoanDetails:propertyAddressAndDescription:description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - FORECLOSURE NOTICE.pdf",
          "confidence": 1.0
        },
        "foreclosure_notice-Part3-LoanDetails:propertyAddressAndDescription:addressLine1": {
          "value": "123 SAMPLE STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - FORECLOSURE NOTICE.pdf",
          "confidence": 1.0
        },
        "foreclosure_notice-Part3-LoanDetails:propertyAddressAndDescription:addressLine2": {
          "value": "SUITE 12",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - FORECLOSURE NOTICE.pdf",
          "confidence": 1.0
        },
        "foreclosure_notice-Part3-LoanDetails:outstandingAmount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - FORECLOSURE NOTICE.pdf",
          "confidence": 1.0
        },
        "foreclosure_notice-Part1-LenderDetails:lenderAddress:state": {
          "value": "CA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - FORECLOSURE NOTICE.pdf",
          "confidence": 1.0
        },
        "foreclosure_notice-Part1-LenderDetails:lenderAddress:zipCode": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - FORECLOSURE NOTICE.pdf",
          "confidence": 1.0
        },
        "foreclosure_notice-Part1-LenderDetails:lenderAddress:cityOrTown": {
          "value": "ANY CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - FORECLOSURE NOTICE.pdf",
          "confidence": 1.0
        },
        "foreclosure_notice-Part1-LenderDetails:lenderAddress:addressLine1": {
          "value": "012 SOUTH E",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - FORECLOSURE NOTICE.pdf",
          "confidence": 1.0
        },
        "foreclosure_notice-Part1-LenderDetails:lenderAddress:addressLine2": {
          "value": "UNIT 12",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - FORECLOSURE NOTICE.pdf",
          "confidence": 1.0
        },
        "foreclosure_notice-Part3-LoanDetails:defaultCureOrPenaltiesAmount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - FORECLOSURE NOTICE.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 276190,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Deed in Lieu of Foreclosure
Loan Agreement
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