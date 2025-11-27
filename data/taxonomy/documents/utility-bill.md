# Utility Bill

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
Birth Certificate
Direct Deposit Authorization
H-1B - Non-Immigrant Employment Visa
Passport
Passport Card
Permanent Resident Card
Social Security Card
State ID
US Driver's License
Utility Bill
Voided Check
Income/Employment
Legal
Mortgage specific forms
Other
Property
Tax forms
Data types
Utility Bill
Suggest Edits

Utility bills are a type of invoice issued by a service provider for providing a functional service, such as electricity, water, telephone, or internet.

To use the Upload PDF endpoint for this document, you must use UTILITY_BILL in the form_type parameter. To learn more about Utility Bill processing, click here.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
utility_bill-Part1:utilityBillType	ELECTRICITY, GAS, WATER, TELEPHONE, INTERNET, TRANSPORTATION, OTHER, MULTIPLE	Utility Bill Type
utility_bill-Part1:serviceProvider	Text	Service Provider
utility_bill-Part1:serviceProviderAddress:addressLine1	Text	Service Provider Address
utility_bill-Part1:serviceProviderAddress:addressLine2	Text	Service Provider Address
utility_bill-Part1:serviceProviderAddress:city	Text	Service Provider Address
utility_bill-Part1:serviceProviderAddress:state	State	Service Provider Address
utility_bill-Part1:serviceProviderAddress:zip	ZIP Code	Service Provider Address
utility_bill-Part1:serviceProviderIbanNumber	Text	Service Provider IBAN Number
utility_bill-Part1:serviceProviderBicNumber	Text	Service Provider BIC Number
utility_bill-Part2:accountHolderBillingName	Text	Account Holder Billing Name
utility_bill-Part2:accountHolderBillingAddress:addressLine1	Text	Account Holder Billing Address
utility_bill-Part2:accountHolderBillingAddress:addressLine2	Text	Account Holder Billing Address
utility_bill-Part2:accountHolderBillingAddress:city	Text	Account Holder Billing Address
utility_bill-Part2:accountHolderBillingAddress:state	State	Account Holder Billing Address
utility_bill-Part2:accountHolderBillingAddress:zip	ZIP Code	Account Holder Billing Address
utility_bill-Part2:serviceAddress:addressLine1	Text	Service Address
utility_bill-Part2:serviceAddress:addressLine2	Text	Service Address
utility_bill-Part2:serviceAddress:city	Text	Service Address
utility_bill-Part2:serviceAddress:state	State	Service Address
utility_bill-Part2:serviceAddress:zip	ZIP Code	Service Address
utility_bill-Part2:accountNumber(ServiceProvider)	Text	Account Number (Service Provider)
utility_bill-Part3:periodStartDate	Date	Period Start Date
utility_bill-Part3:periodEndDate	Date	Period End Date
utility_bill-Part3:utilityBillDate	Date	Utility Bill Date
utility_bill-Part3:utilityDueDate	Date	Utility Due Date
utility_bill-Part3:priorPaymentPostingDate	Date	Prior Payment Posting Date
utility_bill-Part3:priorPaymentTotalPaid	Commaamount	Prior Payment Total Paid
utility_bill-Part3:summaryTotalChargesDue	Money	Summary Total Charges Due
utility_bill-Part3:summaryTotalPayments	Money	Summary Total Payments
Sample document

Coming soon...

