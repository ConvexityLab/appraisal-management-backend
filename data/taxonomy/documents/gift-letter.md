# Gift Letter

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
Gift Letter
Suggest Edits

A gift letter is a piece of legal, written correspondence explicitly stating that money received from a friend or relative is a gift. The most common use of gift letters is when a borrower has received assistance in making a down payment on a new home or other real estate property.

To use the Upload PDF endpoint for this document, you must use GIFT_LETTER in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
gift_letter-Part1-General:date	Date	Date
gift_letter-Part1-General:loanNumber	Text	Loan Number
gift_letter-Part1-General:borrowerName	Text	Borrower Name
gift_letter-Part1-GeneraldonorName	Text	Donor Name
gift_letter-Part1-General:donor(s)Address:addressLine1	Text	Donor(s) Address
gift_letter-Part1-General:donor(s)Address:addressLine2	Text	Donor(s) Address
gift_letter-Part1-General:donor(s)Address:city	City	Donor(s) Address
gift_letter-Part1-General:donor(s)Address:state	State	Donor(s) Address
gift_letter-Part1-General:donor(s)Address:zip	ZIP Code	Donor(s) Address
gift_letter-Part1-General:donor(s)PhoneNumber	Phone Number	Donor(s) Phone Number
gift_letter-Part1-General:donorBankName	Text	Donor Bank Name
gift_letter-Part1-General:donorAccountNumber	Text	Donor Account Number
gift_letter-Part1-General:dateFundsTransferred	Date	Date Funds Transferred
gift_letter-Part1-General:amountOfGift	Money	Amount Of Gift
gift_letter-Part1-General:relationshipBetweenDonorAndBorrower	Text	Relationship Between Donor And Borrower
gift_letter-Part1-General:propertyAddress:addressLine1	Text	Property Address
gift_letter-Part1-General:propertyAddress:addressLine2	Text	Property Address
gift_letter-Part1-General:propertyAddress:city	Text	Property Address
gift_letter-Part1-General:propertyAddress:state	State	Property Address
gift_letter-Part1-General:propertyAddress:zip	ZIP Code	Property Address
gift_letter-Part1-General:sourceOfGift	Text	Source Of Gift
gift_letter-Part1-General:repaymentExpected?	YES, NO	Repayment Expected?
gift_letter-Part1-General:signedByDonor?	YES, NO	Signed By Donor?
Sample document
drive.google.com
Gift Letter Sample.pdf
Sample JSON result
JSON
{
   "status":200,
   "response":{
      "pk":45702226,
      "uuid":"d771bece-8924-40ce-8d88-73f18fd0e023",
      "forms":[
         {
            "pk":40493481,
            "uuid":"65afa544-b859-49ca-9471-9a473d93f9d4",
            "form_type":"GIFT_LETTER",
            "form_config_pk":109099,
            "tables":[
               
            ],
            "raw_fields":{
               "gift_letter-Part1-General:date":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Gift letter API.pdf"
               },
               "gift_letter-Part1-GeneraldonorName":{
                  "value":"SAMPLE ARNOLD",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Gift letter API.pdf"
               },
               "gift_letter-Part1-General:loanNumber":{
                  "value":"123456789",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Gift letter API.pdf"
               },
               "gift_letter-Part1-General:amountOfGift":{
                  "value":"50000.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Gift letter API.pdf"
               },
               "gift_letter-Part1-General:borrowerName":{
                  "value":"HARVEY FAKE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Gift letter API.pdf"
               },
               "gift_letter-Part1-General:sourceOfGift":{
                  "value":"CASH",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Gift letter API.pdf"
               },
               "gift_letter-Part1-General:donorBankName":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Gift letter API.pdf"
               },
               "gift_letter-Part1-General:signedByDonor?":{
                  "value":"YES",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Gift letter API.pdf"
               },
               "gift_letter-Part1-General:donorAccountNumber":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Gift letter API.pdf"
               },
               "gift_letter-Part1-General:repaymentExpected?":{
                  "value":"NO",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Gift letter API.pdf"
               },
               "gift_letter-Part1-General:donor(s)Address:zip":{
                  "value":"12345",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Gift letter API.pdf"
               },
               "gift_letter-Part1-General:donor(s)PhoneNumber":{
                  "value":"(123) 456-7890",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Gift letter API.pdf",
                  "irregular_datatype":true,
                  "type_validation_error":"Invalid phone number."
               },
               "gift_letter-Part1-General:propertyAddress:zip":{
                  "value":"12345",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Gift letter API.pdf"
               },
               "gift_letter-Part1-General:dateFundsTransferred":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Gift letter API.pdf"
               },
               "gift_letter-Part1-General:donor(s)Address:city":{
                  "value":"ANYTOWN",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Gift letter API.pdf"
               },
               "gift_letter-Part1-General:propertyAddress:city":{
                  "value":"CITY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Gift letter API.pdf"
               },
               "gift_letter-Part1-General:donor(s)Address:state":{
                  "value":"NY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Gift letter API.pdf"
               },
               "gift_letter-Part1-General:propertyAddress:state":{
                  "value":"NY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Gift letter API.pdf"
               },
               "gift_letter-Part1-General:donor(s)Address:addressLine1":{
                  "value":"123 SOMEWHERE STREET",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Gift letter API.pdf"
               },
               "gift_letter-Part1-General:donor(s)Address:addressLine2":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Gift letter API.pdf"
               },
               "gift_letter-Part1-General:propertyAddress:addressLine1":{
                  "value":"123 ANYWHERE STREET",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Gift letter API.pdf"
               },
               "gift_letter-Part1-General:propertyAddress:addressLine2":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Gift letter API.pdf"
               },
               "gift_letter-Part1-General:relationshipBetweenDonorAndBorrower":{
                  "value":"BROTHER",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Gift letter API.pdf"
               }
            }
         }
      ]
   },
   "message":"OK"
}


Updated 11 months ago

Flood Elevation Certificate
IRS Form 4506-C - IVES Request for Transcript of Tax Return
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