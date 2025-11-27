# IRS Form 1120S Schedules L, M-1, and M-2 (2018) - Balance Sheet (L), Income Reconciliation (M-1), and Analysis (M-2) of S Corporation's Financial Activity Report

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
IRS Form 1120S Schedules L, M-1, and M-2 (2018) - Balance Sheet (L), Income Reconciliation (M-1), and Analysis (M-2) of S Corporation's Financial Activity Report
Suggest Edits

IRS Form 1120S Schedule L - Balance Sheets per Books is the section in Form 1120S - U.S. Income Tax Return for an S Corporation where the corporation reports to the IRS their Balance Sheet as found in the corporation's books and records.

Schedule M-1 is required when the corporation's gross receipts or its total assets at the end of the year are greater than $250,000.

Schedule M-2 analyzes adjustments to the accumulated earnings account, other adjustments account, and previously taxed income account.

To use the Upload PDF endpoint for this document, you must use A_1120s_SCHEDULE_L_M_1_M_2_2018 in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:year	Integer	Year
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line1-Cash:beginningOfTaxYear(B)	Money	Line 1 - Cash
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line1-Cash:endOfTaxYear(D)	Money	Line 1 - Cash
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line2A-TradeNotesAndAccountsReceivable:beginningOfTaxYear(A)	Money	Line 2A - Trade Notes And Accounts Receivable
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line2A-TradeNotesAndAccountsReceivable:endOfTaxYear(C)	Money	Line 2A - Trade Notes And Accounts Receivable
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line2B-LessAllowanceForBadDebts:beginningOfTaxYear(A)	Money	Line 2B - Less Allowance For Bad Debts
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line2B-LessAllowanceForBadDebts:beginningOfTaxYear(B)	Money	Line 2B - Less Allowance For Bad Debts
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line2B-LessAllowanceForBadDebts:endOfTaxYear(C)	Money	Line 2B - Less Allowance For Bad Debts
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line2B-LessAllowanceForBadDebts:endOfTaxYear(D)	Money	Line 2B - Less Allowance For Bad Debts
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line3-Inventories:beginningOfTaxYear(B)	Money	Line 3 - Inventories
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line3-Inventories:endOfTaxYear(D)	Money	Line 3 - Inventories
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line4-U.S.GovernmentObligations:beginningOfTaxYear(B)	Money	Line 4 - U.S. Government Obligations
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line4-U.S.GovernmentObligations:endOfTaxYear(D)	Money	Line 4 - U.S. Government Obligations
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line5-Tax-ExemptSecurities(SeeInstructions):beginningOfTaxYear(B)	Money	Line 5 - Tax-Exempt Securities (See Instructions)
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line5-Tax-ExemptSecurities(SeeInstructions):endOfTaxYear(D)	Money	Line 5 - Tax-Exempt Securities (See Instructions)
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line6-OtherCurrentAssets(AttachStatement):beginningOfTaxYear(B)	Money	Line 6 - Other Current Assets (Attach Statement)
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line6-OtherCurrentAssets(AttachStatement):endOfTaxYear(D)	Money	Line 6 - Other Current Assets (Attach Statement)
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line7-LoansToShareholders:beginningOfTaxYear(B)	Money	Line 7 - Loans To Shareholders
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line7-LoansToShareholders:endOfTaxYear(D)	Money	Line 7 - Loans To Shareholders
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line8-MortgageAndRealEstateLoans:beginningOfTaxYear(B)	Money	Line 8 - Mortgage And Real Estate Loans
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line8-MortgageAndRealEstateLoans:endOfTaxYear(D)	Money	Line 8 - Mortgage And Real Estate Loans
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line9-OtherInvestments(AttachStatement):beginningOfTaxYear(B)	Money	Line 9 - Other Investments (Attach Statement)
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line9-OtherInvestments(AttachStatement):endOfTaxYear(D)	Money	Line 9 - Other Investments (Attach Statement)
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line10A-BuildingsAndOtherDepreciableAssets:beginningOfTaxYear(A)	Money	Line 10A - Buildings And Other Depreciable Assets
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line10A-BuildingsAndOtherDepreciableAssets:endOfTaxYear(C)	Money	Line 10A - Buildings And Other Depreciable Assets
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line10B-LessAccumulatedDepreciation:beginningOfTaxYear(A)	Money	Line 10B - Less Accumulated Depreciation
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line10B-LessAccumulatedDepreciation:beginningOfTaxYear(B)	Money	Line 10B - Less Accumulated Depreciation
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line10B-LessAccumulatedDepreciation:endOfTaxYear(C)	Money	Line 10B - Less Accumulated Depreciation
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line10B-LessAccumulatedDepreciation:endOfTaxYear(D)	Money	Line 10B - Less Accumulated Depreciation
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line11A-DepletableAssets:beginningOfTaxYear(A)	Money	Line 11A - Depletable Assets
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line11A-DepletableAssets:endOfTaxYear(C)	Money	Line 11A - Depletable Assets
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line11B-LessAccumulatedDepletion:beginningOfTaxYear(A)	Money	Line 11B - Less Accumulated Depletion
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line11B-LessAccumulatedDepletion:beginningOfTaxYear(B)	Money	Line 11B - Less Accumulated Depletion
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line11B-LessAccumulatedDepletion:endOfTaxYear(C)	Money	Line 11B - Less Accumulated Depletion
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line11B-LessAccumulatedDepletion:endOfTaxYear(D)	Money	Line 11B - Less Accumulated Depletion
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line12-Land(NetOfAnyAmortization):beginningOfTaxYear(B)	Money	Line 12 - Land (Net Of Any Amortization)
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line12-Land(NetOfAnyAmortization):endOfTaxYear(D)	Money	Line 12 - Land (Net Of Any Amortization)
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line13A-IntangibleAssets(AmortizableOnly):beginningOfTaxYear(A)	Money	Line 13A - Intangible Assets (Amortizable Only)
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line13A-IntangibleAssets(AmortizableOnly):endOfTaxYear(C)	Money	Line 13A - Intangible Assets (Amortizable Only)
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line13B-LessAccumulatedAmortization:beginningOfTaxYear(A)	Money	Line 13B - Less Accumulated Amortization
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line13B-LessAccumulatedAmortization:beginningOfTaxYear(B)	Money	Line 13B - Less Accumulated Amortization
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line13B-LessAccumulatedAmortization:endOfTaxYear(C)	Money	Line 13B - Less Accumulated Amortization
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line13B-LessAccumulatedAmortization:endOfTaxYear(D)	Money	Line 13B - Less Accumulated Amortization
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line14-OtherAssets(AttachStatement):beginningOfTaxYear(B)	Money	Line 14 - Other Assets (Attach Statement)
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line14-OtherAssets(AttachStatement):endOfTaxYear(D)	Money	Line 14 - Other Assets (Attach Statement)
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line15-TotalAssets:beginningOfTaxYear(B)	Money	Line 15 - Total Assets
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line15-TotalAssets:endOfTaxYear(D)	Money	Line 15 - Total Assets
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line16-AccountsPayable:beginningOfTaxYear(B)	Money	Line 16 - Accounts Payable
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line16-AccountsPayable:endOfTaxYear(D)	Money	Line 16 - Accounts Payable
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line17-MortgagesNotesBondsPayableInLessThan1Year:beginningOfTaxYear(B)	Money	Line 17 - Mortgages Notes Bonds Payable In Less Than 1 Year
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line17-MortgagesNotesBondsPayableInLessThan1Year:endOfTaxYear(D)	Money	Line 17 - Mortgages Notes Bonds Payable In Less Than 1 Year
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line18-OtherCurrentLiabilities(AttachStatement):beginningOfTaxYear(B)	Money	Line 18 - Other Current Liabilities (Attach Statement)
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line18-OtherCurrentLiabilities(AttachStatement):endOfTaxYear(D)	Money	Line 18 - Other Current Liabilities (Attach Statement)
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line19-LoansFromShareholders:beginningOfTaxYear(B)	Money	Line 19 - Loans From Shareholders
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line19-LoansFromShareholders:endOfTaxYear(D)	Money	Line 19 - Loans From Shareholders
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line20-MortgagesNotesBondsPayableIn1YearOrMore:beginningOfTaxYear(B)	Money	Line 20 - Mortgages Notes Bonds Payable In 1 Year or More
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line20-MortgagesNotesBondsPayableIn1YearOrMore:endOfTaxYear(D)	Money	Line 20 - Mortgages Notes Bonds Payable In 1 Year or More
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line21-OtherLiabilities(AttachStatement):beginningOfTaxYear(B)	Money	Line 21 - Other Liabilities (Attach Statement)
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line21-OtherLiabilities(AttachStatement):endOfTaxYear(D)	Money	Line 21 - Other Liabilities (Attach Statement)
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-27:line22-CapitalStock:beginningOfTaxYear(B)	Money	Line 22 - Capital Stock
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-27:line22-CapitalStock:endOfTaxYear(D)	Money	Line 22 - Capital Stock
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-27:line23-AdditionalPaid-InCapital:beginningOfTaxYear(B)	Money	Line 23 - Additional Paid-In Capital
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-27:line23-AdditionalPaid-InCapital:endOfTaxYear(D)	Money	Line 23 - Additional Paid-In Capital
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-27:line24-RetainedEarnings:beginningOfTaxYear(B)	Money	Line 24 - Retained Earnings
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-27:line24-RetainedEarnings:endOfTaxYear(D)	Money	Line 24 - Retained Earnings
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-27:line25-AdjustmentsToShareholders'Equity(AttachStatement):beginningOfTaxYear(B)	Money	Line 25 - Adjustments To Shareholders' Equity (Attach Statement)
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-27:line25-AdjustmentsToShareholders'Equity(AttachStatement):endOfTaxYear(D)	Money	Line 25 - Adjustments To Shareholders' Equity (Attach Statement)
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-27:line26-LessCostOfTreasuryStock:beginningOfTaxYear(B)	Money	Line 26 - Less Cost Of Treasury Stock
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-27:line26-LessCostOfTreasuryStock:endOfTaxYear(D)	Money	Line 26 - Less Cost Of Treasury Stock
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-27:line27-TotalLiabilitiesAndShareholders'Equity:beginningOfTaxYear(B)	Money	Line 27 - Total Liabilities And Shareholders` Equity
a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-27:line27-TotalLiabilitiesAndShareholders'Equity:endOfTaxYear(D)	Money	Line 27 - Total Liabilities And Shareholders` Equity
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Lines1-4:line1-NetIncome(Loss)PerBooks	Money	Line 1 - Net Income (Loss) Per Books
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Lines1-4:line2-IncomeIncludedOnScheduleK:itemize	Text	Line 2 - Income Included On Schedule K
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Lines1-4:line2-IncomeIncludedOnScheduleK:total	Money	Line 2 - Income Included On Schedule K
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Lines1-4:line3A-Depreciation(Itemized):(i)Depreciation-Amount	Money	Line 3A - Depreciation (Itemized)
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Lines1-4:line3A-Depreciation(Itemized):(ii)Depreciation-Description	Text	Line 3A - Depreciation (Itemized)
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Lines1-4:line3B-TravelAndEntertainment(Itemized):(i)TravelAndEntertainment-Amount	Money	Line 3B - Travel And Entertainment (Itemized)
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Lines1-4:line3B-TravelAndEntertainment(Itemized):(i)TravelAndEntertainment-Description	Text	Line 3B - Travel And Entertainment (Itemized)
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Lines1-4:line3B-TravelAndEntertainment(Itemized):(ii)TravelAndEntertainment-Amount	Money	Line 3B - Travel And Entertainment (Itemized)
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Lines1-4:line3B-TravelAndEntertainment(Itemized):(ii)TravelAndEntertainment-Description	Text	Line 3B - Travel And Entertainment (Itemized)
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Lines1-4:line3-ExpensesRecordedOnBooksThisYearNotIncludedOnScheduleK:total	Money	Line 3 - Expenses Recorded On Books This Year Not Included On Schedule K
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Lines1-4:line4-AddLines1Through3	Money	Line 4 - Add Lines 1 Through 3
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Lines5-8:line5A-Tax-ExemptInterest:(i)Tax-ExemptInterest-Amount	Money	Line 5A - Tax-Exempt Interest
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Lines5-8:line5A-Tax-ExemptInterest:(i)Tax-ExemptInterest-Description	Text	Line 5A - Tax-Exempt Interest
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Lines5-8:line5A-Tax-ExemptInterest:(ii)Tax-ExemptInterest-Amount	Money	Line 5A - Tax-Exempt Interest
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Lines5-8:line5A-Tax-ExemptInterest:(ii)Tax-ExemptInterest-Description	Text	Line 5A - Tax-Exempt Interest
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Lines5-8:line5-IncomeRecordedOnBooksThisYearNotIncludedOnScheduleK:total	Money	Line 5 - Income Recorded On Books This Year Not Included On Schedule K
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Lines5-8:line6-DeductionsIncludedOnScheduleK:(a)Depreciation	Text	Line 6 - Deductions Included On Schedule K
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Lines5-8:line6-DeductionsIncludedOnScheduleK:total	Money	Line 6 - Deductions Included On Schedule K
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Lines5-8:line7-AddLines5And6	Money	Line 7 - Add Lines 5 And 6
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Lines5-8:line8-Income(Loss)	Money	Line 8 - Income (Loss)
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part7-Lines1-4:line1-BalanceAtBeginningOfTaxYear:(a)AccumulatedAdjustmentsAccount	Money	Line 1 - Balance At Beginning Of Tax Year
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part7-Lines1-4:line1-BalanceAtBeginningOfTaxYear:(b)ShareholdersUndistributedTaxableIncomePreviouslyTaxed`	Money	Line 1 - Balance At Beginning Of Tax Year
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part7-Lines1-4:line1-BalanceAtBeginningOfTaxYear:(c)AccumulatedEarningsAndProfits	Money	Line 1 - Balance At Beginning Of Tax Year
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part7-Lines1-4:line1-BalanceAtBeginningOfTaxYear:(d)OtherAdjustmentsAccount	Money	Line 1 - Balance At Beginning Of Tax Year
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part7-Lines1-4:line2-OrdinaryIncomeFromPage1Line21:(a)AccumulatedAdjustmentsAccount	Money	Line 2 - Ordinary Income From Page 1 Line 21
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part7-Lines1-4:line3-OtherAdditions:(a)AccumulatedAdjustmentsAccount	Money	Line 3 - Other Additions
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part7-Lines1-4:line3-OtherAdditions:(d)OtherAdjustmentsAccount	Money	Line 3 - Other Additions
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part7-Lines1-4:line4-LossFromPage1Line21:(a)AccumulatedAdjustmentsAccount	Money	Line 4 - Loss From Page 1 Line 21
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Lines5-8:line5-OtherReductions:(a)AccumulatedAdjustmentsAccount	Money	Line 5 - Other Reductions
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Lines5-8:line5-OtherReductions:(d)OtherAdjustmentsAccount	Money	Line 5 - Other Reductions
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Lines5-8:line6-CombineLines1Through5:(a)AccumulatedAdjustmentsAccount	Money	Line 6 - Combine Lines 1 Through 5
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Lines5-8:line6-CombineLines1Through5:(b)ShareholdersUndistributedTaxableIncomePreviouslyTaxed`	Money	Line 6 - Combine Lines 1 Through 5
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Lines5-8:line6-CombineLines1Through5:(c)AccumulatedEarningsAndProfits	Money	Line 6 - Combine Lines 1 Through 5
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Lines5-8:line6-CombineLines1Through5:(d)OtherAdjustmentsAccount	Money	Line 6 - Combine Lines 1 Through 5
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Lines5-8:line7-Distributions:(a)AccumulatedAdjustmentsAccount	Money	Line 7 - Distributions
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Lines5-8:line7-Distributions:(b)ShareholdersUndistributedTaxableIncomePreviouslyTaxed`	Money	Line 7 - Distributions
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Lines5-8:line7-Distributions:(c)AccumulatedEarningsAndProfits	Money	Line 7 - Distributions
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Lines5-8:line7-Distributions:(d)OtherAdjustmentsAccount	Money	Line 7 - Distributions
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Lines5-8:line8-BalanceAtEndOfTaxYear.SubtractLine7FromLine6:(a)AccumulatedAdjustmentsAccount	Money	Line 8 - Balance At End Of Tax Year. Subtract Line 7 From Line 6
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Lines5-8:line8-BalanceAtEndOfTaxYear.SubtractLine7FromLine6:(b)ShareholdersUndistributedTaxableIncomePreviouslyTaxed`	Money	Line 8 - Balance At End Of Tax Year. Subtract Line 7 From Line 6
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Lines5-8:line8-BalanceAtEndOfTaxYear.SubtractLine7FromLine6:(c)AccumulatedEarningsAndProfits	Money	Line 8 - Balance At End Of Tax Year. Subtract Line 7 From Line 6
a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Lines5-8:line8-BalanceAtEndOfTaxYear.SubtractLine7FromLine6:(d)OtherAdjustmentsAccount	Money	Line 8 - Balance At End Of Tax Year. Subtract Line 7 From Line 6
Sample document

