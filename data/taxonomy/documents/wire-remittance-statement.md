# Wire Remittance Statement

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
Wire Remittance Statement
Suggest Edits

This is a financial document that provides a detailed record of a wire transfer, including the sender's and recipient's information, transaction amount, date, and any associated fees.

To use the Upload PDF endpoint for this document, you must use WIRE_REMITTANCE_STATEMENT in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
wire_remittance_statement-Part1-General:dateOfWireTransfer	Date	Date Of Wire Transfer
wire_remittance_statement-Part1-General:amountOfWireTransfer	Money	Amount Of Wire Transfer
wire_remittance_statement-Part1-General:purposeOfWireTransfer	Text	Purpose Of Wire Transfer
wire_remittance_statement-Part2-Sender'SDetails:sender'sName	Text	Sender's Name
wire_remittance_statement-Part2-Sender'SDetails:sender'sAddress:addressLine1	Text	Sender's Address
wire_remittance_statement-Part2-Sender'SDetails:sender'sAddress:addressLine2	Text	Sender's Address
wire_remittance_statement-Part2-Sender'SDetails:sender'sAddress:city	Text	Sender's Address
wire_remittance_statement-Part2-Sender'SDetails:sender'sAddress:state	State	Sender's Address
wire_remittance_statement-Part2-Sender'SDetails:sender'sAddress:zip	ZIP Code	Sender's Address
wire_remittance_statement-Part2-Sender'SDetails:phoneNumber	Phone Number	Phone Number
wire_remittance_statement-Part2-Sender'SDetails:bankName	Text	Bank Name
wire_remittance_statement-Part2-Sender'SDetails:bankAccountNumber	Text	Bank Account Number
wire_remittance_statement-Part2-Sender'SDetails:abaOrSwiftCode	Text	ABA Or Swift Code
wire_remittance_statement-Part3-Recipient'SDetails:recipient'sName	Text	Recipient's Name
wire_remittance_statement-Part3-Recipient'SDetails:recipient'sAddress:addressLine1	Text	Recipient's Address
wire_remittance_statement-Part3-Recipient'SDetails:recipient'sAddress:addressLine2	Text	Recipient's Address
wire_remittance_statement-Part3-Recipient'SDetails:recipient'sAddress:city	Text	Recipient's Address
wire_remittance_statement-Part3-Recipient'SDetails:recipient'sAddress:state	State	Recipient's Address
wire_remittance_statement-Part3-Recipient'SDetails:recipient'sAddress:zip	ZIP Code	Recipient's Address
wire_remittance_statement-Part3-Recipient'SDetails:phoneNumber	Phone Number	Phone Number
wire_remittance_statement-Part3-Recipient'SDetails:bankName	Text	Bank Name
wire_remittance_statement-Part3-Recipient'SDetails:bankAccountNumber	Text	Bank Account Number
wire_remittance_statement-Part3-Recipient'SDetails:abaOrSwiftCode	Text	ABA Or Swift Code
Sample document
drive.google.com
API - WIRE REMITTANCE STATEMENT.pdf
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
      "pk": 49666456,
      "uuid": "392e5ddc-8b08-4609-b093-168feeda7676",
      "uploaded_doc_pk": 59900620,
      "form_type": "WIRE_REMITTANCE_STATEMENT",
      "raw_fields": {
        "wire_remittance_statement-Part2-Sender'SDetails:bankName": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - WIRE REMITTANCE STATEMENT.pdf",
          "confidence": 1.0
        },
        "wire_remittance_statement-Part1-General:dateOfWireTransfer": {
          "value": "01/01/2020",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - WIRE REMITTANCE STATEMENT.pdf",
          "confidence": 1.0
        },
        "wire_remittance_statement-Part2-Sender'SDetails:phoneNumber": {
          "value": "(888) 456-4512",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - WIRE REMITTANCE STATEMENT.pdf",
          "confidence": 1.0
        },
        "wire_remittance_statement-Part3-Recipient'SDetails:bankName": {
          "value": "BENEFICIARY'S BANK",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - WIRE REMITTANCE STATEMENT.pdf",
          "confidence": 1.0
        },
        "wire_remittance_statement-Part1-General:amountOfWireTransfer": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - WIRE REMITTANCE STATEMENT.pdf",
          "confidence": 1.0
        },
        "wire_remittance_statement-Part2-Sender'SDetails:sender'sName": {
          "value": "ANY INDIVIDUAL NAME",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - WIRE REMITTANCE STATEMENT.pdf",
          "confidence": 1.0
        },
        "wire_remittance_statement-Part1-General:purposeOfWireTransfer": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - WIRE REMITTANCE STATEMENT.pdf",
          "confidence": 1.0
        },
        "wire_remittance_statement-Part2-Sender'SDetails:abaOrSwiftCode": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - WIRE REMITTANCE STATEMENT.pdf",
          "confidence": 1.0
        },
        "wire_remittance_statement-Part3-Recipient'SDetails:phoneNumber": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - WIRE REMITTANCE STATEMENT.pdf",
          "confidence": 1.0
        },
        "wire_remittance_statement-Part2-Sender'SDetails:bankAccountNumber": {
          "value": "0123456789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - WIRE REMITTANCE STATEMENT.pdf",
          "confidence": 1.0
        },
        "wire_remittance_statement-Part3-Recipient'SDetails:abaOrSwiftCode": {
          "value": "012345678",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - WIRE REMITTANCE STATEMENT.pdf",
          "confidence": 1.0
        },
        "wire_remittance_statement-Part3-Recipient'SDetails:recipient'sName": {
          "value": "BENEFICIARY NAME",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - WIRE REMITTANCE STATEMENT.pdf",
          "confidence": 1.0
        },
        "wire_remittance_statement-Part2-Sender'SDetails:sender'sAddress:zip": {
          "value": "12345-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - WIRE REMITTANCE STATEMENT.pdf",
          "confidence": 1.0
        },
        "wire_remittance_statement-Part2-Sender'SDetails:sender'sAddress:city": {
          "value": "ANY CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - WIRE REMITTANCE STATEMENT.pdf",
          "confidence": 1.0
        },
        "wire_remittance_statement-Part3-Recipient'SDetails:bankAccountNumber": {
          "value": "123456789000000000",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - WIRE REMITTANCE STATEMENT.pdf",
          "confidence": 1.0
        },
        "wire_remittance_statement-Part2-Sender'SDetails:sender'sAddress:state": {
          "value": "GA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - WIRE REMITTANCE STATEMENT.pdf",
          "confidence": 1.0
        },
        "wire_remittance_statement-Part3-Recipient'SDetails:recipient'sAddress:zip": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - WIRE REMITTANCE STATEMENT.pdf",
          "confidence": 1.0
        },
        "wire_remittance_statement-Part3-Recipient'SDetails:recipient'sAddress:city": {
          "value": "BIG CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - WIRE REMITTANCE STATEMENT.pdf",
          "confidence": 1.0
        },
        "wire_remittance_statement-Part3-Recipient'SDetails:recipient'sAddress:state": {
          "value": "CA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - WIRE REMITTANCE STATEMENT.pdf",
          "confidence": 1.0
        },
        "wire_remittance_statement-Part2-Sender'SDetails:sender'sAddress:addressLine1": {
          "value": "123 ANY INDIVIDUAL STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - WIRE REMITTANCE STATEMENT.pdf",
          "confidence": 1.0
        },
        "wire_remittance_statement-Part2-Sender'SDetails:sender'sAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - WIRE REMITTANCE STATEMENT.pdf",
          "confidence": 1.0
        },
        "wire_remittance_statement-Part3-Recipient'SDetails:recipient'sAddress:addressLine1": {
          "value": "123 BENEFICIARY STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - WIRE REMITTANCE STATEMENT.pdf",
          "confidence": 1.0
        },
        "wire_remittance_statement-Part3-Recipient'SDetails:recipient'sAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - WIRE REMITTANCE STATEMENT.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 239018,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Student Loan Statement
Property
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