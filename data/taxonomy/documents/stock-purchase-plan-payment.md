# Stock Purchase Plan Payment

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
Stock Purchase Plan Payment
Suggest Edits

This is a document that confirms a financial transaction in which an employee contributes a portion of their salary towards the purchase of company stock as part of an employee stock purchase plan.

To use the Upload PDF endpoint for this document, you must use STOCK_PURCHASE_PLAN_PAYMENT in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
stock_purchase_plan_payment-Part1-General:dateOfPayment1	Date	Date Of Payment 1
stock_purchase_plan_payment-Part1-General:paymentAmount1	Money	Payment Amount 1
stock_purchase_plan_payment-Part1-General:paymentMethod1	CASH, MONEY ORDER, CHECK, ONLINE, OTHER	Payment Method 1
stock_purchase_plan_payment-Part1-General:paymentMethod-Other1	Text	Payment Method - Other 1
stock_purchase_plan_payment-Part1-General:dateOfPayment2	Date	Date Of Payment 2
stock_purchase_plan_payment-Part1-General:paymentAmount2	Money	Payment Amount 2
stock_purchase_plan_payment-Part1-General:paymentMethod2	CASH, MONEY ORDER, CHECK, ONLINE, OTHER	Payment Method 2
stock_purchase_plan_payment-Part1-General:paymentMethod-Other2	Text	Payment Method - Other 2
stock_purchase_plan_payment-Part1-General:dateOfPayment3	Date	Date Of Payment 3
stock_purchase_plan_payment-Part1-General:paymentAmount3	Money	Payment Amount 3
stock_purchase_plan_payment-Part1-General:paymentMethod3	CASH, MONEY ORDER, CHECK, ONLINE, OTHER	Payment Method 3
stock_purchase_plan_payment-Part1-General:paymentMethod-Other3	Text	Payment Method - Other 3
stock_purchase_plan_payment-Part1-General:dateOfPayment4	Date	Date Of Payment 4
stock_purchase_plan_payment-Part1-General:paymentAmount4	Money	Payment Amount 4
stock_purchase_plan_payment-Part1-General:paymentMethod4	CASH, MONEY ORDER, CHECK, ONLINE, OTHER	Payment Method 4
stock_purchase_plan_payment-Part1-General:paymentMethod-Other4	Text	Payment Method - Other 4
stock_purchase_plan_payment-Part1-General:dateOfPayment5	Date	Date Of Payment 5
stock_purchase_plan_payment-Part1-General:paymentAmount5	Money	Payment Amount 5
stock_purchase_plan_payment-Part1-General:paymentMethod5	CASH, MONEY ORDER, CHECK, ONLINE, OTHER	Payment Method 5
stock_purchase_plan_payment-Part1-General:paymentMethod-Other5	Text	Payment Method - Other 5
stock_purchase_plan_payment-Part2-Employer/CompanyInformation:employer/companyName	Text	Employer/Company Name
stock_purchase_plan_payment-Part2-Employer/CompanyInformation:employer/companyAddress:addressLine1	Text	Employer/Company Address
stock_purchase_plan_payment-Part2-Employer/CompanyInformation:employer/companyAddress:addressLine2	Text	Employer/Company Address
stock_purchase_plan_payment-Part2-Employer/CompanyInformation:employer/companyAddress:city	Text	Employer/Company Address
stock_purchase_plan_payment-Part2-Employer/CompanyInformation:employer/companyAddress:state	State	Employer/Company Address
stock_purchase_plan_payment-Part2-Employer/CompanyInformation:employer/companyAddress:zipcode	ZIP Code	Employer/Company Address
stock_purchase_plan_payment-Part3-EmployeeInformation:employeeName	Text	Employee Name
stock_purchase_plan_payment-Part3-EmployeeInformation:employeeAddress:addressLine1	Text	Employee Address
stock_purchase_plan_payment-Part3-EmployeeInformation:employeeAddress:addressLine2	Text	Employee Address
stock_purchase_plan_payment-Part3-EmployeeInformation:employeeAddress:city	Text	Employee Address
stock_purchase_plan_payment-Part3-EmployeeInformation:employeeAddress:state	State	Employee Address
stock_purchase_plan_payment-Part3-EmployeeInformation:employeeAddress:zipcode	ZIP Code	Employee Address
stock_purchase_plan_payment-Part4-AccountInformation:accountNumber	Text	Account Number
stock_purchase_plan_payment-Part4-AccountInformation:accountType	CHECKING ACCOUNT, SAVINGS ACCOUNT, BROKERAGE ACCOUNT, OTHER	Account Type
stock_purchase_plan_payment-Part4-AccountInformation:totalPurchasePrice	Money	Total Purchase Price
stock_purchase_plan_payment-Part4-AccountInformation:dueDate	Date	Due Date
stock_purchase_plan_payment-Part4-AccountInformation:dueAmount	Money	Due Amount
Sample document
drive.google.com
API - STOCK PURCHASE PLAN PAYMENT.pdf
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
      "pk": 49666408,
      "uuid": "6bb04073-df15-49d1-ac6e-5150fdff7caf",
      "uploaded_doc_pk": 59900549,
      "form_type": "STOCK_PURCHASE_PLAN_PAYMENT",
      "raw_fields": {
        "stock_purchase_plan_payment-Part1-General:dateOfPayment1": {
          "value": "12/31/2020",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part1-General:dateOfPayment2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part1-General:dateOfPayment3": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part1-General:dateOfPayment4": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part1-General:dateOfPayment5": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part1-General:paymentAmount1": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part1-General:paymentAmount2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part1-General:paymentAmount3": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part1-General:paymentAmount4": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part1-General:paymentAmount5": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part1-General:paymentMethod1": {
          "value": "ONLINE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part1-General:paymentMethod2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part1-General:paymentMethod3": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part1-General:paymentMethod4": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part1-General:paymentMethod5": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part4-AccountInformation:dueDate": {
          "value": "01/05/2021",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part1-General:paymentMethod-Other1": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part1-General:paymentMethod-Other2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part1-General:paymentMethod-Other3": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part1-General:paymentMethod-Other4": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part1-General:paymentMethod-Other5": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part4-AccountInformation:dueAmount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part4-AccountInformation:accountType": {
          "value": "BROKERAGE ACCOUNT",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part4-AccountInformation:accountNumber": {
          "value": "123456789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part3-Employee Information:employeeName": {
          "value": "JOHN SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part4-AccountInformation:totalPurchasePrice": {
          "value": "10467.48",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part3-Employee Information:employeeAddress:city": {
          "value": "FAKE CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part3-Employee Information:employeeAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part3-Employee Information:employeeAddress:zipcode": {
          "value": "12345-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part2-Employer/CompanyInformation:employer/companyName": {
          "value": "ABC MORTGAGE LLC",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part3-Employee Information:employeeAddress:addressLine1": {
          "value": "123 FAKE STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part3-Employee Information:employeeAddress:addressLine2": {
          "value": "UNIT 12",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part2-Employer/CompanyInformation:employer/companyAddress:city": {
          "value": "FAKE CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part2-Employer/CompanyInformation:employer/companyAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part2-Employer/CompanyInformation:employer/companyAddress:zipcode": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part2-Employer/CompanyInformation:employer/companyAddress:addressLine1": {
          "value": "123 FAKE MEMORIAL STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        },
        "stock_purchase_plan_payment-Part2-Employer/CompanyInformation:employer/companyAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - STOCK PURCHASE PLAN PAYMENT.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 276014,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Solar Panel Payment Receipt
Student Loan Statement
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