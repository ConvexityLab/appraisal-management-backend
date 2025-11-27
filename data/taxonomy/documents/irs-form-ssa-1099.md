# IRS Form SSA-1099 - Social Security Benefit Statement

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
IRS Form SSA-1099 - Social Security Benefit Statement
Suggest Edits

A Social Security 1099, also called an SSA-1099, is a tax form that shows the total amount of benefits received from Social Security in the previous year. It is mailed out each January to people who receive benefits and tells them how much Social Security income to report to the IRS on their tax return.

To use the Upload PDF endpoint for this document, you must use SSA-1099 in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
a_ssa-1099-Part1-GeneralInformation:1-Name	Text	1 - Name
ssa-1099-Part1-GeneralInformation:year	Year	Year
a_ssa-1099-Part1-GeneralInformation:2-BeneficiarySocialSecurityNumber	Text	2 - Beneficiary Social Security Number
a_ssa-1099-Part1-GeneralInformation:3-BenefitsPaidIn[YearOfDocument]	Money	3 - Benefits Paid In [Year of Document]
a_ssa-1099-Part1-GeneralInformation:4-BenefitsRepaidToSsaIn[YearOfDocument]	Money	4 - Benefits Repaid To SSA In [Year of Document]
a_ssa-1099-Part1-GeneralInformation:5-NetBenefitsFor[YearOfDocument](Box3MinusBox4)	Money	5 - Net Benefits For [Year of Document] (Box 3 Minus Box 4)
a_ssa-1099-Part2-DescriptionOfAmountInBox3:line1:description	Text	Line 1 Description
a_ssa-1099-Part2-DescriptionOfAmountInBox3:line1:amount	Money	Line 1 Amount
a_ssa-1099-Part2-DescriptionOfAmountInBox3:line2:description	Text	Line 2 Description
a_ssa-1099-Part2-DescriptionOfAmountInBox3:line2:amount	Money	Line 2 Amount
a_ssa-1099-Part2-DescriptionOfAmountInBox3:line3:description	Text	Line 3 Description
a_ssa-1099-Part2-DescriptionOfAmountInBox3:line3:amount	Money	Line 3 Amount
a_ssa-1099-Part2-DescriptionOfAmountInBox3:line4:description	Text	Line 4 Description
a_ssa-1099-Part2-DescriptionOfAmountInBox3:line4:amount	Money	Line 4 Amount
a_ssa-1099-Part2-DescriptionOfAmountInBox3:line5:description	Text	Line 5 Description
a_ssa-1099-Part2-DescriptionOfAmountInBox3:line5:amount	Money	Line 5 Amount
a_ssa-1099-Part3-DescriptionOfAmountInBox4:line1:description	Text	Line 1 Description
a_ssa-1099-Part3-DescriptionOfAmountInBox4:line1:amount	Money	Line 1 Amount
a_ssa-1099-Part3-DescriptionOfAmountInBox4:line2:description	Text	Line 2 Description
a_ssa-1099-Part3-DescriptionOfAmountInBox4:line2:amount	Money	Line 2 Amount
a_ssa-1099-Part3-DescriptionOfAmountInBox4:line3:description	Text	Line 3 Description
a_ssa-1099-Part3-DescriptionOfAmountInBox4:line3:amount	Money	Line 3 Amount
a_ssa-1099-Part4-Box6VoluntaryFederalIncomeTaxWithheld:line1:description	Text	Line 1 Description
a_ssa-1099-Part4-Box6VoluntaryFederalIncomeTaxWithheld:line1:amount	Money	Line 1 Amount
a_ssa-1099-Part4-Box6VoluntaryFederalIncomeTaxWithheld:line2:description	Text	Line 2 Description
a_ssa-1099-Part4-Box6VoluntaryFederalIncomeTaxWithheld:line2:amount	Money	Line 2 Amount
a_ssa-1099-Part4-Box6VoluntaryFederalIncomeTaxWithheld:line3:description	Text	Line 3 Description
a_ssa-1099-Part4-Box6VoluntaryFederalIncomeTaxWithheld:line3:amount	Money	Line 3 Amount
a_ssa-1099-Part5-Address:7-Name	Text	7 - Name
a_ssa-1099-Part5-Address:7-Address:addressLine1	Text	7 - Address Line 1
a_ssa-1099-Part5-Address:7-Address:addressLine2	Text	7 - Address Line 1
a_ssa-1099-Part5-Address:7-Address:city	Text	7 - Address City
a_ssa-1099-Part5-Address:7-Address:state	State	Formatted as a 2-character state code.
7 - Address State
a_ssa-1099-Part5-Address:7-Address:zip	Zip Code	5-digit zip code in which Payer is located. 7 - Address Zip
a_ssa-1099-Part6-Box8-ClaimNumber:8-ClaimNumber(UseThisNumberIfYouNeedToContactSsa.)	Text	8 - Claim Number (Use This Number If You Need To Contact SSA.)
Sample document

