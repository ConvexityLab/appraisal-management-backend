# VA Certificate of Eligibility

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
Legal
Mortgage specific forms
1003 (2009) - Uniform Residential Loan Application
1003 (2020) - Uniform Residential Loan Application
1003 (2020) - Uniform Residential Loan Application (Additional Borrower)
1003 (2020) - Uniform Residential Loan Application (Lender Loan Information)
1008 (2009) - Uniform Underwriting and Transmittal Summary
1008 (2018) - Uniform Underwriting and Transmittal Summary
Borrower Certification and Authorization
CAIVRS Authorization
Closing Disclosure
Closing Protection Letter
Divorce Decree
Federal Supporting Statements - Other Deductions
FHA Case Number Assignment
FHA Case Query
Flood Elevation Certificate
Gift Letter
IRS Form 4506-C - IVES Request for Transcript of Tax Return
IRS Form 4506-T - Request for Transcript of Tax Return
Loan Estimate
Mortgage Insurance Certificate
Mortgage Note
Pre-Approval Letter
Private Mortgage Payment
Standard Flood Hazard Determination Form
Title Insurance Policy
VA 26-8937 Verification of VA Benefits
VA Certificate of Eligibility
Wiring Instructions
Other
Property
Tax forms
Data types
VA Certificate of Eligibility
Suggest Edits

A Certificate of Eligibility (COE) is a document from the Department of Veterans Affairs that confirms your eligibility for the VA loan program. The COE also details your available VA loan entitlement and if you're required to pay the VA funding fee.

