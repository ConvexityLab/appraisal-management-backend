# Student Loan Statement

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
Student Loan Statement
Suggest Edits

This is a periodic financial document provided by a lender or loan servicer to a student loan borrower, summarizing details of their loan, including balances, interest rates, payments, and transaction history.

To use the Upload PDF endpoint for this document, you must use STUDENT_LOAN_STATEMENT in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
student_loan_statement-Part1-General:dateOfStatement	Date	Date Of Statement
student_loan_statement-Part1-General:borrowerName	Text	Borrower Name
student_loan_statement-Part1-General:borrowerAddress:addressLine1	Text	Borrower Address
student_loan_statement-Part1-General:borrowerAddress:addressLine2	Text	Borrower Address
student_loan_statement-Part1-General:borrowerAddress:city	Text	Borrower Address
student_loan_statement-Part1-General:borrowerAddress:state	State	Borrower Address
student_loan_statement-Part1-General:borrowerAddress:zip	ZIP Code	Borrower Address
student_loan_statement-Part2-LoanInformation:loanServicerName	Text	Loan Servicer Name
student_loan_statement-Part2-LoanInformation:loanAccountNumber	Text	Loan Account Number
student_loan_statement-Part2-LoanInformation:currentStatementDueDate	Date	Current Statement Due Date
student_loan_statement-Part2-LoanInformation:currentAmountDue	Money	Current Amount Due
student_loan_statement-Part2-LoanInformation:interestRate	Percentage	Interest Rate
student_loan_statement-Part2-LoanInformation:monthlyPayment	Money	Monthly Payment
student_loan_statement-Part2-LoanInformation:balanceOwed	Money	Balance Owed
student_loan_statement-Part2-LoanInformation:paymentStatus	GOOD STANDING, DELINQUENT, DEFAULT	Payment Status
student_loan_statement-Part2-LoanInformation:typeOfLoan	FEDERAL LOAN, PRIVATE LOAN, SUBSIDIZED LOAN, UNSUBSIDIZED LOAN, OTHER	Type Of Loan
student_loan_statement-Part2-LoanInformation:enterTheTypeOfLoanIfOther	Text	Enter The Type Of Loan If Other
student_loan_statement-Part2-LoanInformation:repaymentPlan	Text	Repayment Plan
Sample document
drive.google.com
API - STUDENT LOAN STATEMENT.pdf
Sample JSON result
JSON
{
  "pk": 39003158,
  "uuid": "80b9189e-86db-4881-9986-7eb730b94260",
  "name": "API - Q2 All Capture forms",
  "created": "2023-09-08T18:29:49Z",
  "created_ts": "2023-09-08T18:29:48Z",
  "verified_pages_count": 89,
  "book_status": "ACTIVE",
  "id": 39003158,
  "forms": [
    {
      "pk": 49726493,
      "uuid": "77855639-c68f-4e11-b03d-7365f8700ef2",
      "uploaded_doc_pk": 59977838,
      "form_type": "STUDENT_LOAN_STATEMENT",
      "raw_fields": {
        "student_loan_statement-Part2-LoanInformation:typeOfLoan": {
          "value": "OTHER",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STUDENT LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "student_loan_statement-Part2-LoanInformation:balanceOwed": {
          "value": "4847.86",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STUDENT LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "student_loan_statement-Part2-LoanInformation:interestRate": {
          "value": "5.14%",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STUDENT LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "student_loan_statement-Part2-LoanInformation:repaymentPlan": {
          "value": "STANDARD",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STUDENT LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "student_loan_statement-Part2-LoanInformation:enterTheTypeOfLoanIfOther": {
          "value": "DIRECTSUB",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STUDENT LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "student_loan_statement-Part1-General:borrowerName": {
          "value": "MARIA SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STUDENT LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "student_loan_statement-Part1-General:dateOfStatement": {
          "value": "06/29/2016",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STUDENT LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "student_loan_statement-Part1-General:borrowerAddress:zip": {
          "value": "12345-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STUDENT LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "student_loan_statement-Part1-General:borrowerAddress:city": {
          "value": "FAKE CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STUDENT LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "student_loan_statement-Part1-General:borrowerAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STUDENT LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "student_loan_statement-Part2-LoanInformation:paymentStatus": {
          "value": "GOOD STANDING",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STUDENT LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "student_loan_statement-Part2-LoanInformation:monthlyPayment": {
          "value": "70.10",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STUDENT LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "student_loan_statement-Part2-LoanInformation:currentAmountDue": {
          "value": "0.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STUDENT LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "student_loan_statement-Part2-LoanInformation:loanServicerName": {
          "value": "U.S. DEPARTMENT OF EDUCATION",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STUDENT LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "student_loan_statement-Part2-LoanInformation:loanAccountNumber": {
          "value": "123456789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STUDENT LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "student_loan_statement-Part1-General:borrowerAddress:addressLine1": {
          "value": "123 FAKE RD",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STUDENT LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "student_loan_statement-Part1-General:borrowerAddress:addressLine2": {
          "value": "UNIT #1",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STUDENT LOAN STATEMENT.pdf",
          "confidence": 1.0
        },
        "student_loan_statement-Part2-LoanInformation:currentStatementDueDate": {
          "value": "07/20/2016",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STUDENT LOAN STATEMENT.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 276182,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Stock Purchase Plan Payment
Wire Remittance Statement
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