Coming soon...

Sample JSON result
JSON
{
  "status": 200,
  "response": {
    "pk": 16434416,
    "uuid": "cc6bdc5e-2154-4b49-b7a2-1e01839f9420",
    "name": "SSA-1099 Output for API",
    "created": "2022-02-01T18:26:29Z",
    "created_ts": "2022-02-01T18:26:29Z",
    "verified_pages_count": 1,
    "book_status": "ACTIVE",
    "id": 16434416,
    "forms": [
      {
        "pk": 34220761,
        "uuid": "a2fd2f86-c955-4682-8c68-d11acf3570ba",
        "form_type": "SSA-1099",
        "raw_fields": {
          "a_ssa-1099-Part5-Address:7-Name": {
            "value": "SAMUEL HARPER",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part5-Address:7-Address:zip": {
            "value": "97215",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "ssa-1099-Part1-GeneralInformation:year": {
            "value": "2019",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part5-Address:7-Address:city": {
            "value": "PORTLAND",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part5-Address:7-Address:state": {
            "value": "NY",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part1-GeneralInformation:1-Name": {
            "value": "SAMUEL HARPER",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part5-Address:7-Address:addressLine1": {
            "value": "1874 WILSON STREET",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part5-Address:7-Address:addressLine2": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part2-DescriptionOfAmountInBox3:line1:amount": {
            "value": "20148.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part2-DescriptionOfAmountInBox3:line2:amount": {
            "value": "1320.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part2-DescriptionOfAmountInBox3:line3:amount": {
            "value": "21468.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part2-DescriptionOfAmountInBox3:line4:amount": {
            "value": "21468.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part2-DescriptionOfAmountInBox3:line5:amount": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part3-DescriptionOfAmountInBox4:line1:amount": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part3-DescriptionOfAmountInBox4:line2:amount": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part3-DescriptionOfAmountInBox4:line3:amount": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part2-DescriptionOfAmountInBox3:line1:description": {
            "value": "PAID BY CHECK OR DIRECT DEPOSIT",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part2-DescriptionOfAmountInBox3:line2:description": {
            "value": "MEDICARE PART B PREMIUMS DEDUCTED FROM YOUR BENEFITS",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part2-DescriptionOfAmountInBox3:line3:description": {
            "value": "TOTAL ADDITIONS",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part2-DescriptionOfAmountInBox3:line4:description": {
            "value": "BENEFITS FOR 2016",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part2-DescriptionOfAmountInBox3:line5:description": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part3-DescriptionOfAmountInBox4:line1:description": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part3-DescriptionOfAmountInBox4:line2:description": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part3-DescriptionOfAmountInBox4:line3:description": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part4-Box6VoluntaryFederalIncomeTaxWithheld:line1:amount": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part4-Box6VoluntaryFederalIncomeTaxWithheld:line2:amount": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part4-Box6VoluntaryFederalIncomeTaxWithheld:line3:amount": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part1-GeneralInformation:3-BenefitsPaidIn[YearOfDocument]": {
            "value": "21468.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part1-GeneralInformation:2-BeneficiarySocialSecurityNumber": {
            "value": "451-60-5178",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part4-Box6VoluntaryFederalIncomeTaxWithheld:line1:description": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part4-Box6VoluntaryFederalIncomeTaxWithheld:line2:description": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part4-Box6VoluntaryFederalIncomeTaxWithheld:line3:description": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part1-GeneralInformation:4-BenefitsRepaidToSsaIn[YearOfDocument]": {
            "value": "NONE",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part1-GeneralInformation:5-NetBenefitsFor[YearOfDocument](Box3MinusBox4)": {
            "value": "21468.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          },
          "a_ssa-1099-Part6-Box8-ClaimNumber:8-ClaimNumber(UseThisNumberIfYouNeedToContactSsa.)": {
            "value": "451-60-5178 A",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "SSA-1099.pdf"
          }
        },
        "form_config_pk": 37326,
        "tables": []
      }
    ],
    "book_is_complete": true
  },
  "message": "OK"
}


Updated 11 months ago

Disability Award Letter
Member Data Summary
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