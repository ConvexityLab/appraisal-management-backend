# Closing Protection Letter

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
Closing Protection Letter
Suggest Edits

A closing protection letter forms a contract between a title insurance underwriter and a lender, in which the underwriter agrees to indemnify the lender for actual losses caused by certain kinds of misconduct by the closing agent.

To use the Upload PDF endpoint for this document, you must use CLOSING_PROTECTION_LETTER in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
closing_protection_letter-Part1-General:nameOfAddressee	Text	Name Of Addressee
closing_protection_letter-Part1-General:addresseeStreetAddress:addressLine1	Text	Addressee Street Address
closing_protection_letter-Part1-General:addresseeStreetAddress:addressLine2	Text	Addressee Street Address
closing_protection_letter-Part1-General:addresseeStreetAddress:city	Text	Addressee Street Address
closing_protection_letter-Part1-General:addresseeStreetAddress:state	State	Addressee Street Address
closing_protection_letter-Part1-General:addresseeStreetAddress:zipCode	ZIP Code	Addressee Street Address
closing_protection_letter-Part1-General:documentDate	Date	Document Date
closing_protection_letter-Part1-General:nameOfAgency	Text	Name Of Agency
closing_protection_letter-Part1-General:buyerName	Text	Buyer Name
closing_protection_letter-Part1-General:addressOfAgency:addressLine1	Text	Address Of Agency
closing_protection_letter-Part1-General:addressOfAgency:addressLine2	Text	Address Of Agency
closing_protection_letter-Part1-General:addressOfAgency:city	Text	Address Of Agency
closing_protection_letter-Part1-General:addressOfAgency:state	State	Address Of Agency
closing_protection_letter-Part1-General:addressOfAgency:zipCode	ZIP Code	Address Of Agency
closing_protection_letter-Part1-General:isTheDocumentSigned?	Yes, No	Is The Document Signed?
closing_protection_letter-Part2-PropertyDetails:buyerPropertyAddress:addressLine1	Text	Buyer Property Address
closing_protection_letter-Part2-PropertyDetails:buyerPropertyAddress:addressLine2	Text	Buyer Property Address
closing_protection_letter-Part2-PropertyDetails:buyerPropertyAddress:city	Text	Buyer Property Address
closing_protection_letter-Part2-PropertyDetails:buyerPropertyAddress:state	State	Buyer Property Address
closing_protection_letter-Part2-PropertyDetails:buyerPropertyAddress:zipCode	ZIP Code	Buyer Property Address
closing_protection_letter-Part2-PropertyDetails:closingDate	Date	Closing Date
closing_protection_letter-Part2-PropertyDetails:loanNumber	Text	Loan Number
closing_protection_letter-Part2-PropertyDetails:fileNumber	Text	File Number
closing_protection_letter-Part2-PropertyDetails:aggregateFunds$	Money	Aggregate Funds $
Sample document
Sample JSON result
JSON
{
    "status": 200,
    "response": {
        "pk": 30317235,
        "uuid": "42d1727a-d8e0-48e6-b462-aa55b926471b",
        "name": "Closing protection letter",
        "created": "2023-03-06T17:23:47Z",
        "created_ts": "2023-03-06T17:23:47Z",
        "verified_pages_count": 4,
        "book_status": "ACTIVE",
        "id": 30317235,
        "forms": [
            {
                "pk": 44715050,
                "uuid": "2d6ee71a-3b69-406b-a8f5-f9a46542001e",
                "uploaded_doc_pk": 52507573,
                "form_type": "CLOSING_PROTECTION_LETTER",
                "raw_fields": {
                    "closing_protection_letter-Part1-General:buyerName": {
                        "value": "JANE SAMPLE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Closing Protection Letter - API Sample.pdf"
                    },
                    "closing_protection_letter-Part1-General:documentDate": {
                        "value": "05/05/2022",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Closing Protection Letter - API Sample.pdf"
                    },
                    "closing_protection_letter-Part1-General:nameOfAgency": {
                        "value": "BLANK TITLE INSURANCE COMPANY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Closing Protection Letter - API Sample.pdf"
                    },
                    "closing_protection_letter-Part1-General:nameOfAddressee": {
                        "value": "ABC MORTGAGE COMPANY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Closing Protection Letter - API Sample.pdf"
                    },
                    "closing_protection_letter-Part1-General:addressOfAgency:addressLine1": {
                        "value": "123 MAIN STREET",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Closing Protection Letter - API Sample.pdf"
                    },
                    "closing_protection_letter-Part1-General:addressOfAgency:addressLine2": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Closing Protection Letter - API Sample.pdf"
                    },
                    "closing_protection_letter-Part1-General:addressOfAgency:city": {
                        "value": "ANY CITY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Closing Protection Letter - API Sample.pdf"
                    },
                    "closing_protection_letter-Part1-General:addressOfAgency:state": {
                        "value": "CA",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Closing Protection Letter - API Sample.pdf"
                    },
                    "closing_protection_letter-Part1-General:addressOfAgency:zipCode": {
                        "value": "12345-0000",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Closing Protection Letter - API Sample.pdf"
                    },
                    "closing_protection_letter-Part1-General:isTheDocumentSigned?": {
                        "value": "YES",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Closing Protection Letter - API Sample.pdf"
                    } ,
                    "closing_protection_letter-Part2-PropertyDetails:fileNumber": {
                        "value": "ABC12345",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Closing Protection Letter - API Sample.pdf"
                    },
                    "closing_protection_letter-Part2-PropertyDetails:loanNumber": {
                        "value": "123456789",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Closing Protection Letter - API Sample.pdf"
                    },
                    "closing_protection_letter-Part2-PropertyDetails:closingDate": {
                        "value": "05/20/2022",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Closing Protection Letter - API Sample.pdf"
                    },
                    "closing_protection_letter-Part2-PropertyDetails:aggregateFunds$": {
                        "value": "50000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Closing Protection Letter - API Sample.pdf"
                    },
                    "closing_protection_letter-Part1-General:addresseeStreetAddress:city": {
                        "value": "ANY CITY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Closing Protection Letter - API Sample.pdf"
                    },
                    "closing_protection_letter-Part1-General:addresseeStreetAddress:state": {
                        "value": "NY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Closing Protection Letter - API Sample.pdf"
                    },
                    "closing_protection_letter-Part1-General:addresseeStreetAddress:zipCode": {
                        "value": "12345",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Closing Protection Letter - API Sample.pdf"
                    },
                    "closing_protection_letter-Part2-PropertyDetails:buyerPropertyAddress:city": {
                        "value": "RICHMOND",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Closing Protection Letter - API Sample.pdf"
                    },
                    "closing_protection_letter-Part2-PropertyDetails:buyerPropertyAddress:state": {
                        "value": "VA",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Closing Protection Letter - API Sample.pdf"
                    },
                    "closing_protection_letter-Part1-General:addresseeStreetAddress:addressLine1": {
                        "value": "123 MAIN STREET",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Closing Protection Letter - API Sample.pdf"
                    },
                    "closing_protection_letter-Part1-General:addresseeStreetAddress:addressLine2": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Closing Protection Letter - API Sample.pdf"
                    },
                    "closing_protection_letter-Part2-PropertyDetails:buyerPropertyAddress:zipCode": {
                        "value": "12345",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Closing Protection Letter - API Sample.pdf"
                    },
                    "closing_protection_letter-Part2-PropertyDetails:buyerPropertyAddress:addressLine1": {
                        "value": "123 SAMPLE STREET",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Closing Protection Letter - API Sample.pdf"
                    },
                    "closing_protection_letter-Part2-PropertyDetails:buyerPropertyAddress:addressLine2": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Closing Protection Letter - API Sample.pdf"
                    }
                },
                "form_config_pk": 140732,
                "tables": []
            }
        ],
        "book_is_complete": true
    },
    "message": "OK"
}


Updated 6 months ago

Closing Disclosure
Divorce Decree
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