# Loan Estimate

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
Loan Estimate
Suggest Edits

The form provides you with important information, including the estimated interest rate, monthly payment, and total closing costs for the loan. The Loan Estimate also gives you information about the estimated costs of taxes and insurance, and how the interest rate and payments may change in the future.

To use the Upload PDF endpoint for this document, you must use LOAN_ESTIMATE in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
loan_estimate-Part1-General:dateIssued	Date	Date Issued
loan_estimate-Part1-General:borrower1Name	Text	Borrower 1 Name
loan_estimate-Part1-General:borrower2Name	Text	Borrower 2 Name
loan_estimate-Part1-General:borrower3Name	Text	Borrower 3 Name
loan_estimate-Part1-General:borrower4Name	Text	Borrower 4 Name
loan_estimate-Part1-General:lenderName	Text	Lender Name
loan_estimate-Part1-General:propertyAddress:addressLine1	Text	Property Address
loan_estimate-Part1-General:propertyAddress:addressLine2	Text	Property Address
loan_estimate-Part1-General:propertyAddress:city	Text	Property Address
loan_estimate-Part1-General:propertyAddress:state	State	Property Address
loan_estimate-Part1-General:propertyAddress:zip	ZIP Code	Property Address
loan_estimate-Part1-General:salePrice	Money	Sale Price
loan_estimate-Part1-General:loanTerm	Text	Loan Term
loan_estimate-Part1-General:purpose	Text	Purpose
loan_estimate-Part1-General:product	Text	Product
loan_estimate-Part1-General:loanType	CONVENTIONAL, FHA, VA	Loan Type
loan_estimate-Part1-General:loanId#	Text	Loan Id #
loan_estimate-Part1-General:rateLock	YES, NO	Rate Lock
loan_estimate-Part2-LoanTerms:loanAmount:	Money	Loan Amount
loan_estimate-Part2-LoanTerms:loanAmount:canThisAmountIncreaseAfterClosing?	YES, NO	Loan Amount
loan_estimate-Part2-LoanTerms:interestRate:	Percentage	Interest Rate
loan_estimate-Part2-LoanTerms:interestRate:canThisAmountIncreaseAfterClosing?	YES, NO	Interest Rate
loan_estimate-Part2-LoanTerms:monthlyPrincipal&Interest:	Money	Monthly Principal & Interest
loan_estimate-Part2-LoanTerms:monthlyPrincipal&Interest:canThisAmountIncreaseAfterClosing?	YES, NO	Monthly Principal & Interest
loan_estimate-Part2-LoanTerms:prepaymentPenalty:	Money	Prepayment Penalty
loan_estimate-Part2-LoanTerms:prepaymentPenalty:doesTheLoanHaveTheseFeatures?	YES, NO	Prepayment Penalty
loan_estimate-Part2-LoanTerms:balloonPayment:	Money	Balloon Payment
loan_estimate-Part2-LoanTerms:balloonPayment:doesTheLoanHaveTheseFeatures?	YES, NO	Balloon Payment
loan_estimate-Part3-ProjectedPayments:paymentCalculation:principal&Interest(Years1-7)	Money	Payment Calculation
loan_estimate-Part3-ProjectedPayments:paymentCalculation:principal&Interest(Years8-30)	Money	Payment Calculation
loan_estimate-Part3-ProjectedPayments:paymentCalculation:mortgageInsurance(Years1-7)	Money	Payment Calculation
loan_estimate-Part3-ProjectedPayments:paymentCalculation:mortgageInsurance(Years8-30)	Money	Payment Calculation
loan_estimate-Part3-ProjectedPayments:paymentCalculation:estimatedEscrow(Years1-7)	Money	Payment Calculation
loan_estimate-Part3-ProjectedPayments:paymentCalculation:estimatedEscrow(Years8-30)	Money	Payment Calculation
loan_estimate-Part3-ProjectedPayments:estimatedTotalMonthlyPayment:years1-7	Money	Estimated Total Monthly Payment
loan_estimate-Part3-ProjectedPayments:estimatedTotalMonthlyPayment:years8-30	Money	Estimated Total Monthly Payment
loan_estimate-Part3-ProjectedPayments:estimatedTaxesInsurance&Assessments:	Money	Estimated Taxes Insurance & Assessments
loan_estimate-Part3-ProjectedPayments:estimatedTaxesInsurance&Assessments:paymentFrequency	Text	Estimated Taxes Insurance & Assessments
loan_estimate-Part3-ProjectedPayments:estimatedTaxesInsurance&Assessments:thisEstimateIncludes-PropertyTaxes	CHECKED, NOT CHECKED	Estimated Taxes Insurance & Assessments
loan_estimate-Part3-ProjectedPayments:estimatedTaxesInsurance&Assessments:inEscrow?-PropertyTaxes	YES, NO	Estimated Taxes Insurance & Assessments
loan_estimate-Part3-ProjectedPayments:estimatedTaxesInsurance&Assessments:thisEstimateIncludes-Homeowner'SInsurance	CHECKED, NOT CHECKED	Estimated Taxes Insurance & Assessments
loan_estimate-Part3-ProjectedPayments:estimatedTaxesInsurance&Assessments:inEscrow?-Homeowner'SInsurance	YES, NO	Estimated Taxes Insurance & Assessments
loan_estimate-Part3-ProjectedPayments:estimatedTaxesInsurance&Assessments:thisEstimateIncludes-Other	CHECKED, NOT CHECKED	Estimated Taxes Insurance & Assessments
loan_estimate-Part3-ProjectedPayments:estimatedTaxesInsurance&Assessments:thisEstimateIncludes-Other-Description	Text	Estimated Taxes Insurance & Assessments
loan_estimate-Part3-ProjectedPayments:estimatedTaxesInsurance&Assessments:inEscrow?-Other	YES, NO	Estimated Taxes Insurance & Assessments
loan_estimate-Part4-CostsAtClosing:estimatedClosingCosts	Money	Estimated Closing Costs
loan_estimate-Part4-CostsAtClosing:estimatedCashToClose	Money	Estimated Cash To Close
loan_estimate-Part5-Comparisons:in5Years:totalYouWillHavePaidInPrincipalInterestMortgageInsuranceAndLoanCosts	Money	In 5 Years
loan_estimate-Part5-Comparisons:in5Years:principalYouWillHavePaidOff	Money	In 5 Years
loan_estimate-Part5-Comparisons:annualPercentageRate(Apr)	Percentage	Annual Percentage Rate (APR)
loan_estimate-Part5-Comparisons:totalInterestPercentage(Tip)	Percentage	Total Interest Percentage (TIP)
loan_estimate-Part6-OtherConsiderations:appraisal	Text	Appraisal
loan_estimate-Part6-OtherConsiderations:assumption	WILL ALLOW UNDER CERTAIN CONDITIONS THIS PERSON TO ASSUME THIS LOAN ON THE ORIGINAL TERMS, WILL NOT ALLOW ASSUMPTION OF THIS LOAN ON THE ORIGINAL TERMS	Assumption
loan_estimate-Part6-OtherConsiderations:homeowner'sInsurance	Text	Homeowner's Insurance
loan_estimate-Part6-OtherConsiderations:latePayment	Text	Late Payment
loan_estimate-Part6-OtherConsiderations:refinance	Text	Refinance
loan_estimate-Part6-OtherConsiderations:servicing	TO SERVICE YOUR LOAN IF SO YOU WILL MAKE YOUR PAYMENTS TO US, TO TRANSFER SERVICING OF YOUR LOAN	Servicing
loan_estimate-Part7-ConfirmReceipt:applicantSignature	SIGNED, NOT SIGNED	Applicant Signature
loan_estimate-Part7-ConfirmReceipt:applicantSignatureDate	Date	Applicant Signature Date
loan_estimate-Part7-ConfirmReceipt:co-applicantSignature	SIGNED, NOT SIGNED	Co-Applicant Signature
loan_estimate-Part7-ConfirmReceipt:co-applicantSignatureDate	Date	Co-Applicant Signature Date
Sample document
drive.google.com
Loan Estimate.pdf
Sample JSON result
JSON
{
    "status": 200,
    "response": {
        "pk": 29946544,
        "uuid": "2410cd7f-b35d-46ba-b956-ac31f8e4b57b",
        "forms": [
            {
                "pk": 44474654,
                "uuid": "41d45c41-cf72-4ae5-92f9-2274d83108f6",
                "uploaded_doc_pk": 52114514,
                "form_type": "LOAN_ESTIMATE",
                "raw_fields": {
                    "loan_estimate-Part1-General:lenderName": {
                        "value": "FICUS BANK FAKE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part6-OtherConsiderations:appraisal": {
                        "value": "WE MAY ORDER AN APPRAISAL TO DETERMINE THE PROPERTY'S VALUE AND CHARGE YOU FOR THIS APPRAISAL. WE WILL PROMPTLY GIVE YOU A COPY OF ANY APPRAISAL, EVEN IF YOUR LOAN DOES NOT CLOSE. YOU CAN PAY FOR AN ADDITIONAL APPRAISAL FOR YOUR OWN USE AT YOUR OWN COST.",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part6-OtherConsiderations:refinance": {
                        "value": "REFINANCING THIS LOAN WILL DEPEND ON YOUR FUTURE FINANCIAL SITUATION, THE PROPERTY VALUE, AND MARKET CONDITIONS. YOU MAY NOT BE ABLE TO REFINANCE THIS LOAN.",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part6-OtherConsiderations:servicing": {
                        "value": "TO TRANSFER SERVICING OF YOUR LOAN",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part6-OtherConsiderations:assumption": {
                        "value": "WILL NOT ALLOW ASSUMPTION OF THIS LOAN ON THE ORIGINAL TERMS",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part6-OtherConsiderations:latePayment": {
                        "value": "IF YOUR PAYMENT IS MORE THAN 15 DAYS LATE, WE WILL CHARGE A LATE FEE OF 5% OF THE MONTHLY PRINCIPAL AND INTEREST PAYMENT.",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part7-ConfirmReceipt:applicantSignature": {
                        "value": "SIGNED",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part7-ConfirmReceipt:co-applicantSignature": {
                        "value": "SIGNED",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part5-Comparisons:annualPercentageRate(Apr)": {
                        "value": "4.274%",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part7-ConfirmReceipt:applicantSignatureDate": {
                        "value": "02/01/2013",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part5-Comparisons:totalInterestPercentage(Tip)": {
                        "value": "69.45%",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part6-OtherConsiderations:homeowner'sInsurance": {
                        "value": "THIS IOAN REQUIRES HOMEOWNER'S INSURANCE ON THE PROPERTY, WHICH YOU MAY OBTAIN FROM A COMPANY OF YOUR CHOICE THAT WE FIND ACCEPTABLE.",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part7-ConfirmReceipt:co-applicantSignatureDate": {
                        "value": "02/01/2013",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part5-Comparisons:in5Years:principalYouWillHavePaidOff": {
                        "value": "15773.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part5-Comparisons:in5Years:totalYouWillHavePaidInPrincipalInterestMortgageInsuranceAndLoanCosts": {
                        "value": "56582.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part1-General:loanId#": {
                        "value": "123456789",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part1-General:product": {
                        "value": "FIXED RATE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part1-General:purpose": {
                        "value": "PURCHASE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part1-General:loanTerm": {
                        "value": "30 YEARS",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part1-General:loanType": {
                        "value": "CONVENTIONAL",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part1-General:rateLock": {
                        "value": "YES",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part1-General:salePrice": {
                        "value": "180000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part1-General:dateIssued": {
                        "value": "02/15/2013",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part1-General:borrower1Name": {
                        "value": "MICHAEL SAMPLE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part1-General:borrower2Name": {
                        "value": "FAKE STONE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part1-General:borrower3Name": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part1-General:borrower4Name": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part2-LoanTerms:loanAmount:": {
                        "value": "162000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part2-LoanTerms:interestRate:": {
                        "value": "3.875%",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part2-LoanTerms:balloonPayment:": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part1-General:propertyAddress:zip": {
                        "value": "12345",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part1-General:propertyAddress:city": {
                        "value": "ANYTOWN",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part2-LoanTerms:prepaymentPenalty:": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part1-General:propertyAddress:state": {
                        "value": "SC",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part4-CostsAtClosing:estimatedCashToClose": {
                        "value": "16054.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part1-General:propertyAddress:addressLine1": {
                        "value": "123 SOMEWHERE AVENUE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part1-General:propertyAddress:addressLine2": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part2-LoanTerms:monthlyPrincipal&Interest:": {
                        "value": "761.78",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part4-CostsAtClosing:estimatedClosingCosts": {
                        "value": "8054.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part2-LoanTerms:balloonPayment:doesTheLoanHaveTheseFeatures?": {
                        "value": "NO",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part3-ProjectedPayments:estimatedTaxesInsurance&Assessments:": {
                        "value": "206.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part2-LoanTerms:loanAmount:canThisAmountIncreaseAfterClosing?": {
                        "value": "NO",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part3-ProjectedPayments:estimatedTotalMonthlyPayment:years1-7": {
                        "value": "1049.78",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part3-ProjectedPayments:estimatedTotalMonthlyPayment:years8-30": {
                        "value": "967.78",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part2-LoanTerms:interestRate:canThisAmountIncreaseAfterClosing?": {
                        "value": "NO",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part2-LoanTerms:prepaymentPenalty:doesTheLoanHaveTheseFeatures?": {
                        "value": "YES",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part3-ProjectedPayments:paymentCalculation:estimatedEscrow(Years1-7)": {
                        "value": "206.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part3-ProjectedPayments:paymentCalculation:estimatedEscrow(Years8-30)": {
                        "value": "206.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part3-ProjectedPayments:paymentCalculation:mortgageInsurance(Years1-7)": {
                        "value": "82.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part3-ProjectedPayments:paymentCalculation:mortgageInsurance(Years8-30)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part3-ProjectedPayments:paymentCalculation:principal&Interest(Years1-7)": {
                        "value": "761.78",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part3-ProjectedPayments:paymentCalculation:principal&Interest(Years8-30)": {
                        "value": "761.78",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part3-ProjectedPayments:estimatedTaxesInsurance&Assessments:inEscrow?-Other": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part2-LoanTerms:monthlyPrincipal&Interest:canThisAmountIncreaseAfterClosing?": {
                        "value": "NO",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part3-ProjectedPayments:estimatedTaxesInsurance&Assessments:paymentFrequency": {
                        "value": "A MONTH",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part3-ProjectedPayments:estimatedTaxesInsurance&Assessments:inEscrow?-PropertyTaxes": {
                        "value": "YES",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part3-ProjectedPayments:estimatedTaxesInsurance&Assessments:thisEstimateIncludes-Other": {
                        "value": "NOT CHECKED",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part3-ProjectedPayments:estimatedTaxesInsurance&Assessments:inEscrow?-Homeowner'SInsurance": {
                        "value": "YES",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part3-ProjectedPayments:estimatedTaxesInsurance&Assessments:thisEstimateIncludes-PropertyTaxes": {
                        "value": "CHECKED",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part3-ProjectedPayments:estimatedTaxesInsurance&Assessments:thisEstimateIncludes-Other-Description": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    },
                    "loan_estimate-Part3-ProjectedPayments:estimatedTaxesInsurance&Assessments:thisEstimateIncludes-Homeowner'SInsurance": {
                        "value": "CHECKED",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Loan Estimate.pdf"
                    }
                },
                "form_config_pk": 103535,
                "tables": []
            },
    "message": "OK"
}


Updated 11 months ago

IRS Form 4506-T - Request for Transcript of Tax Return
Mortgage Insurance Certificate
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