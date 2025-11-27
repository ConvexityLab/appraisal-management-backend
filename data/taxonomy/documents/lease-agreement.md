# Residential Lease Agreement

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
Residential Lease Agreement
Suggest Edits

A lease agreement is a legal contract between a landlord and a tenant. It outlines the rules for the tenant's use of the property, including how long they can stay, how much rent they'll pay, and what they can and can't do on the property. It also covers things like security deposits and who is responsible for repairs. Both the landlord and the tenant agree to follow these rules when they sign the agreement.

To use the Upload PDF endpoint for this document, you must use LEASE_AGREEMENT in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON attribute	Data type	Description
lease_agreement-Part1-TenantInfo:nameOfTenant1	Text	Name Of Tenant 1
lease_agreement-Part1-TenantInfo:nameOfTenant2	Text	Name Of Tenant 2
lease_agreement-Part1-TenantInfo:nameOfTenant3	Text	Name Of Tenant 3
lease_agreement-Part1-TenantInfo:nameOfTenant4	Text	Name Of Tenant 4
lease_agreement-Part1-TenantInfo:areThereMoreThan4Tenants?	YES, NO	Are There More Than 4 Tenants?
lease_agreement-Part1-TenantInfo:propertyAddress:addressLine1	Text	Property Address
lease_agreement-Part1-TenantInfo:propertyAddress:addressLine2	Text	Property Address
lease_agreement-Part1-TenantInfo:propertyAddress:city	Text	Property Address
lease_agreement-Part1-TenantInfo:propertyAddress:state	State	Property Address
lease_agreement-Part1-TenantInfo:propertyAddress:zip	ZIP Code	Property Address
lease_agreement-Part1-TenantInfo:leaseStartDate	Date	Lease Start Date
lease_agreement-Part1-TenantInfo:leaseEndDate	Date	Lease End Date
lease_agreement-Part1-TenantInfo:isMonthToMonthRenewalOptionAvailable	YES, NO	Is Month To Month Renewal Option Available?
lease_agreement-Part1-TenantInfo:monthlyPaymentAmount	Money	Monthly Payment Amount
lease_agreement-Part1-TenantInfo:agreementExpectedDurationPeriod(Months)	Integer	Agreement Expected Duration Period (Months)
lease_agreement-Part2-LandlordInfo:nameOfLandlord	Text	Name Of Landlord
lease_agreement-Part2-LandlordInfo:nameOfLandlord2	Text	Name Of Landlord 2
lease_agreement-Part2-LandlordInfo:landlordAddress:addressLine1	Text	Landlord Address
lease_agreement-Part2-LandlordInfo:landlordAddress:addressLine2	Text	Landlord Address
lease_agreement-Part2-LandlordInfo:landlordAddress:city	Text	Landlord Address
lease_agreement-Part2-LandlordInfo:landlordAddress:state	State	Landlord Address
lease_agreement-Part2-LandlordInfo:landlordAddress:zip	ZIP Code	Landlord Address
lease_agreement-Part2-LandlordInfo:dateOfLeaseAgreement	Date	Date of Lease Agreement
lease_agreement-Part2-LandlordInfo:latestSignatureDate	Date	Latest Signature Date
Sample document
drive.google.com
LEASE AGREEMENT.pdf
Sample JSON result
JSON
{
    "status": 200,
    "response": {
        "pk": 48410815,
        "uuid": "1cb8e1a8-4231-4370-a65e-4e36aca6210f",
        "name": "Lease Agreement",
        "created": "2024-04-02T18:25:47Z",
        "created_ts": "2024-04-02T18:25:47Z",
        "verified_pages_count": 10,
        "book_status": "ACTIVE",
        "id": 48410815,
        "forms": [
            {
                "pk": 54171316,
                "uuid": "90f27666-4dfd-4021-b6b1-a552deeabe54",
                "uploaded_doc_pk": 69245229,
                "form_type": "LEASE_AGREEMENT",
                "raw_fields": {
                    "lease_agreement-Part1-TenantInfo:leaseEndDate": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "LEASE AGREEMENT.pdf",
                        "confidence": 1
                    },
                    "lease_agreement-Part1-TenantInfo:nameOfTenant1": {
                        "value": "CHARLES SAMPLE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "LEASE AGREEMENT.pdf",
                        "confidence": 1
                    },
                    "lease_agreement-Part1-TenantInfo:nameOfTenant2": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "LEASE AGREEMENT.pdf",
                        "confidence": 1
                    },
                    "lease_agreement-Part1-TenantInfo:nameOfTenant3": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "LEASE AGREEMENT.pdf",
                        "confidence": 1
                    },
                    "lease_agreement-Part1-TenantInfo:nameOfTenant4": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "LEASE AGREEMENT.pdf",
                        "confidence": 1
                    },
                    "lease_agreement-Part1-TenantInfo:leaseStartDate": {
                        "value": "03/12/2024",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "LEASE AGREEMENT.pdf",
                        "confidence": 1,
                        "validation_error": "Lease Start Date should be before Lease End Date. User should review."
                    },
                    "lease_agreement-Part1-TenantInfo:agreementExpectedDurationPeriod(Months)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "LEASE AGREEMENT.pdf",
                        "confidence": 1
                    },
                    "lease_agreement-Part2-LandlordInfo:nameOfLandlord2": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "LEASE AGREEMENT.pdf",
                        "confidence": 1
                    },
                    "lease_agreement-Part2-LandlordInfo:nameOfLandlord": {
                        "value": "JOHN SAMPLE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "LEASE AGREEMENT.pdf",
                        "confidence": 1
                    },
                    "lease_agreement-Part1-TenantInfo:propertyAddress:zip": {
                        "value": "12345",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "LEASE AGREEMENT.pdf",
                        "confidence": 1
                    },
                    "lease_agreement-Part1-TenantInfo:propertyAddress:city": {
                        "value": "AMHERST",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "LEASE AGREEMENT.pdf",
                        "confidence": 1
                    },
                    "lease_agreement-Part1-TenantInfo:propertyAddress:state": {
                        "value": "NY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "LEASE AGREEMENT.pdf",
                        "confidence": 1
                    },
                    "lease_agreement-Part2-LandlordInfo:landlordAddress:zip": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "LEASE AGREEMENT.pdf",
                        "confidence": 1
                    },
                    "lease_agreement-Part2-LandlordInfo:dateOfLeaseAgreement": {
                        "value": "03/12/2024",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "LEASE AGREEMENT.pdf",
                        "confidence": 1,
                        "validation_error": "Date of Lease Agreement should be before Lease Start Date. User should review."
                    },
                    "lease_agreement-Part2-LandlordInfo:landlordAddress:city": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "LEASE AGREEMENT.pdf",
                        "confidence": 1
                    },
                    "lease_agreement-Part2-LandlordInfo:landlordAddress:state": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "LEASE AGREEMENT.pdf",
                        "confidence": 1
                    },
                    "lease_agreement-Part1-TenantInfo:areThereMoreThan4Tenants?": {
                        "value": "NO",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "LEASE AGREEMENT.pdf",
                        "confidence": 1
                    },
                    "lease_agreement-Part1-TenantInfo:propertyAddress:addressLine1": {
                        "value": "1234 NIAGARA FALLS SAMPLE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "LEASE AGREEMENT.pdf",
                        "confidence": 1
                    },
                    "lease_agreement-Part1-TenantInfo:propertyAddress:addressLine2": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "LEASE AGREEMENT.pdf",
                        "confidence": 1
                    },
                    "lease_agreement-Part2-LandlordInfo:landlordAddress:addressLine1": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "LEASE AGREEMENT.pdf",
                        "confidence": 1
                    },
                    "lease_agreement-Part2-LandlordInfo:landlordAddress:addressLine2": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "LEASE AGREEMENT.pdf",
                        "confidence": 1
                    },
                    "lease_agreement-Part1-TenantInfo:isMonthToMonthRenewalOptionAvailable": {
                        "value": "YES",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "LEASE AGREEMENT.pdf",
                        "confidence": 1
                    },
                    "lease_agreement-Part1-TenantInfo:monthlyPaymentAmount": {
                        "value": "5000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "LEASE AGREEMENT.pdf",
                        "confidence": 1
                    },
                    "lease_agreement-Part2-LandlordInfo:landlordAddress:latestSignatureDate": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "LEASE AGREEMENT.pdf",
                        "confidence": 1
                    }
                },
                "form_config_pk": 479755,
                "tables": [],
                "attribute_data": null
            }
        ],
        "book_is_complete": true
    }
}


Updated 9 months ago

Purchase Contract
Tax forms
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