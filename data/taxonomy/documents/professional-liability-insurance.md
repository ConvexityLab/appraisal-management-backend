# Professional Liability Insurance

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
Professional Liability Insurance
Suggest Edits

This document provides proof of coverage for professionals against claims of negligence, errors, or omissions in their services. It includes details such as the policyholder’s name, coverage limits, policy terms, and the scope of professional activities covered.

To use the Upload PDF endpoint for this document, you must use PROFESSIONAL_LIABILITY_INSURANCE in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
professional_liability_insurance-Part1-InsuredNameAndAddress:nameOfInsured	Text	Name Of Insured
professional_liability_insurance-Part1-InsuredNameAndAddress:addressOfInsured:addressLine1	Text	Address Of Insured
professional_liability_insurance-Part1-InsuredNameAndAddress:addressOfInsured:addressLine2	Text	Address Of Insured
professional_liability_insurance-Part1-InsuredNameAndAddress:addressOfInsured:city	Text	Address Of Insured
professional_liability_insurance-Part1-InsuredNameAndAddress:addressOfInsured:state	State	Address Of Insured
professional_liability_insurance-Part1-InsuredNameAndAddress:addressOfInsured:zip	ZIP Code	Address Of Insured
professional_liability_insurance-Part2-CoveragePeriodAndAggregateLiabilityLimit:policyPeriod:inception(Start)Date	Date	Policy Period
professional_liability_insurance-Part2-CoveragePeriodAndAggregateLiabilityLimit:policyPeriod:expirationDate	Date	Policy Period
professional_liability_insurance-Part2-CoveragePeriodAndAggregateLiabilityLimit:limitOfProfessionalLiability:aggregateAmount	Money	Limit Of Professional Liability
Sample document
drive.google.com
Professional Liability Insurance.pdf
Sample JSON result
JSON
{
  "pk": 55831506,
  "uuid": "375d7045-d245-49ab-a9b9-ecbb17bf5f6c",
  "name": "PROFESSIONAL_LIABILITY_INSURANCE",
  "created": "2024-12-05T17:41:01Z",
  "created_ts": "2024-12-05T17:41:01Z",
  "verified_pages_count": 1,
  "book_status": "ACTIVE",
  "id": 55831506,
  "forms": [
    {
      "pk": 60933616,
      "uuid": "6b6c159b-eb37-41c9-ab2c-91ce7f06988c",
      "uploaded_doc_pk": 84629751,
      "form_type": "PROFESSIONAL_LIABILITY_INSURANCE",
      "form_config_pk": 997804,
      "tables": [],
      "attribute_data": null,
      "raw_fields": {
        "professional_liability_insurance-Part1-InsuredNameAndAddress:nameOfInsured": {
          "value": "DUMMY JOHN",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Professional Liability Insurance.pdf",
          "confidence": 1.0
        },
        "professional_liability_insurance-Part1-InsuredNameAndAddress:addressOfInsured:zip": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Professional Liability Insurance.pdf",
          "confidence": 1.0
        },
        "professional_liability_insurance-Part1-InsuredNameAndAddress:addressOfInsured:city": {
          "value": "CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Professional Liability Insurance.pdf",
          "confidence": 1.0
        },
        "professional_liability_insurance-Part1-InsuredNameAndAddress:addressOfInsured:state": {
          "value": "CA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Professional Liability Insurance.pdf",
          "confidence": 1.0
        },
        "professional_liability_insurance-Part1-InsuredNameAndAddress:addressOfInsured:addressLine1": {
          "value": "123 FAKE STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Professional Liability Insurance.pdf",
          "confidence": 1.0
        },
        "professional_liability_insurance-Part1-InsuredNameAndAddress:addressOfInsured:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Professional Liability Insurance.pdf",
          "confidence": 1.0
        },
        "professional_liability_insurance-Part2-CoveragePeriodAndAggregateLiabilityLimit:policyPeriod:expirationDate": {
          "value": "10/01/2024",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Professional Liability Insurance.pdf",
          "confidence": 1.0
        },
        "professional_liability_insurance-Part2-CoveragePeriodAndAggregateLiabilityLimit:policyPeriod:inception(Start)Date": {
          "value": "10/01/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Professional Liability Insurance.pdf",
          "confidence": 1.0
        },
        "professional_liability_insurance-Part2-CoveragePeriodAndAggregateLiabilityLimit:limitOfProfessionalLiability:aggregateAmount": {
          "value": "3000000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Professional Liability Insurance.pdf",
          "confidence": 1.0
        }
      }
    }
  ],
  "book_is_complete": true
}


Updated 6 months ago

Loan Agreement
Release of Judgment or Lien
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