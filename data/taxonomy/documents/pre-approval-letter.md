# Pre-Approval Letter

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
Pre-Approval Letter
Suggest Edits

A pre-approval letter is a document from a lender stating that the lender is tentatively willing to lend to you up to a certain loan amount. This document is based on certain assumptions and it is not a guaranteed loan offer.

To use the Upload PDF endpoint for this document, you must use PRE_APPROVAL_LETTER in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
pre_approval_letter-PartI-General:borrowerName	Text	Borrower Name
pre_approval_letter-PartI-General:subjectPropertyAddress:addressLine1	Text	Subject Property Address
pre_approval_letter-PartI-General:subjectPropertyAddress:addressLine2	Text	Subject Property Address
pre_approval_letter-PartI-General:subjectPropertyAddress:city	Text	Subject Property Address
pre_approval_letter-PartI-General:subjectPropertyAddress:state	State	Subject Property Address
pre_approval_letter-PartI-General:subjectPropertyAddress:zip	ZIP Code	Subject Property Address
pre_approval_letter-PartI-General:documentDate	Date	Document Date
pre_approval_letter-PartI-General:purchasePrice	Money	Purchase Price
pre_approval_letter-PartI-General:loanAmount	Money	Loan Amount
pre_approval_letter-PartI-General:loanType	Text	Loan Type
pre_approval_letter-PartI-General:expiryDate	Date	Expiry Date
Sample document
drive.google.com
Pre Approval Letter - API Sample.pdf
Sample JSON result
JSON
{
   "status":200,
   "response":{
      "pk":30309138,
      "uuid":"83a14e48-2fcf-4467-ab69-698da9c69cb6",
      "name":"Pre Approval Letter",
      "created":"2023-03-06T15:36:53Z",
      "created_ts":"2023-03-06T15:36:53Z",
      "verified_pages_count":2,
      "book_status":"ACTIVE",
      "id":30309138,
      "forms":[
         {
            "pk":44709890,
            "uuid":"0771cc2d-6ebc-4d82-85f0-78e1a1c50909",
            "uploaded_doc_pk":52497933,
            "form_type":"PRE_APPROVAL_LETTER",
            "raw_fields":{
               "pre_approval_letter-PartI-General:loanType":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Pre Approval Letter - API Sample.pdf"
               },
               "pre_approval_letter-PartI-General:expiryDate":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Pre Approval Letter - API Sample.pdf",
                  "validation_error":"Expiry Date should be after Document Date. User should review the document."
               },
               "pre_approval_letter-PartI-General:loanAmount":{
                  "value":"240000.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Pre Approval Letter - API Sample.pdf"
               },
               "pre_approval_letter-PartI-General:borrowerName":{
                  "value":"JAMES E. SAMPLE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Pre Approval Letter - API Sample.pdf"
               },
               "pre_approval_letter-PartI-General:documentDate":{
                  "value":"12/02/2022",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Pre Approval Letter - API Sample.pdf",
                  "validation_error":"Document Date should be before Expiry Date. User should review the document."
               },
               "pre_approval_letter-PartI-General:purchasePrice":{
                  "value":"285100.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Pre Approval Letter - API Sample.pdf"
               },
               "pre_approval_letter-PartI-General:subjectPropertyAddress:zip":{
                  "value":"35215",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Pre Approval Letter - API Sample.pdf"
               },
               "pre_approval_letter-PartI-General:subjectPropertyAddress:city":{
                  "value":"ANYWHERE CITY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Pre Approval Letter - API Sample.pdf"
               },
               "pre_approval_letter-PartI-General:subjectPropertyAddress:state":{
                  "value":"AL",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Pre Approval Letter - API Sample.pdf"
               },
               "pre_approval_letter-PartI-General:subjectPropertyAddress:addressLine1":{
                  "value":"6 FAKE CENTER POINT RD",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Pre Approval Letter - API Sample.pdf"
               },
               "pre_approval_letter-PartI-General:subjectPropertyAddress:addressLine2":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Pre Approval Letter - API Sample.pdf"
               }
            },
            "form_config_pk":141868,
            "tables":[
               
            ]
         }
      ],
      "book_is_complete":true
   },
   "message":"OK"
}


Updated 11 months ago

Mortgage Note
Private Mortgage Payment
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