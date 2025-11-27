# 1120S Schedule K-1 (2024) - Shareholder’s Share of Income, Deductions, Credits, etc.

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
1120S Schedule K-1 (2024) - Shareholder’s Share of Income, Deductions, Credits, etc.
Suggest Edits

This is a source document that is prepared by a corporation as part of the filing of their tax return (Form 1120S). The K-1 reflects a shareholder's share of income, deductions, credits, and other items that the shareholder will need to report on their tax return (Form 1040).

To use the Upload PDF endpoint for this document, you must use A_1120S_SCHEDULE_K_1_2024 in the form_type parameter.

Note

A majority of these fields may be is_empty = true due to the nature of the IRS Form 1120S Schedule K-1.

Field descriptions

The following fields are available on this form type:

JSON Attribute	Data Type	Description
a_1120s_schedule_k_1_2024-Part01-General:year	Integer	Year
a_1120s_schedule_k_1_2024-Part01-General:finalK-1	CHECKED, NOT CHECKED	Final K-1
a_1120s_schedule_k_1_2024-Part01-General:amendedK-1	CHECKED, NOT CHECKED	Amended K-1
a_1120s_schedule_k_1_2024-Part01-General:beginningDateOfTaxYear	Date	Beginning Date Of Tax Year
a_1120s_schedule_k_1_2024-Part01-General:endingDateOfTaxYear	Date	Ending Date Of Tax Year
a_1120s_schedule_k_1_2024-Part02-PartI-InformationAboutTheCorporation:boxA-Corporation'SEmployerIdentificationNumber	EIN	Box A - Corporation's Employer Identification Number
a_1120s_schedule_k_1_2024-Part02-PartI-InformationAboutTheCorporation:boxB-Corporation'SName	Text	Box B - Corporation's Name
a_1120s_schedule_k_1_2024-Part02-PartI-InformationAboutTheCorporation:boxB-Corporation'SAddress:addressLine1	Text	Box B - Corporation's Address
a_1120s_schedule_k_1_2024-Part02-PartI-InformationAboutTheCorporation:boxB-Corporation'SAddress:addressLine2	Text	Box B - Corporation's Address
a_1120s_schedule_k_1_2024-Part02-PartI-InformationAboutTheCorporation:boxB-Corporation'SAddress:city	Text	Box B - Corporation's Address
a_1120s_schedule_k_1_2024-Part02-PartI-InformationAboutTheCorporation:boxB-Corporation'SAddress:state	State	Box B - Corporation's Address
a_1120s_schedule_k_1_2024-Part02-PartI-InformationAboutTheCorporation:boxB-Corporation'SAddress:zip	ZIP Code	Box B - Corporation's Address
a_1120s_schedule_k_1_2024-Part02-PartI-InformationAboutTheCorporation:boxC-IrsCenterWhereCorporationFiledReturn	Text	Box C - IRS Center Where Corporation Filed Return
a_1120s_schedule_k_1_2024-Part02-PartI-InformationAboutTheCorporation:boxD-Corporation'STotalNumberOfShares:beginningOfTaxYear	Integer	Box D - Corporation's Total Number Of Shares
a_1120s_schedule_k_1_2024-Part02-PartI-InformationAboutTheCorporation:boxD-Corporation'STotalNumberOfShares:endOfTaxYear	Integer	Box D - Corporation's Total Number Of Shares
a_1120s_schedule_k_1_2024-Part03-PartIi-InformationAboutTheShareholder:boxE-Shareholder'SIdentifyingNumber	Text	Box E - Shareholder's Identifying Number
a_1120s_schedule_k_1_2024-Part03-PartIi-InformationAboutTheShareholder:boxF1-Shareholder'SName	Text	Box F1 - Shareholder's Name
a_1120s_schedule_k_1_2024-Part03-PartIi-InformationAboutTheShareholder:boxF1-Shareholder'SAddress:addressLine1	Text	Box F1 - Shareholder's Address
a_1120s_schedule_k_1_2024-Part03-PartIi-InformationAboutTheShareholder:boxF1-Shareholder'SAddress:addressLine2	Text	Box F1 - Shareholder's Address
a_1120s_schedule_k_1_2024-Part03-PartIi-InformationAboutTheShareholder:boxF1-Shareholder'SAddress:city	Text	Box F1 - Shareholder's Address
a_1120s_schedule_k_1_2024-Part03-PartIi-InformationAboutTheShareholder:boxF1-Shareholder'SAddress:state	State	Box F1 - Shareholder's Address
a_1120s_schedule_k_1_2024-Part03-PartIi-InformationAboutTheShareholder:boxF1-Shareholder'SAddress:zip	ZIP Code	Box F1 - Shareholder's Address
a_1120s_schedule_k_1_2024-Part03-PartIi-InformationAboutTheShareholder:boxF2-IfTheShareholderIsADisregardedEntity:tin	EIN	Box F2 - If The Shareholder Is A Disregarded Entity
a_1120s_schedule_k_1_2024-Part03-PartIi-InformationAboutTheShareholder:boxF2-IfTheShareholderIsADisregardedEntity:name	Text	Box F2 - If The Shareholder Is A Disregarded Entity
a_1120s_schedule_k_1_2024-Part03-PartIi-InformationAboutTheShareholder:boxF3-WhatTypeOfEntityIsThisShareholder?	Text	Box F3 - What Type Of Entity Is This Shareholder?
a_1120s_schedule_k_1_2024-Part03-PartIi-InformationAboutTheShareholder:boxG-CurrentYearAllocationPercentage	Percentage	Box G - Current Year Allocation Percentage
a_1120s_schedule_k_1_2024-Part03-PartIi-InformationAboutTheShareholder:boxH-Shareholder'SNumberOfShares:beginningOfTaxYear	Integer	Box H - Shareholder's Number Of Shares
a_1120s_schedule_k_1_2024-Part03-PartIi-InformationAboutTheShareholder:boxH-Shareholder'SNumberOfShares:endOfTaxYear	Integer	Box H - Shareholder's Number Of Shares
a_1120s_schedule_k_1_2024-Part03-PartIi-InformationAboutTheShareholder:boxI-LoansFromShareholder:beginningOfTaxYear	Money	Box I - Loans From Shareholder
a_1120s_schedule_k_1_2024-Part03-PartIi-InformationAboutTheShareholder:boxI-LoansFromShareholder:endOfTaxYear	Money	Box I - Loans From Shareholder
a_1120s_schedule_k_1_2024-Part04-PartIii-Shareholder'SShareOfCurrentYearIncome1-9:line1-OrdinaryBusinessIncome(Loss)	Money	Line 1 - Ordinary Business Income (Loss)
a_1120s_schedule_k_1_2024-Part04-PartIii-Shareholder'SShareOfCurrentYearIncome1-9:line2-NetRentalRealEstateIncome(Loss)	Money	Line 2 - Net Rental Real Estate Income (Loss)
a_1120s_schedule_k_1_2024-Part04-PartIii-Shareholder'SShareOfCurrentYearIncome1-9:line3-OtherNetRentalIncome(Loss)	Money	Line 3 - Other Net Rental Income (Loss)
a_1120s_schedule_k_1_2024-Part04-PartIii-Shareholder'SShareOfCurrentYearIncome1-9:line4-InterestIncome	Money	Line 4 - Interest Income
a_1120s_schedule_k_1_2024-Part04-PartIii-Shareholder'SShareOfCurrentYearIncome1-9:line5A-OrdinaryDividends	Money	Line 5A - Ordinary Dividends
a_1120s_schedule_k_1_2024-Part04-PartIii-Shareholder'SShareOfCurrentYearIncome1-9:line5B-QualifiedDividends	Money	Line 5B - Qualified Dividends
a_1120s_schedule_k_1_2024-Part04-PartIii-Shareholder'SShareOfCurrentYearIncome1-9:line6-Royalties	Money	Line 6 - Royalties
a_1120s_schedule_k_1_2024-Part04-PartIii-Shareholder'SShareOfCurrentYearIncome1-9:line7-NetShort-TermCapitalGain(Loss)	Money	Line 7 - Net Short-Term Capital Gain (Loss)
a_1120s_schedule_k_1_2024-Part04-PartIii-Shareholder'SShareOfCurrentYearIncome1-9:line8A-NetLong-TermCapitalGain(Loss)	Money	Line 8A - Net Long-Term Capital Gain (Loss)
a_1120s_schedule_k_1_2024-Part04-PartIii-Shareholder'SShareOfCurrentYearIncome1-9:line8B-Collectibles(28%)Gain(Loss)	Money	Line 8B - Collectibles (28%) Gain (Loss)
a_1120s_schedule_k_1_2024-Part04-PartIii-Shareholder'SShareOfCurrentYearIncome1-9:line8C-UnrecapturedSection1250Gain	Money	Line 8C - Unrecaptured Section 1250 Gain
a_1120s_schedule_k_1_2024-Part04-PartIii-Shareholder'SShareOfCurrentYearIncome1-9:line9-NetSection1231Gain(Loss)	Money	Line 9 - Net Section 1231 Gain (Loss)
a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line10(I)-OtherIncome(Loss):code	A, B, C, D, E, F, G, I, J, K, M, N, O, S, ZZ	Line 10 (I) - Other Income (Loss)
a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line10(I)-OtherIncome(Loss):amount	Money	Line 10 (I) - Other Income (Loss)
a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line10(Ii)-OtherIncome(Loss):code	A, B, C, D, E, F, G, I, J, K, M, N, O, S, ZZ	Line 10 (II) - Other Income (Loss)
a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line10(Ii)-OtherIncome(Loss):amount	Money	Line 10 (II) - Other Income (Loss)
a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line10(Iii)-OtherIncome(Loss):code	A, B, C, D, E, F, G, I, J, K, M, N, O, S, ZZ	Line 10 (III) - Other Income (Loss)
a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line10(Iii)-OtherIncome(Loss):amount	Money	Line 10 (III) - Other Income (Loss)
a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line10(Iv)-OtherIncome(Loss):code	A, B, C, D, E, F, G, I, J, K, M, N, O, S, ZZ	Line 10 (IV) - Other Income (Loss)
a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line10(Iv)-OtherIncome(Loss):amount	Money	Line 10 (IV) - Other Income (Loss)
a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line10(V)-OtherIncome(Loss):code	A, B, C, D, E, F, G, I, J, K, M, N, O, S, ZZ	Line 10 (V) - Other Income (Loss)
a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line10(V)-OtherIncome(Loss):amount	Money	Line 10 (V) - Other Income (Loss)
a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line11-Section179Deduction	Money	Line 11 - Section 179 Deduction
a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(I)-OtherDeductions:code	A, B, C, D, E, F, G, H, I, J, L, M, O, W, X, Y, Z, AA, AB, AC, ZZ	Line 12 (I) - Other Deductions
a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(I)-OtherDeductions:amount	Money	Line 12 (I) - Other Deductions
a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(Ii)-OtherDeductions:code	A, B, C, D, E, F, G, H, I, J, L, M, O, W, X, Y, Z, AA, AB, AC, ZZ	Line 12 (II) - Other Deductions
a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(Ii)-OtherDeductions:amount	Money	Line 12 (II) - Other Deductions
a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(Iii)-OtherDeductions:code	A, B, C, D, E, F, G, H, I, J, L, M, O, W, X, Y, Z, AA, AB, AC, ZZ	Line 12 (III) - Other Deductions
a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(Iii)-OtherDeductions:amount	Money	Line 12 (III) - Other Deductions
a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(Iv)-OtherDeductions:code	A, B, C, D, E, F, G, H, I, J, L, M, O, W, X, Y, Z, AA, AB, AC, ZZ	Line 12 (IV) - Other Deductions
a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(Iv)-OtherDeductions:amount	Money	Line 12 (IV) - Other Deductions
a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(V)-OtherDeductions:code	A, B, C, D, E, F, G, H, I, J, L, M, O, W, X, Y, Z, AA, AB, AC, ZZ	Line 12 (V) - Other Deductions
a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(V)-OtherDeductions:amount	Money	Line 12 (V) - Other Deductions
a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(Vi)-OtherDeductions:code	A, B, C, D, E, F, G, H, I, J, L, M, O, W, X, Y, Z, AA, AB, AC, ZZ	Line 12 (VI) - Other Deductions
a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(Vi)-OtherDeductions:amount	Money	Line 12 (VI) - Other Deductions
a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(Vii)-OtherDeductions:code	A, B, C, D, E, F, G, H, I, J, L, M, O, W, X, Y, Z, AA, AB, AC, ZZ	Line 12 (VII) - Other Deductions
a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(Vii)-OtherDeductions:amount	Money	Line 12 (VII) - Other Deductions
a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(Viii)-OtherDeductions:code	A, B, C, D, E, F, G, H, I, J, L, M, O, W, X, Y, Z, AA, AB, AC, ZZ	Line 12 (VIII) - Other Deductions
a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(Viii)-OtherDeductions:amount	Money	Line 12 (VIII) - Other Deductions
a_1120s_schedule_k_1_2024-Part06-PartIii-Shareholder'SShareOfCurrentYearIncome13-14:line13(I)-Credits:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z, AA, AB, AC, AD, AE, AF, AG, AH, AI, AJ, AK, AL, AM, AO, AP, AQ, AR, AS, AT, AU, AV, AW, AX, AY, AZ, BA, BB, BC, ZZ	Line 13 (I) - Credits
a_1120s_schedule_k_1_2024-Part06-PartIii-Shareholder'SShareOfCurrentYearIncome13-14:line13(I)-Credits:amount	Money	Line 13 (I) - Credits
a_1120s_schedule_k_1_2024-Part06-PartIii-Shareholder'SShareOfCurrentYearIncome13-14:line13(Ii)-Credits:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z, AA, AB, AC, AD, AE, AF, AG, AH, AI, AJ, AK, AL, AM, AO, AP, AQ, AR, AS, AT, AU, AV, AW, AX, AY, AZ, BA, BB, BC, ZZ	Line 13 (II) - Credits
a_1120s_schedule_k_1_2024-Part06-PartIii-Shareholder'SShareOfCurrentYearIncome13-14:line13(Ii)-Credits:amount	Money	Line 13 (II) - Credits
a_1120s_schedule_k_1_2024-Part06-PartIii-Shareholder'SShareOfCurrentYearIncome13-14:line13(Iii)-Credits:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z, AA, AB, AC, AD, AE, AF, AG, AH, AI, AJ, AK, AL, AM, AO, AP, AQ, AR, AS, AT, AU, AV, AW, AX, AY, AZ, BA, BB, BC, ZZ	Line 13 (III) - Credits
a_1120s_schedule_k_1_2024-Part06-PartIii-Shareholder'SShareOfCurrentYearIncome13-14:line13(Iii)-Credits:amount	Money	Line 13 (III) - Credits
a_1120s_schedule_k_1_2024-Part06-PartIii-Shareholder'SShareOfCurrentYearIncome13-14:line13(Iv)-Credits:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z, AA, AB, AC, AD, AE, AF, AG, AH, AI, AJ, AK, AL, AM, AO, AP, AQ, AR, AS, AT, AU, AV, AW, AX, AY, AZ, BA, BB, BC, ZZ	Line 13 (IV) - Credits
a_1120s_schedule_k_1_2024-Part06-PartIii-Shareholder'SShareOfCurrentYearIncome13-14:line13(Iv)-Credits:amount	Money	Line 13 (IV) - Credits
a_1120s_schedule_k_1_2024-Part06-PartIii-Shareholder'SShareOfCurrentYearIncome13-14:line13(V)-Credits:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z, AA, AB, AC, AD, AE, AF, AG, AH, AI, AJ, AK, AL, AM, AO, AP, AQ, AR, AS, AT, AU, AV, AW, AX, AY, AZ, BA, BB, BC, ZZ	Line 13 (V) - Credits
a_1120s_schedule_k_1_2024-Part06-PartIii-Shareholder'SShareOfCurrentYearIncome13-14:line13(V)-Credits:amount	Money	Line 13 (V) - Credits
a_1120s_schedule_k_1_2024-Part06-PartIii-Shareholder'SShareOfCurrentYearIncome13-14:line14-ScheduleK-3IsAttachedIfChecked	CHECKED, NOT CHECKED	Line 14 - Schedule K-3 Is Attached If Checked
a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line15(I)-AlternativeMinimumTax(Amt)Items:code	A, B, C, D, E, F	Line 15 (I) - Alternative Minimum Tax (AMT) Items
a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line15(I)-AlternativeMinimumTax(Amt)Items:amount	Money	Line 15 (I) - Alternative Minimum Tax (AMT) Items
a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line15(Ii)-AlternativeMinimumTax(Amt)Items:code	A, B, C, D, E, F	Line 15 (II) - Alternative Minimum Tax (AMT) Items
a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line15(Ii)-AlternativeMinimumTax(Amt)Items:amount	Money	Line 15 (II) - Alternative Minimum Tax (AMT) Items
a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line15(Iii)-AlternativeMinimumTax(Amt)Items:code	A, B, C, D, E, F	Line 15 (III) - Alternative Minimum Tax (AMT) Items
a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line15(Iii)-AlternativeMinimumTax(Amt)Items:amount	Money	Line 15 (III) - Alternative Minimum Tax (AMT) Items
a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line15(Iv)-AlternativeMinimumTax(Amt)Items:code	A, B, C, D, E, F	Line 15 (IV) - Alternative Minimum Tax (AMT) Items
a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line15(Iv)-AlternativeMinimumTax(Amt)Items:amount	Money	Line 15 (IV) - Alternative Minimum Tax (AMT) Items
a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line15(V)-AlternativeMinimumTax(Amt)Items:code	A, B, C, D, E, F	Line 15 (V) - Alternative Minimum Tax (AMT) Items
a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line15(V)-AlternativeMinimumTax(Amt)Items:amount	Money	Line 15 (V) - Alternative Minimum Tax (AMT) Items
a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line16(I)-ItemsAffectingShareholderBasis:code	A, B, C, D, E, F	Line 16 (I) - Items Affecting Shareholder Basis
a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line16(I)-ItemsAffectingShareholderBasis:amount	Money	Line 16 (I) - Items Affecting Shareholder Basis
a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line16(Ii)-ItemsAffectingShareholderBasis:code	A, B, C, D, E, F	Line 16 (II) - Items Affecting Shareholder Basis
a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line16(Ii)-ItemsAffectingShareholderBasis:amount	Money	Line 16 (II) - Items Affecting Shareholder Basis
a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line16(Iii)-ItemsAffectingShareholderBasis:code	A, B, C, D, E, F	Line 16 (III) - Items Affecting Shareholder Basis
a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line16(Iii)-ItemsAffectingShareholderBasis:amount	Money	Line 16 (III) - Items Affecting Shareholder Basis
a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line16(Iv)-ItemsAffectingShareholderBasis:code	A, B, C, D, E, F	Line 16 (IV) - Items Affecting Shareholder Basis
a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line16(Iv)-ItemsAffectingShareholderBasis:amount	Money	Line 16 (IV) - Items Affecting Shareholder Basis
a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line16(V)-ItemsAffectingShareholderBasis:code	A, B, C, D, E, F	Line 16 (V) - Items Affecting Shareholder Basis
a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line16(V)-ItemsAffectingShareholderBasis:amount	Money	Line 16 (V) - Items Affecting Shareholder Basis
a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(I)-OtherInformation:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, U, V, AA, AB, AC, AJ, AN, AP, AS, AT, AU, AV, AW, ZZ	Line 17 (I) - Other Information
a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(I)-OtherInformation:amount	Money	Line 17 (I) - Other Information
a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(Ii)-OtherInformation:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, U, V, AA, AB, AC, AJ, AN, AP, AS, AT, AU, AV, AW, ZZ	Line 17 (II) - Other Information
a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(Ii)-OtherInformation:amount	Money	Line 17 (II) - Other Information
a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(Iii)-OtherInformation:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, U, V, AA, AB, AC, AJ, AN, AP, AS, AT, AU, AV, AW, ZZ	Line 17 (III) - Other Information
a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(Iii)-OtherInformation:amount	Money	Line 17 (III) - Other Information
a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(Iv)-OtherInformation:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, U, V, AA, AB, AC, AJ, AN, AP, AS, AT, AU, AV, AW, ZZ	Line 17 (IV) - Other Information
a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(Iv)-OtherInformation:amount	Money	Line 17 (IV) - Other Information
a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(V)-OtherInformation:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, U, V, AA, AB, AC, AJ, AN, AP, AS, AT, AU, AV, AW, ZZ	Line 17 (V) - Other Information
a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(V)-OtherInformation:amount	Money	Line 17 (V) - Other Information
a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(Vi)-OtherInformation:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, U, V, AA, AB, AC, AJ, AN, AP, AS, AT, AU, AV, AW, ZZ	Line 17 (VI) - Other Information
a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(Vi)-OtherInformation:amount	Money	Line 17 (VI) - Other Information
a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(Vii)-OtherInformation:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, U, V, AA, AB, AC, AJ, AN, AP, AS, AT, AU, AV, AW, ZZ	Line 17 (VII) - Other Information
a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(Vii)-OtherInformation:amount	Money	Line 17 (VII) - Other Information
a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(Viii)-OtherInformation:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, U, V, AA, AB, AC, AJ, AN, AP, AS, AT, AU, AV, AW, ZZ	Line 17 (VIII) - Other Information
a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(Viii)-OtherInformation:amount	Money	Line 17 (VIII) - Other Information
a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(Ix)-OtherInformation:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, U, V, AA, AB, AC, AJ, AN, AP, AS, AT, AU, AV, AW, ZZ	Line 17 (IX) - Other Information
a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(Ix)-OtherInformation:amount	Money	Line 17 (IX) - Other Information
a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(X)-OtherInformation:code	A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, U, V, AA, AB, AC, AJ, AN, AP, AS, AT, AU, AV, AW, ZZ	Line 17 (X) - Other Information
a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(X)-OtherInformation:amount	Money	Line 17 (X) - Other Information
a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line18-MoreThanOneActivityForAt-RiskPurposes	CHECKED, NOT CHECKED	Line 18 - More Than One Activity For At-Risk Purposes
a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line19-MoreThanOneActivityForPassiveActivityPurposes	CHECKED, NOT CHECKED	Line 19 - More Than One Activity For Passive Activity Purposes
Sample document
drive.google.com
1120S_SCHEDULE_K_1_2024.pdf
Sample JSON result
JSON
{
  "pk": 57065531,
  "uuid": "f5869094-47e9-416d-82b0-265aee6e0fab",
  "name": "A_1120S_SCHEDULE_K_1_2024 - API Documentation",
  "created": "2025-01-14T16:23:17Z",
  "created_ts": "2025-01-14T16:23:17Z",
  "verified_pages_count": 1,
  "book_status": "ACTIVE",
  "id": 57065531,
  "forms": [
    {
      "pk": 62096166,
      "uuid": "86eab0e6-fe08-47b8-943c-ee98f18017d5",
      "uploaded_doc_pk": 87356212,
      "form_type": "A_1120S_SCHEDULE_K_1_2024",
      "form_config_pk": 1094011,
      "tables": [],
      "attribute_data": null,
      "raw_fields": {
        "a_1120s_schedule_k_1_2024-Part01-General:year": {
          "value": "2024",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part01-General:finalK-1": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part01-General:amendedK-1": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part01-General:endingDateOfTaxYear": {
          "value": "12/31/2024",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part01-General:beginningDateOfTaxYear": {
          "value": "01/01/2024",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part02-PartI-InformationAboutTheCorporation:boxB-Corporation'SName": {
          "value": "ANY SAMPLE CORPORATION",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part03-PartIi-InformationAboutTheShareholder:boxF1-Shareholder'SName": {
          "value": "JOHN SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part04-PartIii-Shareholder'SShareOfCurrentYearIncome1-9:line6-Royalties": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part02-PartI-InformationAboutTheCorporation:boxB-Corporation'SAddress:zip": {
          "value": "12345-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part02-PartI-InformationAboutTheCorporation:boxB-Corporation'SAddress:city": {
          "value": "ANY CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part02-PartI-InformationAboutTheCorporation:boxB-Corporation'SAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part03-PartIi-InformationAboutTheShareholder:boxF1-Shareholder'SAddress:zip": {
          "value": "12345-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part03-PartIi-InformationAboutTheShareholder:boxF1-Shareholder'SAddress:city": {
          "value": "ANY CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part04-PartIii-Shareholder'SShareOfCurrentYearIncome1-9:line4-InterestIncome": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part03-PartIi-InformationAboutTheShareholder:boxF1-Shareholder'SAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part03-PartIi-InformationAboutTheShareholder:boxE-Shareholder'SIdentifyingNumber": {
          "value": "123-45-9876",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part04-PartIii-Shareholder'SShareOfCurrentYearIncome1-9:line5A-OrdinaryDividends": {
          "value": "500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part06-PartIii-Shareholder'SShareOfCurrentYearIncome13-14:line13(I)-Credits:code": {
          "value": "A",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part06-PartIii-Shareholder'SShareOfCurrentYearIncome13-14:line13(V)-Credits:code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part03-PartIi-InformationAboutTheShareholder:boxG-CurrentYearAllocationPercentage": {
          "value": "51%",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part04-PartIii-Shareholder'SShareOfCurrentYearIncome1-9:line5B-QualifiedDividends": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part06-PartIii-Shareholder'SShareOfCurrentYearIncome13-14:line13(Ii)-Credits:code": {
          "value": "B",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part06-PartIii-Shareholder'SShareOfCurrentYearIncome13-14:line13(Iv)-Credits:code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part02-PartI-InformationAboutTheCorporation:boxB-Corporation'SAddress:addressLine1": {
          "value": "A12 ANY SW STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part02-PartI-InformationAboutTheCorporation:boxB-Corporation'SAddress:addressLine2": {
          "value": "APT 12",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part06-PartIii-Shareholder'SShareOfCurrentYearIncome13-14:line13(I)-Credits:amount": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part06-PartIii-Shareholder'SShareOfCurrentYearIncome13-14:line13(Iii)-Credits:code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part06-PartIii-Shareholder'SShareOfCurrentYearIncome13-14:line13(V)-Credits:amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part03-PartIi-InformationAboutTheShareholder:boxI-LoansFromShareholder:endOfTaxYear": {
          "value": "60000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part06-PartIii-Shareholder'SShareOfCurrentYearIncome13-14:line13(Ii)-Credits:amount": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part06-PartIii-Shareholder'SShareOfCurrentYearIncome13-14:line13(Iv)-Credits:amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part03-PartIi-InformationAboutTheShareholder:boxF1-Shareholder'SAddress:addressLine1": {
          "value": "A13 ANY STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part03-PartIi-InformationAboutTheShareholder:boxF1-Shareholder'SAddress:addressLine2": {
          "value": "APT 123",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line11-Section179Deduction": {
          "value": "500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part06-PartIii-Shareholder'SShareOfCurrentYearIncome13-14:line13(Iii)-Credits:amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part02-PartI-InformationAboutTheCorporation:boxC-IrsCenterWhereCorporationFiledReturn": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part03-PartIi-InformationAboutTheShareholder:boxF3-WhatTypeOfEntityIsThisShareholder?": {
          "value": "SOLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part04-PartIii-Shareholder'SShareOfCurrentYearIncome1-9:line9-NetSection1231Gain(Loss)": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part04-PartIii-Shareholder'SShareOfCurrentYearIncome1-9:line3-OtherNetRentalIncome(Loss)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(I)-OtherDeductions:code": {
          "value": "A",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(V)-OtherDeductions:code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part03-PartIi-InformationAboutTheShareholder:boxI-LoansFromShareholder:beginningOfTaxYear": {
          "value": "50000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(Ii)-OtherDeductions:code": {
          "value": "B",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(Iv)-OtherDeductions:code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(Vi)-OtherDeductions:code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(I)-OtherInformation:code": {
          "value": "A",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(V)-OtherInformation:code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(X)-OtherInformation:code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part02-PartI-InformationAboutTheCorporation:boxA-Corporation'SEmployerIdentificationNumber": {
          "value": "12-3456789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part03-PartIi-InformationAboutTheShareholder:boxH-Shareholder'SNumberOfShares:endOfTaxYear": {
          "value": "11000",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part04-PartIii-Shareholder'SShareOfCurrentYearIncome1-9:line1-OrdinaryBusinessIncome(Loss)": {
          "value": "500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part04-PartIii-Shareholder'SShareOfCurrentYearIncome1-9:line8B-Collectibles(28%)Gain(Loss)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part04-PartIii-Shareholder'SShareOfCurrentYearIncome1-9:line8C-UnrecapturedSection1250Gain": {
          "value": "500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line10(I)-OtherIncome(Loss):code": {
          "value": "A",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line10(V)-OtherIncome(Loss):code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(I)-OtherDeductions:amount": {
          "value": "500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(Iii)-OtherDeductions:code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(V)-OtherDeductions:amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(Vii)-OtherDeductions:code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(Ii)-OtherInformation:code": {
          "value": "B",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(Iv)-OtherInformation:code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(Ix)-OtherInformation:code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(Vi)-OtherInformation:code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part03-PartIi-InformationAboutTheShareholder:boxF2-IfTheShareholderIsADisregardedEntity:tin": {
          "value": "12-3456789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line10(Ii)-OtherIncome(Loss):code": {
          "value": "B",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line10(Iv)-OtherIncome(Loss):code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(Ii)-OtherDeductions:amount": {
          "value": "500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(Iv)-OtherDeductions:amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(Vi)-OtherDeductions:amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(Viii)-OtherDeductions:code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(I)-OtherInformation:amount": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(Iii)-OtherInformation:code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(V)-OtherInformation:amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(Vii)-OtherInformation:code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(X)-OtherInformation:amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part03-PartIi-InformationAboutTheShareholder:boxF2-IfTheShareholderIsADisregardedEntity:name": {
          "value": "JOHN FAKE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part04-PartIii-Shareholder'SShareOfCurrentYearIncome1-9:line7-NetShort-TermCapitalGain(Loss)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part04-PartIii-Shareholder'SShareOfCurrentYearIncome1-9:line8A-NetLong-TermCapitalGain(Loss)": {
          "value": "500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line10(I)-OtherIncome(Loss):amount": {
          "value": "500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line10(Iii)-OtherIncome(Loss):code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line10(V)-OtherIncome(Loss):amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(Iii)-OtherDeductions:amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(Vii)-OtherDeductions:amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(Ii)-OtherInformation:amount": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(Iv)-OtherInformation:amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(Ix)-OtherInformation:amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(Vi)-OtherInformation:amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(Viii)-OtherInformation:code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part04-PartIii-Shareholder'SShareOfCurrentYearIncome1-9:line2-NetRentalRealEstateIncome(Loss)": {
          "value": "500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line10(Ii)-OtherIncome(Loss):amount": {
          "value": "500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line10(Iv)-OtherIncome(Loss):amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line12(Viii)-OtherDeductions:amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(Iii)-OtherInformation:amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(Vii)-OtherInformation:amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part02-PartI-InformationAboutTheCorporation:boxD-Corporation'STotalNumberOfShares:endOfTaxYear": {
          "value": "20000",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part05-PartIii-Shareholder'SShareOfCurrentYearIncome10-12:line10(Iii)-OtherIncome(Loss):amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line17(Viii)-OtherInformation:amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part06-PartIii-Shareholder'SShareOfCurrentYearIncome13-14:line14-ScheduleK-3IsAttachedIfChecked": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part03-PartIi-InformationAboutTheShareholder:boxH-Shareholder'SNumberOfShares:beginningOfTaxYear": {
          "value": "5500",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part02-PartI-InformationAboutTheCorporation:boxD-Corporation'STotalNumberOfShares:beginningOfTaxYear": {
          "value": "10000",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line18-MoreThanOneActivityForAt-RiskPurposes": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line16(I)-ItemsAffectingShareholderBasis:code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line16(V)-ItemsAffectingShareholderBasis:code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line15(I)-AlternativeMinimumTax(Amt)Items:code": {
          "value": "A",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line15(V)-AlternativeMinimumTax(Amt)Items:code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line16(Ii)-ItemsAffectingShareholderBasis:code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line16(Iv)-ItemsAffectingShareholderBasis:code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line15(Ii)-AlternativeMinimumTax(Amt)Items:code": {
          "value": "B",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line15(Iv)-AlternativeMinimumTax(Amt)Items:code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line16(I)-ItemsAffectingShareholderBasis:amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line16(Iii)-ItemsAffectingShareholderBasis:code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line16(V)-ItemsAffectingShareholderBasis:amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line15(I)-AlternativeMinimumTax(Amt)Items:amount": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line15(Iii)-AlternativeMinimumTax(Amt)Items:code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line15(V)-AlternativeMinimumTax(Amt)Items:amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line16(Ii)-ItemsAffectingShareholderBasis:amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line16(Iv)-ItemsAffectingShareholderBasis:amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line15(Ii)-AlternativeMinimumTax(Amt)Items:amount": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line15(Iv)-AlternativeMinimumTax(Amt)Items:amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line16(Iii)-ItemsAffectingShareholderBasis:amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part07-PartIii-Shareholder'SShareOfCurrentYearIncome15-16:line15(Iii)-AlternativeMinimumTax(Amt)Items:amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        },
        "a_1120s_schedule_k_1_2024-Part08-PartIii-Shareholder'SShareOfCurrentYearIncome17-19:line19-MoreThanOneActivityForPassiveActivityPurposes": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1120S_SCHEDULE_K_1_2024.pdf",
          "confidence": 1.0
        }
      }
    }
  ],
  "book_is_complete": true
}


Updated 5 months ago

IRS Form 1120S Schedule K-1 (2023) - Shareholder’s Share of Income, Deductions, Credits, etc.
IRS Form 1120S Schedules L, M-1, and M-2 (2018) - Balance Sheet (L), Income Reconciliation (M-1), and Analysis (M-2) of S Corporation's Financial Activity Report
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