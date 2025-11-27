# Wage Garnishment Order

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
Wage Garnishment Order
Suggest Edits

This is a legal directive issued by a court or government agency that requires an employer to withhold a portion of an employee's wages to satisfy a debt or legal obligation, such as child support or unpaid taxes.

To use the Upload PDF endpoint for this document, you must use WAGE_GARNISHMENT_ORDER in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
wage_garnishment_order-Part1-General:dateOfThisOrder	Date	Date Of This Order
wage_garnishment_order-Part1-General:creditorAgency	Text	Creditor Agency
wage_garnishment_order-Part1-General:creditorAgencyMailingAddress:addressLine1	Text	Creditor Agency Mailing Address
wage_garnishment_order-Part1-General:creditorAgencyMailingAddress:addressLine2	Text	Creditor Agency Mailing Address
wage_garnishment_order-Part1-General:creditorAgencyMailingAddress:city	Text	Creditor Agency Mailing Address
wage_garnishment_order-Part1-General:creditorAgencyMailingAddress:state	State	Creditor Agency Mailing Address
wage_garnishment_order-Part1-General:creditorAgencyMailingAddress:zipcode	ZIP Code	Creditor Agency Mailing Address
wage_garnishment_order-Part2-GarnishmentInfo:debtorName	Text	Debtor Name
wage_garnishment_order-Part2-GarnishmentInfo:debtorSsn	Social Security Number	Debtor SSN
wage_garnishment_order-Part2-GarnishmentInfo:payPeriodFrequency	Text	Pay Period Frequency
wage_garnishment_order-Part2-GarnishmentInfo:disposableAmount	Money	Disposable Amount
wage_garnishment_order-Part2-GarnishmentInfo:paymentStatus	Text	Payment Status
wage_garnishment_order-Part2-GarnishmentInfo:durationOfTheGarnishment	Text	Duration Of The Garnishment
wage_garnishment_order-Part2-GarnishmentInfo:amountBeingGarnished	Money	Amount Being Garnished
Sample document
drive.google.com
API - INCOME WITHHOLDING ORDER (WAGE GARNISHMENT ORDER).pdf
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
      "pk": 49666454,
      "uuid": "ba4c7b55-37e8-4c02-8afc-7063937d233d",
      "uploaded_doc_pk": 59900599,
      "form_type": "WAGE_GARNISHMENT_ORDER",
      "raw_fields": {
        "wage_garnishment_order-Part1-General:creditorAgency": {
          "value": "U.S BANK",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - INCOME WITHHOLDING ORDER (WAGE GARNISHMENT ORDER).pdf",
          "confidence": 1.0
        },
        "wage_garnishment_order-Part1-General:dateOfThisOrder": {
          "value": "12/01/2022",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - INCOME WITHHOLDING ORDER (WAGE GARNISHMENT ORDER).pdf",
          "confidence": 1.0
        },
        "wage_garnishment_order-Part1-General:creditorAgencyMailingAddress:city": {
          "value": "CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - INCOME WITHHOLDING ORDER (WAGE GARNISHMENT ORDER).pdf",
          "confidence": 1.0
        },
        "wage_garnishment_order-Part1-General:creditorAgencyMailingAddress:state": {
          "value": "FL",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - INCOME WITHHOLDING ORDER (WAGE GARNISHMENT ORDER).pdf",
          "confidence": 1.0
        },
        "wage_garnishment_order-Part1-General:creditorAgencyMailingAddress:zipcode": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - INCOME WITHHOLDING ORDER (WAGE GARNISHMENT ORDER).pdf",
          "confidence": 1.0
        },
        "wage_garnishment_order-Part1-General:creditorAgencyMailingAddress:addressLine1": {
          "value": "123 SAMPLE VIEW",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - INCOME WITHHOLDING ORDER (WAGE GARNISHMENT ORDER).pdf",
          "confidence": 1.0
        },
        "wage_garnishment_order-Part1-General:creditorAgencyMailingAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - INCOME WITHHOLDING ORDER (WAGE GARNISHMENT ORDER).pdf",
          "confidence": 1.0
        },
        "wage_garnishment_order-Part2-GarnishmentInfo:debtorSsn": {
          "value": "567-12-1234",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - INCOME WITHHOLDING ORDER (WAGE GARNISHMENT ORDER).pdf",
          "confidence": 1.0
        },
        "wage_garnishment_order-Part2-GarnishmentInfo:debtorName": {
          "value": "JOHN SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - INCOME WITHHOLDING ORDER (WAGE GARNISHMENT ORDER).pdf",
          "confidence": 1.0
        },
        "wage_garnishment_order-Part2-GarnishmentInfo:paymentStatus": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - INCOME WITHHOLDING ORDER (WAGE GARNISHMENT ORDER).pdf",
          "confidence": 1.0
        },
        "wage_garnishment_order-Part2-GarnishmentInfo:disposableAmount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - INCOME WITHHOLDING ORDER (WAGE GARNISHMENT ORDER).pdf",
          "confidence": 1.0
        },
        "wage_garnishment_order-Part2-GarnishmentInfo:payPeriodFrequency": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - INCOME WITHHOLDING ORDER (WAGE GARNISHMENT ORDER).pdf",
          "confidence": 1.0
        },
        "wage_garnishment_order-Part2-GarnishmentInfo:amountBeingGarnished": {
          "value": "1250.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - INCOME WITHHOLDING ORDER (WAGE GARNISHMENT ORDER).pdf",
          "confidence": 1.0
        },
        "wage_garnishment_order-Part2-GarnishmentInfo:durationOfTheGarnishment": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - INCOME WITHHOLDING ORDER (WAGE GARNISHMENT ORDER).pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 255698,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Solar Panel Loan Agreement
Mortgage specific forms
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