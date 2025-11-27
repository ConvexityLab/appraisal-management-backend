# H-1B - Non-Immigrant Employment Visa

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
H-1B - Non-Immigrant Employment Visa
Suggest Edits

The H-1B is a type of visa in the United States under the Immigration and Nationality Act, section 101(a)(15)(H). It allows U.S. employers to employ foreign workers temporarily in specialty occupations.

To use the Upload PDF endpoint for this document, you must use H1B in the form_type parameter. The captured field data attributed directly to an H-1B visa as form data objects, each one keyed off the below attribute names.

Field descriptions

The following fields are available on this document type:

JSON attribute	Data type	Description
h1b-General:firstName	Text	First Name
h1b-General:middleName	Text	Middle Name
h1b-General:lastName	Text	Last Name
h1b-General:suffix	Text	Suffix
h1b-General:dateOfBirth	Date	Date of Birth
h1b-General:issuingCountry	UNITED STATES, and OTHER	Issuing Country
h1b-General:expirationDate	Date	Expiration Date
Sample document
drive.google.com
H1B (1).pdf
Sample JSON result
JSON
{
    "status": 200,
    "response": {
        "pk": 29698370,
        "uuid": "5e83d19c-fa8b-45ca-85d9-06e1639a2736",
        "forms": [
        {
                "pk": 44337978,
                "uuid": "1f17dce3-c794-467a-b99d-e2baa717b8f1",
                "uploaded_doc_pk": 51891149,
                "form_type": "H1B",
                "raw_fields": {
                    "h1b-General:suffix": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "H1B (1) (1).pdf"
                    },
                    "h1b-General:lastName": {
                        "value": "FAKE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "H1B (1) (1).pdf"
                    },
                    "h1b-General:firstName": {
                        "value": "JOHN",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "H1B (1) (1).pdf"
                    },
                    "h1b-General:middleName": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "H1B (1) (1).pdf"
                    },
                    "h1b-General:dateOfBirth": {
                        "value": "02/11/1992",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "H1B (1) (1).pdf"
                    },
                    "h1b-General:expirationDate": {
                        "value": "03/10/2029",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "H1B (1) (1).pdf"
                    }
                },
                "form_config_pk": 203932,
                "tables": []
            },
    "message": "OK"
}


Updated 11 months ago

Direct Deposit Authorization
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