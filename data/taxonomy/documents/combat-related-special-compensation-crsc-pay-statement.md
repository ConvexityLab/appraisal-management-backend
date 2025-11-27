# Combat-Related Special Compensation (CRSC) Pay Statement

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
Annuity Award Letter
Balance Sheet
Career Data Brief
Change in Benefits Notice
Combat-Related Special Compensation (CRSC) Pay Statement
Disability Award Letter
IRS Form SSA-1099 - Social Security Benefit Statement
Member Data Summary
Office of Personnel Management (OPM) Annuity Statement
Income calculation definitions
Pay Stub
Pension Award Letter
Profit and Loss Statement
Social Security Award Letter
Soldier Talent Profile
Veterans Affairs (VA) Award Letter
VOE (1005) - Request for Verification of Employment
VOE (generic) - Verification of Employment Report
VOE (work number) - The Work Number Verification of Employment Report
VOIE (Finicity) - Finicity Verification of Income and Employment
Legal
Mortgage specific forms
Other
Property
Tax forms
Data types
Combat-Related Special Compensation (CRSC) Pay Statement
Suggest Edits

This form type is a payment statement issued to eligible military retirees under the Combat-Related Special Compensation (CRSC) program. It details tax-free monthly payments granted to veterans with combat-related disabilities.

To use the Upload PDF endpoint for this document, you must use CRSC_PAY_STATEMENT in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
crsc_pay_statement-Part01-General:statementEffectiveDate	Date	Statement Effective Date
crsc_pay_statement-Part01-General:paymentDate	Date	Payment Date
crsc_pay_statement-Part01-General:ssn	Social Security Number	SSN
crsc_pay_statement-Part01-General:retiree'sName	Text	Retiree's Name
crsc_pay_statement-Part01-General:retiree'sAddress:addressLine1	Text	Retiree's Address
crsc_pay_statement-Part01-General:retiree'sAddress:addressLine2	Text	Retiree's Address
crsc_pay_statement-Part01-General:retiree'sAddress:city	Text	Retiree's Address
crsc_pay_statement-Part01-General:retiree'sAddress:state	State	Retiree's Address
crsc_pay_statement-Part01-General:retiree'sAddress:zip	ZIP Code	Retiree's Address
crsc_pay_statement-Part01-General:crscNetPay	Money	CRSC Net Pay
Sample document
drive.google.com
CRSC PAY STATEMENT.pdf
Sample JSON result
JSON
{
  "pk": 61387631,
  "uuid": "6cc92441-8cd0-4cb2-80f2-a73a7df6ffb9",
  "name": "CRSC_PAY_STATEMENT",
  "created": "2025-05-22T21:45:10Z",
  "created_ts": "2025-05-22T21:45:10Z",
  "verified_pages_count": 1,
  "book_status": "ACTIVE",
  "id": 61387631,
  "forms": [
    {
      "pk": 67813919,
      "uuid": "b14f269f-fe84-4723-b4f5-632268a1458f",
      "uploaded_doc_pk": 99572001,
      "form_type": "CRSC_PAY_STATEMENT",
      "form_config_pk": 1558780,
      "tables": [],
      "attribute_data": null,
      "raw_fields": {
        "crsc_pay_statement-Part01-General:ssn": {
          "value": "***-**-1234",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "CRSC PAY STATEMENT.pdf",
          "confidence": 1.0
        },
        "crsc_pay_statement-Part01-General:crscNetPay": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "CRSC PAY STATEMENT.pdf",
          "confidence": 1.0
        },
        "crsc_pay_statement-Part01-General:paymentDate": {
          "value": "12/31/2024",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "CRSC PAY STATEMENT.pdf",
          "confidence": 1.0
        },
        "crsc_pay_statement-Part01-General:retiree'sName": {
          "value": "JOHN SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "CRSC PAY STATEMENT.pdf",
          "confidence": 1.0
        },
        "crsc_pay_statement-Part01-General:retiree'sAddress:zip": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "CRSC PAY STATEMENT.pdf",
          "confidence": 1.0
        },
        "crsc_pay_statement-Part01-General:retiree'sAddress:city": {
          "value": "ANY CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "CRSC PAY STATEMENT.pdf",
          "confidence": 1.0
        },
        "crsc_pay_statement-Part01-General:retiree'sAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "CRSC PAY STATEMENT.pdf",
          "confidence": 1.0
        },
        "crsc_pay_statement-Part01-General:statementEffectiveDate": {
          "value": "12/31/2024",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "CRSC PAY STATEMENT.pdf",
          "confidence": 1.0
        },
        "crsc_pay_statement-Part01-General:retiree'sAddress:addressLine1": {
          "value": "123 ANY STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "CRSC PAY STATEMENT.pdf",
          "confidence": 1.0
        },
        "crsc_pay_statement-Part01-General:retiree'sAddress:addressLine2": {
          "value": "APT #12",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "CRSC PAY STATEMENT.pdf",
          "confidence": 1.0
        }
      }
    }
  ],
  "book_is_complete": true
}


Updated about 1 month ago

Change in Benefits Notice
Disability Award Letter
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