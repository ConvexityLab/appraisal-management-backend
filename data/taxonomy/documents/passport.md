# Passport

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
Birth Certificate
Direct Deposit Authorization
H-1B - Non-Immigrant Employment Visa
Passport
Passport Card
Permanent Resident Card
Social Security Card
State ID
US Driver's License
Utility Bill
Voided Check
Income/Employment
Legal
Mortgage specific forms
Other
Property
Tax forms
Data types
Passport
Suggest Edits

A passport is a travel document issued by a country's government that verifies the identity and nationality of the holder for international travel.

To use the Upload PDF endpoint for this document, you must use PASSPORT in the form_type parameter. Do not confuse this form type with PASSPORT_CARD; the two documents are similar but not identical.

To learn more about processing passport form type, see Passport processing.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
passport-General:passportNumber	Text	Passport Number
passport-General:firstName	Text	First Name
passport-General:middleName	Text	Middle Name
passport-General:lastName	Text	Last Name
passport-General:suffix	Text	Suffix
passport-General:issuingCountry	UNITED STATES, OTHER	Issuing Country
passport-General:dateOfBirth	Date	Date of Birth
passport-General:issueDate	Date	Issue Date
passport-General:expirationDate	Date	Expiration Date
Sample document
drive.google.com
Passport.pdf
Sample JSON result
JSON
{
   "status":200,
   "response":{
      "pk":30723681,
      "uuid":"a1676247-ced7-48d8-92ce-0c8c1faa1623",
      "name":"Passport",
      "created":"2023-03-15T14:14:26Z",
      "created_ts":"2023-03-15T14:14:26Z",
      "verified_pages_count":1,
      "book_status":"ACTIVE",
      "id":30723681,
      "forms":[
         {
            "pk":45010356,
            "uuid":"f2d3268d-faed-4f1a-ab2c-de62f503ccbb",
            "uploaded_doc_pk":52915749,
            "form_type":"PASSPORT",
            "raw_fields":{
               "passport-General:suffix":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Passport.pdf"
               },
               "passport-General:lastName":{
                  "value":"FAKE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Passport.pdf"
               },
               "passport-General:firstName":{
                  "value":"ROBERT",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Passport.pdf"
               },
               "passport-General:issueDate":{
                  "value":"01/18/2005",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Passport.pdf"
               },
               "passport-General:middleName":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Passport.pdf"
               },
               "passport-General:dateOfBirth":{
                  "value":"02/24/2001",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Passport.pdf"
               },
               "passport-General:expirationDate":{
                  "value":"03/20/2024",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Passport.pdf"
               },
               "passport-General:issuingCountry":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Passport.pdf"
               },
               "passport-General:passportNumber":{
                  "value":"123456789",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Passport.pdf"
               }
            },
            "form_config_pk":209631,
            "tables":[
               
            ]
         }
      ],
      "book_is_complete":true
   },
   "message":"OK"
}


Updated 11 months ago

SEE ALSO
Passport Card
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