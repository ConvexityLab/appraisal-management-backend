# Flood Elevation Certificate

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
Flood Elevation Certificate
Suggest Edits

An Elevation Certificate (EC) is a document that identifies the elevation of your home in relation to the Flood Zone and the Base Flood Elevation established by FEMA.

To use the Upload PDF endpoint for this document, you must use ELEVATION_CERTIFICATE in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
elevation_certificate-PartI-General:buildingOwner'SName	Text	Building Owner's Name
elevation_certificate-PartI-General:buildingStreetAddress:addressLine1	Text	Building Street Address
elevation_certificate-PartI-General:buildingStreetAddress:addressLine2	Text	Building Street Address
elevation_certificate-PartI-General:buildingCity:city	Text	Building City
elevation_certificate-PartI-General:buildingState:state	State	Building State
elevation_certificate-PartI-General:buildingZip:zip	ZIP Code	Building Zip
elevation_certificate-PartI-General:propertyDescription	Text	Property Description
elevation_certificate-PartI-General:buildingUse	Text	Building Use
elevation_certificate-PartI-General:policyNumber	Text	Policy Number
elevation_certificate-PartIi-FloodInsuranceRateMap:nfipCommunityName	Text	NFIP Community Name
elevation_certificate-PartIi-FloodInsuranceRateMap:nfipCommunityNumber	Text	NFIP Community Number
elevation_certificate-PartIi-FloodInsuranceRateMap:nfipCommunityCounty	Text	NFIP Community County
elevation_certificate-PartIi-FloodInsuranceRateMap:nfipCommunityState	State	NFIP Community State
elevation_certificate-PartIi-FloodInsuranceRateMap:nfipMapNumber	Text	NFIP Map Number
elevation_certificate-PartIi-FloodInsuranceRateMap:nfipSuffix	Text	NFIP Suffix
elevation_certificate-PartIi-FloodInsuranceRateMap:nfipFirmIndexDate	Date	NFIP Firm Index Date
elevation_certificate-PartIi-FloodInsuranceRateMap:floodZone	Text	Flood Zone
elevation_certificate-PartIii-SurveyorEngineerOrArchitectCertification:certifier'sName	Text	Certifier's Name
elevation_certificate-PartIii-SurveyorEngineerOrArchitectCertification:certifierLicenseNumber	Text	Certifier License Number
elevation_certificate-PartIii-SurveyorEngineerOrArchitectCertification:certifierCompanyName	Text	Certifier Company Name
Sample document
drive.google.com
Flood_Elevation_Certificate API.pdf
Sample JSON result
JSON
{
    "status": 200,
    "response": {
        "pk": 29946544,
        "uuid": "2410cd7f-b35d-46ba-b956-ac31f8e4b57b",
        "forms": [
            {
                "pk": 44474777,
                "uuid": "40f5c118-790c-4355-9271-1490d24bcf1f",
                "uploaded_doc_pk": 52114722,
                "form_type": "ELEVATION_CERTIFICATE",
                "raw_fields": {
                    "elevation_certificate-PartI-General:buildingUse": {
                        "value": "NON-RESIDENTIAL",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Flood_Elevation_Certificate API.pdf"
                    },
                    "elevation_certificate-PartI-General:buildingZip:zip": {
                        "value": "12345",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Flood_Elevation_Certificate API.pdf"
                    },
                    "elevation_certificate-PartI-General:buildingCity:city": {
                        "value": "FAKE CITY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Flood_Elevation_Certificate API.pdf"
                    },
                    "elevation_certificate-PartI-General:buildingOwner'SName": {
                        "value": "SAMPLE HENRY FAKE INC.",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Flood_Elevation_Certificate API.pdf"
                    },
                    "elevation_certificate-PartI-General:buildingState:state": {
                        "value": "NY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Flood_Elevation_Certificate API.pdf"
                    },
                    "elevation_certificate-PartI-General:propertyDescription": {
                        "value": "LOT NUMBER 123 BLOCK-1, 1234567890, 123 FAKE STREET AVE., SAMPLE CITY, NY 12345",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Flood_Elevation_Certificate API.pdf"
                    },
                    "elevation_certificate-PartI-General:policyNumber": {
                        "value": "1234567890",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Closing Protection Letter - API Sample.pdf"
                    },
                    "elevation_certificate-PartIi-FloodInsuranceRateMap:floodZone": {
                        "value": "FAKE ZONE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Flood_Elevation_Certificate API.pdf"
                    },
                    "elevation_certificate-PartIi-FloodInsuranceRateMap:nfipSuffix": {
                        "value": "A",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Flood_Elevation_Certificate API.pdf"
                    },
                    "elevation_certificate-PartIi-FloodInsuranceRateMap:nfipMapNumber": {
                        "value": "123456789",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Flood_Elevation_Certificate API.pdf"
                    },
                    "elevation_certificate-PartIi-FloodInsuranceRateMap:nfipCommunityName": {
                        "value": "SAMPLE COMMUNITY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Flood_Elevation_Certificate API.pdf"
                    },
                    "elevation_certificate-PartIi-FloodInsuranceRateMap:nfipFirmIndexDate": {
                        "value": "01/01/2022",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Flood_Elevation_Certificate API.pdf"
                    },
                    "elevation_certificate-PartIi-FloodInsuranceRateMap:nfipCommunityState": {
                        "value": "NY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Flood_Elevation_Certificate API.pdf"
                    },
                    "elevation_certificate-PartI-General:buildingStreetAddress:addressLine1": {
                        "value": "123 ANYWHERE DRIVE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Flood_Elevation_Certificate API.pdf"
                    },
                    "elevation_certificate-PartI-General:buildingStreetAddress:addressLine2": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Flood_Elevation_Certificate API.pdf"
                    },
                    "elevation_certificate-PartIi-FloodInsuranceRateMap:nfipCommunityCounty": {
                        "value": "SAMPLE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Flood_Elevation_Certificate API.pdf"
                    },
                    "elevation_certificate-PartIi-FloodInsuranceRateMap:nfipCommunityNumber": {
                        "value": "1234567890",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Flood_Elevation_Certificate API.pdf"
                    },
                    "elevation_certificate-PartIii-SurveyorEngineerOrArchitectCertification:certifier'sName": {
                        "value": "SAMPLE DOE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Flood_Elevation_Certificate API.pdf"
                    },
                    "elevation_certificate-PartIii-SurveyorEngineerOrArchitectCertification:certifierCompanyName": {
                        "value": "SAMPLE COMPANY LLC",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Flood_Elevation_Certificate API.pdf"
                    },
                    "elevation_certificate-PartIii-SurveyorEngineerOrArchitectCertification:certifierLicenseNumber": {
                        "value": "123456789",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Flood_Elevation_Certificate API.pdf"
                    }
                },
                "form_config_pk": 122609,
                "tables": []
            }
        ],
        "message": "OK"
    }
}


Updated 7 months ago

FHA Case Query
Gift Letter
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