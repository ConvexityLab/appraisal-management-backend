# Disability Award Letter

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
Disability Award Letter
Suggest Edits

This award letter details relevant information about your disability benefits eligibility and payments, including the date you became disabled (also known as the onset date), the first month you are entitled to receive benefits, and any lump sum amount of past due benefits that you are owed (also known as your back pay).

To use the Upload PDF endpoint for this document, you must use DISABILITY_AWARD_LETTER in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
disability_award_letter-Part1-General:dateOfLetter	Date	Date Of Letter
disability_award_letter-Part1-General:claimNumber	Text	Claim Number
disability_award_letter-Part1-General:socialSecurityNumber	Social Security Number	Social Security Number
disability_award_letter-Part1-General:issuingCompanyName	Text	Issuing Company Name
disability_award_letter-Part1-General:officeAddress:addressLine1	Text	Office Address
disability_award_letter-Part1-General:officeAddress:addressLine2	Text	Office Address
disability_award_letter-Part1-General:officeAddress:city	Text	Office Address
disability_award_letter-Part1-General:officeAddress:state	State	Office Address
disability_award_letter-Part1-General:officeAddress:zipCode	ZIP Code	Office Address
disability_award_letter-Part2-Beneficiary:beneficiaryName	Text	Beneficiary Name
disability_award_letter-Part2-Beneficiary:custodial/guardian	Text	Custodian/Guardian
disability_award_letter-Part2-Beneficiary:beneficiaryAddress:addressLine1	Text	Beneficiary Address
disability_award_letter-Part2-Beneficiary:beneficiaryAddress:addressLine2	Text	Beneficiary Address
disability_award_letter-Part2-Beneficiary:beneficiaryAddress:city	Text	Beneficiary Address
disability_award_letter-Part2-Beneficiary:beneficiaryAddress:state	State	Beneficiary Address
disability_award_letter-Part2-Beneficiary:beneficiaryAddress:zipCode	ZIP Code	Beneficiary Address
disability_award_letter-Part3-Date&Amount:disabilityDate	Date	Disability Date
disability_award_letter-Part3-Date&Amount:backPayTotal	Money	Back Pay Total
disability_award_letter-Part3-Date&Amount:backPayDate	Date	Back Pay Date
disability_award_letter-Part3-Date&Amount:monthlyBenefitAmount	Money	Monthly Benefit Amount
disability_award_letter-Part3-Date&Amount:monthlyBenefitCadence	Text	Monthly Benefit Cadence
disability_award_letter-Part3-Date&Amount:benefitExpirationDate	Date	Benefit Expiration Date
Sample document
drive.google.com
DISABILITY_AWARD_LETTER.pdf
Sample JSON result
JSON
{
  "pk": 47309389,
  "uuid": "7c03bcad-6e8a-4277-bfa2-327ffc000972",
  "name": "DISABILITY_AWARD_LETTER (API)",
  "created": "2024-03-08T20:53:52Z",
  "created_ts": "2024-03-08T20:53:52Z",
  "verified_pages_count": 1,
  "book_status": "ACTIVE",
  "id": 47309389,
  "forms": [
    {
      "pk": 53577211,
      "uuid": "38b14954-9a32-40f9-88e0-d09a31d5d5e3",
      "uploaded_doc_pk": 68028142,
      "form_type": "DISABILITY_AWARD_LETTER",
      "raw_fields": {
        "disability_award_letter-Part1-General:claimNumber": {
          "value": "ABC-12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DISABILITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "disability_award_letter-Part1-General:dateOfLetter": {
          "value": "01/01/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DISABILITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "disability_award_letter-Part3-Date&Amount:backPayDate": {
          "value": "03/07/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DISABILITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "disability_award_letter-Part3-Date&Amount:backPayTotal": {
          "value": "7356.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DISABILITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "disability_award_letter-Part1-General:issuingCompanyName": {
          "value": "FAKE LIFE ASSURANCE COMPANY OF NEW YORK",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DISABILITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "disability_award_letter-Part1-General:officeAddress:city": {
          "value": "FAKE CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DISABILITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "disability_award_letter-Part3-Date&Amount:disabilityDate": {
          "value": "12/07/2020",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DISABILITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "disability_award_letter-Part1-General:officeAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DISABILITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "disability_award_letter-Part2-Beneficiary:beneficiaryName": {
          "value": "JOHN SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DISABILITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "disability_award_letter-Part1-General:socialSecurityNumber": {
          "value": "123-45-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DISABILITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "disability_award_letter-Part1-General:officeAddress:zipCode": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DISABILITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "disability_award_letter-Part2-Beneficiary:custodial/guardian": {
          "value": "SMITH SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DISABILITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "disability_award_letter-Part3-Date&Amount:monthlyBenefitAmount": {
          "value": "6000.01",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DISABILITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "disability_award_letter-Part3-Date&Amount:benefitExpirationDate": {
          "value": "01/01/2040",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DISABILITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "disability_award_letter-Part3-Date&Amount:monthlyBenefitCadence": {
          "value": "SECOND WEDNESDAY OF EACH MONTH",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DISABILITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "disability_award_letter-Part1-General:officeAddress:addressLine1": {
          "value": "123 FAKE MEMORIAL AVE.",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DISABILITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "disability_award_letter-Part1-General:officeAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "DISABILITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "disability_award_letter-Part2-Beneficiary:beneficiaryAddress:city": {
          "value": "FAKE CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DISABILITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "disability_award_letter-Part2-Beneficiary:beneficiaryAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DISABILITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "disability_award_letter-Part2-Beneficiary:beneficiaryAddress:zipCode": {
          "value": "12345-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DISABILITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "disability_award_letter-Part2-Beneficiary:beneficiaryAddress:addressLine1": {
          "value": "123 SAMPLE AVE.",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DISABILITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "disability_award_letter-Part2-Beneficiary:beneficiaryAddress:addressLine2": {
          "value": "APARTMENT #1",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "DISABILITY_AWARD_LETTER.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 342634,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Combat-Related Special Compensation (CRSC) Pay Statement
IRS Form SSA-1099 - Social Security Benefit Statement
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