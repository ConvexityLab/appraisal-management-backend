# Marine Corps Basic Order

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
Marine Corps Basic Order
Suggest Edits

A Marine Corps Basic Order is an official directive issued by the Commandant of the Marine Corps or other authorized entities within the Marine Corps. These orders provide policies, procedures, and guidelines for a wide range of activities and administrative tasks, including permanent change of station.

To use the Upload PDF endpoint for this document, you must use MARINE_CORPS_BASIC_ORDER in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
marine_corps_basic_order-Part1-General:hqmcOrderDetails(Date)	Date	HQMC Order Details (Date)
marine_corps_basic_order-Part1-General:estimatedDetachDate	Date	Estimated Detach Date
marine_corps_basic_order-Part1-General:reportNoLaterThan	Date	Report No Later Than
marine_corps_basic_order-Part1-General:memberFirstName	Text	Member First Name
marine_corps_basic_order-Part1-General:memberMiddleNameOrInitial	Text	Member Middle Name Or Initial
marine_corps_basic_order-Part1-General:memberLastName	Text	Member Last Name
marine_corps_basic_order-Part1-General:presentCommand	Text	Present Command
marine_corps_basic_order-Part1-General:futureCommand	Text	Future Command
Sample document
drive.google.com
MARINE_CORPS_BASIC_ORDER.pdf
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
                    "confidence": 1
                },
                "marine_corps_basic_order-Part1-General:memberLastName": {
                    "value": "SAMPLE",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "MARINE_CORPS_BASIC_ORDER.pdf",
                    "confidence": 1
                },
                "marine_corps_basic_order-Part1-General:presentCommand": {
                    "value": "CA123 CAMP",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "MARINE_CORPS_BASIC_ORDER.pdf",
                    "confidence": 1
                },
                "marine_corps_basic_order-Part1-General:memberFirstName": {
                    "value": "JOHN",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "MARINE_CORPS_BASIC_ORDER.pdf",
                    "confidence": 1
                },
                "marine_corps_basic_order-Part1-General:estimatedDetachDate": {
                    "value": "06/01/2023",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "MARINE_CORPS_BASIC_ORDER.pdf",
                    "confidence": 1
                },
                "marine_corps_basic_order-Part1-General:hqmcOrderDetails(Date)": {
                    "value": "05/14/2023",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "MARINE_CORPS_BASIC_ORDER.pdf",
                    "confidence": 1
                },
                "marine_corps_basic_order-Part1-General:reportNoLaterThan": {
                    "value": "07/31/2023",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "MARINE_CORPS_BASIC_ORDER.pdf",
                    "confidence": 1
                },
                "marine_corps_basic_order-Part1-General:memberMiddleNameOrInitial": {
                    "value": "",
                    "is_empty": true,
                    "alias_used": null,
                    "source_filename": "MARINE_CORPS_BASIC_ORDER.pdf",
                    "confidence": 1
                }
            },
            "form_config_pk": 581146,
            "tables": [],
            "attribute_data": null
        }
    ],
    "book_is_complete": true
}


Updated 3 months ago

Life Insurance Payment
Merchant Processing Application
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