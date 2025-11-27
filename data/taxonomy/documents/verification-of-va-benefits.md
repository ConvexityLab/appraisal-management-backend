# VA 26-8937 Verification of VA Benefits

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
VA 26-8937 Verification of VA Benefits
Suggest Edits

This is a document that is used by lenders authorized to close VA-guaranteed loans as a means of obtaining information on any existing benefit-related indebtedness of veteran home loan applicants.

To use the Upload PDF endpoint for this document, you must use VA_26_8937_VERIFICATION_OF_VA_BENEFITS in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
va_26_8937_verification_of_va_benefits-Part1-General:lenderName	Text	Lender Name
va_26_8937_verification_of_va_benefits-Part1-General:lenderAddress:addressLine1	Text	Lender Address
va_26_8937_verification_of_va_benefits-Part1-General:lenderAddress:addressLine2	Text	Lender Address
va_26_8937_verification_of_va_benefits-Part1-General:lenderAddress:city	Text	Lender Address
va_26_8937_verification_of_va_benefits-Part1-General:lenderAddress:state	State	Lender Address
va_26_8937_verification_of_va_benefits-Part1-General:lenderAddress:zipCode	ZIP Code	Lender Address
va_26_8937_verification_of_va_benefits-Part2-Box1-6:nameOfVeteran(FirstMiddleLast)	Text	Name Of Veteran (First Middle Last)
va_26_8937_verification_of_va_benefits-Part2-Box1-6:currentAddressOfVeteran:addressLine1	Text	Current Address Of Veteran
va_26_8937_verification_of_va_benefits-Part2-Box1-6:currentAddressOfVeteran:addressLine2	Text	Current Address Of Veteran
va_26_8937_verification_of_va_benefits-Part2-Box1-6:currentAddressOfVeteran:city	Text	Current Address Of Veteran
va_26_8937_verification_of_va_benefits-Part2-Box1-6:currentAddressOfVeteran:state	State	Current Address Of Veteran
va_26_8937_verification_of_va_benefits-Part2-Box1-6:currentAddressOfVeteran:zipCode	ZIP Code	Current Address Of Veteran
va_26_8937_verification_of_va_benefits-Part2-Box1-6:dateOfBirth	Date	Date Of Birth
va_26_8937_verification_of_va_benefits-Part2-Box1-6:vaClaimFolderNumber(C-FileNo.IfKnown)	Text	VA Claim Folder Number (C-File No. If Known)
va_26_8937_verification_of_va_benefits-Part2-Box1-6:socialSecurityNumber	Social Security Number	Social Security Number
va_26_8937_verification_of_va_benefits-Part2-Box1-6:serviceNumber(IfDifferentFromSocialSecurityNumber)	Integer	Service Number (If Different From Social Security Number)
va_26_8937_verification_of_va_benefits-Part3-Box7-10:iHerebyCertifyThatIDoHaveAVaBenefit-RelatedIndebtednessToMyKnowledge	CHECKED, NOT CHECKED	I Hereby Certify That I Do Have A VA Benefit-Related Indebtedness To My Knowledge
va_26_8937_verification_of_va_benefits-Part3-Box7-10:iHerebyCertifyThatIDoNotHaveAVaBenefit-RelatedIndebtednessToMyKnowledge	CHECKED, NOT CHECKED	I Hereby Certify That I Do Not Have A VA Benefit-Related Indebtedness To My Knowledge
va_26_8937_verification_of_va_benefits-Part3-Box7-10:iHerebyCertifyThatIHaveFiledAClaimForVaDisabilityBenefitsPrior	CHECKED, NOT CHECKED	I Hereby Certify That I Have Filed A Claim For VA Disability Benefits Prior
va_26_8937_verification_of_va_benefits-Part3-Box7-10:iHerebyCertifyThatIHaveNotFiledAClaimForVaDisabilityBenefitsPrior	CHECKED, NOT CHECKED	I Hereby Certify That I Have Not Filed A Claim For VA Disability Benefits Prior
va_26_8937_verification_of_va_benefits-Part3-Box7-10:signatureOfVeteran(SignInInk)	SIGNED, NOT SIGNED	Signature Of Veteran (Sign In Ink)
va_26_8937_verification_of_va_benefits-Part3-Box7-10:dateSigned	Date	Date Signed
va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:theAboveNamedVeteranDoesNotHaveAVaBenefit-RelatedIndebtedness	CHECKED, NOT CHECKED	The Above Named Veteran Does Not Have A VA Benefit-Related Indebtedness
va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:theVeteranHasTheFollowingVaBenefit-RelatedIndebtedness	CHECKED, NOT CHECKED	The Veteran Has The Following VA Benefit-Related Indebtedness
va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:typeOfDebt(S)-Line1	Text	Type Of Debt(s) - Line 1
va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:amountOfDebt(S)-Line1	Money	Amount Of Debt(s) - Line 1
va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:typeOfDebt(S)-Line2	Text	Type Of Debt(s) - Line 2
va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:amountOfDebt(S)-Line2	Money	Amount Of Debt(s) - Line 2
va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:termOfRepaymentPlan(IfAny)	Text	Term Of Repayment Plan (If Any)
va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:veteranIsExemptFromFundingFeeDueToReceiptOfService-ConnectedDisability	CHECKED, NOT CHECKED	Veteran Is Exempt From Funding Fee Due To Receipt Of Service-Connected Disability
va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:service-connectedDisabilityCompensationOf$	Money	Service-Connected Disability Compensation Of $
va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:veteranIsExemptFromFundingFeeDueToEntitlementToVaCompensationBenefits	CHECKED, NOT CHECKED	Veteran Is Exempt From Funding Fee Due To Entitlement To VA Compensation Benefits
va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:veteranIsNotExemptFromFundingFeeDueToReceiptOfNonService-Connected	CHECKED, NOT CHECKED	Veteran Is Not Exempt From Funding Fee Due To Receipt Of Non Service-Connected
va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:service-connected-connectedPensionOf$	Money	Service-Connected-Connected Pension Of $
va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:veteranHasBeenRatedIncompetentByVaLoanApplicationWillRequirePriorApproval	CHECKED, NOT CHECKED	Veteran Has Been Rated Incompetent By VA Loan Application Will Require Prior Approval
va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:insufficientInformationVaCannotIdentifyTheVeteranWithTheInformationGiven	CHECKED, NOT CHECKED	Insufficient Information VA Cannot Identify The Veteran With The Information Given
va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:signatureOfAuthorizedAgent(SignInInk)	SIGNED, NOT SIGNED	Signature Of Authorized Agent (Sign In Ink)
va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:dateSigned	Date	Date Signed
Sample document
drive.google.com
VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf
Sample JSON result
JSON
{
  "pk": 49077239,
  "uuid": "30a5da28-a7bc-46cc-ac1a-557e125f8e74",
  "name": "VA_26_8937_VERIFICATION_OF_VA_BENEFITS",
  "created": "2024-04-16T15:06:51Z",
  "created_ts": "2024-04-16T15:06:51Z",
  "verified_pages_count": 1,
  "book_status": "ACTIVE",
  "id": 49077239,
  "forms": [
    {
      "pk": 54510078,
      "uuid": "bfb828a2-1c2e-4e03-ba86-e25ecc6e87e4",
      "uploaded_doc_pk": 69949058,
      "form_type": "VA_26_8937_VERIFICATION_OF_VA_BENEFITS",
      "raw_fields": {
        "va_26_8937_verification_of_va_benefits-Part1-General:lenderName": {
          "value": "JONE SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part2-Box1-6:dateOfBirth": {
          "value": "03/12/1990",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part3-Box7-10:dateSigned": {
          "value": "03/20/2024",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:dateSigned": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part1-General:lenderAddress:city": {
          "value": "ANY CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part1-General:lenderAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part2-Box1-6:socialSecurityNumber": {
          "value": "123-45-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part1-General:lenderAddress:zipCode": {
          "value": "12345-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:typeOfDebt(S)-Line1": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:typeOfDebt(S)-Line2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part1-General:lenderAddress:addressLine1": {
          "value": "123 ANY STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part1-General:lenderAddress:addressLine2": {
          "value": "APT 12",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:amountOfDebt(S)-Line1": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:amountOfDebt(S)-Line2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part2-Box1-6:currentAddressOfVeteran:city": {
          "value": "ANY CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part2-Box1-6:currentAddressOfVeteran:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part2-Box1-6:nameOfVeteran(FirstMiddleLast)": {
          "value": "JENNY M SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part3-Box7-10:signatureOfVeteran(SignInInk)": {
          "value": "SIGNED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part2-Box1-6:currentAddressOfVeteran:zipCode": {
          "value": "12345-6780",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:termOfRepaymentPlan(IfAny)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part2-Box1-6:currentAddressOfVeteran:addressLine1": {
          "value": "122 ANY STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part2-Box1-6:currentAddressOfVeteran:addressLine2": {
          "value": "APT 10",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part2-Box1-6:vaClaimFolderNumber(C-FileNo.IfKnown)": {
          "value": "AB12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:service-connected-connectedPensionOf$": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:signatureOfAuthorizedAgent(SignInInk)": {
          "value": "NOT SIGNED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:service-connectedDisabilityCompensationOf$": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part2-Box1-6:serviceNumber(IfDifferentFromSocialSecurityNumber)": {
          "value": "11111111",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:theVeteranHasTheFollowingVaBenefit-RelatedIndebtedness": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part3-Box7-10:iHerebyCertifyThatIHaveFiledAClaimForVaDisabilityBenefitsPrior": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part3-Box7-10:iHerebyCertifyThatIHaveNotFiledAClaimForVaDisabilityBenefitsPrior": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:theAboveNamedVeteranDoesNotHaveAVaBenefit-RelatedIndebtedness": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part3-Box7-10:iHerebyCertifyThatIDoHaveAVaBenefit-RelatedIndebtednessToMyKnowledge": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part3-Box7-10:iHerebyCertifyThatIDoNotHaveAVaBenefit-RelatedIndebtednessToMyKnowledge": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:veteranIsNotExemptFromFundingFeeDueToReceiptOfNonService-Connected": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:veteranIsExemptFromFundingFeeDueToEntitlementToVaCompensationBenefits": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:veteranIsExemptFromFundingFeeDueToReceiptOfService-ConnectedDisability": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:insufficientInformationVaCannotIdentifyTheVeteranWithTheInformationGiven": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        },
        "va_26_8937_verification_of_va_benefits-Part4-ForVaUseOnly:veteranHasBeenRatedIncompetentByVaLoanApplicationWillRequirePriorApproval": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VA_26-8937_VERIFICATION_OF_VA_BENEFITS.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 504307,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Title Insurance Policy
VA Certificate of Eligibility
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