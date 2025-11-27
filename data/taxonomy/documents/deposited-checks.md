# Deposited Checks

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
Deposited Checks
Suggest Edits

Deposited checks are proof-of-payment checks that have been paid by the payer's bank. Once payment has been made, the check is considered "canceled" to prevent it from being used again.

To use the Upload PDF endpoint for this document, you must use DEPOSITED_CHECK in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
deposited_check-part1:payerName	Text	Payer name
deposited_check-Part1:payerAddress:addressLine1	Text	Payer address
deposited_check-Part1:payerAddress:addressLine2	Text	Payer address
deposited_check-Part1:payerAddress:city	Text	Payer address
deposited_check-Part1:payerAddress:state	State	Payer address
deposited_check-Part1:payerAddress:zip	ZIP Code	Payer address
deposited_check-Part1:payerAddress:country	Text	Payer address
deposited_check-Part1:date	Date	Date
deposited_check-Part1:nameOfBank	Text	Name of bank
deposited_check-Part1:payerPhoneNumber	Phone Number	Payer phone number
deposited_check-Part1:textAmount	Text	Text amount
deposited_check-Part1:numericalAmount	Money	Numerical amount
deposited_check-Part2:topCheckNumber	Text	Top check number
deposited_check-Part2:bottomCheckNumber	Text	Bottom check number
deposited_check-Part2:routingNumber	Routing Number	Routing number
deposited_check-Part2:accountNumber	Integer	Account number
deposited_check-Part3:payeeName	Text	Payee name
deposited_check-Part3:payeeAddress:addressLine1	Text	Payee address
deposited_check-Part3:payeeAddress:addressLine2	Text	Payee address
deposited_check-Part3:payeeAddress:city	Text	Payee address
deposited_check-Part3:payeeAddress:state	State	Payee address
deposited_check-Part3:payeeAddress:zip	ZIP Code	Payee address
deposited_check-Part3:payeeAddress:country	Text	Payee address
deposited_check-Part3:memo	Text	Memo
deposited_check-Part3:proofOfSignature	SIGNED, NOT SIGNED	Signature
deposited_check-Part3:proofOfEndorsement	SIGNED, NOT SIGNED	Proof of endorsement
Sample document

Coming soon...

Sample JSON result
JSON
{
  "status": 200,
  "response": {
    "pk": 16780447,
    "uuid": "c84e24f9-a6df-4e98-a624-e5e6c4c89c8e",
    "name": "Deposited Check Output for API 2",
    "created": "2022-02-17T19:08:37Z",
    "created_ts": "2022-02-17T19:08:37Z",
    "verified_pages_count": 1,
    "book_status": "ACTIVE",
    "id": 16780447,
    "forms": [
      {
        "pk": 34670674,
        "uuid": "250096bc-c80b-4046-8cee-407dc5e470ed",
        "form_type": "DEPOSITED_CHECK",
        "raw_fields": {
          "deposited_check-Part1:date": {
            "value": "05/30/2020",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Sample 1 - Deposited Check.pdf"
          },
          "deposited_check-Part3:memo": {
            "value": "4689",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Sample 1 - Deposited Check.pdf"
          },
          "deposited_check-Part3:payeeName": {
            "value": "MICKEY ARTHUR",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Sample 1 - Deposited Check.pdf"
          },
          "deposited_check-part1:payerName": {
            "value": "MONTEFIORE HEALTH SYSTEM",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Sample 1 - Deposited Check.pdf"
          },
          "deposited_check-Part1:nameOfBank": {
            "value": "SOCIETE GENERALE",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Sample 1 - Deposited Check.pdf"
          },
          "deposited_check-Part1:textAmount": {
            "value": "NINE THOUSAND DOLLAR AND NO CENTS",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Sample 1 - Deposited Check.pdf"
          },
          "deposited_check-Part2:accountNumber": {
            "value": "18635887571",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Sample 1 - Deposited Check.pdf"
          },
          "deposited_check-Part2:routingNumber": {
            "value": "123654890",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Sample 1 - Deposited Check.pdf"
          },
          "deposited_check-Part2:topCheckNumber": {
            "value": "2815",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Sample 1 - Deposited Check.pdf"
          },
          "deposited_check-Part1:numericalAmount": {
            "value": "9000.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Sample 1 - Deposited Check.pdf"
          },
          "deposited_check-Part1:payerAddress:zip": {
            "value": "78944",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Sample 1 - Deposited Check.pdf"
          },
          "deposited_check-Part1:payerPhoneNumber": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "Sample 1 - Deposited Check.pdf"
          },
          "deposited_check-Part3:payeeAddress:zip": {
            "value": "14850",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Sample 1 - Deposited Check.pdf"
          },
          "deposited_check-Part3:proofOfSignature": {
            "value": "SIGNED",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Sample 1 - Deposited Check.pdf"
          },
          "deposited_check-Part1:payerAddress:city": {
            "value": "NEW YORK",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Sample 1 - Deposited Check.pdf"
          },
          "deposited_check-Part2:bottomCheckNumber": {
            "value": "2815",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Sample 1 - Deposited Check.pdf"
          },
          "deposited_check-Part3:payeeAddress:city": {
            "value": "ITHACA",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Sample 1 - Deposited Check.pdf"
          },
          "deposited_check-Part1:payerAddress:state": {
            "value": "NY",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Sample 1 - Deposited Check.pdf"
          },
          "deposited_check-Part3:payeeAddress:state": {
            "value": "NY",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Sample 1 - Deposited Check.pdf"
          },
          "deposited_check-Part3:proofOfEndorsement": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "Sample 1 - Deposited Check.pdf"
          },
          "deposited_check-Part1:payerAddress:country": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "Sample 1 - Deposited Check.pdf"
          },
          "deposited_check-Part3:payeeAddress:country": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "Sample 1 - Deposited Check.pdf"
          },
          "deposited_check-Part1:payerAddress:addressLine1": {
            "value": "12 MORE PARK",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Sample 1 - Deposited Check.pdf"
          },
          "deposited_check-Part1:payerAddress:addressLine2": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "Sample 1 - Deposited Check.pdf"
          },
          "deposited_check-Part3:payeeAddress:addressLine1": {
            "value": "135 FAIRGROUNDS MEMORIAL PKWY",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Sample 1 - Deposited Check.pdf"
          },
          "deposited_check-Part3:payeeAddress:addressLine2": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "Sample 1 - Deposited Check.pdf"
          }
        },
        "form_config_pk": 46396,
        "tables": []
      }
    ],
    "book_is_complete": true
  },
  "message": "OK"
}


Updated 11 months ago

Department of the Navy Permanent Change of Station Order
ISO Application
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