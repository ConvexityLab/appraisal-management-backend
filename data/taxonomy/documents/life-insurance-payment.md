# Life Insurance Payment

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
Life Insurance Payment
Suggest Edits

This is a document that verifies the compensation provided to beneficiaries upon the policyholder's death. It functions as a financial protection mechanism and may potentially cover various expenses or financial needs.

To use the Upload PDF endpoint for this document, you must use LIFE_INSURANCE_PAYMENT in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
life_insurance_payment-Part1-General:dateOfPayment1	Date	Date Of Payment 1
life_insurance_payment-Part1-General:paymentAmount1	Money	Payment Amount 1
life_insurance_payment-Part1-General:paymentMethod1:	CASH, MONEY ORDER, CHECK, CREDIT CARD, TRANSFER FROM ACCOUNT, OTHER	Payment Method 1
life_insurance_payment-Part1-General:paymentMethod1:transferFromAccount-Description	Text	Payment Method 1
life_insurance_payment-Part1-General:paymentMethod1:checkNumber	Integer	Payment Method 1
life_insurance_payment-Part1-General:paymentMethod-Other1:description	Text	Payment Method - Other 1
life_insurance_payment-Part1-General:dateOfPayment2	Date	Date Of Payment 2
life_insurance_payment-Part1-General:paymentAmount2	Money	Payment Amount 2
life_insurance_payment-Part1-General:paymentMethod2:	CASH, MONEY ORDER, CHECK, CREDIT CARD, TRANSFER FROM ACCOUNT, OTHER	Payment Method 2
life_insurance_payment-Part1-General:paymentMethod2:transferFromAccount-Description	Text	Payment Method 2
life_insurance_payment-Part1-General:paymentMethod2:checkNumber	Integer	Payment Method 2
life_insurance_payment-Part1-General:paymentMethod-Other2:description	Text	Payment Method - Other 2
life_insurance_payment-Part1-General:dateOfPayment3	Date	Date Of Payment 3
life_insurance_payment-Part1-General:paymentAmount3	Money	Payment Amount 3
life_insurance_payment-Part1-General:paymentMethod3:	CASH, MONEY ORDER, CHECK, CREDIT CARD, TRANSFER FROM ACCOUNT, OTHER	Payment Method 3
life_insurance_payment-Part1-General:paymentMethod3:transferFromAccount-Description	Text	Payment Method 3
life_insurance_payment-Part1-General:paymentMethod3:checkNumber	Integer	Payment Method 3
life_insurance_payment-Part1-General:paymentMethod-Other3:description	Text	Payment Method - Other 3
life_insurance_payment-Part1-General:dateOfPayment4	Date	Date Of Payment 4
life_insurance_payment-Part1-General:paymentAmount4	Money	Payment Amount 4
life_insurance_payment-Part1-General:paymentMethod4:	CASH, MONEY ORDER, CHECK, CREDIT CARD, TRANSFER FROM ACCOUNT, OTHER	Payment Method 4
life_insurance_payment-Part1-General:paymentMethod4:transferFromAccount-Description	Text	Payment Method 4
life_insurance_payment-Part1-General:paymentMethod4:checkNumber	Integer	Payment Method 4
life_insurance_payment-Part1-General:paymentMethod-Other4:description	Text	Payment Method - Other 4
life_insurance_payment-Part1-General:dateOfPayment5	Date	Date Of Payment 5
life_insurance_payment-Part1-General:paymentAmount5	Money	Payment Amount 5
life_insurance_payment-Part1-General:paymentMethod5:	CASH, MONEY ORDER, CHECK, CREDIT CARD, TRANSFER FROM ACCOUNT, OTHER	Payment Method 5
life_insurance_payment-Part1-General:paymentMethod5:transferFromAccount-Description	Text	Payment Method 5
life_insurance_payment-Part1-General:paymentMethod5:checkNumber	Integer	Payment Method 5
life_insurance_payment-Part1-General:paymentMethod-Other5:description	Text	Payment Method - Other 5
life_insurance_payment-Part2-InsuranceCompanyInformation:insuranceCompanyName	Text	Insurance Company Name
life_insurance_payment-Part2-InsuranceCompanyInformation:insuranceCompanyAddress:addressLine1	Text	Insurance Company Address
life_insurance_payment-Part2-InsuranceCompanyInformation:insuranceCompanyAddress:addressLine2	Text	Insurance Company Address
life_insurance_payment-Part2-InsuranceCompanyInformation:insuranceCompanyAddress:city	Text	Insurance Company Address
life_insurance_payment-Part2-InsuranceCompanyInformation:insuranceCompanyAddress:state	State	Insurance Company Address
life_insurance_payment-Part2-InsuranceCompanyInformation:insuranceCompanyAddress:zip	ZIP Code	Insurance Company Address
life_insurance_payment-Part3-PolicyholderInformation:policyholderName	Text	Policyholder Name
life_insurance_payment-Part3-PolicyholderInformation:policyholderAddress:addressLine1	Text	Policyholder Address
life_insurance_payment-Part3-PolicyholderInformation:policyholderAddress:addressLine2	Text	Policyholder Address
life_insurance_payment-Part3-PolicyholderInformation:policyholderAddress:city	Text	Policyholder Address
life_insurance_payment-Part3-PolicyholderInformation:policyholderAddress:state	State	Policyholder Address
life_insurance_payment-Part3-PolicyholderInformation:policyholderAddress:zip	ZIP Code	Policyholder Address
life_insurance_payment-Part4-PolicyInformation:policyNumber	Text	Policy Number
life_insurance_payment-Part4-PolicyInformation:policyTerm	Text	Policy Term
life_insurance_payment-Part4-PolicyInformation:policyStartDate	Date	Policy Start Date
life_insurance_payment-Part4-PolicyInformation:policyMaturityDate	Date	Policy Maturity Date
life_insurance_payment-Part4-PolicyInformation:lastPremiumDueDate	Date	Last Premium Due Date
life_insurance_payment-Part4-PolicyInformation:nextDueDate	Date	Next Due Date
Sample document
drive.google.com
API - LIFE INSURANCE PAYMENT.pdf
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
      "pk": 49666330,
      "uuid": "5e170c06-ad5d-4fc6-b949-d8a60441faf1",
      "uploaded_doc_pk": 59900273,
      "form_type": "LIFE_INSURANCE_PAYMENT",
      "raw_fields": {
        "life_insurance_payment-Part1-General:dateOfPayment1": {
          "value": "12/13/2021",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part1-General:dateOfPayment2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part1-General:dateOfPayment3": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part1-General:dateOfPayment4": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part1-General:dateOfPayment5": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part1-General:paymentAmount1": {
          "value": "1344.60",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part1-General:paymentAmount2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part1-General:paymentAmount3": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part1-General:paymentAmount4": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part1-General:paymentAmount5": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part1-General:paymentMethod1:": {
          "value": "CASH",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part1-General:paymentMethod2:": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part1-General:paymentMethod3:": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part1-General:paymentMethod4:": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part1-General:paymentMethod5:": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part4-PolicyInformation:policyTerm": {
          "value": "30 YEARS",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part4-PolicyInformation:nextDueDate": {
          "value": "01/12/2022",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part4-PolicyInformation:policyNumber": {
          "value": "123456789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part4-PolicyInformation:policyStartDate": {
          "value": "12/15/2020",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part1-General:paymentMethod1:checkNumber": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part1-General:paymentMethod2:checkNumber": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part1-General:paymentMethod3:checkNumber": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part1-General:paymentMethod4:checkNumber": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part1-General:paymentMethod5:checkNumber": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part4-PolicyInformation:lastPremiumDueDate": {
          "value": "12/12/2021",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part4-PolicyInformation:policyMaturityDate": {
          "value": "12/15/2050",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part1-General:paymentMethod-Other1:description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part1-General:paymentMethod-Other2:description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part1-General:paymentMethod-Other3:description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part1-General:paymentMethod-Other4:description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part1-General:paymentMethod-Other5:description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part3-PolicyholderInformation:policyholderName": {
          "value": "JOHN SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part3-PolicyholderInformation:policyholderAddress:zip": {
          "value": "12345-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part2-InsuranceCompanyInformation:insuranceCompanyName": {
          "value": "FAKE LIFE INSURANCE COMPANY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part3-PolicyholderInformation:policyholderAddress:city": {
          "value": "FAKE CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part3-PolicyholderInformation:policyholderAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part1-General:paymentMethod1:transferFromAccount-Description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part1-General:paymentMethod2:transferFromAccount-Description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part1-General:paymentMethod3:transferFromAccount-Description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part1-General:paymentMethod4:transferFromAccount-Description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part1-General:paymentMethod5:transferFromAccount-Description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part2-InsuranceCompanyInformation:insuranceCompanyAddress:zip": {
          "value": "12345-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part2-InsuranceCompanyInformation:insuranceCompanyAddress:city": {
          "value": "SAMPLE CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part3-PolicyholderInformation:policyholderAddress:addressLine1": {
          "value": "123 SAMPLE AVENUE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part3-PolicyholderInformation:policyholderAddress:addressLine2": {
          "value": "SUITE 1",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part2-InsuranceCompanyInformation:insuranceCompanyAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part2-InsuranceCompanyInformation:insuranceCompanyAddress:addressLine1": {
          "value": "123 FAKE MEMORIAL STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        },
        "life_insurance_payment-Part2-InsuranceCompanyInformation:insuranceCompanyAddress:addressLine2": {
          "value": "UNIT #12",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - LIFE INSURANCE PAYMENT.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 256590,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Letter from the Payor (Alimony or Child Support)
Marine Corps Basic Order
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