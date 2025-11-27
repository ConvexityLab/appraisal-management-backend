# Wiring Instructions

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
1003 (2009) - Uniform Residential Loan Application
1003 (2020) - Uniform Residential Loan Application
1003 (2020) - Uniform Residential Loan Application (Additional Borrower)
1003 (2020) - Uniform Residential Loan Application (Lender Loan Information)
1008 (2009) - Uniform Underwriting and Transmittal Summary
1008 (2018) - Uniform Underwriting and Transmittal Summary
Borrower Certification and Authorization
CAIVRS Authorization
Closing Disclosure
Closing Protection Letter
Divorce Decree
Federal Supporting Statements - Other Deductions
FHA Case Number Assignment
FHA Case Query
Flood Elevation Certificate
Gift Letter
IRS Form 4506-C - IVES Request for Transcript of Tax Return
IRS Form 4506-T - Request for Transcript of Tax Return
Loan Estimate
Mortgage Insurance Certificate
Mortgage Note
Pre-Approval Letter
Private Mortgage Payment
Standard Flood Hazard Determination Form
Title Insurance Policy
VA 26-8937 Verification of VA Benefits
VA Certificate of Eligibility
Wiring Instructions
Other
Property
Tax forms
Data types
Wiring Instructions
Suggest Edits

A wire transfer instructions form is a document that should be filled out by an individual who wants to begin a wire transfer transaction, regardless if it is an inbound or an outbound wire transfer. The form will allow the bank or financial institution to obtain the information which will be used for the transaction such as the details of the accounts of both the sender and the receiver of the money.

