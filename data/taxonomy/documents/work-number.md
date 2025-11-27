# VOE (work number) - The Work Number Verification of Employment Report

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
VOE (work number) - The Work Number Verification of Employment Report
Suggest Edits

This is a document generated through a service called The Work Number. This service provides instant employment and income verification for individuals to validate an individual's employment status and salary information. The report includes detailed data such as the individual's job title, tenure with the employer, income level, and employment history to facilitate streamlined decision-making.

To use the Upload PDF endpoint for this document, you must use WORK_NUMBER in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
work_number-Part1-General:verificationType	Text	Verification Type
work_number-Part1-General:permissiblePurpose	Text	Permissible Purpose
work_number-Part1-General:informationCurrentAsOf	Date	Information Current As Of
work_number-Part1-General:employer	Text	Employer
work_number-Part1-General:headquaterAddress:addressLine1	Text	Headquater Address
work_number-Part1-General:headquaterAddress:addressLine2	Text	Headquater Address
work_number-Part1-General:headquaterAddress:city	Text	Headquater Address
work_number-Part1-General:headquaterAddress:state	State	Headquater Address
work_number-Part1-General:headquaterAddress:zip	ZIP Code	Headquater Address
work_number-Part2-EmploymentInformation:employerDisclaimer	Text	Employer Disclaimer
work_number-Part2-EmploymentInformation:division	Text	Division
work_number-Part2-EmploymentInformation:employee	Text	Employee
work_number-Part2-EmploymentInformation:socialSecurityNumber	Social Security Number	Social Security Number
work_number-Part2-EmploymentInformation:employmentStatus	ACTIVE, INACTIVE	Employment Status
work_number-Part2-EmploymentInformation:mostRecentStartDate	Date	Most Recent Start Date
work_number-Part2-EmploymentInformation:originalHireDate	Date	Original Hire Date
work_number-Part2-EmploymentInformation:totalTimeWithEmployer	Text	Total Time With Employer
work_number-Part2-EmploymentInformation:jobTitle	Text	Job Title
work_number-Part2-EmploymentInformation:rateOfPay	Text	Rate of Pay
work_number-Part2-EmploymentInformation:averageHoursPerPayPeriod	Text	Average Hours Per Pay Period
work_number-Part3-IncomeInformation:year1	Integer	Year 1
work_number-Part3-IncomeInformation:baseSalary1	Money	Base Salary 1
work_number-Part3-IncomeInformation:overtime1	Money	Overtime 1
work_number-Part3-IncomeInformation:commission1	Money	Commission 1
work_number-Part3-IncomeInformation:bonus1	Money	Bonus 1
work_number-Part3-IncomeInformation:otherIncome1	Money	Other Income 1
work_number-Part3-IncomeInformation:totalPay1	Money	Total Pay 1
work_number-Part3-IncomeInformation:year2	Integer	Year 2
work_number-Part3-IncomeInformation:baseSalary2	Money	Base Salary 2
work_number-Part3-IncomeInformation:overtime2	Money	Overtime 2
work_number-Part3-IncomeInformation:commission2	Money	Commission 2
work_number-Part3-IncomeInformation:bonus2	Money	Bonus 2
work_number-Part3-IncomeInformation:otherIncome2	Money	Other Income 2
work_number-Part3-IncomeInformation:totalPay2	Money	Total Pay 2
work_number-Part3-IncomeInformation:year3	Integer	Year 3
work_number-Part3-IncomeInformation:baseSalary3	Money	Base Salary 3
work_number-Part3-IncomeInformation:overtime3	Money	Overtime 3
work_number-Part3-IncomeInformation:commission3	Money	Commission 3
work_number-Part3-IncomeInformation:bonus3	Money	Bonus 3
work_number-Part3-IncomeInformation:otherIncome3	Money	Other Income 3
work_number-Part3-IncomeInformation:totalPay3	Money	Total Pay 3
work_number-Part4-AdditionalInformation:dateOfPayIncrease:nextProjected	Date	Date of Pay Increase
work_number-Part4-AdditionalInformation:dateOfPayIncrease:last	Date	Date of Pay Increase
work_number-Part4-AdditionalInformation:amountOfPayIncrease:nextProjected	Money	Amount of Pay Increase
work_number-Part4-AdditionalInformation:amountOfPayIncrease:last	Money	Amount of Pay Increase
work_number-Part4-AdditionalInformation:onLeaveDates:nextProjected	Date	On Leave Dates
work_number-Part4-AdditionalInformation:onLeaveDates:last	Date	On Leave Dates
work_number-Part4-AdditionalInformation:refrenceNumber	Text	Refrence Number
work_number-Part4-AdditionalInformation:trackingNumber	Text	Tracking Number
Sample document
drive.google.com
API_Sample_(Work_Number) (2).pdf
Sample JSON result
JSON
{
    "status": 200,
    "response": {
        "pk": 18386569,
        "uuid": "3a877ea6-5f33-457f-bcef-2de9c729e7b2",
        "name": "Work Number API Documentation",
        "created": "2022-05-09T16:16:41Z",
        "created_ts": "2022-05-09T16:16:41Z",
        "verified_pages_count": 1,
        "book_status": "ACTIVE",
        "id": 18386569,
        "forms": [
            {
                "pk": 37151013,
                "uuid": "f3803b7a-95c2-4af3-94ef-3a8aeda58e66",
                "form_type": "WORK_NUMBER",
                "raw_fields": {
                    "work_number-Part1-General:employer": {
                        "value": "ABC INC.",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part3-IncomeInformation:year1": {
                        "value": "2021",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part3-IncomeInformation:year2": {
                        "value": "2020",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part3-IncomeInformation:year3": {
                        "value": "2019",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part1-General:verificationType": {
                        "value": "EMPLOYMENT & INCOME VERIFICATION",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part3-IncomeInformation:bonus1": {
                        "value": "300.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part3-IncomeInformation:bonus2": {
                        "value": "200.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part3-IncomeInformation:bonus3": {
                        "value": "150.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part1-General:permissiblePurpose": {
                        "value": "EMPLOYEE'S ELIGIBILITY FOR BENEFIT GRANTED BY A GOVERNMENTAL AGENCY ; -WE ARE REQUIRED BY LAW TO CONSIDER THE EMPLOYEE'S FINANCIAL RESPONSIBILITY OR STATUS",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part3-IncomeInformation:overtime1": {
                        "value": "200.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part3-IncomeInformation:overtime2": {
                        "value": "180.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part3-IncomeInformation:overtime3": {
                        "value": "150.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part3-IncomeInformation:totalPay1": {
                        "value": "8720.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part3-IncomeInformation:totalPay2": {
                        "value": "7580.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part3-IncomeInformation:totalPay3": {
                        "value": "6980.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part1-General:headquaterAddress:zip": {
                        "value": "12345",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part3-IncomeInformation:baseSalary1": {
                        "value": "8000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part3-IncomeInformation:baseSalary2": {
                        "value": "7000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part3-IncomeInformation:baseSalary3": {
                        "value": "6500.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part3-IncomeInformation:commission1": {
                        "value": "120.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part3-IncomeInformation:commission2": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part3-IncomeInformation:commission3": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part1-General:headquaterAddress:city": {
                        "value": "SAN MATEO",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part1-General:informationCurrentAsOf": {
                        "value": "06/10/2021",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part2-EmploymentInformation:division": {
                        "value": "QA",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part2-EmploymentInformation:employee": {
                        "value": "JOHN SAMPLE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part2-EmploymentInformation:jobTitle": {
                        "value": "MANAGER",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part3-IncomeInformation:otherIncome1": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part3-IncomeInformation:otherIncome2": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part3-IncomeInformation:otherIncome3": {
                        "value": "80.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part1-General:headquaterAddress:state": {
                        "value": "CA",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part2-EmploymentInformation:rateOfPay": {
                        "value": "20 PER HOUR",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part4-AdditionalInformation:refrenceNumber": {
                        "value": "123456789",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part4-AdditionalInformation:trackingNumber": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part1-General:headquaterAddress:addressLine1": {
                        "value": "123 GRANT LINE ROAD",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part1-General:headquaterAddress:addressLine2": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part2-EmploymentInformation:employmentStatus": {
                        "value": "ACTIVE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part2-EmploymentInformation:originalHireDate": {
                        "value": "12/15/2009",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part4-AdditionalInformation:onLeaveDates:last": {
                        "value": "06/30/2020",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part2-EmploymentInformation:employerDisclaimer": {
                        "value": "PLEASE SEND GARNISHMENTS TO HEADQUARTERS ADDRESS LISTED ABOVE . ATTENTION PAYROLL DEPARTMENT.",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part2-EmploymentInformation:mostRecentStartDate": {
                        "value": "02/15/2016",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part2-EmploymentInformation:socialSecurityNumber": {
                        "value": "123-45-6789",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part2-EmploymentInformation:totalTimeWithEmployer": {
                        "value": "6 YEARS, 3 MONTHS",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part4-AdditionalInformation:dateOfPayIncrease:last": {
                        "value": "12/31/2021",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part2-EmploymentInformation:averageHoursPerPayPeriod": {
                        "value": "80",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part4-AdditionalInformation:amountOfPayIncrease:last": {
                        "value": "1500.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part4-AdditionalInformation:onLeaveDates:nextProjected": {
                        "value": "06/12/2020",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part4-AdditionalInformation:dateOfPayIncrease:nextProjected": {
                        "value": "12/31/2022",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    },
                    "work_number-Part4-AdditionalInformation:amountOfPayIncrease:nextProjected": {
                        "value": "2000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "API_Sample_(Work_Number) (2).pdf"
                    }
                },
                "form_config_pk": 48942,
                "tables": []
            }
        ],
        "book_is_complete": true
    },
    "message": "OK"
}


Updated 11 months ago

VOE (generic) - Verification of Employment Report
VOIE (Finicity) - Finicity Verification of Income and Employment
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