Coming soon...

Sample JSON result
JSON
{
    "status": 200,
    "response": {
        "pk": 25751645,
        "uuid": "21a9c7f6-2e80-4dfe-a5c9-cc2460fd848b",
        "forms": [
            {
                "pk": 27722309,
                "uuid": "66d2033a-3efc-48a8-974e-e134bf7465ee",
                "form_type": "A_1120S_SCHEDULE_L_M_1_M_2_2018",
                "form_config_pk": 11533,
                "tables": [],
                "raw_fields": {
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Lines5-8:line8-Income(Loss)": {
                        "value": "51033.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Lines5-8:line7-AddLines5And6": {
                        "value": "0.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Lines1-4:line4-AddLines1Through3": {
                        "value": "51033.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Lines1-4:line1-NetIncome(Loss)PerBooks": {
                        "value": "51033.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Lines5-8:line7-Distributions:(a)AccumulatedAdjustmentsAccount": {
                        "value": "46798.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Lines5-8:line6-CombineLines1Through5:(a)AccumulatedAdjustmentsAccount": {
                        "value": "372475.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part7-Lines1-4:line1-BalanceAtBeginningOfTaxYear:(a)AccumulatedAdjustmentsAccount": {
                        "value": "321442.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Lines5-8:line8-BalanceAtEndOfTaxYear.SubtractLine7FromLine6:(a)AccumulatedAdjustmentsAccount": {
                        "value": "325677.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part7-Lines1-4:line1-BalanceAtBeginningOfTaxYear:(b)Shareholders'UndistributedTaxableIncomePreviouslyTaxed": {
                        "value": "51033.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:year": {
                        "value": "2018",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line1-Cash:endOfTaxYear(D)": {
                        "value": "665637.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line1-Cash:beginningOfTaxYear(B)": {
                        "value": "664960.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line3-Inventories:endOfTaxYear(D)": {
                        "value": "43804.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line15-TotalAssets:endOfTaxYear(D)": {
                        "value": "869875.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Lines1-4:line2-IncomeIncludedOnScheduleK:total": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line3-Inventories:beginningOfTaxYear(B)": {
                        "value": "55426.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Lines1-4:line2-IncomeIncludedOnScheduleK:itemize": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line7-LoansToShareholders:endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line11A-DepletableAssets:endOfTaxYear(C)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line15-TotalAssets:beginningOfTaxYear(B)": {
                        "value": "851280.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Lines5-8:line6-DeductionsIncludedOnScheduleK:total": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line2B-LessAllowanceForBadDebts:endOfTaxYear(C)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line2B-LessAllowanceForBadDebts:endOfTaxYear(D)": {
                        "value": "88850.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line4-U.S.GovernmentObligations:endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line7-LoansToShareholders:beginningOfTaxYear(B)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Lines5-8:line7-Distributions:(d)OtherAdjustmentsAccount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line8-MortgageAndRealEstateLoans:endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line11A-DepletableAssets:beginningOfTaxYear(A)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part7-Lines1-4:line3-OtherAdditions:(d)OtherAdjustmentsAccount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Lines5-8:line5-OtherReductions:(d)OtherAdjustmentsAccount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line11B-LessAccumulatedDepletion:endOfTaxYear(C)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line11B-LessAccumulatedDepletion:endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line12-Land(NetOfAnyAmortization):endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Lines5-8:line6-DeductionsIncludedOnScheduleK:(a)Depreciation": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line2B-LessAllowanceForBadDebts:beginningOfTaxYear(A)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line2B-LessAllowanceForBadDebts:beginningOfTaxYear(B)": {
                        "value": "56534.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line4-U.S.GovernmentObligations:beginningOfTaxYear(B)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line10B-LessAccumulatedDepreciation:endOfTaxYear(C)": {
                        "value": "181743.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line10B-LessAccumulatedDepreciation:endOfTaxYear(D)": {
                        "value": "71584.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line13B-LessAccumulatedAmortization:endOfTaxYear(C)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line13B-LessAccumulatedAmortization:endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line14-OtherAssets(AttachStatement):endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Lines1-4:line3A-Depreciation(Itemized):(i)Depreciation-Amount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Lines5-8:line7-Distributions:(c)AccumulatedEarningsAndProfits": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line2A-TradeNotesAndAccountsReceivable:endOfTaxYear(C)": {
                        "value": "88850.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line8-MortgageAndRealEstateLoans:beginningOfTaxYear(B)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part7-Lines1-4:line3-OtherAdditions:(a)AccumulatedAdjustmentsAccount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line9-OtherInvestments(AttachStatement):endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Lines5-8:line5A-Tax-ExemptInterest:(i)Tax-ExemptInterest-Amount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Lines5-8:line5-OtherReductions:(a)AccumulatedAdjustmentsAccount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Lines5-8:line6-CombineLines1Through5:(d)OtherAdjustmentsAccount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line11B-LessAccumulatedDepletion:beginningOfTaxYear(A)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line11B-LessAccumulatedDepletion:beginningOfTaxYear(B)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Lines5-8:line5A-Tax-ExemptInterest:(ii)Tax-ExemptInterest-Amount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line6-OtherCurrentAssets(AttachStatement):endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line12-Land(NetOfAnyAmortization):beginningOfTaxYear(B)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line5-Tax-ExemptSecurities(SeeInstructions):endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line10B-LessAccumulatedDepreciation:beginningOfTaxYear(A)": {
                        "value": "178967.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line10B-LessAccumulatedDepreciation:beginningOfTaxYear(B)": {
                        "value": "74360.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line13A-IntangibleAssets(AmortizableOnly):endOfTaxYear(C)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line13B-LessAccumulatedAmortization:beginningOfTaxYear(A)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line13B-LessAccumulatedAmortization:beginningOfTaxYear(B)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line14-OtherAssets(AttachStatement):beginningOfTaxYear(B)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Lines1-4:line3A-Depreciation(Itemized):(ii)Depreciation-Description": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part7-Lines1-4:line4-LossFromPage1Line21:(a)AccumulatedAdjustmentsAccount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line2A-TradeNotesAndAccountsReceivable:beginningOfTaxYear(A)": {
                        "value": "56534.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line10A-BuildingsAndOtherDepreciableAssets:endOfTaxYear(C)": {
                        "value": "253327.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Lines5-8:line5A-Tax-ExemptInterest:(i)Tax-ExemptInterest-Description": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line9-OtherInvestments(AttachStatement):beginningOfTaxYear(B)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Lines5-8:line5A-Tax-ExemptInterest:(ii)Tax-ExemptInterest-Description": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part7-Lines1-4:line1-BalanceAtBeginningOfTaxYear:(d)OtherAdjustmentsAccount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Lines5-8:line6-CombineLines1Through5:(c)AccumulatedEarningsAndProfits": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line6-OtherCurrentAssets(AttachStatement):beginningOfTaxYear(B)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-27:line22-CapitalStock:endOfTaxYear(D)": {
                        "value": "1000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Lines5-8:line5-IncomeRecordedOnBooksThisYearNotIncludedOnScheduleK:total": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line5-Tax-ExemptSecurities(SeeInstructions):beginningOfTaxYear(B)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line13A-IntangibleAssets(AmortizableOnly):beginningOfTaxYear(A)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line10A-BuildingsAndOtherDepreciableAssets:beginningOfTaxYear(A)": {
                        "value": "253327.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Lines1-4:line3-ExpensesRecordedOnBooksThisYearNotIncludedOnScheduleK:total": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line16-AccountsPayable:endOfTaxYear(D)": {
                        "value": "8416.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part7-Lines1-4:line1-BalanceAtBeginningOfTaxYear:(c)AccumulatedEarningsAndProfits": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-27:line24-RetainedEarnings:endOfTaxYear(D)": {
                        "value": "325677.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part7-Lines1-4:line2-OrdinaryIncomeFromPage1Line21:(a)AccumulatedAdjustmentsAccount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-27:line22-CapitalStock:beginningOfTaxYear(B)": {
                        "value": "1000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line16-AccountsPayable:beginningOfTaxYear(B)": {
                        "value": "6206.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line19-LoansFromShareholders:endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Lines1-4:line3B-TravelAndEntertainment(Itemized):(i)TravelAndEntertainment-Amount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-27:line24-RetainedEarnings:beginningOfTaxYear(B)": {
                        "value": "321442.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Lines1-4:line3B-TravelAndEntertainment(Itemized):(ii)TravelAndEntertainment-Amount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-27:line26-LessCostOfTreasuryStock:endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-27:line23-AdditionalPaid-InCapital:endOfTaxYear(D)": {
                        "value": "316901.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Lines1-4:line3B-TravelAndEntertainment(Itemized):(i)TravelAndEntertainment-Description": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Lines5-8:line7-Distributions:(b)Shareholders'UndistributedTaxableIncomePreviouslyTaxed": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Lines5-8:line8-BalanceAtEndOfTaxYear.SubtractLine7FromLine6:(d)OtherAdjustmentsAccount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line19-LoansFromShareholders:beginningOfTaxYear(B)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Lines1-4:line3B-TravelAndEntertainment(Itemized):(ii)TravelAndEntertainment-Description": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-27:line26-LessCostOfTreasuryStock:beginningOfTaxYear(B)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-27:line23-AdditionalPaid-InCapital:beginningOfTaxYear(B)": {
                        "value": "316901.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Lines5-8:line8-BalanceAtEndOfTaxYear.SubtractLine7FromLine6:(c)AccumulatedEarningsAndProfits": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line21-OtherLiabilities(AttachStatement):endOfTaxYear(D)": {
                        "value": "149970.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Lines5-8:line6-CombineLines1Through5:(b)Shareholders'UndistributedTaxableIncomePreviouslyTaxed": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-27:line27-TotalLiabilitiesAndShareholders'Equity:endOfTaxYear(D)": {
                        "value": "869875.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line20-MortgagesNotesBondsPayableIn1YearOrMore:endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line21-OtherLiabilities(AttachStatement):beginningOfTaxYear(B)": {
                        "value": "138604.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line18-OtherCurrentLiabilities(AttachStatement):endOfTaxYear(D)": {
                        "value": "67911.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line17-MortgagesNotesBondsPayableInLessThan1Year:endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-27:line27-TotalLiabilitiesAndShareholders'Equity:beginningOfTaxYear(B)": {
                        "value": "851280.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line20-MortgagesNotesBondsPayableIn1YearOrMore:beginningOfTaxYear(B)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line18-OtherCurrentLiabilities(AttachStatement):beginningOfTaxYear(B)": {
                        "value": "67127.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line17-MortgagesNotesBondsPayableInLessThan1Year:beginningOfTaxYear(B)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-27:line25-AdjustmentsToShareholders'Equity(AttachStatement):endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-27:line25-AdjustmentsToShareholders'Equity(AttachStatement):beginningOfTaxYear(B)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120s_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Lines5-8:line8-BalanceAtEndOfTaxYear.SubtractLine7FromLine6:(b)Shareholders'UndistributedTaxableIncomePreviouslyTaxed": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120S Schedule L_M-1_M-2 2018.pdf"
                    }
                }
            }
        ]
    },
    "message": "OK"
}


Updated 11 months ago

1120S Schedule K-1 (2024) - Shareholder’s Share of Income, Deductions, Credits, etc.
IRS Form 1120S Schedules L, M-1, and M-2 (2019) - Balance Sheet (L), Income Reconciliation (M-1), and Analysis (M-2) of S Corporation's Financial Activity Report
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