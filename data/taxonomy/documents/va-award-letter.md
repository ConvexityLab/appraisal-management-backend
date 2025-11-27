# Veterans Affairs (VA) Award Letter

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
Veterans Affairs (VA) Award Letter
Suggest Edits

This letter is issued by the Department of Veterans Affairs (VA) when a decision has been made regarding a veteran's claim for benefits issued A VA award letter. Specifically, this letter indicates a veteran's disability rating(s) along with the corresponding amount of monthly compensation.

To use the Upload PDF endpoint for this document, you must use VA_AWARD_LETTER in the form_type parameter.

Field descriptions

The following fields are available on this form type:

JSON Attribute	Data Type	Description
va_award_letter-Part1-General:documentDate	Date	Document Date
va_award_letter-Part1-General:claimNumber	Text	Claim Number
va_award_letter-Part1-General:beneficiaryName	Text	Beneficiary Name
va_award_letter-Part1-General:beneficiaryAddress:addressLine1	Text	Beneficiary Address
va_award_letter-Part1-General:beneficiaryAddress:addressLine2	Text	Beneficiary Address
va_award_letter-Part1-General:beneficiaryAddress:city	Text	Beneficiary Address
va_award_letter-Part1-General:beneficiaryAddress:state	State	Beneficiary Address
va_award_letter-Part1-General:beneficiaryAddress:zipCode	ZIP Code	Beneficiary Address
va_award_letter-Part1-General:branchOfService	Text	Branch Of Service
va_award_letter-Part1-General:characterOfService	Text	Character Of Service
va_award_letter-Part1-General:service-connectedDisability	YES, NO	Service-connected Disability
va_award_letter-Part1-General:grossBenefitAmount	Money	Gross Benefit Amount
va_award_letter-Part1-General:netAmountPaid	Money	Net Amount Paid
va_award_letter-Part1-General:effectiveDate	Date	Effective Date
va_award_letter-Part1-General:benefitExpirationDate	Date	Benefit Expiration Date
va_award_letter-Part1-General:evaluation%	Percentage	Evaluation %
va_award_letter-Part1-General:enteredActiveDuty	Date	Entered Active Duty
va_award_letter-Part1-General:released/discharged	Date	Released/Discharged
Sample document
drive.google.com
VA_AWARD_LETTER.pdf
Sample JSON result
JSON
{
    "pk": 47612218,
    "uuid": "2a9ba47d-f2e3-4790-9574-e25698b505f3",
    "name": "VA_AWARD_LETTER (API)",
    "created": "2024-03-15T14:55:15Z",
    "created_ts": "2024-03-15T14:55:15Z",
    "verified_pages_count": 1,
    "book_status": "ACTIVE",
    "id": 47612218,
    "forms": [
        {
            "pk": 53740230,
            "uuid": "4b5236da-fbad-4839-b070-39067ace8246",
            "uploaded_doc_pk": 68384153,
            "form_type": "VA_AWARD_LETTER",
            "raw_fields": {
                "va_award_letter-Part1-General:claimNumber": {
                    "value": "XXX-XX-1234",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "VA_AWARD_LETTER.pdf",
                    "confidence": 1
                },
                "va_award_letter-Part1-General:evaluation%": {
                    "value": "60%",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "VA_AWARD_LETTER.pdf",
                    "confidence": 1
                },
                "va_award_letter-Part1-General:documentDate": {
                    "value": "07/21/2023",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "VA_AWARD_LETTER.pdf",
                    "confidence": 1
                },
                "va_award_letter-Part1-General:effectiveDate": {
                    "value": "12/01/2022",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "VA_AWARD_LETTER.pdf",
                    "confidence": 1
                },
                "va_award_letter-Part1-General:netAmountPaid": {
                    "value": "",
                    "is_empty": true,
                    "alias_used": null,
                    "source_filename": "VA_AWARD_LETTER.pdf",
                    "confidence": 1
                },
                "va_award_letter-Part1-General:beneficiaryName": {
                    "value": "ROBERT FAKE",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "VA_AWARD_LETTER.pdf",
                    "confidence": 1
                },
                "va_award_letter-Part1-General:branchOfService": {
                    "value": "COAST GUARD",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "VA_AWARD_LETTER.pdf",
                    "confidence": 1
                },
                "va_award_letter-Part1-General:characterOfService": {
                    "value": "HONORABLE",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "VA_AWARD_LETTER.pdf",
                    "confidence": 1
                },
                "va_award_letter-Part1-General:grossBenefitAmount": {
                    "value": "1588.65",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "VA_AWARD_LETTER.pdf",
                    "confidence": 1
                },
                "va_award_letter-Part1-General:benefitExpirationDate": {
                    "value": "",
                    "is_empty": true,
                    "alias_used": null,
                    "source_filename": "VA_AWARD_LETTER.pdf",
                    "confidence": 1
                },
                "va_award_letter-Part1-General:beneficiaryAddress:city": {
                    "value": "NEW CITY",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "VA_AWARD_LETTER.pdf",
                    "confidence": 1
                },
                "va_award_letter-Part1-General:beneficiaryAddress:state": {
                    "value": "NY",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "VA_AWARD_LETTER.pdf",
                    "confidence": 1
                },
                "va_award_letter-Part1-General:beneficiaryAddress:zipCode": {
                    "value": "12345",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "VA_AWARD_LETTER.pdf",
                    "confidence": 1
                },
                "va_award_letter-Part1-General:service-connectedDisability": {
                    "value": "YES",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "VA_AWARD_LETTER.pdf",
                    "confidence": 1
                },
                "va_award_letter-Part1-General:beneficiaryAddress:addressLine1": {
                    "value": "123 FAKE MEMORIAL STREET",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "VA_AWARD_LETTER.pdf",
                    "confidence": 1
                },
                "va_award_letter-Part1-General:beneficiaryAddress:addressLine2": {
                    "value": "",
                    "is_empty": true,
                    "alias_used": null,
                    "source_filename": "VA_AWARD_LETTER.pdf",
                    "confidence": 1
                },
                "va_award_letter-Part1-General:enteredActiveDuty": {
                    "value": "03/30/2009",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "VA_AWARD_LETTER.pdf",
                    "confidence": 1
                },
                "va_award_letter-Part1-General:released/discharged": {
                    "value": "03/28/2013",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "VA_AWARD_LETTER.pdf",
                    "confidence": 1
                },
                "form_config_pk": 390037,
                "tables": [],
                "attribute_data": null
            }
        }
    ],
    "book_is_complete": true
}


Updated 11 months ago

Soldier Talent Profile
VOE (1005) - Request for Verification of Employment
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