# IRS Form 4506-C - IVES Request for Transcript of Tax Return

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
IRS Form 4506-C - IVES Request for Transcript of Tax Return
Suggest Edits

IRS Form 4506-C is used to request tax return information through an authorized Income Verification Express Service (IVES) participant. It is a replacement for the 4506-T, which is being phased out by the IRS.

To use the Upload PDF endpoint for this document, you must use A_4506_C in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
a_4506_c-Part1-General:line1A-NameShownOnTaxReturn	Text	Line 1A - Name Shown On Tax Return
a_4506_c-Part1-General:line1B-FirstSocialSecurityNumberOnTaxReturn	Social Security Number	Line 1B - First Social Security Number On Tax Return
a_4506_c-Part1-General:line2A-IfAJointReturnEnterSpouse'SNameShownOnTaxReturn	Text	Line 2A - If A Joint Return Enter Spouse's Name Shown On Tax Return
a_4506_c-Part1-General:line2B-SecondSocialSecurityNumberOrIndividualTaxpayerIdentificationNumber	Social Security Number	Line 2B - Second Social Security Number Or Individual Taxpayer Identification Number
a_4506_c-Part1-General:line3-CurrentName	Text	Line 3 - Current Name
a_4506_c-Part1-General:line3-CurrentAddress:addressLine1	Text	Line 3 - Current Address
a_4506_c-Part1-General:line3-CurrentAddress:addressLine2	Text	Line 3 - Current Address
a_4506_c-Part1-General:line3-CurrentAddress:city	Text	Line 3 - Current Address
a_4506_c-Part1-General:line3-CurrentAddress:state	State	Line 3 - Current Address
a_4506_c-Part1-General:line3-CurrentAddress:zipCode	ZIP Code	Line 3 - Current Address
a_4506_c-Part1-General:line4-PreviousAddress:addressLine1	Text	Line 4 - Previous Address
a_4506_c-Part1-General:line4-PreviousAddress:addressLine2	Text	Line 4 - Previous Address
a_4506_c-Part1-General:line4-PreviousAddress:city	Text	Line 4 - Previous Address
a_4506_c-Part1-General:line4-PreviousAddress:state	State	Line 4 - Previous Address
a_4506_c-Part1-General:line4-PreviousAddress:zipCode	ZIP Code	Line 4 - Previous Address
a_4506_c-Part1-General:line5A-IvesParticipantName	Text	Line 5A - IVES Participant Name
a_4506_c-Part1-General:line5A-Address:addressLine1	Text	Line 5A - Address
a_4506_c-Part1-General:line5A-Address:addressLine2	Text	Line 5A - Address
a_4506_c-Part1-General:line5A-Address:city	City	Line 5A - Address
a_4506_c-Part1-General:line5A-Address:state	State	Line 5A - Address
a_4506_c-Part1-General:line5A-Address:zipCode	ZIP Code	Line 5A - Address
a_4506_c-Part1-General:line5A-SorMailboxId	Text	Line 5A - SOR Mailbox ID
a_4506_c-Part1-General:line5B-CustomerFileNumber	Text	Line 5B - Customer File Number
a_4506_c-Part2-RequestedInformation:line6-TranscriptRequestedEnterTheTaxFormNumberHere	Integer	Line 6 -Transcript Requested Enter The Tax Form Number Here
a_4506_c-Part2-RequestedInformation:line6A-ReturnTranscriptWhichIncludesMostOfTheLineItemsOfATaxReturnAsFiled	CHECKED, NOT CHECKED	Line 6A - Return Transcript Which Includes Most Of The Line Items Of A Tax Return As Filed
a_4506_c-Part2-RequestedInformation:line6B-AccountTranscriptWhichContainsInformationOnTheFinancialStatus	CHECKED, NOT CHECKED	Line 6B - Account Transcript Which Contains Information On The Financial Status
a_4506_c-Part2-RequestedInformation:line6C-RecordOfAccountWhichProvidesTheMostDetailedInformationAsItIs	CHECKED, NOT CHECKED	Line 6C - Record Of Account Which Provides The Most Detailed Information As It Is
a_4506_c-Part2-RequestedInformation:line7-FormW-2Form1099SeriesForm1098SeriesOrForm5498SeriesTranscript	CHECKED, NOT CHECKED	Line 7 - Form W-2 Form 1099 Series Form 1098 Series Or Form 5498 Series Transcript
a_4506_c-Part2-RequestedInformation:line8-YearOrPeriodRequestedEnterTheEndingDateOfTheTaxYearOrPeriod:i-YearOrPeriodRequested	Date	Line 8 - Year Or Period Requested Enter The Ending Date Of The Tax Year Or Period
a_4506_c-Part2-RequestedInformation:line8-YearOrPeriodRequestedEnterTheEndingDateOfTheTaxYearOrPeriod:ii-YearOrPeriodRequested	Date	Line 8 - Year Or Period Requested Enter The Ending Date Of The Tax Year Or Period
a_4506_c-Part2-RequestedInformation:line8-YearOrPeriodRequestedEnterTheEndingDateOfTheTaxYearOrPeriod:iii-YearOrPeriodRequested	Date	Line 8 - Year Or Period Requested Enter The Ending Date Of The Tax Year Or Period
a_4506_c-Part2-RequestedInformation:line8-YearOrPeriodRequestedEnterTheEndingDateOfTheTaxYearOrPeriod:iv-YearOrPeriodRequested	Date	Line 8 - Year Or Period Requested Enter The Ending Date Of The Tax Year Or Period
a_4506_c-Part2-RequestedInformation:signatoryAttestsThatHe/SheHasReadTheAttestationClauseAndUponSoReadingDeclares	CHECKED, NOT CHECKED	Signatory Attests That He/She Has Read The Attestation Clause And Upon So Reading Declares
a_4506_c-Part3-Signatures:signature	SIGNED, NOT SIGNED	Signature
a_4506_c-Part3-Signatures:date	Date	Date
a_4506_c-Part3-Signatures:phoneNumberOfTaxpayerOnLine1AOr2A	Phone Number	Phone Number Of Taxpayer On Line 1A Or 2A
a_4506_c-Part3-Signatures:print/typeName	Text	Print/Type Name
a_4506_c-Part3-Signatures:title	Text	Title
a_4506_c-Part3-Signatures:spouse'sSignature	SIGNED, NOT SIGNED	Spouse's Signature
a_4506_c-Part3-Signatures:date(Spouse'SSignature)	Date	Date (Spouse's Signature)
a_4506_c-Part3-Signatures:print/typeName(Spouse)	Text	Print/Type Name (Spouse)
Sample document
drive.google.com
4506-C (2021).pdf
Sample JSON result
JSON
{
  "status": 200,
  "response": {
    "pk": 41472282,
    "uuid": "32e9aec4-bfa0-41b5-b7c4-cac14ac1dd82",
    "forms": [
      {
        "pk": 37913607,
        "uuid": "6b1db5ff-b3c4-4131-9cd1-98ce58559004",
        "form_type": "A_4506_C",
        "form_config_pk": 62732,
        "tables": [],
        "raw_fields": {
          "a_4506_c-Part3-Signatures:date": {
            "value": "01/08/2022",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part3-Signatures:title": {
            "value": "MD",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part3-Signatures:signature": {
            "value": "SIGNED",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part1-General:line3-CurrentName": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part3-Signatures:print/typeName": {
            "value": "EVAN SAMPLE",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part1-General:line5A-Address:city": {
            "value": "MAIN CITY",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part1-General:line5A-SorMailboxId": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part1-General:line5A-Address:state": {
            "value": "FL",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part3-Signatures:spouse'sSignature": {
            "value": "NOT SIGNED",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part1-General:line5A-Address:zipCode": {
            "value": "12345",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part1-General:line3-CurrentAddress:city": {
            "value": "FAKE CITY",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part1-General:line5B-CustomerFileNumber": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part3-Signatures:print/typeName(Spouse)": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part1-General:line3-CurrentAddress:state": {
            "value": "CA",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part1-General:line4-PreviousAddress:city": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part1-General:line5A-IvesParticipantName": {
            "value": "TALX XYZ",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part3-Signatures:date(Spouse'SSignature)": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part1-General:line1A-NameShownOnTaxReturn": {
            "value": "ABC PVT. LTD.",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part1-General:line4-PreviousAddress:state": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part1-General:line5A-Address:addressLine1": {
            "value": "HOUSE NO- 123 ROAD",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part1-General:line5A-Address:addressLine2": {
            "value": "SUITE 10",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part1-General:line3-CurrentAddress:zipCode": {
            "value": "12345",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part1-General:line4-PreviousAddress:zipCode": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part1-General:line3-CurrentAddress:addressLine1": {
            "value": "HOUSE NO. 123",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part1-General:line3-CurrentAddress:addressLine2": {
            "value": "APT 1",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part1-General:line4-PreviousAddress:addressLine1": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part1-General:line4-PreviousAddress:addressLine2": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part3-Signatures:phoneNumberOfTaxpayerOnLine1AOr2A": {
            "value": "(123) 456-6789",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf",
            "irregular_datatype": true,
            "type_validation_error": "Invalid phone number."
          },
          "a_4506_c-Part1-General:line1B-FirstSocialSecurityNumberOnTaxReturn": {
            "value": "12-3456789",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf",
            "irregular_datatype": true,
            "type_validation_error": "Invalid social security."
          },
          "a_4506_c-Part1-General:line2A-IfAJointReturnEnterSpouse'SNameShownOnTaxReturn": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part2-RequestedInformation:line6-TranscriptRequestedEnterTheTaxFormNumberHere": {
            "value": "1065",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part1-General:line2B-SecondSocialSecurityNumberOrIndividualTaxpayerIdentificationNumber": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part2-RequestedInformation:line6C-RecordOfAccountWhichProvidesTheMostDetailedInformationAsItIs": {
            "value": "NOT CHECKED",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part2-RequestedInformation:line7-FormW-2Form1099SeriesForm1098SeriesOrForm5498SeriesTranscript": {
            "value": "CHECKED",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part2-RequestedInformation:line6B-AccountTranscriptWhichContainsInformationOnTheFinancialStatus": {
            "value": "CHECKED",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part2-RequestedInformation:line6A-ReturnTranscriptWhichIncludesMostOfTheLineItemsOfATaxReturnAsFiled": {
            "value": "NOT CHECKED",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part2-RequestedInformation:signatoryAttestsThatHe/SheHasReadTheAttestationClauseAndUponSoReadingDeclares": {
            "value": "CHECKED",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part2-RequestedInformation:line8-YearOrPeriodRequestedEnterTheEndingDateOfTheTaxYearOrPeriod:i-YearOrPeriodRequested": {
            "value": "12/31/2019",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part2-RequestedInformation:line8-YearOrPeriodRequestedEnterTheEndingDateOfTheTaxYearOrPeriod:ii-YearOrPeriodRequested": {
            "value": "12/31/2020",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part2-RequestedInformation:line8-YearOrPeriodRequestedEnterTheEndingDateOfTheTaxYearOrPeriod:iv-YearOrPeriodRequested": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          },
          "a_4506_c-Part2-RequestedInformation:line8-YearOrPeriodRequestedEnterTheEndingDateOfTheTaxYearOrPeriod:iii-YearOrPeriodRequested": {
            "value": "12/31/2021",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "4506-C (2021).pdf"
          }
        }
      }
    ]
  },
  "message": "OK"
}


Updated 11 months ago

Gift Letter
IRS Form 4506-T - Request for Transcript of Tax Return
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