# ISO Application

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
ACH Processing Application
Auto Loan Statement
Child Care Payment
Coast Guard Standard Travel Order
Credit Card Statement
Credit Report
DAF 899 Request and Authorization for Permanent Change of Station
Department of the Army Permanent Change of Station Order
Department of the Navy Permanent Change of Station Order
Deposited Checks
ISO Application
Letter from the Payor (Alimony or Child Support)
Life Insurance Payment
Marine Corps Basic Order
Merchant Processing Application
Rental Housing Payment
Solar Panel Payment Receipt
Stock Purchase Plan Payment
Student Loan Statement
Wire Remittance Statement
Property
Tax forms
Data types
ISO Application
Suggest Edits

An ISO application provides key information about a business applying for funding. Applicants may complete this form themselves, or their broker may complete it on their behalf.

To use the Upload PDF endpoint for this document, you must use ISO_APP in the form_type parameter. To learn more about how we process ISO applications, click here.

Field descriptions

The following fields are available on this document type:

JSON attribute	Data type	Description
iso_app-Part1-General:brokerName	Text	Broker Name
iso_app-Part1-General:applicationHandwrittenOrTyped	HANDWRITTEN
TYPED	Application Handwritten Or Typed
iso_app-Part1-General:applicationSignedByOwner1?	SIGNED
NOT SIGNED	Application Signed by Owner 1?
iso_app-Part1-General:dateOfSignatureByOwner1	Date	Date of Signature by Owner 1
iso_app-Part1-General:applicationSignedByOwner2?	SIGNED
NOT SIGNED	Application Signed by Owner 2?
iso_app-Part1-General:dateOfSignatureByOwner2	Date	Date of Signature by Owner 2
iso_app-Part1-General:currentDate(IfDateOfSignatureIsNotAvailable)	Date	Current Date
iso_app-Part2-BusinessInfo:companyBilling/MailingAddress:addressLine1	Text	Mailing Address Line 1
iso_app-Part2-BusinessInfo:companyBilling/MailingAddress:addressLine2	Text	Mailing Address Line 2
iso_app-Part2-BusinessInfo:companyBilling/MailingAddress:city	Text	City
iso_app-Part2-BusinessInfo:companyBilling/MailingAddress:state	Text	State
iso_app-Part2-BusinessInfo:companyBilling/MailingAddress:zip	Text	Zip
iso_app-Part2-BusinessInfo:companyLegalBusinessName	Text	Company Legal Business Name
iso_app-Part2-BusinessInfo:dba	Text	DBA
iso_app-Part2-BusinessInfo:businessStartDate	Date	Business Start Date
iso_app-Part2-BusinessInfo:companyFederalTaxId	Text	Company Federal Tax ID
iso_app-Part2-BusinessInfo:typeOfBusinessEntity	SOLE PROPRIETORSHIP
GENERAL PARTNERSHIP
LIMITED PARTNERSHIP
LIMITED LIABILITY PARTNERSHIP (LLP)
LIMITED LIABILITY LIMITED PARTNERSHIP (LLLP)
CORPORATION (CORP)
S-CORP
C-CORP
INCORPORATED (INC)
NONPROFIT CORPORATION
LIMITED LIABILITY COMPANY (LLC)
TRUST
ASSOCIATION
JOINT VENTURE
MUNICIPALITY	Type Of Business Entity
iso_app-Part2-BusinessInfo:companyPhysicalAddress:addressLine1	Text	Company Physical Address
iso_app-Part2-BusinessInfo:companyPhysicalAddress:addressLine2	Text	Company Physical Address
iso_app-Part2-BusinessInfo:companyPhysicalAddress:city	Text	Company Physical Address
iso_app-Part2-BusinessInfo:companyPhysicalAddress:state	Text	Company Physical Address
iso_app-Part2-BusinessInfo:companyPhysicalAddress:zip	Text	Company Physical Address
iso_app-Part2-BusinessInfo:companyPhoneNumber	Text	Company Phone Number
iso_app-Part2-BusinessInfo:companyWebsite	Text	Company Website
iso_app-Part2-BusinessInfo:companyEmail	Text	Company Email
iso_app-Part2-BusinessInfo:industryType	Text	Industry Type
iso_app-Part2-BusinessInfo:naics	Text	NAICS
iso_app-Part2-BusinessInfo:sicCode	Text	SIC Code
iso_app-Part3-FundingInfo:annualRevenue(GrossSales)	Money	Annual Revenue (Gross Sales)
iso_app-Part3-FundingInfo:monthlyRevenue(Average)	Money	Monthly Revenue (Average)
iso_app-Part3-FundingInfo:amountRequested	Money	Amount Requested
iso_app-Part3-FundingInfo:loanPurpose/UseOfProceeds	Text	Loan Purpose / Use Of Proceeds
iso_app-Part3-FundingInfo:outstandingAdvance/Balance/LoanInfoProvided?	YES NO	Is Loan Information Provided?
iso_app-Part3-FundingInfo:current/Remaining/OutstandingBalance	Money	Outstanding Balance
iso_app-Part3-FundingInfo:outstandingAdvance/Balance/LoanLenderName	Text	Lender Name
iso_app-Part4-Owner1Info:firstName	Text	First Name
iso_app-Part4-Owner1Info:lastName	Text	Last Name
iso_app-Part4-Owner1Info:ownershipPercentage	percentage	Ownership Percentage
iso_app-Part4-Owner1Info:homeAddress:addressLine1	Text	Home Address
iso_app-Part4-Owner1Info:homeAddress:addressLine2	Text	Home Address
iso_app-Part4-Owner1Info:homeAddress:city	Text	Home Address
iso_app-Part4-Owner1Info:homeAddress:state	Text	Home Address
iso_app-Part4-Owner1Info:homeAddress:zip	Text	Home Address
iso_app-Part4-Owner1Info:mobilePhone	Text	Mobile Phone
iso_app-Part4-Owner1Info:homePhone	Text	Home Phone
iso_app-Part4-Owner1Info:emailAddress	Text	Email Address
iso_app-Part4-Owner1Info:socialSecurityNumber(Ssn)	Text	Social Security Number (SSN)
iso_app-Part4-Owner1Info:dateOfBirth(Dob)	Date	Date of Birth (DOB)
iso_app-Part5-Owner2Info:firstName	Text	First Name
iso_app-Part5-Owner2Info:lastName	Text	Last Name
iso_app-Part5-Owner2Info:ownershipPercentage	Percentage	Ownership Percentage
iso_app-Part5-Owner2Info:homeAddress:addressLine1	Text	Home Address
iso_app-Part5-Owner2Info:homeAddress:addressLine2	Text	Home Address
iso_app-Part5-Owner2Info:homeAddress:city	Text	Home Address
iso_app-Part5-Owner2Info:homeAddress:state	Text	Home Address
iso_app-Part5-Owner2Info:homeAddress:zip	Text	Home Address
iso_app-Part5-Owner2Info:mobilePhone	Text	Mobile Phone
iso_app-Part5-Owner2Info:homePhone	Text	Home Phone
iso_app-Part5-Owner2Info:emailAddress	Text	Email Address
iso_app-Part5-Owner2Info:socialSecurityNumber(Ssn)	Text	Social Security Number (SSN)
iso_app-Part5-Owner2Info:dateOfBirth(Dob)	Date	Date of Birth (DOB)
Sample document
Sample JSON result
JSON
{
    "status": 200,
    "response": {
        "pk": 30723504,
        "uuid": "4bbc3d5e-0020-4dd3-a4fb-4a32d71344a1",
        "name": "ISO app",
        "created": "2023-03-15T14:11:09Z",
        "created_ts": "2023-03-15T14:11:09Z",
        "verified_pages_count": 1,
        "book_status": "ACTIVE",
        "id": 30723504,
        "forms": [
            {
                "pk": 45010181,
                "uuid": "08df74cf-cf88-45a1-a7a1-9d090973933f",
                "uploaded_doc_pk": 52915466,
                "form_type": "ISO_APP",
                "raw_fields": {
                    "iso_app-Part2-BusinessInfo:dba": {
                        "value": "ABC SAMPLE CORPORATION",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part1-General:brokerName": {
                        "value": "SBG FUNDING",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part2-BusinessInfo:naics": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part4-Owner1Info:lastName": {
                        "value": "SAMPLE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf",
                        "validation_error": "Owner 1 Last Name should not be equal to Owner 2 Last Name. User should review."
                    },
                    "iso_app-Part5-Owner2Info:lastName": {
                        "value": "SAMPLE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part3-FundingInfo:outstandingAdvance/Balance/LoanLenderName": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part4-Owner1Info:firstName": {
                        "value": "JOHN",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part4-Owner1Info:homePhone": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part5-Owner2Info:firstName": {
                        "value": "DAVID",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part5-Owner2Info:homePhone": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part4-Owner1Info:mobilePhone": {
                        "value": "411-444-4444",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf",
                        "irregular_datatype": true,
                        "type_validation_error": "Invalid phone number.",
                        "validation_error": "Owner 1 Mobile Phone should not be equal to Owner 2 Mobile Phone. User should review."
                    },
                    "iso_app-Part5-Owner2Info:mobilePhone": {
                        "value": "411-555-5555",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf",
                        "irregular_datatype": true,
                        "type_validation_error": "Invalid phone number.",
                        "validation_error": "Owner 2 Mobile Phone should not be equal to Company Phone Number. User should review."
                    },
                    "iso_app-Part4-Owner1Info:emailAddress": {
                        "value": "SAMPLE@GMAIL.COM",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part5-Owner2Info:emailAddress": {
                        "value": "FSAMPLE@GMAIL.COM",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part2-BusinessInfo:companyEmail": {
                        "value": "FAKE@GMAIL.COM",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part2-BusinessInfo:industryType": {
                        "value": "MANUFACTURING",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part4-Owner1Info:homeAddress:zip": {
                        "value": "12345",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part5-Owner2Info:homeAddress:zip": {
                        "value": "12345",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part2-BusinessInfo:companyWebsite": {
                        "value": "WWW.ABCSAMPLE.COM",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part3-FundingInfo:amountRequested": {
                        "value": "70000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part4-Owner1Info:dateOfBirth(Dob)": {
                        "value": "04/01/1991",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part4-Owner1Info:homeAddress:city": {
                        "value": "ANYCITY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part5-Owner2Info:dateOfBirth(Dob)": {
                        "value": "04/02/1991",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part5-Owner2Info:homeAddress:city": {
                        "value": "ANYCITY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part4-Owner1Info:homeAddress:state": {
                        "value": "NY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part5-Owner2Info:homeAddress:state": {
                        "value": "NY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part2-BusinessInfo:businessStartDate": {
                        "value": "01/01/2019",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part4-Owner1Info:ownershipPercentage": {
                        "value": "75%",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part5-Owner2Info:ownershipPercentage": {
                        "value": "25%",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part1-General:dateOfSignatureByOwner1": {
                        "value": "07/07/2022",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part1-General:dateOfSignatureByOwner2": {
                        "value": "07/07/2022",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part2-BusinessInfo:companyPhoneNumber": {
                        "value": "222-444-4444",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf",
                        "irregular_datatype": true,
                        "type_validation_error": "Invalid phone number."
                    },
                    "iso_app-Part2-BusinessInfo:companyFederalTaxId": {
                        "value": "12-3456789",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part2-BusinessInfo:typeOfBusinessEntity": {
                        "value": "CORPORATION (CORP)",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part1-General:applicationSignedByOwner1?": {
                        "value": "SIGNED",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part1-General:applicationSignedByOwner2?": {
                        "value": "SIGNED",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part1-General:currentDate(IfDateOfSignatureIsNotAvailable)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part3-FundingInfo:monthlyRevenue(Average)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part4-Owner1Info:homeAddress:addressLine1": {
                        "value": "123 SAMPLE AVENUE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part4-Owner1Info:homeAddress:addressLine2": {
                        "value": "FL 1",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf",
                        "validation_error": "Owner 1 Address Line 2 should not be equal to Owner 2 Address Line 2. User should review."
                    },
                    "iso_app-Part5-Owner2Info:homeAddress:addressLine1": {
                        "value": "111 SAMPLE AVENUE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part5-Owner2Info:homeAddress:addressLine2": {
                        "value": "FL 1",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part4-Owner1Info:socialSecurityNumber(Ssn)": {
                        "value": "222-111-4444",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf",
                        "irregular_datatype": true,
                        "type_validation_error": "Invalid social security.",
                        "validation_error": "Owner 1 SSN should not be equal to Owner 2 SSN. User should review."
                    },
                    "iso_app-Part5-Owner2Info:socialSecurityNumber(Ssn)": {
                        "value": "222-122-1111",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf",
                        "irregular_datatype": true,
                        "type_validation_error": "Invalid social security.",
                        "validation_error": "Owner 2 SSN should not be equal to Company Federal Tax ID. User should review."
                    },
                    "iso_app-Part1-General:applicationHandwrittenOrTyped": {
                        "value": "TYPED",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part2-BusinessInfo:companyLegalBusinessName": {
                        "value": "ABC SAMPLE CORPORATION",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part3-FundingInfo:annualRevenue(GrossSales)": {
                        "value": "100000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part3-FundingInfo:loanPurpose/UseOfProceeds": {
                        "value": "INCREASE THE WORK FORCE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part2-BusinessInfo:companyPhysicalAddress:zip": {
                        "value": "12345",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part2-BusinessInfo:companyPhysicalAddress:city": {
                        "value": "ANYCITY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part2-BusinessInfo:companyPhysicalAddress:state": {
                        "value": "NY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part2-BusinessInfo:companyPhysicalAddress:addressLine1": {
                        "value": "123 FAKE AVENUE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part2-BusinessInfo:companyPhysicalAddress:addressLine2": {
                        "value": "APT. 1",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part2-BusinessInfo:companyBilling/MailingAddress:addressLine1": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part2-BusinessInfo:companyBilling/MailingAddress:addressLine2": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part2-BusinessInfo:companyBilling/MailingAddress:city": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part2-BusinessInfo:companyBilling/MailingAddress:state": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part2-BusinessInfo:companyBilling/MailingAddress:zip": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                  	"iso_app-Part2-BusinessInfo:sicCode": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part3-FundingInfo:outstandingAdvance/Balance/LoanInfoProvided?": {
                        "value": "NO",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    },
                    "iso_app-Part3-FundingInfo:current/Remaining/OutstandingBalance": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "ISO APP (1) (2).pdf"
                    }
                },
                "form_config_pk": 209632,
                "tables": []
            }
        ],
        "book_is_complete": true
    },
    "message": "OK"
}


Updated 7 months ago

Deposited Checks
Letter from the Payor (Alimony or Child Support)
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