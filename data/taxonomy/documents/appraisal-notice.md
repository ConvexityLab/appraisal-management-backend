# Appraisal Notice

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
Property
1004 - Uniform Residential Appraisal Report
1032 - One-Unit Residential Appraisal Field Review Report
Appraisal Notice
Certificate of Liability Insurance
Final Inspection
Homeowners Association Statement
Homeowner Insurance Policy - Insurance Binder
Mortgage Statement
Payoff Letter
Preliminary Title Report
Property Tax Bill
Purchase Contract
Residential Lease Agreement
Tax forms
Data types
Appraisal Notice
Suggest Edits

An appraisal notice notifies a property owner of the proposed value of their property for the current tax year. It also includes information about any exemptions they are receiving and the deadline to file a protest.

To use the Upload PDF endpoint for this document, you must use APPRAISAL_NOTICE in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
appraisal_notice-Part1-General:date	Date	Date
appraisal_notice-Part1-General:borrowerName	Text	Borrower Name
appraisal_notice-Part1-General:subjectPropertyAddress:addressLine1	Text	Subject Property Address
appraisal_notice-Part1-General:subjectPropertyAddress:addressLine2	Text	Subject Property Address
appraisal_notice-Part1-General:subjectPropertyAddress:city	Text	Subject Property Address
appraisal_notice-Part1-General:subjectPropertyAddress:state	State	Subject Property Address
appraisal_notice-Part1-General:subjectPropertyAddress:zipCode	ZIP Code	Subject Property Address
appraisal_notice-Part1-General:loanNumber	Text	Loan Number
appraisal_notice-Part1-General:acknowledged	ACKNOWLEDGED, WAIVED	Acknowledged
Sample document
drive.google.com
Appraisal Notice - API Sample.pdf
Sample JSON result
JSON
{
   "status":200,
   "response":{
      "pk":30316705,
      "uuid":"8defd075-c64c-4866-be0a-f95298335c12",
      "name":"Appraisal Notice",
      "created":"2023-03-06T17:16:53Z",
      "created_ts":"2023-03-06T17:16:53Z",
      "verified_pages_count":1,
      "book_status":"ACTIVE",
      "id":30316705,
      "forms":[
         {
            "pk":44714710,
            "uuid":"fb190103-c3c3-4c6f-84a7-e95c0750850c",
            "uploaded_doc_pk":52507041,
            "form_type":"APPRAISAL_NOTICE",
            "raw_fields":{
               "appraisal_notice-Part1-General:date":{
                  "value":"12/30/2020",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Appraisal Notice - API Sample.pdf"
               },
               "appraisal_notice-Part1-General:loanNumber":{
                  "value":"123456789",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Appraisal Notice - API Sample.pdf"
               },
               "appraisal_notice-Part1-General:acknowledged":{
                  "value":"ACKNOWLEDGED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Appraisal Notice - API Sample.pdf"
               },
               "appraisal_notice-Part1-General:borrowerName":{
                  "value":"JOHN SAMPLE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Appraisal Notice - API Sample.pdf"
               },
               "appraisal_notice-Part1-General:subjectPropertyAddress:city":{
                  "value":"FAKE CITY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Appraisal Notice - API Sample.pdf"
               },
               "appraisal_notice-Part1-General:subjectPropertyAddress:state":{
                  "value":"CA",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Appraisal Notice - API Sample.pdf"
               },
               "appraisal_notice-Part1-General:subjectPropertyAddress:zipCode":{
                  "value":"54321",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Appraisal Notice - API Sample.pdf"
               },
               "appraisal_notice-Part1-General:subjectPropertyAddress:addressLine1":{
                  "value":"HOUSE NO. 123 MAIN RD.",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Appraisal Notice - API Sample.pdf"
               },
               "appraisal_notice-Part1-General:subjectPropertyAddress:addressLine2":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Appraisal Notice - API Sample.pdf"
               }
            },
            "form_config_pk":138665,
            "tables":[
               
            ]
         }
      ],
      "book_is_complete":true
   },
   "message":"OK"
}


Updated 11 months ago

1032 - One-Unit Residential Appraisal Field Review Report
Certificate of Liability Insurance
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