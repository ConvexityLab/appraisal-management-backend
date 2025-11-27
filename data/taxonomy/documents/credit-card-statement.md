# Credit Card Statement

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
Credit Card Statement
Suggest Edits

This is a regular financial statement furnished by a credit card issuer to the cardholder, offering a summary of all transactions, payments, balances, and fees associated with the credit card account.

To use the Upload PDF endpoint for this document, you must use CREDIT_CARD_STATEMENT in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
credit_card_statement-Part1-General:statementDate	Date	Statement Date
credit_card_statement-Part1-General:statementPeriod:statementOpeningDate	Date	Statement Period
credit_card_statement-Part1-General:statementPeriod:statementClosingDate	Date	Statement Period
credit_card_statement-Part1-General:daysInStatementPeriod	Integer	Days In Statement Period
credit_card_statement-Part2-Issuer'SDetails:issuer'sName	Text	Issuer's Name
credit_card_statement-Part2-Issuer'SDetails:issuer'sAddress:addressLine1	Text	Issuer's Address
credit_card_statement-Part2-Issuer'SDetails:issuer'sAddress:addressLine2	Text	Issuer's Address
credit_card_statement-Part2-Issuer'SDetails:issuer'sAddress:city	Text	Issuer's Address
credit_card_statement-Part2-Issuer'SDetails:issuer'sAddress:state	State	Issuer's Address
credit_card_statement-Part2-Issuer'SDetails:issuer'sAddress:zipCode	ZIP Code	Issuer's Address
credit_card_statement-Part3-Borrower'SDetails:borrower'sName	Text	Borrower's Name
credit_card_statement-Part3-Borrower'SDetails:borrower'sAddress:addressLine1	Text	Borrower's Address
credit_card_statement-Part3-Borrower'SDetails:borrower'sAddress:addressLine2	Text	Borrower's Address
credit_card_statement-Part3-Borrower'SDetails:borrower'sAddress:city	Text	Borrower's Address
credit_card_statement-Part3-Borrower'SDetails:borrower'sAddress:state	State	Borrower's Address
credit_card_statement-Part3-Borrower'SDetails:borrower'sAddress:zipCode	ZIP Code	Borrower's Address
credit_card_statement-Part3-Borrower'SDetails:creditCardAccountNumber	Text	Credit Card Account Number
credit_card_statement-Part4-CreditDetails:totalCreditLimit	Money	Total Credit Limit
credit_card_statement-Part4-CreditDetails:creditAvailable	Money	Credit Available
credit_card_statement-Part4-CreditDetails:currentOutstandingBalance	Money	Current Outstanding Balance
credit_card_statement-Part4-CreditDetails:minimumPaymentDue	Money	Minimum Payment Due
credit_card_statement-Part4-CreditDetails:paymentDueDate	Date	Payment Due Date
Sample document
drive.google.com
API - CREDIT CARD STATEMENT.pdf
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
      "pk": 49727851,
      "uuid": "fda59449-fbb6-4c7d-bb58-9d4995a3ab0b",
      "uploaded_doc_pk": 59980697,
      "form_type": "CREDIT_CARD_STATEMENT",
      "raw_fields": {
        "credit_card_statement-Part1-General:statementDate": {
          "value": "05/10/2015",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CREDIT CARD STATEMENT.pdf",
          "confidence": 1.0
        },
        "credit_card_statement-Part2-Issuer'SDetails:issuer'sName": {
          "value": "YOURBANK",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CREDIT CARD STATEMENT.pdf",
          "confidence": 1.0
        },
        "credit_card_statement-Part4-CreditDetails:paymentDueDate": {
          "value": "05/24/2015",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CREDIT CARD STATEMENT.pdf",
          "confidence": 1.0
        },
        "credit_card_statement-Part1-General:daysInStatementPeriod": {
          "value": "30",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CREDIT CARD STATEMENT.pdf",
          "confidence": 1.0
        },
        "credit_card_statement-Part4-CreditDetails:creditAvailable": {
          "value": "5336.77",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CREDIT CARD STATEMENT.pdf",
          "confidence": 1.0
        },
        "credit_card_statement-Part4-CreditDetails:totalCreditLimit": {
          "value": "9000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CREDIT CARD STATEMENT.pdf",
          "confidence": 1.0
        },
        "credit_card_statement-Part4-CreditDetails:minimumPaymentDue": {
          "value": "36.63",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CREDIT CARD STATEMENT.pdf",
          "confidence": 1.0
        },
        "credit_card_statement-Part3-Borrower'SDetails:borrower'sName": {
          "value": "DAVID SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CREDIT CARD STATEMENT.pdf",
          "confidence": 1.0
        },
        "credit_card_statement-Part2-Issuer'SDetails:issuer'sAddress:city": {
          "value": "BANKCITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CREDIT CARD STATEMENT.pdf",
          "confidence": 1.0
        },
        "credit_card_statement-Part2-Issuer'SDetails:issuer'sAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CREDIT CARD STATEMENT.pdf",
          "confidence": 1.0
        },
        "credit_card_statement-Part2-Issuer'SDetails:issuer'sAddress:zipCode": {
          "value": "98456",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CREDIT CARD STATEMENT.pdf",
          "confidence": 1.0
        },
        "credit_card_statement-Part4-CreditDetails:currentOutstandingBalance": {
          "value": "3663.23",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CREDIT CARD STATEMENT.pdf",
          "confidence": 1.0
        },
        "credit_card_statement-Part3-Borrower'SDetails:borrower'sAddress:city": {
          "value": "CITY NAME",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CREDIT CARD STATEMENT.pdf",
          "confidence": 1.0
        },
        "credit_card_statement-Part3-Borrower'SDetails:borrower'sAddress:state": {
          "value": "CA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CREDIT CARD STATEMENT.pdf",
          "confidence": 1.0
        },
        "credit_card_statement-Part3-Borrower'SDetails:creditCardAccountNumber": {
          "value": "12345677",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CREDIT CARD STATEMENT.pdf",
          "confidence": 1.0
        },
        "credit_card_statement-Part3-Borrower'SDetails:borrower'sAddress:zipCode": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CREDIT CARD STATEMENT.pdf",
          "confidence": 1.0
        },
        "credit_card_statement-Part1-General:statementPeriod:statementClosingDate": {
          "value": "04/30/2015",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CREDIT CARD STATEMENT.pdf",
          "confidence": 1.0
        },
        "credit_card_statement-Part1-General:statementPeriod:statementOpeningDate": {
          "value": "04/01/2015",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CREDIT CARD STATEMENT.pdf",
          "confidence": 1.0
        },
        "credit_card_statement-Part2-Issuer'SDetails:issuer'sAddress:addressLine1": {
          "value": "P.O. BOX 1234",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CREDIT CARD STATEMENT.pdf",
          "confidence": 1.0
        },
        "credit_card_statement-Part2-Issuer'SDetails:issuer'sAddress:addressLine2": {
          "value": "SECTION Z",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CREDIT CARD STATEMENT.pdf",
          "confidence": 1.0
        },
        "credit_card_statement-Part3-Borrower'SDetails:borrower'sAddress:addressLine1": {
          "value": "99 STREET NAME",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - CREDIT CARD STATEMENT.pdf",
          "confidence": 1.0
        },
        "credit_card_statement-Part3-Borrower'SDetails:borrower'sAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - CREDIT CARD STATEMENT.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 276201,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Coast Guard Standard Travel Order
Credit Report
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