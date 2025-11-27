# Social Security Award Letter

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
Social Security Award Letter
Suggest Edits

A Social Security award letter, or award notice, is a letter from the Social Security Administration that shows the application for benefits has been approved for an individual. Though award letters go out for any type of benefit application, the term is most commonly associated with disability claims.

To use the Upload PDF endpoint for this document, you must use SS_AWARD_LETTER in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON attribute	Data type	Description
ss_award_letter-General:year	Integer	Year
ss_award_letter-General:titleOfForm	Text	Title Of Form
ss_award_letter-General:awardType	SOCIAL SECURITY BENEFITS (SSA)
SUPPLEMENTAL SECURITY INCOME
UNKNOWN	Award Type
ss_award_letter-General:beneficiaryName	Text	Beneficiary Name
ss_award_letter-General:dateOfBirthInformation	Date	Date Of Birth Information
ss_award_letter-General:address:addressLine1	Text	Address Line 1
ss_award_letter-General:address:addressLine2	Text	Address Line 2
ss_award_letter-General:address:city	Text	City
ss_award_letter-General:address:state	Text	State
ss_award_letter-General:address:zip	Text	Zip
ss_award_letter-General:awardDate	Date	Award Date
ss_award_letter-General:monthlyAmountBeforeDeductions	Money	Monthly Amount Before Deductions
ss_award_letter-General:paymentAmount	Money	Payment Amount
Sample document

Coming soon...

Sample JSON result
JSON
{
    "pk": 16048066,
    "uuid": "0865c976-d239-42d9-aa74-09692c5dfeca",
    "name": "SS Award Letter Output 2",
    "created": "2022-01-12T22:51:41Z",
    "created_ts": "2022-01-12T22:51:41Z",
    "verified_pages_count": 1,
    "book_status": "ACTIVE",
    "id": 16048066,
    "forms": [
        {
            "pk": 33693976,
            "uuid": "2108f5f9-37bf-4e28-9d1c-621e664e3374",
            "form_type": "SS_AWARD_LETTER",
            "raw_fields": {
                "ss_award_letter-General:year": {
                    "value": "2014",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "SS Award Letter Samples - 1.pdf"
                },
                "ss_award_letter-General:awardDate": {
                    "value": "11/01/2014",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "SS Award Letter Samples - 1.pdf"
                },
                "ss_award_letter-General:awardType": {
                    "value": "SOCIAL SECURITY BENEFITS (SSA)",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "SS Award Letter Samples - 1.pdf"
                },
                "ss_award_letter-General:address:zip": {
                    "value": "91301",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "SS Award Letter Samples - 1.pdf"
                },
                "ss_award_letter-General:address:city": {
                    "value": "AGOURA HILLS",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "SS Award Letter Samples - 1.pdf"
                },
                "ss_award_letter-General:address:state": {
                    "value": "CA",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "SS Award Letter Samples - 1.pdf"
                },
                "ss_award_letter-General:paymentAmount": {
                    "value": "485.00",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "SS Award Letter Samples - 1.pdf"
                },
                "ss_award_letter-General:beneficiaryName": {
                    "value": "STEPHEN GROSSBERG",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "SS Award Letter Samples - 1.pdf"
                },
                "ss_award_letter-General:dateOfBirthInformation": {
                    "value": "07/15/1958",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "SS Award Letter Samples - 1.pdf"
                },
                "ss_award_letter-General:address:addressLine1": {
                    "value": "30141 AGOURA RD",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "SS Award Letter Samples - 1.pdf"
                },
                "ss_award_letter-General:address:addressLine2": {
                    "value": "STE 212",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "SS Award Letter Samples - 1.pdf"
                },
                "ss_award_letter-General:monthlyAmountBeforeDeductions": {
                    "value": "500.60",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "SS Award Letter Samples - 1.pdf"
                }
            },
            "form_config_pk": 12475,
            "tables": []
        }
    ],
    "book_is_complete": true
}


Updated 11 months ago

Profit and Loss Statement
Soldier Talent Profile
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