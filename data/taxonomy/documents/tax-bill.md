# Property Tax Bill

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
Property Tax Bill
Suggest Edits

A Property Tax Bill is a statement issued by local government authorities that outlines the amount of property tax owed by a property owner. This bill reflects taxes calculated on the assessed value of the property, including land and buildings, and is used to fund public services like education, infrastructure, and emergency services. The bill details the tax rate, the property's assessed value, and any applicable exemptions or credits that reduce the total amount owed. Property owners are responsible for paying this bill, typically on an annual or semi-annual basis, to comply with local tax laws and avoid penalties.

To use the Upload PDF endpoint for this document, you must use TAX_BILL in the form_type parameter. To learn more about processing this document, click here.

Field descriptions

The following fields are available on this document type:

JSON attribute	Data type	Description
tax_bill-PartI-General:dueDate	Date	Due Date
tax_bill-PartI-General:totalTaxesDue	Money	Total Taxes Due
tax_bill-PartI-General:propertyAddress:addressLine1	Text	Property Address
tax_bill-PartI-General:propertyAddress:addressLine2	Text	Property Address
tax_bill-PartI-General:propertyAddress:city	Text	Property Address
tax_bill-PartI-General:propertyAddress:state	State	Property Address
tax_bill-PartI-General:propertyAddress:zip	ZIP Code	Property Address
tax_bill-PartI-General:parcelNumber	Text	Parcel Number
tax_bill-PartIi-OwnerAndPayerPii:ownerName	Text	Owner Name
tax_bill-PartIi-OwnerAndPayerPii:ownerAddress:addressLine1	Text	Owner Address
tax_bill-PartIi-OwnerAndPayerPii:ownerAddress:addressLine2	Text	Owner Address
tax_bill-PartIi-OwnerAndPayerPii:ownerAddress:city	Text	Owner Address
tax_bill-PartIi-OwnerAndPayerPii:ownerAddress:state	State	Owner Address
tax_bill-PartIi-OwnerAndPayerPii:ownerAddress:zip	ZIP Code	Owner Address
tax_bill-PartIi-OwnerAndPayerPii:payerName	Text	Payer Name
tax_bill-PartIi-OwnerAndPayerPii:payerAddress:addressLine1	Text	Payer Address
tax_bill-PartIi-OwnerAndPayerPii:payerAddress:addressLine2	Text	Payer Address
tax_bill-PartIi-OwnerAndPayerPii:payerAddress:city	Text	Payer Address
tax_bill-PartIi-OwnerAndPayerPii:payerAddress:state	State	Payer Address
tax_bill-PartIi-OwnerAndPayerPii:payerAddress:zip	ZIP Code	Payer Address
tax_bill-PartIii-PaymentInformation:installment1Date	Date	Installment 1 Date
tax_bill-PartIii-PaymentInformation:installment1Amount	Money	Installment 1 Amount
tax_bill-PartIii-PaymentInformation:installment2Date	Date	Installment 2 Date
tax_bill-PartIii-PaymentInformation:installment2Amount	Money	Installment 2 Amount
tax_bill-PartIii-PaymentInformation:installment3Date	Date	Installment 3 Date
tax_bill-PartIii-PaymentInformation:installment3Amount	Money	Installment 3 Amount
tax_bill-PartIii-PaymentInformation:installment4Date	Date	Installment 4 Date
tax_bill-PartIii-PaymentInformation:installment4Amount	Money	Installment 4 Amount
tax_bill-PartIv-OtherInformation:receiptNumber	Text	Receipt Number
tax_bill-PartIv-OtherInformation:issueDate	Date	Issue Date
tax_bill-PartIv-OtherInformation:lastUpdateDate	Date	Last Update Date
tax_bill-PartIv-OtherInformation:billStatus	PAID, NOT PAID	Bill Status
tax_bill-PartIv-OtherInformation:propertyControlNumber	Text	Property Control Number
tax_bill-PartIv-OtherInformation:accountNumber	Text	Account Number
tax_bill-PartIv-OtherInformation:delinquentDate	Date	Delinquent Date
tax_bill-PartIv-OtherInformation:taxIdNumber	Text	Tax ID Number
tax_bill-PartIv-OtherInformation:propertyType&Status	Text	Property Type & Status
tax_bill-PartIv-OtherInformation:billNumber	Text	Bill Number
tax_bill-PartIv-OtherInformation:realEstateAccountNumber	Text	Real Estate Account Number
Sample document
drive.google.com
Tax Bill.pdf
Sample JSON result
JSON
{
   "status":200,
   "response":{
      "pk":30723621,
      "uuid":"7d2ca8c1-57d9-44e6-93b7-205c98ed694e",
      "name":"Tax bill",
      "created":"2023-03-15T14:13:25Z",
      "created_ts":"2023-03-15T14:13:25Z",
      "verified_pages_count":1,
      "book_status":"ACTIVE",
      "id":30723621,
      "forms":[
         {
            "pk":45010270,
            "uuid":"89777c5e-189c-40dc-8e99-729ea16cd6da",
            "uploaded_doc_pk":52915659,
            "form_type":"TAX_BILL",
            "raw_fields":{
               "tax_bill-PartI-General:dueDate":{
                  "value":"04/01/2017",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartI-General:parcelNumber":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartI-General:totalTaxesDue":{
                  "value":"900.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartI-General:propertyAddress:zip":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartIi-OwnerAndPayerPii:ownerName":{
                  "value":"JOSEPH FAKE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartIi-OwnerAndPayerPii:payerName":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartIv-OtherInformation:issueDate":{
                  "value":"02/24/2017",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartI-General:propertyAddress:city":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartIv-OtherInformation:billNumber":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartIv-OtherInformation:billStatus":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartI-General:propertyAddress:state":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartIv-OtherInformation:taxIdNumber":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartIv-OtherInformation:accountNumber":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartIv-OtherInformation:receiptNumber":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartIv-OtherInformation:delinquentDate":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartIv-OtherInformation:lastUpdateDate":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartIi-OwnerAndPayerPii:ownerAddress:zip":{
                  "value":"10301-1408",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartIi-OwnerAndPayerPii:payerAddress:zip":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartIi-OwnerAndPayerPii:ownerAddress:city":{
                  "value":"FAKE CITY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartIi-OwnerAndPayerPii:payerAddress:city":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartI-General:propertyAddress:addressLine1":{
                  "value":"123 FAKE ST",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartI-General:propertyAddress:addressLine2":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartIi-OwnerAndPayerPii:ownerAddress:state":{
                  "value":"NY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartIi-OwnerAndPayerPii:payerAddress:state":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartIii-PaymentInformation:installment1Date":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartIii-PaymentInformation:installment2Date":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartIii-PaymentInformation:installment3Date":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartIii-PaymentInformation:installment4Date":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartIv-OtherInformation:propertyType&Status":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartIii-PaymentInformation:installment1Amount":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartIii-PaymentInformation:installment2Amount":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartIii-PaymentInformation:installment3Amount":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartIii-PaymentInformation:installment4Amount":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartIv-OtherInformation:propertyControlNumber":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartIv-OtherInformation:realEstateAccountNumber":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartIi-OwnerAndPayerPii:ownerAddress:addressLine1":{
                  "value":"123 MAIN ST",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartIi-OwnerAndPayerPii:ownerAddress:addressLine2":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartIi-OwnerAndPayerPii:payerAddress:addressLine1":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               },
               "tax_bill-PartIi-OwnerAndPayerPii:payerAddress:addressLine2":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Tax Bill (2).pdf"
               }
            },
            "form_config_pk":209633,
            "tables":[
               
            ]
         }
      ],
      "book_is_complete":true
   },
   "message":"OK"
}


Updated 11 months ago

Preliminary Title Report
Purchase Contract
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