# Voided Check

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
Voided Check
Suggest Edits

Ocrolus pulls standard key values from voided checks to facilitate the logistics of bank account information.

To use the Upload PDF endpoint for this document, you must use VOIDED_CHECK in the form_type parameter. To learn more about Voided Check processing, click here.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
voided_check-Part1:nameOfBusiness	Text	Name Of Business
voided_check-Part1:businessAddress:addressLine1	Text	Business Address
voided_check-Part1:businessAddress:addressLine2	Text	Business Address
voided_check-Part1:businessAddress:city	Text	Business Address
voided_check-Part1:businessAddress:state	State	Business Address
voided_check-Part1:businessAddress:zip	ZIP Code	Business Address
voided_check-Part1:businessPhoneNumber	Phone Number	Business Phone Number
voided_check-Part1:nameOfBank	Text	Name Of Bank
voided_check-Part2:checkNumber(TopOfCheck)	Integer	Check Number (Top Of Check)
voided_check-Part2:checkNumber(BottomOfCheck)	Integer	Check Number (Bottom Of Check)
voided_check-Part2:routingNumber	Routing Number	Routing Number
voided_check-Part2:accountNumber	Integer	Account Number
Sample document
drive.google.com
Ocrolus Sample PDF - Voided Check.pdf
Sample JSON result
JSON
{
  "status": 200,
  "response": {
    "pk": 32535575,
    "uuid": "9a401f64-7f9f-40f4-9f54-bf240ba596f6",
    "name": "Voided Check API Documentation",
    "created": "2023-04-21T20:19:52Z",
    "created_ts": "2023-04-21T20:19:52Z",
    "verified_pages_count": 1,
    "book_status": "ACTIVE",
    "id": 32535575,
    "forms": [
      {
        "pk": 46115051,
        "uuid": "d79541a9-d049-45c2-bf93-6258fd1e0043",
        "uploaded_doc_pk": 54425689,
        "form_type": "VOIDED_CHECK",
        "raw_fields": {
          "voided_check-Part1:nameOfBank": {
            "value": "FIRST BANK OF EXAMPLES",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Ocrolus Sample PDF - Voided Check.pdf"
          },
          "voided_check-Part2:accountNumber": {
            "value": "40123456789",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Ocrolus Sample PDF - Voided Check.pdf"
          },
          "voided_check-Part2:routingNumber": {
            "value": "101112131",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Ocrolus Sample PDF - Voided Check.pdf"
          },
          "voided_check-Part1:nameOfBusiness": {
            "value": "OCROLUS INC.",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Ocrolus Sample PDF - Voided Check.pdf"
          },
          "voided_check-Part1:businessAddress:zip": {
            "value": "11111",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Ocrolus Sample PDF - Voided Check.pdf"
          },
          "voided_check-Part1:businessPhoneNumber": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "Ocrolus Sample PDF - Voided Check.pdf"
          },
          "voided_check-Part1:businessAddress:city": {
            "value": "NEW YORK",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Ocrolus Sample PDF - Voided Check.pdf"
          },
          "voided_check-Part1:businessAddress:state": {
            "value": "NY",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Ocrolus Sample PDF - Voided Check.pdf"
          },
          "voided_check-Part2:checkNumber(TopOfCheck)": {
            "value": "1025",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Ocrolus Sample PDF - Voided Check.pdf"
          },
          "voided_check-Part2:checkNumber(BottomOfCheck)": {
            "value": "001025",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Ocrolus Sample PDF - Voided Check.pdf"
          },
          "voided_check-Part1:businessAddress:addressLine1": {
            "value": "123 EXAMPLE DR",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Ocrolus Sample PDF - Voided Check.pdf"
          },
          "voided_check-Part1:businessAddress:addressLine2": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "Ocrolus Sample PDF - Voided Check.pdf"
          }
        },
        "form_config_pk": 216942,
        "tables": [],
        "attribute_data": null
      }
    ],
    "book_is_complete": true
  },
  "message": "OK"
}


Updated 11 months ago

Utility Bill
Income/Employment
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