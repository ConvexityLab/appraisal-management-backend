# Coast Guard Standard Travel Order

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
Other
ACH Processing Application
Auto Loan Statement
Child Care Payment
Coast Guard Standard Travel Order
Credit Card Statement
Credit Report
DAF 899 Request and Authorization for Permanent Change of Station
Department of the Army Permanent Change of Station Order
Department of the Navy Permanent Change of Station Order
Deposited Checks
ISO Application
Letter from the Payor (Alimony or Child Support)
Life Insurance Payment
Marine Corps Basic Order
Merchant Processing Application
Rental Housing Payment
Solar Panel Payment Receipt
Stock Purchase Plan Payment
Student Loan Statement
Wire Remittance Statement
Property
Tax forms
Data types
Coast Guard Standard Travel Order
Suggest Edits

The Coast Guard Standard Travel Order (CGSTO) is an official document issued by the United States Coast Guard to authorize and detail the arrangements for official travel by Coast Guard personnel. It includes essential information such as the traveler's details, purpose of travel, itinerary, mode of transportation, financial data, entitlements, allowances, and any specific instructions or conditions related to the travel. The CGSTO ensures that the travel is conducted in compliance with regulatory and financial guidelines, providing necessary authorization and instructions for the traveler, and serving as a record for audit and reimbursement purposes.

To use the Upload PDF endpoint for this document, you must use COAST_GUARD_STANDARD_TRAVEL_ORDER in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
coast_guard_standard_travel_order-Part1-General:issueDt.	Date	Issue Dt.
coast_guard_standard_travel_order-Part1-General:rotationDt.	Date	Rotation Dt.
coast_guard_standard_travel_order-Part1-General:memberFirstName	Text	Member First Name
coast_guard_standard_travel_order-Part1-General:memberMiddleNameOrInitial	Text	Member Middle Name Or Initial
coast_guard_standard_travel_order-Part1-General:memberLastName	Text	Member Last Name
coast_guard_standard_travel_order-Part1-General:currentDutyStation	Text	Current Duty Station
coast_guard_standard_travel_order-Part1-General:currentDutyStationZipCode	ZIP Code	Current Duty Station Zip Code
coast_guard_standard_travel_order-Part1-General:reportToAddress	Text	Report To Address
coast_guard_standard_travel_order-Part1-General:reportToZipCode	ZIP Code	Report To Zip Code
coast_guard_standard_travel_order-Part1-General:estReportDate	Date	Est Report Date
Sample document
drive.google.com
COAST_GUARD_STANDARD_TRAVEL_ORDER.pdf


Sample JSON result
JSON
{
  "pk": 50782597,
  "uuid": "02c650f4-8a08-4d2c-aad6-9a6b4f22564f",
  "name": "MARINE_CORPS_BASIC_ORDER",
  "created": "2024-05-29T18:21:19Z",
  "created_ts": "2024-05-29T18:21:19Z",
  "verified_pages_count": 1,
  "book_status": "ACTIVE",
  "id": 50782597,
  "forms": [
    {
      "pk": 55590582,
      "uuid": "46395c2c-b145-401c-b4bb-2a5667146965",
      "uploaded_doc_pk": 72182088,
      "form_type": "MARINE_CORPS_BASIC_ORDER",
      "raw_fields": {
        "marine_corps_basic_order-Part1-General:futureCommand": {
          "value": "SPECIAL EDUCATION - ARIZONA FL",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MARINE_CORPS_BASIC_ORDER.pdf",
          "confidence": 1.0
        },
        "marine_corps_basic_order-Part1-General:memberLastName": {
          "value": "SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MARINE_CORPS_BASIC_ORDER.pdf",
          "confidence": 1.0
        },
        "marine_corps_basic_order-Part1-General:presentCommand": {
          "value": "CA123 CAMP",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MARINE_CORPS_BASIC_ORDER.pdf",
          "confidence": 1.0
        },
        "marine_corps_basic_order-Part1-General:memberFirstName": {
          "value": "JOHN",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MARINE_CORPS_BASIC_ORDER.pdf",
          "confidence": 1.0
        },
        "marine_corps_basic_order-Part1-General:estimatedDetachDate": {
          "value": "06/01/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MARINE_CORPS_BASIC_ORDER.pdf",
          "confidence": 1.0
        },
        "marine_corps_basic_order-Part1-General:hqmcOrderDetails(Date)": {
          "value": "05/14/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MARINE_CORPS_BASIC_ORDER.pdf",
          "confidence": 1.0
        },
        "marine_corps_basic_order-Part1-General:memberMiddleNameOrInitial": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MARINE_CORPS_BASIC_ORDER.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 581146,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Child Care Payment
Credit Card Statement
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