# Child Care Payment

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
Child Care Payment
Suggest Edits

This document serves as confirmation of financial payments made by parents or guardians to childcare providers or facilities for the care and supervision of their children.

To use the Upload PDF endpoint for this document, you must use CHILD_CARE_PAYMENT in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
child_care_payment-Part1-General:dateOfPayment	Date	Date Of Payment
child_care_payment-Part1-General:childName	Text	Child Name
child_care_payment-Part1-General:parentName	Text	Parent Name
child_care_payment-Part1-General:paymentAmount	Money	Payment Amount
child_care_payment-Part1-General:paymentMethod	CASH, MONEY ORDER, CHECK, CREDIT CARD, TRANSFER FROM ACCOUNT, OTHER	Payment Method
child_care_payment-Part1-General:paymentMethod-Check:checkNumber	Integer	Payment Method - Check
child_care_payment-Part1-General:paymentMethod-TransferFromAccount:accountNumber	Text	Payment Method -Transfer From Account
child_care_payment-Part1-General:paymentMethod-Other:description	Text	Payment Method - Other
child_care_payment-Part1-General:providerName	Text	Provider Name
child_care_payment-Part1-General:providerAddress:addressLine1	Text	Provider Address
child_care_payment-Part1-General:providerAddress:addressLine2	Text	Provider Address
child_care_payment-Part1-General:providerAddress:city	Text	Provider Address
child_care_payment-Part1-General:providerAddress:state	State	Provider Address
child_care_payment-Part1-General:providerAddress:zip	ZIP Code	Provider Address
child_care_payment-Part1-General:providerPhoneNumber	Phone Number	Provider Phone Number
child_care_payment-Part1-General:writtenAgreementOrContractForChildCareServices	YES, NO	Written Agreement Or Contract For Child Care Services
Sample document
drive.google.com
API - CHILD CARE PAYMENT.pdf
Sample JSON result
JSON
{
  "pk": 39003158,
  "uuid": "80b9189e-86db-4881-9986-7eb730b94260",
  "name": "API - Q2 All Capture forms",
  "created": "2023-09-08T18:29:49Z",
  "created_ts": "2023-09-08T18:29:48Z",
  "verified_pages_count": 102,
  "book_status": "ACTIVE",
  "id": 39003158,
  "forms": [
    {
      "pk": 49746119,
      "uuid": "c468c7e0-4ff8-418d-b969-6e835eada3c1",
      "uploaded_doc_pk": 60006497,
      "form_type": "CHILD_CARE_PAYMENT",
      "raw_fields": {
        "child_care_payment-Part1-General:childName": {
          "value": "CHARLES FAKE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CHILD CARE PAYMENT.pdf",
          "confidence": 1.0
        },
        "child_care_payment-Part1-General:parentName": {
          "value": "ROBERT FAKE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CHILD CARE PAYMENT.pdf",
          "confidence": 1.0
        },
        "child_care_payment-Part1-General:providerName": {
          "value": "XYZ CARE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CHILD CARE PAYMENT.pdf",
          "confidence": 1.0
        },
        "child_care_payment-Part1-General:dateOfPayment": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - CHILD CARE PAYMENT.pdf",
          "confidence": 1.0
        },
        "child_care_payment-Part1-General:paymentAmount": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CHILD CARE PAYMENT.pdf",
          "confidence": 1.0
        },
        "child_care_payment-Part1-General:paymentMethod": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - CHILD CARE PAYMENT.pdf",
          "confidence": 1.0
        },
        "child_care_payment-Part1-General:providerAddress:zip": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CHILD CARE PAYMENT.pdf",
          "confidence": 1.0
        },
        "child_care_payment-Part1-General:providerPhoneNumber": {
          "value": "333-333-3333",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CHILD CARE PAYMENT.pdf",
          "confidence": 1.0,
          "irregular_datatype": true,
          "type_validation_error": "Invalid phone number."
        },
        "child_care_payment-Part1-General:providerAddress:city": {
          "value": "CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CHILD CARE PAYMENT.pdf",
          "confidence": 1.0
        },
        "child_care_payment-Part1-General:providerAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CHILD CARE PAYMENT.pdf",
          "confidence": 1.0
        },
        "child_care_payment-Part1-General:providerAddress:addressLine1": {
          "value": "123 FAKE STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CHILD CARE PAYMENT.pdf",
          "confidence": 1.0
        },
        "child_care_payment-Part1-General:providerAddress:addressLine2": {
          "value": "FL 1",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CHILD CARE PAYMENT.pdf",
          "confidence": 1.0
        },
        "child_care_payment-Part1-General:paymentMethod-Check:checkNumber": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - CHILD CARE PAYMENT.pdf",
          "confidence": 1.0
        },
        "child_care_payment-Part1-General:paymentMethod-Other:description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - CHILD CARE PAYMENT.pdf",
          "confidence": 1.0
        },
        "child_care_payment-Part1-General:writtenAgreementOrContractForChildCareServices": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - CHILD CARE PAYMENT.pdf",
          "confidence": 1.0
        },
        "child_care_payment-Part1-General:paymentMethod-TransferFromAccount:accountNumber": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - CHILD CARE PAYMENT.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 281065,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Auto Loan Statement
Coast Guard Standard Travel Order
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