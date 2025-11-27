# Solar Panel Payment Receipt

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
Solar Panel Payment Receipt
Suggest Edits

This is a document that confirms the receipt of a payment made by a customer for the purchase, installation, or maintenance of solar panels or related services.

To use the Upload PDF endpoint for this document, you must use SOLAR_PANEL_PAYMENT_RECEIPT in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
solar_panel_payment_receipt-Part1-General:dateOfReceipt	Date	Date of Receipt
solar_panel_payment_receipt-Part1-General:receiptNumber	Text	Receipt Number
solar_panel_payment_receipt-Part1-General:totalMonthlyPayment	Money	Total Monthly Payment
solar_panel_payment_receipt-Part1-General:paymentStatus	PAID, NOT PAID	Payment Status
solar_panel_payment_receipt-Part1-General:paymentDueAmount	Money	Payment Due Amount
solar_panel_payment_receipt-Part1-General:paymentDueDate	Date	Payment Due Date
solar_panel_payment_receipt-Part1-General:anyPenalties	YES, NO	Any Penalties
solar_panel_payment_receipt-Part1-General:penaltiesAmount-IfYes	Money	Penalties Amount - If Yes
solar_panel_payment_receipt-Part2-SolarPanelProviderInformation:solarPanelProviderName	Text	Solar Panel Provider Name
solar_panel_payment_receipt-Part2-SolarPanelProviderInformation:solarPanelProviderAddress:addressLine1	Text	Solar Panel Provider Address
solar_panel_payment_receipt-Part2-SolarPanelProviderInformation:solarPanelProviderAddress:addressLine2	Text	Solar Panel Provider Address
solar_panel_payment_receipt-Part2-SolarPanelProviderInformation:solarPanelProviderAddress:city	Text	Solar Panel Provider Address
solar_panel_payment_receipt-Part2-SolarPanelProviderInformation:solarPanelProviderAddress:state	State	Solar Panel Provider Address
solar_panel_payment_receipt-Part2-SolarPanelProviderInformation:solarPanelProviderAddress:zipCode	ZIP Code	Solar Panel Provider Address
solar_panel_payment_receipt-Part3-SolarPanelBuyerInformation:solarPanelBuyerName	Text	Solar Panel Buyer Name
solar_panel_payment_receipt-Part3-SolarPanelBuyerInformation:solarPanelBuyerAddress:addressLine1	Text	Solar Panel Buyer Address
solar_panel_payment_receipt-Part3-SolarPanelBuyerInformation:solarPanelBuyerAddress:addressLine2	Text	Solar Panel Buyer Address
solar_panel_payment_receipt-Part3-SolarPanelBuyerInformation:solarPanelBuyerAddress:city	Text	Solar Panel Buyer Address
solar_panel_payment_receipt-Part3-SolarPanelBuyerInformation:solarPanelBuyerAddress:state	State	Solar Panel Buyer Address
solar_panel_payment_receipt-Part3-SolarPanelBuyerInformation:solarPanelBuyerAddress:zipCode	ZIP Code	Solar Panel Buyer Address
Sample document
drive.google.com
API - SOLAR PANEL PAYMENT RECEIPT.pdf
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
      "pk": 49666397,
      "uuid": "df82b183-216a-4a60-90ff-60804978beb6",
      "uploaded_doc_pk": 59900482,
      "form_type": "SOLAR_PANEL_PAYMENT_RECEIPT",
      "raw_fields": {
        "solar_panel_payment_receipt-Part1-General:anyPenalties": {
          "value": "YES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL PAYMENT RECEIPT.pdf",
          "confidence": 1.0
        },
        "solar_panel_payment_receipt-Part1-General:dateOfReceipt": {
          "value": "01/01/2022",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL PAYMENT RECEIPT.pdf",
          "confidence": 1.0
        },
        "solar_panel_payment_receipt-Part1-General:paymentStatus": {
          "value": "PAID",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL PAYMENT RECEIPT.pdf",
          "confidence": 1.0
        },
        "solar_panel_payment_receipt-Part1-General:receiptNumber": {
          "value": "ABC12345DEFG678",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL PAYMENT RECEIPT.pdf",
          "confidence": 1.0
        },
        "solar_panel_payment_receipt-Part1-General:paymentDueDate": {
          "value": "01/10/2022",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL PAYMENT RECEIPT.pdf",
          "confidence": 1.0
        },
        "solar_panel_payment_receipt-Part1-General:paymentDueAmount": {
          "value": "0.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL PAYMENT RECEIPT.pdf",
          "confidence": 1.0
        },
        "solar_panel_payment_receipt-Part1-General:totalMonthlyPayment": {
          "value": "235399.50",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL PAYMENT RECEIPT.pdf",
          "confidence": 1.0
        },
        "solar_panel_payment_receipt-Part1-General:penaltiesAmount-IfYes": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL PAYMENT RECEIPT.pdf",
          "confidence": 1.0
        },
        "solar_panel_payment_receipt-Part3-SolarPanelBuyerInformation:solarPanelBuyerName": {
          "value": "JOHN SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL PAYMENT RECEIPT.pdf",
          "confidence": 1.0
        },
        "solar_panel_payment_receipt-Part2-SolarPanelProviderInformation:solarPanelProviderName": {
          "value": "ABC SAMPLE SOLAR PANEL COMPANY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL PAYMENT RECEIPT.pdf",
          "confidence": 1.0
        },
        "solar_panel_payment_receipt-Part3-SolarPanelBuyerInformation:solarPanelBuyerAddress:city": {
          "value": "SAMPLE CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL PAYMENT RECEIPT.pdf",
          "confidence": 1.0
        },
        "solar_panel_payment_receipt-Part3-SolarPanelBuyerInformation:solarPanelBuyerAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL PAYMENT RECEIPT.pdf",
          "confidence": 1.0
        },
        "solar_panel_payment_receipt-Part3-SolarPanelBuyerInformation:solarPanelBuyerAddress:zipCode": {
          "value": "12345-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL PAYMENT RECEIPT.pdf",
          "confidence": 1.0
        },
        "solar_panel_payment_receipt-Part2-SolarPanelProviderInformation:solarPanelProviderAddress:city": {
          "value": "CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL PAYMENT RECEIPT.pdf",
          "confidence": 1.0
        },
        "solar_panel_payment_receipt-Part2-SolarPanelProviderInformation:solarPanelProviderAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL PAYMENT RECEIPT.pdf",
          "confidence": 1.0
        },
        "solar_panel_payment_receipt-Part3-SolarPanelBuyerInformation:solarPanelBuyerAddress:addressLine1": {
          "value": "123 SAMPLE STREET AVENUE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL PAYMENT RECEIPT.pdf",
          "confidence": 1.0
        },
        "solar_panel_payment_receipt-Part3-SolarPanelBuyerInformation:solarPanelBuyerAddress:addressLine2": {
          "value": "SUITE 12",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL PAYMENT RECEIPT.pdf",
          "confidence": 1.0
        },
        "solar_panel_payment_receipt-Part2-SolarPanelProviderInformation:solarPanelProviderAddress:zipCode": {
          "value": "12345-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL PAYMENT RECEIPT.pdf",
          "confidence": 1.0
        },
        "solar_panel_payment_receipt-Part2-SolarPanelProviderInformation:solarPanelProviderAddress:addressLine1": {
          "value": "123 FAKE MEMORIAL STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL PAYMENT RECEIPT.pdf",
          "confidence": 1.0
        },
        "solar_panel_payment_receipt-Part2-SolarPanelProviderInformation:solarPanelProviderAddress:addressLine2": {
          "value": "UNIT 2",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - SOLAR PANEL PAYMENT RECEIPT.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 276185,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Rental Housing Payment
Stock Purchase Plan Payment
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