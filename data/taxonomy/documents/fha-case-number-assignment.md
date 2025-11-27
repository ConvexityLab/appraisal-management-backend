# FHA Case Number Assignment

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
FHA Case Number Assignment
Suggest Edits

The FHA Case Number Assignment is the essential first step toward an endorsement for FHA mortgage insurance, and a key factor is a validation of address and borrower information, e.g., Social Security Number and credit history, against official government databases.

To use the Upload PDF endpoint for this document, you must use FHA_CASE_NUMBER_ASSIGNMENT in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
fha_case_number_assignment-Part1-General:loanApplicationId	Text	Loan Application ID
fha_case_number_assignment-Part1-General:isFhaConnectionLogoPresentOnTheForm?	YES, NO	Is FHA Connection Logo Present On The Form?
fha_case_number_assignment-Part1-General:year	Integer	Year
fha_case_number_assignment-Part1-General:caseNumberAssignmentResults	Text	Case Number Assignment Results
fha_case_number_assignment-Part1-General:caseNumberDetails	Text	Case Number Details
fha_case_number_assignment-Part1-General:caseNumberAssignedOnDate	Date	Case Number Assigned on Date
fha_case_number_assignment-Part1-General:fhaCaseNumber	Text	FHA Case Number
fha_case_number_assignment-Part1-General:lenderCaseReferenceNumber	Text	Lender Case Reference Number
fha_case_number_assignment-Part1-General:isThisASponsoredOriginatorCase?	YES, NO	Is This A Sponsored Originator Case?
fha_case_number_assignment-Part1-General:caseType	Text	Case Type
fha_case_number_assignment-Part1-General:constructionCode	Text	Construction Code
fha_case_number_assignment-Part1-General:processingType	Text	Processing Type
fha_case_number_assignment-Part1-General:hudApprovedSecondaryResidence	YES, NO	HUD Approved Secondary Residence
fha_case_number_assignment-Part1-General:adpCode	Integer	ADP Code
fha_case_number_assignment-Part1-General:livingUnits	Integer	Living Units
fha_case_number_assignment-Part1-General:programId	Text	Program ID
fha_case_number_assignment-Part1-General:loanTerm	Text	Loan Term
fha_case_number_assignment-Part2-AdpCodeCharacteristics:amortizationType	Text	Amortization Type
fha_case_number_assignment-Part2-AdpCodeCharacteristics:housingProgram	Text	Housing Program
fha_case_number_assignment-Part2-AdpCodeCharacteristics:propertyType	Text	Property Type
fha_case_number_assignment-Part2-AdpCodeCharacteristics:specialProgram	Text	Special Program
fha_case_number_assignment-Part2-AdpCodeCharacteristics:caseCategory	Text	Case Category
fha_case_number_assignment-Part3-AsRequired:fhaToFhaRefinanceType	Text	FHA to FHA Refinance Type
fha_case_number_assignment-Part3-AsRequired:previousCaseNumber	Text	Previous Case Number
fha_case_number_assignment-Part3-AsRequired:type203K	Text	Type 203K
fha_case_number_assignment-Part3-AsRequired:pudCondoIndicator	Text	PUD Condo Indicator
fha_case_number_assignment-Part3-AsRequired:pudCondoId	Text	PUD Condo ID
fha_case_number_assignment-Part3-AsRequired:siteCondo	Text	Site Condo
fha_case_number_assignment-Part3-AsRequired:monthAndYearCompleted	Text	Month and Year Completed
fha_case_number_assignment-Part3-AsRequired:hecmCounselingCertificateNumber	Text	HECM Counseling Certificate Number
fha_case_number_assignment-Part3-AsRequired:hecmCounselDate	Date	HECM Counsel Date
fha_case_number_assignment-Part4-PropertyAddress:propertyAddressHouseNumber:houseNumber	Text	Property Address House Number
fha_case_number_assignment-Part4-PropertyAddress:propertyAddressUnit:unit	Text	Property Address Unit
fha_case_number_assignment-Part4-PropertyAddress:propertyAddressPre:pre	Text	Property Address Pre
fha_case_number_assignment-Part4-PropertyAddress:propertyAddressStreet:street	Text	Property Address Street
fha_case_number_assignment-Part4-PropertyAddress:propertyAddressType:type	Text	Property Address Type
fha_case_number_assignment-Part4-PropertyAddress:propertyAddressPost:post	Text	Property Address Post
fha_case_number_assignment-Part4-PropertyAddress:propertyAddressCity:city	City	Property Address City
fha_case_number_assignment-Part4-PropertyAddress:propertyAddressState:state	State	Property Address State
fha_case_number_assignment-Part4-PropertyAddress:propertyAddressZipCode:zip	ZIP Code	Property Address Zip Code
fha_case_number_assignment-Part5-BorrowerInformation:borrowerIndicator	CHECKED, NOT CHECKED	Borrower Indicator
fha_case_number_assignment-Part5-BorrowerInformation:borrowerName	Text	Borrower Name
fha_case_number_assignment-Part5-BorrowerInformation:borrowerSocialSecurityNumber(Ssn)	Social Security Number	Borrower Social Security Number (SSN)
fha_case_number_assignment-Part5-BorrowerInformation:borrowerBirthDate	Date	Borrower Birth Date
fha_case_number_assignment-Part5-BorrowerInformation:coborrower1Name	Text	Coborrower 1 Name
fha_case_number_assignment-Part5-BorrowerInformation:coborrower1SocialSecurityNumber(Ssn)	Social Security Number	Coborrower 1 Social Security Number (SSN)
fha_case_number_assignment-Part5-BorrowerInformation:coborrower1BirthDate	Date	Coborrower 1 Birth Date
fha_case_number_assignment-Part5-BorrowerInformation:coborrower2Name	Text	Coborrower 2 Name
fha_case_number_assignment-Part5-BorrowerInformation:coborrower2SocialSecurityNumber(Ssn)	Social Security Number	Coborrower 2 Social Security Number (SSN)
fha_case_number_assignment-Part5-BorrowerInformation:coborrower2BirthDate	Date	Coborrower 2 Birth Date
fha_case_number_assignment-Part5-BorrowerInformation:coborrower3Name	Text	Coborrower 3 Name
fha_case_number_assignment-Part5-BorrowerInformation:coborrower3SocialSecurityNumber(Ssn)	Social Security Number	Coborrower 3 Social Security Number (SSN)
fha_case_number_assignment-Part5-BorrowerInformation:coborrower3BirthDate	Date	Coborrower 3 Birth Date
fha_case_number_assignment-Part5-BorrowerInformation:coborrower4Name	Text	Coborrower 4 Name
fha_case_number_assignment-Part5-BorrowerInformation:coborrower4SocialSecurityNumber(Ssn)	Social Security Number	Coborrower 4 Social Security Number (SSN)
fha_case_number_assignment-Part5-BorrowerInformation:coborrower4BirthDate	Date	Coborrower 4 Birth Date
fha_case_number_assignment-Part6-CaivrsClaim/DefaultData:caivrsSocialSecurityNumber(Ssn)	Social Security Number	CAIVRS Social Security Number (SSN)
fha_case_number_assignment-Part6-CaivrsClaim/DefaultData:caivrsAuthorization	Text	CAIVRS Authorization
fha_case_number_assignment-Part6-CaivrsClaim/DefaultData:caivrsClaims	Text	CAIVRS Claims
fha_case_number_assignment-Part6-CaivrsClaim/DefaultData:caivrsSocialSecurityNumber(Ssn)2	Social Security Number	CAIVRS Social Security Number (SSN) 2
fha_case_number_assignment-Part6-CaivrsClaim/DefaultData:caivrsAuthorization2	Text	CAIVRS Authorization 2
fha_case_number_assignment-Part6-CaivrsClaim/DefaultData:caivrsClaims2	Text	CAIVRS Claims 2
fha_case_number_assignment-Part6-CaivrsClaim/DefaultData:caivrsSocialSecurityNumber(Ssn)3	Social Security Number	CAIVRS Social Security Number (SSN) 3
fha_case_number_assignment-Part6-CaivrsClaim/DefaultData:caivrsAuthorization3	Text	CAIVRS Authorization 3
fha_case_number_assignment-Part6-CaivrsClaim/DefaultData:caivrsClaim3	Text	CAIVRS Claim 3
fha_case_number_assignment-Part6-CaivrsClaim/DefaultData:caivrsSocialSecurityNumber(Ssn)4	Social Security Number	CAIVRS Social Security Number (SSN) 4
fha_case_number_assignment-Part6-CaivrsClaim/DefaultData:caivrsAuthorization4	Text	CAIVRS Authorization 4
fha_case_number_assignment-Part6-CaivrsClaim/DefaultData:caivrsClaims4	Text	CAIVRS Claims 4
fha_case_number_assignment-Part6-CaivrsClaim/DefaultData:caivrsSocialSecurityNumber(Ssn)5	Social Security Number	CAIVRS Social Security Number (SSN) 5
fha_case_number_assignment-Part6-CaivrsClaim/DefaultData:caivrsAuthorization5	Text	CAIVRS Authorization 5
fha_case_number_assignment-Part6-CaivrsClaim/DefaultData:caivrsClaims5	Text	CAIVRS Claims 5
fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOriginalBorrowerName	No trailing commas	Refi Auth Original Borrower Name
fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthPropertyLocatedAt	Text	Refi Auth Property Located At
fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOldTerm	Text	Refi Auth Old Term
fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOriginalPropertyValue	Money	Refi Auth Original Property Value
fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOriginalEndorsementDate	Date	Refi Auth Original Endorsement Date
fha_case_number_assignment-Part7-RefinanceAuthorization:newClosingMonth1	Text	New Closing Month 1
fha_case_number_assignment-Part7-RefinanceAuthorization:newClosingMonth2	Text	New Closing Month 2
fha_case_number_assignment-Part7-RefinanceAuthorization:ufmipEarnedBy1	Money	UFMIP Earned By 1
fha_case_number_assignment-Part7-RefinanceAuthorization:ufmipEarnedBy2	Money	UFMIP Earned By 2
fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOriginalBorrowerName2	No trailing commas	Refi Auth Original Borrower Name 2
fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthPropertyLocatedAt2	Text	Refi Auth Property Located At 2
fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOldTerm2	Text	Refi Auth Old Term 2
fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOriginalPropertyValue2	Money	Refi Auth Original Property Value 2
fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOriginalEndorsementDate2	Date	Refi Auth Original Endorsement Date 2
fha_case_number_assignment-Part7-RefinanceAuthorization:newClosingMonth1ForBorrower2	Text	New Closing Month 1 for Borrower 2
fha_case_number_assignment-Part7-RefinanceAuthorization:newClosingMonth2ForBorrower2	Text	New Closing Month 2 for Borrower 2
fha_case_number_assignment-Part7-RefinanceAuthorization:ufmipEarnedBy1ForBorrower2	Money	UFMIP Earned By 1 for Borrower 2
fha_case_number_assignment-Part7-RefinanceAuthorization:ufmipEarnedBy2ForBorrower2	Money	UFMIP Earned By 2 for Borrower 2
fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOriginalBorrowerName3	No trailing commas	Refi Auth Original Borrower Name 3
fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthPropertyLocatedAt3	Text	Refi Auth Property Located At 3
fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOldTerm3	Text	Refi Auth Old Term 3
fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOriginalPropertyValue3	Money	Refi Auth Original Property Value 3
fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOriginalEndorsementDate3	Date	Refi Auth Original Endorsement Date 3
fha_case_number_assignment-Part7-RefinanceAuthorization:newClosingMonth1ForBorrower3	Text	New Closing Month 1 for Borrower 3
fha_case_number_assignment-Part7-RefinanceAuthorization:newClosingMonth2ForBorrower3	Text	New Closing Month 2 for Borrower 3
fha_case_number_assignment-Part7-RefinanceAuthorization:ufmipEarnedBy1ForBorrower3	Money	UFMIP Earned By 1 for Borrower 3
fha_case_number_assignment-Part7-RefinanceAuthorization:ufmipEarnedBy2ForBorrower3	Money	UFMIP Earned By 2 for Borrower 3
fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOriginalBorrowerName4	No trailing commas	Refi Auth Original Borrower Name 4
fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthPropertyLocatedAt4	Text	Refi Auth Property Located At 4
fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOldTerm4	Text	Refi Auth Old Term 4
fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOriginalPropertyValue4	Money	Refi Auth Original Property Value 4
fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOriginalEndorsementDate4	Date	Refi Auth Original Endorsement Date 4
fha_case_number_assignment-Part7-RefinanceAuthorization:newClosingMonth1ForBorrower4	Text	New Closing Month 1 for Borrower 4
fha_case_number_assignment-Part7-RefinanceAuthorization:newClosingMonth2ForBorrower4	Text	New Closing Month 2 for Borrower 4
fha_case_number_assignment-Part7-RefinanceAuthorization:ufmipEarnedBy1ForBorrower4	Money	UFMIP Earned By 1 for Borrower 4
fha_case_number_assignment-Part7-RefinanceAuthorization:ufmipEarnedBy2ForBorrower4	Money	UFMIP Earned By 2 for Borrower 4
fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOriginalBorrowerName5	No trailing commas	Refi Auth Original Borrower Name 5
fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthPropertyLocatedAt5	Text	Refi Auth Property Located At 5
fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOldTerm5	Text	Refi Auth Old Term 5
fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOriginalPropertyValue5	Money	Refi Auth Original Property Value 5
fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOriginalEndorsementDate5	Date	Refi Auth Original Endorsement Date 5
fha_case_number_assignment-Part7-RefinanceAuthorization:newClosingMonth1ForBorrower5	Text	New Closing Month 1 for Borrower 5
fha_case_number_assignment-Part7-RefinanceAuthorization:newClosingMonth2ForBorrower5	Text	New Closing Month 2 for Borrower 5
fha_case_number_assignment-Part7-RefinanceAuthorization:ufmipEarnedBy1ForBorrower5	Money	UFMIP Earned By 1 for Borrower 5
fha_case_number_assignment-Part7-RefinanceAuthorization:ufmipEarnedBy2ForBorrower5	Money	UFMIP Earned By 2 for Borrower 5
Sample document
drive.google.com
FHA CASE NUMBER ASSIGNMENT - API Sample.pdf
Sample JSON result
JSON
{
   "status":200,
   "response":{
      "pk":30532090,
      "uuid":"d5dd16b1-e889-4aef-9dce-07c6a9aec963",
      "name":"FHA API - re",
      "created":"2023-03-10T19:33:45Z",
      "created_ts":"2023-03-10T19:33:45Z",
      "verified_pages_count":2,
      "book_status":"ACTIVE",
      "id":30532090,
      "forms":[
         {
            "pk":44860597,
            "uuid":"0d0088a1-996c-408a-884b-d591231f7784",
            "uploaded_doc_pk":52729098,
            "form_type":"FHA_CASE_NUMBER_ASSIGNMENT",
            "raw_fields":{
               "fha_case_number_assignment-Part5-BorrowerInformation:borrowerName":{
                  "value":"BODINE, SAMPLE JR",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part5-BorrowerInformation:coborrower1Name":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part5-BorrowerInformation:coborrower2Name":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part5-BorrowerInformation:coborrower3Name":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part5-BorrowerInformation:coborrower4Name":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part6-CaivrsClaim/DefaultData:caivrsClaim3":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part6-CaivrsClaim/DefaultData:caivrsClaims":{
                  "value":"NO CLAIMS/DEFAULTS ON FILE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part5-BorrowerInformation:borrowerBirthDate":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part5-BorrowerInformation:borrowerIndicator":{
                  "value":"CHECKED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part6-CaivrsClaim/DefaultData:caivrsClaims2":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part6-CaivrsClaim/DefaultData:caivrsClaims4":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part6-CaivrsClaim/DefaultData:caivrsClaims5":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:ufmipEarnedBy1":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:ufmipEarnedBy2":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part4-PropertyAddress:propertyAddressPre:pre":{
                  "value":"W",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOldTerm":{
                  "value":"360",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:newClosingMonth1":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:newClosingMonth2":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOldTerm2":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOldTerm3":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOldTerm4":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOldTerm5":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part4-PropertyAddress:propertyAddressCity:city":{
                  "value":"FAKE CITY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part4-PropertyAddress:propertyAddressPost:post":{
                  "value":"B-23",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part4-PropertyAddress:propertyAddressType:type":{
                  "value":"ST",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part4-PropertyAddress:propertyAddressUnit:unit":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part5-BorrowerInformation:coborrower1BirthDate":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part5-BorrowerInformation:coborrower2BirthDate":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part5-BorrowerInformation:coborrower3BirthDate":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part5-BorrowerInformation:coborrower4BirthDate":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part4-PropertyAddress:propertyAddressState:state":{
                  "value":"NV",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part4-PropertyAddress:propertyAddressZipCode:zip":{
                  "value":"89555-0000",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part6-CaivrsClaim/DefaultData:caivrsAuthorization":{
                  "value":"A161616161",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part4-PropertyAddress:propertyAddressStreet:street":{
                  "value":"1ST",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part6-CaivrsClaim/DefaultData:caivrsAuthorization2":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part6-CaivrsClaim/DefaultData:caivrsAuthorization3":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part6-CaivrsClaim/DefaultData:caivrsAuthorization4":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part6-CaivrsClaim/DefaultData:caivrsAuthorization5":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthPropertyLocatedAt":{
                  "value":"123 FAKE STREET, SAMPLE CITY MA 23012",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthPropertyLocatedAt2":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthPropertyLocatedAt3":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthPropertyLocatedAt4":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthPropertyLocatedAt5":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:ufmipEarnedBy1ForBorrower2":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:ufmipEarnedBy1ForBorrower3":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:ufmipEarnedBy1ForBorrower4":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:ufmipEarnedBy1ForBorrower5":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:ufmipEarnedBy2ForBorrower2":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:ufmipEarnedBy2ForBorrower3":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:ufmipEarnedBy2ForBorrower4":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:ufmipEarnedBy2ForBorrower5":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:newClosingMonth1ForBorrower2":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:newClosingMonth1ForBorrower3":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:newClosingMonth1ForBorrower4":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:newClosingMonth1ForBorrower5":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:newClosingMonth2ForBorrower2":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:newClosingMonth2ForBorrower3":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:newClosingMonth2ForBorrower4":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:newClosingMonth2ForBorrower5":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOriginalBorrowerName":{
                  "value":"CLIFFORD SAMPLE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOriginalBorrowerName2":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOriginalBorrowerName3":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOriginalBorrowerName4":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOriginalBorrowerName5":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOriginalPropertyValue":{
                  "value":"7850.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part5-BorrowerInformation:borrowerSocialSecurityNumber(Ssn)":{
                  "value":"123-45-6789",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOriginalPropertyValue2":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOriginalPropertyValue3":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOriginalPropertyValue4":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOriginalPropertyValue5":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part4-PropertyAddress:propertyAddressHouseNumber:houseNumber":{
                  "value":"1234",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOriginalEndorsementDate":{
                  "value":"05/12/2021",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part6-CaivrsClaim/DefaultData:caivrsSocialSecurityNumber(Ssn)":{
                  "value":"123-45-6789",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOriginalEndorsementDate2":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOriginalEndorsementDate3":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOriginalEndorsementDate4":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part7-RefinanceAuthorization:refiAuthOriginalEndorsementDate5":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part5-BorrowerInformation:coborrower1SocialSecurityNumber(Ssn)":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part5-BorrowerInformation:coborrower2SocialSecurityNumber(Ssn)":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part5-BorrowerInformation:coborrower3SocialSecurityNumber(Ssn)":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part5-BorrowerInformation:coborrower4SocialSecurityNumber(Ssn)":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part6-CaivrsClaim/DefaultData:caivrsSocialSecurityNumber(Ssn)2":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part6-CaivrsClaim/DefaultData:caivrsSocialSecurityNumber(Ssn)3":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part6-CaivrsClaim/DefaultData:caivrsSocialSecurityNumber(Ssn)4":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part6-CaivrsClaim/DefaultData:caivrsSocialSecurityNumber(Ssn)5":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part1-General:year":{
                  "value":"2021",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part1-General:adpCode":{
                  "value":"703",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part1-General:caseType":{
                  "value":"REGULAR DE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part1-General:loanTerm":{
                  "value":"360",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part1-General:programId":{
                  "value":"(00)-DEFAULT",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part1-General:livingUnits":{
                  "value":"01",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part3-AsRequired:type203K":{
                  "value":"N/A",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part3-AsRequired:siteCondo":{
                  "value":"N/A",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part1-General:fhaCaseNumber":{
                  "value":"012-3456789",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part3-AsRequired:pudCondoId":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part1-General:processingType":{
                  "value":"N/A",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part1-General:constructionCode":{
                  "value":"EXISTING CONSTRUCTION",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part1-General:caseNumberDetails":{
                  "value":"CASE NUMBER HAS BEEN SUCCESSFULLY ASSIGNED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part1-General:loanApplicationId":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part3-AsRequired:hecmCounselDate":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part3-AsRequired:pudCondoIndicator":{
                  "value":"N/A",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part3-AsRequired:previousCaseNumber":{
                  "value":"NOT ENTERED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part1-General:caseNumberAssignedOnDate":{
                  "value":"06/09/2021",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part3-AsRequired:fhaToFhaRefinanceType":{
                  "value":"NOT STREAMLINE - N/A",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part3-AsRequired:monthAndYearCompleted":{
                  "value":"01/1996",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part1-General:lenderCaseReferenceNumber":{
                  "value":"102345678",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part1-General:caseNumberAssignmentResults":{
                  "value":"SUCCESS",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part2-AdpCodeCharacteristics:caseCategory":{
                  "value":"CONVENTIONAL CASH-OUT FORWARD REFINANCE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part2-AdpCodeCharacteristics:propertyType":{
                  "value":"NOT A CONDOMINIUM",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part1-General:hudApprovedSecondaryResidence":{
                  "value":"NO",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part2-AdpCodeCharacteristics:housingProgram":{
                  "value":"FHA STANDARD MORTGAGE PROGRAM (203B)",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part2-AdpCodeCharacteristics:specialProgram":{
                  "value":"NO SPECIAL PROGRAM",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part1-General:isThisASponsoredOriginatorCase?":{
                  "value":"NO",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part2-AdpCodeCharacteristics:amortizationType":{
                  "value":"FIXED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part1-General:isFhaConnectionLogoPresentOnTheForm?": { 
                  "value": "YES",
                  "is_empty": false,
                  "alias_used": null,
                  "source_filename": "FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               },
               "fha_case_number_assignment-Part3-AsRequired:hecmCounselingCertificateNumber":{
                  "value":"NOT ENTERED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"FHA CASE NUMBER ASSIGNMENT - API Sample (4).pdf"
               }
            },
            "form_config_pk":208588,
            "tables":[
               
            ]
         }
      ],
      "book_is_complete":true
   },
   "message":"OK"
}


Updated 8 months ago

Federal Supporting Statements - Other Deductions
FHA Case Query
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