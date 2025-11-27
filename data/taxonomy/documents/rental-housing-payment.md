# Rental Housing Payment

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
Rental Housing Payment
Suggest Edits

This is a document that confirms an amount periodically paid by a tenant to a landlord or property owner in exchange for the use and occupancy of a residential property.

To use the Upload PDF endpoint for this document, you must use RENTAL_HOUSING_PAYMENT in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
rental_housing_payment-Part1-General:tenant/lessee	Text	Tenant/lessee
rental_housing_payment-Part1-General:period:from	Date	Period
rental_housing_payment-Part1-General:period:to	Date	Period
rental_housing_payment-Part1-General:dateOfPayment1	Date	Date Of Payment 1
rental_housing_payment-Part1-General:paymentAmount1	Money	Payment Amount 1
rental_housing_payment-Part1-General:paymentMethod1:	CASH, MONEY ORDER, CHECK, CREDIT CARD, TRANSFER FROM ACCOUNT, OTHER	Payment Method 1
rental_housing_payment-Part1-General:paymentMethod1:transferFromAccount-Description	Text	Payment Method 1
rental_housing_payment-Part1-General:paymentMethod1:checkNumber	Integer	Payment Method 1
rental_housing_payment-Part1-General:paymentMethod-Other1:description	Text	Payment Method - Other 1
rental_housing_payment-Part1-General:dateOfPayment2	Date	Date Of Payment 2
rental_housing_payment-Part1-General:paymentAmount2	Money	Payment Amount 2
rental_housing_payment-Part1-General:paymentMethod2:	CASH, MONEY ORDER, CHECK, CREDIT CARD, TRANSFER FROM ACCOUNT, OTHER	Payment Method 2
rental_housing_payment-Part1-General:paymentMethod2:transferFromAccount-Description	Text	Payment Method 2
rental_housing_payment-Part1-General:paymentMethod2:checkNumber	Integer	Payment Method 2
rental_housing_payment-Part1-General:paymentMethod-Other2:description	Text	Payment Method - Other 2
rental_housing_payment-Part1-General:dateOfPayment3	Date	Date Of Payment 3
rental_housing_payment-Part1-General:paymentAmount3	Money	Payment Amount 3
rental_housing_payment-Part1-General:paymentMethod3:	CASH, MONEY ORDER, CHECK, CREDIT CARD, TRANSFER FROM ACCOUNT, OTHER	Payment Method 3
rental_housing_payment-Part1-General:paymentMethod3:transferFromAccount-Description	Text	Payment Method 3
rental_housing_payment-Part1-General:paymentMethod3:checkNumber	Integer	Payment Method 3
rental_housing_payment-Part1-General:paymentMethod-Other3:description	Text	Payment Method - Other 3
rental_housing_payment-Part1-General:dateOfPayment4	Date	Date Of Payment 4
rental_housing_payment-Part1-General:paymentAmount4	Money	Payment Amount 4
rental_housing_payment-Part1-General:paymentMethod4:	CASH, MONEY ORDER, CHECK, CREDIT CARD, TRANSFER FROM ACCOUNT, OTHER	Payment Method 4
rental_housing_payment-Part1-General:paymentMethod4:transferFromAccount-Description	Text	Payment Method 4
rental_housing_payment-Part1-General:paymentMethod4:checkNumber	Integer	Payment Method 4
rental_housing_payment-Part1-General:paymentMethod-Other4:description	Text	Payment Method - Other 4
rental_housing_payment-Part1-General:dateOfPayment5	Date	Date Of Payment 5
rental_housing_payment-Part1-General:paymentAmount5	Money	Payment Amount 5
rental_housing_payment-Part1-General:paymentMethod5:	Text	Payment Method 5
rental_housing_payment-Part1-General:paymentMethod5:transferFromAccount-Description	CASH, MONEY ORDER, CHECK, CREDIT CARD, TRANSFER FROM ACCOUNT, OTHER	Payment Method 5
rental_housing_payment-Part1-General:paymentMethod5:checkNumber	Integer	Payment Method 5
rental_housing_payment-Part1-General:paymentMethod-Other5:description	Text	Payment Method - Other 5
rental_housing_payment-Part1-General:dueDate	Date	Due Date
rental_housing_payment-Part1-General:remainingBalance	Money	Remaining Balance
rental_housing_payment-Part1-General:totalRent	Money	Total Rent
rental_housing_payment-Part1-General:termsAndConditions	YES, NO	Terms And Conditions
rental_housing_payment-Part2-RentalPropertyAddress:rentalPropertyAddress:addressLine1	Text	Rental Property Address
rental_housing_payment-Part2-RentalPropertyAddress:rentalPropertyAddress:addressLine2	Text	Rental Property Address
rental_housing_payment-Part2-RentalPropertyAddress:rentalPropertyAddress:city	Text	Rental Property Address
rental_housing_payment-Part2-RentalPropertyAddress:rentalPropertyAddress:state	State	Rental Property Address
rental_housing_payment-Part2-RentalPropertyAddress:rentalPropertyAddress:zip	ZIP Code	Rental Property Address
rental_housing_payment-Part3-LandlordInformation:accountNumber	Integer	Account Number
rental_housing_payment-Part3-LandlordInformation:nameOfTheLandlord	Text	Name Of The Landlord
Sample document
drive.google.com
API - RENTAL HOUSING PAYMENT.pdf
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
      "pk": 49720489,
      "uuid": "32ac9096-4c7f-40ce-b05c-7d60b61848a1",
      "uploaded_doc_pk": 59966314,
      "form_type": "RENTAL_HOUSING_PAYMENT",
      "raw_fields": {
        "rental_housing_payment-Part1-General:dueDate": {
          "value": "04/07/2022",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:period:to": {
          "value": "03/31/2022",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:totalRent": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:period:from": {
          "value": "03/01/2022",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:tenant/lessee": {
          "value": "MICHAEL FAKE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:dateOfPayment1": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:dateOfPayment2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:dateOfPayment3": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:dateOfPayment4": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:dateOfPayment5": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:paymentAmount1": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:paymentAmount2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:paymentAmount3": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:paymentAmount4": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:paymentAmount5": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:paymentMethod1:": {
          "value": "CASH",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:paymentMethod2:": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:paymentMethod3:": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:paymentMethod4:": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:paymentMethod5:": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:remainingBalance": {
          "value": "0.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:termsAndConditions": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part3-LandlordInformation:accountNumber": {
          "value": "123456789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:paymentMethod1:checkNumber": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:paymentMethod2:checkNumber": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:paymentMethod3:checkNumber": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:paymentMethod4:checkNumber": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:paymentMethod5:checkNumber": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part3-LandlordInformation:nameOfTheLandlord": {
          "value": "ROBERT FAKE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:paymentMethod-Other1:description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:paymentMethod-Other2:description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:paymentMethod-Other3:description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:paymentMethod-Other4:description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:paymentMethod-Other5:description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part2-RentalPropertyAddress:rentalPropertyAddress:zip": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part2-RentalPropertyAddress:rentalPropertyAddress:city": {
          "value": "ANYCITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part2-RentalPropertyAddress:rentalPropertyAddress:state": {
          "value": "CA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:paymentMethod1:transferFromAccount-Description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:paymentMethod2:transferFromAccount-Description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:paymentMethod3:transferFromAccount-Description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:paymentMethod4:transferFromAccount-Description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part1-General:paymentMethod5:transferFromAccount-Description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part2-RentalPropertyAddress:rentalPropertyAddress:addressLine1": {
          "value": "FAKE MEMORIAL STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        },
        "rental_housing_payment-Part2-RentalPropertyAddress:rentalPropertyAddress:addressLine2": {
          "value": "FL 1",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - RENTAL HOUSING PAYMENT.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 256769,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Merchant Processing Application
Solar Panel Payment Receipt
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