# Certificate of Liability Insurance

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
Certificate of Liability Insurance
Suggest Edits

This document provides proof of an individual’s or business’s liability insurance coverage. It outlines key details such as policyholder information, coverage types, limits, and policy duration, commonly used to assure third parties of adequate insurance protection.

To use the Upload PDF endpoint for this document, you must use CERTIFICATE_OF_LIABILITY_INSURANCE in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
certificate_of_liability_insurance-Part1-InsuredNameAndAddress:nameOfInsured	Text	Name Of Insured
certificate_of_liability_insurance-Part1-InsuredNameAndAddress:addressOfInsured:addressLine1	Text	Address Of Insured
certificate_of_liability_insurance-Part1-InsuredNameAndAddress:addressOfInsured:addressLine2	Text	Address Of Insured
certificate_of_liability_insurance-Part1-InsuredNameAndAddress:addressOfInsured:city	Text	Address Of Insured
certificate_of_liability_insurance-Part1-InsuredNameAndAddress:addressOfInsured:state	State	Address Of Insured
certificate_of_liability_insurance-Part1-InsuredNameAndAddress:addressOfInsured:zip	ZIP Code	Address Of Insured
certificate_of_liability_insurance-Part2-CoveragePeriodAndAggregateLiabilityLimit:policyPeriod:inception(Start)Date	Date	Policy Period
certificate_of_liability_insurance-Part2-CoveragePeriodAndAggregateLiabilityLimit:policyPeriod:expirationDate	Date	Policy Period
certificate_of_liability_insurance-Part2-CoveragePeriodAndAggregateLiabilityLimit:limitOfProfessionalLiability:aggregateAmount	Money	Limit Of Professional Liability
Sample document
drive.google.com
Certificate Of Liability Insurance.pdf
Sample JSON result
JSON
{
  "pk": 57066647,
  "uuid": "c1c79028-74fb-4bfd-aa59-565280124b87",
  "name": "CLI API",
  "created": "2025-01-14T16:41:21Z",
  "created_ts": "2025-01-14T16:41:21Z",
  "verified_pages_count": 1,
  "book_status": "ACTIVE",
  "id": 57066647,
  "forms": [
    {
      "pk": 62097013,
      "uuid": "428d615b-fbd8-4828-a9e0-c61153af0e0c",
      "uploaded_doc_pk": 87359175,
      "form_type": "CERTIFICATE_OF_LIABILITY_INSURANCE",
      "form_config_pk": 997805,
      "tables": [],
      "attribute_data": null,
      "raw_fields": {
        "certificate_of_liability_insurance-Part1-InsuredNameAndAddress:nameOfInsured": {
          "value": "SPECIAL DUMMY SERVICE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Certificate Of Liability Insurance.pdf",
          "confidence": 1.0
        },
        "certificate_of_liability_insurance-Part1-InsuredNameAndAddress:addressOfInsured:zip": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Certificate Of Liability Insurance.pdf",
          "confidence": 1.0
        },
        "certificate_of_liability_insurance-Part1-InsuredNameAndAddress:addressOfInsured:city": {
          "value": "NEW CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Certificate Of Liability Insurance.pdf",
          "confidence": 1.0
        },
        "certificate_of_liability_insurance-Part1-InsuredNameAndAddress:addressOfInsured:state": {
          "value": "CA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Certificate Of Liability Insurance.pdf",
          "confidence": 1.0
        },
        "certificate_of_liability_insurance-Part1-InsuredNameAndAddress:addressOfInsured:addressLine1": {
          "value": "PO BOX 12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Certificate Of Liability Insurance.pdf",
          "confidence": 1.0
        },
        "certificate_of_liability_insurance-Part1-InsuredNameAndAddress:addressOfInsured:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Certificate Of Liability Insurance.pdf",
          "confidence": 1.0
        },
        "certificate_of_liability_insurance-Part2-CoveragePeriodAndAggregateLiabilityLimit:policyPeriod:expirationDate": {
          "value": "02/12/2021",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Certificate Of Liability Insurance.pdf",
          "confidence": 1.0
        },
        "certificate_of_liability_insurance-Part2-CoveragePeriodAndAggregateLiabilityLimit:policyPeriod:inception(Start)Date": {
          "value": "02/12/2020",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Certificate Of Liability Insurance.pdf",
          "confidence": 1.0
        },
        "certificate_of_liability_insurance-Part2-CoveragePeriodAndAggregateLiabilityLimit:limitOfProfessionalLiability:aggregateAmount": {
          "value": "300000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Certificate Of Liability Insurance.pdf",
          "confidence": 1.0
        }
      }
    }
  ],
  "book_is_complete": true
}


Updated 6 months ago

Appraisal Notice
Final Inspection
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