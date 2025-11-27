# Solar Panel Lease Agreement

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
Solar Panel Lease Agreement
Suggest Edits

This is a contractual arrangement between a solar panel provider and a property owner. It allows the provider to install and maintain solar panels on the property in exchange for lease payments or energy production credits.

To use the Upload PDF endpoint for this document, you must use SOLAR_PANEL_LEASE_AGREEMENT in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
solar_panel_lease_agreement-Part1-General:dateOfAgreement	Date	Date Of Agreement
solar_panel_lease_agreement-Part1-General:agreementType	Text	Agreement Type
solar_panel_lease_agreement-Part1-General:agreementDuration	Text	Agreement Duration
solar_panel_lease_agreement-Part1-General:monthlyPayment	Money	Monthly Payment
solar_panel_lease_agreement-Part1-General:paymentStatus	PAID, NOT PAID	Payment Status
solar_panel_lease_agreement-Part1-General:paymentDueAmount	Money	Payment Due Amount
solar_panel_lease_agreement-Part1-General:paymentDueDate	Date	Payment Due Date
solar_panel_lease_agreement-Part1-General:interestRate	Percentage	Interest Rate
solar_panel_lease_agreement-Part1-General:leaseAmount	Money	Lease Amount
solar_panel_lease_agreement-Part1-General:outstandingBalance	Money	Outstanding Balance
solar_panel_lease_agreement-Part2-OwnerInformation:ownerName	Text	Owner Name
solar_panel_lease_agreement-Part2-OwnerInformation:ownerAddress:addressLine1	Text	Owner Address
solar_panel_lease_agreement-Part2-OwnerInformation:ownerAddress:addressLine2	Text	Owner Address
solar_panel_lease_agreement-Part2-OwnerInformation:ownerAddress:city	Text	Owner Address
solar_panel_lease_agreement-Part2-OwnerInformation:ownerAddress:state	State	Owner Address
solar_panel_lease_agreement-Part2-OwnerInformation:ownerAddress:zipCode	ZIP Code	Owner Address
solar_panel_lease_agreement-Part3-OperatorInformation:operatorName	Text	Operator Name
solar_panel_lease_agreement-Part3-OperatorInformation:operatorAddress:addressLine1	Text	Operator Address
solar_panel_lease_agreement-Part3-OperatorInformation:operatorAddress:addressLine2	Text	Operator Address
solar_panel_lease_agreement-Part3-OperatorInformation:operatorAddress:city	Text	Operator Address
solar_panel_lease_agreement-Part3-OperatorInformation:operatorAddress:state	State	Operator Address
solar_panel_lease_agreement-Part3-OperatorInformation:operatorAddress:zipCode	ZIP Code	Operator Address
Sample document
drive.google.com
SOLAR PANEL LEASE AGREEMENT.pdf
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
      "pk": 49722892,
      "uuid": "c1c10620-bbe5-4f76-bf3a-8dd0c64a8dac",
      "uploaded_doc_pk": 59971972,
      "form_type": "SOLAR_PANEL_LEASE_AGREEMENT",
      "raw_fields": {
        "solar_panel_lease_agreement-Part2-OwnerInformation:ownerName": {
          "value": "THE FAKE GROUP",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "SOLAR PANEL LEASE AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_lease_agreement-Part2-OwnerInformation:ownerAddress:city": {
          "value": "UNKNOWN CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "SOLAR PANEL LEASE AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_lease_agreement-Part2-OwnerInformation:ownerAddress:state": {
          "value": "CA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "SOLAR PANEL LEASE AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_lease_agreement-Part2-OwnerInformation:ownerAddress:zipCode": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "SOLAR PANEL LEASE AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_lease_agreement-Part2-OwnerInformation:ownerAddress:addressLine1": {
          "value": "FAKE MEMORIAL RD.",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "SOLAR PANEL LEASE AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_lease_agreement-Part2-OwnerInformation:ownerAddress:addressLine2": {
          "value": "BLDG 1",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "SOLAR PANEL LEASE AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_lease_agreement-Part3-OperatorInformation:operatorName": {
          "value": "SAMPLE ASSOCIATES, LLC",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "SOLAR PANEL LEASE AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_lease_agreement-Part3-OperatorInformation:operatorAddress:city": {
          "value": "ANYCITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "SOLAR PANEL LEASE AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_lease_agreement-Part3-OperatorInformation:operatorAddress:state": {
          "value": "CA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "SOLAR PANEL LEASE AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_lease_agreement-Part3-OperatorInformation:operatorAddress:zipCode": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "SOLAR PANEL LEASE AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_lease_agreement-Part3-OperatorInformation:operatorAddress:addressLine1": {
          "value": "123 FAKE AVENUE STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "SOLAR PANEL LEASE AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_lease_agreement-Part3-OperatorInformation:operatorAddress:addressLine2": {
          "value": "#1",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "SOLAR PANEL LEASE AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_lease_agreement-Part1-General:dateOfAgreement": {
          "value": "01/01/2020",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "SOLAR PANEL LEASE AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_lease_agreement-Part1-General:leaseAmount": {
          "value": "50000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "SOLAR PANEL LEASE AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_lease_agreement-Part1-General:interestRate": {
          "value": "5%",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "SOLAR PANEL LEASE AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_lease_agreement-Part1-General:agreementType": {
          "value": "TERM LEASE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "SOLAR PANEL LEASE AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_lease_agreement-Part1-General:paymentStatus": {
          "value": "NOT PAID",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "SOLAR PANEL LEASE AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_lease_agreement-Part1-General:monthlyPayment": {
          "value": "5500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "SOLAR PANEL LEASE AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_lease_agreement-Part1-General:paymentDueDate": {
          "value": "02/01/2020",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "SOLAR PANEL LEASE AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_lease_agreement-Part1-General:paymentDueAmount": {
          "value": "5500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "SOLAR PANEL LEASE AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_lease_agreement-Part1-General:agreementDuration": {
          "value": "5 YEARS",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "SOLAR PANEL LEASE AGREEMENT.pdf",
          "confidence": 1.0
        },
        "solar_panel_lease_agreement-Part1-General:outstandingBalance": {
          "value": "45000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "SOLAR PANEL LEASE AGREEMENT.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 276183,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Release of Judgment or Lien
Solar Panel Loan Agreement
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