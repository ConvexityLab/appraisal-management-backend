# Standard Flood Hazard Determination Form

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
Standard Flood Hazard Determination Form
Suggest Edits

The Standard Flood Hazard Determination Form (SFHDF) is required for all federally backed loans and is used by lenders to assess the flood risk associated with their building loans. This document helps lenders determine whether a property is situated within a Special Flood Hazard Area (SFHA) as defined by the Federal Emergency Management Agency (FEMA). By evaluating flood risks using the SFHDF, lenders can make informed decisions regarding flood insurance requirements for the properties securing their loans.

To use the Upload PDF endpoint for this document, you must use STANDARD_FLOOD_HAZARD_DETERMINATION_FORM in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
standard_flood_hazard_determination_form-Part1-LoanInformation:1.Lender/ServicerName	Text	1. Lender/Servicer Name
standard_flood_hazard_determination_form-Part1-LoanInformation:1.Lender/ServicerAddress:addressLine1	Text	1. Lender/Servicer Address
standard_flood_hazard_determination_form-Part1-LoanInformation:1.Lender/ServicerAddress:addressLine2	Text	1. Lender/Servicer Address
standard_flood_hazard_determination_form-Part1-LoanInformation:1.Lender/ServicerAddress:city	Text	1. Lender/Servicer Address
standard_flood_hazard_determination_form-Part1-LoanInformation:1.Lender/ServicerAddress:state	State	1. Lender/Servicer Address
standard_flood_hazard_determination_form-Part1-LoanInformation:1.Lender/ServicerAddress:zipCode	ZIP Code	1. Lender/Servicer Address
standard_flood_hazard_determination_form-Part1-LoanInformation:2.CollateralDescription:borrowerName	Text	2. Collateral Description
standard_flood_hazard_determination_form-Part1-LoanInformation:2.CollateralDescription:addressLine1	Text	2. Collateral Description
standard_flood_hazard_determination_form-Part1-LoanInformation:2.CollateralDescription:addressLine2	Text	2. Collateral Description
standard_flood_hazard_determination_form-Part1-LoanInformation:2.CollateralDescription:city	Text	2. Collateral Description
standard_flood_hazard_determination_form-Part1-LoanInformation:2.CollateralDescription:state	State	2. Collateral Description
standard_flood_hazard_determination_form-Part1-LoanInformation:2.CollateralDescription:zipCode	ZIP Code	2. Collateral Description
standard_flood_hazard_determination_form-Part1-LoanInformation:3.Lender/ServicerId#	Text	3. Lender/Servicer ID #
standard_flood_hazard_determination_form-Part1-LoanInformation:4.LoanIdentifier	Text	4. Loan Identifier
standard_flood_hazard_determination_form-Part1-LoanInformation:5.AmountOfFloodInsuranceRequired	Money	5. Amount Of Flood Insurance Required
standard_flood_hazard_determination_form-Part2-A.CommunityJurisdiction:1.NfipCommunityName	Text	1. NFIP Community Name
standard_flood_hazard_determination_form-Part2-A.CommunityJurisdiction:2.County(Ies)	Text	2. County(ies)
standard_flood_hazard_determination_form-Part2-A.CommunityJurisdiction:3.State	State	3. State
standard_flood_hazard_determination_form-Part2-A.CommunityJurisdiction:4.NfipCommunityNumber	Integer	4. NFIP Community Number
standard_flood_hazard_determination_form-Part3-B.DataAffectingBuilding/MobileHome:1.NfipMapNumberOrCommunity-PanelNumber	Text	1. NFIP Map Number Or Community-Panel Number
standard_flood_hazard_determination_form-Part3-B.DataAffectingBuilding/MobileHome:2.NfipMapPanelEffective/RevisedDate	Date	2. NFIP Map Panel Effective/Revised Date
standard_flood_hazard_determination_form-Part3-B.DataAffectingBuilding/MobileHome:3.IsThereALetterOfMapChange(Lomc)?:no	CHECKED, NOT CHECKED	3. Is There A Letter Of Map Change (LOMC)?
standard_flood_hazard_determination_form-Part3-B.DataAffectingBuilding/MobileHome:3.IsThereALetterOfMapChange(Lomc)?:yes	CHECKED, NOT CHECKED	3. Is There A Letter Of Map Change (LOMC)?
standard_flood_hazard_determination_form-Part3-B.DataAffectingBuilding/MobileHome:3.IsThereALetterOfMapChange(Lomc)?IfYes:date	Date	3. Is There A Letter Of Map Change (LOMC)? If Yes
standard_flood_hazard_determination_form-Part3-B.DataAffectingBuilding/MobileHome:3.IsThereALetterOfMapChange(Lomc)?IfYes:caseNo.	Text	3. Is There A Letter Of Map Change (LOMC)? If Yes
standard_flood_hazard_determination_form-Part3-B.DataAffectingBuilding/MobileHome:4.FloodZone	Text	4. Flood Zone
standard_flood_hazard_determination_form-Part3-B.DataAffectingBuilding/MobileHome:5.NoNfipMap	Text	5. No NFIP Map
standard_flood_hazard_determination_form-Part4-C.FederalFloodInsuranceAvailability:1.FederalFloodInsuranceIsAvailable(CommunityParticipatesInTheNfip)	CHECKED, NOT CHECKED	1. Federal Flood Insurance Is Available (Community Participates In The NFIP)
standard_flood_hazard_determination_form-Part4-C.FederalFloodInsuranceAvailability:1.RegularProgram	CHECKED, NOT CHECKED	1. Regular Program
standard_flood_hazard_determination_form-Part4-C.FederalFloodInsuranceAvailability:1.EmergencyProgramOfNfip	CHECKED, NOT CHECKED	1. Emergency Program Of NFIP
standard_flood_hazard_determination_form-Part4-C.FederalFloodInsuranceAvailability:2.FederalFloodInsuranceIsNotAvailable(CommunityDoesNotParticipateInTheNfip)	CHECKED, NOT CHECKED	2. Federal Flood Insurance Is Not Available (Community Does Not Participate In The NFIP)
standard_flood_hazard_determination_form-Part4-C.FederalFloodInsuranceAvailability:3.Building/MobileHomeIsInACoastalBarrierResourcesArea(Cbra)	CHECKED, NOT CHECKED	3. Building/Mobile Home Is In A Coastal Barrier Resources Area (CBRA)
standard_flood_hazard_determination_form-Part4-C.FederalFloodInsuranceAvailability:cbra/opaDesignationDate	Date	CBRA/OPA Designation Date
standard_flood_hazard_determination_form-Part5-D.DeterminationAndE.Comments:isBuilding/MobileHomeInSpecialFloodHazardArea?:yes	CHECKED, NOT CHECKED	Is Building/Mobile Home In Special Flood Hazard Area?
standard_flood_hazard_determination_form-Part5-D.DeterminationAndE.Comments:isBuilding/MobileHomeInSpecialFloodHazardArea?:no	CHECKED, NOT CHECKED	Is Building/Mobile Home In Special Flood Hazard Area?
standard_flood_hazard_determination_form-Part5-D.DeterminationAndE.Comments:e.Comments(Optional)	Text	E. Comments (Optional)
standard_flood_hazard_determination_form-Part6-F.Preparer'SInformation:preparer'sName	Text	Preparer's Name
standard_flood_hazard_determination_form-Part6-F.Preparer'SInformation:preparer'sAddress:addressLine1	Text	Preparer's Address
standard_flood_hazard_determination_form-Part6-F.Preparer'SInformation:preparer'sAddress:addressLine2	Text	Preparer's Address
standard_flood_hazard_determination_form-Part6-F.Preparer'SInformation:preparer'sAddress:city	Text	Preparer's Address
standard_flood_hazard_determination_form-Part6-F.Preparer'SInformation:preparer'sAddress:state	State	Preparer's Address
standard_flood_hazard_determination_form-Part6-F.Preparer'SInformation:preparer'sAddress:zipCode	ZIP Code	Preparer's Address
standard_flood_hazard_determination_form-Part6-F.Preparer'SInformation:preparer'sTelephoneNumber	Phone Number	Preparer's Telephone Number
standard_flood_hazard_determination_form-Part6-F.Preparer'SInformation:dateOfDetermination	Date	Date Of Determination
Sample document
drive.google.com
Standard Flood Hazard Determination Form.pdf
Sample JSON result
JSON
{
  "pk": 50120864,
  "uuid": "f6e649f4-f287-4432-a884-8896e84e7aaa",
  "name": "Standard Flood Hazard Determination",
  "created": "2024-05-06T21:08:24Z",
  "created_ts": "2024-05-06T21:08:24Z",
  "verified_pages_count": 1,
  "book_status": "ACTIVE",
  "id": 50120864,
  "forms": [
    {
      "pk": 55014911,
      "uuid": "4957b4fe-a81a-47db-9634-ee43cbb8b171",
      "uploaded_doc_pk": 70983137,
      "form_type": "STANDARD_FLOOD_HAZARD_DETERMINATION_FORM",
      "raw_fields": {
        "standard_flood_hazard_determination_form-Part2-A.CommunityJurisdiction:3.State": {
          "value": "CA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part1-LoanInformation:4.LoanIdentifier": {
          "value": "1234567ABC",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part1-LoanInformation:3.Lender/ServicerId#": {
          "value": "ABC123456",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part1-LoanInformation:1.Lender/ServicerName": {
          "value": "ALL STATE LENDER SERVICE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part2-A.CommunityJurisdiction:2.County(Ies)": {
          "value": "BROWARD",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part6-F.Preparer'SInformation:preparer'sName": {
          "value": "JOHN DOE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part2-A.CommunityJurisdiction:1.NfipCommunityName": {
          "value": "CALIFORNIA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part6-F.Preparer'SInformation:dateOfDetermination": {
          "value": "02/01/2024",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part1-LoanInformation:2.CollateralDescription:city": {
          "value": "CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part1-LoanInformation:1.Lender/ServicerAddress:city": {
          "value": "CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part1-LoanInformation:2.CollateralDescription:state": {
          "value": "CA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part2-A.CommunityJurisdiction:4.NfipCommunityNumber": {
          "value": "123456789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part1-LoanInformation:1.Lender/ServicerAddress:state": {
          "value": "CA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part3-B.DataAffectingBuilding/MobileHome:4.FloodZone": {
          "value": "X",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part3-B.DataAffectingBuilding/MobileHome:5.NoNfipMap": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part6-F.Preparer'SInformation:preparer'sAddress:city": {
          "value": "CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part1-LoanInformation:2.CollateralDescription:zipCode": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part6-F.Preparer'SInformation:preparer'sAddress:state": {
          "value": "CA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part1-LoanInformation:1.Lender/ServicerAddress:zipCode": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part1-LoanInformation:5.AmountOfFloodInsuranceRequired": {
          "value": "12000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part5-D.DeterminationAndE.Comments:e.Comments(Optional)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part6-F.Preparer'SInformation:preparer'sAddress:zipCode": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part6-F.Preparer'SInformation:preparer'sTelephoneNumber": {
          "value": "(888) 888-8888",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part1-LoanInformation:2.CollateralDescription:addressLine1": {
          "value": "123 FAKE STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part1-LoanInformation:2.CollateralDescription:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part1-LoanInformation:2.CollateralDescription:borrowerName": {
          "value": "JOHN SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part4-C.FederalFloodInsuranceAvailability:1.RegularProgram": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part1-LoanInformation:1.Lender/ServicerAddress:addressLine1": {
          "value": "123 AVENUE STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part1-LoanInformation:1.Lender/ServicerAddress:addressLine2": {
          "value": "SUITE 1",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part6-F.Preparer'SInformation:preparer'sAddress:addressLine1": {
          "value": "123 STREET AVENUE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part6-F.Preparer'SInformation:preparer'sAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part4-C.FederalFloodInsuranceAvailability:cbra/opaDesignationDate": {
          "value": "01/01/2024",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part4-C.FederalFloodInsuranceAvailability:1.EmergencyProgramOfNfip": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part3-B.DataAffectingBuilding/MobileHome:2.NfipMapPanelEffective/RevisedDate": {
          "value": "01/01/2024",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part3-B.DataAffectingBuilding/MobileHome:3.IsThereALetterOfMapChange(Lomc)?:no": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part3-B.DataAffectingBuilding/MobileHome:1.NfipMapNumberOrCommunity-PanelNumber": {
          "value": "12ABC123AB",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part3-B.DataAffectingBuilding/MobileHome:3.IsThereALetterOfMapChange(Lomc)?:yes": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part5-D.DeterminationAndE.Comments:isBuilding/MobileHomeInSpecialFloodHazardArea?:no": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part3-B.DataAffectingBuilding/MobileHome:3.IsThereALetterOfMapChange(Lomc)?IfYes:date": {
          "value": "01/01/2024",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part5-D.DeterminationAndE.Comments:isBuilding/MobileHomeInSpecialFloodHazardArea?:yes": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part3-B.DataAffectingBuilding/MobileHome:3.IsThereALetterOfMapChange(Lomc)?IfYes:caseNo.": {
          "value": "12345678",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part4-C.FederalFloodInsuranceAvailability:3.Building/MobileHomeIsInACoastalBarrierResourcesArea(Cbra)": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part4-C.FederalFloodInsuranceAvailability:1.FederalFloodInsuranceIsAvailable(CommunityParticipatesInTheNfip)": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        },
        "standard_flood_hazard_determination_form-Part4-C.FederalFloodInsuranceAvailability:2.FederalFloodInsuranceIsNotAvailable(CommunityDoesNotParticipateInTheNfip)": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Standard Flood Hazard Determination Form.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 545859,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Private Mortgage Payment
Title Insurance Policy
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