To use the Upload PDF endpoint for this document, you must use WIRING_INSTRUCTIONS in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
wiring_instructions-PartI-General:receivingBank	Text	Receiving Bank
wiring_instructions-PartI-General:receivingBankAddress:addressLine1	Text	Receiving Bank Address
wiring_instructions-PartI-General:receivingBankAddress:addressLine2	Text	Receiving Bank Address
wiring_instructions-PartI-General:receivingBankAddress:city	Text	Receiving Bank Address
wiring_instructions-PartI-General:receivingBankAddress:state	State	Receiving Bank Address
wiring_instructions-PartI-General:receivingBankAddress:zip	ZIP Code	Receiving Bank Address
wiring_instructions-PartI-General:receivingBankAbaRoutingNumber	Routing Number	Receiving Bank ABA Routing Number
wiring_instructions-PartI-General:receivingBankAccountNumber	Integer	Receiving Bank Account Number
wiring_instructions-PartI-General:creditTo	Text	Credit To
wiring_instructions-PartI-General:creditToAddress:addressLine1	Text	Credit To Address
wiring_instructions-PartI-General:creditToAddress:addressLine2	Text	Credit To Address
wiring_instructions-PartI-General:creditToAddress:city	City	Credit To Address
wiring_instructions-PartI-General:creditToAddress:state	State	Credit To Address
wiring_instructions-PartI-General:creditToAddress:zip	ZIP Code	Credit To Address
wiring_instructions-PartI-General:creditToAccountNumber	Integer	Credit To Account Number
wiring_instructions-PartI-General:creditToAbaRoutingNumber	Routing Number	Credit To ABA Routing Number
wiring_instructions-PartI-General:gfNumber	Integer	GF Number
wiring_instructions-PartIi-TitleCompany:titleCompanyName	Text	Title Company Name
wiring_instructions-PartIi-TitleCompany:titleCompanyAddress:addressLine1	Text	Title Company Address
wiring_instructions-PartIi-TitleCompany:titleCompanyAddress:addressLine2	Text	Title Company Address
wiring_instructions-PartIi-TitleCompany:titleCompanyAddress:city	City	Title Company Address
wiring_instructions-PartIi-TitleCompany:titleCompanyAddress:state	State	Title Company Address
wiring_instructions-PartIi-TitleCompany:titleCompanyAddress:zip	ZIP Code	Title Company Address
wiring_instructions-PartIii-Borrower:borrowerName1	Text	Borrower Name 1
wiring_instructions-PartIii-Borrower:borrowerName2	Text	Borrower Name 2
wiring_instructions-PartIii-Borrower:propertyAddress:addressLine1	Text	Property Address
wiring_instructions-PartIii-Borrower:propertyAddress:addressLine2	Text	Property Address
wiring_instructions-PartIii-Borrower:propertyAddress:city	City	Property Address
wiring_instructions-PartIii-Borrower:propertyAddress:state	State	Property Address
wiring_instructions-PartIii-Borrower:propertyAddress:zip	ZIP Code	Property Address
Sample document
drive.google.com
Wire Instruction.pdf
Sample JSON result
JSON
{
   "status":200,
   "response":{
      "pk":31464619,
      "uuid":"ec3c0dfe-8383-4e5a-97e2-b9b795b61df2",
      "name":"Wiring Instructions - API",
      "created":"2023-03-30T22:16:15Z",
      "created_ts":"2023-03-30T22:16:15Z",
      "verified_pages_count":2,
      "book_status":"ACTIVE",
      "id":31464619,
      "forms":[
         {
            "pk":45516095,
            "uuid":"456672a6-d6b2-490c-93db-51bc2448cd86",
            "uploaded_doc_pk":53604260,
            "form_type":"WIRING_INSTRUCTIONS",
            "raw_fields":{
               "wiring_instructions-PartI-General:creditTo":{
                  "value":"SAMPLE BANK",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Wire Instruction.pdf"
               },
               "wiring_instructions-PartI-General:gfNumber":{
                  "value":"123456789",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Wire Instruction.pdf"
               },
               "wiring_instructions-PartI-General:receivingBank":{
                  "value":"SAMPLE BANK",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Wire Instruction.pdf"
               },
               "wiring_instructions-PartIii-Borrower:borrowerName1":{
                  "value":"JOHN SAMPLE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Wire Instruction.pdf"
               },
               "wiring_instructions-PartIii-Borrower:borrowerName2":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Wire Instruction.pdf"
               },
               "wiring_instructions-PartI-General:creditToAddress:zip":{
                  "value":"12345",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Wire Instruction.pdf"
               },
               "wiring_instructions-PartI-General:creditToAddress:city":{
                  "value":"SAMPLE CITY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Wire Instruction.pdf"
               },
               "wiring_instructions-PartI-General:creditToAccountNumber":{
                  "value":"1234567890000",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Wire Instruction.pdf"
               },
               "wiring_instructions-PartI-General:creditToAddress:state":{
                  "value":"NY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Wire Instruction.pdf"
               },
               "wiring_instructions-PartIi-TitleCompany:titleCompanyName":{
                  "value":"SAMPLE FAKE TITLE COMPANY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Wire Instruction.pdf"
               },
               "wiring_instructions-PartIii-Borrower:propertyAddress:zip":{
                  "value":"12345",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Wire Instruction.pdf"
               },
               "wiring_instructions-PartIii-Borrower:propertyAddress:city":{
                  "value":"SAMPLE CITY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Wire Instruction.pdf"
               },
               "wiring_instructions-PartI-General:creditToAbaRoutingNumber":{
                  "value":"123456789",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Wire Instruction.pdf"
               },
               "wiring_instructions-PartI-General:receivingBankAddress:zip":{
                  "value":"12345",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Wire Instruction.pdf"
               },
               "wiring_instructions-PartIii-Borrower:propertyAddress:state":{
                  "value":"NY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Wire Instruction.pdf"
               },
               "wiring_instructions-PartI-General:receivingBankAddress:city":{
                  "value":"SAMPLE CITY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Wire Instruction.pdf"
               },
               "wiring_instructions-PartI-General:receivingBankAccountNumber":{
                  "value":"1234567890000",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Wire Instruction.pdf"
               },
               "wiring_instructions-PartI-General:receivingBankAddress:state":{
                  "value":"NY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Wire Instruction.pdf"
               },
               "wiring_instructions-PartI-General:creditToAddress:addressLine1":{
                  "value":"123 FAKE STREET RD.",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Wire Instruction.pdf"
               },
               "wiring_instructions-PartI-General:creditToAddress:addressLine2":{
                  "value":"#12",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Wire Instruction.pdf"
               },
               "wiring_instructions-PartI-General:receivingBankAbaRoutingNumber":{
                  "value":"123456789",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Wire Instruction.pdf"
               },
               "wiring_instructions-PartIi-TitleCompany:titleCompanyAddress:zip":{
                  "value":"12345",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Wire Instruction.pdf"
               },
               "wiring_instructions-PartIi-TitleCompany:titleCompanyAddress:city":{
                  "value":"SAMPLE CITY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Wire Instruction.pdf"
               },
               "wiring_instructions-PartIi-TitleCompany:titleCompanyAddress:state":{
                  "value":"NY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Wire Instruction.pdf"
               },
               "wiring_instructions-PartIii-Borrower:propertyAddress:addressLine1":{
                  "value":"123 FAKE SAMPLE STREET",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Wire Instruction.pdf"
               },
               "wiring_instructions-PartIii-Borrower:propertyAddress:addressLine2":{
                  "value":"#12",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Wire Instruction.pdf"
               },
               "wiring_instructions-PartI-General:receivingBankAddress:addressLine1":{
                  "value":"123 FAKE STREET RD.",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Wire Instruction.pdf"
               },
               "wiring_instructions-PartI-General:receivingBankAddress:addressLine2":{
                  "value":"#12",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Wire Instruction.pdf"
               },
               "wiring_instructions-PartIi-TitleCompany:titleCompanyAddress:addressLine1":{
                  "value":"1234 SAMPLE FAKE RD",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Wire Instruction.pdf"
               },
               "wiring_instructions-PartIi-TitleCompany:titleCompanyAddress:addressLine2":{
                  "value":"UNIT #12",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Wire Instruction.pdf"
               }
            },
            "form_config_pk":212011,
            "tables":[
               
            ]
         }
      ],
      "book_is_complete":true
   },
   "message":"OK"
}


Updated 11 months ago

VA Certificate of Eligibility
Other
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