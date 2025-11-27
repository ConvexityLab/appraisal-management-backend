# DAF 899 Request and Authorization for Permanent Change of Station

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
DAF 899 Request and Authorization for Permanent Change of Station
Suggest Edits

This is a formal document used by the United States Department of the Air Force to authorize and outline the details of a permanent change of station for Air Force personnel. This document includes key information such as the service member’s current and new duty station, reporting dates, travel entitlements, and any authorized expenses related to the move. The DAF 899 ensures that the PCS is approved and processed by military regulations, providing a clear record of the move for administrative and financial purposes.

To use the Upload PDF endpoint for this document, you must use DAF_899_REQUEST_AND_AUTHORIZATION_FOR_PERMANENT_CHANGE_OF_STATION in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
daf_899_request_and_authorization_for_permanent_change_of_station-Part-1-General:transferEffectiveDate(Ted)	Date	Transfer Effective Date (TED)
daf_899_request_and_authorization_for_permanent_change_of_station-Part-1-General:reportToComdrOrNewAssignmentNlt	Date	Report To Comdr Or New Assignment NLT
daf_899_request_and_authorization_for_permanent_change_of_station-Part-1-General:memberFirstName	Text	Member First Name
daf_899_request_and_authorization_for_permanent_change_of_station-Part-1-General:memberMiddleNameOrInitial	Text	Member Middle Name Or Initial
daf_899_request_and_authorization_for_permanent_change_of_station-Part-1-General:memberLastName	Text	Member Last Name
daf_899_request_and_authorization_for_permanent_change_of_station-Part-1-General:8.UnitMajorCommandAndAddressOfUnitFromWhichRelieved	Text	Unit Major Command And Address Of Unit From Which Relieved
daf_899_request_and_authorization_for_permanent_change_of_station-Part-1-General:unitFromWhichRelievedZipCode	ZIP Code	Unit From Which Relieved Zip Code
daf_899_request_and_authorization_for_permanent_change_of_station-Part-1-General:9.UnitMajorCommandAndAddressOfUnitToBeAssigned	Text	Unit Major Command And Address Of Unit To Be Assigned
daf_899_request_and_authorization_for_permanent_change_of_station-Part-1-General:unitToBeAssignedZipCode	ZIP Code	Unit To Be Assigned Zip Code
Sample document
drive.google.com
DAF_899_REQUEST_AND_AUTHORIZATION_FOR_PERMANENT_CHANGE_OF_STATION.pdf
Sample JSON result
JSON
{
  "pk": 50782334,
  "uuid": "7ad6bdc1-54a0-486f-b63e-a366ccbe832e",
  "name": "DAF_899_REQUEST_AND_AUTHORIZATION_FOR_PERMANENT_CHANGE_OF_STATION API",
  "created": "2024-05-29T18:15:58Z",
  "created_ts": "2024-05-29T18:15:58Z",
  "verified_pages_count": 2,
  "book_status": "ACTIVE",
  "id": 50782334,
  "forms": [
    {
      "pk": 55590454,
      "uuid": "8acf9333-a512-497d-9db5-407fd57a3f0d",
      "uploaded_doc_pk": 72181727,
      "form_type": "DAF_899_REQUEST_AND_AUTHORIZATION_FOR_PERMANENT_CHANGE_OF_STATION",
      "raw_fields": {
        "daf_899_request_and_authorization_for_permanent_change_of_station-Part-1-General:memberLastName": {
          "value": "DOE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DAF_899_REQUEST_AND_AUTHORIZATION_FOR_PERMANENT_CHANGE_OF_STATION.pdf",
          "confidence": 1.0
        },
        "daf_899_request_and_authorization_for_permanent_change_of_station-Part-1-General:memberFirstName": {
          "value": "JOHN",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DAF_899_REQUEST_AND_AUTHORIZATION_FOR_PERMANENT_CHANGE_OF_STATION.pdf",
          "confidence": 1.0
        },
        "daf_899_request_and_authorization_for_permanent_change_of_station-Part-1-General:unitToBeAssignedZipCode": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DAF_899_REQUEST_AND_AUTHORIZATION_FOR_PERMANENT_CHANGE_OF_STATION.pdf",
          "confidence": 1.0
        },
        "daf_899_request_and_authorization_for_permanent_change_of_station-Part-1-General:memberMiddleNameOrInitial": {
          "value": "D.",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DAF_899_REQUEST_AND_AUTHORIZATION_FOR_PERMANENT_CHANGE_OF_STATION.pdf",
          "confidence": 1.0
        },
        "daf_899_request_and_authorization_for_permanent_change_of_station-Part-1-General:transferEffectiveDate(Ted)": {
          "value": "01/01/2024",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DAF_899_REQUEST_AND_AUTHORIZATION_FOR_PERMANENT_CHANGE_OF_STATION.pdf",
          "confidence": 1.0
        },
        "daf_899_request_and_authorization_for_permanent_change_of_station-Part-1-General:unitFromWhichRelievedZipCode": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DAF_899_REQUEST_AND_AUTHORIZATION_FOR_PERMANENT_CHANGE_OF_STATION.pdf",
          "confidence": 1.0
        },
        "daf_899_request_and_authorization_for_permanent_change_of_station-Part-1-General:reportToComdrOrNewAssignmentNlt": {
          "value": "02/01/2024",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DAF_899_REQUEST_AND_AUTHORIZATION_FOR_PERMANENT_CHANGE_OF_STATION.pdf",
          "confidence": 1.0
        },
        "daf_899_request_and_authorization_for_permanent_change_of_station-Part-1-General:9.UnitMajorCommandAndAddressOfUnitToBeAssigned": {
          "value": "ABCD IL AB01 AB ABCDEF1020 SAMPLE SCOTT CA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DAF_899_REQUEST_AND_AUTHORIZATION_FOR_PERMANENT_CHANGE_OF_STATION.pdf",
          "confidence": 1.0
        },
        "daf_899_request_and_authorization_for_permanent_change_of_station-Part-1-General:8.UnitMajorCommandAndAddressOfUnitFromWhichRelieved": {
          "value": "ABC IL AB00 AB ABCDEF0020 SAMPLE PATTERSON OH",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DAF_899_REQUEST_AND_AUTHORIZATION_FOR_PERMANENT_CHANGE_OF_STATION.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 575068,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Credit Report
Department of the Army Permanent Change of Station Order
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