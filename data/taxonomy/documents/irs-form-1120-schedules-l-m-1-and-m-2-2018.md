# IRS Form 1120 Schedules L, M-1, and M-2 (2018) - Balance Sheet (L), Income Reconciliation (M-1), and Analysis (M-2) of Corporation's Income Report

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
IRS Form 1120 Schedules L, M-1, and M-2 (2018) - Balance Sheet (L), Income Reconciliation (M-1), and Analysis (M-2) of Corporation's Income Report
Suggest Edits

IRS Form 1120 Schedule L is where a corporation reports its Balance Sheet to the IRS, reflecting the financial position of the corporation as recorded in its books and records.

Schedule M-1 is required when a corporation's gross receipts or total assets at the end of the year exceed $250,000. It helps reconcile the differences between the financial income reported on the corporation's books and records and the income reported on the tax return.

Schedule M-2 is used to report the analysis of unappropriated retained earnings per book, providing a breakdown of the changes that occurred in the corporation's retained earnings over the tax year.

To use the Upload PDF endpoint for this document, you must use A_1120_SCHEDULE_M_1_M_2_2018 in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:year	Integer	Year
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line1-Cash:beginningOfTaxYear(B)	Money	Line 1 - Cash
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line1-Cash:endOfTaxYear(D)	Money	Line 1 - Cash
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line2A-TradeNotesAndAccountsReceivable:beginningOfTaxYear(A)	Money	Line 2A - Trade Notes And Accounts Receivable
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line2A-TradeNotesAndAccountsReceivable:endOfTaxYear(C)	Money	Line 2A - Trade Notes And Accounts Receivable
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line2B-LessAllowanceForBadDebts:beginningOfTaxYear(A)	Money	Line 2B - Less Allowance For Bad Debts
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line2B-LessAllowanceForBadDebts:beginningOfTaxYear(B)	Money	Line 2B - Less Allowance For Bad Debts
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line2B-LessAllowanceForBadDebts:endOfTaxYear(C)	Money	Line 2B - Less Allowance For Bad Debts
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line2B-LessAllowanceForBadDebts:endOfTaxYear(D)	Money	Line 2B - Less Allowance For Bad Debts
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line3-Inventories:beginningOfTaxYear(B)	Money	Line 3 - Inventories
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line3-Inventories:endOfTaxYear(D)	Money	Line 3 - Inventories
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line4-U.S.GovernmentObligations:beginningOfTaxYear(B)	Money	Line 4 - U.S. Government Obligations
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line4-U.S.GovernmentObligations:endOfTaxYear(D)	Money	Line 4 - U.S. Government Obligations
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line5-Tax-ExemptSecurities(SeeInstructions):beginningOfTaxYear(B)	Money	Line 5 - Tax-Exempt Securities (See Instructions)
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line5-Tax-ExemptSecurities(SeeInstructions):endOfTaxYear(D)	Money	Line 5 - Tax-Exempt Securities (See Instructions)
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line6-OtherCurrentAssets(AttachStatement):beginningOfTaxYear(B)	Money	Line 6 - Other Current Assets (Attach Statement)
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line6-OtherCurrentAssets(AttachStatement):endOfTaxYear(D)	Money	Line 6 - Other Current Assets (Attach Statement)
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line7-LoansToShareholders:beginningOfTaxYear(B)	Money	Line 7 - Loans To Shareholders
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line7-LoansToShareholders:endOfTaxYear(D)	Money	Line 7 - Loans To Shareholders
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line8-MortgageAndRealEstateLoans:beginningOfTaxYear(B)	Money	Line 8 - Mortgage And Real Estate Loans
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line8-MortgageAndRealEstateLoans:endOfTaxYear(D)	Money	Line 8 - Mortgage And Real Estate Loans
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line9-OtherInvestments(AttachStatement):beginningOfTaxYear(B)	Money	Line 9 - Other Investments (Attach Statement)
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line9-OtherInvestments(AttachStatement):endOfTaxYear(D)	Money	Line 9 - Other Investments (Attach Statement)
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line10A-BuildingsAndOtherDepreciableAssets:beginningOfTaxYear(A)	Money	Line 10A - Buildings And Other Depreciable Assets
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line10A-BuildingsAndOtherDepreciableAssets:endOfTaxYear(C)	Money	Line 10A - Buildings And Other Depreciable Assets
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line10B-LessAccumulatedDepreciation:beginningOfTaxYear(A)	Money	Line 10B - Less Accumulated Depreciation
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line10B-LessAccumulatedDepreciation:beginningOfTaxYear(B)	Money	Line 10B - Less Accumulated Depreciation
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line10B-LessAccumulatedDepreciation:endOfTaxYear(C)	Money	Line 10B - Less Accumulated Depreciation
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line10B-LessAccumulatedDepreciation:endOfTaxYear(D)	Money	Line 10B - Less Accumulated Depreciation
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line11A-DepletableAssets:beginningOfTaxYear(A)	Money	Line 11A - Depletable Assets
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line11A-DepletableAssets:endOfTaxYear(C)	Money	Line 11A - Depletable Assets
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line11B-LessAccumulatedDepletion:beginningOfTaxYear(A)	Money	Line 11B - Less Accumulated Depletion
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line11B-LessAccumulatedDepletion:beginningOfTaxYear(B)	Money	Line 11B - Less Accumulated Depletion
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line11B-LessAccumulatedDepletion:endOfTaxYear(C)	Money	Line 11B - Less Accumulated Depletion
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line11B-LessAccumulatedDepletion:endOfTaxYear(D)	Money	Line 11B - Less Accumulated Depletion
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line12-Land(NetOfAnyAmortization):beginningOfTaxYear(B)	Money	Line 12 - Land (Net Of Any Amortization)
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line12-Land(NetOfAnyAmortization):endOfTaxYear(D)	Money	Line 12 - Land (Net Of Any Amortization)
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line13A-IntangibleAssets(AmortizableOnly):beginningOfTaxYear(A)	Money	Line 13A - Intangible Assets (Amortizable Only)
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line13A-IntangibleAssets(AmortizableOnly):endOfTaxYear(C)	Money	Line 13A - Intangible Assets (Amortizable Only)
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line13B-LessAccumulatedAmortization:beginningOfTaxYear(A)	Money	Line 13B - Less Accumulated Amortization
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line13B-LessAccumulatedAmortization:beginningOfTaxYear(B)	Money	Line 13B - Less Accumulated Amortization
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line13B-LessAccumulatedAmortization:endOfTaxYear(C)	Money	Line 13B - Less Accumulated Amortization
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line13B-LessAccumulatedAmortization:endOfTaxYear(D)	Money	Line 13B - Less Accumulated Amortization
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line14-OtherAssets(AttachStatement):beginningOfTaxYear(B)	Money	Line 14 - Other Assets (Attach Statement)
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line14-OtherAssets(AttachStatement):endOfTaxYear(D)	Money	Line 14 - Other Assets (Attach Statement)
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line15-TotalAssets:beginningOfTaxYear(B)	Money	Line 15 - Total Assets
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line15-TotalAssets:endOfTaxYear(D)	Money	Line 15 - Total Assets
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line16-AccountsPayable:beginningOfTaxYear(B)	Money	Line 16 - Accounts Payable
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line16-AccountsPayable:endOfTaxYear(D)	Money	Line 16 - Accounts Payable
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line17-MortgagesNotesBondsPayableInLessThan1Year:beginningOfTaxYear(B)	Money	Line 17 - Mortgages Notes Bonds Payable In Less Than 1 Year
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line17-MortgagesNotesBondsPayableInLessThan1Year:endOfTaxYear(D)	Money	Line 17 - Mortgages Notes Bonds Payable In Less Than 1 Year
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line18-OtherCurrentLiabilities(AttachStatement):beginningOfTaxYear(B)	Money	Line 18 - Other Current Liabilities (Attach Statement)
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line18-OtherCurrentLiabilities(AttachStatement):endOfTaxYear(D)	Money	Line 18 - Other Current Liabilities (Attach Statement)
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line19-LoansFromShareholders:beginningOfTaxYear(B)	Money	Line 19 - Loans From Shareholders
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line19-LoansFromShareholders:endOfTaxYear(D)	Money	Line 19 - Loans From Shareholders
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholdersEquity16-21:line20-MortgagesNotesBondsPayableIn1YearOrMore:beginningOfTaxYear(B)`	Money	Line 20 - Mortgages Notes Bonds Payable In 1 Year Or More
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line20-MortgagesNotesBondsPayableIn1YearOrMore:endOfTaxYear(D)	Money	Line 20 - Mortgages Notes Bonds Payable In 1 Year Or More
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line21-OtherLiabilities(AttachStatement):beginningOfTaxYear(B)	Money	Line 21 - Other Liabilities (Attach Statement)
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line21-OtherLiabilities(AttachStatement):endOfTaxYear(D)	Money	Line 21 - Other Liabilities (Attach Statement)
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line22-CapitalStock:APreferredStock:beginningOfTaxYear(A)	Money	Line 22 - Capital Stock: A Preferred Stock
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line22-CapitalStock:APreferredStock:endOfTaxYear(C)	Money	Line 22 - Capital Stock: A Preferred Stock
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line22-CapitalStock:BCommonStock:beginningOfTaxYear(A)	Money	Line 22 - Capital Stock: B Common Stock
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line22-CapitalStock:BCommonStock:beginningOfTaxYear(B)	Money	Line 22 - Capital Stock: B Common Stock
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line22-CapitalStock:BCommonStock:endOfTaxYear(C)	Money	Line 22 - Capital Stock: B Common Stock
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line22-CapitalStock:BCommonStock:endOfTaxYear(D)	Money	Line 22 - Capital Stock: B Common Stock
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholdersEquity22-28:line23-AdditionalPaid-InCapital:beginningOfTaxYear(B)`	Money	Line 23 - Additional Paid-In Capital
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line23-AdditionalPaid-InCapital:endOfTaxYear(D)	Money	Line 23 - Additional Paid-In Capital
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line24-RetainedEarnings-Appropriated(AttachStatement):beginningOfTaxYear(B)	Money	Line 24 - Retained Earnings - Appropriated (Attach Statement)
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line24-RetainedEarnings-Appropriated(AttachStatement):endOfTaxYear(D)	Money	Line 24 - Retained Earnings - Appropriated (Attach Statement)
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line25-RetainedEarnings-Unappropriated:beginningOfTaxYear(B)	Money	Line 25 - Retained Earnings - Unappropriated
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line25-RetainedEarnings-Unappropriated:endOfTaxYear(D)	Money	Line 25 - Retained Earnings - Unappropriated
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line26-AdjustmentsToShareholders'Equity(AttachStatement):beginningOfTaxYear(B)	Money	Line 26 - Adjustments To Shareholders' Equity (Attach Statement)
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line26-AdjustmentsToShareholders'Equity(AttachStatement):endOfTaxYear(D)	Money	Line 26 - Adjustments To Shareholders' Equity (Attach Statement)
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line27-LessCostOfTreasuryStock:beginningOfTaxYear(B)	Money	Line 27 - Less Cost Of Treasury Stock
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line27-LessCostOfTreasuryStock:endOfTaxYear(D)	Money	Line 27 - Less Cost Of Treasury Stock
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line28-TotalLiabilitiesAndShareholders'Equity:beginningOfTaxYear(B)	Money	Line 28 - Total Liabilities And Shareholders' Equity
a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line28-TotalLiabilitiesAndShareholders'Equity:endOfTaxYear(D)	Money	Line 28 - Total Liabilities And Shareholders' Equity
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line1-NetIncome(Loss)PerBooks	Money	Line 1 - Net Income (Loss) Per Books
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line2-FederalIncomeTaxPerBooks	Money	Line 2 - Federal Income Tax Per Books
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line3-ExcessOfCapitalLossesOverCapitalGains	Money	Line 3 - Excess Of Capital Losses Over Capital Gains
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line4-IncomeSubjectToTaxNotRecordedOnBooksThisYear:(i)Itemize-Amount	Money	Line 4 - Income Subject To Tax Not Recorded On Books This Year
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line4-IncomeSubjectToTaxNotRecordedOnBooksThisYear:(i)Itemize-Description	Text	Line 4 - Income Subject To Tax Not Recorded On Books This Year
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line4-IncomeSubjectToTaxNotRecordedOnBooksThisYear:(ii)Itemize-Amount	Money	Line 4 - Income Subject To Tax Not Recorded On Books This Year
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line4-IncomeSubjectToTaxNotRecordedOnBooksThisYear:(ii)Itemize-Description	Text	Line 4 - Income Subject To Tax Not Recorded On Books This Year
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line4-IncomeSubjectToTaxNotRecordedOnBooksThisYear:total	Money	Line 4 - Income Subject To Tax Not Recorded On Books This Year
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line5A-Depreciation	Money	Line 5A - Depreciation
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line5B-CharitableContributions	Money	Line 5B - Charitable Contributions
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line5C-TravelAndEntertainment:(i)TravelAndEntertainment-Amount	Money	Line 5C - Travel And Entertainment
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line5C-TravelAndEntertainment:(i)TravelAndEntertainment-Description	Text	Line 5C - Travel And Entertainment
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line5C-TravelAndEntertainment:(ii)TravelAndEntertainment-Amount	Money	Line 5C - Travel And Entertainment
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line5C-TravelAndEntertainment:(ii)TravelAndEntertainment-Description	Text	Line 5C - Travel And Entertainment
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line5-ExpensesRecordedOnBooksThisYearNotDeductedOnThisReturn:total	Money	Line 5 - Expenses Recorded On Books This Year Not Deducted On This Return
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line6-AddLines1Through5	Money	Line 6 - Add Lines 1 Through 5
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Line7-10:line7-IncomeRecordedOnBooksThisYearNotIncludedOnThisReturn:(i)Tax-ExemptInterest-Amount	Money	Line 7 - Income Recorded On Books This Year Not Included On This Return
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Line7-10:line7-IncomeRecordedOnBooksThisYearNotIncludedOnThisReturn:(i)Tax-ExemptInterest-Description	Text	Line 7 - Income Recorded On Books This Year Not Included On This Return
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Line7-10:line7-IncomeRecordedOnBooksThisYearNotIncludedOnThisReturn:(ii)Tax-ExemptInterest-Amount	Money	Line 7 - Income Recorded On Books This Year Not Included On This Return
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Line7-10:line7-IncomeRecordedOnBooksThisYearNotIncludedOnThisReturn:(ii)Tax-ExemptInterest-Description	Text	Line 7 - Income Recorded On Books This Year Not Included On This Return
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Line7-10:line7-IncomeRecordedOnBooksThisYearNotIncludedOnThisReturn:total	Money	Line 7 - Income Recorded On Books This Year Not Included On This Return
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Line7-10:line8A-Depreciation	Money	Line 8A - Depreciation
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Line7-10:line8B-CharitableContributions:(i)CharitableContributions-Amount	Money	Line 8B - Charitable Contributions
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Line7-10:line8B-CharitableContributions:(i)CharitableContributions-Description	Text	Line 8B - Charitable Contributions
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Line7-10:line8B-CharitableContributions:(ii)CharitableContributions-Amount	Money	Line 8B - Charitable Contributions
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Line7-10:line8B-CharitableContributions:(ii)CharitableContributions-Description	Text	Line 8B - Charitable Contributions
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Line7-10:line8-DeductionsOnThisReturnNotChargedAgainstBookIncomeThisYear:total	Money	Line 8 - Deductions On This Return Not Charged Against Book Income This Year
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Line7-10:line9-AddLines7And8	Money	Line 9 - Add Lines 7 And 8
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Line7-10:line10-Income	Money	Line 10 - Income
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-2-Part7-Line1-4:line1-BalanceAtBeginningOfYear	Money	Line 1 - Balance At Beginning Of Year
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-2-Part7-Line1-4:line2-NetIncome(Loss)PerBooks	Money	Line 2 - Net Income (Loss) Per Books
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-2-Part7-Line1-4:line3-OtherIncreases(Itemize):(i)OtherIncreases-Amount	Money	Line 3 - Other Increases (Itemize)
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-2-Part7-Line1-4:line3-OtherIncreases(Itemize):(i)OtherIncreases-Description	Text	Line 3 - Other Increases (Itemize)
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-2-Part7-Line1-4:line3-OtherIncreases(Itemize):(ii)OtherIncreases-Amount	Money	Line 3 - Other Increases (Itemize)
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-2-Part7-Line1-4:line3-OtherIncreases(Itemize):(ii)OtherIncreases-Description	Text	Line 3 - Other Increases (Itemize)
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-2-Part7-Line1-4:line4-AddLines12And3	Money	Line 4 - Add Lines 1 2 And 3
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Line5-8:line5A-Distributions-Cash	Money	Line 5 - Distributions
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Line5-8:line5A-Distributions-Stock	Money	Line 5 - Distributions
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Line5-8:line5A-Distributions-Property	Money	Line 5 - Distributions
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Line5-8:line6-OtherDecreases(Itemize):(i)OtherDecreases-Amount	Money	Line 6 - Other Decreases (Itemize)
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Line5-8:line6-OtherDecreases(Itemize):(i)OtherDecreases-Description	Text	Line 6 - Other Decreases (Itemize)
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Line5-8:line7-AddLines5And6	Money	Line 7 - Add Lines 5 And 6
a_1120_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Line5-8:line8-BalanceAtEndOfYear(Line4LessLine7)	Money	Line 8 - Balance At End Of Year (Line 4 Less Line 7)
Sample document

