# Direct Deposit Authorization

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
Direct Deposit Authorization
Suggest Edits

A Direct Deposit Authorization form is a form that an employee fills out to allow their employer to electronically send money directly into their bank account.

To use the Upload PDF endpoint for this document, you must use DIRECT_DEPOSIT_AUTHORIZATION in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
direct_deposit_authorization-Part1-CustomerDetails:employeeName	Text	Employee Name
direct_deposit_authorization-Part1-CustomerDetails:employeeAddress:addressLine1	Text	Employee Address
direct_deposit_authorization-Part1-CustomerDetails:employeeAddress:addressLine2	Text	Employee Address
direct_deposit_authorization-Part1-CustomerDetails:employeeAddress:city	Text	Employee Address
direct_deposit_authorization-Part1-CustomerDetails:employeeAddress:state	State	Employee Address
direct_deposit_authorization-Part1-CustomerDetails:employeeAddress:zipCode	ZIP Code	Employee Address
direct_deposit_authorization-Part1-CustomerDetails:employeePhoneNumber	Phone Number	Employee Phone Number
direct_deposit_authorization-Part1-CustomerDetails:employeeSocialSecurityNumber	Social Security Number	Employee Social Security Number
direct_deposit_authorization-Part2-BankAccountDetails:bankName	Bank	Bank Name
direct_deposit_authorization-Part2-BankAccountDetails:bankAddress:addressLine1	Text	Bank Address
direct_deposit_authorization-Part2-BankAccountDetails:bankAddress:addressLine2	Text	Bank Address
direct_deposit_authorization-Part2-BankAccountDetails:bankAddress:city	Text	Bank Address
direct_deposit_authorization-Part2-BankAccountDetails:bankAddress:state	State	Bank Address
direct_deposit_authorization-Part2-BankAccountDetails:bankAddress:zipCode	ZIP Code	Bank Address
direct_deposit_authorization-Part2-BankAccountDetails:accountNumber	Integer	Account Number
direct_deposit_authorization-Part2-BankAccountDetails:routingNumber	Routing Number	Routing Number
direct_deposit_authorization-Part2-BankAccountDetails:typeOfAccount	CHECKING, SAVINGS	Type Of Account
direct_deposit_authorization-Part2-BankAccountDetails:partneringInstitutionName	Bank	Partnering Institution Name
direct_deposit_authorization-Part2-BankAccountDetails:employeeSignature	SIGNED, NOT SIGNED	Employee Signature
direct_deposit_authorization-Part2-BankAccountDetails:employeeSignatureDate	Date	Employee Signature Date
Sample document
drive.google.com
Direct Deposit Authorization.pdf
Sample JSON result
JSON
{
  "pk": 51041172,
  "uuid": "d9337604-1978-4c5f-979d-49c79ed6e361",
  "name": "DIRECT_DEPOSIT_AUTHORIZATION",
  "created": "2024-06-10T15:58:58Z",
  "created_ts": "2024-06-10T15:58:58Z",
  "verified_pages_count": 1,
  "book_status": "ACTIVE",
  "id": 51041172,
  "forms": [
    {
      "pk": 55872749,
      "uuid": "837e35b6-f839-4d1d-9f6b-baae512b1323",
      "uploaded_doc_pk": 72814218,
      "form_type": "DIRECT_DEPOSIT_AUTHORIZATION",
      "raw_fields": {
        "direct_deposit_authorization-Part2-BankAccountDetails:bankName": {
          "value": "CHASE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Direct Deposit Authorization.pdf",
          "confidence": 1.0
        },
        "direct_deposit_authorization-Part1-CustomerDetails:employeeName": {
          "value": "JONE DOW SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Direct Deposit Authorization.pdf",
          "confidence": 1.0
        },
        "direct_deposit_authorization-Part2-BankAccountDetails:accountNumber": {
          "value": "000123456789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Direct Deposit Authorization.pdf",
          "confidence": 1.0
        },
        "direct_deposit_authorization-Part2-BankAccountDetails:routingNumber": {
          "value": "123456789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Direct Deposit Authorization.pdf",
          "confidence": 1.0
        },
        "direct_deposit_authorization-Part2-BankAccountDetails:typeOfAccount": {
          "value": "CHECKING",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Direct Deposit Authorization.pdf",
          "confidence": 1.0
        },
        "direct_deposit_authorization-Part1-CustomerDetails:employeePhoneNumber": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Direct Deposit Authorization.pdf",
          "confidence": 1.0
        },
        "direct_deposit_authorization-Part2-BankAccountDetails:bankAddress:city": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Direct Deposit Authorization.pdf",
          "confidence": 1.0
        },
        "direct_deposit_authorization-Part1-CustomerDetails:employeeAddress:city": {
          "value": "ANY CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Direct Deposit Authorization.pdf",
          "confidence": 1.0
        },
        "direct_deposit_authorization-Part2-BankAccountDetails:bankAddress:state": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Direct Deposit Authorization.pdf",
          "confidence": 1.0
        },
        "direct_deposit_authorization-Part2-BankAccountDetails:employeeSignature": {
          "value": "NOT SIGNED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Direct Deposit Authorization.pdf",
          "confidence": 1.0
        },
        "direct_deposit_authorization-Part1-CustomerDetails:employeeAddress:state": {
          "value": "CA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Direct Deposit Authorization.pdf",
          "confidence": 1.0
        },
        "direct_deposit_authorization-Part2-BankAccountDetails:bankAddress:zipCode": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Direct Deposit Authorization.pdf",
          "confidence": 1.0
        },
        "direct_deposit_authorization-Part1-CustomerDetails:employeeAddress:zipCode": {
          "value": "11111",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Direct Deposit Authorization.pdf",
          "confidence": 1.0
        },
        "direct_deposit_authorization-Part2-BankAccountDetails:employeeSignatureDate": {
          "value": "01/01/2024",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Direct Deposit Authorization.pdf",
          "confidence": 1.0
        },
        "direct_deposit_authorization-Part2-BankAccountDetails:bankAddress:addressLine1": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Direct Deposit Authorization.pdf",
          "confidence": 1.0
        },
        "direct_deposit_authorization-Part2-BankAccountDetails:bankAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Direct Deposit Authorization.pdf",
          "confidence": 1.0
        },
        "direct_deposit_authorization-Part1-CustomerDetails:employeeAddress:addressLine1": {
          "value": "123 ANY SW STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Direct Deposit Authorization.pdf",
          "confidence": 1.0
        },
        "direct_deposit_authorization-Part1-CustomerDetails:employeeAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Direct Deposit Authorization.pdf",
          "confidence": 1.0
        },
        "direct_deposit_authorization-Part1-CustomerDetails:employeeSocialSecurityNumber": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Direct Deposit Authorization.pdf",
          "confidence": 1.0
        },
        "direct_deposit_authorization-Part2-BankAccountDetails:partneringInstitutionName": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Direct Deposit Authorization.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 606361,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Birth Certificate
H-1B - Non-Immigrant Employment Visa
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