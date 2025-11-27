# Release of Judgment or Lien

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
Release of Judgment or Lien
Suggest Edits

This is a legal document confirming the removal or satisfaction of a judgment or lien against a property or individual, typically indicating that the associated debt or obligation has been settled or discharged.

To use the Upload PDF endpoint for this document, you must use RELEASE_OF_JUDGMENT_OR_LIEN in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
release_of_judgment_or_lien-Part1-General:creditorName	Text	Creditor Name
release_of_judgment_or_lien-Part1-General:filedDate	Date	Filed Date
release_of_judgment_or_lien-Part1-General:courtName	Text	Court Name
release_of_judgment_or_lien-Part1-General:caseNumber	Text	Case Number
release_of_judgment_or_lien-Part1-General:amountOwed	Money	Amount Owed
release_of_judgment_or_lien-Part1-General:paymentStatus	PAID IN FULL, PARTIAL PAYMENT, DISPUTED, PENDING, OTHER	Payment Status
release_of_judgment_or_lien-Part1-General:paymentStatus-Other:description	Text	Payment Status - Other
release_of_judgment_or_lien-Part1-General:datePaid	Date	Date Paid
release_of_judgment_or_lien-Part1-General:durationOfTheJudgmentOrLien	Text	Duration Of The Judgment Or Lien
release_of_judgment_or_lien-Part1-General:typeOfJudgmentOrLien	Text	Type Of Judgment Or Lien
Sample document
drive.google.com
API - RELEASE OF JUDGMENT_LIEN.pdf
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
      "pk": 49666342,
      "uuid": "24450d59-e9ed-45f5-85f6-c5b03a238504",
      "uploaded_doc_pk": 59900305,
      "form_type": "RELEASE_OF_JUDGMENT_OR_LIEN",
      "raw_fields": {
        "release_of_judgment_or_lien-Part1-General:datePaid": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RELEASE OF JUDGMENT_LIEN.pdf",
          "confidence": 1.0
        },
        "release_of_judgment_or_lien-Part1-General:courtName": {
          "value": "DISTRICT COURT OF FAKE COUNTY, TEXAS",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - RELEASE OF JUDGMENT_LIEN.pdf",
          "confidence": 1.0
        },
        "release_of_judgment_or_lien-Part1-General:filedDate": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RELEASE OF JUDGMENT_LIEN.pdf",
          "confidence": 1.0
        },
        "release_of_judgment_or_lien-Part1-General:amountOwed": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RELEASE OF JUDGMENT_LIEN.pdf",
          "confidence": 1.0
        },
        "release_of_judgment_or_lien-Part1-General:caseNumber": {
          "value": "2019CV012345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - RELEASE OF JUDGMENT_LIEN.pdf",
          "confidence": 1.0
        },
        "release_of_judgment_or_lien-Part1-General:creditorName": {
          "value": "JOSEPH FAKE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - RELEASE OF JUDGMENT_LIEN.pdf",
          "confidence": 1.0
        },
        "release_of_judgment_or_lien-Part1-General:paymentStatus": {
          "value": "PAID IN FULL",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - RELEASE OF JUDGMENT_LIEN.pdf",
          "confidence": 1.0
        },
        "release_of_judgment_or_lien-Part1-General:typeOfJudgmentOrLien": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RELEASE OF JUDGMENT_LIEN.pdf",
          "confidence": 1.0
        },
        "release_of_judgment_or_lien-Part1-General:durationOfTheJudgmentOrLien": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RELEASE OF JUDGMENT_LIEN.pdf",
          "confidence": 1.0
        },
        "release_of_judgment_or_lien-Part1-General:paymentStatus-Other:description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RELEASE OF JUDGMENT_LIEN.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 276181,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Professional Liability Insurance
Solar Panel Lease Agreement
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