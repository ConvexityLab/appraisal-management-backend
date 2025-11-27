# Letter from the Payor (Alimony or Child Support)

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
Data types
Letter from the Payor (Alimony or Child Support)
Suggest Edits

This is a document typically directed to the recipient (payee), providing information about financial arrangements and details pertaining to support payments. It is often necessary for legal or administrative purposes.

To use the Upload PDF endpoint for this document, you must use LATTER_FROM_THE_PAYOR in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
letter_from_the_payor-Part1-General:dateOfTheLetter	Date	Date Of The Letter
letter_from_the_payor-Part1-General:payorName	Text	Payor Name
letter_from_the_payor-Part1-General:payorAddress:addressLine1	Text	Payor Address
letter_from_the_payor-Part1-General:payorAddress:addressLine2	Text	Payor Address
letter_from_the_payor-Part1-General:payorAddress:city	Text	Payor Address
letter_from_the_payor-Part1-General:payorAddress:state	State	Payor Address
letter_from_the_payor-Part1-General:payorAddress:zip	ZIP Code	Payor Address
letter_from_the_payor-Part1-General:borrowerName	Text	Borrower Name
letter_from_the_payor-Part1-General:borrowerAddress:addressLine1	Text	Borrower Address
letter_from_the_payor-Part1-General:borrowerAddress:addressLine2	Text	Borrower Address
letter_from_the_payor-Part1-General:borrowerAddress:city	Text	Borrower Address
letter_from_the_payor-Part1-General:borrowerAddress:state	State	Borrower Address
letter_from_the_payor-Part1-General:borrowerAddress:zip	ZIP Code	Borrower Address
letter_from_the_payor-Part2-AlimonyOrChildSupport:nameOfPerson/Children	Text	Name Of Person/Children
letter_from_the_payor-Part2-AlimonyOrChildSupport:amountOfPayments	Money	Amount Of Payments
letter_from_the_payor-Part2-AlimonyOrChildSupport:frequencyOfPayments	WEEKLY PAYMENTS, MONTHLY PAYMENTS, SEMI-MONTHLY PAYMENTS, OTHER	Frequency Of Payments
letter_from_the_payor-Part2-AlimonyOrChildSupport:frequencyOfPayments-OtherDescription	Text	Frequency Of Payments - Other Description
letter_from_the_payor-Part2-AlimonyOrChildSupport:durationOfPayments	Text	Duration Of Payments
letter_from_the_payor-Part2-AlimonyOrChildSupport:natureOfPayments	Text	Nature Of Payments
Sample document
drive.google.com
API - LETTER FROM THE PAYOR.pdf
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
      "pk": 49666313,
      "uuid": "0b0adf02-4879-4be5-bf18-dd981afc6880",
      "uploaded_doc_pk": 59900241,
      "form_type": "LETTER_FROM_THE_PAYOR",
      "raw_fields": {
        "letter_from_the_payor-Part1-General:payorName": {
          "value": "JOSEPH SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LETTER FROM THE PAYOR.pdf",
          "confidence": 1.0
        },
        "letter_from_the_payor-Part1-General:borrowerName": {
          "value": "ARDEN EXAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LETTER FROM THE PAYOR.pdf",
          "confidence": 1.0
        },
        "letter_from_the_payor-Part1-General:dateOfTheLetter": {
          "value": "10/01/2022",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LETTER FROM THE PAYOR.pdf",
          "confidence": 1.0
        },
        "letter_from_the_payor-Part1-General:payorAddress:zip": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LETTER FROM THE PAYOR.pdf",
          "confidence": 1.0
        },
        "letter_from_the_payor-Part1-General:payorAddress:city": {
          "value": "ANY CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LETTER FROM THE PAYOR.pdf",
          "confidence": 1.0
        },
        "letter_from_the_payor-Part1-General:payorAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LETTER FROM THE PAYOR.pdf",
          "confidence": 1.0
        },
        "letter_from_the_payor-Part1-General:borrowerAddress:zip": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LETTER FROM THE PAYOR.pdf",
          "confidence": 1.0
        },
        "letter_from_the_payor-Part1-General:borrowerAddress:city": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LETTER FROM THE PAYOR.pdf",
          "confidence": 1.0
        },
        "letter_from_the_payor-Part1-General:borrowerAddress:state": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LETTER FROM THE PAYOR.pdf",
          "confidence": 1.0
        },
        "letter_from_the_payor-Part1-General:payorAddress:addressLine1": {
          "value": "PO BOX 5432",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LETTER FROM THE PAYOR.pdf",
          "confidence": 1.0
        },
        "letter_from_the_payor-Part1-General:payorAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LETTER FROM THE PAYOR.pdf",
          "confidence": 1.0
        },
        "letter_from_the_payor-Part1-General:borrowerAddress:addressLine1": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LETTER FROM THE PAYOR.pdf",
          "confidence": 1.0
        },
        "letter_from_the_payor-Part1-General:borrowerAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LETTER FROM THE PAYOR.pdf",
          "confidence": 1.0
        },
        "letter_from_the_payor-Part2-AlimonyOrChildSupport:amountOfPayments": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LETTER FROM THE PAYOR.pdf",
          "confidence": 1.0
        },
        "letter_from_the_payor-Part2-AlimonyOrChildSupport:natureOfPayments": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LETTER FROM THE PAYOR.pdf",
          "confidence": 1.0
        },
        "letter_from_the_payor-Part2-AlimonyOrChildSupport:durationOfPayments": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LETTER FROM THE PAYOR.pdf",
          "confidence": 1.0
        },
        "letter_from_the_payor-Part2-AlimonyOrChildSupport:frequencyOfPayments": {
          "value": "MONTHLY PAYMENTS",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LETTER FROM THE PAYOR.pdf",
          "confidence": 1.0
        },
        "letter_from_the_payor-Part2-AlimonyOrChildSupport:nameOfPerson/Children": {
          "value": "AMISA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LETTER FROM THE PAYOR.pdf",
          "confidence": 1.0
        },
        "letter_from_the_payor-Part2-AlimonyOrChildSupport:frequencyOfPayments-OtherDescription": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LETTER FROM THE PAYOR.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 253269,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

ISO Application
Life Insurance Payment
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