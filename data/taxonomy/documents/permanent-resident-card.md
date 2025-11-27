# Permanent Resident Card

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
Permanent Resident Card
Suggest Edits

A Permanent Resident card is proof of lawful permanent resident status in the issuing country. The field data attributed directly to a Permanent Resident card is captured as form data objects, each one keyed off the following attribute names.

To use the Upload PDF endpoint for this document, you must use PERMANENT_RESIDENT_CARD in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON attribute	Data type	Description
permanent_resident_card-General:firstName	Text	First Name
permanent_resident_card-General:middleName	Text	Middle Name
permanent_resident_card-General:lastName	Text	Last Name
permanent_resident_card-General:suffix	Text	Suffix
permanent_resident_card-General:dateOfBirth	Date	Date of Birth
permanent_resident_card-General:issuingCountry	UNITED STATES
OTHER	Issuing Country
permanent_resident_card-General:expirationDate	Date	Expiration Date
permanent_resident_card-General:residentSince	Date	Resident Since
Sample document

Coming soon...

Sample JSON result
JSON
{
  "status": 200,
  "response": {
    "pk": 30476901,
    "uuid": "29715157-fd49-4ea3-995e-4aae421a4f58",
    "forms": [
      {
        "pk": 30029344,
        "uuid": "2e9207fb-95c8-4551-8c9c-6ff64b3001c7",
        "form_type": "PERMANENT_RESIDENT_CARD",
        "form_config_pk": 18853,
        "tables": [],
        "raw_fields": {
          "permanent_resident_card-General:suffix": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "Permanent Resident Card Sample 1.pdf"
          },
          "permanent_resident_card-General:lastName": {
            "value": "PRICE",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Permanent Resident Card Sample 1.pdf"
          },
          "permanent_resident_card-General:firstName": {
            "value": "JOSE",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Permanent Resident Card Sample 1.pdf"
          },
          "permanent_resident_card-General:middleName": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "Permanent Resident Card Sample 1.pdf"
          },
          "permanent_resident_card-General:dateOfBirth": {
            "value": "03/12/1978",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Permanent Resident Card Sample 1.pdf"
          },
          "permanent_resident_card-General:residentSince": {
            "value": "11/10/1990",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Permanent Resident Card Sample 1.pdf"
          },
          "permanent_resident_card-General:expirationDate": {
            "value": "11/25/2030",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Permanent Resident Card Sample 1.pdf"
          }
        }
      }
    ]
  },
  "message": "OK"
}


Updated 11 months ago

Passport Card
Social Security Card
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