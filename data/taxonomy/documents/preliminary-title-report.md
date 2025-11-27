# Preliminary Title Report

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
Preliminary Title Report
Suggest Edits

A preliminary title report includes information gathered from a variety of government sources that, when combined, detail the ownership of a property and important issues related to the ownership.

To use the Upload PDF endpoint for this document, you must use PRELIMINARY_TITLE_REPORT in the form_type parameter. To learn more about processing this document, click here.

Field descriptions

The following fields are available on this document type:

JSON attribute	Data type	Description
preliminary_title_report-General:titleCompany	Text	Title Company
preliminary_title_report-General:propertyAddress:addressLine1	Text	Property Address
preliminary_title_report-General:propertyAddress:addressLine2	Text	Property Address
preliminary_title_report-General:propertyAddress:city	Text	Property Address
preliminary_title_report-General:propertyAddress:state	State	Property Address
preliminary_title_report-General:propertyAddress:zip	ZIP Code	Property Address
preliminary_title_report-General:date	Date	Date
preliminary_title_report-General:effectiveDate	Date	Effective Date
preliminary_title_report-General:vesting-Description	Text	Vesting - Description
preliminary_title_report-General:titleAmount	Money	Title Amount
preliminary_title_report-General:liens	Text	Liens
preliminary_title_report-General:defects	Text	Defects
Sample document
drive.google.com
Preliminary Report.pdf
Sample JSON result
JSON
{
        "pk": 29289397,
        "uuid": "199e9eb1-eb2a-4ec8-940e-96ea2298ae73",
        "name": "API Documentation (MS+PTR)",
        "created": "2023-02-07T19:21:40Z",
        "created_ts": "2023-02-07T19:21:40Z",
        "verified_pages_count": 6,
        "book_status": "ACTIVE",
        "id": 29289397,
        "forms": [
{
                "pk": 44060252,
                "uuid": "5ebd2b64-2249-4fb4-b847-5a07e5220362",
                "uploaded_doc_pk": 51459552,
                "form_type": "PRELIMINARY_TITLE_REPORT",
                "raw_fields": {
                    "preliminary_title_report-General:date": {
                        "value": "01/01/2020",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Preliminary Report.pdf"
                    },
                    "preliminary_title_report-General:liens": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Preliminary Report.pdf"
                    },
                    "preliminary_title_report-General:defects": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Preliminary Report.pdf"
                    },
                    "preliminary_title_report-General:titleAmount": {
                        "value": "310000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Preliminary Report.pdf"
                    },
                    "preliminary_title_report-General:titleCompany": {
                        "value": "FIRST AMERICAN TITLE INSURANCE COMPANY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Preliminary Report.pdf"
                    },
                    "preliminary_title_report-General:effectiveDate": {
                        "value": "01/12/2020",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Preliminary Report.pdf"
                    },
                    "preliminary_title_report-General:propertyAddress:zip": {
                        "value": "12345",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Preliminary Report.pdf"
                    },
                    "preliminary_title_report-General:vesting-Description": {
                        "value": "SAMPLE NAME, NOT AS TENANTS IN COMMON BUT WITH THE RIGHT OF SURVIVORSHIP",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Preliminary Report.pdf"
                    },
                    "preliminary_title_report-General:propertyAddress:city": {
                        "value": "ANY CITY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Preliminary Report.pdf"
                    },
                    "preliminary_title_report-General:propertyAddress:state": {
                        "value": "FL",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Preliminary Report.pdf"
                    },
                    "preliminary_title_report-General:propertyAddress:addressLine1": {
                        "value": "123 FAKE STREET",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Preliminary Report.pdf"
                    },
                    "preliminary_title_report-General:propertyAddress:addressLine2": {
                        "value": "SUITE 12",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Preliminary Report.pdf"
                    }
                },
                "form_config_pk": 196514,
                "tables": []
            }
        ],
        "book_is_complete": true
    }


Updated 9 months ago

Payoff Letter
Property Tax Bill
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