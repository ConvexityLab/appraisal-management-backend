# Homeowners Association Statement

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
Homeowners Association Statement
Suggest Edits

This document is provided by the Homeowners Association (HOA). It outlines important details about a property within its jurisdiction, including dues, special assessments, rules, and the property's compliance with association guidelines.

To use the Upload PDF endpoint for this document, you must use HOMEOWNERS_ASSOCIATION_STATEMENT in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
homeowners_association_statement-General:homeownersAssociationName	Text	Homeowners Association Name
homeowners_association_statement-General:homeownersAssociationContactPerson	Text	Homeowners Association Contact Person
homeowners_association_statement-General:homeownersAssociationContactPhoneNumber	Phone Number	Homeowners Association Contact Phone Number
homeowners_association_statement-General:homeownersAssociationContactEmail	Email	Homeowners Association Contact Email
homeowners_association_statement-General:propertyAddress:addressLine1	Text	Property Address
homeowners_association_statement-General:propertyAddress:addressLine2	Text	Property Address
homeowners_association_statement-General:propertyAddress:city	Text	Property Address
homeowners_association_statement-General:propertyAddress:state	State	Property Address
homeowners_association_statement-General:propertyAddress:zip	ZIP Code	Property Address
homeowners_association_statement-General:homeownerName	Text	Homeowner Name
homeowners_association_statement-General:dueDate	Date	Due Date
homeowners_association_statement-General:assessmentAmount(HoaDues)	Money	Assessment Amount (HOA Dues)
homeowners_association_statement-General:assessmentFrequency	MONTHLY, QUARTERLY, SEMI-ANNUALLY, ANNUALLY, OTHER	Assessment Frequency
homeowners_association_statement-General:mostRecentPaymentDate	Date	Most Recent Payment Date
homeowners_association_statement-General:mostRecentPaymentAmount	Money	Most Recent Payment Amount
Sample document
drive.google.com
HOMEOWNERS ASSOCIATION STATEMENT.pdf


Sample JSON result
JSON
{
  "pk": 54274128,
  "uuid": "513ec7ce-3d68-4290-8e3d-bce50fd82711",
  "name": "Homeowner Association Statement",
  "created": "2024-10-15T22:14:09Z",
  "created_ts": "2024-10-15T22:14:09Z",
  "verified_pages_count": 1,
  "book_status": "ACTIVE",
  "id": 54274128,
  "forms": [
    {
      "pk": 59331576,
      "uuid": "a05ad40d-4b75-4f03-add3-6ae8315e489b",
      "uploaded_doc_pk": 80934850,
      "form_type": "HOMEOWNERS_ASSOCIATION_STATEMENT",
      "raw_fields": {
        "homeowners_association_statement-General:dueDate": {
          "value": "08/30/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HOMEOWNERS ASSOCIATION STATEMENT.pdf",
          "confidence": 1.0
        },
        "homeowners_association_statement-General:homeownerName": {
          "value": "SAMPLE PROPERTIES COMPANY LL",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HOMEOWNERS ASSOCIATION STATEMENT.pdf",
          "confidence": 1.0
        },
        "homeowners_association_statement-General:assessmentFrequency": {
          "value": "QUARTERLY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HOMEOWNERS ASSOCIATION STATEMENT.pdf",
          "confidence": 1.0
        },
        "homeowners_association_statement-General:propertyAddress:zip": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HOMEOWNERS ASSOCIATION STATEMENT.pdf",
          "confidence": 1.0
        },
        "homeowners_association_statement-General:propertyAddress:city": {
          "value": "NEW CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HOMEOWNERS ASSOCIATION STATEMENT.pdf",
          "confidence": 1.0
        },
        "homeowners_association_statement-General:mostRecentPaymentDate": {
          "value": "07/06/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HOMEOWNERS ASSOCIATION STATEMENT.pdf",
          "confidence": 1.0
        },
        "homeowners_association_statement-General:propertyAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HOMEOWNERS ASSOCIATION STATEMENT.pdf",
          "confidence": 1.0
        },
        "homeowners_association_statement-General:mostRecentPaymentAmount": {
          "value": "88.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HOMEOWNERS ASSOCIATION STATEMENT.pdf",
          "confidence": 1.0
        },
        "homeowners_association_statement-General:assessmentAmount(HoaDues)": {
          "value": "88.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HOMEOWNERS ASSOCIATION STATEMENT.pdf",
          "confidence": 1.0
        },
        "homeowners_association_statement-General:homeownersAssociationName": {
          "value": "MCKEE SAMPLE HOMEOWNERS ASSOCIATION, INC.",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HOMEOWNERS ASSOCIATION STATEMENT.pdf",
          "confidence": 1.0
        },
        "homeowners_association_statement-General:propertyAddress:addressLine1": {
          "value": "1234 SAMPLE LANE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HOMEOWNERS ASSOCIATION STATEMENT.pdf",
          "confidence": 1.0
        },
        "homeowners_association_statement-General:propertyAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "HOMEOWNERS ASSOCIATION STATEMENT.pdf",
          "confidence": 1.0
        },
        "homeowners_association_statement-General:homeownersAssociationContactEmail": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "HOMEOWNERS ASSOCIATION STATEMENT.pdf",
          "confidence": 1.0
        },
        "homeowners_association_statement-General:homeownersAssociationContactPerson": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "HOMEOWNERS ASSOCIATION STATEMENT.pdf",
          "confidence": 1.0
        },
        "homeowners_association_statement-General:homeownersAssociationContactPhoneNumber": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "HOMEOWNERS ASSOCIATION STATEMENT.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 848821,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 8 months ago

Final Inspection
Homeowner Insurance Policy - Insurance Binder
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