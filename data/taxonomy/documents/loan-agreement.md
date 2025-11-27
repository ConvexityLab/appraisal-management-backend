# Loan Agreement

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
Car Loan Deed
Court Judgment
Court Order
Deed in Lieu of Foreclosure
Foreclosure Notice
Loan Agreement
Professional Liability Insurance
Release of Judgment or Lien
Solar Panel Lease Agreement
Solar Panel Loan Agreement
Wage Garnishment Order
Mortgage specific forms
Other
Property
Tax forms
Data types
Loan Agreement
Suggest Edits

This is a document that delineates the terms and conditions of the loan, encompassing details such as the loan amount, interest rate (if applicable), repayment terms, and any other pertinent provisions. It is typically signed by both the borrower and the lender.

To use the Upload PDF endpoint for this document, you must use LOAN_AGREEMENT in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
loan_agreement-Part1-General:agreementDate	Date	Agreement Date
loan_agreement-Part1-General:borrowerName	Text	Borrower Name
loan_agreement-Part1-General:borrowerAddress:addressLine1	Text	Borrower Address
loan_agreement-Part1-General:borrowerAddress:addressLine2	Text	Borrower Address
loan_agreement-Part1-General:borrowerAddress:cityOrTown	Text	Borrower Address
loan_agreement-Part1-General:borrowerAddress:state	State	Borrower Address
loan_agreement-Part1-General:borrowerAddress:zip	ZIP Code	Borrower Address
loan_agreement-Part1-General:lenderName	Text	Lender Name
loan_agreement-Part1-General:lenderAddress:addressLine1	Text	Lender Address
loan_agreement-Part1-General:lenderAddress:addressLine2	Text	Lender Address
loan_agreement-Part1-General:lenderAddress:cityOrTown	Text	Lender Address
loan_agreement-Part1-General:lenderAddress:state	State	Lender Address
loan_agreement-Part1-General:lenderAddress:zip	ZIP Code	Lender Address
loan_agreement-Part2-LoanDetails:loanAmount	Money	Loan Amount
loan_agreement-Part2-LoanDetails:loanTerm/Period	Text	Loan Term/Period
loan_agreement-Part2-LoanDetails:dueDate	Date	Due Date
loan_agreement-Part2-LoanDetails:outstandingBalance	Money	Outstanding Balance
loan_agreement-Part2-LoanDetails:interestRateType	BEAR INTEREST, NOT BEAR INTEREST	Interest Rate Type
loan_agreement-Part2-LoanDetails:interestRate	Percentage	Interest Rate
loan_agreement-Part2-LoanDetails:interestRateCompoundFrequency	ANNUALLY, MONTHLY, OTHER	Interest Rate Compound Frequency
loan_agreement-Part2-LoanDetails:interestRateCompound-Other:description	Text	Interest Rate Compound - Other
loan_agreement-Part3-LoanPayment:paymentFrequency	WEEKLY PAYMENTS, MONTHLY PAYMENTS, LUMP SUM, OTHER	Payment Frequency
loan_agreement-Part3-LoanPayment:paymentFrequency-Other:description	Text	Payment Frequency - Other
loan_agreement-Part3-LoanPayment:latePayment	CHARGED A LATE FEE, NOT CHARGED A LATE FEE	Late Payment
loan_agreement-Part3-LoanPayment:latePaymentChargedFee:description	Text	Late Payment Charged Fee
loan_agreement-Part3-LoanPayment:security	PLEDGE SECURITY, NOT PLEDGE SECURITY	Security
loan_agreement-Part3-LoanPayment:pledgeSecurityDescription	Text	Pledge Security Description
loan_agreement-Part3-LoanPayment:pledgeSecurity	IN ITS ENTIRETY AND WITHOUT DISCOUNT TO THE AMOUNT OWED, EQUAL TO THE AMOUNT OWED OF WHICH A SALE MAY BE REQUIRED	Pledge Security
loan_agreement-Part3-LoanPayment:governingLawState	Text	Governing Law State
loan_agreement-Part4-Signature&Date:borrower'sSignature	SIGNED, NOT SIGNED	Borrower's Signature
loan_agreement-Part4-Signature&Date:borrower'sSignaturePrintName	Text	Borrower's Signature Print Name
loan_agreement-Part4-Signature&Date:borrower'sSignatureDate	Date	Borrower's Signature Date
loan_agreement-Part4-Signature&Date:lender'sSignature	SIGNED, NOT SIGNED	Lender's Signature
loan_agreement-Part4-Signature&Date:lender'sSignaturePrintName	Text	Lender's Signature Print Name
loan_agreement-Part4-Signature&Date:lender'sSignatureDate	Date	Lender's Signature Date
loan_agreement-Part4-Signature&Date:guarantor'sName	Text	Guarantor's Name
loan_agreement-Part4-Signature&Date:guarantor'sSignature	SIGNED, NOT SIGNED	Guarantor's Signature
loan_agreement-Part4-Signature&Date:guarantor'sSignaturePrintName	Text	Guarantor's Signature Print Name
loan_agreement-Part4-Signature&Date:guarantor'sSignatureDate	Date	Guarantor's Signature Date
Sample document
drive.google.com
API - LOAN AGREEMENT.pdf
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
      "pk": 49726508,
      "uuid": "f684f207-af62-40ea-82c4-a45f926f01d9",
      "uploaded_doc_pk": 59977859,
      "form_type": "LOAN_AGREEMENT",
      "raw_fields": {
        "loan_agreement-Part1-General:lenderName": {
          "value": "ABC SAMPLE LENDER LLC",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part2-LoanDetails:dueDate": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part1-General:borrowerName": {
          "value": "JOHN SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part1-General:agreementDate": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part2-LoanDetails:loanAmount": {
          "value": "10000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part3-LoanPayment:latePayment": {
          "value": "CHARGED A LATE FEE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part2-LoanDetails:interestRate": {
          "value": "4.25%",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part1-General:lenderAddress:zip": {
          "value": "11223",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part3-LoanPayment:pledgeSecurity": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part1-General:borrowerAddress:zip": {
          "value": "11223",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part1-General:lenderAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part2-LoanDetails:loanTerm/Period": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part2-LoanDetails:interestRateType": {
          "value": "BEAR INTEREST",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part3-LoanPayment:paymentFrequency": {
          "value": "MONTHLY PAYMENTS",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part1-General:borrowerAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part2-LoanDetails:outstandingBalance": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part1-General:lenderAddress:cityOrTown": {
          "value": "FAKE CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part1-General:borrowerAddress:cityOrTown": {
          "value": "FAKE CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part1-General:lenderAddress:addressLine1": {
          "value": "123 ANY FAKE STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part1-General:lenderAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part1-General:borrowerAddress:addressLine1": {
          "value": "125 ANY FAKE STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part1-General:borrowerAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part2-LoanDetails:interestRateCompoundFrequency": {
          "value": "ANNUALLY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part3-LoanPayment:latePaymentChargedFee:description": {
          "value": "500",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part3-LoanPayment:paymentFrequency-Other:description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part2-LoanDetails:interestRateCompound-Other:description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part3-LoanPayment:governingLawState": {
          "value": "NEW YORK",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part4-Signature&Date:guarantor'sName": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part4-Signature&Date:lender'sSignature": {
          "value": "SIGNED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part4-Signature&Date:borrower'sSignature": {
          "value": "SIGNED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part4-Signature&Date:guarantor'sSignature": {
          "value": "SIGNED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part4-Signature&Date:lender'sSignatureDate": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part4-Signature&Date:borrower'sSignatureDate": {
          "value": "05/10/2021",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part4-Signature&Date:guarantor'sSignatureDate": {
          "value": "05/10/2021",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part4-Signature&Date:lender'sSignaturePrintName": {
          "value": "ABC SAMPLE LENDER LLC",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part4-Signature&Date:borrower'sSignaturePrintName": {
          "value": "JOHN SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part4-Signature&Date:guarantor'sSignaturePrintName": {
          "value": "SMITH SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part3-LoanPayment:security": {
          "value": "PLEDGE SECURITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        },
        "loan_agreement-Part3-LoanPayment:pledgeSecurityDescription": {
          "value": "FORD A2",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LOAN AGREEMENT.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 231944,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Foreclosure Notice
Professional Liability Insurance
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