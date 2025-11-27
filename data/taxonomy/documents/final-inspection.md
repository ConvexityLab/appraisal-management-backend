# Final Inspection

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
Final Inspection
Suggest Edits

A final inspection is used to complete an appraisal update or final inspection for all one- to four-unit properties. In some circumstances, both types of inspections may be necessary.

To use the Upload PDF endpoint for this document, you must use FINAL_INSPECTION in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
final_inspection-Part1-General:appraiserName	Text	Appraiser Name
final_inspection-Part1-General:dateOfInspection	Date	Date of Inspection
final_inspection-Part2-PropertyAddress:propertyAddress:addressLine1	Text	Property Address
final_inspection-Part2-PropertyAddress:propertyAddress:addressLine2	Text	Property Address
final_inspection-Part2-PropertyAddress:propertyAddress:city	Text	Property Address
final_inspection-Part2-PropertyAddress:propertyAddress:state	State	Property Address
final_inspection-Part2-PropertyAddress:propertyAddress:zip	ZIP Code	Property Address
Sample document
drive.google.com
Final Inspection - API Sample.pdf
Sample JSON result
JSON
{
   "status":200,
   "response":{
      "pk":30317470,
      "uuid":"1752c70e-5b1e-4aba-8725-ccc5a6d6d928",
      "name":"Final Inspection",
      "created":"2023-03-06T17:26:36Z",
      "created_ts":"2023-03-06T17:26:36Z",
      "verified_pages_count":1,
      "book_status":"ACTIVE",
      "id":30317470,
      "forms":[
         {
            "pk":44715122,
            "uuid":"3d03f22e-6836-4cb0-a711-aeb5ea0bccba",
            "uploaded_doc_pk":52507807,
            "form_type":"FINAL_INSPECTION",
            "raw_fields":{
               "final_inspection-Part1-General:appraiserName":{
                  "value":"SAMPLE JAMES",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Final Inspection - API Sample.pdf"
               },
               "final_inspection-Part1-General:dateOfInspection":{
                  "value":"12/01/2022",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Final Inspection - API Sample.pdf"
               },
               "final_inspection-Part2-PropertyAddress:propertyAddress:zip":{
                  "value":"56789",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Final Inspection - API Sample.pdf"
               },
               "final_inspection-Part2-PropertyAddress:propertyAddress:city":{
                  "value":"ANYWHERE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Final Inspection - API Sample.pdf"
               },
               "final_inspection-Part2-PropertyAddress:propertyAddress:state":{
                  "value":"FL",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Final Inspection - API Sample.pdf"
               },
               "final_inspection-Part2-PropertyAddress:propertyAddress:addressLine1":{
                  "value":"123 FAKE STREET",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Final Inspection - API Sample.pdf"
               },
               "final_inspection-Part2-PropertyAddress:propertyAddress:addressLine2":{
                  "value":"12",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Final Inspection - API Sample.pdf"
               }
            },
            "form_config_pk":140332,
            "tables":[
               
            ]
         }
      ],
      "book_is_complete":true
   },
   "message":"OK"
}


Updated 11 months ago

Certificate of Liability Insurance
Homeowners Association Statement
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