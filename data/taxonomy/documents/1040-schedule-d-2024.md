# 1040 Schedule D (2024) - Capital Gains and Losses

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
1040 Schedule D (2024) - Capital Gains and Losses
Suggest Edits

This form is used to report the following financial transactions:

The sale or exchange of a capital asset that hasn't been reported on any other IRS form or schedule.
Gains resulting from involuntary conversions (excluding those due to casualty or theft) of capital assets that were not held for business or profit purposes.
Capital gain distributions that were not reported directly on Form 1040 (or effectively connected capital gain distributions that were not reported directly on Form 1040-NR).
Nonbusiness bad debts.

To use the Upload PDF endpoint for this document, you must use A_1040_SCHEDULE_D_2024 in the form_type parameter.

SCHEDULE D

The document type A_1040_SCHEDULE_D_2024 supports data capture from the 1040 Schedule D only. The first two pages of the document 1040 are processed as a separate document type.

Field descriptions

The following fields are available on this form type:

JSON Attribute	Data Type	Description
a_1040_schedule_d_2024-Part01-General:year	Integer	Year
a_1040_schedule_d_2024-Part01-General:name(s)ShownOnReturn	Text	Name(s) Shown On Return
a_1040_schedule_d_2024-Part01-General:yourSocialSecurityNumber	Social Security Number	Your Social Security Number
a_1040_schedule_d_2024-Part01-General:didYouDisposeOfAnyInvestment(S)InAQualifiedOpportunityFundDuringTheTaxYear?:yes	CHECKED, NOT CHECKED	Did You Dispose Of Any Investment(s) In A Qualified Opportunity Fund During The Tax Year?
a_1040_schedule_d_2024-Part01-General:didYouDisposeOfAnyInvestment(S)InAQualifiedOpportunityFundDuringTheTaxYear?:no	CHECKED, NOT CHECKED	Did You Dispose Of Any Investment(s) In A Qualified Opportunity Fund During The Tax Year?
a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line1A-TotalsForAllShort-TermTransactionsReportedOnForm1099-B:(d)Proceeds	Money	Line 1A - Totals For All Short-Term Transactions Reported On Form 1099-B
a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line1A-TotalsForAllShort-TermTransactionsReportedOnForm1099-B:(e)Cost	Money	Line 1A - Totals For All Short-Term Transactions Reported On Form 1099-B
a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line1A-TotalsForAllShort-TermTransactionsReportedOnForm1099-B:(h)GainOr(Loss)	Money	Line 1A - Totals For All Short-Term Transactions Reported On Form 1099-B
a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line1B-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxAChecked:(d)Proceeds	Money	Line 1B - Totals For All Transactions Reported On Form(s) 8949 With Box A Checked
a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line1B-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxAChecked:(e)Cost	Money	Line 1B - Totals For All Transactions Reported On Form(s) 8949 With Box A Checked
a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line1B-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxAChecked:(g)AdjustmentsToGainOrLossFromForm(S)8949PartILine2Column(G)	Money	Line 1B - Totals For All Transactions Reported On Form(s) 8949 With Box A Checked
a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line1B-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxAChecked:(h)GainOr(Loss)	Money	Line 1B - Totals For All Transactions Reported On Form(s) 8949 With Box A Checked
a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line2-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxBChecked:(d)Proceeds	Money	Line 2 - Totals For All Transactions Reported On Form(s) 8949 With Box B Checked
a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line2-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxBChecked:(e)Cost	Money	Line 2 - Totals For All Transactions Reported On Form(s) 8949 With Box B Checked
a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line2-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxBChecked:(g)AdjustmentsToGainOrLossFromForm(S)8949PartILine2Column(G)	Money	Line 2 - Totals For All Transactions Reported On Form(s) 8949 With Box B Checked
a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line2-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxBChecked:(h)GainOr(Loss)	Money	Line 2 - Totals For All Transactions Reported On Form(s) 8949 With Box B Checked
a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line3-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxCChecked:(d)Proceeds	Money	Line 3 - Totals For All Transactions Reported On Form(s) 8949 With Box C Checked
a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line3-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxCChecked:(e)Cost	Money	Line 3 - Totals For All Transactions Reported On Form(s) 8949 With Box C Checked
a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line3-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxCChecked:(g)AdjustmentsToGainOrLossFromForm(S)8949PartILine2Column(G)	Money	Line 3 - Totals For All Transactions Reported On Form(s) 8949 With Box C Checked
a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line3-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxCChecked:(h)GainOr(Loss)	Money	Line 3 - Totals For All Transactions Reported On Form(s) 8949 With Box C Checked
a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line4-Short-TermGainFromForm6252	Money	Line 4 - Short-Term Gain From Form 6252
a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line5-NetShort-TermGainOr(Loss)FromPartnershipsSCorporationsEstatesAndTrusts	Money	Line 5 - Net Short-Term Gain Or (Loss) From Partnerships S Corporations Estates And Trusts
a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line6-Short-TermCapitalLossCarryover	Money	Line 6 - Short-Term Capital Loss Carryover
a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line7-NetShort-TermCapitalGainOr(Loss)	Money	Line 7 - Net Short-Term Capital Gain Or (Loss)
a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line8A-TotalsForAllLong-TermTransactionsReportedOnForm1099-B:(d)Proceeds	Money	Line 8A - Totals For All Long-Term Transactions Reported On Form 1099-B
a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line8A-TotalsForAllLong-TermTransactionsReportedOnForm1099-B:(e)Cost	Money	Line 8A - Totals For All Long-Term Transactions Reported On Form 1099-B
a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line8A-TotalsForAllLong-TermTransactionsReportedOnForm1099-B:(h)GainOr(Loss)	Money	Line 8A - Totals For All Long-Term Transactions Reported On Form 1099-B
a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line8B-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxDChecked:(d)Proceeds	Money	Line 8B - Totals For All Transactions Reported On Form(s) 8949 With Box D Checked
a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line8B-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxDChecked:(e)Cost	Money	Line 8B - Totals For All Transactions Reported On Form(s) 8949 With Box D Checked
a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line8B-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxDChecked:(g)AdjustmentsToGainOrLossFromForm(S)8949PartIiLine2Column(G)	Money	Line 8B - Totals For All Transactions Reported On Form(s) 8949 With Box D Checked
a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line8B-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxDChecked:(h)GainOr(Loss)	Money	Line 8B - Totals For All Transactions Reported On Form(s) 8949 With Box D Checked
a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line9-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxEChecked:(d)Proceeds	Money	Line 9 - Totals For All Transactions Reported On Form(s) 8949 With Box E Checked
a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line9-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxEChecked:(e)Cost	Money	Line 9 - Totals For All Transactions Reported On Form(s) 8949 With Box E Checked
a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line9-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxEChecked:(g)AdjustmentsToGainOrLossFromForm(S)8949PartIiLine2Column(G)	Money	Line 9 - Totals For All Transactions Reported On Form(s) 8949 With Box E Checked
a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line9-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxEChecked:(h)GainOr(Loss)	Money	Line 9 - Totals For All Transactions Reported On Form(s) 8949 With Box E Checked
a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line10-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxFChecked:(d)Proceeds	Money	Line 10 - Totals For All Transactions Reported On Form(s) 8949 With Box F Checked
a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line10-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxFChecked:(e)Cost	Money	Line 10 - Totals For All Transactions Reported On Form(s) 8949 With Box F Checked
a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line10-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxFChecked:(g)AdjustmentsToGainOrLossFromForm(S)8949PartIiLine2Column(G)	Money	Line 10 - Totals For All Transactions Reported On Form(s) 8949 With Box F Checked
a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line10-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxFChecked:(h)GainOr(Loss)	Money	Line 10 - Totals For All Transactions Reported On Form(s) 8949 With Box F Checked
a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line11-GainFromForm4797PartILong-TermGainFromForms2439And6252	Money	Line 11 - Gain From Form 4797 Part I Long-Term Gain From Forms 2439 And 6252
a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line12-NetLong-TermGainOr(Loss)FromPartnershipsSCorporationsEstatesAndTrusts	Money	Line 12 - Net Long-Term Gain Or (Loss) From Partnerships S Corporations Estates And Trusts
a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line13-CapitalGainDistributions	Money	Line 13 - Capital Gain Distributions
a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line14-Long-TermCapitalLossCarryover	Money	Line 14 - Long-Term Capital Loss Carryover
a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line15-NetLong-TermCapitalGainOr(Loss)	Money	Line 15 - Net Long-Term Capital Gain Or (Loss)
a_1040_schedule_d_2024-Part04-Summary:line16-CombineLines7And15AndEnterTheResult	Money	Line 16 - Combine Lines 7 And 15 And Enter The Result
a_1040_schedule_d_2024-Part04-Summary:line17-AreLines15And16BothGains?:yes	CHECKED, NOT CHECKED	Line 17 - Are Lines 15 And 16 Both Gains?
a_1040_schedule_d_2024-Part04-Summary:line17-AreLines15And16BothGains?:no	CHECKED, NOT CHECKED	Line 17 - Are Lines 15 And 16 Both Gains?
a_1040_schedule_d_2024-Part04-Summary:line18-IfYouAreRequiredToCompleteThe28%RateGainWorksheetEnterTheAmount	Money	Line 18 - If You Are Required To Complete The 28% Rate Gain Worksheet Enter The Amount
a_1040_schedule_d_2024-Part04-Summary:line19-IfYouAreRequiredToCompleteTheUnrecapturedSection1250GainWorksheet	Money	Line 19 - If You Are Required To Complete The Unrecaptured Section 1250 Gain Worksheet
a_1040_schedule_d_2024-Part04-Summary:line20-AreLines18And19BothZeroOrBlank?:yes	CHECKED, NOT CHECKED	Line 20 - Are Lines 18 And 19 Both Zero Or Blank?
a_1040_schedule_d_2024-Part04-Summary:line20-AreLines18And19BothZeroOrBlank?:no	CHECKED, NOT CHECKED	Line 20 - Are Lines 18 And 19 Both Zero Or Blank?
a_1040_schedule_d_2024-Part04-Summary:line21-IfLine16IsALossEnterTheSmallerOf	Money	Line 21 - If Line 16 Is A Loss Enter The Smaller Of
a_1040_schedule_d_2024-Part04-Summary:line22-DoYouHaveQualifiedDividends?:yes	CHECKED, NOT CHECKED	Line 22 - Do You Have Qualified Dividends?
a_1040_schedule_d_2024-Part04-Summary:line22-DoYouHaveQualifiedDividends?:no	CHECKED, NOT CHECKED	Line 22 - Do You Have Qualified Dividends?
Sample document
drive.google.com
1040_SCHEDULE_D_2024.pdf
Sample JSON result
JSON
{
  "pk": 56844353,
  "uuid": "61f225c7-38bd-4040-a9e9-fa861fe2b8c0",
  "name": "A_1040_SCHEDULE_D_2024 - API Documentation",
  "created": "2025-01-07T18:40:18Z",
  "created_ts": "2025-01-07T18:40:18Z",
  "verified_pages_count": 2,
  "book_status": "ACTIVE",
  "id": 56844353,
  "forms": [
    {
      "pk": 61892900,
      "uuid": "d8dff297-5896-43aa-a234-880b3688b80f",
      "uploaded_doc_pk": 86827483,
      "form_type": "A_1040_SCHEDULE_D_2024",
      "form_config_pk": 1074968,
      "tables": [],
      "attribute_data": null,
      "raw_fields": {
        "a_1040_schedule_d_2024-Part01-General:year": {
          "value": "2024",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part01-General:name(s)ShownOnReturn": {
          "value": "JORDAN DUMMY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part01-General:yourSocialSecurityNumber": {
          "value": "123-45-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line13-CapitalGainDistributions": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line4-Short-TermGainFromForm6252": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line14-Long-TermCapitalLossCarryover": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line6-Short-TermCapitalLossCarryover": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line15-NetLong-TermCapitalGainOr(Loss)": {
          "value": "5000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line7-NetShort-TermCapitalGainOr(Loss)": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part01-General:didYouDisposeOfAnyInvestment(S)InAQualifiedOpportunityFundDuringTheTaxYear?:no": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part01-General:didYouDisposeOfAnyInvestment(S)InAQualifiedOpportunityFundDuringTheTaxYear?:yes": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line11-GainFromForm4797PartILong-TermGainFromForms2439And6252": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line8A-TotalsForAllLong-TermTransactionsReportedOnForm1099-B:(e)Cost": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line1A-TotalsForAllShort-TermTransactionsReportedOnForm1099-B:(e)Cost": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line8A-TotalsForAllLong-TermTransactionsReportedOnForm1099-B:(d)Proceeds": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line1A-TotalsForAllShort-TermTransactionsReportedOnForm1099-B:(d)Proceeds": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line9-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxEChecked:(e)Cost": {
          "value": "2000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line2-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxBChecked:(e)Cost": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line3-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxCChecked:(e)Cost": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line10-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxFChecked:(e)Cost": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line8B-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxDChecked:(e)Cost": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line1B-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxAChecked:(e)Cost": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line12-NetLong-TermGainOr(Loss)FromPartnershipsSCorporationsEstatesAndTrusts": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line8A-TotalsForAllLong-TermTransactionsReportedOnForm1099-B:(h)GainOr(Loss)": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line5-NetShort-TermGainOr(Loss)FromPartnershipsSCorporationsEstatesAndTrusts": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line1A-TotalsForAllShort-TermTransactionsReportedOnForm1099-B:(h)GainOr(Loss)": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line9-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxEChecked:(d)Proceeds": {
          "value": "3000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line2-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxBChecked:(d)Proceeds": {
          "value": "2000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line3-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxCChecked:(d)Proceeds": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line10-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxFChecked:(d)Proceeds": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line8B-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxDChecked:(d)Proceeds": {
          "value": "2000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line1B-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxAChecked:(d)Proceeds": {
          "value": "2000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line9-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxEChecked:(h)GainOr(Loss)": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line2-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxBChecked:(h)GainOr(Loss)": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line3-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxCChecked:(h)GainOr(Loss)": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line10-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxFChecked:(h)GainOr(Loss)": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line8B-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxDChecked:(h)GainOr(Loss)": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line1B-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxAChecked:(h)GainOr(Loss)": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line2-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxBChecked:(g)AdjustmentsToGainOrLossFromForm(S)8949PartILine2Column(G)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line3-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxCChecked:(g)AdjustmentsToGainOrLossFromForm(S)8949PartILine2Column(G)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line9-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxEChecked:(g)AdjustmentsToGainOrLossFromForm(S)8949PartIiLine2Column(G)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part02-Short-TermCapitalGainsAndLosses:line1B-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxAChecked:(g)AdjustmentsToGainOrLossFromForm(S)8949PartILine2Column(G)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line10-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxFChecked:(g)AdjustmentsToGainOrLossFromForm(S)8949PartIiLine2Column(G)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part03-Long-TermCapitalGainsAndLosses:line8B-TotalsForAllTransactionsReportedOnForm(S)8949WithBoxDChecked:(g)AdjustmentsToGainOrLossFromForm(S)8949PartIiLine2Column(G)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part04-Summary:line17-AreLines15And16BothGains?:no": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part04-Summary:line17-AreLines15And16BothGains?:yes": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part04-Summary:line22-DoYouHaveQualifiedDividends?:no": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part04-Summary:line21-IfLine16IsALossEnterTheSmallerOf": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part04-Summary:line22-DoYouHaveQualifiedDividends?:yes": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part04-Summary:line20-AreLines18And19BothZeroOrBlank?:no": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part04-Summary:line16-CombineLines7And15AndEnterTheResult": {
          "value": "6000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part04-Summary:line20-AreLines18And19BothZeroOrBlank?:yes": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part04-Summary:line18-IfYouAreRequiredToCompleteThe28%RateGainWorksheetEnterTheAmount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_d_2024-Part04-Summary:line19-IfYouAreRequiredToCompleteTheUnrecapturedSection1250GainWorksheet": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040_SCHEDULE_D_2024.pdf",
          "confidence": 1.0
        }
      }
    }
  ],
  "book_is_complete": true
}


Updated 5 months ago

IRS Form 1040 Schedule D (2023) - Capital Gains and Losses
IRS Form 1040 Schedule E (2018) - Supplemental Income and Loss
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