# Closing Disclosure

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
Closing Disclosure
Suggest Edits

A Closing Disclosure is a five-page form that provides final details about the mortgage loan you have selected. It includes the loan terms, your projected monthly payments, and how much you will pay in fees and other costs to get your mortgage (closing costs).

To use the Upload PDF endpoint for this document, you must use CLOSING_DISCLOSURE in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
closing_disclosure-Part1-ClosingInformation:dateIssued	Date	Date Issued
closing_disclosure-Part1-ClosingInformation:closingDate	Date	Closing Date
closing_disclosure-Part1-ClosingInformation:distributionDate	Date	Distribution Date
closing_disclosure-Part1-ClosingInformation:salePrice	Money	Sale Price
closing_disclosure-Part1-ClosingInformation:propertyAddress:addressLine1	Text	Property Address
closing_disclosure-Part1-ClosingInformation:propertyAddress:addressLine2	Text	Property Address
closing_disclosure-Part1-ClosingInformation:propertyAddress:city	Text	Property Address
closing_disclosure-Part1-ClosingInformation:propertyAddress:state	State	Property Address
closing_disclosure-Part1-ClosingInformation:propertyAddress:zip	ZIP Code	Property Address
closing_disclosure-Part2-TransactionInformation:borrower1Name	Text	Borrower 1 Name
closing_disclosure-Part2-TransactionInformation:borrower2Name	Text	Borrower 2 Name
closing_disclosure-Part2-TransactionInformation:borrower3Name	Text	Borrower 3 Name
closing_disclosure-Part2-TransactionInformation:borrower4Name	Text	Borrower 4 Name
closing_disclosure-Part2-TransactionInformation:lenderName	Text	Lender Name
closing_disclosure-Part3-LoanInformation:loanTerm	Text	Loan Term
closing_disclosure-Part3-LoanInformation:purpose	PURCHASE, CONSTRUCTION	Purpose
closing_disclosure-Part3-LoanInformation:product	FIXED RATE, ADJUSTABLE RATE	Product
closing_disclosure-Part3-LoanInformation:loanType	CONVENTIONAL, FHA, VA, OTHER	Loan Type
closing_disclosure-Part4-LoanTerm:loanAmount:	Money	Loan Amount
closing_disclosure-Part4-LoanTerm:loanAmount:canThisAmountIncreaseAfterClosing	YES, NO	Loan Amount
closing_disclosure-Part4-LoanTerm:interestRate:	Percentage	Interest Rate
closing_disclosure-Part4-LoanTerm:interestRate:canThisAmountIncreaseAfterClosing	YES, NO	Interest Rate
closing_disclosure-Part4-LoanTerm:monthlyPrincipal&Interest:	Money	Monthly Principal & Interest
closing_disclosure-Part4-LoanTerm:monthlyPrincipal&Interest:canThisAmountIncreaseAfterClosing	YES, NO	Monthly Principal & Interest
closing_disclosure-Part4-LoanTerm:prepaymentPenalty:	Money	Prepayment Penalty
closing_disclosure-Part4-LoanTerm:prepaymentPenalty:doesTheLoanHaveTheseFeature?	YES, NO	Prepayment Penalty
closing_disclosure-Part4-LoanTerm:balloonPayment:	Money	Balloon Payment
closing_disclosure-Part4-LoanTerm:balloonPayment:doesTheLoanHaveTheseFeature?	YES, NO	Balloon Payment
closing_disclosure-Part5-ProjectedPayments:paymentCalculation:principal&Interest(Years1-7)	Money	Payment Calculation
closing_disclosure-Part5-ProjectedPayments:paymentCalculation:mortgageInsurance(Years1-7)	Money	Payment Calculation
closing_disclosure-Part5-ProjectedPayments:paymentCalculation:estimatedEscrow(Years1-7)	Money	Payment Calculation
closing_disclosure-Part5-ProjectedPayments:paymentCalculation:principal&Interest(Years8-30)	Money	Payment Calculation
closing_disclosure-Part5-ProjectedPayments:paymentCalculation:mortgageInsurance(Years8-30)	Money	Payment Calculation
closing_disclosure-Part5-ProjectedPayments:paymentCalculation:estimatedEscrow(Years8-30)	Money	Payment Calculation
closing_disclosure-Part5-ProjectedPayments:estimatedTotalMonthlyPayment:years1-7	Money	Estimated Total Monthly Payment
closing_disclosure-Part5-ProjectedPayments:estimatedTotalMonthlyPayment:years8-30	Money	Estimated Total Monthly Payment
closing_disclosure-Part5-ProjectedPayments:estimatedTaxesInsurance&Assessments:	Money	Estimated Taxes Insurance & Assessments
closing_disclosure-Part5-ProjectedPayments:estimatedTaxesInsurance&Assessments:paymentFrequency	Text	Estimated Taxes Insurance & Assessments
closing_disclosure-Part5-ProjectedPayments:estimatedTaxesInsurance&Assessments:thisEstimateIncludes-PropertyTaxes	CHECKED, NOT CHECKED	Estimated Taxes Insurance & Assessments
closing_disclosure-Part5-ProjectedPayments:estimatedTaxesInsurance&Assessments:inEscrow?-PropertyTaxes	YES, NO	Estimated Taxes Insurance & Assessments
closing_disclosure-Part5-ProjectedPayments:estimatedTaxesInsurance&Assessments:thisEstimateIncludes-Homeowner'SInsurance	CHECKED, NOT CHECKED	Estimated Taxes Insurance & Assessments
closing_disclosure-Part5-ProjectedPayments:estimatedTaxesInsurance&Assessments:inEscrow?-Homeowner'SInsurance	YES, NO	Estimated Taxes Insurance & Assessments
closing_disclosure-Part5-ProjectedPayments:estimatedTaxesInsurance&Assessments:thisEstimateIncludes-Other	CHECKED, NOT CHECKED	Estimated Taxes Insurance & Assessments
closing_disclosure-Part5-ProjectedPayments:estimatedTaxesInsurance&Assessments:thisEstimateIncludes-Other-Description	Text	Estimated Taxes Insurance & Assessments
closing_disclosure-Part5-ProjectedPayments:estimatedTaxesInsurance&Assessments:inEscrow?-Other	YES, NO	Estimated Taxes Insurance & Assessments
closing_disclosure-Part6-CostsAtClosing:closingCosts	Money	Closing Costs
closing_disclosure-Part6-CostsAtClosing:cashToClose	Money	Cash To Close
closing_disclosure-Part7-LoanDisclosures:assumption:ifYouSellOrTransferThisPropertyToAnotherPerson	WILL ALLOW UNDER CERTAIN CONDITIONS THIS PERSON TO ASSUME THIS LOAN ON THE ORIGINAL TERMS, WILL NOT ALLOW ASSUMPTION OF THIS LOAN ON THE ORIGINAL TERMS	Assumption
closing_disclosure-Part7-LoanDisclosures:demandFeature:yourLoan	HAS A DEMAND FEATURE WHICH PERMITS YOUR LENDER TO REQUIRE EARLY REPAYMENT OF THE LOAN, DOES NOT HAVE A DEMAND FEATURE	Demand Feature
closing_disclosure-Part7-LoanDisclosures:negativeAmortization:underYourLoanTerms	ARE SCHEDULED TO MAKE MONTHLY PAYMENTS THAT DO NOT PAY ALL OF THE INTEREST DUE THAT MONTH, MAY HAVE MONTHLY PAYMENTS THAT DO NOT PAY ALL OF THE INTEREST DUE THAT MONTH, DO NOT HAVE A NEGATIVE AMORTIZATION FEATURE	Negative Amortization
closing_disclosure-Part7-LoanDisclosures:partialPayments:yourLender	MAY ACCEPT PAYMENTS THAT ARE LESS THAN THE FULL AMOUNT DUE AND APPLY THEM TO YOUR LOAN, MAY HOLD THEM IN A SEPARATE ACCOUNT UNTIL YOU PAY THE REST OF THE PAYMENT, DOES NOT ACCEPT ANY PARTIAL PAYMENTS	Partial Payments
closing_disclosure-Part7-LoanDisclosures:securityInterestAddress:addressLine1	Text	Security Interest Address
closing_disclosure-Part7-LoanDisclosures:securityInterestAddress:addressLine2	Text	Security Interest Address
closing_disclosure-Part7-LoanDisclosures:securityInterestAddress:city	Text	Security Interest Address
closing_disclosure-Part7-LoanDisclosures:securityInterestAddress:state	State	Security Interest Address
closing_disclosure-Part7-LoanDisclosures:securityInterestAddress:zip	ZIP Code	Security Interest Address
closing_disclosure-Part7-LoanDisclosures:escrowAccount:forNowYourLoan	WILL HAVE AN ESCROW ACCOUNT, WILL NOT HAVE AN ESCROW ACCOUNT	Escrow Account
closing_disclosure-Part7-LoanDisclosures:escrow:escrowedPropertyCostsOverYear1	Money	Escrow
closing_disclosure-Part7-LoanDisclosures:escrow:non-escrowedPropertyCostsOverYear1	Money	Escrow
closing_disclosure-Part7-LoanDisclosures:escrow:initialEscrowPayment	Money	Escrow
closing_disclosure-Part7-LoanDisclosures:escrow:monthlyEscrowPayment	Money	Escrow
closing_disclosure-Part7-LoanDisclosures:willNotHaveAnEscrowAccountBecause	YOU DECLINED IT, YOUR LENDER DOES NOT OFFER ONE	Will Not Have An Escrow Account Because
closing_disclosure-Part7-LoanDisclosures:noEscrow:estimatedPropertyCostsOverYear1	Money	No Escrow
closing_disclosure-Part7-LoanDisclosures:noEscrow:escrowWaiverFee	Money	No Escrow
closing_disclosure-Part8-LoanCalculations:totalOfPayments	Money	Total Of Payments
closing_disclosure-Part8-LoanCalculations:financeCharge	Money	Finance Charge
closing_disclosure-Part8-LoanCalculations:amountFinanced	Money	Amount Financed
closing_disclosure-Part8-LoanCalculations:annualPercentageRate(Apr)	Percentage	Annual Percentage Rate (Apr)
closing_disclosure-Part8-LoanCalculations:totalInterestPercentage(Tip)	Percentage	Total Interest Percentage (Tip)
closing_disclosure-Part9-ConfirmReceipt:applicantSignature	SIGNED, NOT SIGNED	Applicant Signature
closing_disclosure-Part9-ConfirmReceipt:applicantSignatureDate	Date	Applicant Signature Date
closing_disclosure-Part9-ConfirmReceipt:co-applicantSignature	SIGNED, NOT SIGNED	Co-Applicant Signature
closing_disclosure-Part9-ConfirmReceipt:co-applicantSignatureDate	Date	Co-Applicant Signature Date
Sample document
drive.google.com
Closing Disclosure.pdf
Sample JSON result
JSON
{
   "status":200,
   "response":{
      "pk":30723243,
      "uuid":"bd5215cc-b333-4e28-9364-222dee6a436b",
      "name":"Closing Disclosure",
      "created":"2023-03-15T14:05:38Z",
      "created_ts":"2023-03-15T14:05:38Z",
      "verified_pages_count":5,
      "book_status":"ACTIVE",
      "id":30723243,
      "forms":[
         {
            "pk":45009949,
            "uuid":"cd1cde86-589b-447e-8f56-03ba786108af",
            "uploaded_doc_pk":52915161,
            "form_type":"CLOSING_DISCLOSURE",
            "raw_fields":{
               "closing_disclosure-Part8-LoanCalculations:financeCharge":{
                  "value":"118830.27",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part8-LoanCalculations:amountFinanced":{
                  "value":"162000.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part8-LoanCalculations:totalOfPayments":{
                  "value":"285803.36",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part9-ConfirmReceipt:applicantSignature":{
                  "value":"NOT SIGNED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part9-ConfirmReceipt:co-applicantSignature":{
                  "value":"NOT SIGNED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part9-ConfirmReceipt:applicantSignatureDate":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part9-ConfirmReceipt:co-applicantSignatureDate":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part8-LoanCalculations:annualPercentageRate(Apr)":{
                  "value":"4.174%",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part8-LoanCalculations:totalInterestPercentage(Tip)":{
                  "value":"69.46%",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part7-LoanDisclosures:demandFeature:yourLoan":{
                  "value":"DOES NOT HAVE A DEMAND FEATURE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part7-LoanDisclosures:noEscrow:escrowWaiverFee":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part7-LoanDisclosures:partialPayments:yourLender":{
                  "value":"MAY ACCEPT PAYMENTS THAT ARE LESS THAN THE FULL AMOUNT DUE AND APPLY THEM TO YOUR LOAN",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part7-LoanDisclosures:escrow:initialEscrowPayment":{
                  "value":"412.25",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part7-LoanDisclosures:escrow:monthlyEscrowPayment":{
                  "value":"206.13",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part7-LoanDisclosures:securityInterestAddress:zip":{
                  "value":"14420",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part7-LoanDisclosures:escrowAccount:forNowYourLoan":{
                  "value":"WILL HAVE AN ESCROW ACCOUNT",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part7-LoanDisclosures:securityInterestAddress:city":{
                  "value":"ANYTOWN",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part7-LoanDisclosures:securityInterestAddress:state":{
                  "value":"NY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part7-LoanDisclosures:willNotHaveAnEscrowAccountBecause":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part7-LoanDisclosures:securityInterestAddress:addressLine1":{
                  "value":"456 SOMEWHERE AVE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part7-LoanDisclosures:securityInterestAddress:addressLine2":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part7-LoanDisclosures:escrow:escrowedPropertyCostsOverYear1":{
                  "value":"2473.56",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part7-LoanDisclosures:negativeAmortization:underYourLoanTerms":{
                  "value":"DO NOT HAVE A NEGATIVE AMORTIZATION FEATURE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part7-LoanDisclosures:noEscrow:estimatedPropertyCostsOverYear1":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part7-LoanDisclosures:escrow:non-escrowedPropertyCostsOverYear1":{
                  "value":"1800.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part7-LoanDisclosures:assumption:ifYouSellOrTransferThisPropertyToAnotherPerson":{
                  "value":"WILL NOT ALLOW ASSUMPTION OF THIS LOAN ON THE ORIGINAL TERMS",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part4-LoanTerm:loanAmount:":{
                  "value":"162000.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part4-LoanTerm:interestRate:":{
                  "value":"3.875%",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part3-LoanInformation:product":{
                  "value":"FIXED RATE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part3-LoanInformation:purpose":{
                  "value":"PURCHASE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part3-LoanInformation:loanTerm":{
                  "value":"30 YEARS",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part3-LoanInformation:loanType":{
                  "value":"CONVENTIONAL",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part4-LoanTerm:balloonPayment:":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part6-CostsAtClosing:cashToClose":{
                  "value":"14147.26",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part4-LoanTerm:prepaymentPenalty:":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part6-CostsAtClosing:closingCosts":{
                  "value":"9712.10",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part1-ClosingInformation:salePrice":{
                  "value":"180000.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part1-ClosingInformation:dateIssued":{
                  "value":"04/15/2013",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part1-ClosingInformation:closingDate":{
                  "value":"04/15/2013",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part2-TransactionInformation:lenderName":{
                  "value":"FAKE BANK",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part1-ClosingInformation:disbursementDate":{
                  "value":"04/15/2013",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part4-LoanTerm:monthlyPrincipal&Interest:":{
                  "value":"761.78",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part2-TransactionInformation:borrower1Name":{
                  "value":"MICHAEL SAMPLE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part2-TransactionInformation:borrower2Name":{
                  "value":"MARY FAKE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part2-TransactionInformation:borrower3Name":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part2-TransactionInformation:borrower4Name":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part1-ClosingInformation:propertyAddress:zip":{
                  "value":"12345",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part1-ClosingInformation:propertyAddress:city":{
                  "value":"ANYTOWN",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part1-ClosingInformation:propertyAddress:state":{
                  "value":"NY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part1-ClosingInformation:propertyAddress:addressLine1":{
                  "value":"123 SOMEWHERE AVE",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part1-ClosingInformation:propertyAddress:addressLine2":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part4-LoanTerm:balloonPayment:doesTheLoanHaveTheseFeature?":{
                  "value":"NO",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part4-LoanTerm:loanAmount:canThisAmountIncreaseAfterClosing":{
                  "value":"NO",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part5-ProjectedPayments:estimatedTaxesInsurance&Assessments:":{
                  "value":"356.13",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part4-LoanTerm:interestRate:canThisAmountIncreaseAfterClosing":{
                  "value":"NO",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part4-LoanTerm:prepaymentPenalty:doesTheLoanHaveTheseFeature?":{
                  "value":"YES",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part5-ProjectedPayments:estimatedTotalMonthlyPayment:years1-7":{
                  "value":"1050.26",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part5-ProjectedPayments:estimatedTotalMonthlyPayment:years8-30":{
                  "value":"967.91",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part5-ProjectedPayments:paymentCalculation:estimatedEscrow(Years1-7)":{
                  "value":"206.13",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part5-ProjectedPayments:paymentCalculation:estimatedEscrow(Years8-30)":{
                  "value":"206.13",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part5-ProjectedPayments:paymentCalculation:mortgageInsurance(Years1-7)":{
                  "value":"82.35",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part5-ProjectedPayments:paymentCalculation:mortgageInsurance(Years8-30)":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part5-ProjectedPayments:paymentCalculation:principal&Interest(Years1-7)":{
                  "value":"761.78",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part5-ProjectedPayments:paymentCalculation:principal&Interest(Years8-30)":{
                  "value":"761.78",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part4-LoanTerm:monthlyPrincipal&Interest:canThisAmountIncreaseAfterClosing":{
                  "value":"NO",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part5-ProjectedPayments:estimatedTaxesInsurance&Assessments:inEscrow?-Other":{
                  "value":"NO",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part5-ProjectedPayments:estimatedTaxesInsurance&Assessments:paymentFrequency":{
                  "value":"A MONTH",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part5-ProjectedPayments:estimatedTaxesInsurance&Assessments:inEscrow?-PropertyTaxes":{
                  "value":"YES",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part5-ProjectedPayments:estimatedTaxesInsurance&Assessments:thisEstimateIncludes-Other":{
                  "value":"CHECKED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part5-ProjectedPayments:estimatedTaxesInsurance&Assessments:inEscrow?-Homeowner'SInsurance":{
                  "value":"YES",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part5-ProjectedPayments:estimatedTaxesInsurance&Assessments:thisEstimateIncludes-PropertyTaxes":{
                  "value":"CHECKED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part5-ProjectedPayments:estimatedTaxesInsurance&Assessments:thisEstimateIncludes-Other-Description":{
                  "value":"HOMEOWNER'S ASSOCIATION DUES",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               },
               "closing_disclosure-Part5-ProjectedPayments:estimatedTaxesInsurance&Assessments:thisEstimateIncludes-Homeowner'SInsurance":{
                  "value":"CHECKED",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Closing Disclosure.pdf"
               }
            },
            "form_config_pk":209635,
            "tables":[
               
            ]
         }
      ],
      "book_is_complete":true
   },
   "message":"OK"
}


Updated 11 months ago

CAIVRS Authorization
Closing Protection Letter
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