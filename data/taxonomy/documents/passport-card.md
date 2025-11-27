# Passport Card

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
Passport Card
Suggest Edits

A passport card is a travel document issued by a country's government that verifies the identity and nationality of the holder for the purpose of international travel. Passport cards generally have more restrictions than full-fledged passports.

To use the Upload PDF endpoint for this document, you must use PASSPORT_CARD in the form_type parameter. Do not confuse this form type with PASSPORT; the two documents are similar but not identical.

Field descriptions

The following fields are available on this document type:

JSON attribute	Data type	Description
passport_card-General:passportCardNumber	Text	Passport Card Number
passport_card-General:firstName	Text	First Name
passport_card-General:middleName	Text	Middle Name
passport_card-General:lastName	Text	Last Name
passport_card-General:suffix	Text	Suffix
passport_card-General:issuingCountry	UNITED STATES, OTHER	Issuing Country
passport_card-General:dateOfBirth	Date	Date of Birth
passport_card-General:issueDate	Date	Issue Date
passport_card-General:expirationDate	Date	Expiration Date
Sample document

Coming soon...

Sample JSON result
JSON
{
  "status": 200,
  "response": {
    "pk": 16181648,
    "uuid": "29740908-0353-49d8-ad5d-ccc3254f4442",
    "name": "Passport Card Sample for API Documentation",
    "created": "2022-01-19T21:27:51Z",
    "created_ts": "2022-01-19T21:27:51Z",
    "verified_pages_count": 1,
    "book_status": "ACTIVE",
    "id": 16181648,
    "forms": [
      {
        "pk": 33880164,
        "uuid": "52e4b3ed-09d7-4f08-a2f5-72d093e15dfb",
        "form_type": "PASSPORT_CARD",
        "raw_fields": {
          "passport_card-General:suffix": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "Passport Card Sample 1.pdf"
          },
          "passport_card-General:lastName": {
            "value": "MENDENHALL",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Passport Card Sample 1.pdf"
          },
          "passport_card-General:firstName": {
            "value": "THOMAS",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Passport Card Sample 1.pdf"
          },
          "passport_card-General:issueDate": {
            "value": "07/07/2010",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Passport Card Sample 1.pdf",
            "validation_error": "Issue Date must be before Expiration Date"
          },
          "passport_card-General:middleName": {
            "value": "CROWIN",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Passport Card Sample 1.pdf"
          },
          "passport_card-General:dateOfBirth": {
            "value": "06/05/1990",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Passport Card Sample 1.pdf",
            "validation_error": "Date of Birth must be before Issue Date"
          },
          "passport_card-General:expirationDate": {
            "value": "12/25/2031",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Passport Card Sample 1.pdf",
            "validation_error": "On US passports, if person is below 16 years old on issue date, expiration date should be 5 years from issue date. On US passports, if person is above 16, expiration date should be 10 years from issue date. User should review."
          },
          "passport_card-General:issuingCountry": {
            "value": "UNITED STATES",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Passport Card Sample 1.pdf"
          },
          "passport_card-General:passportCardNumber": {
            "value": "C98215431",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "Passport Card Sample 1.pdf"
          }
        },
        "form_config_pk": 29153,
        "tables": []
      }
    ],
    "book_is_complete": true
  },
  "message": "OK"
}


Updated 11 months ago

SEE ALSO
Passport
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