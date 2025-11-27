# Automated Payments Customer Authorization

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
Automated Payments Customer Authorization
Exclusive Buyer-Broker Representation Agreement
Identification
Income/Employment
Legal
Mortgage specific forms
Other
Property
Tax forms
Data types
Automated Payments Customer Authorization
Suggest Edits

An Automated Payments Customer Authorization is a document that grants the lender permission to electronically withdraw funds from the customer’s bank, credit union, or prepaid card account when a payment is due.

To use the Upload PDF endpoint for this document, you must use AUTOMATED_PAYMENTS_CUSTOMER_AUTHORIZATION in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
automated_payments_customer_authorization-Part1-General:date	Date	Date
automated_payments_customer_authorization-Part1-General:loanNumber	Text	Loan Number
automated_payments_customer_authorization-Part1-General:lender	Text	Lender
automated_payments_customer_authorization-Part1-General:borrowerName(S)	Text	Borrower Name(s)
automated_payments_customer_authorization-Part1-General:co-borrowerName(S)	Text	Co-Borrower Name(s)
automated_payments_customer_authorization-Part2-DebitAccountInformation:nameOfBank	Bank	Name Of Bank
automated_payments_customer_authorization-Part2-DebitAccountInformation:abaRoutingNumber	Routing Number	ABA Routing Number
automated_payments_customer_authorization-Part2-DebitAccountInformation:accountNumber	Integer	Account Number
automated_payments_customer_authorization-Part2-DebitAccountInformation:accountType:checking	CHECKED, NOT CHECKED	Account Type
automated_payments_customer_authorization-Part2-DebitAccountInformation:accountType:savings	CHECKED, NOT CHECKED	Account Type
automated_payments_customer_authorization-Part2-DebitAccountInformation:thisPaymentIsFor	Text	This Payment Is For
automated_payments_customer_authorization-Part3-DraftInformation:draftAccountOnTheSameDayEveryMonth	1ST, 5TH, 10TH, 15TH, OTHER	Draft Account On The Same Day Every Month
automated_payments_customer_authorization-Part3-DraftInformation:draftAccountOnTheSameDayEveryMonth-IfOther	Text	Draft Account On The Same Day Every Month - If Other
automated_payments_customer_authorization-Part3-DraftInformation:monthToBeginDraft	JANUARY, FEBRUARY, MARCH, APRIL, MAY, JUNE, JULY, AUGUST, SEPTEMBER, OCTOBER, NOVEMBER, DECEMBER	Month To Begin Draft
automated_payments_customer_authorization-Part3-DraftInformation:paymentAmount	Money	Payment Amount
automated_payments_customer_authorization-Part3-DraftInformation:additional$DraftedEachMonth	Money	Additional $ Drafted Each Month
automated_payments_customer_authorization-Part3-DraftInformation:totalDraftAmount	Money	Total Draft Amount
automated_payments_customer_authorization-Part4-Date&Sign:borrowerSignature	SIGNED, NOT SIGNED	Borrower Signature
automated_payments_customer_authorization-Part4-Date&Sign:borrowerSignatureDate	Date	Borrower Signature Date
automated_payments_customer_authorization-Part4-Date&Sign:co-borrowerSignature	SIGNED, NOT SIGNED	Co-Borrower Signature
automated_payments_customer_authorization-Part4-Date&Sign:co-borrowerSignatureDate	Date	Co-Borrower Signature Date
Sample document
drive.google.com
Automated Payments Customer Authorization.pdf
Sample JSON result
JSON
{
  "pk": 50811080,
  "uuid": "6688bd7d-72a8-4588-ae86-a50c1c4c5ee4",
  "name": "API - AUTOMATED_PAYMENTS_CUSTOMER_AUTHORIZATION",
  "created": "2024-05-30T18:10:31Z",
  "created_ts": "2024-05-30T18:10:31Z",
  "verified_pages_count": 3,
  "book_status": "ACTIVE",
  "id": 50811080,
  "forms": [
    {
      "pk": 55623188,
      "uuid": "9a5be624-55a2-4a4f-bf08-595c4ccc37a6",
      "uploaded_doc_pk": 72260084,
      "form_type": "AUTOMATED_PAYMENTS_CUSTOMER_AUTHORIZATION",
      "raw_fields": {
        "automated_payments_customer_authorization-Part1-General:date": {
          "value": "01/01/2024",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Automated Payments Customer Authorization.pdf",
          "confidence": 1.0
        },
        "automated_payments_customer_authorization-Part1-General:lender": {
          "value": "BREMER BANK",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Automated Payments Customer Authorization.pdf",
          "confidence": 1.0
        },
        "automated_payments_customer_authorization-Part1-General:loanNumber": {
          "value": "9999999999",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Automated Payments Customer Authorization.pdf",
          "confidence": 1.0
        },
        "automated_payments_customer_authorization-Part1-General:borrowerName(S)": {
          "value": "MARY FAKE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Automated Payments Customer Authorization.pdf",
          "confidence": 1.0
        },
        "automated_payments_customer_authorization-Part1-General:co-borrowerName(S)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Automated Payments Customer Authorization.pdf",
          "confidence": 1.0
        },
        "automated_payments_customer_authorization-Part4-Date&Sign:borrowerSignature": {
          "value": "SIGNED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Automated Payments Customer Authorization.pdf",
          "confidence": 1.0
        },
        "automated_payments_customer_authorization-Part3-DraftInformation:paymentAmount": {
          "value": "10000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Automated Payments Customer Authorization.pdf",
          "confidence": 1.0
        },
        "automated_payments_customer_authorization-Part4-Date&Sign:co-borrowerSignature": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Automated Payments Customer Authorization.pdf",
          "confidence": 1.0
        },
        "automated_payments_customer_authorization-Part4-Date&Sign:borrowerSignatureDate": {
          "value": "01/01/2024",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Automated Payments Customer Authorization.pdf",
          "confidence": 1.0
        },
        "automated_payments_customer_authorization-Part3-DraftInformation:totalDraftAmount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Automated Payments Customer Authorization.pdf",
          "confidence": 1.0
        },
        "automated_payments_customer_authorization-Part2-DebitAccountInformation:nameOfBank": {
          "value": "BREMER BANK",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Automated Payments Customer Authorization.pdf",
          "confidence": 1.0
        },
        "automated_payments_customer_authorization-Part3-DraftInformation:monthToBeginDraft": {
          "value": "JANUARY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Automated Payments Customer Authorization.pdf",
          "confidence": 1.0
        },
        "automated_payments_customer_authorization-Part4-Date&Sign:co-borrowerSignatureDate": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Automated Payments Customer Authorization.pdf",
          "confidence": 1.0
        },
        "automated_payments_customer_authorization-Part2-DebitAccountInformation:accountNumber": {
          "value": "1234567890",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Automated Payments Customer Authorization.pdf",
          "confidence": 1.0
        },
        "automated_payments_customer_authorization-Part2-DebitAccountInformation:abaRoutingNumber": {
          "value": "777777777",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Automated Payments Customer Authorization.pdf",
          "confidence": 1.0
        },
        "automated_payments_customer_authorization-Part2-DebitAccountInformation:thisPaymentIsFor": {
          "value": "LOAN",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Automated Payments Customer Authorization.pdf",
          "confidence": 1.0
        },
        "automated_payments_customer_authorization-Part2-DebitAccountInformation:accountType:savings": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Automated Payments Customer Authorization.pdf",
          "confidence": 1.0
        },
        "automated_payments_customer_authorization-Part2-DebitAccountInformation:accountType:checking": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Automated Payments Customer Authorization.pdf",
          "confidence": 1.0
        },
        "automated_payments_customer_authorization-Part3-DraftInformation:additional$DraftedEachMonth": {
          "value": "500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Automated Payments Customer Authorization.pdf",
          "confidence": 1.0
        },
        "automated_payments_customer_authorization-Part3-DraftInformation:draftAccountOnTheSameDayEveryMonth": {
          "value": "OTHER",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Automated Payments Customer Authorization.pdf",
          "confidence": 1.0
        },
        "automated_payments_customer_authorization-Part3-DraftInformation:draftAccountOnTheSameDayEveryMonth-IfOther": {
          "value": "14TH",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Automated Payments Customer Authorization.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 500850,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Disclosure
Exclusive Buyer-Broker Representation Agreement
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