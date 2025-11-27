# 1003 (2020) - Uniform Residential Loan Application (Additional Borrower)

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
1003 (2020) - Uniform Residential Loan Application (Additional Borrower)
Suggest Edits

An Additional Borrower 1003 is a standardized form used in the mortgage industry to collect information about a secondary borrower who will be included in a mortgage application. The form is officially known as Form 1003, or the Uniform Residential Loan Application, and is used by lenders to assess a borrower's creditworthiness and ability to repay a loan.

To use the Upload PDF endpoint for this document, you must use ADDITIONAL_BORROWER_1003_2020 in the form_type parameter. To learn more about processing this document, click here.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
additional_borrower_1003_2020-Part01-General:lenderLoanNo./UniversalLoanIdentifier	Text	Lender Loan No./Universal Loan Identifier
additional_borrower_1003_2020-Part01-General:agencyCaseNo	Text	Agency Case No
additional_borrower_1003_2020-Part02-1A-PersonalInformation:name(FirstMiddleLastSuffix)	Text	Name (First Middle Last Suffix)
additional_borrower_1003_2020-Part02-1A-PersonalInformation:alternateNames	Text	Alternate Names
additional_borrower_1003_2020-Part02-1A-PersonalInformation:socialSecurityNumber	Social Security Number	Social Security Number
additional_borrower_1003_2020-Part02-1A-PersonalInformation:dateOfBirth	Date	Date Of Birth
additional_borrower_1003_2020-Part02-1A-PersonalInformation:citizenship	U.S. CITIZEN, PERMANENT RESIDENT ALIEN, NON-PERMANENT RESIDENT ALIEN	Citizenship
additional_borrower_1003_2020-Part02-1A-PersonalInformation:typeOfCredit:checkBox	I AM APPLYING FOR INDIVIDUAL CREDIT, I AM APPLYING FOR JOINT CREDIT	Type Of Credit
additional_borrower_1003_2020-Part02-1A-PersonalInformation:typeOfCredit:totalNumberOfBorrowers	Integer	Type Of Credit
additional_borrower_1003_2020-Part02-1A-PersonalInformation:typeOfCredit:yourInitials	SIGNED, NOT SIGNED	Type Of Credit
additional_borrower_1003_2020-Part02-1A-PersonalInformation:listName(S)OfOtherBorrower(S)ApplyingForThisLoan	Text	List Name(s) Of Other Borrower(s) Applying For This Loan
additional_borrower_1003_2020-Part02-1A-PersonalInformation:maritalStatus	MARRIED, SEPARATED, UNMARRIED	Marital Status
additional_borrower_1003_2020-Part02-1A-PersonalInformation:dependents:number	Integer	Dependents
additional_borrower_1003_2020-Part02-1A-PersonalInformation:dependents:ages	Text	Dependents
additional_borrower_1003_2020-Part02-1A-PersonalInformation:contactInformation:homePhone	Phone Number	Contact Information
additional_borrower_1003_2020-Part02-1A-PersonalInformation:contactInformation:cellPhone	Phone Number	Contact Information
additional_borrower_1003_2020-Part02-1A-PersonalInformation:contactInformation:workPhone	Phone Number	Contact Information
additional_borrower_1003_2020-Part02-1A-PersonalInformation:contactInformation:ext	Integer	Contact Information
additional_borrower_1003_2020-Part02-1A-PersonalInformation:contactInformation:email	Text	Contact Information
additional_borrower_1003_2020-Part02-1A-PersonalInformation:currentAddress:street	Text	Current Address
additional_borrower_1003_2020-Part02-1A-PersonalInformation:currentAddress:unit#	Text	Current Address
additional_borrower_1003_2020-Part02-1A-PersonalInformation:currentAddress:city	City	Current Address
additional_borrower_1003_2020-Part02-1A-PersonalInformation:currentAddress:state	State	Current Address
additional_borrower_1003_2020-Part02-1A-PersonalInformation:currentAddress:zip	ZIP Code	Current Address
additional_borrower_1003_2020-Part02-1A-PersonalInformation:currentAddress:country	Text	Current Address
additional_borrower_1003_2020-Part02-1A-PersonalInformation:howLongAtCurrentAddress?:years	Integer	How Long At Current Address?
additional_borrower_1003_2020-Part02-1A-PersonalInformation:howLongAtCurrentAddress?:months	Integer	How Long At Current Address?
additional_borrower_1003_2020-Part02-1A-PersonalInformation:currentAddress-Housing:currentAddress-Housing-CheckBox	NO PRIMARY HOUSING EXPENSE, OWN, RENT	Current Address - Housing
additional_borrower_1003_2020-Part02-1A-PersonalInformation:currentAddress-Housing:currentAddress-Housing-IfRent-EnterAmountPerMonth	Money	Current Address - Housing
additional_borrower_1003_2020-Part02-1A-PersonalInformation:ifAtCurrentAddressForLessThan2YearsListFormerAddress-DoesNotApply-CheckBox	CHECKED, NOT CHECKED	If At Current Address For Less than 2 Years List Former Address - Does Not Apply - Check Box
additional_borrower_1003_2020-Part02-1A-PersonalInformation:formerAddress:street	Text	Former Address
additional_borrower_1003_2020-Part02-1A-PersonalInformation:formerAddress:unit#	Text	Former Address
additional_borrower_1003_2020-Part02-1A-PersonalInformation:formerAddress:city	City	Former Address
additional_borrower_1003_2020-Part02-1A-PersonalInformation:formerAddress:state	State	Former Address
additional_borrower_1003_2020-Part02-1A-PersonalInformation:formerAddress:zip	ZIP Code	Former Address
additional_borrower_1003_2020-Part02-1A-PersonalInformation:formerAddress:country	Text	Former Address
additional_borrower_1003_2020-Part02-1A-PersonalInformation:howLongAtFormerAddress?:years	Integer	How Long At Former Address?
additional_borrower_1003_2020-Part02-1A-PersonalInformation:howLongAtFormerAddress?:months	Integer	How Long At Former Address?
additional_borrower_1003_2020-Part02-1A-PersonalInformation:formerAddress-Housing:formerAddress-Housing-CheckBox	NO PRIMARY HOUSING EXPENSE, OWN, RENT	Former Address - Housing
additional_borrower_1003_2020-Part02-1A-PersonalInformation:formerAddress-Housing:formerAddress-Housing-IfRent-EnterAmountPerMonth	Money	Former Address - Housing
additional_borrower_1003_2020-Part02-1A-PersonalInformation:mailingAddress-IfDifferentFromCurrentAddress-DoesNotApply-CheckBox	CHECKED, NOT CHECKED	Mailing Address - If Different From Current Address - Does Not Apply - Check Box
additional_borrower_1003_2020-Part02-1A-PersonalInformation:mailingAddress:street	Text	Mailing Address
additional_borrower_1003_2020-Part02-1A-PersonalInformation:mailingAddress:unit#	Text	Mailing Address
additional_borrower_1003_2020-Part02-1A-PersonalInformation:mailingAddress:city	City	Mailing Address
additional_borrower_1003_2020-Part02-1A-PersonalInformation:mailingAddress:state	State	Mailing Address
additional_borrower_1003_2020-Part02-1A-PersonalInformation:mailingAddress:zip	ZIP Code	Mailing Address
additional_borrower_1003_2020-Part02-1A-PersonalInformation:mailingAddress:country	Text	Mailing Address
additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:currentEmployment/Self-EmploymentAndIncome-DoesNotApply-CheckBox	CHECKED, NOT CHECKED	Current Employment/Self-Employment And Income - Does Not Apply - Check Box
additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:employerOrBusinessName	Text	Employer Or Business Name
additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:phone	Phone Number	Phone
additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:address:street	Text	Address
additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:address:unit#	Text	Address
additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:address:city	City	Address
additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:address:state	State	Address
additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:address:zip	ZIP Code	Address
additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:address:country	Text	Address
additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:positionOrTitle	Text	Position Or Title
additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:startDate	Date	Start Date
additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:howLongInThisLineOfWork?:years	Integer	How Long In This Line Of Work?
additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:howLongInThisLineOfWork?:months	Integer	How Long In This Line Of Work?
additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:checkIfThisStatementApplies	CHECKED, NOT CHECKED	Check If This Statement Applies
additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:checkIfYouAreTheBusinessOwnerOrSelf-Employed	CHECKED, NOT CHECKED	Check If You Are The Business Owner Or Self-Employed
additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:ownershipShare-CheckBox	I HAVE AN OWNERSHIP SHARE OF LESS THAN 25%, I HAVE AN OWNERSHIP SHARE OF 25% OR MORE	Ownership Share - Check Box
additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:monthlyIncomeOrLoss	Money	Monthly Income Or Loss
additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:grossMonthlyIncome:base	Money	Gross Monthly Income
additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:grossMonthlyIncome:overtime	Money	Gross Monthly Income
additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:grossMonthlyIncome:bonus	Money	Gross Monthly Income
additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:grossMonthlyIncome:commission	Money	Gross Monthly Income
additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:grossMonthlyIncome:militaryEntitlements	Money	Gross Monthly Income
additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:grossMonthlyIncome:other	Money	Gross Monthly Income
additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:grossMonthlyIncome:total	Money	Gross Monthly Income
additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:completeInformationForAdditionalEmployment-DoesNotApply-CheckBox	CHECKED, NOT CHECKED	Complete Information For Additional Employment - Does Not Apply - Check Box
additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:employerOrBusinessName	Text	Employer Or Business Name
additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:phone	Phone Number	Phone
additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:address:street	Text	Address
additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:address:unit#	Text	Address
additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:address:city	City	Address
additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:address:state	State	Address
additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:address:zip	ZIP Code	Address
additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:address:country	Text	Address
additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:positionOrTitle	Text	Position Or Title
additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:startDate	Date	Start Date
additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:howLongInThisLineOfWork:years	Integer	How Long In This Line Of Work
additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:howLongInThisLineOfWork:months	Integer	How Long In This Line Of Work
additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:checkIfThisStatementApplies	CHECKED, NOT CHECKED	Check If This Statement Applies
additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:checkIfYouAreTheBusinessOwnerOrSelf-Employed	CHECKED, NOT CHECKED	Check If You Are The Business Owner Or Self-Employed
additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:ownershipShare-CheckBox	I HAVE AN OWNERSHIP SHARE OF LESS THAN 25%, I HAVE AN OWNERSHIP SHARE OF 25% OR MORE	Ownership Share - Check Box
additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:monthlyIncomeOrLoss	Money	Monthly Income Or Loss
additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:grossMonthlyIncome:base	Money	Gross Monthly Income
additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:grossMonthlyIncome:overtime	Money	Gross Monthly Income
additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:grossMonthlyIncome:bonus	Money	Gross Monthly Income
additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:grossMonthlyIncome:commission	Money	Gross Monthly Income
additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:grossMonthlyIncome:militaryEntitlements	Money	Gross Monthly Income
additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:grossMonthlyIncome:other	Money	Gross Monthly Income
additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:grossMonthlyIncome:total	Money	Gross Monthly Income
additional_borrower_1003_2020-Part02-1D-IfApplicableCompleteInformationForPreviousEmployment/Self-EmploymentAndIncome:completeInformationForPreviousEmployment-DoesNotApply-CheckBox	CHECKED, NOT CHECKED	Complete Information For Previous Employment - Does Not Apply - Check Box
additional_borrower_1003_2020-Part02-1D-IfApplicableCompleteInformationForPreviousEmployment/Self-EmploymentAndIncome:employerOrBusinessName	Text	Employer Or Business Name
additional_borrower_1003_2020-Part02-1D-IfApplicableCompleteInformationForPreviousEmployment/Self-EmploymentAndIncome:address:street	Text	Address
additional_borrower_1003_2020-Part02-1D-IfApplicableCompleteInformationForPreviousEmployment/Self-EmploymentAndIncome:address:unit#	Text	Address
additional_borrower_1003_2020-Part02-1D-IfApplicableCompleteInformationForPreviousEmployment/Self-EmploymentAndIncome:address:city	City	Address
additional_borrower_1003_2020-Part02-1D-IfApplicableCompleteInformationForPreviousEmployment/Self-EmploymentAndIncome:address:state	State	Address
additional_borrower_1003_2020-Part02-1D-IfApplicableCompleteInformationForPreviousEmployment/Self-EmploymentAndIncome:address:zip	ZIP Code	Address
additional_borrower_1003_2020-Part02-1D-IfApplicableCompleteInformationForPreviousEmployment/Self-EmploymentAndIncome:address:country	Text	Address
additional_borrower_1003_2020-Part02-1D-IfApplicableCompleteInformationForPreviousEmployment/Self-EmploymentAndIncome:positionOrTitle	Text	Position Or Title
additional_borrower_1003_2020-Part02-1D-IfApplicableCompleteInformationForPreviousEmployment/Self-EmploymentAndIncome:startDate	Date	Start Date
additional_borrower_1003_2020-Part02-1D-IfApplicableCompleteInformationForPreviousEmployment/Self-EmploymentAndIncome:endDate	Date	End Date
additional_borrower_1003_2020-Part02-1D-IfApplicableCompleteInformationForPreviousEmployment/Self-EmploymentAndIncome:checkIfYouWereTheBusinessOwnerOrSelf-Employed	CHECKED, NOT CHECKED	Check If You Were The Business Owner Or Self-Employed
additional_borrower_1003_2020-Part02-1D-IfApplicableCompleteInformationForPreviousEmployment/Self-EmploymentAndIncome:previousGrossMonthlyIncome$	Money	Previous Gross Monthly Income $
additional_borrower_1003_2020-Part02-1E-IncomeFromOtherSources:incomeFromOtherSources-DoesNotApply-CheckBox	CHECKED, NOT CHECKED	Income From Other Sources - Does Not Apply - Check Box
additional_borrower_1003_2020-Part02-1E-IncomeFromOtherSources:incomeFromOtherSources-Row1:row1-Description	Text	Income From Other Sources - Row 1
additional_borrower_1003_2020-Part02-1E-IncomeFromOtherSources:incomeFromOtherSources-Row1:row1-MonthlyIncome	Money	Income From Other Sources - Row 1
additional_borrower_1003_2020-Part02-1E-IncomeFromOtherSources:incomeFromOtherSources-Row2:row2-Description	Text	Income From Other Sources - Row 2
additional_borrower_1003_2020-Part02-1E-IncomeFromOtherSources:incomeFromOtherSources-Row2:row2-MonthlyIncome	Money	Income From Other Sources - Row 2
additional_borrower_1003_2020-Part02-1E-IncomeFromOtherSources:incomeFromOtherSources-Row3:row3-Description	Text	Income From Other Sources - Row 3
additional_borrower_1003_2020-Part02-1E-IncomeFromOtherSources:incomeFromOtherSources-Row3:row3-MonthlyIncome	Money	Income From Other Sources - Row 3
additional_borrower_1003_2020-Part02-1E-IncomeFromOtherSources:provideTotalAmountHere	Money	Provide Total Amount Here
additional_borrower_1003_2020-Part03-2-AssetsAndLiabilities:insertNameOfBorrower	City	Insert Name of Borrower
additional_borrower_1003_2020-Part04-3-RealEstate:insertNameOfBorrower	City	Insert Name of Borrower
additional_borrower_1003_2020-Part05-4-LoanAndPropertyInformation:insertNameOfBorrower	City	Insert Name of Borrower
additional_borrower_1003_2020-Part06-5A-AboutThisPropertyAndYourMoneyForThisLoan:a-WillYouOccupyThePropertyAsYourPrimaryResidence-CheckBox	NO, YES	A - Will You Occupy The Property As Your Primary Residence - Check Box
additional_borrower_1003_2020-Part06-5A-AboutThisPropertyAndYourMoneyForThisLoan:a-IfYesHaveYouHadAnOwnershipInterestInAnotherProperty-CheckBox	NO, YES	A - If Yes Have You Had An Ownership Interest In Another Property - Check Box
additional_borrower_1003_2020-Part06-5A-AboutThisPropertyAndYourMoneyForThisLoan:a-IfYesComplete1And2Below:(1)WhatTypeOfPropertyDidYouOwn?	Text	A - If Yes Complete 1 And 2 Below
additional_borrower_1003_2020-Part06-5A-AboutThisPropertyAndYourMoneyForThisLoan:a-IfYesComplete1And2Below:(2)HowDidYouHoldTitleToTheProperty?	Text	A - If Yes Complete 1 And 2 Below
additional_borrower_1003_2020-Part06-5A-AboutThisPropertyAndYourMoneyForThisLoan:b-IfThisIsAPurchaseTransactionDoYouHaveAFamilyRelationship-CheckBox	NO, YES	B - If This Is A Purchase Transaction Do You Have A Family Relationship - Check Box
additional_borrower_1003_2020-Part06-5A-AboutThisPropertyAndYourMoneyForThisLoan:c-AreYouBorrowingAnyMoneyForThisRealEstateTransaction-CheckBox	NO, YES	C - Are You Borrowing Any Money For This Real Estate Transaction - Check Box
additional_borrower_1003_2020-Part06-5A-AboutThisPropertyAndYourMoneyForThisLoan:c-IfYesWhatIsTheAmountOfThisMoney?	Money	C - If Yes What Is The Amount Of This Money?
additional_borrower_1003_2020-Part06-5A-AboutThisPropertyAndYourMoneyForThisLoan:d-(1)HaveYouOrWillYouBeApplyingForAMortgageLoan-CheckBox	NO, YES	D - (1) Have You Or Will You Be Applying For A Mortgage Loan - Check Box
additional_borrower_1003_2020-Part06-5A-AboutThisPropertyAndYourMoneyForThisLoan:d-(2)HaveYouOrWillYouBeApplyingForAnyNewCredit-CheckBox	NO, YES	D - (2) Have You Or Will You Be Applying For Any New Credit - Check Box
additional_borrower_1003_2020-Part06-5A-AboutThisPropertyAndYourMoneyForThisLoan:e-WillThisPropertyBeSubjectToALienThatCouldTakePriority-CheckBox	NO, YES	E - Will This Property Be Subject To A Lien That Could Take Priority - Check Box
additional_borrower_1003_2020-Part06-5B-AboutYourFinances:f-AreYouACo-SignerOrGuarantorOnAnyDebtOrLoanThatIsNotDisclosed-CheckBox	NO, YES	F - Are You A Co-Signer Or Guarantor On Any Debt Or Loan That Is Not Disclosed- Check Box
additional_borrower_1003_2020-Part06-5B-AboutYourFinances:g-AreThereAnyOutstandingJudgmentsAgainstYou-CheckBox	NO, YES	G - Are There Any Outstanding Judgments Against You - Check Box
additional_borrower_1003_2020-Part06-5B-AboutYourFinances:h-AreYouCurrentlyDelinquentOrInDefaultOnAFederalDebt-CheckBox	NO, YES	H - Are You Currently Delinquent Or In Default On A Federal Debt - Check Box
additional_borrower_1003_2020-Part06-5B-AboutYourFinances:i-AreYouAPartyToALawsuitInWhichYouPotentiallyHaveAnyLiability-CheckBox	NO, YES	I - Are You A Party To A Lawsuit In Which You Potentially Have Any Liability - Check Box
additional_borrower_1003_2020-Part06-5B-AboutYourFinances:j-HaveYouConveyedTitleToAnyPropertyInLieuOfForeclosure-CheckBox	NO, YES	J - Have You Conveyed Title To Any Property In Lieu Of Foreclosure - Check Box
additional_borrower_1003_2020-Part06-5B-AboutYourFinances:k-WithinThePast7YearsHaveYouCompletedAPre-ForeclosureSale-CheckBox	NO, YES	K - Within The Past 7 Years Have You Completed A Pre-Foreclosure Sale - Check Box
additional_borrower_1003_2020-Part06-5B-AboutYourFinances:l-HaveYouHadPropertyForeclosedUponInTheLast7Years-CheckBox	NO, YES	L - Have You Had Property Foreclosed Upon In The Last 7 Years - Check Box
additional_borrower_1003_2020-Part06-5B-AboutYourFinances:m-HaveYouDeclaredBankruptcyWithinThePast7Years-CheckBox	NO, YES	M - Have You Declared Bankruptcy Within The Past 7 Years - Check Box
additional_borrower_1003_2020-Part06-5B-AboutYourFinances:m-IfYesIdentifyTheTypesOfBankruptcy-CheckBox	CHAPTER 7, CHAPTER 11, CHAPTER 12, CHAPTER 13	M - If Yes Identify The Types Of Bankruptcy - Check Box
additional_borrower_1003_2020-Part07-AcknowledgmentsAndAgreements:insertNameOfBorrower	City	Insert Name of Borrower
additional_borrower_1003_2020-Part08-MilitaryServiceOfBorrower:didYouOrYourDeceasedSpouseEverServeOrAreYouCurrentlyServing-CheckBox	NO, YES	Did You Or Your Deceased Spouse Ever Serve Or Are You Currently Serving - Check Box
additional_borrower_1003_2020-Part08-MilitaryServiceOfBorrower:ifYesCheckAllThatApply:currentlyServingOnActiveDutyWithProjectedExpirationDateOfService/Tour	CHECKED, NOT CHECKED	If Yes Check All That Apply
additional_borrower_1003_2020-Part08-MilitaryServiceOfBorrower:ifYesCheckAllThatApply:projectedExpirationDateOfService/Tour	Date	If Yes Check All That Apply
additional_borrower_1003_2020-Part08-MilitaryServiceOfBorrower:ifYesCheckAllThatApply:currentlyRetiredDischargedOrSeparatedFromService	CHECKED, NOT CHECKED	If Yes Check All That Apply
additional_borrower_1003_2020-Part08-MilitaryServiceOfBorrower:ifYesCheckAllThatApply:onlyPeriodOfServiceWasAsANon-ActivatedMemberOfTheReserveOrNationalGuard	CHECKED, NOT CHECKED	If Yes Check All That Apply
additional_borrower_1003_2020-Part08-MilitaryServiceOfBorrower:ifYesCheckAllThatApply:survivingSpouse	CHECKED, NOT CHECKED	If Yes Check All That Apply
additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:ethnicity:hispanicOrLatino-CheckBox	CHECKED, NOT CHECKED	Ethnicity
additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:ethnicity:hispanicOrLatino-IfChecked	MEXICAN, PUERTO RICAN, CUBAN, OTHER HISPANIC OR LATINO	Ethnicity
additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:ethnicity:hispanicOrLatino-IfOtherWasChecked	Text	Ethnicity
additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:ethnicity:notHispanicOrLatino-CheckBox	CHECKED, NOT CHECKED	Ethnicity
additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:ethnicity:iDoNotWishToProvideThisInformation-CheckBox	CHECKED, NOT CHECKED	Ethnicity
additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:race:americanIndianOrAlaskaNative-CheckBox	CHECKED, NOT CHECKED	Race
additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:race:americanIndianOrAlaskaNative-IfChecked	Text	Race
additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:race:asian-CheckBox	ASIAN INDIAN, CHINESE, FILIPINO, JAPANESE, KOREAN, VIETNAMESE, OTHER ASIAN	Race
additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:race:asian-IfOtherAsianChecked	Text	Race
additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:race:blackOrAfricanAmerican-CheckBox	CHECKED, NOT CHECKED	Race
additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:race:nativeHawaiianOrOtherPacificIslander-CheckBox	NATIVE HAWAIIAN, GUAMANIAN OR CHAMORRO, SAMOAN, OTHER PACIFIC ISLANDER	Race
additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:race:nativeHawaiianOrOtherPacificIslander-IfOtherPacificIslanderChecked	Text	Race
additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:race:white-CheckBox	CHECKED, NOT CHECKED	Race
additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:race:iDoNotWishToProvideThisInformation-CheckBox	CHECKED, NOT CHECKED	Race
additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:sex:sex-CheckBox	MALE, FEMALE, I DO NOT WISH TO PROVIDE THIS INFORMATION	Sex
additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:toBeCompletedByFinancialInstitution:wasTheEthnicityOfTheBorrowerCollectedOnTheBasisOfVisualObservationOrSurname?	NO, YES	To Be Completed By Financial Institution
additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:toBeCompletedByFinancialInstitution:wasTheSexOfTheBorrowerCollectedOnTheBasisOfVisualObservationOrSurname?	NO, YES	To Be Completed By Financial Institution
additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:toBeCompletedByFinancialInstitution:wasTheRaceOfTheBorrowerCollectedOnTheBasisOfVisualObservationOrSurname?	NO, YES	To Be Completed By Financial Institution
additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:theDemographicInformationWasProvidedThrough:theDemographicInformationWasProvidedThrough-CheckBox	FACE-TO-FACE INTERVIEW, TELEPHONE INTERVIEW, FAX OR MAIL, EMAIL OR INTERNET	The Demographic Information Was Provided Through
additional_borrower_1003_2020-Part10-LoanOriginatorInformation:loanOriginatorOrganizationName	Text	Loan Originator Organization Name
additional_borrower_1003_2020-Part10-LoanOriginatorInformation:loanOriginatorOrganizationAddress:street	Text	Loan Originator Organization Address
additional_borrower_1003_2020-Part10-LoanOriginatorInformation:loanOriginatorOrganizationAddress:unit#	Text	Loan Originator Organization Address
additional_borrower_1003_2020-Part10-LoanOriginatorInformation:loanOriginatorOrganizationAddress:city	City	Loan Originator Organization Address
additional_borrower_1003_2020-Part10-LoanOriginatorInformation:loanOriginatorOrganizationAddress:state	State	Loan Originator Organization Address
additional_borrower_1003_2020-Part10-LoanOriginatorInformation:loanOriginatorOrganizationAddress:zip	ZIP Code	Loan Originator Organization Address
additional_borrower_1003_2020-Part10-LoanOriginatorInformation:loanOriginatorOrganizationNmlsrId#	Text	Loan Originator Organization NMLSR ID#
additional_borrower_1003_2020-Part10-LoanOriginatorInformation:loanOriginatorOrganizationStateLicenseId#	Text	Loan Originator Organization State License ID#
additional_borrower_1003_2020-Part10-LoanOriginatorInformation:loanOriginatorName	Text	Loan Originator Name
additional_borrower_1003_2020-Part10-LoanOriginatorInformation:loanOriginatorNmlsrId#	Text	Loan Originator NMLSR ID#
additional_borrower_1003_2020-Part10-LoanOriginatorInformation:loanOriginatorStateLicenseId#	Text	Loan Originator State License ID#
additional_borrower_1003_2020-Part10-LoanOriginatorInformation:loanOriginatorEmail	Text	Loan Originator Email
additional_borrower_1003_2020-Part10-LoanOriginatorInformation:loanOriginatorPhone	Phone Number	Loan Originator Phone
additional_borrower_1003_2020-Part10-LoanOriginatorInformation:loanOriginatorSignature	SIGNED, NOT SIGNED	Loan Originator Signature
additional_borrower_1003_2020-Part10-LoanOriginatorInformation:loanOriginatorSignatureDate	Date	Loan Originator Signature Date
Sample document
drive.google.com
Additional Borrower 1003 For API (1).pdf
Sample JSON result
JSON
{
   "status":200,
   "response":{
      "pk":32286409,
      "uuid":"35490445-1810-4c60-897c-7e2803ee85ef",
      "name":"Additional borrower",
      "created":"2023-04-17T15:50:41Z",
      "created_ts":"2023-04-17T15:50:41Z",
      "verified_pages_count":8,
      "book_status":"ACTIVE",
      "id":32286409,
      "forms":[
         {
            "pk":45972841,
            "uuid":"1741a47b-38bb-4b56-a400-cc56aaca7137",
            "uploaded_doc_pk":54217916,
            "form_type":"ADDITIONAL_BORROWER_1003_2020",
            "raw_fields":{
               "additional_borrower_1003_2020-Part01-General:agencyCaseNo":{
                  "value":"4321",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:citizenship":{
                  "value":"U.S. CITIZEN",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:dateOfBirth":{
                  "value":"01/13/1991",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:maritalStatus":{
                  "value":"MARRIED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:alternateNames":{
                  "value":"ROBERT SAMPLE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:dependents:ages":{
                  "value":"30",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:dependents:number":{
                  "value":"2",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:formerAddress:zip":{
                  "value":"12345",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:currentAddress:zip":{
                  "value":"12345",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:formerAddress:city":{
                  "value":"DEMO CITY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:mailingAddress:zip":{
                  "value":"54321",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:currentAddress:city":{
                  "value":"SAMPLE CITY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:formerAddress:state":{
                  "value":"NY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:formerAddress:unit#":{
                  "value":"12",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:mailingAddress:city":{
                  "value":"SAMPLE CITY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:currentAddress:state":{
                  "value":"NY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:currentAddress:unit#":{
                  "value":"2",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:formerAddress:street":{
                  "value":"888 SAMPLE STREET RD.",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:mailingAddress:state":{
                  "value":"NY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:mailingAddress:unit#":{
                  "value":"3",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:socialSecurityNumber":{
                  "value":"888-88-8888",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:currentAddress:street":{
                  "value":"123 FAKE STREET RD.",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:formerAddress:country":{
                  "value":"USA",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:mailingAddress:street":{
                  "value":"321 FAKE STREET RD.",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:typeOfCredit:checkBox":{
                  "value":"I AM APPLYING FOR JOINT CREDIT",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part01-General:lenderLoanNo./UniversalLoanIdentifier":{
                  "value":"9876543210",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:contactInformation:ext":{
                  "value":"123",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:currentAddress:country":{
                  "value":"USA",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:mailingAddress:country":{
                  "value":"USA",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:contactInformation:email":{
                  "value":"FAKE@SAMPLE.COM",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:typeOfCredit:yourInitials":{
                  "value":"SIGNED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:name(FirstMiddleLastSuffix)":{
                  "value":"DAVID SAMPLE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:contactInformation:cellPhone":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:contactInformation:homePhone":{
                  "value":"(500) 123-4567",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf",
                  "irregular_datatype":true,
                  "type_validation_error":"Invalid phone number."
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:contactInformation:workPhone":{
                  "value":"(800) 222-2222",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:phone":{
                  "value":"(500) 765-4321",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:howLongAtFormerAddress?:years":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:howLongAtCurrentAddress?:years":{
                  "value":"5",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:howLongAtFormerAddress?:months":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:howLongAtCurrentAddress?:months":{
                  "value":"0",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:startDate":{
                  "value":"01/01/2022",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:address:zip":{
                  "value":"55555",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:typeOfCredit:totalNumberOfBorrowers":{
                  "value":"2",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:address:city":{
                  "value":"SAMPLE CITY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:address:state":{
                  "value":"NY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:address:unit#":{
                  "value":"4",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:address:street":{
                  "value":"123 FAKE STREET RD.",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:address:country":{
                  "value":"USA",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:positionOrTitle":{
                  "value":"CEO",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:monthlyIncomeOrLoss":{
                  "value":"100.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:employerOrBusinessName":{
                  "value":"XYZ FAKE INC",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:grossMonthlyIncome:base":{
                  "value":"100.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:ownershipShare-CheckBox":{
                  "value":"I HAVE AN OWNERSHIP SHARE OF 25% OR MORE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:grossMonthlyIncome:bonus":{
                  "value":"100.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:grossMonthlyIncome:other":{
                  "value":"100.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:grossMonthlyIncome:total":{
                  "value":"600.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:listName(S)OfOtherBorrower(S)ApplyingForThisLoan":{
                  "value":"JULIAN FAKE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:checkIfThisStatementApplies":{
                  "value":"CHECKED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:grossMonthlyIncome:overtime":{
                  "value":"100.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:formerAddress-Housing:formerAddress-Housing-CheckBox":{
                  "value":"RENT",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:grossMonthlyIncome:commission":{
                  "value":"100.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:howLongInThisLineOfWork?:years":{
                  "value":"1",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:currentAddress-Housing:currentAddress-Housing-CheckBox":{
                  "value":"RENT",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:howLongInThisLineOfWork?:months":{
                  "value":"0",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:grossMonthlyIncome:militaryEntitlements":{
                  "value":"100.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:mailingAddress-IfDifferentFromCurrentAddress-DoesNotApply-CheckBox":{
                  "value":"NOT CHECKED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:checkIfYouAreTheBusinessOwnerOrSelf-Employed":{
                  "value":"CHECKED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:formerAddress-Housing:formerAddress-Housing-IfRent-EnterAmountPerMonth":{
                  "value":"5000.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:currentAddress-Housing:currentAddress-Housing-IfRent-EnterAmountPerMonth":{
                  "value":"5000.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1A-PersonalInformation:ifAtCurrentAddressForLessThan2YearsListFormerAddress-DoesNotApply-CheckBox":{
                  "value":"NOT CHECKED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1B-CurrentEmployment/Self-EmploymentAndIncome:currentEmployment/Self-EmploymentAndIncome-DoesNotApply-CheckBox":{
                  "value":"NOT CHECKED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part04-3-RealEstate:insertNameOfBorrower":{
                  "value":"DAVID SAMPLE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part03-2-AssetsAndLiabilities:insertNameOfBorrower":{
                  "value":"DAVID SAMPLE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1E-IncomeFromOtherSources:provideTotalAmountHere":{
                  "value":"300.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part05-4-LoanAndPropertyInformation:insertNameOfBorrower":{
                  "value":"DAVID SAMPLE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1E-IncomeFromOtherSources:incomeFromOtherSources-DoesNotApply-CheckBox":{
                  "value":"NOT CHECKED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1E-IncomeFromOtherSources:incomeFromOtherSources-Row1:row1-Description":{
                  "value":"CAPITAL GAINS",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1E-IncomeFromOtherSources:incomeFromOtherSources-Row2:row2-Description":{
                  "value":"BOARDER INCOME",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1E-IncomeFromOtherSources:incomeFromOtherSources-Row3:row3-Description":{
                  "value":"ALIMONY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1E-IncomeFromOtherSources:incomeFromOtherSources-Row1:row1-MonthlyIncome":{
                  "value":"100.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1E-IncomeFromOtherSources:incomeFromOtherSources-Row2:row2-MonthlyIncome":{
                  "value":"100.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1E-IncomeFromOtherSources:incomeFromOtherSources-Row3:row3-MonthlyIncome":{
                  "value":"100.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:phone":{
                  "value":"(800) 123-4567",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1D-IfApplicableCompleteInformationForPreviousEmployment/Self-EmploymentAndIncome:endDate":{
                  "value":"01/01/2020",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1D-IfApplicableCompleteInformationForPreviousEmployment/Self-EmploymentAndIncome:startDate":{
                  "value":"01/01/2000",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:startDate":{
                  "value":"02/01/2020",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1D-IfApplicableCompleteInformationForPreviousEmployment/Self-EmploymentAndIncome:address:zip":{
                  "value":"12345",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1D-IfApplicableCompleteInformationForPreviousEmployment/Self-EmploymentAndIncome:address:city":{
                  "value":"SAMPLE CITY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:address:zip":{
                  "value":"22222",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1D-IfApplicableCompleteInformationForPreviousEmployment/Self-EmploymentAndIncome:address:state":{
                  "value":"NJ",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1D-IfApplicableCompleteInformationForPreviousEmployment/Self-EmploymentAndIncome:address:unit#":{
                  "value":"12",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:address:city":{
                  "value":"SAMPLE CITY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1D-IfApplicableCompleteInformationForPreviousEmployment/Self-EmploymentAndIncome:address:street":{
                  "value":"333 FAKE STREET RD.",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:address:state":{
                  "value":"NY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:address:unit#":{
                  "value":"12",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1D-IfApplicableCompleteInformationForPreviousEmployment/Self-EmploymentAndIncome:address:country":{
                  "value":"USA",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1D-IfApplicableCompleteInformationForPreviousEmployment/Self-EmploymentAndIncome:positionOrTitle":{
                  "value":"CTO",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:address:street":{
                  "value":"123 FAKE STREET RD.",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:address:country":{
                  "value":"USA",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:positionOrTitle":{
                  "value":"VP",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:monthlyIncomeOrLoss":{
                  "value":"50.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1D-IfApplicableCompleteInformationForPreviousEmployment/Self-EmploymentAndIncome:employerOrBusinessName":{
                  "value":"EXAMPLE INC",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:employerOrBusinessName":{
                  "value":"SAMPLE FAKE COMPANY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:grossMonthlyIncome:base":{
                  "value":"100.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:ownershipShare-CheckBox":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:grossMonthlyIncome:bonus":{
                  "value":"100.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:grossMonthlyIncome:other":{
                  "value":"100.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:grossMonthlyIncome:total":{
                  "value":"600.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1D-IfApplicableCompleteInformationForPreviousEmployment/Self-EmploymentAndIncome:previousGrossMonthlyIncome$":{
                  "value":"10000.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:checkIfThisStatementApplies":{
                  "value":"NOT CHECKED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:grossMonthlyIncome:overtime":{
                  "value":"100.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:grossMonthlyIncome:commission":{
                  "value":"100.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:howLongInThisLineOfWork:years":{
                  "value":"1",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:howLongInThisLineOfWork:months":{
                  "value":"0",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:grossMonthlyIncome:militaryEntitlements":{
                  "value":"100.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1D-IfApplicableCompleteInformationForPreviousEmployment/Self-EmploymentAndIncome:checkIfYouWereTheBusinessOwnerOrSelf-Employed":{
                  "value":"CHECKED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:checkIfYouAreTheBusinessOwnerOrSelf-Employed":{
                  "value":"CHECKED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1D-IfApplicableCompleteInformationForPreviousEmployment/Self-EmploymentAndIncome:completeInformationForPreviousEmployment-DoesNotApply-CheckBox":{
                  "value":"NOT CHECKED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part02-1C-IfApplicableCompleteInformationForAdditionalEmployment/Self-EmploymentAndIncome:completeInformationForAdditionalEmployment-DoesNotApply-CheckBox":{
                  "value":"NOT CHECKED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part07-AcknowledgmentsAndAgreements:insertNameOfBorrower":{
                  "value":"DAVID SAMPLE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part08-MilitaryServiceOfBorrower:ifYesCheckAllThatApply:survivingSpouse":{
                  "value":"NOT CHECKED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part06-5B-AboutYourFinances:m-IfYesIdentifyTheTypesOfBankruptcy-CheckBox":{
                  "value":"CHAPTER 12",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part06-5B-AboutYourFinances:g-AreThereAnyOutstandingJudgmentsAgainstYou-CheckBox":{
                  "value":"YES",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part06-5B-AboutYourFinances:m-HaveYouDeclaredBankruptcyWithinThePast7Years-CheckBox":{
                  "value":"YES",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part06-5A-AboutThisPropertyAndYourMoneyForThisLoan:c-IfYesWhatIsTheAmountOfThisMoney?":{
                  "value":"100.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part06-5B-AboutYourFinances:l-HaveYouHadPropertyForeclosedUponInTheLast7Years-CheckBox":{
                  "value":"YES",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part06-5B-AboutYourFinances:h-AreYouCurrentlyDelinquentOrInDefaultOnAFederalDebt-CheckBox":{
                  "value":"YES",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part06-5B-AboutYourFinances:j-HaveYouConveyedTitleToAnyPropertyInLieuOfForeclosure-CheckBox":{
                  "value":"YES",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part08-MilitaryServiceOfBorrower:ifYesCheckAllThatApply:projectedExpirationDateOfService/Tour":{
                  "value":"01/01/2023",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part06-5B-AboutYourFinances:k-WithinThePast7YearsHaveYouCompletedAPre-ForeclosureSale-CheckBox":{
                  "value":"YES",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part06-5B-AboutYourFinances:i-AreYouAPartyToALawsuitInWhichYouPotentiallyHaveAnyLiability-CheckBox":{
                  "value":"YES",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part06-5B-AboutYourFinances:f-AreYouACo-SignerOrGuarantorOnAnyDebtOrLoanThatIsNotDisclosed-CheckBox":{
                  "value":"YES",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part08-MilitaryServiceOfBorrower:didYouOrYourDeceasedSpouseEverServeOrAreYouCurrentlyServing-CheckBox":{
                  "value":"YES",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part08-MilitaryServiceOfBorrower:ifYesCheckAllThatApply:currentlyRetiredDischargedOrSeparatedFromService":{
                  "value":"CHECKED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part06-5A-AboutThisPropertyAndYourMoneyForThisLoan:d-(2)HaveYouOrWillYouBeApplyingForAnyNewCredit-CheckBox":{
                  "value":"YES",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part06-5A-AboutThisPropertyAndYourMoneyForThisLoan:d-(1)HaveYouOrWillYouBeApplyingForAMortgageLoan-CheckBox":{
                  "value":"YES",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part06-5A-AboutThisPropertyAndYourMoneyForThisLoan:a-IfYesComplete1And2Below:(1)WhatTypeOfPropertyDidYouOwn?":{
                  "value":"PR",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part06-5A-AboutThisPropertyAndYourMoneyForThisLoan:a-WillYouOccupyThePropertyAsYourPrimaryResidence-CheckBox":{
                  "value":"YES",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part06-5A-AboutThisPropertyAndYourMoneyForThisLoan:a-IfYesComplete1And2Below:(2)HowDidYouHoldTitleToTheProperty?":{
                  "value":"S",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part06-5A-AboutThisPropertyAndYourMoneyForThisLoan:a-IfYesHaveYouHadAnOwnershipInterestInAnotherProperty-CheckBox":{
                  "value":"YES",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part06-5A-AboutThisPropertyAndYourMoneyForThisLoan:c-AreYouBorrowingAnyMoneyForThisRealEstateTransaction-CheckBox":{
                  "value":"YES",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part06-5A-AboutThisPropertyAndYourMoneyForThisLoan:e-WillThisPropertyBeSubjectToALienThatCouldTakePriority-CheckBox":{
                  "value":"YES",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part06-5A-AboutThisPropertyAndYourMoneyForThisLoan:b-IfThisIsAPurchaseTransactionDoYouHaveAFamilyRelationship-CheckBox":{
                  "value":"YES",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part08-MilitaryServiceOfBorrower:ifYesCheckAllThatApply:currentlyServingOnActiveDutyWithProjectedExpirationDateOfService/Tour":{
                  "value":"CHECKED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part08-MilitaryServiceOfBorrower:ifYesCheckAllThatApply:onlyPeriodOfServiceWasAsANon-ActivatedMemberOfTheReserveOrNationalGuard":{
                  "value":"NOT CHECKED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part10-LoanOriginatorInformation:loanOriginatorName":{
                  "value":"DOE SAMPLE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part10-LoanOriginatorInformation:loanOriginatorEmail":{
                  "value":"DOE@SAMPLE.COM",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part10-LoanOriginatorInformation:loanOriginatorPhone":{
                  "value":"(500) 765-4321",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part10-LoanOriginatorInformation:loanOriginatorNmlsrId#":{
                  "value":"654321",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:sex:sex-CheckBox":{
                  "value":"MALE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part10-LoanOriginatorInformation:loanOriginatorSignature":{
                  "value":"NOT SIGNED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:race:asian-CheckBox":{
                  "value":"FILIPINO",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:race:white-CheckBox":{
                  "value":"CHECKED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part10-LoanOriginatorInformation:loanOriginatorSignatureDate":{
                  "value":"01/01/2023",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part10-LoanOriginatorInformation:loanOriginatorStateLicenseId#":{
                  "value":"123456789",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part10-LoanOriginatorInformation:loanOriginatorOrganizationName":{
                  "value":"SAMPLE MORTGAGE INC",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part10-LoanOriginatorInformation:loanOriginatorOrganizationNmlsrId#":{
                  "value":"333333",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:race:asian-IfOtherAsianChecked":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part10-LoanOriginatorInformation:loanOriginatorOrganizationAddress:zip":{
                  "value":"56789",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part10-LoanOriginatorInformation:loanOriginatorOrganizationAddress:city":{
                  "value":"SAMPLE CITY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part10-LoanOriginatorInformation:loanOriginatorOrganizationAddress:state":{
                  "value":"NY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part10-LoanOriginatorInformation:loanOriginatorOrganizationAddress:unit#":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part10-LoanOriginatorInformation:loanOriginatorOrganizationAddress:street":{
                  "value":"111 FAKE STREET RD.",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part10-LoanOriginatorInformation:loanOriginatorOrganizationStateLicenseId#":{
                  "value":"22222",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:ethnicity:hispanicOrLatino-CheckBox":{
                  "value":"CHECKED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:ethnicity:hispanicOrLatino-IfChecked":{
                  "value":"MEXICAN",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:race:blackOrAfricanAmerican-CheckBox":{
                  "value":"CHECKED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:ethnicity:notHispanicOrLatino-CheckBox":{
                  "value":"NOT CHECKED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:race:americanIndianOrAlaskaNative-CheckBox":{
                  "value":"CHECKED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:race:americanIndianOrAlaskaNative-IfChecked":{
                  "value":"SAMPLE TRIBE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:ethnicity:hispanicOrLatino-IfOtherWasChecked":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:race:iDoNotWishToProvideThisInformation-CheckBox":{
                  "value":"CHECKED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:race:nativeHawaiianOrOtherPacificIslander-CheckBox":{
                  "value":"OTHER PACIFIC ISLANDER",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:ethnicity:iDoNotWishToProvideThisInformation-CheckBox":{
                  "value":"NOT CHECKED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:race:nativeHawaiianOrOtherPacificIslander-IfOtherPacificIslanderChecked":{
                  "value":"DEMO NATIVE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:theDemographicInformationWasProvidedThrough:theDemographicInformationWasProvidedThrough-CheckBox":{
                  "value":"FACE-TO-FACE INTERVIEW",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:toBeCompletedByFinancialInstitution:wasTheSexOfTheBorrowerCollectedOnTheBasisOfVisualObservationOrSurname?":{
                  "value":"YES",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:toBeCompletedByFinancialInstitution:wasTheRaceOfTheBorrowerCollectedOnTheBasisOfVisualObservationOrSurname?":{
                  "value":"YES",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               },
               "additional_borrower_1003_2020-Part09-DemographicInformationOfBorrower:toBeCompletedByFinancialInstitution:wasTheEthnicityOfTheBorrowerCollectedOnTheBasisOfVisualObservationOrSurname?":{
                  "value":"YES",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Additional Borrower 1003 For API (2).pdf"
               }
            },
            "form_config_pk":196858,
            "tables":[
               
            ],
            "attribute_data":null
         }
      ],
      "book_is_complete":true
   },
   "message":"OK"
}


Updated 11 months ago

1003 (2020) - Uniform Residential Loan Application
1003 (2020) - Uniform Residential Loan Application (Lender Loan Information)
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