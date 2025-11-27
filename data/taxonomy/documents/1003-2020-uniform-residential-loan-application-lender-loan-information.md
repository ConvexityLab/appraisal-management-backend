# 2020 Form 1003 – Lender Loan Info Automation | Ocrolus

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
1003 (2020) - Uniform Residential Loan Application (Lender Loan Information)
Suggest Edits

The Uniform Residential Loan Application (Lender Loan Information) form is used by lenders to gather specific details about a loan request. This form is a critical part of the mortgage underwriting process, which allows lenders to assess the borrower's financial situation and evaluate the risk associated with extending a loan.

To use the Upload PDF endpoint for this document, you must use LENDER_LOAN_INFORMATION_1003_2020 in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
lender_loan_information_1003_2020-General:lenderLoanNo./UniversalLoanIdentifier	Text	Lender Loan No./Universal Loan Identifier
lender_loan_information_1003_2020-General:agencyCaseNo.	Text	Agency Case No.
lender_loan_information_1003_2020-General:borrowerName(S)	Text	Borrower Name(s)
lender_loan_information_1003_2020-Part1-L1-PropertyAndLoanInformation:communityPropertyState:atLeastOneBorrowerLivesInACommunityPropertyState	CHECKED, NOT CHECKED	Community Property State
lender_loan_information_1003_2020-Part1-L1-PropertyAndLoanInformation:communityPropertyState:thePropertyIsInACommunityPropertyState	CHECKED, NOT CHECKED	Community Property State
lender_loan_information_1003_2020-Part1-L1-PropertyAndLoanInformation:transactionDetail:conversionOfContractForDeedOrLandContract	CHECKED, NOT CHECKED	Transaction Detail
lender_loan_information_1003_2020-Part1-L1-PropertyAndLoanInformation:transactionDetail:renovation	CHECKED, NOT CHECKED	Transaction Detail
lender_loan_information_1003_2020-Part1-L1-PropertyAndLoanInformation:transactionDetail:construction-conversion/construction-to-permanent-Checkbox	CHECKED, NOT CHECKED	Transaction Detail
lender_loan_information_1003_2020-Part1-L1-PropertyAndLoanInformation:transactionDetail:construction-conversion/construction-to-permanent-Single-ClosingOrTwo-Closing	SINGLE-CLOSING, TWO-CLOSING	Transaction Detail
lender_loan_information_1003_2020-Part1-L1-PropertyAndLoanInformation:transactionDetail:construction/improvementCosts	Money	Transaction Detail
lender_loan_information_1003_2020-Part1-L1-PropertyAndLoanInformation:transactionDetail:lotAcquiredDate	Date	Transaction Detail
lender_loan_information_1003_2020-Part1-L1-PropertyAndLoanInformation:transactionDetail:originalCostOfLot	Money	Transaction Detail
lender_loan_information_1003_2020-Part1-L1-PropertyAndLoanInformation:refinanceType	NO CASH OUT, LIMITED CASH OUT, CASH OUT	Refinance Type
lender_loan_information_1003_2020-Part1-L1-PropertyAndLoanInformation:refinanceProgram	FULL DOCUMENTATION, INTEREST RATE REDUCTION, STREAMLINED WITHOUT APPRAISAL, OTHER	Refinance Program
lender_loan_information_1003_2020-Part1-L1-PropertyAndLoanInformation:refinanceProgram-IfOther	Text	Refinance Program - If Other
lender_loan_information_1003_2020-Part1-L1-PropertyAndLoanInformation:energyImprovement:mortgageLoanWillFinanceEnergy-RelatedImprovements	CHECKED, NOT CHECKED	Energy Improvement
lender_loan_information_1003_2020-Part1-L1-PropertyAndLoanInformation:energyImprovement:propertyIsCurrentlySubjectToALienThatCouldTakePriorityOverTheFirstMortgage	CHECKED, NOT CHECKED	Energy Improvement
lender_loan_information_1003_2020-Part1-L1-PropertyAndLoanInformation:projectType	CONDOMINIUM, COOPERATIVE, PLANNED UNIT DEVELOPMENT (PUD), PROPERTY IS NOT LOCATED IN A PROJECT	Project Type
lender_loan_information_1003_2020-Part2-L2-TitleInformation:titleToThePropertyWillBeHeldInWhatName(S)	Text	Title To The Property Will Be Held In What Name(s)
lender_loan_information_1003_2020-Part2-L2-TitleInformation:forRefinanceTitleToThePropertyIsCurrentlyHeldInWhatName(S)	Text	For Refinance Title To The Property Is Currently Held In What Name(s)
lender_loan_information_1003_2020-Part2-L2-TitleInformation:estateWillBeHeldIn	FEE SIMPLE, LEASEHOLD EXPIRATION DATE	Estate Will Be Held In
lender_loan_information_1003_2020-Part2-L2-TitleInformation:estateWillBeHeldIn-LeaseholdExpirationDate:date	Date	Estate Will Be Held In - Leasehold Expiration Date
lender_loan_information_1003_2020-Part2-L2-TitleInformation:mannerInWhichTitleWillBeHeld	SOLE OWNERSHIP, LIFE ESTATE, TENANCY IN COMMON, JOINT TENANCY WITH RIGHT OF SURVIVORSHIP, TENANCY BY THE ENTIRETY, OTHER	Manner In Which Title Will Be Held
lender_loan_information_1003_2020-Part2-L2-TitleInformation:trustInformation	TITLE WILL BE HELD BY AN INTER VIVOS (LIVING) TRUST, TITLE WILL BE HELD BY A LAND TRUST	Trust Information
lender_loan_information_1003_2020-Part2-L2-TitleInformation:indianCountryLandTenure	FEE SIMPLE ON A RESERVATION, INDIVIDUAL TRUST LAND (ALLOTTED/RESTRICTED), TRIBAL TRUST LAND ON A RESERVATION, TRIBAL TRUST LAND OFF RESERVATION, ALASKA NATIVE CORPORATION LAND	Indian Country Land Tenure
lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:mortgageTypeAppliedFor	CONVENTIONAL, USDA-RD, FHA, VA, OTHER	Mortgage Type Applied For
lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:mortgageTypeAppliedFor-Other	Text	Mortgage Type Applied For - Other
lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:termsOfLoan:noteRate%	Percentage	Terms Of Loan
lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:termsOfLoan:loanTerm(Months)	Text	Terms Of Loan
lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:mortgageLienType	FIRST LIEN, SUBORDINATE LIEN	Mortgage Lien Type
lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:amortizationType	FIXED RATE, ADJUSTABLE RATE, OTHER	Amortization Type
lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:amortizationType-Other(Explain)	Text	Amortization Type - Other (Explain)
lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:ifAdjustableRate:initialPeriodPriorToFirstAdjustment(Months)	Text	If Adjustable Rate
lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:ifAdjustableRate:subsequentAdjustmentPeriod(Months)	Text	If Adjustable Rate
lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:loanFeatures:balloon/BalloonTerm(Months)-Checkbox	CHECKED, NOT CHECKED	Loan Features
lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:loanFeatures:balloon/BalloonTerm(Months)	Text	Loan Features
lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:loanFeatures:interestOnly/InterestOnlyTerm(Months)-Checkbox	CHECKED, NOT CHECKED	Loan Features
lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:loanFeatures:interestOnly/InterestOnlyTerm(Months)	Text	Loan Features
lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:loanFeatures:negativeAmortization	CHECKED, NOT CHECKED	Loan Features
lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:loanFeatures:prepaymentPenalty/PrepaymentPenaltyTerm(Months)-Checkbox	CHECKED, NOT CHECKED	Loan Features
lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:loanFeatures:prepaymentPenalty/PrepaymentPenaltyTerm(Months)	Text	Loan Features
lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:loanFeatures:temporaryInterestRateBuydown/InitialBuydownRate%-Checkbox	CHECKED, NOT CHECKED	Loan Features
lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:loanFeatures:temporaryInterestRateBuydown/InitialBuydownRate%	Percentage	Loan Features
lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:loanFeatures:other(Explain)-Checkbox	CHECKED, NOT CHECKED	Loan Features
lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:loanFeatures:other(Explain)	Text	Loan Features
lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:proposedMonthlyPaymentForProperty:firstMortgage(P&I)	Money	Proposed Monthly Payment For Property
lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:proposedMonthlyPaymentForProperty:subordinateLien(S)(P&I)	Money	Proposed Monthly Payment For Property
lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:proposedMonthlyPaymentForProperty:homeowner'sInsurance	Money	Proposed Monthly Payment For Property
lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:proposedMonthlyPaymentForProperty:supplementalPropertyInsurance	Money	Proposed Monthly Payment For Property
lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:proposedMonthlyPaymentForProperty:propertyTaxes	Money	Proposed Monthly Payment For Property
lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:proposedMonthlyPaymentForProperty:mortgageInsurance	Money	Proposed Monthly Payment For Property
lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:proposedMonthlyPaymentForProperty:association/projectDues(CondoCo-OpPud)	Money	Proposed Monthly Payment For Property
lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:proposedMonthlyPaymentForProperty:other	Money	Proposed Monthly Payment For Property
lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:proposedMonthlyPaymentForProperty:total	Money	Proposed Monthly Payment For Property
lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:dueFromBorrower(S):a-SalesContractPrice	Money	Due From Borrower(s)
lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:dueFromBorrower(S):b-ImprovementsRenovationsAndRepairs	Money	Due From Borrower(s)
lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:dueFromBorrower(S):c-Land(IfAcquiredSeparately)	Money	Due From Borrower(s)
lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:dueFromBorrower(S):d-ForRefinanceBalanceOfMortgageLoansOnThePropertyToBePaidOff	Money	Due From Borrower(s)
lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:dueFromBorrower(S):e-CreditCardsAndOtherDebtsPaidOff	Money	Due From Borrower(s)
lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:dueFromBorrower(S):f-BorrowerClosingCosts(IncludingPrepaidAndInitialEscrowPayments)	Money	Due From Borrower(s)
lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:dueFromBorrower(S):g-DiscountPoints	Money	Due From Borrower(s)
lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:dueFromBorrower(S):h-TotalDueFromBorrower(S)(TotalOfAThruG)	Money	Due From Borrower(s)
lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:totalMortgageLoans-I-LoanAmount:loanAmount	Money	Total Mortgage Loans - I - Loan Amount
lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:totalMortgageLoans-I-LoanAmount:loanAmountExcludingFinancedMortgageInsurance(OrMortgageInsuranceEquivalent)	Money	Total Mortgage Loans - I - Loan Amount
lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:totalMortgageLoans-I-LoanAmount:financedMortgageInsurance(OrMortgageInsuranceEquivalent)Amount	Money	Total Mortgage Loans - I - Loan Amount
lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:totalMortgageLoans:j-OtherNewMortgageLoansOnThePropertyTheBorrower(S)IsBuyingOrRefinancing	Money	Total Mortgage Loans
lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:totalMortgageLoans:k-TotalMortgageLoans(TotalOfIAndJ)	Money	Total Mortgage Loans
lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:totalCredits:l-SellerCredits(EnterTheAmountOfBorrower(S)CostsPaidByThePropertySeller)	Money	Total Credits
lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:totalCredits:m-OtherCredits(EnterTheSumOfAllOtherCredits)	Money	Total Credits
lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:totalCredits:n-TotalCredits(TotalOfLAndM)	Money	Total Credits
lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:calculation:totalDueFromBorrower(S)(LineH)	Money	Calculation
lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:calculation:lessTotalMortgageLoans(LineK)AndTotalCredits(LineN)	Money	Calculation
lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:cashFrom/ToTheBorrower(LineHMinusLineKAndLineN)	Money	Cash From/To The Borrower (Line H Minus Line K And Line N)
Sample document
drive.google.com
LENDER LOAN INFORMATION 1003 2020.pdf
Sample JSON result
JSON
{
  "pk": 40915897,
  "uuid": "c1b0cf80-5734-4d20-884c-40e636798326",
  "name": "API documentations",
  "created": "2023-10-25T17:58:37Z",
  "created_ts": "2023-10-25T17:58:37Z",
  "verified_pages_count": 35,
  "book_status": "ACTIVE",
  "id": 40915897,
  "forms": [
    {
      "pk": 50698862,
      "uuid": "7eab9213-5605-4c63-a450-da0bc7127f8b",
      "uploaded_doc_pk": 61667189,
      "form_type": "LENDER_LOAN_INFORMATION_1003_2020",
      "raw_fields": {
        "lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:dueFromBorrower(S):g-DiscountPoints": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:dueFromBorrower(S):a-SalesContractPrice": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:totalCredits:n-TotalCredits(TotalOfLAndM)": {
          "value": "200.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:calculation:totalDueFromBorrower(S)(LineH)": {
          "value": "700.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:totalMortgageLoans-I-LoanAmount:loanAmount": {
          "value": "200.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:cashFrom/ToTheBorrower(LineHMinusLineKAndLineN)": {
          "value": "200.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:dueFromBorrower(S):c-Land(IfAcquiredSeparately)": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:dueFromBorrower(S):e-CreditCardsAndOtherDebtsPaidOff": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:totalMortgageLoans:k-TotalMortgageLoans(TotalOfIAndJ)": {
          "value": "300.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:dueFromBorrower(S):b-ImprovementsRenovationsAndRepairs": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:totalCredits:m-OtherCredits(EnterTheSumOfAllOtherCredits)": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:dueFromBorrower(S):h-TotalDueFromBorrower(S)(TotalOfAThruG)": {
          "value": "700.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:calculation:lessTotalMortgageLoans(LineK)AndTotalCredits(LineN)": {
          "value": "-500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:dueFromBorrower(S):d-ForRefinanceBalanceOfMortgageLoansOnThePropertyToBePaidOff": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:dueFromBorrower(S):f-BorrowerClosingCosts(IncludingPrepaidAndInitialEscrowPayments)": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:totalCredits:l-SellerCredits(EnterTheAmountOfBorrower(S)CostsPaidByThePropertySeller)": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:totalMortgageLoans:j-OtherNewMortgageLoansOnThePropertyTheBorrower(S)IsBuyingOrRefinancing": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:totalMortgageLoans-I-LoanAmount:financedMortgageInsurance(OrMortgageInsuranceEquivalent)Amount": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part4-L4-QualifyingTheBorrower-MinimumRequiredFundsOrCashBack:totalMortgageLoans-I-LoanAmount:loanAmountExcludingFinancedMortgageInsurance(OrMortgageInsuranceEquivalent)": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-General:agencyCaseNo.": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-General:borrowerName(S)": {
          "value": "JOHN SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part2-L2-TitleInformation:trustInformation": {
          "value": "TITLE WILL BE HELD BY AN INTER VIVOS (LIVING) TRUST",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part2-L2-TitleInformation:estateWillBeHeldIn": {
          "value": "LEASEHOLD EXPIRATION DATE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-General:lenderLoanNo./UniversalLoanIdentifier": {
          "value": "123456789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part1-L1-PropertyAndLoanInformation:projectType": {
          "value": "CONDOMINIUM",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part1-L1-PropertyAndLoanInformation:refinanceType": {
          "value": "NO CASH OUT",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part2-L2-TitleInformation:indianCountryLandTenure": {
          "value": "FEE SIMPLE ON A RESERVATION",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:amortizationType": {
          "value": "ADJUSTABLE RATE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:mortgageLienType": {
          "value": "SUBORDINATE LIEN",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part1-L1-PropertyAndLoanInformation:refinanceProgram": {
          "value": "FULL DOCUMENTATION",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part2-L2-TitleInformation:mannerInWhichTitleWillBeHeld": {
          "value": "SOLE OWNERSHIP",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:termsOfLoan:noteRate%": {
          "value": "10.0000%",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:mortgageTypeAppliedFor": {
          "value": "CONVENTIONAL",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part1-L1-PropertyAndLoanInformation:refinanceProgram-IfOther": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:loanFeatures:other(Explain)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:mortgageTypeAppliedFor-Other": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:termsOfLoan:loanTerm(Months)": {
          "value": "12",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part1-L1-PropertyAndLoanInformation:transactionDetail:renovation": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:amortizationType-Other(Explain)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:loanFeatures:negativeAmortization": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part2-L2-TitleInformation:titleToThePropertyWillBeHeldInWhatName(S)": {
          "value": "SAMPLE DOE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part1-L1-PropertyAndLoanInformation:transactionDetail:lotAcquiredDate": {
          "value": "01/01/2022",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:loanFeatures:other(Explain)-Checkbox": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part1-L1-PropertyAndLoanInformation:transactionDetail:originalCostOfLot": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:proposedMonthlyPaymentForProperty:other": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:proposedMonthlyPaymentForProperty:total": {
          "value": "800.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part2-L2-TitleInformation:estateWillBeHeldIn-LeaseholdExpirationDate:date": {
          "value": "01/01/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:loanFeatures:balloon/BalloonTerm(Months)": {
          "value": "12",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:proposedMonthlyPaymentForProperty:propertyTaxes": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:loanFeatures:balloon/BalloonTerm(Months)-Checkbox": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part1-L1-PropertyAndLoanInformation:transactionDetail:construction/improvementCosts": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:loanFeatures:interestOnly/InterestOnlyTerm(Months)": {
          "value": "12",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part2-L2-TitleInformation:forRefinanceTitleToThePropertyIsCurrentlyHeldInWhatName(S)": {
          "value": "SAMPLE FAKE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:ifAdjustableRate:subsequentAdjustmentPeriod(Months)": {
          "value": "12",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:proposedMonthlyPaymentForProperty:mortgageInsurance": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:proposedMonthlyPaymentForProperty:firstMortgage(P&I)": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:proposedMonthlyPaymentForProperty:homeowner'sInsurance": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:proposedMonthlyPaymentForProperty:subordinateLien(S)(P&I)": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:loanFeatures:interestOnly/InterestOnlyTerm(Months)-Checkbox": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:ifAdjustableRate:initialPeriodPriorToFirstAdjustment(Months)": {
          "value": "12",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:loanFeatures:prepaymentPenalty/PrepaymentPenaltyTerm(Months)": {
          "value": "12",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:loanFeatures:temporaryInterestRateBuydown/InitialBuydownRate%": {
          "value": "10.0000%",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part1-L1-PropertyAndLoanInformation:transactionDetail:conversionOfContractForDeedOrLandContract": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:proposedMonthlyPaymentForProperty:supplementalPropertyInsurance": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part1-L1-PropertyAndLoanInformation:communityPropertyState:thePropertyIsInACommunityPropertyState": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:loanFeatures:prepaymentPenalty/PrepaymentPenaltyTerm(Months)-Checkbox": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part1-L1-PropertyAndLoanInformation:energyImprovement:mortgageLoanWillFinanceEnergy-RelatedImprovements": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:loanFeatures:temporaryInterestRateBuydown/InitialBuydownRate%-Checkbox": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part3-L3-MortgageLoanInformation:proposedMonthlyPaymentForProperty:association/projectDues(CondoCo-OpPud)": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part1-L1-PropertyAndLoanInformation:communityPropertyState:atLeastOneBorrowerLivesInACommunityPropertyState": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part1-L1-PropertyAndLoanInformation:transactionDetail:construction-conversion/construction-to-permanent-Checkbox": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part1-L1-PropertyAndLoanInformation:energyImprovement:propertyIsCurrentlySubjectToALienThatCouldTakePriorityOverTheFirstMortgage": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        },
        "lender_loan_information_1003_2020-Part1-L1-PropertyAndLoanInformation:transactionDetail:construction-conversion/construction-to-permanent-Single-ClosingOrTwo-Closing": {
          "value": "SINGLE-CLOSING",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "LENDER LOAN INFORMATION 1003 2020.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 306107,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 8 months ago

1003 (2020) - Uniform Residential Loan Application (Additional Borrower)
1008 (2009) - Uniform Underwriting and Transmittal Summary
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