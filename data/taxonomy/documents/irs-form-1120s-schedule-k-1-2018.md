# IRS Form 1120S Schedule K-1 (2018) - Shareholder’s Share of Income, Deductions, Credits, etc.

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
IRS Form 1120S Schedule K-1 (2018) - Shareholder’s Share of Income, Deductions, Credits, etc.
Suggest Edits

IRS Form 1120S Schedule K-1 is a source document that is prepared by a corporation as part of the filing of their tax return (Form 1120S). The K-1 reflects a shareholder's share of income, deductions, credits, and other items that the shareholder will need to report on their tax return (Form 1040).

To use the Upload PDF endpoint for this document, you must use A_1120S_SCHEDULE_K_1_2018 in the form_type parameter.

Note

A majority of these fields may be is_empty = true due to the nature of the IRS Form 1120S Schedule K-1.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
a_1120s_schedule_k_1_2018-Part1-General:year	Text	Year
a_1120s_schedule_k_1_2018-Part1-General:finalK-1	CHECKED, NOT CHECKED	Final K-1
a_1120s_schedule_k_1_2018-Part1-General:amendedK-1	CHECKED, NOT CHECKED	Amended K-1
a_1120s_schedule_k_1_2018-Part2-PartI-InformationAboutTheCorporation:boxA-Corporation'SEmployerIdentificationNumber	EIN	Box A - Corporation's Employer Identification Number
a_1120s_schedule_k_1_2018-Part2-PartI-InformationAboutTheCorporation:boxB-Corporation'SName	Text	Box B - Corporation's Name
a_1120s_schedule_k_1_2018-Part2-PartI-InformationAboutTheCorporation:boxB-Corporation'SAddress:addressLine1	Text	Box B - Corporation's Address
a_1120s_schedule_k_1_2018-Part2-PartI-InformationAboutTheCorporation:boxB-Corporation'SAddress:addressLine2	Text	Box B - Corporation's Address
a_1120s_schedule_k_1_2018-Part2-PartI-InformationAboutTheCorporation:boxB-Corporation'SAddress:city	City	Box B - Corporation's Address
a_1120s_schedule_k_1_2018-Part2-PartI-InformationAboutTheCorporation:boxB-Corporation'SAddress:state	State	Box B - Corporation's Address
a_1120s_schedule_k_1_2018-Part2-PartI-InformationAboutTheCorporation:boxB-Corporation'SAddress:zip	ZIP Code	Box B - Corporation's Address
a_1120s_schedule_k_1_2018-Part2-PartI-InformationAboutTheCorporation:boxC-IrsCenterWhereCorporationFiledReturn	Text	Box C - IRS Center Where Corporation Filed Return
a_1120s_schedule_k_1_2018-Part3-PartIi-InformationAboutTheShareholder:boxD-Shareholder'SIdentifyingNumber	Text	Box D - Shareholder's Identifying Number
a_1120s_schedule_k_1_2018-Part3-PartIi-InformationAboutTheShareholder:boxE-Shareholder'SName	Text	Box E - Shareholder's Name
a_1120s_schedule_k_1_2018-Part3-PartIi-InformationAboutTheShareholder:boxE-Shareholder'SAddress:addressLine1	Text	Box E - Shareholder's Address
a_1120s_schedule_k_1_2018-Part3-PartIi-InformationAboutTheShareholder:boxE-Shareholder'SAddress:addressLine2	Text	Box E - Shareholder's Address
a_1120s_schedule_k_1_2018-Part3-PartIi-InformationAboutTheShareholder:boxE-Shareholder'SAddress:city	City	Box E - Shareholder's Address
a_1120s_schedule_k_1_2018-Part3-PartIi-InformationAboutTheShareholder:boxE-Shareholder'SAddress:state	State	Box E - Shareholder's Address
a_1120s_schedule_k_1_2018-Part3-PartIi-InformationAboutTheShareholder:boxE-Shareholder'SAddress:zip	ZIP Code	Box E - Shareholder's Address
a_1120s_schedule_k_1_2018-Part3-PartIi-InformationAboutTheShareholder:boxF-Shareholder'SPercentageOfStockOwnershipForTaxYear	Percentage	Box F - Shareholder's Percentage Of Stock Ownership For Tax Year
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line1-OrdinaryBusinessIncome(Loss)	Money	Line 1 - Ordinary Business Income (Loss)
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line2-NetRentalRealEstateIncome(Loss)	Money	Line 2 - Net Rental Real Estate Income (Loss)
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line3-OtherNetRentalIncome(Loss)	Money	Line 3 - Other Net Rental Income (Loss)
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line4-InterestIncome	Money	Line 4 - Interest Income
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line5A-OrdinaryDividends	Money	Line 5A - Ordinary Dividends
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line5B-QualifiedDividends	Money	Line 5B - Qualified Dividends
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line6-Royalties	Money	Line 6 - Royalties
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line7-NetShort-TermCapitalGain(Loss)	Money	Line 7 - Net Short-Term Capital Gain (Loss)
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line8A-NetLong-TermCapitalGain(Loss)	Money	Line 8A - Net Long-Term Capital Gain (Loss)
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line8B-Collectibles(28%)Gain(Loss)	Money	Line 8B - Collectibles (28%) Gain (Loss)
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line8C-UnrecapturedSection1250Gain	Money	Line 8C - Unrecaptured Section 1250 Gain
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line9-NetSection1231Gain(Loss)	Money	Line 9 - Net Section 1231 Gain (Loss)
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line10(I)-OtherIncome(Loss):code	A, B, C, D, E, F, G, H	Line 10 (i) - Other Income (Loss)
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line10(I)-OtherIncome(Loss):amount	Money	Line 10 (i) - Other Income (Loss)
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line10(Ii)-OtherIncome(Loss):code	A, B, C, D, E, F, G, H	Line 10 (ii) - Other Income (Loss)
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line10(Ii)-OtherIncome(Loss):amount	Money	Line 10 (ii) - Other Income (Loss)
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line10(Iii)-OtherIncome(Loss):code	A, B, C, D, E, F, G, H	Line 10 (iii) - Other Income (Loss)
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line10(Iii)-OtherIncome(Loss):amount	Money	Line 10 (iii) - Other Income (Loss)
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line10(Iv)-OtherIncome(Loss):code	A, B, C, D, E, F, G, H	Line 10 (iv) - Other Income (Loss)
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line10(Iv)-OtherIncome(Loss):amount	Money	Line 10 (iv) - Other Income (Loss)
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line10(V)-OtherIncome(Loss):code	A, B, C, D, E, F, G, H	Line 10 (v) - Other Income (Loss)
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line10(V)-OtherIncome(Loss):amount	Money	Line 10 (v) - Other Income (Loss)
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line11-Section179Deduction	Money	Line 11 - Section 179 Deduction
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line12(I)-OtherDeductions:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S	Line 12 (i) - Other Deductions
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line12(I)-OtherDeductions:amount	Money	Line 12 (i) - Other Deductions
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line12(Ii)-OtherDeductions:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S	Line 12 (ii) - Other Deductions
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line12(Ii)-OtherDeductions:amount	Money	Line 12 (ii) - Other Deductions
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line12(Iii)-OtherDeductions:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S	Line 12 (iii) - Other Deductions
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line12(Iii)-OtherDeductions:amount	Money	Line 12 (iii) - Other Deductions
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line12(Iv)-OtherDeductions:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S	Line 12 (iv) - Other Deductions
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line12(Iv)-OtherDeductions:amount	Money	Line 12 (iv) - Other Deductions
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line12(V)-OtherDeductions:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S	Line 12 (v) - Other Deductions
a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line12(V)-OtherDeductions:amount	Money	Line 12 (v) - Other Deductions
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line13(I)-Credits:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P	Line 13 (i) - Credits
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line13(I)-Credits:amount	Money	Line 13 (i) - Credits
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line13(Ii)-Credits:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P	Line 13 (ii) - Credits
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line13(Ii)-Credits:amount	Money	Line 13 (ii) - Credits
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line13(Iii)-Credits:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P	Line 13 (iii) - Credits
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line13(Iii)-Credits:amount	Money	Line 13 (iii) - Credits
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line13(Iv)-Credits:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P	Line 13 (iv) - Credits
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line13(Iv)-Credits:amount	Money	Line 13 (iv) - Credits
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line13(V)-Credits:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P	Line 13 (v) - Credits
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line13(V)-Credits:amount	Money	Line 13 (v) - Credits
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line14(I)-ForeignTransactions:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V	Line 14 (i) - Foreign Transactions
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line14(I)-ForeignTransactions:amount	Money	Line 14 (i) - Foreign Transactions
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line14(Ii)-ForeignTransactions:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V	Line 14 (ii) - Foreign Transactions
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line14(Ii)-ForeignTransactions:amount	Money	Line 14 (ii) - Foreign Transactions
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line14(Iii)-ForeignTransactions:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V	Line 14 (iii) - Foreign Transactions
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line14(Iii)-ForeignTransactions:amount	Money	Line 14 (iii) - Foreign Transactions
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line14(Iv)-ForeignTransactions:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V	Line 14 (iv) - Foreign Transactions
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line14(Iv)-ForeignTransactions:amount	Money	Line 14 (iv) - Foreign Transactions
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line14(V)-ForeignTransactions:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V	Line 14 (v) - Foreign Transactions
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line14(V)-ForeignTransactions:amount	Money	Line 14 (v) - Foreign Transactions
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line15(I)-AlternativeMinimumTax(Amt)Items:code	A, B, C, D, E, F	Line 15 (i) - Alternative Minimum Tax (Amt) Items
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line15(I)-AlternativeMinimumTax(Amt)Items:amount	Money	Line 15 (i) - Alternative Minimum Tax (Amt) Items
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line15(Ii)-AlternativeMinimumTax(Amt)Items:code	A, B, C, D, E, F	Line 15 (ii) - Alternative Minimum Tax (Amt) Items
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line15(Ii)-AlternativeMinimumTax(Amt)Items:amount	Money	Line 15 (ii) - Alternative Minimum Tax (Amt) Items
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line15(Iii)-AlternativeMinimumTax(Amt)Items:code	A, B, C, D, E, F	Line 15 (iii) - Alternative Minimum Tax (Amt) Items
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line15(Iii)-AlternativeMinimumTax(Amt)Items:amount	Money	Line 15 (iii) - Alternative Minimum Tax (Amt) Items
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line15(Iv)-AlternativeMinimumTax(Amt)Items:code	A, B, C, D, E, F	Line 15 (iv) - Alternative Minimum Tax (Amt) Items
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line15(Iv)-AlternativeMinimumTax(Amt)Items:amount	Money	Line 15 (iv) - Alternative Minimum Tax (Amt) Items
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line15(V)-AlternativeMinimumTax(Amt)Items:code	A, B, C, D, E, F	Line 15 (v) - Alternative Minimum Tax (Amt) Items
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line15(V)-AlternativeMinimumTax(Amt)Items:amount	Money	Line 15 (v) - Alternative Minimum Tax (Amt) Items
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line16(I)-ItemsAffectingShareholderBasis:code	A, B, C, D, E	Line 16 (i) - Items Affecting Shareholder Basis
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line16(I)-ItemsAffectingShareholderBasis:amount	Money	Line 16 (i) - Items Affecting Shareholder Basis
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line16(Ii)-ItemsAffectingShareholderBasis:code	A, B, C, D, E	Line 16 (ii) - Items Affecting Shareholder Basis
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line16(Ii)-ItemsAffectingShareholderBasis:amount	Money	Line 16 (ii) - Items Affecting Shareholder Basis
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line16(Iii)-ItemsAffectingShareholderBasis:code	A, B, C, D, E	Line 16 (iii) - Items Affecting Shareholder Basis
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line16(Iii)-ItemsAffectingShareholderBasis:amount	Money	Line 16 (iii) - Items Affecting Shareholder Basis
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line16(Iv)-ItemsAffectingShareholderBasis:code	A, B, C, D, E	Line 16 (iv) - Items Affecting Shareholder Basis
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line16(Iv)-ItemsAffectingShareholderBasis:amount	Money	Line 16 (iv) - Items Affecting Shareholder Basis
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line16(V)-ItemsAffectingShareholderBasis:code	A, B, C, D, E	Line 16 (v) - Items Affecting Shareholder Basis
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line16(V)-ItemsAffectingShareholderBasis:amount	Money	Line 16 (v) - Items Affecting Shareholder Basis
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line17(I)-OtherInformation:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z, AA, AB, AC	Line 17 (i) - Other Information
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line17(I)-OtherInformation:amount	Money	Line 17 (i) - Other Information
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line17(Ii)-OtherInformation:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z, AA, AB, AC	Line 17 (ii) - Other Information
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line17(Ii)-OtherInformation:amount	Money	Line 17 (ii) - Other Information
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line17(Iii)-OtherInformation:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z, AA, AB, AC	Line 17 (iii) - Other Information
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line17(Iii)-OtherInformation:amount	Money	Line 17 (iii) - Other Information
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line17(Iv)-OtherInformation:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z, AA, AB, AC	Line 17 (iv) - Other Information
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line17(Iv)-OtherInformation:amount	Money	Line 17 (iv) - Other Information
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line17(V)-OtherInformation:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z, AA, AB, AC	Line 17 (v) - Other Information
a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line17(V)-OtherInformation:amount	Money	Line 17 (v) - Other Information
Sample document

