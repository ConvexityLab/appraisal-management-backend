# Credit Report

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
Other
ACH Processing Application
Auto Loan Statement
Child Care Payment
Coast Guard Standard Travel Order
Credit Card Statement
Credit Report
DAF 899 Request and Authorization for Permanent Change of Station
Department of the Army Permanent Change of Station Order
Department of the Navy Permanent Change of Station Order
Deposited Checks
ISO Application
Letter from the Payor (Alimony or Child Support)
Life Insurance Payment
Marine Corps Basic Order
Merchant Processing Application
Rental Housing Payment
Solar Panel Payment Receipt
Stock Purchase Plan Payment
Student Loan Statement
Wire Remittance Statement
Property
Tax forms
Data types
Credit Report
Suggest Edits

A credit report is a statement that has information about your credit activity and current credit situation such as loan paying history and the status of your credit accounts.

To use the Upload PDF endpoint for this document, you must use CREDIT_REPORT in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
credit_report-Part1-General:borrowerName	Text	Borrower Name
credit_report-Part1-General:co-borrowerName	Text	Co-Borrower Name
credit_report-Part1-General:applicant(s)CurrentAddress:addressLine1	Text	Applicant(s) Current Address
credit_report-Part1-General:applicant(s)CurrentAddress:addressLine2	Text	Applicant(s) Current Address
credit_report-Part1-General:applicant(s)CurrentAddress:city	Text	Applicant(s) Current Address
credit_report-Part1-General:applicant(s)CurrentAddress:state	State	Applicant(s) Current Address
credit_report-Part1-General:applicant(s)CurrentAddress:zipCode	ZIP Code	Applicant(s) Current Address
credit_report-Part1-General:applicant(s)PreviousAddress:addressLine1	Text	Applicant(s) Previous Address
credit_report-Part1-General:applicant(s)PreviousAddress:addressLine2	Text	Applicant(s) Previous Address
credit_report-Part1-General:applicant(s)PreviousAddress:city	Text	Applicant(s) Previous Address
credit_report-Part1-General:applicant(s)PreviousAddress:state	State	Applicant(s) Previous Address
credit_report-Part1-General:applicant(s)PreviousAddress:zipCode	ZIP Code	Applicant(s) Previous Address
credit_report-Part1-General:borrowerSocialSecurityNumber	Social Security Number	Borrower Social Security Number
credit_report-Part1-General:co-borrowerSocialSecurityNumber	Social Security Number	Co-Borrower Social Security Number
credit_report-Part1-General:filePulledDate	Date	File Pulled Date
credit_report-Part1-General:fileOrderedDate	Date	File Ordered Date
credit_report-Part1-General:sendToName	Text	Send To Name
credit_report-Part1-General:sendToAddress:addressLine1	Text	Send To Address
credit_report-Part1-General:sendToAddress:addressLine2	Text	Send To Address
credit_report-Part1-General:sendToAddress:city	Text	Send To Address
credit_report-Part1-General:sendToAddress:state	State	Send To Address
credit_report-Part1-General:sendToAddress:zip	ZIP Code	Send To Address
credit_report-Part1-General:reportNumber	Text	Report Number
credit_report-Part1-General:applicantMaritalStatus	SINGLE, MARRIED	Applicant Marital Status
credit_report-Part1-General:borrowerDateOfBirth	Date	Borrower Date of Birth
credit_report-Part1-General:co-borrowerDateOfBirth	Date	Co-Borrower Date of Birth
credit_report-Part2-ScoreModels:borrowerFicoScoreExperian	Integer	Borrower FICO Score Experian
credit_report-Part2-ScoreModels:borrowerFicoScoreEquifax	Integer	Borrower FICO Score Equifax
credit_report-Part2-ScoreModels:borrowerFicoScoreTransunion	Integer	Borrower FICO Score Transunion
credit_report-Part2-ScoreModels:co-borrower/co-applicantFicoScoreExperian	Integer	Co-Borrower/Co-Applicant FICO Score Experian
credit_report-Part2-ScoreModels:co-borrower/co-applicantFicoScoreEquifax	Integer	Co-Borrower/Co-Applicant FICO Score Equifax
credit_report-Part2-ScoreModels:co-borrower/co-applicantFicoScoreTransunion	Integer	Co-Borrower/Co-Applicant FICO Score Transunion
credit_report-Part3-TradeSummary:securedDebtTotal	Money	Secured Debt Total
credit_report-Part3-TradeSummary:unsecuredDebtTotal	Money	Unsecured Debt Total
credit_report-Part3-TradeSummary:paymentsTotal	Money	Payments Total
credit_report-Part3-TradeSummary:pastDueTotal	Money	Past Due Total
credit_report-Part3-TradeSummary:revolvingCreditUtilizationPercentage	Percentage	Revolving Credit Utilization Percentage
credit_report-Part4-DerogatorySummary:chargeOffsTotal	Integer	Charge Offs Total
credit_report-Part4-DerogatorySummary:collectionsTotal	Integer	Collections Total
credit_report-Part4-DerogatorySummary:bankruptcyTotal	Integer	Bankruptcy Total
credit_report-Part4-DerogatorySummary:30DaysTotal	Integer	30 Days Total
credit_report-Part4-DerogatorySummary:60DaysTotal	Integer	60 Days Total
credit_report-Part4-DerogatorySummary:90DaysTotal	Integer	90 Days Total
credit_report-Part4-DerogatorySummary:disputesTotal	Integer	Disputes Total
credit_report-Part4-DerogatorySummary:mostRecentLateDate	Date	Most Recent Late Date
credit_report-Part4-DerogatorySummary:inquiriesTotal	Integer	Inquiries Total
Sample document
drive.google.com
Credit report API.pdf
Sample JSON result
JSON
{
    "status": 200,
    "response": {
        "pk": 29946544,
        "uuid": "2410cd7f-b35d-46ba-b956-ac31f8e4b57b",
        "forms": [
                        {
                "pk": 44474681,
                "uuid": "da187cb8-be2b-4b8c-b2d3-51c970ad1e8e",
                "uploaded_doc_pk": 52114557,
                "form_type": "CREDIT_REPORT",
                "raw_fields": {
                    "credit_report-Part3-TradeSummary:pastDueTotal": {
                        "value": "0.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part3-TradeSummary:paymentsTotal": {
                        "value": "1658.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part3-TradeSummary:securedDebtTotal": {
                        "value": "149670.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part4-DerogatorySummary:30DaysTotal": {
                        "value": "0",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part4-DerogatorySummary:60DaysTotal": {
                        "value": "0",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part4-DerogatorySummary:90DaysTotal": {
                        "value": "0",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part3-TradeSummary:unsecuredDebtTotal": {
                        "value": "2926.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part4-DerogatorySummary:disputesTotal": {
                        "value": "0",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part4-DerogatorySummary:inquiriesTotal": {
                        "value": "18",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part4-DerogatorySummary:bankruptcyTotal": {
                        "value": "0",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part4-DerogatorySummary:chargeOffsTotal": {
                        "value": "0",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part4-DerogatorySummary:collectionsTotal": {
                        "value": "0",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part4-DerogatorySummary:mostRecentLateDate": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part3-TradeSummary:revolvingCreditUtilizationPercentage": {
                        "value": "3%",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part1-General:sendToName": {
                        "value": "FAKE COMPANY LLC",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part1-General:borrowerName": {
                        "value": "SAMPLE JOE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part1-General:reportNumber": {
                        "value": "123456",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part1-General:filePulledDate": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part1-General:co-borrowerName": {
                        "value": "JOHN SAMPLE SMITH",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part1-General:fileOrderedDate": {
                        "value": "01/01/2022",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part1-General:sendToAddress:zip": {
                        "value": "12345-6789",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part1-General:sendToAddress:city": {
                        "value": "SAMPLE CITY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part1-General:borrowerDateOfBirth": {
                        "value": "01/01/2001",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part1-General:sendToAddress:state": {
                        "value": "NY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part1-General:applicantMaritalStatus": {
                        "value": "SINGLE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part1-General:co-borrowerDateOfBirth": {
                        "value": "01/01/2000",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part1-General:sendToAddress:addressLine1": {
                        "value": "123 FAKE STREET AVE.",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part1-General:sendToAddress:addressLine2": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part1-General:borrowerSocialSecurityNumber": {
                        "value": "123-45-6789",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf",
                        "validation_error": "Borrower social security should not be equal to co-borrower social security. User should review document."
                    },
                    "credit_report-Part2-ScoreModels:borrowerFicoScoreEquifax": {
                        "value": "650",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part2-ScoreModels:borrowerFicoScoreExperian": {
                        "value": "880",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part1-General:applicant(s)CurrentAddress:city": {
                        "value": "SAMPLE CITY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part1-General:co-borrowerSocialSecurityNumber": {
                        "value": "123-45-6789",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part2-ScoreModels:borrowerFicoScoreTransunion": {
                        "value": "834",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part1-General:applicant(s)CurrentAddress:state": {
                        "value": "CA",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part1-General:applicant(s)PreviousAddress:city": {
                        "value": "FAKE CITY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part1-General:applicant(s)PreviousAddress:state": {
                        "value": "CA",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part1-General:applicant(s)CurrentAddress:zipCode": {
                        "value": "12345",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part1-General:applicant(s)PreviousAddress:zipCode": {
                        "value": "12345",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part1-General:applicant(s)CurrentAddress:addressLine1": {
                        "value": "123 SAMPLE STREET AVE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part1-General:applicant(s)CurrentAddress:addressLine2": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part1-General:applicant(s)PreviousAddress:addressLine1": {
                        "value": "1234 FAKE ROAD UNIT",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part1-General:applicant(s)PreviousAddress:addressLine2": {
                        "value": "UNIT #12",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part2-ScoreModels:co-borrower/co-applicantFicoScoreEquifax": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part2-ScoreModels:co-borrower/co-applicantFicoScoreExperian": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    },
                    "credit_report-Part2-ScoreModels:co-borrower/co-applicantFicoScoreTransunion": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Credit report API.pdf"
                    }
                },
                "form_config_pk": 93643,
                "tables": []
            },
    "message": "OK"
}


Updated 11 months ago

Credit Card Statement
DAF 899 Request and Authorization for Permanent Change of Station
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