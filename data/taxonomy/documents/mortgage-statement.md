# Mortgage Statement Processing Guide | Ocrolus

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
Property
1004 - Uniform Residential Appraisal Report
1032 - One-Unit Residential Appraisal Field Review Report
Appraisal Notice
Certificate of Liability Insurance
Final Inspection
Homeowners Association Statement
Homeowner Insurance Policy - Insurance Binder
Mortgage Statement
Payoff Letter
Preliminary Title Report
Property Tax Bill
Purchase Contract
Residential Lease Agreement
Tax forms
Data types
Mortgage Statement
Suggest Edits

Mortgage interest statements (i.e. mortgage statements) are issued by a lender to a borrower. These statements contain information regarding payment terms, interest rates, property information, and principal and interest due for a given period.

To use the Upload PDF endpoint for this document, you must use MORTGAGE_STATEMENT in the form_type parameter. To know more about processing this document, click here.

Field descriptions

The following fields are available on this document type:

JSON attribute	Data type	Description
mortgage_statement-Part1-BorrowerInfo:borrowerName	Text	Borrower Name
mortgage_statement-Part1-BorrowerInfo:borrowerAddress:addressLine1	Text	Borrower Address
mortgage_statement-Part1-BorrowerInfo:borrowerAddress:addressLine2	Text	Borrower Address
mortgage_statement-Part1-BorrowerInfo:borrowerAddress:city	Text	Borrower Address
mortgage_statement-Part1-BorrowerInfo:borrowerAddress:state	State	Borrower Address
mortgage_statement-Part1-BorrowerInfo:borrowerAddress:zip	ZIP Code	Borrower Address
mortgage_statement-Part1-BorrowerInfo:co-borrowerName	Text	Co-borrower Name
mortgage_statement-Part2-AccountInfo:propertyAddress:addressLine1	Text	Property Address
mortgage_statement-Part2-AccountInfo:propertyAddress:addressLine2	Text	Property Address
mortgage_statement-Part2-AccountInfo:propertyAddress:city	Text	Property Address
mortgage_statement-Part2-AccountInfo:propertyAddress:state	State	Property Address
mortgage_statement-Part2-AccountInfo:propertyAddress:zip	ZIP Code	Property Address
mortgage_statement-Part2-AccountInfo:statementDate	Date	Statement Date
mortgage_statement-Part2-AccountInfo:accountNumber	Text	Account Number
mortgage_statement-Part2-AccountInfo:paymentDueDate	Date	Payment Due Date
mortgage_statement-Part2-AccountInfo:currentBalance	Money	Current Balance
mortgage_statement-Part2-AccountInfo:interestRate	Percentage	Interest Rate
mortgage_statement-Part3-AmountDue(CurrentPeriod):interestAmountDue	Money	Interest Amount Due
mortgage_statement-Part3-AmountDue(CurrentPeriod):principalAmountDue	Money	Principal Amount Due
mortgage_statement-Part3-AmountDue(CurrentPeriod):escrowAmountDue	Money	Escrow Amount Due
mortgage_statement-Part3-AmountDue(CurrentPeriod):otherFeesAmountDue	Money	Other Fees Amount Due
mortgage_statement-Part3-AmountDue(CurrentPeriod):totalAmountDue	Money	Total Amount Due
mortgage_statement-Part4-PriorPayment:priorPaymentPostingDate	Date	Prior Payment Posting Date
mortgage_statement-Part4-PriorPayment:priorPaymentTotalPaid	Money	Prior Payment Total Paid
mortgage_statement-Part4-PriorPayment:priorPaymentPrincipalPaid	Money	Prior Payment Principal Paid
mortgage_statement-Part4-PriorPayment:priorPaymentInterestPaid	Money	Prior Payment Interest Paid
mortgage_statement-Part4-PriorPayment:priorEscrowAmountPaid	Money	Prior Escrow Amount Paid
mortgage_statement-Part4-PriorPayment:priorOtherFeesAmountPaid	Money	Prior Other Fees Amount Paid
mortgage_statement-Part5-LenderInfo:lenderName	Text	Lender Name
mortgage_statement-Part5-LenderInfo:lenderAddress:addressLine1	Text	Lender Address
mortgage_statement-Part5-LenderInfo:lenderAddress:addressLine2	Text	Lender Address
mortgage_statement-Part5-LenderInfo:lenderAddress:city	Text	Lender Address
mortgage_statement-Part5-LenderInfo:lenderAddress:state	State	Lender Address
mortgage_statement-Part5-LenderInfo:lenderAddress:zip	ZIP Code	Lender Address
Sample document
drive.google.com
Mortgage_Statement.pdf
Sample JSON result
JSON
{
    "pk": 29289397,
    "uuid": "199e9eb1-eb2a-4ec8-940e-96ea2298ae73",
    "name": "API Documentation (MS+PTR)",
    "created": "2023-02-07T19:21:40Z",
    "created_ts": "2023-02-07T19:21:40Z",
    "verified_pages_count": 6,
    "book_status": "ACTIVE",
    "id": 29289397,
    "forms": [
        {
            "pk": 44060268,
            "uuid": "48f108ec-e362-4f92-9a1e-767d487f24c7",
            "uploaded_doc_pk": 51459586,
            "form_type": "MORTGAGE_STATEMENT",
            "raw_fields": {
                "mortgage_statement-Part5-LenderInfo:lenderName": {
                    "value": "ABC MORTGAGE",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part2-AccountInfo:interestRate": {
                    "value": "4.75%",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part1-BorrowerInfo:borrowerName": {
                    "value": "JOHN SAMPLE",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part2-AccountInfo:accountNumber": {
                    "value": "123456789",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part2-AccountInfo:statementDate": {
                    "value": "01/01/2012",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part2-AccountInfo:currentBalance": {
                    "value": "264776.43",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part2-AccountInfo:paymentDueDate": {
                    "value": "01/10/2012",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part5-LenderInfo:lenderAddress:zip": {
                    "value": "12345",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part5-LenderInfo:lenderAddress:city": {
                    "value": "ANY CITY",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part5-LenderInfo:lenderAddress:state": {
                    "value": "NY",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part2-AccountInfo:propertyAddress:zip": {
                    "value": "12345-6789",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part1-BorrowerInfo:borrowerAddress:zip": {
                    "value": "12345-6789",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part2-AccountInfo:propertyAddress:city": {
                    "value": "ANY CITY",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part1-BorrowerInfo:borrowerAddress:city": {
                    "value": "ANY CITY",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part2-AccountInfo:propertyAddress:state": {
                    "value": "NY",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part1-BorrowerInfo:borrowerAddress:state": {
                    "value": "NY",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part4-PriorPayment:priorEscrowAmountPaid": {
                    "value": "235.18",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part4-PriorPayment:priorPaymentTotalPaid": {
                    "value": "1669.71",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part4-PriorPayment:priorPaymentPostingDate": {
                    "value": "12/21/2011",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part4-PriorPayment:priorOtherFeesAmountPaid": {
                    "value": "0.00",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part4-PriorPayment:priorPaymentInterestPaid": {
                    "value": "1049.60",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part5-LenderInfo:lenderAddress:addressLine1": {
                    "value": "123 MAIN STREET",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part5-LenderInfo:lenderAddress:addressLine2": {
                    "value": "",
                    "is_empty": true,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part4-PriorPayment:priorPaymentPrincipalPaid": {
                    "value": "384.93",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part3-AmountDue(CurrentPeriod):totalAmountDue": {
                    "value": "1829.71",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part2-AccountInfo:propertyAddress:addressLine1": {
                    "value": "123 SAMPLE STREET",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part2-AccountInfo:propertyAddress:addressLine2": {
                    "value": "",
                    "is_empty": true,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part3-AmountDue(CurrentPeriod):escrowAmountDue": {
                    "value": "235.18",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part1-BorrowerInfo:borrowerAddress:addressLine1": {
                    "value": "123 SAMPLE STREET",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part1-BorrowerInfo:borrowerAddress:addressLine2": {
                    "value": "",
                    "is_empty": true,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part3-AmountDue(CurrentPeriod):interestAmountDue": {
                    "value": "1048.07",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part3-AmountDue(CurrentPeriod):otherFeesAmountDue": {
                    "value": "160.00",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part3-AmountDue(CurrentPeriod):principalAmountDue": {
                    "value": "386.46",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                },
                "mortgage_statement-Part1-BorrowerInfo:co-borrowerName": {
                    "value": "JANE SAMPLE",
                    "is_empty": false,
                    "alias_used": null,
                    "source_filename": "Mortgage_Statement.pdf"
                }
            },
            "form_config_pk": 196515,
            "tables": []
        }
    ],
    "book_is_complete": true
}


Updated 8 months ago

Homeowner Insurance Policy - Insurance Binder
Payoff Letter
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