# Title Insurance Policy

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
Title Insurance Policy
Suggest Edits

Title insurance protects the owner of the property and the mortgage lender against future claims for any unknown defects in the title to the property at the time of sale. A title insurance policy protects real estate owners and lenders by finding and fixing ownership issues in a property's title.

To use the Upload PDF endpoint for this document, you must use TITLE_INSURANCE_POLICY in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
title_insurance_policy-Part1-General:borrowerName1	Text	Borrower Name 1
title_insurance_policy-Part1-General:borrowerName2	Text	Borrower Name 2
title_insurance_policy-Part1-General:borrowerName3	Text	Borrower Name 3
title_insurance_policy-Part1-General:borrowerName4	Text	Borrower Name 4
title_insurance_policy-Part2-TitleCompany&Address:titleCompanyName	Text	Title Company Name
title_insurance_policy-Part2-TitleCompany&Address:titleCompanyAddress:addressLine1	Text	Title Company Address
title_insurance_policy-Part2-TitleCompany&Address:titleCompanyAddress:addressLine2	Text	Title Company Address
title_insurance_policy-Part2-TitleCompany&Address:titleCompanyAddress:city	Text	Title Company Address
title_insurance_policy-Part2-TitleCompany&Address:titleCompanyAddress:state	State	Title Company Address
title_insurance_policy-Part2-TitleCompany&Address:titleCompanyAddress:zip	ZIP Code	Title Company Address
title_insurance_policy-Part3-PropertyAddress:propertyAddress:addressLine1	Text	Property Address
title_insurance_policy-Part3-PropertyAddress:propertyAddress:addressLine2	Text	Property Address
title_insurance_policy-Part3-PropertyAddress:propertyAddress:city	Text	Property Address
title_insurance_policy-Part3-PropertyAddress:propertyAddress:state	State	Property Address
title_insurance_policy-Part3-PropertyAddress:propertyAddress:zip	ZIP Code	Property Address
title_insurance_policy-Part4-PolicyInformation:policyEffectiveDate	Date	Policy Effective Date
title_insurance_policy-Part4-PolicyInformation:policyAmount	Money	Policy Amount
title_insurance_policy-Part4-PolicyInformation:policyNumber	Text	Policy Number
title_insurance_policy-Part4-PolicyInformation:vesting	Text	Vesting
title_insurance_policy-Part4-PolicyInformation:defects/liens?	YES, NO	Defects/Liens?
title_insurance_policy-Part4-PolicyInformation:gfNumber	Text	GF Number
Sample document
drive.google.com
Title Insurance.pdf
Sample JSON result
JSON
{
   "status":200,
   "response":{
      "pk":30723307,
      "uuid":"ca2aabc3-1cc2-44ab-9621-7886eb596842",
      "name":"Title insurance",
      "created":"2023-03-15T14:06:51Z",
      "created_ts":"2023-03-15T14:06:51Z",
      "verified_pages_count":1,
      "book_status":"ACTIVE",
      "id":30723307,
      "forms":[
         {
            "pk":45009982,
            "uuid":"49cb7760-fbdf-47cf-8b65-6adf027b82fd",
            "uploaded_doc_pk":52915207,
            "form_type":"TITLE_INSURANCE_POLICY",
            "raw_fields":{
               "title_insurance_policy-Part1-General:borrowerName1":{
                  "value":"MICHAEL SAMPLE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Title Insurance.pdf"
               },
               "title_insurance_policy-Part1-General:borrowerName2":{
                  "value":"FAKE JONES",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Title Insurance.pdf"
               },
               "title_insurance_policy-Part1-General:borrowerName3":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Title Insurance.pdf"
               },
               "title_insurance_policy-Part1-General:borrowerName4":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Title Insurance.pdf"
               },
               "title_insurance_policy-Part4-PolicyInformation:vesting":{
                  "value":"MICHAEL SAMPLE AND FAKE JONES",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Title Insurance.pdf"
               },
               "title_insurance_policy-Part4-PolicyInformation:gfNumber":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Title Insurance.pdf"
               },
               "title_insurance_policy-Part4-PolicyInformation:policyAmount":{
                  "value":"111000.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Title Insurance.pdf"
               },
               "title_insurance_policy-Part4-PolicyInformation:policyNumber":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Title Insurance.pdf"
               },
               "title_insurance_policy-Part4-PolicyInformation:defects/liens?":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Title Insurance.pdf"
               },
               "title_insurance_policy-Part3-PropertyAddress:propertyAddress:zip":{
                  "value":"12345",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Title Insurance.pdf"
               },
               "title_insurance_policy-Part3-PropertyAddress:propertyAddress:city":{
                  "value":"FAKETOWN",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Title Insurance.pdf"
               },
               "title_insurance_policy-Part2-TitleCompany&Address:titleCompanyName":{
                  "value":"FIDELITY NATIONAL TITLE INSURANCE COMPANY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Title Insurance.pdf"
               },
               "title_insurance_policy-Part3-PropertyAddress:propertyAddress:state":{
                  "value":"FL",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Title Insurance.pdf"
               },
               "title_insurance_policy-Part4-PolicyInformation:policyEffectiveDate":{
                  "value":"01/01/2018",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Title Insurance.pdf"
               },
               "title_insurance_policy-Part2-TitleCompany&Address:titleCompanyAddress:zip":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Title Insurance.pdf"
               },
               "title_insurance_policy-Part3-PropertyAddress:propertyAddress:addressLine1":{
                  "value":"123 ANYWHERE AVENUE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Title Insurance.pdf"
               },
               "title_insurance_policy-Part3-PropertyAddress:propertyAddress:addressLine2":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Title Insurance.pdf"
               },
               "title_insurance_policy-Part2-TitleCompany&Address:titleCompanyAddress:city":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Title Insurance.pdf"
               },
               "title_insurance_policy-Part2-TitleCompany&Address:titleCompanyAddress:state":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Title Insurance.pdf"
               },
               "title_insurance_policy-Part2-TitleCompany&Address:titleCompanyAddress:addressLine1":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Title Insurance.pdf"
               },
               "title_insurance_policy-Part2-TitleCompany&Address:titleCompanyAddress:addressLine2":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Title Insurance.pdf"
               }
            },
            "form_config_pk":209638,
            "tables":[
               
            ]
         }
      ],
      "book_is_complete":true
   },
   "message":"OK"
}


Updated 11 months ago

Standard Flood Hazard Determination Form
VA 26-8937 Verification of VA Benefits
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