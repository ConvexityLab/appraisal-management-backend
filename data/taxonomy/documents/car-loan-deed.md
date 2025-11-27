# Car Loan Deed

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
Car Loan Deed
Court Judgment
Court Order
Deed in Lieu of Foreclosure
Foreclosure Notice
Loan Agreement
Professional Liability Insurance
Release of Judgment or Lien
Solar Panel Lease Agreement
Solar Panel Loan Agreement
Wage Garnishment Order
Mortgage specific forms
Other
Property
Tax forms
Data types
Car Loan Deed
Suggest Edits

This document is a legally binding agreement that delineates the terms and conditions of a car loan. It specifies the lender's rights and the borrower's obligations regarding the financed vehicle.

To use the Upload PDF endpoint for this document, you must use CAR_LOAN_DEED in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
car_loan_deed-Part1-General:dateOfDeed	Date	Date Of Deed
car_loan_deed-Part1-General:lenderName	Text	Lender Name
car_loan_deed-Part1-General:lenderAddress:addressLine1	Text	Lender Address
car_loan_deed-Part1-General:lenderAddress:addressLine2	Text	Lender Address
car_loan_deed-Part1-General:lenderAddress:city	Text	Lender Address
car_loan_deed-Part1-General:lenderAddress:state	State	Lender Address
car_loan_deed-Part1-General:lenderAddress:zip	ZIP Code	Lender Address
car_loan_deed-Part1-General:lenderPhoneNumber	Phone Number	Lender Phone Number
car_loan_deed-Part1-General:borrowerName	Text	Borrower Name
car_loan_deed-Part1-General:borrowerAddress:addressLine1	Text	Borrower Address
car_loan_deed-Part1-General:borrowerAddress:addressLine2	Text	Borrower Address
car_loan_deed-Part1-General:borrowerAddress:city	Text	Borrower Address
car_loan_deed-Part1-General:borrowerAddress:state	State	Borrower Address
car_loan_deed-Part1-General:borrowerAddress:zip	ZIP Code	Borrower Address
car_loan_deed-Part1-General:borrowerPhoneNumber	Phone Number	Borrower Phone Number
car_loan_deed-Part1-General:accountNumber	Text	Account Number
car_loan_deed-Part1-General:loanAmount	Money	Loan Amount
car_loan_deed-Part1-General:loanTerm	Text	Loan Term
car_loan_deed-Part1-General:paymentTerm	Text	Payment Term
car_loan_deed-Part1-General:outstandingBalance	Money	Outstanding Balance
car_loan_deed-Part1-General:penaltiesAmount	Money	Penalties Amount
Sample document
drive.google.com
API - CAR LOAN DEED.pdf
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
      "pk": 49666206,
      "uuid": "3eaa9b1e-36e7-4941-9e2b-110df932e3d7",
      "uploaded_doc_pk": 59900037,
      "form_type": "CAR_LOAN_DEED",
      "raw_fields": {
        "car_loan_deed-Part1-General:loanTerm": {
          "value": "4 YEARS",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CAR LOAN DEED.pdf",
          "confidence": 1.0
        },
        "car_loan_deed-Part1-General:dateOfDeed": {
          "value": "11/11/2021",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CAR LOAN DEED.pdf",
          "confidence": 1.0
        },
        "car_loan_deed-Part1-General:lenderName": {
          "value": "XYZ FINANCIAL",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CAR LOAN DEED.pdf",
          "confidence": 1.0
        },
        "car_loan_deed-Part1-General:loanAmount": {
          "value": "19000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CAR LOAN DEED.pdf",
          "confidence": 1.0
        },
        "car_loan_deed-Part1-General:paymentTerm": {
          "value": "MONTHLY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CAR LOAN DEED.pdf",
          "confidence": 1.0
        },
        "car_loan_deed-Part1-General:borrowerName": {
          "value": "ANDREW SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CAR LOAN DEED.pdf",
          "confidence": 1.0
        },
        "car_loan_deed-Part1-General:accountNumber": {
          "value": "1234567890",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CAR LOAN DEED.pdf",
          "confidence": 1.0
        },
        "car_loan_deed-Part1-General:lenderAddress:zip": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CAR LOAN DEED.pdf",
          "confidence": 1.0
        },
        "car_loan_deed-Part1-General:lenderPhoneNumber": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - CAR LOAN DEED.pdf",
          "confidence": 1.0
        },
        "car_loan_deed-Part1-General:lenderAddress:city": {
          "value": "CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CAR LOAN DEED.pdf",
          "confidence": 1.0
        },
        "car_loan_deed-Part1-General:outstandingBalance": {
          "value": "19000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CAR LOAN DEED.pdf",
          "confidence": 1.0
        },
        "car_loan_deed-Part1-General:borrowerAddress:zip": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CAR LOAN DEED.pdf",
          "confidence": 1.0
        },
        "car_loan_deed-Part1-General:borrowerPhoneNumber": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - CAR LOAN DEED.pdf",
          "confidence": 1.0
        },
        "car_loan_deed-Part1-General:lenderAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CAR LOAN DEED.pdf",
          "confidence": 1.0
        },
        "car_loan_deed-Part1-General:borrowerAddress:city": {
          "value": "FAKE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CAR LOAN DEED.pdf",
          "confidence": 1.0
        },
        "car_loan_deed-Part1-General:borrowerAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CAR LOAN DEED.pdf",
          "confidence": 1.0
        },
        "car_loan_deed-Part1-General:lenderAddress:addressLine1": {
          "value": "111 FAKE STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CAR LOAN DEED.pdf",
          "confidence": 1.0
        },
        "car_loan_deed-Part1-General:lenderAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - CAR LOAN DEED.pdf",
          "confidence": 1.0
        },
        "car_loan_deed-Part1-General:borrowerAddress:addressLine1": {
          "value": "123 FAKE STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CAR LOAN DEED.pdf",
          "confidence": 1.0
        },
        "car_loan_deed-Part1-General:borrowerAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - CAR LOAN DEED.pdf",
          "confidence": 1.0
        },
        "car_loan_deed-Part1-General:penaltiesAmount": {
          "value": "50.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CAR LOAN DEED.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 276186,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Legal
Court Judgment
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