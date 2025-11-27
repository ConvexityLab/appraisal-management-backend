# State ID

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
State ID
Suggest Edits

State IDs, for our purposes, are any state-issued identification cards besides driver's licenses. With the exception of driver's licenses, we don't distinguish between different types of state IDs.

We support cards from all fifty states and Washington, DC. We do not support identification from U.S. territories or Native American tribal governments.

To use the Upload PDF endpoint for this document, you must use STATE_ID in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
state_id-General:firstName	Text	First Name
state_id-General:middleName	Text	Middle Name
state_id-General:lastName	Text	Last Name
state_id-General:suffix	Text	Suffix
state_id-General:addressLine1	Text	Address Line 1
state_id-General:addressLine2	Text	Address Line 2
state_id-General:city	Text	City
state_id-General:state	State	State
state_id-General:zip	ZIP Code	Zip
state_id-General:countryName	UNITED STATES, OTHER	Country Name
state_id-General:dob	Date	DOB
state_id-General:expirationDate	Date	Expiration Date
state_id-General:idNumber	Text	ID Number
state_id-General:issuingState	State	Issuing State
state_id-General:issueDate	Date	Issue Date
Sample document
drive.google.com
ILLINOIS- State ID.pdf
Sample JSON result
JSON
{
  "status": 200,
  "response": {
    "pk": 18973556,
    "uuid": "0de3512e-4e2a-4c8d-95fe-dd38565fa9a2",
    "name": "State ID API Documentation",
    "created": "2022-06-07T21:57:04Z",
    "created_ts": "2022-06-07T21:57:04Z",
    "verified_pages_count": 1,
    "book_status": "ACTIVE",
    "id": 18973556,
    "forms": [
      {
        "pk": 37889509,
        "uuid": "1c8ce133-6efc-4415-8e82-4ab6ea6b4c4c",
        "form_type": "STATE_ID",
        "raw_fields": {
          "state_id-General:dob": {
            "value": "12/01/1989",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "ILLINOIS- State ID.pdf"
          },
          "state_id-General:zip": {
            "value": "54321",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "ILLINOIS- State ID.pdf"
          },
          "state_id-General:city": {
            "value": "ORLAND PARK",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "ILLINOIS- State ID.pdf"
          },
          "state_id-General:state": {
            "value": "IL",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "ILLINOIS- State ID.pdf"
          },
          "state_id-General:suffix": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "ILLINOIS- State ID.pdf"
          },
          "state_id-General:idNumber": {
            "value": "123-4567-11",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "ILLINOIS- State ID.pdf"
          },
          "state_id-General:lastName": {
            "value": "BENJAMIN",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "ILLINOIS- State ID.pdf"
          },
          "state_id-General:firstName": {
            "value": "SAMPLE",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "ILLINOIS- State ID.pdf"
          },
          "state_id-General:issueDate": {
            "value": "01/21/2012",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "ILLINOIS- State ID.pdf"
          },
          "state_id-General:middleName": {
            "value": "L.",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "ILLINOIS- State ID.pdf"
          },
          "state_id-General:countryName": {
            "value": "UNITED STATES",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "ILLINOIS- State ID.pdf"
          },
          "state_id-General:addressLine1": {
            "value": "123 AVENUE PARK",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "ILLINOIS- State ID.pdf"
          },
          "state_id-General:addressLine2": {
            "value": "SUITE 321",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "ILLINOIS- State ID.pdf"
          },
          "state_id-General:issuingState": {
            "value": "IL",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "ILLINOIS- State ID.pdf"
          },
          "state_id-General:expirationDate": {
            "value": "01/21/2022",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "ILLINOIS- State ID.pdf"
          }
        },
        "form_config_pk": 47532,
        "tables": []
      }
    ],
    "book_is_complete": true
  },
  "message": "OK"
}


Updated 11 months ago

SEE ALSO
Driver's license
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