# CAIVRS Authorization

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
CAIVRS Authorization
Suggest Edits

CAIVRS Authorization is used to access CAIVRS and determine if a potential borrower has a Federal debt that is currently in default or foreclosure or has had a claim paid by the reporting agency within the last three years.

To use the Upload PDF endpoint for this document, you must use CAIVRS_AUTHORIZATION in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
caivrs_authorization-PartI-General:caivrsAuthorization	Text	CAIVRS Authorization
caivrs_authorization-PartI-General:isFhaConnectionLogoPresentOnTheForm?	YES, NO	Is FHA Connection Logo Present On The Form?
caivrs_authorization-PartI-General:caivrsAuthorizationDetails	Text	CAIVRS Authorization Details
caivrs_authorization-PartI-General:borrowerSocialSecurityNumber(Ssn)	Social Security Number	Borrower Social Security Number (SSN)
caivrs_authorization-PartI-General:borrowerAuthorizationNumber	Text	Borrower Authorization Number
caivrs_authorization-PartI-General:borrowerAgencyName	Text	Borrower Agency Name
caivrs_authorization-PartI-General:borrowerCaseNumber	Text	Borrower Case Number
caivrs_authorization-PartI-General:borrowerCaseType	Text	Borrower Case Type
caivrs_authorization-PartI-General:borrowerPhoneReferral	Text	Borrower Phone Referral
caivrs_authorization-PartIi-Coborrower1-2Information:coborrower1SocialSecurityNumber(Ssn)	Social Security Number	Coborrower 1 Social Security Number (SSN)
caivrs_authorization-PartIi-Coborrower1-2Information:coborrower1AuthorizationNumber	Text	Coborrower 1 Authorization Number
caivrs_authorization-PartIi-Coborrower1-2Information:coborrower1AgencyName	Text	Coborrower 1 Agency Name
caivrs_authorization-PartIi-Coborrower1-2Information:coborrower1CaseNumber	Text	Coborrower 1 Case Number
caivrs_authorization-PartIi-Coborrower1-2Information:coborrower1CaseType	Text	Coborrower 1 Case Type
caivrs_authorization-PartIi-Coborrower1-2Information:coborrower1PhoneReferral	Text	Coborrower 1 Phone Referral
caivrs_authorization-PartIi-Coborrower1-2Information:coborrower2SocialSecurityNumber(Ssn)	Social Security Number	Coborrower 2 Social Security Number (SSN)
caivrs_authorization-PartIi-Coborrower1-2Information:coborrower2AuthorizationNumber	Text	Coborrower 2 Authorization Number
caivrs_authorization-PartIi-Coborrower1-2Information:coborrower2AgencyName	Text	Coborrower 2 Agency Name
caivrs_authorization-PartIi-Coborrower1-2Information:coborrower2CaseNumber	Text	Coborrower 2 Case Number
caivrs_authorization-PartIi-Coborrower1-2Information:coborrower2CaseType	Text	Coborrower 2 Case Type
caivrs_authorization-PartIi-Coborrower1-2Information:coborrower2PhoneReferral	Text	Coborrower 2 Phone Referral
caivrs_authorization-PartIii-Coborrower3-4Information:coborrower3SocialSecurityNumber(Ssn)	Social Security Number	Coborrower 3 Social Security Number (SSN)
caivrs_authorization-PartIii-Coborrower3-4Information:coborrower3AuthorizationNumber	Text	Coborrower 3 Authorization Number
caivrs_authorization-PartIii-Coborrower3-4Information:coborrower3AgencyName	Text	Coborrower 3 Agency Name
caivrs_authorization-PartIii-Coborrower3-4Information:coborrower3CaseNumber	Text	Coborrower 3 Case Number
caivrs_authorization-PartIii-Coborrower3-4Information:coborrower3CaseType	Text	Coborrower 3 Case Type
caivrs_authorization-PartIii-Coborrower3-4Information:coborrower3PhoneReferral	Text	Coborrower 3 Phone Referral
caivrs_authorization-PartIii-Coborrower3-4Information:coborrower4SocialSecurityNumber(Ssn)	Social Security Number	Coborrower 4 Social Security Number (SSN)
caivrs_authorization-PartIii-Coborrower3-4Information:coborrower4AuthorizationNumber	Text	Coborrower 4 Authorization Number
caivrs_authorization-PartIii-Coborrower3-4Information:coborrower4AgencyName	Text	Coborrower 4 Agency Name
caivrs_authorization-PartIii-Coborrower3-4Information:coborrower4CaseNumber	Text	Coborrower 4 Case Number
caivrs_authorization-PartIii-Coborrower3-4Information:coborrower4CaseType	Text	Coborrower 4 Case Type
caivrs_authorization-PartIii-Coborrower3-4Information:coborrower4PhoneReferral	Text	Coborrower 4 Phone Referral
Sample document
drive.google.com
CAIVRS AUTHORZATION - API Sample.pdf
Sample JSON result
JSON
{
   "status":200,
   "response":{
      "pk":30309676,
      "uuid":"29f16231-f45b-4603-96f5-8c9de3843cf3",
      "name":"CAIVRS AUTHORZATION",
      "created":"2023-03-06T15:44:23Z",
      "created_ts":"2023-03-06T15:44:23Z",
      "verified_pages_count":1,
      "book_status":"ACTIVE",
      "id":30309676,
      "forms":[
         {
            "pk":44710045,
            "uuid":"16e5855a-ffd2-4528-a02f-b68bb37bf539",
            "uploaded_doc_pk":52498520,
            "form_type":"CAIVRS_AUTHORIZATION",
            "raw_fields":{
               "caivrs_authorization-PartI-General:borrowerCaseType":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartI-General:borrowerAgencyName":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartI-General:borrowerCaseNumber":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartI-General:caivrsAuthorization":{
                  "value":"SUCCESS",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartI-General:borrowerPhoneReferral":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartI-General:caivrsAuthorizationDetails":{
                  "value":"CAIVRS AUTHORIZATION SUCCESSFULLY COMPLETED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartI-General:borrowerAuthorizationNumber":{
                  "value":"A123456789",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartI-General:borrowerSocialSecurityNumber(Ssn)":{
                  "value":"876-54-3210",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartIi-Coborrower1-2Information:coborrower1CaseType":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartIi-Coborrower1-2Information:coborrower2CaseType":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartIii-Coborrower3-4Information:coborrower3CaseType":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartIii-Coborrower3-4Information:coborrower4CaseType":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartIi-Coborrower1-2Information:coborrower1AgencyName":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartIi-Coborrower1-2Information:coborrower1CaseNumber":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartIi-Coborrower1-2Information:coborrower2AgencyName":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartIi-Coborrower1-2Information:coborrower2CaseNumber":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartIii-Coborrower3-4Information:coborrower3AgencyName":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartIii-Coborrower3-4Information:coborrower3CaseNumber":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartIii-Coborrower3-4Information:coborrower4AgencyName":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartIii-Coborrower3-4Information:coborrower4CaseNumber":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartIi-Coborrower1-2Information:coborrower1PhoneReferral":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartIi-Coborrower1-2Information:coborrower2PhoneReferral":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartIii-Coborrower3-4Information:coborrower3PhoneReferral":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartIii-Coborrower3-4Information:coborrower4PhoneReferral":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartIi-Coborrower1-2Information:coborrower1AuthorizationNumber":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartIi-Coborrower1-2Information:coborrower2AuthorizationNumber":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartIii-Coborrower3-4Information:coborrower3AuthorizationNumber":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartIii-Coborrower3-4Information:coborrower4AuthorizationNumber":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartIi-Coborrower1-2Information:coborrower1SocialSecurityNumber(Ssn)":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartIi-Coborrower1-2Information:coborrower2SocialSecurityNumber(Ssn)":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartIii-Coborrower3-4Information:coborrower3SocialSecurityNumber(Ssn)":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartI-General:isFhaConnectionLogoPresentOnTheForm?": { 
                  "value": "YES", 
                  "is_empty": false,
                  "alias_used": null,
                  "source_filename": "CAIVRS AUTHORZATION - API Sample.pdf"
               },
               "caivrs_authorization-PartIii-Coborrower3-4Information:coborrower4SocialSecurityNumber(Ssn)":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"CAIVRS AUTHORZATION - API Sample.pdf"
               }
            },
            "form_config_pk":205308,
            "tables":[
               
            ]
         }
      ],
      "book_is_complete":true
   },
   "message":"OK"
}


Updated 8 months ago

Borrower Certification and Authorization
Closing Disclosure
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