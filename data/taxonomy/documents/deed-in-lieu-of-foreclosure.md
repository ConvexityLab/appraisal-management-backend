# Deed in Lieu of Foreclosure

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
Deed in Lieu of Foreclosure
Suggest Edits

This is a voluntary agreement between a homeowner and a mortgage lender, where the homeowner transfers the property title to the lender to avoid foreclosure, typically in exchange for debt forgiveness or the resolution of outstanding mortgage debt.

To use the Upload PDF endpoint for this document, you must use DEED_IN_LIEU_OF_FORECLOSURE in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
deed_in_lieu_of_foreclosure-Part1-General:dateOfTheForeclosureNoticeOrDeed	Date	Date Of The Foreclosure Notice Or Deed
deed_in_lieu_of_foreclosure-Part1-General:lenderName	Text	Lender Name
deed_in_lieu_of_foreclosure-Part1-General:lenderAddress:addressLine1	Text	Lender Address
deed_in_lieu_of_foreclosure-Part1-General:lenderAddress:addressLine2	Text	Lender Address
deed_in_lieu_of_foreclosure-Part1-General:lenderAddress:cityOrTown	Text	Lender Address
deed_in_lieu_of_foreclosure-Part1-General:lenderAddress:state	State	Lender Address
deed_in_lieu_of_foreclosure-Part1-General:lenderAddress:zipCode	ZIP Code	Lender Address
deed_in_lieu_of_foreclosure-Part1-General:borrowerName	Text	Borrower Name
deed_in_lieu_of_foreclosure-Part1-General:borrowerAddress:addressLine1	Text	Borrower Address
deed_in_lieu_of_foreclosure-Part1-General:borrowerAddress:addressLine2	Text	Borrower Address
deed_in_lieu_of_foreclosure-Part1-General:borrowerAddress:cityOrTown	Text	Borrower Address
deed_in_lieu_of_foreclosure-Part1-General:borrowerAddress:state	State	Borrower Address
deed_in_lieu_of_foreclosure-Part1-General:borrowerAddress:zipCode	ZIP Code	Borrower Address
deed_in_lieu_of_foreclosure-Part2-Details:propertyAddressAndDescription:addressLine1	Text	Property Address And Description
deed_in_lieu_of_foreclosure-Part2-Details:propertyAddressAndDescription:addressLine2	Text	Property Address And Description
deed_in_lieu_of_foreclosure-Part2-Details:propertyAddressAndDescription:cityOrTown	Text	Property Address And Description
deed_in_lieu_of_foreclosure-Part2-Details:propertyAddressAndDescription:state	State	Property Address And Description
deed_in_lieu_of_foreclosure-Part2-Details:propertyAddressAndDescription:zipCode	ZIP Code	Property Address And Description
deed_in_lieu_of_foreclosure-Part2-Details:propertyAddressAndDescription:description	Text	Property Address And Description
deed_in_lieu_of_foreclosure-Part2-Details:anyOutstandingBalances	Money	Any Outstanding Balances
deed_in_lieu_of_foreclosure-Part2-Details:anyPenalties	Money	Any Penalties
Sample document
drive.google.com
API - DEED IN LIEU OF FORECLOSURE.pdf
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
      "pk": 49725307,
      "uuid": "02a86dcb-9c6d-46b1-b65a-90c1b3b0ae56",
      "uploaded_doc_pk": 59975816,
      "form_type": "DEED_IN_LIEU_OF_FORECLOSURE",
      "raw_fields": {
        "deed_in_lieu_of_foreclosure-Part1-General:lenderName": {
          "value": "SAMPLE MORTAGE LLC",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - DEED IN LIEU OF FORECLOSURE.pdf",
          "confidence": 1.0
        },
        "deed_in_lieu_of_foreclosure-Part1-General:borrowerName": {
          "value": "JOHN SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - DEED IN LIEU OF FORECLOSURE.pdf",
          "confidence": 1.0
        },
        "deed_in_lieu_of_foreclosure-Part2-Details:anyPenalties": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - DEED IN LIEU OF FORECLOSURE.pdf",
          "confidence": 1.0
        },
        "deed_in_lieu_of_foreclosure-Part1-General:lenderAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - DEED IN LIEU OF FORECLOSURE.pdf",
          "confidence": 1.0
        },
        "deed_in_lieu_of_foreclosure-Part1-General:borrowerAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - DEED IN LIEU OF FORECLOSURE.pdf",
          "confidence": 1.0
        },
        "deed_in_lieu_of_foreclosure-Part1-General:lenderAddress:zipCode": {
          "value": "12345-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - DEED IN LIEU OF FORECLOSURE.pdf",
          "confidence": 1.0
        },
        "deed_in_lieu_of_foreclosure-Part2-Details:anyOutstandingBalances": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - DEED IN LIEU OF FORECLOSURE.pdf",
          "confidence": 1.0
        },
        "deed_in_lieu_of_foreclosure-Part1-General:borrowerAddress:zipCode": {
          "value": "12345-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - DEED IN LIEU OF FORECLOSURE.pdf",
          "confidence": 1.0
        },
        "deed_in_lieu_of_foreclosure-Part1-General:lenderAddress:cityOrTown": {
          "value": "SAMPLE CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - DEED IN LIEU OF FORECLOSURE.pdf",
          "confidence": 1.0
        },
        "deed_in_lieu_of_foreclosure-Part1-General:borrowerAddress:cityOrTown": {
          "value": "FAKE CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - DEED IN LIEU OF FORECLOSURE.pdf",
          "confidence": 1.0
        },
        "deed_in_lieu_of_foreclosure-Part1-General:lenderAddress:addressLine1": {
          "value": "123 FAKE MEMORIAL STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - DEED IN LIEU OF FORECLOSURE.pdf",
          "confidence": 1.0
        },
        "deed_in_lieu_of_foreclosure-Part1-General:lenderAddress:addressLine2": {
          "value": "UNIT #12",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - DEED IN LIEU OF FORECLOSURE.pdf",
          "confidence": 1.0
        },
        "deed_in_lieu_of_foreclosure-Part1-General:borrowerAddress:addressLine1": {
          "value": "123 FAKE STREET AVENUE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - DEED IN LIEU OF FORECLOSURE.pdf",
          "confidence": 1.0
        },
        "deed_in_lieu_of_foreclosure-Part1-General:borrowerAddress:addressLine2": {
          "value": "#12",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - DEED IN LIEU OF FORECLOSURE.pdf",
          "confidence": 1.0
        },
        "deed_in_lieu_of_foreclosure-Part1-General:dateOfTheForeclosureNoticeOrDeed": {
          "value": "01/01/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - DEED IN LIEU OF FORECLOSURE.pdf",
          "confidence": 1.0
        },
        "deed_in_lieu_of_foreclosure-Part2-Details:propertyAddressAndDescription:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - DEED IN LIEU OF FORECLOSURE.pdf",
          "confidence": 1.0
        },
        "deed_in_lieu_of_foreclosure-Part2-Details:propertyAddressAndDescription:zipCode": {
          "value": "12345-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - DEED IN LIEU OF FORECLOSURE.pdf",
          "confidence": 1.0
        },
        "deed_in_lieu_of_foreclosure-Part2-Details:propertyAddressAndDescription:cityOrTown": {
          "value": "FAKE CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - DEED IN LIEU OF FORECLOSURE.pdf",
          "confidence": 1.0
        },
        "deed_in_lieu_of_foreclosure-Part2-Details:propertyAddressAndDescription:description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - DEED IN LIEU OF FORECLOSURE.pdf",
          "confidence": 1.0
        },
        "deed_in_lieu_of_foreclosure-Part2-Details:propertyAddressAndDescription:addressLine1": {
          "value": "123 ABC FAKE STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - DEED IN LIEU OF FORECLOSURE.pdf",
          "confidence": 1.0
        },
        "deed_in_lieu_of_foreclosure-Part2-Details:propertyAddressAndDescription:addressLine2": {
          "value": "SUITE 1",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - DEED IN LIEU OF FORECLOSURE.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 260962,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Court Order
Foreclosure Notice
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