Sample JSON result
JSON
{
   "status":200,
   "response":{
      "pk":31927573,
      "uuid":"bc57a3a2-031a-4309-bb8f-31f25292feee",
      "name":"Utility Bill API",
      "created":"2023-04-11T14:32:01Z",
      "created_ts":"2023-04-11T14:32:01Z",
      "verified_pages_count":1,
      "book_status":"ACTIVE",
      "id":31927573,
      "forms":[
         {
            "pk":45811179,
            "uuid":"fa7e4fc7-781f-40fc-8fdd-303a80d665f1",
            "uploaded_doc_pk":53985266,
            "form_type":"UTILITY_BILL",
            "raw_fields":{
               "utility_bill-Part3:periodEndDate":{
                  "value":"01/31/2012",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Ocrolus Sample PDF - Utility Bill.pdf"
               },
               "utility_bill-Part3:utilityDueDate":{
                  "value":"02/15/2012",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Ocrolus Sample PDF - Utility Bill.pdf"
               },
               "utility_bill-Part1:serviceProvider":{
                  "value":"NEO GAS",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Ocrolus Sample PDF - Utility Bill.pdf"
               },
               "utility_bill-Part1:utilityBillType":{
                  "value":"MULTIPLE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Ocrolus Sample PDF - Utility Bill.pdf"
               },
               "utility_bill-Part3:periodStartDate":{
                  "value":"01/01/2012",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Ocrolus Sample PDF - Utility Bill.pdf"
               },
               "utility_bill-Part3:utilityBillDate":{
                  "value":"01/31/2012",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Ocrolus Sample PDF - Utility Bill.pdf"
               },
               "utility_bill-Part2:serviceAddress:zip":{
                  "value":"99373",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Ocrolus Sample PDF - Utility Bill.pdf"
               },
               "utility_bill-Part2:serviceAddress:city":{
                  "value":"DRY CREEK",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Ocrolus Sample PDF - Utility Bill.pdf"
               },
               "utility_bill-Part2:serviceAddress:state":{
                  "value":"AL",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Ocrolus Sample PDF - Utility Bill.pdf"
               },
               "utility_bill-Part3:summaryTotalPayments":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Ocrolus Sample PDF - Utility Bill.pdf"
               },
               "utility_bill-Part3:priorPaymentTotalPaid":{
                  "value":"450.80",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Ocrolus Sample PDF - Utility Bill.pdf"
               },
               "utility_bill-Part3:summaryTotalChargesDue":{
                  "value":"562.93",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Ocrolus Sample PDF - Utility Bill.pdf"
               },
               "utility_bill-Part3:priorPaymentPostingDate":{
                  "value":"01/14/2012",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Ocrolus Sample PDF - Utility Bill.pdf"
               },
               "utility_bill-Part1:serviceProviderBicNumber":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Ocrolus Sample PDF - Utility Bill.pdf"
               },
               "utility_bill-Part2:accountHolderBillingName":{
                  "value":"CHARLEY V. RINEHURT",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Ocrolus Sample PDF - Utility Bill.pdf"
               },
               "utility_bill-Part1:serviceProviderIbanNumber":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Ocrolus Sample PDF - Utility Bill.pdf"
               },
               "utility_bill-Part1:serviceProviderAddress:zip":{
                  "value":"33401",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Ocrolus Sample PDF - Utility Bill.pdf"
               },
               "utility_bill-Part1:serviceProviderAddress:city":{
                  "value":"WEST PALM BEACH",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Ocrolus Sample PDF - Utility Bill.pdf"
               },
               "utility_bill-Part2:serviceAddress:addressLine1":{
                  "value":"4843 BLACKWELL STREET",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Ocrolus Sample PDF - Utility Bill.pdf"
               },
               "utility_bill-Part2:serviceAddress:addressLine2":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Ocrolus Sample PDF - Utility Bill.pdf"
               },
               "utility_bill-Part1:serviceProviderAddress:state":{
                  "value":"FL",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Ocrolus Sample PDF - Utility Bill.pdf"
               },
               "utility_bill-Part2:accountNumber(ServiceProvider)":{
                  "value":"125-234-952",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Ocrolus Sample PDF - Utility Bill.pdf"
               },
               "utility_bill-Part2:accountHolderBillingAddress:zip":{
                  "value":"99373",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Ocrolus Sample PDF - Utility Bill.pdf"
               },
               "utility_bill-Part2:accountHolderBillingAddress:city":{
                  "value":"DRY CREEK",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Ocrolus Sample PDF - Utility Bill.pdf"
               },
               "utility_bill-Part2:accountHolderBillingAddress:state":{
                  "value":"AL",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Ocrolus Sample PDF - Utility Bill.pdf"
               },
               "utility_bill-Part1:serviceProviderAddress:addressLine1":{
                  "value":"4780 HOLT STRET",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Ocrolus Sample PDF - Utility Bill.pdf"
               },
               "utility_bill-Part1:serviceProviderAddress:addressLine2":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Ocrolus Sample PDF - Utility Bill.pdf"
               },
               "utility_bill-Part2:accountHolderBillingAddress:addressLine1":{
                  "value":"4843 BLACKWELL STREET",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Ocrolus Sample PDF - Utility Bill.pdf"
               },
               "utility_bill-Part2:accountHolderBillingAddress:addressLine2":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Ocrolus Sample PDF - Utility Bill.pdf"
               }
            },
            "form_config_pk":213722,
            "tables":[
               
            ],
            "attribute_data":null
         }
      ],
      "book_is_complete":true
   },
   "message":"OK"
}


Updated 11 months ago

US Driver's License
Voided Check
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