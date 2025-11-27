# Birth Certificate

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
Birth Certificate
Suggest Edits

A birth certificate is a document issued by a government that records the birth of a child for vital statistics, tax, military, and census purposes.

To use the Upload PDF endpoint for this document, you must use BIRTH_CERTIFICATE in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
birth_certificate-Part1-General:firstName	Text	First Name
birth_certificate-Part1-General:middleName	Text	Middle Name
birth_certificate-Part1-General:lastName	Text	Last Name
birth_certificate-Part1-General:dateOfBirth	Date	Date Of Birth
birth_certificate-Part1-General:stateOfBirth	State	State Of Birth
birth_certificate-Part1-General:dateIssued	Date	Date Issued
Sample document
drive.google.com
Birth Certificate - API Sample.pdf
Sample JSON result
JSON
{
   "status":200,
   "response":{
      "pk":30316958,
      "uuid":"01ba8c1a-d3b0-4124-9163-182dfa8db997",
      "name":"Birth certificate",
      "created":"2023-03-06T17:20:13Z",
      "created_ts":"2023-03-06T17:20:13Z",
      "verified_pages_count":1,
      "book_status":"ACTIVE",
      "id":30316958,
      "forms":[
         {
            "pk":44714919,
            "uuid":"f749c9f4-b6bf-4759-8d98-e3d6dad1ffe6",
            "uploaded_doc_pk":52507273,
            "form_type":"BIRTH_CERTIFICATE",
            "raw_fields":{
               "birth_certificate-Part1-General:lastName":{
                  "value":"SAMPLE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Birth Certificate - API Sample.pdf"
               },
               "birth_certificate-Part1-General:firstName":{
                  "value":"CHARLES",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Birth Certificate - API Sample.pdf"
               },
               "birth_certificate-Part1-General:dateIssued":{
                  "value":"01/01/2022",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Birth Certificate - API Sample.pdf"
               },
               "birth_certificate-Part1-General:middleName":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Birth Certificate - API Sample.pdf"
               },
               "birth_certificate-Part1-General:dateOfBirth":{
                  "value":"01/01/1999",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Birth Certificate - API Sample.pdf"
               },
               "birth_certificate-Part1-General:stateOfBirth":{
                  "value":"NY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Birth Certificate - API Sample.pdf"
               }
            },
            "form_config_pk":141324,
            "tables":[
               
            ]
         }
      ],
      "book_is_complete":true
   },
   "message":"OK"
}


Updated 11 months ago

Identification
Direct Deposit Authorization
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