# Social Security Card

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
Social Security Card
Suggest Edits

A Social Security card is a government-issued document displaying an individual's name and unique national ID number.

To use the Upload PDF endpoint for this document, you must use SOCIAL_SECURITY_CARD in the form_type parameter. To learn more about processing a Social Security Card, click here.

Field descriptions

The following fields are available on this document type:

JSON attribute	Data type	Description
social_security_card-General:firstName	Text	First name of the individual
social_security_card-General:middleName	Text	Middle name of the individual
social_security_card-General:lastName	Text	Last name of the individual
social_security_card-General:suffix	Text	Default is_empty = TRUE, Suffix of the individual
social_security_card-General:number	Text	Formatted XXX-XX-XXXX. Social Security Number issued to the individual
Sample document

Coming soon...

Sample JSON result
JSON
{
  "status": 200,
  "response": {
    "pk": 30476609,
    "uuid": "e146a8c4-0c7b-4ce3-a523-607dfb6b1a9f",
    "forms": [
      {
        "pk": 30029183,
        "uuid": "e476a524-cf4e-497a-9b48-9ab1f82d45b5",
        "form_type": "SOCIAL_SECURITY_CARD",
        "form_config_pk": 18854,
        "tables": [],
        "raw_fields": {
          "social_security_card-General:number": {
            "value": "854-65-9582",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Social Security Card Sample 1.pdf"
          },
          "social_security_card-General:suffix": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "Social Security Card Sample 1.pdf"
          },
          "social_security_card-General:lastName": {
            "value": "ARON",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Social Security Card Sample 1.pdf"
          },
          "social_security_card-General:firstName": {
            "value": "ELVISH",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Social Security Card Sample 1.pdf"
          },
          "social_security_card-General:middleName": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "Social Security Card Sample 1.pdf"
          }
        }
      }
    ]
  },
  "message": "OK"
}


Updated 11 months ago

Permanent Resident Card
State ID
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