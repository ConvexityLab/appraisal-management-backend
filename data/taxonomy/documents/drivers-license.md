# US Driver's License

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
US Driver's License
Suggest Edits

A driver's license is a document issued by a government authority that permits the holder to operate a motor vehicle.

To use the Upload PDF endpoint for this document, you must use DRIVERS_LICENSE in the form_type parameter. To learn more about US Driver's License processing, click here.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
drivers_license-General:firstName	Text	First name of the individual who owns the drivers license
drivers_license-General:middleName	Text	Middle name of the individual who owns the drivers license
drivers_license-General:lastName	Text	Last name of the individual who owns the drivers license
drivers_license-General:suffix	Text	Default is_empty = TRUE, Suffix of the individual who owns the drivers license
drivers_license-General:dob	Date	Date of birth of the individual who owns the drivers license
drivers_license-General:addressLine1	Text	Address 1 of the individual who owns the drivers license
drivers_license-General:addressLine2	Text	Address 2 of the individual who owns the drivers license
drivers_license-General:city	Text	City in which the drivers license owner resides
drivers_license-General:state	Text	Formatted as a 2 character state code. State in which the drivers license owner resides
drivers_license-General:zip	Text	5 digit zip code in which the drivers license owner resides
drivers_license-General:countryName	UNITED STATES and OTHER	Country in which the issuing state resides
drivers_license-General:expirationDate	Date	Expiration date of the drivers license
drivers_license-General:idNumber	Text	Unique identification number of the drivers license
drivers_license-General:issuingState	Text	Formatted as a 2 character state code. State which issued the drivers license
drivers_license-General:issueDate	Date	The date on which the license was issued and made effective
Sample document
drive.google.com
Drivers License.pdf
Sample JSON response
JSON
{
    "status": 200,
    "response": {
        "pk": 29698370,
        "uuid": "5e83d19c-fa8b-45ca-85d9-06e1639a2736",
        "forms": [
        {
                "pk": 44337552,
                "uuid": "a7be6e75-b580-4c92-bf13-0bf9183c7769",
                "uploaded_doc_pk": 51890560,
                "form_type": "DRIVERS_LICENSE",
                "raw_fields": {
                    "drivers_license-General:dob": {
                        "value": "01/06/1988",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Drivers License.pdf"
                    },
                    "drivers_license-General:zip": {
                        "value": "12345",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Drivers License.pdf"
                    },
                    "drivers_license-General:city": {
                        "value": "FAKE CITY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Drivers License.pdf"
                    },
                    "drivers_license-General:state": {
                        "value": "NY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Drivers License.pdf"
                    },
                    "drivers_license-General:suffix": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Drivers License.pdf"
                    },
                    "drivers_license-General:idNumber": {
                        "value": "XXX1234XXXX",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Drivers License.pdf"
                    },
                    "drivers_license-General:lastName": {
                        "value": "SAMPLE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Drivers License.pdf"
                    },
                    "drivers_license-General:firstName": {
                        "value": "CHARLES",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Drivers License.pdf"
                    },
                    "drivers_license-General:issueDate": {
                        "value": "01/01/2015",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Drivers License.pdf"
                    },
                    "drivers_license-General:middleName": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Drivers License.pdf"
                    },
                    "drivers_license-General:countryName": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Drivers License.pdf"
                    },
                    "drivers_license-General:addressLine1": {
                        "value": "100 FAKE PLAZA",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Drivers License.pdf"
                    },
                    "drivers_license-General:addressLine2": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Drivers License.pdf"
                    },
                    "drivers_license-General:issuingState": {
                        "value": "WA",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Drivers License.pdf"
                    },
                    "drivers_license-General:expirationDate": {
                        "value": "12/12/2024",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Drivers License.pdf"
                    }
                },
                "form_config_pk": 137677,
                "tables": []
            },
    "message": "OK"
}


Updated 11 months ago

State ID
Utility Bill
Did this page help you?
Yes
No
TABLE OF CONTENTS
Field descriptions
Sample document
Sample JSON response
Home
Guides
API
Supported documents
Release notes

Ocrolus © 2025. All rights reserved. Legal | Privacy Policy