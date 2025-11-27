# Solar Panel Loan Agreement

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
Solar Panel Loan Agreement
Suggest Edits

This is a financial contract where a borrower secures a loan to finance the purchase and installation of solar panels, with the panels serving as collateral for the loan.

To use the Upload PDF endpoint for this document, you must use SOLAR_PANEL_LOAN_AGREEMENT in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
solar_panel_loan_agreement-Part1-General:dateOfAgreement	Date	Date Of Agreement
solar_panel_loan_agreement-Part1-General:agreementType	Text	Agreement Type
solar_panel_loan_agreement-Part1-General:agreementDuration	Text	Agreement Duration
solar_panel_loan_agreement-Part1-General:monthlyPayment	Money	Monthly Payment
solar_panel_loan_agreement-Part1-General:paymentStatus	PAID, NOT PAID	Payment Status
solar_panel_loan_agreement-Part1-General:paymentDueAmount	Money	Payment Due Amount
solar_panel_loan_agreement-Part1-General:paymentDueDate	Date	Payment Due Date
solar_panel_loan_agreement-Part1-General:interestRate	Percentage	Interest Rate
solar_panel_loan_agreement-Part1-General:loanAmount	Money	Loan Amount
solar_panel_loan_agreement-Part1-General:outstandingBalance	Money	Outstanding Balance
solar_panel_loan_agreement-Part2-LenderInformation:lenderName	Text	Lender Name
solar_panel_loan_agreement-Part2-LenderInformation:lenderAddress:addressLine1	Text	Lender Address
solar_panel_loan_agreement-Part2-LenderInformation:lenderAddress:addressLine2	Text	Lender Address
solar_panel_loan_agreement-Part2-LenderInformation:lenderAddress:city	Text	Lender Address
solar_panel_loan_agreement-Part2-LenderInformation:lenderAddress:state	State	Lender Address
solar_panel_loan_agreement-Part2-LenderInformation:lenderAddress:zipCode	ZIP Code	Lender Address
solar_panel_loan_agreement-Part3-BorrowerInformation:borrowerName	Text	Borrower Name
solar_panel_loan_agreement-Part3-BorrowerInformation:borrowerAddress:addressLine1	Text	Borrower Address
solar_panel_loan_agreement-Part3-BorrowerInformation:borrowerAddress:addressLine2	Text	Borrower Address
solar_panel_loan_agreement-Part3-BorrowerInformation:borrowerAddress:city	Text	Borrower Address
solar_panel_loan_agreement-Part3-BorrowerInformation:borrowerAddress:state	State	Borrower Address
solar_panel_loan_agreement-Part3-BorrowerInformation:borrowerAddress:zipCode	ZIP Code	Borrower Address
Sample document
drive.google.com
API - SOLAR PANEL LOAN AGREEMENT.pdf
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
      "pk": 49727426,
      "uuid": "8bb0fb18-1edc-4fd3-a62c-4649879f9b7c",
      "uploaded_doc_pk": 59979984,
      "form_type": "SOLAR_PANEL_LOAN_AGREEMENT",
      "raw_fields": {
        "solar_panel_loan_agreement-Part1-General:paymentStatus": {
          "value": "NOT PAID",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_loan_agreement-Part1-General:monthlyPayment": {
          "value": "9500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_loan_agreement-Part1-General:paymentDueDate": {
          "value": "6/10/2013",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_loan_agreement-Part1-General:paymentDueAmount": {
          "value": "9500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_loan_agreement-Part2-LenderInformation:lenderName": {
          "value": "MAY DOE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_loan_agreement-Part3-BorrowerInformation:borrowerName": {
          "value": "JAMES DOE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_loan_agreement-Part2-LenderInformation:lenderAddress:city": {
          "value": "FAKE CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_loan_agreement-Part2-LenderInformation:lenderAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_loan_agreement-Part2-LenderInformation:lenderAddress:zipCode": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_loan_agreement-Part3-BorrowerInformation:borrowerAddress:city": {
          "value": "ANY CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_loan_agreement-Part3-BorrowerInformation:borrowerAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_loan_agreement-Part3-BorrowerInformation:borrowerAddress:zipCode": {
          "value": "12345-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_loan_agreement-Part2-LenderInformation:lenderAddress:addressLine1": {
          "value": "123 FAKE STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_loan_agreement-Part2-LenderInformation:lenderAddress:addressLine2": {
          "value": "FL 1",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_loan_agreement-Part3-BorrowerInformation:borrowerAddress:addressLine1": {
          "value": "12345 SAMPLE STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_loan_agreement-Part3-BorrowerInformation:borrowerAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_loan_agreement-Part1-General:agreementType": {
          "value": "TERM LOAN",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_loan_agreement-Part1-General:dateOfAgreement": {
          "value": "03/03/2013",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_loan_agreement-Part1-General:agreementDuration": {
          "value": "3 YEAR",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_loan_agreement-Part1-General:loanAmount": {
          "value": "200000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_loan_agreement-Part1-General:interestRate": {
          "value": "10.00%",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_loan_agreement-Part1-General:outstandingBalance": {
          "value": "100000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL LOAN AGREEMENT.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 276184,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Solar Panel Lease Agreement
Wage Garnishment Order
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