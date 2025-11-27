# Mortgage Insurance Certificate

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
Mortgage Insurance Certificate
Suggest Edits

The Mortgage Insurance Certificate is a physical or electronic document that serves as evidence of mortgage insurance.

To use the Upload PDF endpoint for this document, you must use MORTGAGE_INSURANCE_CERTIFICATE in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
mortgage_insurance_certificate-Part1-General:mortgageInsuranceCompanyName	Text	Mortgage Insurance Company Name
mortgage_insurance_certificate-Part1-General:insured'sName	Text	Insured's Name
mortgage_insurance_certificate-Part1-General:insured'sAddress:addressLine1	Text	Insured's Address
mortgage_insurance_certificate-Part1-General:insured'sAddress:addressLine2	Text	Insured's Address
mortgage_insurance_certificate-Part1-General:insured'sAddress:city	Text	Insured's Address
mortgage_insurance_certificate-Part1-General:insured'sAddress:state	State	Insured's Address
mortgage_insurance_certificate-Part1-General:insured'sAddress:zipCode	ZIP Code	Insured's Address
mortgage_insurance_certificate-Part2-PropertyDetails:borrowerName	Text	Borrower Name
mortgage_insurance_certificate-Part2-PropertyDetails:subjectPropertyAddress:addressLine1	Text	Subject Property Address
mortgage_insurance_certificate-Part2-PropertyDetails:subjectPropertyAddress:addressLine2	Text	Subject Property Address
mortgage_insurance_certificate-Part2-PropertyDetails:subjectPropertyAddress:city	Text	Subject Property Address
mortgage_insurance_certificate-Part2-PropertyDetails:subjectPropertyAddress:state	State	Subject Property Address
mortgage_insurance_certificate-Part2-PropertyDetails:subjectPropertyAddress:zipCode	ZIP Code	Subject Property Address
mortgage_insurance_certificate-Part3-LoanSummary:masterPolicyNumber	Text	Master Policy Number
mortgage_insurance_certificate-Part3-LoanSummary:loanNumber	Text	Loan Number
mortgage_insurance_certificate-Part3-LoanSummary:effectiveDate	Date	Effective Date
mortgage_insurance_certificate-Part3-LoanSummary:commitmentTerm	Text	Commitment Term
mortgage_insurance_certificate-Part3-LoanSummary:commitmentExpirationDate	Date	Commitment Expiration Date
mortgage_insurance_certificate-Part3-LoanSummary:commitmentNumber/CertificateNumber	Integer	Commitment Number/Certificate Number
mortgage_insurance_certificate-Part3-LoanSummary:baseLoanAmount	Money	Base Loan Amount
mortgage_insurance_certificate-Part3-LoanSummary:totalLoanAmount	Money	Total Loan Amount
mortgage_insurance_certificate-Part3-LoanSummary:originalValue	Money	Original Value
mortgage_insurance_certificate-Part3-LoanSummary:salesPrice	Money	Sales Price
mortgage_insurance_certificate-Part3-LoanSummary:loanPurpose	Text	Loan Purpose
mortgage_insurance_certificate-Part3-LoanSummary:occupancyType	PRIMARY, SECONDARY, SEASONAL, OTHERS	Occupancy Type
mortgage_insurance_certificate-Part3-LoanSummary:coveragePercentage	Percentage	Coverage Percentage
mortgage_insurance_certificate-Part3-LoanSummary:premiumRate1	Percentage	Premium Rate 1
mortgage_insurance_certificate-Part3-LoanSummary:premiumRate2	Percentage	Premium Rate 2
mortgage_insurance_certificate-Part3-LoanSummary:premiumRate3	Percentage	Premium Rate 3
Sample document
drive.google.com
Mortgage Insurance Certificate API.pdf
Sample JSON result
JSON
{
    "status": 200,
    "response": {
        "pk": 30309260,
        "uuid": "c6923216-5b16-414f-aefa-cada6d8644c4",
        "name": "Mortgage Insurance Certificate",
        "created": "2023-03-06T15:38:40Z",
        "created_ts": "2023-03-06T15:38:40Z",
        "verified_pages_count": 1,
        "book_status": "ACTIVE",
        "id": 30309260,
        "forms": [
            {
                "pk": 44709889,
                "uuid": "426f1c1b-d449-449a-ad00-7f1632be8596",
                "uploaded_doc_pk": 52498010,
                "form_type": "MORTGAGE_INSURANCE_CERTIFICATE",
                "raw_fields": {
                    "mortgage_insurance_certificate-Part1-General:mortgageInsuranceCompanyName": {
                        "value": "MORTGAGE INSURANCE CORPORATION",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Mortgage Insurance Certificate API.pdf"
                    },
                    "mortgage_insurance_certificate-Part1-General:insured'sName": {
                        "value": "ABC BANK",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Mortgage Insurance Certificate API.pdf"
                    },
                    "mortgage_insurance_certificate-Part3-LoanSummary:loanNumber": {
                        "value": "1122333",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Mortgage Insurance Certificate API.pdf"
                    },
                    "mortgage_insurance_certificate-Part3-LoanSummary:salesPrice": {
                        "value": "130000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Mortgage Insurance Certificate API.pdf"
                    },
                    "mortgage_insurance_certificate-Part3-LoanSummary:loanPurpose": {
                        "value": "PURCHASE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Mortgage Insurance Certificate API.pdf"
                    },
                    "mortgage_insurance_certificate-Part3-LoanSummary:premiumRate1": {
                        "value": "0.1100%",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Mortgage Insurance Certificate API.pdf"
                    },
                    "mortgage_insurance_certificate-Part3-LoanSummary:premiumRate2": {
                        "value": "0.1100%",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Mortgage Insurance Certificate API.pdf"
                    },
                    "mortgage_insurance_certificate-Part3-LoanSummary:premiumRate3": {
                        "value": "0.1100%",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Mortgage Insurance Certificate API.pdf"
                    },
                    "mortgage_insurance_certificate-Part3-LoanSummary:effectiveDate": {
                        "value": "01/01/2021",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Mortgage Insurance Certificate API.pdf"
                    },
                    "mortgage_insurance_certificate-Part3-LoanSummary:occupancyType": {
                        "value": "PRIMARY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Mortgage Insurance Certificate API.pdf"
                    },
                    "mortgage_insurance_certificate-Part3-LoanSummary:originalValue": {
                        "value": "120000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Mortgage Insurance Certificate API.pdf"
                    },
                    "mortgage_insurance_certificate-Part3-LoanSummary:baseLoanAmount": {
                        "value": "100000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Mortgage Insurance Certificate API.pdf"
                    },
                    "mortgage_insurance_certificate-Part3-LoanSummary:totalLoanAmount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Mortgage Insurance Certificate API.pdf"
                    },
                    "mortgage_insurance_certificate-Part3-LoanSummary:commitmentTerm": {
                        "value": "7 MONTHS",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Mortgage Insurance Certificate API.pdf"
                    },
                    "mortgage_insurance_certificate-Part2-PropertyDetails:borrowerName": {
                        "value": "JOHN SAMPLE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Mortgage Insurance Certificate API.pdf"
                    },
                    "mortgage_insurance_certificate-Part1-General:insured'sAddress:city": {
                        "value": "ANY TOWN",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Mortgage Insurance Certificate API.pdf"
                    },
                    "mortgage_insurance_certificate-Part1-General:insured'sAddress:state": {
                        "value": "CA",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Mortgage Insurance Certificate API.pdf"
                    },
                    "mortgage_insurance_certificate-Part3-LoanSummary:coveragePercentage": {
                        "value": "12%",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Mortgage Insurance Certificate API.pdf"
                    },
                    "mortgage_insurance_certificate-Part3-LoanSummary:masterPolicyNumber": {
                        "value": "11223334444",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Mortgage Insurance Certificate API.pdf"
                    },
                    "mortgage_insurance_certificate-Part1-General:insured'sAddress:zipCode": {
                        "value": "12345",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Mortgage Insurance Certificate API.pdf"
                    },
                    "mortgage_insurance_certificate-Part3-LoanSummary:commitmentExpirationDate": {
                        "value": "01/01/2022",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Mortgage Insurance Certificate API.pdf"
                    },
                    "mortgage_insurance_certificate-Part1-General:insured'sAddress:addressLine1": {
                        "value": "123 FAKE STREET",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Mortgage Insurance Certificate API.pdf"
                    },
                    "mortgage_insurance_certificate-Part1-General:insured'sAddress:addressLine2": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Mortgage Insurance Certificate API.pdf"
                    },
                    "mortgage_insurance_certificate-Part2-PropertyDetails:subjectPropertyAddress:city": {
                        "value": "ANY CITY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Mortgage Insurance Certificate API.pdf"
                    },
                    "mortgage_insurance_certificate-Part2-PropertyDetails:subjectPropertyAddress:state": {
                        "value": "MA",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Mortgage Insurance Certificate API.pdf"
                    },
                    "mortgage_insurance_certificate-Part2-PropertyDetails:subjectPropertyAddress:zipCode": {
                        "value": "12345",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Mortgage Insurance Certificate API.pdf"
                    },
                    "mortgage_insurance_certificate-Part3-LoanSummary:commitmentNumber/CertificateNumber": {
                        "value": "12345678",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Mortgage Insurance Certificate API.pdf"
                    },
                    "mortgage_insurance_certificate-Part2-PropertyDetails:subjectPropertyAddress:addressLine1": {
                        "value": "123 ANY STREET",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Mortgage Insurance Certificate API.pdf"
                    },
                    "mortgage_insurance_certificate-Part2-PropertyDetails:subjectPropertyAddress:addressLine2": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Mortgage Insurance Certificate API.pdf"
                    }
                },
                "form_config_pk": 166047,
                "tables": []
            }
        ],
        "book_is_complete": true
    },
    "message": "OK"
}


Updated 11 months ago

Loan Estimate
Mortgage Note
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