# Department of the Army Permanent Change of Station Order

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
Department of the Army Permanent Change of Station Order
Suggest Edits

The Department of the Army Permanent Change of Station (PCS) Order is an official document issued by the U.S. Army to authorize and direct the relocation of Army personnel from one duty station to another permanently. This order includes critical details such as the service member's current and new duty stations, reporting dates, authorized travel entitlements, transportation allowances, and any special instructions or conditions related to the move. The PCS Order ensures that the relocation is conducted according to Army regulations, providing necessary authorization and guidance to facilitate a smooth transition for the service member and their family, and serving as a record for administrative and financial purposes.

To use the Upload PDF endpoint for this document, you must use DEPARTMENT_OF_THE_ARMY_PERMANENT_CHANGE_OF_STATION_ORDER in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
department_of_the_army_permanent_change_of_station_order-Part1-General:effectiveDate	Date	Effective Date
department_of_the_army_permanent_change_of_station_order-Part1-General:reportDate	Date	Report Date
department_of_the_army_permanent_change_of_station_order-Part1-General:memberFirstName	Text	Member First Name
department_of_the_army_permanent_change_of_station_order-Part1-General:memberMiddleNameOrInitial	Text	Member Middle Name Or Initial
department_of_the_army_permanent_change_of_station_order-Part1-General:memberLastName	Text	Member Last Name
department_of_the_army_permanent_change_of_station_order-Part1-General:currentArmyBaseName	Text	Current Army Base Name
department_of_the_army_permanent_change_of_station_order-Part1-General:currentArmyBaseZipCode	ZIP Code	Current Army Base Zip Code
department_of_the_army_permanent_change_of_station_order-Part1-General:reportTo	Text	Report To
department_of_the_army_permanent_change_of_station_order-Part1-General:reportToZipCode	ZIP Code	Report To Zip Code
Sample document
drive.google.com
DEPARTMENT_OF_THE_ARMY_PERMANENT_CHANGE_OF_STATION_ORDER.pdf
Sample JSON result
JSON
{
  "pk": 50782565,
  "uuid": "d3f5dcd7-2cf3-4a3c-89b0-fa81f49c8058",
  "name": "DEPARTMENT_OF_THE_ARMY_PERMANENT_CHANGE",
  "created": "2024-05-29T18:20:14Z",
  "created_ts": "2024-05-29T18:20:14Z",
  "verified_pages_count": 1,
  "book_status": "ACTIVE",
  "id": 50782565,
  "forms": [
    {
      "pk": 55590551,
      "uuid": "90ea9d2e-179e-4e01-a0a1-c7cb8c2aa437",
      "uploaded_doc_pk": 72181990,
      "form_type": "DEPARTMENT_OF_THE_ARMY_PERMANENT_CHANGE_OF_STATION_ORDER",
      "raw_fields": {
        "department_of_the_army_permanent_change_of_station_order-Part1-General:reportTo": {
          "value": "WAGFAA - 0001 AR HHC 01 HEADQUARTERS AN KILLEEN, TX",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DEPARTMENT_OF_THE_ARMY_PERMANENT_CHANGE_OF_STATION_ORDER.pdf",
          "confidence": 1.0
        },
        "department_of_the_army_permanent_change_of_station_order-Part1-General:reportDate": {
          "value": "11/20/2022",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DEPARTMENT_OF_THE_ARMY_PERMANENT_CHANGE_OF_STATION_ORDER.pdf",
          "confidence": 1.0
        },
        "department_of_the_army_permanent_change_of_station_order-Part1-General:effectiveDate": {
          "value": "11/20/2022",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DEPARTMENT_OF_THE_ARMY_PERMANENT_CHANGE_OF_STATION_ORDER.pdf",
          "confidence": 1.0
        },
        "department_of_the_army_permanent_change_of_station_order-Part1-General:memberLastName": {
          "value": "FAKE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DEPARTMENT_OF_THE_ARMY_PERMANENT_CHANGE_OF_STATION_ORDER.pdf",
          "confidence": 1.0
        },
        "department_of_the_army_permanent_change_of_station_order-Part1-General:memberFirstName": {
          "value": "JAMIE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DEPARTMENT_OF_THE_ARMY_PERMANENT_CHANGE_OF_STATION_ORDER.pdf",
          "confidence": 1.0
        },
        "department_of_the_army_permanent_change_of_station_order-Part1-General:reportToZipCode": {
          "value": "54321",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DEPARTMENT_OF_THE_ARMY_PERMANENT_CHANGE_OF_STATION_ORDER.pdf",
          "confidence": 1.0
        },
        "department_of_the_army_permanent_change_of_station_order-Part1-General:currentArmyBaseName": {
          "value": "USA RCTG BN BALTIMORE FORT GEORGE G SAMPLE, MD",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DEPARTMENT_OF_THE_ARMY_PERMANENT_CHANGE_OF_STATION_ORDER.pdf",
          "confidence": 1.0
        },
        "department_of_the_army_permanent_change_of_station_order-Part1-General:currentArmyBaseZipCode": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DEPARTMENT_OF_THE_ARMY_PERMANENT_CHANGE_OF_STATION_ORDER.pdf",
          "confidence": 1.0
        },
        "department_of_the_army_permanent_change_of_station_order-Part1-General:memberMiddleNameOrInitial": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "DEPARTMENT_OF_THE_ARMY_PERMANENT_CHANGE_OF_STATION_ORDER.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 573474,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

DAF 899 Request and Authorization for Permanent Change of Station
Department of the Navy Permanent Change of Station Order
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