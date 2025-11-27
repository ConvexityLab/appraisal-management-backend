# Borrower Certification and Authorization

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
Borrower Certification and Authorization
Suggest Edits

The borrower's certification and authorization also authorize the lender to share information in the loan application with other parties. Additionally, it gives the lender the right to verify information in the loan application, credit application, and employment history.

To use the Upload PDF endpoint for this document, you must use BORROWER_CERTIFICATION_AND_AUTHORIZATION in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
borrower_certification_and_authorization-Part1General:lenderName	Text	Lender Name
borrower_certification_and_authorization-Part1General:borrowerName	Text	Borrower Name
borrower_certification_and_authorization-Part1General:co-borrowerName	Text	Co-Borrower Name
borrower_certification_and_authorization-Part1General:isBorrowerSigned?	SIGNED, NOT SIGNED	Is Borrower Signed?
borrower_certification_and_authorization-Part1General:borrowerSignatureDate	Date	Borrower Signature Date
borrower_certification_and_authorization-Part1General:isCo-BorrowerSigned?	SIGNED, NOT SIGNED	Is Co-Borrower Signed?
borrower_certification_and_authorization-Part1General:co-borrowerSignatureDate	Date	Co-Borrower Signature Date
Sample document
drive.google.com
Borrower Certificate Authorization - API Sample.pdf
Sample JSON result
JSON
{
   "status":200,
   "response":{
      "pk":30317083,
      "uuid":"5d40749e-8a71-43ed-a8e6-20ed6b892476",
      "name":"Borrower Certificate Authorization",
      "created":"2023-03-06T17:21:45Z",
      "created_ts":"2023-03-06T17:21:45Z",
      "verified_pages_count":1,
      "book_status":"ACTIVE",
      "id":30317083,
      "forms":[
         {
            "pk":44714976,
            "uuid":"c48b2a43-877c-4a7f-bd2b-f493562c2b20",
            "uploaded_doc_pk":52507396,
            "form_type":"BORROWERS_CERTIFICATION_AND_AUTHORIZATION",
            "raw_fields":{
               "borrower_certification_and_authorization-Part1General:lenderName":{
                  "value":"SAMPLE MORTGAGE COMPANY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Borrower Certificate Authorization - API Sample.pdf"
               },
               "borrower_certification_and_authorization-Part1General:borrowerName":{
                  "value":"FAKE JOHN",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Borrower Certificate Authorization - API Sample.pdf"
               },
               "borrower_certification_and_authorization-Part1General:co-borrowerName":{
                  "value":"DAVID SAMPLE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Borrower Certificate Authorization - API Sample.pdf"
               },
               "borrower_certification_and_authorization-Part1General:isBorrowerSigned?":{
                  "value":"SIGNED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Borrower Certificate Authorization - API Sample.pdf"
               },
               "borrower_certification_and_authorization-Part1General:isCo-BorrowerSigned?":{
                  "value":"SIGNED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Borrower Certificate Authorization - API Sample.pdf"
               },
               "borrower_certification_and_authorization-Part1General:borrowerSignatureDate":{
                  "value":"05/20/2021",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Borrower Certificate Authorization - API Sample.pdf"
               },
               "borrower_certification_and_authorization-Part1General:co-borrowerSignatureDate":{
                  "value":"05/20/2021",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Borrower Certificate Authorization - API Sample.pdf"
               }
            },
            "form_config_pk":141485,
            "tables":[
               
            ]
         }
      ],
      "book_is_complete":true
   },
   "message":"OK"
}


Updated 11 months ago

1008 (2018) - Uniform Underwriting and Transmittal Summary
CAIVRS Authorization
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