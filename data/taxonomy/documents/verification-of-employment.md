# VOE (generic) - Verification of Employment Report

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
VOE (generic) - Verification of Employment Report
Suggest Edits

An employment verification letter is a document that proves someone works or worked at a certain company. It's usually given when a bank, government agency, or lender asks for it to confirm that the person has a steady job and income. This letter can include details like how long the person has been with the company, their job title, and sometimes their salary.

To use the Upload PDF endpoint for this document, you must use VERIFICATION_OF_EMPLOYMENT in the form_type parameter. To learn more about the processing of employment verification, see Employment Verification.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data type	Description
verification_of_employment-Part1-General:employeeName	Text	Employee Name
verification_of_employment-Part1-General:last4OfSocialSecurityNumber	Text	Last 4 Of Social Security Number
verification_of_employment-Part1-General:employer/companyName	Text	Employer/Company Name
verification_of_employment-Part1-General:currentAsOf	Date	Current As Of
verification_of_employment-Part1-General:verifiedOn	Date	Verified On
verification_of_employment-Part1-General:year	Integer	Year
verification_of_employment-Part2-EmploymentInformation:employmentStatus	Text	Employment Status
verification_of_employment-Part2-EmploymentInformation:mostRecentStartDate	Date	Most Recent Start Date
verification_of_employment-Part2-EmploymentInformation:originalHireDate	Date	Original Hire Date
verification_of_employment-Part2-EmploymentInformation:presentPosition	Text	Present Position
verification_of_employment-Part2-EmploymentInformation:rateOfPayAmount	Money	Rate Of Pay Amount
verification_of_employment-Part2-EmploymentInformation:rateOfPayFrequency	WEEKLY
MONTHLY
ANNUAL
SEMI-MONTHLY
BI-WEEKLY
HOURLY
DAILY	Rate Of Pay Frequency
verification_of_employment-Part2-EmploymentInformation:averageHoursPerPayPeriod	Number	Average Hours Per Pay Period
verification_of_employment-Part2-EmploymentInformation:amountOfLastPayIncrease	Money	Amount Of Last Pay Increase
verification_of_employment-Part2-EmploymentInformation:dateOfApplicantsLastIncrease	Date	Date Of Applicants Last Increase
verification_of_employment-Part2-EmploymentInformation:grossBasePay	Money	Gross Base Pay
verification_of_employment-Part2-EmploymentInformation:grossBasePayType	Text	Gross Base Pay Type
verification_of_employment-Part2-EmploymentInformation:wvoeThruDate	Date	WVOE Thru Date
verification_of_employment-Part2-EmploymentInformation:payType	Text	Pay Type
verification_of_employment-Part3-IncomeInformation:year1	Integer	Year 1
verification_of_employment-Part3-IncomeInformation:baseSalary1	Money	Base Salary 1
verification_of_employment-Part3-IncomeInformation:overtime1	Money	Overtime 1
verification_of_employment-Part3-IncomeInformation:commission1	Money	Commission 1
verification_of_employment-Part3-IncomeInformation:bonus1	Money	Bonus 1
verification_of_employment-Part3-IncomeInformation:otherIncome1	Money	Other Income 1
verification_of_employment-Part3-IncomeInformation:totalPay1	Money	Total Pay 1
verification_of_employment-Part3-IncomeInformation:year2	Integer	Year 2
verification_of_employment-Part3-IncomeInformation:baseSalary2	Money	Base Salary 2
verification_of_employment-Part3-IncomeInformation:overtime2	Money	Overtime 2
verification_of_employment-Part3-IncomeInformation:commission2	Money	Commission 2
verification_of_employment-Part3-IncomeInformation:bonus2	Money	Bonus 2
verification_of_employment-Part3-IncomeInformation:otherIncome2	Money	Other Income 2
verification_of_employment-Part3-IncomeInformation:totalPay2	Money	Total Pay 2
verification_of_employment-Part3-IncomeInformation:year3	Integer	Year 3
verification_of_employment-Part3-IncomeInformation:basePay3	Money	Base Pay 3
verification_of_employment-Part3-IncomeInformation:overtime3	Money	Overtime 3
verification_of_employment-Part3-IncomeInformation:commission3	Money	Commission 3
verification_of_employment-Part3-IncomeInformation:bonuses3	Money	Bonuses 3
verification_of_employment-Part3-IncomeInformation:otherIncome3	Money	Other Income 3
verification_of_employment-Part3-IncomeInformation:totalPay3	Money	Total Pay 3
verification_of_employment-Part4-Signature:signatureOfEmployer	SIGNED
NOT SIGNED	Signature Of Employer
verification_of_employment-Part4-Signature:signatureDate	Date	Signature Date
Sample document
drive.google.com
Verification of Employment.pdf
Sample JSON result
JSON
{
    "status": 200,
    "response": {
        "pk": 29698370,
        "uuid": "5e83d19c-fa8b-45ca-85d9-06e1639a2736",
        "forms": [
            {
                "pk": 44367440,
                "uuid": "a93924c1-2300-465f-ade4-aaf89297512b",
                "uploaded_doc_pk": 51933773,
                "form_type": "VERIFICATION_OF_EMPLOYMENT",
                "raw_fields": {
                    "verification_of_employment-Part1-General:year": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part1-General:verifiedOn": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part1-General:completedOn": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part1-General:currentAsOf": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part1-General:employeeName": {
                        "value": "JOHN SAMPLE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part1-General:dateLastUpdated": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part3-IncomeInformation:year1": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part3-IncomeInformation:year2": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part3-IncomeInformation:year3": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part4-Signature:signatureDate": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part3-IncomeInformation:bonus1": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part3-IncomeInformation:bonus2": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part3-IncomeInformation:basePay3": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part3-IncomeInformation:bonuses3": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part3-IncomeInformation:overtime1": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part3-IncomeInformation:overtime2": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part3-IncomeInformation:overtime3": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part3-IncomeInformation:totalPay1": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part3-IncomeInformation:totalPay2": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part3-IncomeInformation:totalPay3": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part1-General:employer/companyName": {
                        "value": "ABC COMPANY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part3-IncomeInformation:baseSalary1": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part3-IncomeInformation:baseSalary2": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part3-IncomeInformation:commission1": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part3-IncomeInformation:commission2": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part3-IncomeInformation:commission3": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part4-Signature:signatureOfEmployer": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part3-IncomeInformation:otherIncome1": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part3-IncomeInformation:otherIncome2": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part3-IncomeInformation:otherIncome3": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part2-EmploymentInformation:grossBasePay": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part2-EmploymentInformation:wvoeThruDate": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part1-General:employer/companyAddress:zip": {
                        "value": "12345",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part1-General:last4OfSocialSecurityNumber": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part1-General:employer/companyAddress:city": {
                        "value": "ANYCITY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part1-General:employer/companyAddress:state": {
                        "value": "NY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part2-EmploymentInformation:presentPosition": {
                        "value": "ACCOUNTANT",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part2-EmploymentInformation:rateOfPayAmount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part2-EmploymentInformation:employmentStatus": {
                        "value": "ACTIVE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part2-EmploymentInformation:grossBasePayType": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part2-EmploymentInformation:originalHireDate": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part2-EmploymentInformation:rateOfPayFrequency": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part2-EmploymentInformation:mostRecentStartDate": {
                        "value": "01/01/2022",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part3-IncomeInformation:bonusContinuanceLikely?": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part1-General:employer/companyAddress:addressLine1": {
                        "value": "123 MAIN FAKE STREET",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part1-General:employer/companyAddress:addressLine2": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part3-IncomeInformation:overtimeContinuanceLikely?": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part2-EmploymentInformation:amountOfLastPayIncrease": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part2-EmploymentInformation:averageHoursPerPayPeriod": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part2-EmploymentInformation:dateOfApplicantsLastIncrease": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    },
                    "verification_of_employment-Part2-EmploymentInformation:payType": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Verification of Employment.pdf"
                    }
                },
                "form_config_pk": 141994,
                "tables": []
            },
            {
                "message": "OK"
            }
        ]
    }
}


Updated 9 months ago

VOE (1005) - Request for Verification of Employment
VOE (work number) - The Work Number Verification of Employment Report
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