# Mortgage Note

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
Mortgage Note
Suggest Edits

A mortgage note is a binding legal agreement between the borrower and the lending institution regarding the terms of the mortgage loan. It meticulously outlines key loan details, including the total amount borrowed for purchasing the home, the size of the down payment, and the payment schedule, whether that entails monthly or bimonthly payments.

To use the Upload PDF endpoint for this document, you must use MORTGAGE_NOTE in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
mortgage_note-Part1-General:mortgagorName	Text	Mortgagor Name
mortgage_note-Part1-General:mortgagorAddress:addressLine1	Text	Mortgagor Address
mortgage_note-Part1-General:mortgagorAddress:addressLine2	Text	Mortgagor Address
mortgage_note-Part1-General:mortgagorAddress:city	Text	Mortgagor Address
mortgage_note-Part1-General:mortgagorAddress:state	State	Mortgagor Address
mortgage_note-Part1-General:mortgagorAddress:zipCode	ZIP Code	Mortgagor Address
mortgage_note-Part1-General:mortgageeName	Text	Mortgagee Name
mortgage_note-Part1-General:mersNumber	Text	MERS Number
mortgage_note-Part1-General:fhaCaseNumber	Text	FHA Case Number
mortgage_note-Part2-AmountsAndDate:principalBalanceAmount	Money	Principal Balance Amount
mortgage_note-Part2-AmountsAndDate:interestRate	Percentage	Interest Rate
mortgage_note-Part2-AmountsAndDate:firstPaymentDate	Date	First Payment Date
mortgage_note-Part2-AmountsAndDate:maturityDate	Date	Maturity Date
mortgage_note-Part2-AmountsAndDate:monthlyPaymentAmount	Money	Monthly Payment Amount
mortgage_note-Part2-AmountsAndDate:monthlyPaymentDueDate	Text	Monthly Payment Due Date
mortgage_note-Part3-PropertyDetails:propertyAddress:addressLine1	Text	Property Address
mortgage_note-Part3-PropertyDetails:propertyAddress:addressLine2	Text	Property Address
mortgage_note-Part3-PropertyDetails:propertyAddress:city	Text	Property Address
mortgage_note-Part3-PropertyDetails:propertyAddress:state	State	Property Address
mortgage_note-Part3-PropertyDetails:propertyAddress:zipCode	ZIP Code	Property Address
Sample document
drive.google.com
Mortgage Note Sample.pdf
Sample JSON result
JSON
{
  "status":200,
  "response":{
     "pk":45706571,
     "uuid":"f1039a10-345d-4c48-83a2-a015db9ed383",
     "forms":[
        {
           "pk":40495257,
           "uuid":"a98a146b-7800-4b1d-b996-05b973f1b24b",
           "form_type":"MORTGAGE_NOTE",
           "form_config_pk":111904,
           "tables":[
              
           ],
           "raw_fields":{
              "mortgage_note-Part1-General:mersNumber":{
                 "value":"",
                 "is_empty":true,
                 "alias_used":null,
                 "source_filename":"mortgage_note_(9).pdf"
              },
              "mortgage_note-Part1-General:fhaCaseNumber":{
                 "value":"",
                 "is_empty":true,
                 "alias_used":null,
                 "source_filename":"mortgage_note_(9).pdf"
              },
              "mortgage_note-Part1-General:mortgageeName":{
                 "value":"ABC UNITED COMPANY",
                 "is_empty":false,
                 "alias_used":null,
                 "source_filename":"mortgage_note_(9).pdf"
              },
              "mortgage_note-Part2-AmountsAndDate:interestRate":{
                 "value":"3.25%",
                 "is_empty":false,
                 "alias_used":null,
                 "source_filename":"mortgage_note_(9).pdf"
              },
              "mortgage_note-Part2-AmountsAndDate:maturityDate":{
                 "value":"07/07/2030",
                 "is_empty":false,
                 "alias_used":null,
                 "source_filename":"mortgage_note_(9).pdf"
              },
              "mortgage_note-Part2-AmountsAndDate:firstPaymentDate":{
                 "value":"07/07/2021",
                 "is_empty":false,
                 "alias_used":null,
                 "source_filename":"mortgage_note_(9).pdf"
              },
              "mortgage_note-Part2-AmountsAndDate:monthlyPaymentAmount":{
                "value":"2450.00",
                "is_empty":false,
                "alias_used":null,
                "source_filename":"mortgage_note_(9).pdf"
              },
              "mortgage_note-Part2-AmountsAndDate:monthlyPaymentDueDate":{
                "value":"7TH",
                "is_empty":false,
                "alias_used":null,
                "source_filename":"mortgage_note_(9).pdf"
              },
              "mortgage_note-Part3-PropertyDetails:propertyAddress:city":{
                 "value":"ANYTOWN",
                 "is_empty":false,
                 "alias_used":null,
                 "source_filename":"mortgage_note_(9).pdf"
              },
              "mortgage_note-Part2-AmountsAndDate:principalBalanceAmount":{
                 "value":"300000.00",
                 "is_empty":false,
                 "alias_used":null,
                 "source_filename":"mortgage_note_(9).pdf"
              },
              "mortgage_note-Part3-PropertyDetails:propertyAddress:state":{
                 "value":"NY",
                 "is_empty":false,
                 "alias_used":null,
                 "source_filename":"mortgage_note_(9).pdf"
              },
              "mortgage_note-Part3-PropertyDetails:propertyAddress:zipCode":{
                 "value":"10001",
                 "is_empty":false,
                 "alias_used":null,
                 "source_filename":"mortgage_note_(9).pdf"
              },
              "mortgage_note-Part3-PropertyDetails:propertyAddress:addressLine1":{
                 "value":"123 MAIN STREET",
                 "is_empty":false,
                 "alias_used":null,
                 "source_filename":"mortgage_note_(9).pdf"
              },
              "mortgage_note-Part3-PropertyDetails:propertyAddress:addressLine2":{
                 "value":"",
                 "is_empty":true,
                 "alias_used":null,
                 "source_filename":"mortgage_note_(9).pdf"
              },
              "mortgage_note-Part1-General:mortgagorName":{
                 "value":"YOUR NAME",
                 "is_empty":false,
                 "alias_used":null,
                 "source_filename":"mortgage_note_(9).pdf"
              },
              "mortgage_note-Part1-General:mortgagorAddress:city":{
                 "value":"",
                 "is_empty":true,
                 "alias_used":null,
                 "source_filename":"mortgage_note_(9).pdf"
              },
              "mortgage_note-Part1-General:mortgagorAddress:state":{
                 "value":"",
                 "is_empty":true,
                 "alias_used":null,
                 "source_filename":"mortgage_note_(9).pdf"
              },
              "mortgage_note-Part1-General:mortgagorAddress:zipCode":{
                 "value":"",
                 "is_empty":true,
                 "alias_used":null,
                 "source_filename":"mortgage_note_(9).pdf"
              },
              "mortgage_note-Part1-General:mortgagorAddress:addressLine1":{
                 "value":"",
                 "is_empty":true,
                 "alias_used":null,
                 "source_filename":"mortgage_note_(9).pdf"
              },
              "mortgage_note-Part1-General:mortgagorAddress:addressLine2":{
                 "value":"",
                 "is_empty":true,
                 "alias_used":null,
                 "source_filename":"mortgage_note_(9).pdf"
              }
           }
        }
     ]
  },
  "message":"OK"
}


Updated 11 months ago

Mortgage Insurance Certificate
Pre-Approval Letter
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