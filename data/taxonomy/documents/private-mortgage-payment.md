# Private Mortgage Payment

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
Private Mortgage Payment
Suggest Edits

This is a document that serves as confirmation of regular financial installments made by a borrower directly to an individual or entity that has extended a private mortgage loan. Such loans are often used for real estate transactions outside of traditional lending institutions.

To use the Upload PDF endpoint for this document, you must use PRIVATE_MORTGAGE_PAYMENT in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
private_mortgage_payment-Part1-General:period:from	Date	Period
private_mortgage_payment-Part1-General:period:to	Date	Period
private_mortgage_payment-Part1-General:dateOfPayment1	Date	Date Of Payment 1
private_mortgage_payment-Part1-General:paymentAmount1	Money	Payment Amount 1
private_mortgage_payment-Part1-General:paymentMethod1	CASH, MONEY ORDER, CHECK, CREDIT CARD, TRANSFER, OTHER	Payment Method 1
private_mortgage_payment-Part1-General:paymentMethod-Other1:description	Text	Payment Method - Other 1
private_mortgage_payment-Part1-General:dateOfPayment2	Date	Date Of Payment 2
private_mortgage_payment-Part1-General:paymentAmount2	Money	Payment Amount 2
private_mortgage_payment-Part1-General:paymentMethod2	CASH, MONEY ORDER, CHECK, CREDIT CARD, TRANSFER, OTHER	Payment Method 2
private_mortgage_payment-Part1-General:paymentMethod-Other2:description	Text	Payment Method - Other 2
private_mortgage_payment-Part1-General:dateOfPayment3	Date	Date Of Payment 3
private_mortgage_payment-Part1-General:paymentAmount3	Money	Payment Amount 3
private_mortgage_payment-Part1-General:paymentMethod3	CASH, MONEY ORDER, CHECK, CREDIT CARD, TRANSFER, OTHER	Payment Method 3
private_mortgage_payment-Part1-General:paymentMethod-Other3:description	Text	Payment Method - Other 3
private_mortgage_payment-Part1-General:dateOfPayment4	Date	Date Of Payment 4
private_mortgage_payment-Part1-General:paymentAmount4	Money	Payment Amount 4
private_mortgage_payment-Part1-General:paymentMethod4	CASH, MONEY ORDER, CHECK, CREDIT CARD, TRANSFER, OTHER	Payment Method 4
private_mortgage_payment-Part1-General:paymentMethod-Other4:description	Text	Payment Method - Other 4
private_mortgage_payment-Part1-General:dateOfPayment5	Date	Date Of Payment 5
private_mortgage_payment-Part1-General:paymentAmount5	Money	Payment Amount 5
private_mortgage_payment-Part1-General:paymentMethod5	CASH, MONEY ORDER, CHECK, CREDIT CARD, TRANSFER, OTHER	Payment Method 5
private_mortgage_payment-Part1-General:paymentMethod-Other5:description	Text	Payment Method - Other 5
private_mortgage_payment-Part2-PrivateMortgageLenderInformation:accountNumber	Integer	Account Number
private_mortgage_payment-Part2-PrivateMortgageLenderInformation:nameOfThePrivateMortgageLender	Text	Name Of The Private Mortgage Lender
private_mortgage_payment-Part2-PrivateMortgageLenderInformation:propertyAddress:addressLine1	Text	Property Address
private_mortgage_payment-Part2-PrivateMortgageLenderInformation:propertyAddress:addressLine2	Text	Property Address
private_mortgage_payment-Part2-PrivateMortgageLenderInformation:propertyAddress:city	Text	Property Address
private_mortgage_payment-Part2-PrivateMortgageLenderInformation:propertyAddress:state	State	Property Address
private_mortgage_payment-Part2-PrivateMortgageLenderInformation:propertyAddress:zip	ZIP Code	Property Address
private_mortgage_payment-Part2-PrivateMortgageLenderInformation:dueDate	Date	Due Date
private_mortgage_payment-Part2-PrivateMortgageLenderInformation:remainingBalance	Money	Remaining Balance
private_mortgage_payment-Part2-PrivateMortgageLenderInformation:interestRate	Percentage	Interest Rate
private_mortgage_payment-Part2-PrivateMortgageLenderInformation:termsAndConditions	YES, NO	Terms And Conditions
Sample document
drive.google.com
API - PRIVATE MORTGAGE PAYMENT.pdf
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
      "pk": 49666335,
      "uuid": "4db7da8b-40a8-4af6-8e5d-5c21f6fbf898",
      "uploaded_doc_pk": 59900296,
      "form_type": "PRIVATE_MORTGAGE_PAYMENT",
      "raw_fields": {
        "private_mortgage_payment-Part1-General:period:to": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part1-General:period:from": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part1-General:dateOfPayment1": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part1-General:dateOfPayment2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part1-General:dateOfPayment3": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part1-General:dateOfPayment4": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part1-General:dateOfPayment5": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part1-General:paymentAmount1": {
          "value": "1200.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part1-General:paymentAmount2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part1-General:paymentAmount3": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part1-General:paymentAmount4": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part1-General:paymentAmount5": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part1-General:paymentMethod1": {
          "value": "CHECK",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part1-General:paymentMethod2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part1-General:paymentMethod3": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part1-General:paymentMethod4": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part1-General:paymentMethod5": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part1-General:paymentMethod-Other1:description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part1-General:paymentMethod-Other2:description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part1-General:paymentMethod-Other3:description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part1-General:paymentMethod-Other4:description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part1-General:paymentMethod-Other5:description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part2-PrivateMortgageLenderInformation:dueDate": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part2-PrivateMortgageLenderInformation:interestRate": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part2-PrivateMortgageLenderInformation:accountNumber": {
          "value": "123456789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part2-PrivateMortgageLenderInformation:remainingBalance": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part2-PrivateMortgageLenderInformation:termsAndConditions": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part2-PrivateMortgageLenderInformation:propertyAddress:zip": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part2-PrivateMortgageLenderInformation:propertyAddress:city": {
          "value": "FAKE CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part2-PrivateMortgageLenderInformation:propertyAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part2-PrivateMortgageLenderInformation:propertyAddress:addressLine1": {
          "value": "100 FAKE PLAZA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part2-PrivateMortgageLenderInformation:propertyAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        },
        "private_mortgage_payment-Part2-PrivateMortgageLenderInformation:nameOfThePrivateMortgageLender": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - PRIVATE MORTGAGE PAYMENT.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 256566,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Pre-Approval Letter
Standard Flood Hazard Determination Form
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