Coming soon...

Sample JSON result
JSON
{
  "pk": 31512818,
  "uuid": "3938b288-c218-4280-91de-be0ea716fe5b",
  "form_type": "A_1120S_SCHEDULE_K_1_2018",
  "raw_fields": {
    "a_1120s_schedule_k_1_2018-Part1-General:year": {
      "value": "2018",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part1-General:finalK-1": {
      "value": "CHECKED",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part1-General:amendedK-1": {
      "value": "NOT CHECKED",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part2-PartI-InformationAboutTheCorporation:boxB-Corporation'SName": {
      "value": "SHAMOON LLC",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part3-PartIi-InformationAboutTheShareholder:boxE-Shareholder'SName": {
      "value": "SCOTT HAYDEN",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line6-Royalties": {
      "value": "4000.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part2-PartI-InformationAboutTheCorporation:boxB-Corporation'SAddress:zip": {
      "value": "58488",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part2-PartI-InformationAboutTheCorporation:boxB-Corporation'SAddress:city": {
      "value": "WASHINGTON",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part3-PartIi-InformationAboutTheShareholder:boxE-Shareholder'SAddress:zip": {
      "value": "10940",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part2-PartI-InformationAboutTheCorporation:boxB-Corporation'SAddress:state": {
      "value": "NY",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part3-PartIi-InformationAboutTheShareholder:boxE-Shareholder'SAddress:city": {
      "value": "MIDDLETOWN",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part3-PartIi-InformationAboutTheShareholder:boxE-Shareholder'SAddress:state": {
      "value": "NY",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line4-InterestIncome": {
      "value": "2000.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part3-PartIi-InformationAboutTheShareholder:boxD-Shareholder'SIdentifyingNumber": {
      "value": "454-59-2579",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line13(I)-Credits:code": {
      "value": "A",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line13(V)-Credits:code": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line5A-OrdinaryDividends": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line13(Ii)-Credits:code": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line13(Iv)-Credits:code": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part2-PartI-InformationAboutTheCorporation:boxB-Corporation'SAddress:addressLine1": {
      "value": "124 WESTER ROAD",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part2-PartI-InformationAboutTheCorporation:boxB-Corporation'SAddress:addressLine2": {
      "value": "APT #2",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line5B-QualifiedDividends": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line13(I)-Credits:amount": {
      "value": "8000.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line13(Iii)-Credits:code": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line13(V)-Credits:amount": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part3-PartIi-InformationAboutTheShareholder:boxE-Shareholder'SAddress:addressLine1": {
      "value": "470 ROUTE 211 EAST",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part3-PartIi-InformationAboutTheShareholder:boxE-Shareholder'SAddress:addressLine2": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line11-Section179Deduction": {
      "value": "750.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line13(Ii)-Credits:amount": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line13(Iv)-Credits:amount": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line13(Iii)-Credits:amount": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part2-PartI-InformationAboutTheCorporation:boxC-IrsCenterWhereCorporationFiledReturn": {
      "value": "E-FILE",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line12(I)-OtherDeductions:code": {
      "value": "A",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line12(V)-OtherDeductions:code": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line9-NetSection1231Gain(Loss)": {
      "value": "-500.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line12(Ii)-OtherDeductions:code": {
      "value": "B",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line12(Iv)-OtherDeductions:code": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line10(I)-OtherIncome(Loss):code": {
      "value": "A",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line10(V)-OtherIncome(Loss):code": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line12(I)-OtherDeductions:amount": {
      "value": "550.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line12(Iii)-OtherDeductions:code": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line12(V)-OtherDeductions:amount": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line3-OtherNetRentalIncome(Loss)": {
      "value": "1275.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line17(I)-OtherInformation:code": {
      "value": "A",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line17(V)-OtherInformation:code": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part2-PartI-InformationAboutTheCorporation:boxA-Corporation'SEmployerIdentificationNumber": {
      "value": "25-6787888",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line10(Ii)-OtherIncome(Loss):code": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line10(Iv)-OtherIncome(Loss):code": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line12(Ii)-OtherDeductions:amount": {
      "value": "600.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line12(Iv)-OtherDeductions:amount": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line17(Ii)-OtherInformation:code": {
      "value": "B",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line17(Iv)-OtherInformation:code": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line1-OrdinaryBusinessIncome(Loss)": {
      "value": "2230.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line10(I)-OtherIncome(Loss):amount": {
      "value": "500.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line10(Iii)-OtherIncome(Loss):code": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line10(V)-OtherIncome(Loss):amount": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line12(Iii)-OtherDeductions:amount": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line8B-Collectibles(28%)Gain(Loss)": {
      "value": "1000.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line8C-UnrecapturedSection1250Gain": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line17(I)-OtherInformation:amount": {
      "value": "5260.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line17(Iii)-OtherInformation:code": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line17(V)-OtherInformation:amount": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line10(Ii)-OtherIncome(Loss):amount": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line10(Iv)-OtherIncome(Loss):amount": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line14(I)-ForeignTransactions:code": {
      "value": "B",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line14(V)-ForeignTransactions:code": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line17(Ii)-OtherInformation:amount": {
      "value": "725.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line17(Iv)-OtherInformation:amount": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line10(Iii)-OtherIncome(Loss):amount": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line7-NetShort-TermCapitalGain(Loss)": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line8A-NetLong-TermCapitalGain(Loss)": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line14(Ii)-ForeignTransactions:code": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line14(Iv)-ForeignTransactions:code": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line17(Iii)-OtherInformation:amount": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part4-PartIii-Shareholder'SShareOfCurrentYearIncome1-12:line2-NetRentalRealEstateIncome(Loss)": {
      "value": "1220.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line14(I)-ForeignTransactions:amount": {
      "value": "5800.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line14(Iii)-ForeignTransactions:code": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line14(V)-ForeignTransactions:amount": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line14(Ii)-ForeignTransactions:amount": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line14(Iv)-ForeignTransactions:amount": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line14(Iii)-ForeignTransactions:amount": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part3-PartIi-InformationAboutTheShareholder:boxF-Shareholder'SPercentageOfStockOwnershipForTaxYear": {
      "value": "50.00000%",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line16(I)-ItemsAffectingShareholderBasis:code": {
      "value": "A",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line16(V)-ItemsAffectingShareholderBasis:code": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line15(I)-AlternativeMinimumTax(Amt)Items:code": {
      "value": "C",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line15(V)-AlternativeMinimumTax(Amt)Items:code": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line16(Ii)-ItemsAffectingShareholderBasis:code": {
      "value": "D",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line16(Iv)-ItemsAffectingShareholderBasis:code": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line15(Ii)-AlternativeMinimumTax(Amt)Items:code": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line15(Iv)-AlternativeMinimumTax(Amt)Items:code": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line16(I)-ItemsAffectingShareholderBasis:amount": {
      "value": "3000.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line16(Iii)-ItemsAffectingShareholderBasis:code": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line16(V)-ItemsAffectingShareholderBasis:amount": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line15(I)-AlternativeMinimumTax(Amt)Items:amount": {
      "value": "35000.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line15(Iii)-AlternativeMinimumTax(Amt)Items:code": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line15(V)-AlternativeMinimumTax(Amt)Items:amount": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line16(Ii)-ItemsAffectingShareholderBasis:amount": {
      "value": "2500.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line16(Iv)-ItemsAffectingShareholderBasis:amount": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line15(Ii)-AlternativeMinimumTax(Amt)Items:amount": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line15(Iv)-AlternativeMinimumTax(Amt)Items:amount": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line16(Iii)-ItemsAffectingShareholderBasis:amount": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    },
    "a_1120s_schedule_k_1_2018-Part5-PartIii-Shareholder'SShareOfCurrentYearIncome12-17:line15(Iii)-AlternativeMinimumTax(Amt)Items:amount": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "1120S Schedule K-1 2018 Sample 1.pdf"
    }
  },
  "form_config_pk": 21410,
  "tables": []
}


Updated 11 months ago

1120S (2024) - U.S. Income Tax Return for an S Corporation
IRS Form 1120S Schedule K-1 (2019) - Shareholder’s Share of Income, Deductions, Credits, etc.
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