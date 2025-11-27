# Merchant Processing Application

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
Data types
Merchant Processing Application
Suggest Edits

This form type is used by businesses to apply for a merchant account that enables them to accept credit and debit card payments. It typically collects information about the business, its owners, banking details, and anticipated transaction volumes.

To use the Upload PDF endpoint for this document, you must use MERCHANT_PROCESSING_APPLICATION in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
merchant_processing_application-Part01-BusinessInformation:dba(DoingBusinessAs)	Text	DBA (Doing Business As)
merchant_processing_application-Part01-BusinessInformation:company(Merchant)LegalName	Text	Company (Merchant) Legal Name
merchant_processing_application-Part01-BusinessInformation:company(Merchant)FederalTaxId	EIN	Company (Merchant) Federal Tax ID
merchant_processing_application-Part01-BusinessInformation:company(Merchant)NumberOfLocations	Text	Company (Merchant) Number Of Locations
merchant_processing_application-Part01-BusinessInformation:company(Merchant)LocationAddress:addressLine1	Text	Company (Merchant) Location Address
merchant_processing_application-Part01-BusinessInformation:company(Merchant)LocationAddress:addressLine2	Text	Company (Merchant) Location Address
merchant_processing_application-Part01-BusinessInformation:company(Merchant)LocationAddress:city	Text	Company (Merchant) Location Address
merchant_processing_application-Part01-BusinessInformation:company(Merchant)LocationAddress:state	State	Company (Merchant) Location Address
merchant_processing_application-Part01-BusinessInformation:company(Merchant)LocationAddress:zip	ZIP Code	Company (Merchant) Location Address
merchant_processing_application-Part01-BusinessInformation:company(Merchant)LocationPhoneNumber	Phone Number	Company (Merchant) Location Phone Number
merchant_processing_application-Part01-BusinessInformation:company(Merchant)LegalAddress:addressLine1	Text	Company (Merchant) Legal Address
merchant_processing_application-Part01-BusinessInformation:company(Merchant)LegalAddress:addressLine2	Text	Company (Merchant) Legal Address
merchant_processing_application-Part01-BusinessInformation:company(Merchant)LegalAddress:city	Text	Company (Merchant) Legal Address
merchant_processing_application-Part01-BusinessInformation:company(Merchant)LegalAddress:state	State	Company (Merchant) Legal Address
merchant_processing_application-Part01-BusinessInformation:company(Merchant)LegalAddress:zip	ZIP Code	Company (Merchant) Legal Address
merchant_processing_application-Part01-BusinessInformation:company(Merchant)LegalPhoneNumber	Phone Number	Company (Merchant) Legal Phone Number
merchant_processing_application-Part01-BusinessInformation:company(Merchant)ContactEmail(S)	Email	Company (Merchant) Contact Email(s)
merchant_processing_application-Part01-BusinessInformation:company(Merchant)WebsiteAddress	Text	Company (Merchant) Website Address
merchant_processing_application-Part01-BusinessInformation:company(Merchant)CustomerServicePhoneNumber	Phone Number	Company (Merchant) Customer Service Phone Number
merchant_processing_application-Part02-BusinessProfile:typeOfOwnership	SOLE PROPRIETOR, PARTNERSHIP, LLC, CORP, GOVERNMENT, TAX EXEMPT, OTHER	Type Of Ownership
merchant_processing_application-Part02-BusinessProfile:typeOfOwnership-IfCorporation:stateOfIncorporation	State	Type Of Ownership - If Corporation
merchant_processing_application-Part02-BusinessProfile:typeOfOwnership-IfOther	Text	Type Of Ownership - If Other
merchant_processing_application-Part02-BusinessProfile:numberOfYearsInBusiness	Integer	Number Of Years In Business
merchant_processing_application-Part02-BusinessProfile:mcc/sicCode	Text	MCC/SIC Code
merchant_processing_application-Part02-BusinessProfile:priorBankruptcies?:yes	CHECKED, NOT CHECKED	Prior Bankruptcies?
merchant_processing_application-Part02-BusinessProfile:priorBankruptcies?:no	CHECKED, NOT CHECKED	Prior Bankruptcies?
merchant_processing_application-Part02-BusinessProfile:name(s)OfPreviousVisa/Mastercard/Discover/AmericanExpressProcessor(S)	Text	Name(s) Of Previous Visa/Mastercard/Discover/American Express Processor(s)
merchant_processing_application-Part02-BusinessProfile:haveYouEverBeenTerminatedFromAcceptingBankcards?:yes	CHECKED, NOT CHECKED	Have You Ever Been Terminated From Accepting Bankcards?
merchant_processing_application-Part02-BusinessProfile:haveYouEverBeenTerminatedFromAcceptingBankcards?:no	CHECKED, NOT CHECKED	Have You Ever Been Terminated From Accepting Bankcards?
merchant_processing_application-Part02-BusinessProfile:haveYouBeenPlacedOnAPaymentChargebackProgramOrHigh-RiskListInTheLast2Years:yes	CHECKED, NOT CHECKED	Have You Been Placed On A Payment Chargeback Program Or High-Risk List In The Last 2 Years
merchant_processing_application-Part02-BusinessProfile:haveYouBeenPlacedOnAPaymentChargebackProgramOrHigh-RiskListInTheLast2Years:no	CHECKED, NOT CHECKED	Have You Been Placed On A Payment Chargeback Program Or High-Risk List In The Last 2 Years
merchant_processing_application-Part02-BusinessProfile:ifYesPleaseDescribe	Text	If Yes Please Describe
merchant_processing_application-Part02-BusinessProfile:descriptionOfProducts/ServicesSold	Text	Description Of Products/Services Sold
merchant_processing_application-Part03-ProcessingProfile:salesMethod:%Swiped	Percentage	Sales Method
merchant_processing_application-Part03-ProcessingProfile:salesMethod:%Imprinted	Percentage	Sales Method
merchant_processing_application-Part03-ProcessingProfile:salesMethod:%Mo/To	Percentage	Sales Method
merchant_processing_application-Part03-ProcessingProfile:salesMethod:%Internet	Percentage	Sales Method
merchant_processing_application-Part03-ProcessingProfile:indicateVisa/Mastercard/Discover/AmexTypesNotToAccept	Text	Indicate Visa/Mastercard/Discover/AMEX Types Not To Accept
merchant_processing_application-Part03-ProcessingProfile:visa/mastercard/discoverAverageTicket	Money	Visa/Mastercard/Discover Average Ticket
merchant_processing_application-Part03-ProcessingProfile:visa/mastercard/discoverMaximumTicket	Money	Visa/Mastercard/Discover Maximum Ticket
merchant_processing_application-Part03-ProcessingProfile:visa/mastercard/discoverMonthlyVolume	Money	Visa/Mastercard/Discover Monthly Volume
merchant_processing_application-Part03-ProcessingProfile:americanExpressAverageTicket	Money	American Express Average Ticket
merchant_processing_application-Part03-ProcessingProfile:americanExpressMaximumTicket	Money	American Express Maximum Ticket
merchant_processing_application-Part03-ProcessingProfile:americanExpressMonthlyVolume	Money	American Express Monthly Volume
merchant_processing_application-Part04-AchProcessing:corporateCreditOrDebit:ccdCredit	CHECKED, NOT CHECKED	Corporate Credit Or Debit
merchant_processing_application-Part04-AchProcessing:corporateCreditOrDebit:ccdDebit	CHECKED, NOT CHECKED	Corporate Credit Or Debit
merchant_processing_application-Part04-AchProcessing:pre-arrangedPaymentAndDeposits:ppdCredit	CHECKED, NOT CHECKED	Pre-Arranged Payment And Deposits
merchant_processing_application-Part04-AchProcessing:pre-arrangedPaymentAndDeposits:ppdDebit	CHECKED, NOT CHECKED	Pre-Arranged Payment And Deposits
merchant_processing_application-Part04-AchProcessing:webInitiatedEntry:webDebit	CHECKED, NOT CHECKED	Web Initiated Entry
merchant_processing_application-Part04-AchProcessing:merchantActivity:averageItems/Month	Integer	Merchant's Activity
merchant_processing_application-Part04-AchProcessing:merchantActivity:averageItemAmount	Money	Merchant's Activity
merchant_processing_application-Part04-AchProcessing:merchantActivity:averageReturns/Month	Integer	Merchant's Activity
merchant_processing_application-Part04-AchProcessing:requestedMaximumLimits:maxTransactionAmount	Money	Requested Maximum Limits
merchant_processing_application-Part04-AchProcessing:requestedMaximumLimits:maxDailyVolume	Money	Requested Maximum Limits
merchant_processing_application-Part04-AchProcessing:requestedMaximumLimits:maxMonthlyVolume	Money	Requested Maximum Limits
merchant_processing_application-Part04-AchProcessing:requestedMaximumLimits:dailyTransactionCount	Integer	Requested Maximum Limits
merchant_processing_application-Part04-AchProcessing:requestedMaximumLimits:monthlyTransactionCount	Integer	Requested Maximum Limits
merchant_processing_application-Part05-Principals/Owners/Partners/Officers1Info:(1)Name(Print)	Text	(1) Name (Print)
merchant_processing_application-Part05-Principals/Owners/Partners/Officers1Info:title	Text	Title
merchant_processing_application-Part05-Principals/Owners/Partners/Officers1Info:equity/ownership	Percentage	Equity/Ownership
merchant_processing_application-Part05-Principals/Owners/Partners/Officers1Info:dateOfBirth	Date	Date Of Birth
merchant_processing_application-Part05-Principals/Owners/Partners/Officers1Info:driverLicense#	Text	Driver's License #
merchant_processing_application-Part05-Principals/Owners/Partners/Officers1Info:state	State	State
merchant_processing_application-Part05-Principals/Owners/Partners/Officers1Info:ssn/itin	Social Security Number	SSN/ITIN
merchant_processing_application-Part05-Principals/Owners/Partners/Officers1Info:homePhone	Phone Number	Home Phone
merchant_processing_application-Part05-Principals/Owners/Partners/Officers1Info:homeAddress:addressLine1	Text	Home Address
merchant_processing_application-Part05-Principals/Owners/Partners/Officers1Info:homeAddress:addressLine2	Text	Home Address
merchant_processing_application-Part05-Principals/Owners/Partners/Officers1Info:homeAddress:city	Text	Home Address
merchant_processing_application-Part05-Principals/Owners/Partners/Officers1Info:homeAddress:state	State	Home Address
merchant_processing_application-Part05-Principals/Owners/Partners/Officers1Info:homeAddress:zip	ZIP Code	Home Address
merchant_processing_application-Part05-Principals/Owners/Partners/Officers2Info:(2)Name(Print)	Text	(2) Name (Print)
merchant_processing_application-Part05-Principals/Owners/Partners/Officers2Info:title	Text	Title
merchant_processing_application-Part05-Principals/Owners/Partners/Officers2Info:equity/ownership	Percentage	Equity/Ownership
merchant_processing_application-Part05-Principals/Owners/Partners/Officers2Info:dateOfBirth	Date	Date Of Birth
merchant_processing_application-Part05-Principals/Owners/Partners/Officers2Info:driverLicense#	Text	Driver's License #
merchant_processing_application-Part05-Principals/Owners/Partners/Officers2Info:state	State	State
merchant_processing_application-Part05-Principals/Owners/Partners/Officers2Info:ssn/itin	Social Security Number	SSN/ITIN
merchant_processing_application-Part05-Principals/Owners/Partners/Officers2Info:homePhone	Phone Number	Home Phone
merchant_processing_application-Part05-Principals/Owners/Partners/Officers2Info:homeAddress:addressLine1	Text	Home Address
merchant_processing_application-Part05-Principals/Owners/Partners/Officers2Info:homeAddress:addressLine2	Text	Home Address
merchant_processing_application-Part05-Principals/Owners/Partners/Officers2Info:homeAddress:city	Text	Home Address
merchant_processing_application-Part05-Principals/Owners/Partners/Officers2Info:homeAddress:state	State	Home Address
merchant_processing_application-Part05-Principals/Owners/Partners/Officers2Info:homeAddress:zip	ZIP Code	Home Address
merchant_processing_application-Part05-Principals/Owners/Partners/Officers3Info:(3)Name(Print)	Text	(3) Name (Print)
merchant_processing_application-Part05-Principals/Owners/Partners/Officers3Info:title	Text	Title
merchant_processing_application-Part05-Principals/Owners/Partners/Officers3Info:equity/ownership	Percentage	Equity/Ownership
merchant_processing_application-Part05-Principals/Owners/Partners/Officers3Info:dateOfBirth	Date	Date Of Birth
merchant_processing_application-Part05-Principals/Owners/Partners/Officers3Info:driverLicense#	Text	Driver's License #
merchant_processing_application-Part05-Principals/Owners/Partners/Officers3Info:state	State	State
merchant_processing_application-Part05-Principals/Owners/Partners/Officers3Info:ssn/itin	Social Security Number	SSN/ITIN
merchant_processing_application-Part05-Principals/Owners/Partners/Officers3Info:homePhone	Phone Number	Home Phone
merchant_processing_application-Part05-Principals/Owners/Partners/Officers3Info:homeAddress:addressLine1	Text	Home Address
merchant_processing_application-Part05-Principals/Owners/Partners/Officers3Info:homeAddress:addressLine2	Text	Home Address
merchant_processing_application-Part05-Principals/Owners/Partners/Officers3Info:homeAddress:city	Text	Home Address
merchant_processing_application-Part05-Principals/Owners/Partners/Officers3Info:homeAddress:state	State	Home Address
merchant_processing_application-Part05-Principals/Owners/Partners/Officers3Info:homeAddress:zip	ZIP Code	Home Address
merchant_processing_application-Part05-Principals/Owners/Partners/Officers4Info:(4)Name(Print)	Text	(4) Name (Print)
merchant_processing_application-Part05-Principals/Owners/Partners/Officers4Info:title	Text	Title
merchant_processing_application-Part05-Principals/Owners/Partners/Officers4Info:equity/ownership	Percentage	Equity/Ownership
merchant_processing_application-Part05-Principals/Owners/Partners/Officers4Info:dateOfBirth	Date	Date Of Birth
merchant_processing_application-Part05-Principals/Owners/Partners/Officers4Info:driverLicense#	Text	Driver's License #
merchant_processing_application-Part05-Principals/Owners/Partners/Officers4Info:state	State	State
merchant_processing_application-Part05-Principals/Owners/Partners/Officers4Info:ssn/itin	Social Security Number	SSN/ITIN
merchant_processing_application-Part05-Principals/Owners/Partners/Officers4Info:homePhone	Phone Number	Home Phone
merchant_processing_application-Part05-Principals/Owners/Partners/Officers4Info:homeAddress:addressLine1	Text	Home Address
merchant_processing_application-Part05-Principals/Owners/Partners/Officers4Info:homeAddress:addressLine2	Text	Home Address
merchant_processing_application-Part05-Principals/Owners/Partners/Officers4Info:homeAddress:city	Text	Home Address
merchant_processing_application-Part05-Principals/Owners/Partners/Officers4Info:homeAddress:state	State	Home Address
merchant_processing_application-Part05-Principals/Owners/Partners/Officers4Info:homeAddress:zip	ZIP Code	Home Address
merchant_processing_application-Part06-ControllingPerson:name(Print)	Text	Name (Print)
merchant_processing_application-Part06-ControllingPerson:title	Text	Title
merchant_processing_application-Part06-ControllingPerson:equity/ownership	Percentage	Equity/Ownership
merchant_processing_application-Part06-ControllingPerson:dateOfBirth	Date	Date Of Birth
merchant_processing_application-Part06-ControllingPerson:driverLicense#	Text	Driver's License #
merchant_processing_application-Part06-ControllingPerson:state	State	State
merchant_processing_application-Part06-ControllingPerson:ssn/itin	Social Security Number	SSN/ITIN
merchant_processing_application-Part06-ControllingPerson:homePhone	Phone Number	Home Phone
merchant_processing_application-Part06-ControllingPerson:homeAddress:addressLine1	Text	Home Address
merchant_processing_application-Part06-ControllingPerson:homeAddress:addressLine2	Text	Home Address
merchant_processing_application-Part06-ControllingPerson:homeAddress:city	Text	Home Address
merchant_processing_application-Part06-ControllingPerson:homeAddress:state	State	Home Address
merchant_processing_application-Part06-ControllingPerson:homeAddress:zip	ZIP Code	Home Address
merchant_processing_application-Part07-BankInformation:forDeposits:accountNumber	Integer	For Deposits
merchant_processing_application-Part07-BankInformation:forDeposits:routingNumber	Routing Number	For Deposits
merchant_processing_application-Part07-BankInformation:forFeeDebits:accountNumber	Integer	For Fee Debits
merchant_processing_application-Part07-BankInformation:forFeeDebits:routingNumber	Routing Number	For Fee Debits
merchant_processing_application-Part08-AcquiringBankAndAssociationDisclosure:merchantSignature	SIGNED, NOT SIGNED	Merchant Signature
merchant_processing_application-Part08-AcquiringBankAndAssociationDisclosure:merchantTitle	Text	Merchant Title
merchant_processing_application-Part08-AcquiringBankAndAssociationDisclosure:merchantSignatureDate	Date	Merchant Signature Date
merchant_processing_application-Part09-MerchantAcceptanceAndDeclarations:initialsOfPersonMakingCertification	SIGNED, NOT SIGNED	Initials Of Person Making Certification
merchant_processing_application-Part09-MerchantAcceptanceAndDeclarations:iHaveViewedTheMerchantProcessingAgreement	SIGNED, NOT SIGNED	I Have Viewed The Merchant Processing Agreement
merchant_processing_application-Part09-MerchantAcceptanceAndDeclarations:iHaveViewedTheAchProcessingAgreement	SIGNED, NOT SIGNED	I Have Viewed The ACH Processing Agreement
merchant_processing_application-Part09-MerchantAcceptanceAndDeclarations:owner/officer1Signature	SIGNED, NOT SIGNED	Owner/Officer 1 Signature
merchant_processing_application-Part09-MerchantAcceptanceAndDeclarations:titleOfOwner/Officer1	Text	Title Of Owner/Officer 1
merchant_processing_application-Part09-MerchantAcceptanceAndDeclarations:dateOfOwner/Officer1Signature	Date	Date Of Owner/Officer 1 Signature
merchant_processing_application-Part09-MerchantAcceptanceAndDeclarations:owner/officer2Signature	SIGNED, NOT SIGNED	Owner/Officer 2 Signature
merchant_processing_application-Part09-MerchantAcceptanceAndDeclarations:titleOfOwner/Officer2	Text	Title Of Owner/Officer 2
merchant_processing_application-Part09-MerchantAcceptanceAndDeclarations:dateOfOwner/Officer2Signature	Date	Date Of Owner/Officer 2 Signature
merchant_processing_application-Part10-PersonalGuarantee:guarantor1Signature	SIGNED, NOT SIGNED	Guarantor 1 Signature
merchant_processing_application-Part10-PersonalGuarantee:titleOfGuarantor1	Text	Title Of Guarantor 1
merchant_processing_application-Part10-PersonalGuarantee:dateOfGuarantor1Signature	Date	Date Of Guarantor 1 Signature
merchant_processing_application-Part10-PersonalGuarantee:guarantor2Signature	SIGNED, NOT SIGNED	Guarantor 2 Signature
merchant_processing_application-Part10-PersonalGuarantee:titleOfGuarantor2	Text	Title Of Guarantor 2
merchant_processing_application-Part10-PersonalGuarantee:dateOfGuarantor2Signature	Date	Date Of Guarantor 2 Signature
Sample document
drive.google.com
MERCHANT PROCESSING APPLICATION.pdf
Sample JSON result
JSON
{
  "pk": 58546719,
  "uuid": "54aafe68-ac99-47b7-9d7d-e6b22a081c4a",
  "name": "MERCHANT_PROCESSING_APPLICATION",
  "created": "2025-02-27T20:19:32Z",
  "created_ts": "2025-02-27T20:19:32Z",
  "verified_pages_count": 4,
  "book_status": "ACTIVE",
  "id": 58546719,
  "forms": [
    {
      "pk": 63726356,
      "uuid": "1fe94f30-c551-4e35-994e-3c2f81ec97a0",
      "uploaded_doc_pk": 90951436,
      "form_type": "MERCHANT_PROCESSING_APPLICATION",
      "form_config_pk": 1159384,
      "tables": [],
      "attribute_data": null,
      "raw_fields": {
        "merchant_processing_application-Part10-PersonalGuarantee:titleOfGuarantor1": {
          "value": "CEO",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part10-PersonalGuarantee:titleOfGuarantor2": {
          "value": "CO",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part10-PersonalGuarantee:guarantor1Signature": {
          "value": "SIGNED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part10-PersonalGuarantee:guarantor2Signature": {
          "value": "SIGNED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part10-PersonalGuarantee:dateOfGuarantor1Signature": {
          "value": "07/09/2024",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part10-PersonalGuarantee:dateOfGuarantor2Signature": {
          "value": "07/09/2024",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part08-AcquiringBankAndAssociationDisclosure:merchantTitle": {
          "value": "CEO",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part08-AcquiringBankAndAssociationDisclosure:merchantSignature": {
          "value": "SIGNED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part09-MerchantAcceptanceAndDeclarations:titleOfOwner/Officer1": {
          "value": "CEO",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part09-MerchantAcceptanceAndDeclarations:titleOfOwner/Officer2": {
          "value": "CO",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part09-MerchantAcceptanceAndDeclarations:owner/officer1Signature": {
          "value": "SIGNED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part09-MerchantAcceptanceAndDeclarations:owner/officer2Signature": {
          "value": "SIGNED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part08-AcquiringBankAndAssociationDisclosure:merchantSignatureDate": {
          "value": "07/09/2024",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part09-MerchantAcceptanceAndDeclarations:dateOfOwner/Officer1Signature": {
          "value": "07/09/2024",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part09-MerchantAcceptanceAndDeclarations:dateOfOwner/Officer2Signature": {
          "value": "07/09/2024",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part09-MerchantAcceptanceAndDeclarations:initialsOfPersonMakingCertification": {
          "value": "SIGNED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part09-MerchantAcceptanceAndDeclarations:iHaveViewedTheAchProcessingAgreement": {
          "value": "SIGNED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part03-ProcessingProfile:indicateVisa/Mastercard/Discover/AmexTypesNotToAccept": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part09-MerchantAcceptanceAndDeclarations:iHaveViewedTheMerchantProcessingAgreement": {
          "value": "SIGNED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part06-ControllingPerson:state": {
          "value": "CA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part06-ControllingPerson:title": {
          "value": "CEO",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part06-ControllingPerson:ssn/itin": {
          "value": "234-45-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part06-ControllingPerson:homePhone": {
          "value": "(234) 567-1234",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part06-ControllingPerson:dateOfBirth": {
          "value": "01/01/1970",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part06-ControllingPerson:name(Print)": {
          "value": "HENDRIK SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part06-ControllingPerson:homeAddress:zip": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part06-ControllingPerson:driverLicense#": {
          "value": "C123456",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part06-ControllingPerson:equity/ownership": {
          "value": "50%",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part06-ControllingPerson:homeAddress:city": {
          "value": "ANYCITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part06-ControllingPerson:homeAddress:state": {
          "value": "CA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part07-BankInformation:forDeposits:accountNumber": {
          "value": "23456789123",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part07-BankInformation:forDeposits:routingNumber": {
          "value": "123456789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part06-ControllingPerson:homeAddress:addressLine1": {
          "value": "123 MAIN FAKE STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part06-ControllingPerson:homeAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part07-BankInformation:forFeeDebits:accountNumber": {
          "value": "23456789123",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part07-BankInformation:forFeeDebits:routingNumber": {
          "value": "123456789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers1Info:state": {
          "value": "CA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers1Info:title": {
          "value": "CEO",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers2Info:state": {
          "value": "CA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers2Info:title": {
          "value": "CO",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers3Info:state": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers3Info:title": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers4Info:state": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers4Info:title": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers1Info:ssn/itin": {
          "value": "234-45-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers2Info:ssn/itin": {
          "value": "234-54-1234",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers3Info:ssn/itin": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers4Info:ssn/itin": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers1Info:homePhone": {
          "value": "(234) 567-1234",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers2Info:homePhone": {
          "value": "234-123-4567",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0,
          "irregular_datatype": true,
          "type_validation_error": "Invalid phone number."
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers3Info:homePhone": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers4Info:homePhone": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers1Info:dateOfBirth": {
          "value": "01/01/1970",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers2Info:dateOfBirth": {
          "value": "01/12/1972",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers3Info:dateOfBirth": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers4Info:dateOfBirth": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers1Info:(1)Name(Print)": {
          "value": "HENDRIK SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers2Info:(2)Name(Print)": {
          "value": "AMASA SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers3Info:(3)Name(Print)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers4Info:(4)Name(Print)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers1Info:homeAddress:zip": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers2Info:homeAddress:zip": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers3Info:driverLicense": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers3Info:homeAddress:zip": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers4Info:homeAddress:zip": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers1Info:driverLicense#": {
          "value": "C123456",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers1Info:equity/ownership": {
          "value": "50%",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers1Info:homeAddress:city": {
          "value": "ANYCITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers2Info:driverLicense#": {
          "value": "C234567",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers2Info:equity/ownership": {
          "value": "50%",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers2Info:homeAddress:city": {
          "value": "FAKE CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers3Info:equity/ownership": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers3Info:homeAddress:city": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers4Info:driverLicense#": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers4Info:equity/ownership": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers4Info:homeAddress:city": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers1Info:homeAddress:state": {
          "value": "CA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers2Info:homeAddress:state": {
          "value": "CA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers3Info:homeAddress:state": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers4Info:homeAddress:state": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers1Info:homeAddress:addressLine1": {
          "value": "123 MAIN FAKE STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers1Info:homeAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers2Info:homeAddress:addressLine1": {
          "value": "123 FAKE GRANT AVENUE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers2Info:homeAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers3Info:homeAddress:addressLine1": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers3Info:homeAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers4Info:homeAddress:addressLine1": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part05-Principals/Owners/Partners/Officers4Info:homeAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part02-BusinessProfile:mcc/sicCode": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part02-BusinessProfile:typeOfOwnership": {
          "value": "LLC",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part02-BusinessProfile:ifYesPleaseDescribe": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part03-ProcessingProfile:salesMethod:%Mo/To": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part02-BusinessProfile:priorBankruptcies?:no": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part03-ProcessingProfile:salesMethod:%Swiped": {
          "value": "5%",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part02-BusinessProfile:priorBankruptcies?:yes": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part02-BusinessProfile:numberOfYearsInBusiness": {
          "value": "4",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part02-BusinessProfile:typeOfOwnership-IfOther": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part03-ProcessingProfile:salesMethod:%Internet": {
          "value": "95%",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part01-BusinessInformation:dba(DoingBusinessAs)": {
          "value": "ALLETE SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part03-ProcessingProfile:salesMethod:%Imprinted": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part04-AchProcessing:webInitiatedEntry:webDebit": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part04-AchProcessing:corporateCreditOrDebit:ccdDebit": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part01-BusinessInformation:company(Merchant)LegalName": {
          "value": "ALLETE, SAMPLE LLC",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part03-ProcessingProfile:americanExpressAverageTicket": {
          "value": "150.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part03-ProcessingProfile:americanExpressMaximumTicket": {
          "value": "1500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part03-ProcessingProfile:americanExpressMonthlyVolume": {
          "value": "40000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part04-AchProcessing:corporateCreditOrDebit:ccdCredit": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part01-BusinessInformation:company(Merchant)FederalTaxId": {
          "value": "12-3456789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part02-BusinessProfile:descriptionOfProducts/ServicesSold": {
          "value": "ORGANIC FOOD, HEALTHY FOOD",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part04-AchProcessing:merchantActivity:averageItemAmount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part01-BusinessInformation:company(Merchant)WebsiteAddress": {
          "value": "WWW.SAMPLE.FAKE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part04-AchProcessing:merchantActivity:averageItems/Month": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part04-AchProcessing:requestedMaximumLimits:maxDailyVolume": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part01-BusinessInformation:company(Merchant)ContactEmail(S)": {
          "value": "FAKESAMPLE@GMAIL.COM",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part01-BusinessInformation:company(Merchant)LegalAddress:zip": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part01-BusinessInformation:company(Merchant)LegalPhoneNumber": {
          "value": "(234) 567-2222",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part04-AchProcessing:merchantActivity:averageReturns/Month": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part04-AchProcessing:pre-arrangedPaymentAndDeposits:ppdDebit": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part04-AchProcessing:requestedMaximumLimits:maxMonthlyVolume": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part01-BusinessInformation:company(Merchant)LegalAddress:city": {
          "value": "FAKE CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part01-BusinessInformation:company(Merchant)NumberOfLocations": {
          "value": "2",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part04-AchProcessing:pre-arrangedPaymentAndDeposits:ppdCredit": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part01-BusinessInformation:company(Merchant)LegalAddress:state": {
          "value": "CA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part03-ProcessingProfile:visa/mastercard/discoverAverageTicket": {
          "value": "150.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part03-ProcessingProfile:visa/mastercard/discoverMaximumTicket": {
          "value": "1500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part03-ProcessingProfile:visa/mastercard/discoverMonthlyVolume": {
          "value": "40000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part01-BusinessInformation:company(Merchant)LocationAddress:zip": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part01-BusinessInformation:company(Merchant)LocationPhoneNumber": {
          "value": "(234) 567-1234",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part01-BusinessInformation:company(Merchant)LocationAddress:city": {
          "value": "ANYCITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part04-AchProcessing:requestedMaximumLimits:maxTransactionAmount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part01-BusinessInformation:company(Merchant)LocationAddress:state": {
          "value": "CA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part04-AchProcessing:requestedMaximumLimits:dailyTransactionCount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part04-AchProcessing:requestedMaximumLimits:monthlyTransactionCount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part01-BusinessInformation:company(Merchant)LegalAddress:addressLine1": {
          "value": "123 FAKE GRANT AVENUE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part01-BusinessInformation:company(Merchant)LegalAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part01-BusinessInformation:company(Merchant)CustomerServicePhoneNumber": {
          "value": "(234) 567-4321",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part01-BusinessInformation:company(Merchant)LocationAddress:addressLine1": {
          "value": "123 MAIN FAKE STREET UT",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part01-BusinessInformation:company(Merchant)LocationAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part02-BusinessProfile:typeOfOwnership-IfCorporation:stateOfIncorporation": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part02-BusinessProfile:haveYouEverBeenTerminatedFromAcceptingBankcards?:no": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part02-BusinessProfile:haveYouEverBeenTerminatedFromAcceptingBankcards?:yes": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part02-BusinessProfile:name(s)OfPreviousVisa/Mastercard/Discover/AmericanExpressProcessor(S)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part02-BusinessProfile:haveYouBeenPlacedOnAPaymentChargebackProgramOrHigh-RiskListInTheLast2Years:no": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        },
        "merchant_processing_application-Part02-BusinessProfile:haveYouBeenPlacedOnAPaymentChargebackProgramOrHigh-RiskListInTheLast2Years:yes": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "MERCHANT PROCESSING APPLICATION.pdf",
          "confidence": 1.0
        }
      }
    }
  ],
  "book_is_complete": true
}


Updated about 1 month ago

Marine Corps Basic Order
Rental Housing Payment
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