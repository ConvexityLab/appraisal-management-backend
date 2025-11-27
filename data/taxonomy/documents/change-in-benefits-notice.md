# Change in Benefits Notice

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
Annuity Award Letter
Balance Sheet
Career Data Brief
Change in Benefits Notice
Combat-Related Special Compensation (CRSC) Pay Statement
Disability Award Letter
IRS Form SSA-1099 - Social Security Benefit Statement
Member Data Summary
Office of Personnel Management (OPM) Annuity Statement
Income calculation definitions
Pay Stub
Pension Award Letter
Profit and Loss Statement
Social Security Award Letter
Soldier Talent Profile
Veterans Affairs (VA) Award Letter
VOE (1005) - Request for Verification of Employment
VOE (generic) - Verification of Employment Report
VOE (work number) - The Work Number Verification of Employment Report
VOIE (Finicity) - Finicity Verification of Income and Employment
Legal
Mortgage specific forms
Other
Property
Tax forms
Data types
Change in Benefits Notice
Suggest Edits

It is a formal communication typically issued by an employer, insurance company, or government agency to inform an individual or group about changes to a benefits plan or program. This notice can apply to various types of benefits, including health insurance, retirement plans, welfare benefits, or any other employee or government assistance programs.

To use the Upload PDF endpoint endpoint for this document, you must use CHANGE_IN_BENEFITS_NOTICE in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
change_in_benefits_notice-Part1-General:reference#	Text	Reference #
change_in_benefits_notice-Part1-General:issueDate	Date	Issue Date
change_in_benefits_notice-Part1-General:typeOfBenefit	DISABILITY, RETIREMENT, OTHER	Type Of Benefit
change_in_benefits_notice-Part1-General:typeOfBenefit-IfOther	Text	Type Of Benefit - If Other
change_in_benefits_notice-Part1-General:benefitExpirationDate	Date	Benefit Expiration Date
change_in_benefits_notice-Part1-General:issuingCompanyName	Text	Issuing Company Name
change_in_benefits_notice-Part1-General:socialSecurityNumber	Social Security Number	Social Security Number
change_in_benefits_notice-Part1-General:beneficiaryName	Text	Beneficiary Name
change_in_benefits_notice-Part1-General:beneficiaryAddress:addressLine1	Text	Beneficiary Address
change_in_benefits_notice-Part1-General:beneficiaryAddress:addressLine2	Text	Beneficiary Address
change_in_benefits_notice-Part1-General:beneficiaryAddress:city	Text	Beneficiary Address
change_in_benefits_notice-Part1-General:beneficiaryAddress:state	State	Beneficiary Address
change_in_benefits_notice-Part1-General:beneficiaryAddress:zipCode	ZIP Code	Beneficiary Address
change_in_benefits_notice-Part1-General:currentMonthlyBenefitAmount(Gross)	Money	Current Monthly Benefit Amount (Gross)
Sample document
drive.google.com
CHANGE_IN_BENEFITS_NOTICE.pdf
Sample JSON result
JSON
{
  "pk": 47309449,
  "uuid": "dd8dcca2-eee3-46b7-a889-9ec9134321c3",
  "name": "CHANGE_IN_BENEFITS_NOTICE (API)",
  "created": "2024-03-08T20:54:50Z",
  "created_ts": "2024-03-08T20:54:50Z",
  "verified_pages_count": 2,
  "book_status": "ACTIVE",
  "id": 47309449,
  "forms": [
    {
      "pk": 53577242,
      "uuid": "ec5b99b5-3ec6-4ca6-ad13-37c43a1af6fc",
      "uploaded_doc_pk": 68028220,
      "form_type": "CHANGE_IN_BENEFITS_NOTICE",
      "raw_fields": {
        "change_in_benefits_notice-Part1-General:issueDate": {
          "value": "01/25/2022",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "CHANGE_IN_BENEFITS_NOTICE.pdf",
          "confidence": 1.0
        },
        "change_in_benefits_notice-Part1-General:reference#": {
          "value": "12345679",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "CHANGE_IN_BENEFITS_NOTICE.pdf",
          "confidence": 1.0
        },
        "change_in_benefits_notice-Part1-General:typeOfBenefit": {
          "value": "RETIREMENT",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "CHANGE_IN_BENEFITS_NOTICE.pdf",
          "confidence": 1.0
        },
        "change_in_benefits_notice-Part1-General:beneficiaryName": {
          "value": "NATHAN FAKE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "CHANGE_IN_BENEFITS_NOTICE.pdf",
          "confidence": 1.0
        },
        "change_in_benefits_notice-Part1-General:issuingCompanyName": {
          "value": "FAKE STATE AND LOCAL RETIREMENT SYSTEM",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "CHANGE_IN_BENEFITS_NOTICE.pdf",
          "confidence": 1.0
        },
        "change_in_benefits_notice-Part1-General:socialSecurityNumber": {
          "value": "123-45-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "CHANGE_IN_BENEFITS_NOTICE.pdf",
          "confidence": 1.0
        },
        "change_in_benefits_notice-Part1-General:benefitExpirationDate": {
          "value": "03/31/2032",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "CHANGE_IN_BENEFITS_NOTICE.pdf",
          "confidence": 1.0
        },
        "change_in_benefits_notice-Part1-General:typeOfBenefit-IfOther": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "CHANGE_IN_BENEFITS_NOTICE.pdf",
          "confidence": 1.0
        },
        "change_in_benefits_notice-Part1-General:beneficiaryAddress:city": {
          "value": "ANY CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "CHANGE_IN_BENEFITS_NOTICE.pdf",
          "confidence": 1.0
        },
        "change_in_benefits_notice-Part1-General:beneficiaryAddress:state": {
          "value": "CA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "CHANGE_IN_BENEFITS_NOTICE.pdf",
          "confidence": 1.0
        },
        "change_in_benefits_notice-Part1-General:beneficiaryAddress:zipCode": {
          "value": "12346",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "CHANGE_IN_BENEFITS_NOTICE.pdf",
          "confidence": 1.0
        },
        "change_in_benefits_notice-Part1-General:beneficiaryAddress:addressLine1": {
          "value": "12 ANY STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "CHANGE_IN_BENEFITS_NOTICE.pdf",
          "confidence": 1.0
        },
        "change_in_benefits_notice-Part1-General:beneficiaryAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "CHANGE_IN_BENEFITS_NOTICE.pdf",
          "confidence": 1.0
        },
        "change_in_benefits_notice-Part1-General:currentMonthlyBenefitAmount(Gross)": {
          "value": "1760.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "CHANGE_IN_BENEFITS_NOTICE.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 331206,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Career Data Brief
Combat-Related Special Compensation (CRSC) Pay Statement
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