To use the Upload PDF endpoint for this document, you must use VA_CERTIFICATE_OF_ELIGIBILITY in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
va_certificate_of_eligibility-Part1-General:referenceNumber	Integer	Reference Number
va_certificate_of_eligibility-Part1-General:nameOfVeteran	Text	Name Of Veteran
va_certificate_of_eligibility-Part1-General:serviceNumber	Text	Service Number
va_certificate_of_eligibility-Part1-General:socialSecurityNumber	Social Security Number	Social Security Number
va_certificate_of_eligibility-Part1-General:entitlementCode	Text	Entitlement Code
va_certificate_of_eligibility-Part1-General:branchOfService	Text	Branch Of Service
va_certificate_of_eligibility-Part1-General:fundingFeeStatus	Text	Funding Fee Status
va_certificate_of_eligibility-Part1-General:conditions?	YES, NO	Conditions?
va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:vaLoanNumber1	Text	VA Loan Number 1
va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:state1	State	State 1
va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:loanAmount1	Money	Loan Amount 1
va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:dateOfLoan1	Date	Date Of Loan 1
va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:entitlementCharged1	Money	Entitlement Charged 1
va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:status1	Text	Status 1
va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:vaLoanNumber2	Text	VA Loan Number 2
va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:state2	State	State 2
va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:loanAmount2	Money	Loan Amount 2
va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:dateOfLoan2	Date	Date Of Loan 2
va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:entitlementCharged2	Money	Entitlement Charged 2
va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:status2	Text	Status 2
va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:vaLoanNumber3	Text	VA Loan Number 3
va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:state3	State	State 3
va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:loanAmount3	Money	Loan Amount 3
va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:dateOfLoan3	Date	Date Of Loan 3
va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:entitlementCharged3	Money	Entitlement Charged 3
va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:status3	Text	Status 3
va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:vaLoanNumber4	Text	VA Loan Number 4
va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:state4	State	State 4
va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:loanAmount4	Money	Loan Amount 4
va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:dateOfLoan4	Date	Date Of Loan 4
va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:entitlementCharged4	Money	Entitlement Charged 4
va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:status4	Text	Status 4
va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:vaLoanNumber5	Text	VA Loan Number 5
va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:state5	State	State 5
va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:loanAmount5	Money	Loan Amount 5
va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:dateOfLoan5	Date	Date Of Loan 5
va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:entitlementCharged5	Money	Entitlement Charged 5
va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:status5	Text	Status 5
va_certificate_of_eligibility-Part3-Others:veteransBasicEntitlementAmount	Money	Veterans Basic Entitlement Amount
va_certificate_of_eligibility-Part3-Others:totalEntitlementChargedToPreviousVaLoans	Money	Total Entitlement Charged To Previous VA Loans
va_certificate_of_eligibility-Part3-Others:issuedBy	Text	Issued By
va_certificate_of_eligibility-Part3-Others:issuedDate	Date	Issued Date
va_certificate_of_eligibility-Part3-Others:monthlyService-ConnectedDisabilityCompensation	Money	Monthly Service-Connected Disability Compensation
Sample document
drive.google.com
VA certificate API.pdf
Sample JSON result
JSON
{
    "status": 200,
    "response": {
        "pk": 30723335,
        "uuid": "225c3718-4ac4-4cde-94d8-9d356a2b47b2",
        "name": "VA_CERTIFICATE_OF_ELIGIBILITY",
        "created": "2023-03-15T14:07:29Z",
        "created_ts": "2023-03-15T14:07:29Z",
        "verified_pages_count": 1,
        "book_status": "ACTIVE",
        "id": 30723335,
        "forms": [
            {
                "pk": 45010017,
                "uuid": "61c69c11-ee9a-47ab-9f55-3ab301213715",
                "uploaded_doc_pk": 52915246,
                "form_type": "VA_CERTIFICATE_OF_ELIGIBILITY",
                "raw_fields": {
                    "va_certificate_of_eligibility-Part3-Others:issuedBy": {
                        "value": "WARNER SAMPLE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part3-Others:issuedDate": {
                        "value": "01/01/2020",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part1-General:conditions?": {
                        "value": "YES",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part1-General:nameOfVeteran": {
                        "value": "JOHN SAMPLE DOE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part1-General:serviceNumber": {
                        "value": "321",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part1-General:branchOfService": {
                        "value": "ARMY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part1-General:entitlementCode": {
                        "value": "01",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part1-General:referenceNumber": {
                        "value": "12345",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part1-General:fundingFeeStatus": {
                        "value": "EXEMPT",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part1-General:socialSecurityNumber": {
                        "value": "123-45-6789",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:state1": {
                        "value": "AL",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:state2": {
                        "value": "AK",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:state3": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:state4": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:state5": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part3-Others:veteransBasicEntitlementAmount": {
                        "value": "-16335.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:status1": {
                        "value": "ACTIVE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:status2": {
                        "value": "ACTIVE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:status3": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:status4": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:status5": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:dateOfLoan1": {
                        "value": "04/13/2019",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:dateOfLoan2": {
                        "value": "06/02/2019",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:dateOfLoan3": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:dateOfLoan4": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:dateOfLoan5": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:loanAmount1": {
                        "value": "10890.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:loanAmount2": {
                        "value": "5445.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:loanAmount3": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:loanAmount4": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:loanAmount5": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:vaLoanNumber1": {
                        "value": "11-11111111",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:vaLoanNumber2": {
                        "value": "55-55555555",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:vaLoanNumber3": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:vaLoanNumber4": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:vaLoanNumber5": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part3-Others:totalEntitlementChargedToPreviousVaLoans": {
                        "value": "245.03",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:entitlementCharged1": {
                        "value": "163.35",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:entitlementCharged2": {
                        "value": "81.68",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:entitlementCharged3": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:entitlementCharged4": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part2-PriorLoansChargedToEntitlement:entitlementCharged5": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "va_certificate_of_eligibility-Part3-Others:monthlyService-ConnectedDisabilityCompensation": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "VA certificate API.pdf"
                    },
                    "form_config_pk": 209637,
                    "tables": []
                }
            }
        ],
        "book_is_complete": true
    },
    "message": "OK"
}


Updated about 1 month ago

VA 26-8937 Verification of VA Benefits
Wiring Instructions
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