Coming soon...

Sample JSON result
JSON
{
    "status": 200,
    "response": {
        "pk": 25752093,
        "uuid": "8e057017-5e88-4de0-9b92-a61ca5e670b2",
        "forms": [
            {
                "pk": 27722528,
                "uuid": "ed7b623a-2201-400b-a9b5-75b4befb221f",
                "form_type": "A_1120_SCHEDULE_L_M1_M2_2018",
                "form_config_pk": 11557,
                "tables": [],
                "raw_fields": {
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:year": {
                        "value": "2018",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Line7-10:line10-Income": {
                        "value": "2464.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line5A-Depreciation": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Line5-8:line7-AddLines5And6": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Line7-10:line8A-Depreciation": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Line7-10:line9-AddLines7And8": {
                        "value": "0.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-2-Part7-Line1-4:line4-AddLines12And3": {
                        "value": "-89488.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line6-AddLines1Through5": {
                        "value": "2464.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Line5-8:line5A-Distributions-Cash": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line1-Cash:endOfTaxYear(D)": {
                        "value": "16688.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Line5-8:line5A-Distributions-Stock": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line1-NetIncome(Loss)PerBooks": {
                        "value": "2329.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-2-Part7-Line1-4:line2-NetIncome(Loss)PerBooks": {
                        "value": "2329.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Line5-8:line5A-Distributions-Property": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line2-FederalIncomeTaxPerBooks": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line5B-CharitableContributions": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-2-Part7-Line1-4:line1-BalanceAtBeginningOfYear": {
                        "value": "-91817.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line1-Cash:beginningOfTaxYear(B)": {
                        "value": "29525.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line3-Inventories:endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line15-TotalAssets:endOfTaxYear(D)": {
                        "value": "191349.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line3-Inventories:beginningOfTaxYear(B)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Line5-8:line8-BalanceAtEndOfYear(Line4LessLine7)": {
                        "value": "-89488.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line7-LoansToShareholders:endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line11A-DepletableAssets:endOfTaxYear(C)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line15-TotalAssets:beginningOfTaxYear(B)": {
                        "value": "207957.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line3-ExcessOfCapitalLossesOverCapitalGains": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line2B-LessAllowanceForBadDebts:endOfTaxYear(C)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line2B-LessAllowanceForBadDebts:endOfTaxYear(D)": {
                        "value": "0.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line4-U.S.GovernmentObligations:endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line7-LoansToShareholders:beginningOfTaxYear(B)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line8-MortgageAndRealEstateLoans:endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line11A-DepletableAssets:beginningOfTaxYear(A)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line11B-LessAccumulatedDepletion:endOfTaxYear(C)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line11B-LessAccumulatedDepletion:endOfTaxYear(D)": {
                        "value": "0.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line12-Land(NetOfAnyAmortization):endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line2B-LessAllowanceForBadDebts:beginningOfTaxYear(A)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line2B-LessAllowanceForBadDebts:beginningOfTaxYear(B)": {
                        "value": "0.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line4-U.S.GovernmentObligations:beginningOfTaxYear(B)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line10B-LessAccumulatedDepreciation:endOfTaxYear(C)": {
                        "value": "-13162.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line10B-LessAccumulatedDepreciation:endOfTaxYear(D)": {
                        "value": "174711.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line13B-LessAccumulatedAmortization:endOfTaxYear(C)": {
                        "value": "-50.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line13B-LessAccumulatedAmortization:endOfTaxYear(D)": {
                        "value": "-50.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line14-OtherAssets(AttachStatement):endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line2A-TradeNotesAndAccountsReceivable:endOfTaxYear(C)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line8-MortgageAndRealEstateLoans:beginningOfTaxYear(B)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-2-Part7-Line1-4:line3-OtherIncreases(Itemize):(i)OtherIncreases-Amount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Line5-8:line6-OtherDecreases(Itemize):(i)OtherDecreases-Amount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line9-OtherInvestments(AttachStatement):endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-2-Part7-Line1-4:line3-OtherIncreases(Itemize):(ii)OtherIncreases-Amount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line11B-LessAccumulatedDepletion:beginningOfTaxYear(A)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line11B-LessAccumulatedDepletion:beginningOfTaxYear(B)": {
                        "value": "0.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line4-IncomeSubjectToTaxNotRecordedOnBooksThisYear:total": {
                        "value": "0.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line6-OtherCurrentAssets(AttachStatement):endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line12-Land(NetOfAnyAmortization):beginningOfTaxYear(B)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line5-Tax-ExemptSecurities(SeeInstructions):endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line10B-LessAccumulatedDepreciation:beginningOfTaxYear(A)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line10B-LessAccumulatedDepreciation:beginningOfTaxYear(B)": {
                        "value": "178482.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line13A-IntangibleAssets(AmortizableOnly):endOfTaxYear(C)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line13B-LessAccumulatedAmortization:beginningOfTaxYear(A)": {
                        "value": "-50.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line13B-LessAccumulatedAmortization:beginningOfTaxYear(B)": {
                        "value": "-50.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line14-OtherAssets(AttachStatement):beginningOfTaxYear(B)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-2-Part7-Line1-4:line3-OtherIncreases(Itemize):(i)OtherIncreases-Description": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-2-Part8-Line5-8:line6-OtherDecreases(Itemize):(i)OtherDecreases-Description": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line2A-TradeNotesAndAccountsReceivable:beginningOfTaxYear(A)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line10A-BuildingsAndOtherDepreciableAssets:endOfTaxYear(C)": {
                        "value": "187873.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-2-Part7-Line1-4:line3-OtherIncreases(Itemize):(ii)OtherIncreases-Description": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line9-OtherInvestments(AttachStatement):beginningOfTaxYear(B)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line5C-TravelAndEntertainment:(i)TravelAndEntertainment-Amount": {
                        "value": "135.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line6-OtherCurrentAssets(AttachStatement):beginningOfTaxYear(B)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line5C-TravelAndEntertainment:(ii)TravelAndEntertainment-Amount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part1-Assets1-9:line5-Tax-ExemptSecurities(SeeInstructions):beginningOfTaxYear(B)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line13A-IntangibleAssets(AmortizableOnly):beginningOfTaxYear(A)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Line7-10:line7-IncomeRecordedOnBooksThisYearNotIncludedOnThisReturn:total": {
                        "value": "0.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Line7-10:line8B-CharitableContributions:(i)CharitableContributions-Amount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part2-Assets10-15:line10A-BuildingsAndOtherDepreciableAssets:beginningOfTaxYear(A)": {
                        "value": "178482.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line5-ExpensesRecordedOnBooksThisYearNotDeductedOnThisReturn:total": {
                        "value": "135.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Line7-10:line8B-CharitableContributions:(ii)CharitableContributions-Amount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line16-AccountsPayable:endOfTaxYear(D)": {
                        "value": "75.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line5C-TravelAndEntertainment:(i)TravelAndEntertainment-Description": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line4-IncomeSubjectToTaxNotRecordedOnBooksThisYear:(i)Itemize-Amount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line5C-TravelAndEntertainment:(ii)TravelAndEntertainment-Description": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line4-IncomeSubjectToTaxNotRecordedOnBooksThisYear:(ii)Itemize-Amount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Line7-10:line8-DeductionsOnThisReturnNotChargedAgainstBookIncomeThisYear:total": {
                        "value": "0.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Line7-10:line8B-CharitableContributions:(i)CharitableContributions-Description": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Line7-10:line8B-CharitableContributions:(ii)CharitableContributions-Description": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line16-AccountsPayable:beginningOfTaxYear(B)": {
                        "value": "75.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line19-LoansFromShareholders:endOfTaxYear(D)": {
                        "value": "285089.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line4-IncomeSubjectToTaxNotRecordedOnBooksThisYear:(i)Itemize-Description": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part5-Line1-6:line4-IncomeSubjectToTaxNotRecordedOnBooksThisYear:(ii)Itemize-Description": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line27-LessCostOfTreasuryStock:endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line23-AdditionalPaid-InCapital:endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line22-CapitalStock:BCommonStock:endOfTaxYear(C)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line22-CapitalStock:BCommonStock:endOfTaxYear(D)": {
                        "value": "0.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line19-LoansFromShareholders:beginningOfTaxYear(B)": {
                        "value": "288675.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line22-CapitalStock:APreferredStock:endOfTaxYear(C)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line27-LessCostOfTreasuryStock:beginningOfTaxYear(B)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line23-AdditionalPaid-InCapital:beginningOfTaxYear(B)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line22-CapitalStock:BCommonStock:beginningOfTaxYear(A)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line22-CapitalStock:BCommonStock:beginningOfTaxYear(B)": {
                        "value": "0.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line25-RetainedEarnings-Unappropriated:endOfTaxYear(D)": {
                        "value": "-93815.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line21-OtherLiabilities(AttachStatement):endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line22-CapitalStock:APreferredStock:beginningOfTaxYear(A)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Line7-10:line7-IncomeRecordedOnBooksThisYearNotIncludedOnThisReturn:(i)Tax-ExemptInterest-Amount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line25-RetainedEarnings-Unappropriated:beginningOfTaxYear(B)": {
                        "value": "-91817.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Line7-10:line7-IncomeRecordedOnBooksThisYearNotIncludedOnThisReturn:(ii)Tax-ExemptInterest-Amount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line28-TotalLiabilitiesAndShareholders'Equity:endOfTaxYear(D)": {
                        "value": "191349.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line20-MortgagesNotesBondsPayableIn1YearOrMore:endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line21-OtherLiabilities(AttachStatement):beginningOfTaxYear(B)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line18-OtherCurrentLiabilities(AttachStatement):endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line17-MortgagesNotesBondsPayableInLessThan1Year:endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Line7-10:line7-IncomeRecordedOnBooksThisYearNotIncludedOnThisReturn:(i)Tax-ExemptInterest-Description": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleM-1-Part6-Line7-10:line7-IncomeRecordedOnBooksThisYearNotIncludedOnThisReturn:(ii)Tax-ExemptInterest-Description": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line28-TotalLiabilitiesAndShareholders'Equity:beginningOfTaxYear(B)": {
                        "value": "207957.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line20-MortgagesNotesBondsPayableIn1YearOrMore:beginningOfTaxYear(B)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line18-OtherCurrentLiabilities(AttachStatement):beginningOfTaxYear(B)": {
                        "value": "11024.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line24-RetainedEarnings-Appropriated(AttachStatement):endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part3-LiabilitiesAndShareholders'Equity16-21:line17-MortgagesNotesBondsPayableInLessThan1Year:beginningOfTaxYear(B)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line26-AdjustmentsToShareholders'Equity(AttachStatement):endOfTaxYear(D)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line24-RetainedEarnings-Appropriated(AttachStatement):beginningOfTaxYear(B)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    },
                    "a_1120_schedule_l_m_1_m_2_2018-ScheduleL-Part4-LiabilitiesAndShareholders'Equity22-28:line26-AdjustmentsToShareholders'Equity(AttachStatement):beginningOfTaxYear(B)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1120 Schedule L_M-1_M-2 2018.pdf"
                    }
                }
            }
        ]
    },
    "message": "OK"
}


Updated 11 months ago

1120 Schedule K (2024) - Other Information
IRS Form 1120 Schedules L, M-1, and M-2 (2019) - Balance Sheet (L), Income Reconciliation (M-1), and Analysis (M-2) of Corporation's Income Report
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