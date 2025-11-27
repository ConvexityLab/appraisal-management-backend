# Department of the Navy Permanent Change of Station Order

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
Department of the Navy Permanent Change of Station Order
Suggest Edits

The Department of the Navy Permanent Change of Station (PCS) Order is an official document issued by the U.S. Navy to authorize and manage the relocation of Navy personnel from one duty station to another permanently. This order includes essential information such as the service member's current and new duty stations, effective dates of transfer, travel entitlements, allowances for transportation and housing, and any specific instructions or conditions pertaining to the move. The PCS Order ensures the relocation process adheres to Navy regulations, providing necessary authorization and clear guidance to facilitate a seamless transition for the service member and their family, while also serving as a crucial record for administrative and financial management.

To use the Upload PDF endpoint for this document, you must use DEPARTMENT_OF_THE_NAVY_PCS_ORDER in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
department_of_the_navy_pcs_order-Part1-General:orderDate	Date	Order Date
department_of_the_navy_pcs_order-Part1-General:whenDirectedDetachIn	Date	When Directed Detach In
department_of_the_navy_pcs_order-Part1-General:memberFirstName	Text	Member First Name
department_of_the_navy_pcs_order-Part1-General:memberMiddleNameOrInitial	Text	Member Middle Name Or Initial
department_of_the_navy_pcs_order-Part1-General:memberLastName	Text	Member Last Name
department_of_the_navy_pcs_order-Part1-General:detachFrom	Text	Detach From
department_of_the_navy_pcs_order-Part1-General:reportTo	Text	Report To
Sample document
drive.google.com
DEPARTMENT_OF_THE_NAVY_PCS_ORDER.pdf
Sample JSON result
JSON
{
  "pk": 50782685,
  "uuid": "61261d96-f95f-46a2-ba04-935d1337c1d9",
  "name": "DEPARTMENT_OF_THE_NAVY_PCS_ORDER",
  "created": "2024-05-29T18:23:51Z",
  "created_ts": "2024-05-29T18:23:51Z",
  "verified_pages_count": 9,
  "book_status": "ACTIVE",
  "id": 50782685,
  "forms": [
    {
      "pk": 55591431,
      "uuid": "b4586f57-2fb1-4be0-bbe0-3b756f9b638b",
      "uploaded_doc_pk": 72184742,
      "form_type": "DEPARTMENT_OF_THE_NAVY_PCS_ORDER",
      "raw_fields": {
        "department_of_the_navy_pcs_order-Part1-General:orderDate": {
          "value": "05/22/2018",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DEPARTMENT_OF_THE_NAVY_PCS_ORDER.pdf",
          "confidence": 1.0
        },
        "department_of_the_navy_pcs_order-Part1-General:memberLastName": {
          "value": "SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DEPARTMENT_OF_THE_NAVY_PCS_ORDER.pdf",
          "confidence": 1.0
        },
        "department_of_the_navy_pcs_order-Part1-General:memberFirstName": {
          "value": "CHARLES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DEPARTMENT_OF_THE_NAVY_PCS_ORDER.pdf",
          "confidence": 1.0
        },
        "department_of_the_navy_pcs_order-Part1-General:memberMiddleNameOrInitial": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "DEPARTMENT_OF_THE_NAVY_PCS_ORDER.pdf",
          "confidence": 1.0
        },
        "department_of_the_navy_pcs_order-Part1-General:reportTo": {
          "value": "NAVSTA FAKE VA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DEPARTMENT_OF_THE_NAVY_PCS_ORDER.pdf",
          "confidence": 1.0
        },
        "department_of_the_navy_pcs_order-Part1-General:detachFrom": {
          "value": "CVN 76 FAKE REAGAN",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DEPARTMENT_OF_THE_NAVY_PCS_ORDER.pdf",
          "confidence": 1.0
        },
        "department_of_the_navy_pcs_order-Part1-General:whenDirectedDetachIn": {
          "value": "07/01/2018",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DEPARTMENT_OF_THE_NAVY_PCS_ORDER.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 593024,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Department of the Army Permanent Change of Station Order
Deposited Checks
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