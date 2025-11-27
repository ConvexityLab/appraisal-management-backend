# Auto Loan Statement

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
Auto Loan Statement
Suggest Edits

The Auto Loan Statement is a recurring financial statement furnished by a lender to a borrower, offering a concise overview of the car loan, encompassing payment history, outstanding balance, and pertinent financial particulars.

To use the Upload PDF endpoint for this document, you must use AUTO_LOAN_STATEMENT in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
auto_loan_statement-Part1-General:date	Date	Date
auto_loan_statement-Part1-General:loanAmount	Money	Loan Amount
auto_loan_statement-Part1-General:loanTerm/Period	Text	Loan Term/Period
auto_loan_statement-Part1-General:outstandingBalance	Money	Outstanding Balance
auto_loan_statement-Part1-General:interestRate	Percentage	Interest Rate
auto_loan_statement-Part1-General:penaltyAmount	Money	Penalty Amount
auto_loan_statement-Part1-General:paymentStatus	PAID, NOT PAID	Payment Status
auto_loan_statement-Part1-General:paymentDueAmount	Money	Payment Due Amount
auto_loan_statement-Part1-General:dueDate	Date	Payment Due Date
auto_loan_statement-Part2-LenderInformation:lenderName	Text	Lender Name
auto_loan_statement-Part2-LenderInformation:lenderAddress:addressLine1	Text	Lender Address (addressLine1)
auto_loan_statement-Part2-LenderInformation:lenderAddress:addressLine2	Text	Lender Address (addressLine2)
auto_loan_statement-Part2-LenderInformation:lenderAddress:city	Text	Lender Address (city)
auto_loan_statement-Part2-LenderInformation:lenderAddress:state	State	Lender Address (state)
auto_loan_statement-Part2-LenderInformation:lenderAddress:zipCode	ZIP Code	Lender Address (ZIP Code)
auto_loan_statement-Part3-BorrowerInformation:borrowerName	Text	Borrower Name
auto_loan_statement-Part3-BorrowerInformation:borrowerAddress:addressLine1	Text	Borrower Address (addressLine1)
auto_loan_statement-Part3-BorrowerInformation:borrowerAddress:addressLine2	Text	Borrower Address (addressLine2)
auto_loan_statement-Part3-BorrowerInformation:borrowerAddress:city	Text	Borrower Address (city)
auto_loan_statement-Part3-BorrowerInformation:borrowerAddress:state	State	Borrower Address (state)
auto_loan_statement-Part3-BorrowerInformation:borrowerAddress:zipCode	ZIP Code	Borrower Address (ZIP Code)
Sample document
drive.google.com
API - AUTO LOAN STATEMENT.pdf
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
      "pk": 49728033,
      "uuid": "c37dd48c-7b41-45ca-beb7-53bddcbc5c04",
      "uploaded_doc_pk": 59981137,
      "form_type": "AUTO_LOAN_STATEMENT",
      "raw_fields": {
        "auto_loan_statement-Part1-General:date": {
          "value": "01/01/2012",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - AUTO LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "auto_loan_statement-Part1-General:dueDate": {
          "value": "01/30/2012",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - AUTO LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "auto_loan_statement-Part1-General:loanAmount": {
          "value": "99999.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - AUTO LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "auto_loan_statement-Part1-General:interestRate": {
          "value": "10.00%",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - AUTO LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "auto_loan_statement-Part1-General:paymentStatus": {
          "value": "NOT PAID",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - AUTO LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "auto_loan_statement-Part1-General:penaltyAmount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - AUTO LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "auto_loan_statement-Part1-General:loanTerm/Period": {
          "value": "1 YEAR",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - AUTO LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "auto_loan_statement-Part1-General:paymentDueAmount": {
          "value": "9999.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - AUTO LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "auto_loan_statement-Part1-General:outstandingBalance": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - AUTO LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "auto_loan_statement-Part2-LenderInformation:lenderName": {
          "value": "SAMPLE FARGO AUTO",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - AUTO LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "auto_loan_statement-Part3-BorrowerInformation:borrowerName": {
          "value": "DONNA SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - AUTO LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "auto_loan_statement-Part2-LenderInformation:lenderAddress:city": {
          "value": "SAMPLE CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - AUTO LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "auto_loan_statement-Part2-LenderInformation:lenderAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - AUTO LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "auto_loan_statement-Part2-LenderInformation:lenderAddress:zipCode": {
          "value": "12345-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - AUTO LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "auto_loan_statement-Part3-BorrowerInformation:borrowerAddress:city": {
          "value": "ANY CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - AUTO LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "auto_loan_statement-Part3-BorrowerInformation:borrowerAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - AUTO LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "auto_loan_statement-Part3-BorrowerInformation:borrowerAddress:zipCode": {
          "value": "12345-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - AUTO LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "auto_loan_statement-Part2-LenderInformation:lenderAddress:addressLine1": {
          "value": "PO BOX 1111",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - AUTO LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "auto_loan_statement-Part2-LenderInformation:lenderAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - AUTO LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "auto_loan_statement-Part3-BorrowerInformation:borrowerAddress:addressLine1": {
          "value": "12345 SAMPLE STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - AUTO LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "auto_loan_statement-Part3-BorrowerInformation:borrowerAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - AUTO LOAN STATEMENT.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 276188,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

ACH Processing Application
Child Care Payment
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