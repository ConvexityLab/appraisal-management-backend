# IRS Form 1040 Schedule A (2021) - Itemized Deductions

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
IRS Form 1040 Schedule A (2021) - Itemized Deductions
Suggest Edits

This form is used to calculate itemized deductions. Taxpayers typically can deduct either their itemized deductions or their standard deduction from their federal income tax. Generally, choosing the larger of the two deductions results in a lower federal income tax liability.

To use the Upload PDF endpoint for this document, you must use A_1040_SCHEDULE_A_2021 in the form_type parameter.

SCHEDULE A

The document type A_1040_SCHEDULE_A_2021 supports data capture from the IRS 1040 Schedule A only. The first two pages of the document 1040 are processed as a separate document type.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
a_1040_schedule_a_2021-Part1-General:year	Integer	Year
a_1040_schedule_a_2021-Part1-General:name(s)ShownOnForm1040Or1040-Sr	Text	Name(s) Shown On Form 1040 Or 1040-SR
a_1040_schedule_a_2021-Part1-General:yourSocialSecurityNumber	Social Security Number	Your Social Security Number
a_1040_schedule_a_2021-Part2-MedicalAndDentalExpenses:line1-MedicalAndDentalExpenses	Money	Line 1 - Medical And Dental Expenses
a_1040_schedule_a_2021-Part2-MedicalAndDentalExpenses:line2-EnterAmountFromForm1040Or1040-SrLine11	Money	Line 2 - Enter Amount From Form 1040 Or 1040-SR Line 11
a_1040_schedule_a_2021-Part2-MedicalAndDentalExpenses:line3-MultiplyLine2By7.5%	Money	Line 3 - Multiply Line 2 By 7.5%
a_1040_schedule_a_2021-Part2-MedicalAndDentalExpenses:line4-SubtractLine3FromLine1.IfLine3IsMoreThanLine1Enter-0-	Money	Line 4 - Subtract Line 3 From Line 1. If Line 3 Is More Than Line 1 Enter -0-
a_1040_schedule_a_2021-Part3-TaxesYouPaid:line5-StateAndLocalTaxes:line5A-IfYouElectToIncludeGeneralSalesTaxesInsteadOfIncomeTaxes-CheckBox	CHECKED, NOT CHECKED	Line 5 - State And Local Taxes
a_1040_schedule_a_2021-Part3-TaxesYouPaid:line5-StateAndLocalTaxes:line5A-IfYouElectToIncludeGeneralSalesTaxesInsteadOfIncomeTaxes-Amount	Money	Line 5 - State And Local Taxes
a_1040_schedule_a_2021-Part3-TaxesYouPaid:line5-StateAndLocalTaxes:line5B-StateAndLocalTaxes-StateAndLocalRealEstateTaxes	Money	Line 5 - State And Local Taxes
a_1040_schedule_a_2021-Part3-TaxesYouPaid:line5-StateAndLocalTaxes:line5C-StateAndLocalTaxes-StateAndLocalPersonalPropertyTaxes	Money	Line 5 - State And Local Taxes
a_1040_schedule_a_2021-Part3-TaxesYouPaid:line5-StateAndLocalTaxes:line5D-StateAndLocalTaxes-AddLines5AThrough5C	Money	Line 5 - State And Local Taxes
a_1040_schedule_a_2021-Part3-TaxesYouPaid:line5-StateAndLocalTaxes:line5E-StateAndLocalTaxes-EnterTheSmallerOfLine5DOr$10000	Money	Line 5 - State And Local Taxes
a_1040_schedule_a_2021-Part3-TaxesYouPaid:line6-OtherTaxes.ListTypeAndAmount:line6-OtherTaxes-ListType	Text	Line 6 - Other Taxes. List Type And Amount
a_1040_schedule_a_2021-Part3-TaxesYouPaid:line6-OtherTaxes.ListTypeAndAmount:line6-OtherTaxes-Amount	Money	Line 6 - Other Taxes. List Type And Amount
a_1040_schedule_a_2021-Part3-TaxesYouPaid:line7-AddLines5EAnd6	Money	Line 7 - Add Lines 5E And 6
a_1040_schedule_a_2021-Part4-InterestYouPaid:line8-HomeMortgageInterestAndPoints:line8-HomeMortgageInterestAndPoints-CheckBox	CHECKED, NOT CHECKED	Line 8 - Home Mortgage Interest And Points
a_1040_schedule_a_2021-Part4-InterestYouPaid:line8-HomeMortgageInterestAndPoints:line8A-HomeMortgageInterestAndPointsReportedToYouOnForm1098	Money	Line 8 - Home Mortgage Interest And Points
a_1040_schedule_a_2021-Part4-InterestYouPaid:line8-HomeMortgageInterestAndPoints:line8B-HomeMortgageInterestNotReportedToYouOnForm1098-Description	Text	Line 8 - Home Mortgage Interest And Points
a_1040_schedule_a_2021-Part4-InterestYouPaid:line8-HomeMortgageInterestAndPoints:line8B-HomeMortgageInterestNotReportedToYouOnForm1098-Amount	Money	Line 8 - Home Mortgage Interest And Points
a_1040_schedule_a_2021-Part4-InterestYouPaid:line8-HomeMortgageInterestAndPoints:line8C-PointsNotReportedToYouOnForm1098.SeeInstructionsForSpecialRules	Money	Line 8 - Home Mortgage Interest And Points
a_1040_schedule_a_2021-Part4-InterestYouPaid:line8-HomeMortgageInterestAndPoints:line8D-MortgageInsurancePremiums	Money	Line 8 - Home Mortgage Interest And Points
a_1040_schedule_a_2021-Part4-InterestYouPaid:line8-HomeMortgageInterestAndPoints:line8E-AddLines8AThrough8D	Money	Line 8 - Home Mortgage Interest And Points
a_1040_schedule_a_2021-Part4-InterestYouPaid:line9-InvestmentInterest.AttachForm4952IfRequired	Money	Line 9 - Investment Interest. Attach Form 4952 If Required
a_1040_schedule_a_2021-Part4-InterestYouPaid:line10-AddLines8EAnd9	Money	Line 10 - Add Lines 8E And 9
a_1040_schedule_a_2021-Part5-GiftsToCharity:line11-GiftsByCashOrCheck.IfYouMadeAnyGiftOf$250OrMoreSeeInstructions	Money	Line 11 - Gifts By Cash Or Check. If You Made Any Gift Of $250 Or More See Instructions
a_1040_schedule_a_2021-Part5-GiftsToCharity:line12-OtherThanByCashOrCheck	Money	Line 12 - Other Than By Cash Or Check
a_1040_schedule_a_2021-Part5-GiftsToCharity:line13-CarryoverFromPriorYear	Money	Line 13 - Carryover From Prior Year
a_1040_schedule_a_2021-Part5-GiftsToCharity:line14-AddLines11Through13	Money	Line 14 - Add Lines 11 Through 13
a_1040_schedule_a_2021-Part6-CasualtyAndTheftLosses:line15-AttachForm4684AndEnterTheAmountFromLine18OfThatForm	Money	Line 15 - Attach Form 4684 And Enter The Amount From Line 18 Of That Form
a_1040_schedule_a_2021-Part7-OtherItemizedDeductions:line16-Other-FromListInInstructions.ListTypeAndAmount:line16-Other-FromListInInstructions-Type	Text	Line 16 - Other - From List In Instructions. List Type And Amount
a_1040_schedule_a_2021-Part7-OtherItemizedDeductions:line16-Other-FromListInInstructions.ListTypeAndAmount:line16-Other-FromListInInstructions-Amount	Money	Line 16 - Other - From List In Instructions. List Type And Amount
a_1040_schedule_a_2021-Part8-TotalItemizedDeductions:line17-AddTheAmountsInTheFarRightColumnForLines4Through16	Money	Line 17 - Add The Amounts In The Far Right Column For Lines 4 Through 16
a_1040_schedule_a_2021-Part8-TotalItemizedDeductions:line18-IfYouElectToItemizeDeductionsEvenThoughLessThanStandardDeduction	CHECKED, NOT CHECKED	Line 18 - If You Elect To Itemize Deductions Even Though Less Than Standard Deduction
Sample document

Coming soon...

Sample JSON result
JSON
{
  "status": 200,
  "response": {
    "pk": 41452493,
    "uuid": "98a4f8ac-a6f5-4713-927e-a0da35704ba0",
    "forms": [
      {
        "pk": 37904762,
        "uuid": "55919e50-2b54-4d60-91e3-b1fe1d8198f9",
        "form_type": "A_1040_SCHEDULE_A_2021",
        "form_config_pk": 57933,
        "tables": [],
        "raw_fields": {
          "a_1040_schedule_a_2021-Part1-General:year": {
            "value": "2021",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part1-General:yourSocialSecurityNumber": {
            "value": "123-45-6789",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part3-TaxesYouPaid:line7-AddLines5EAnd6": {
            "value": "9000.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part4-InterestYouPaid:line10-AddLines8EAnd9": {
            "value": "33000.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part1-General:name(s)ShownOnForm1040Or1040-Sr": {
            "value": "CALVIN SAMPLE",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part5-GiftsToCharity:line14-AddLines11Through13": {
            "value": "2000.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part5-GiftsToCharity:line12-OtherThanByCashOrCheck": {
            "value": "500.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part5-GiftsToCharity:line13-CarryoverFromPriorYear": {
            "value": "900.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part2-MedicalAndDentalExpenses:line3-MultiplyLine2By7.5%": {
            "value": "375.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part2-MedicalAndDentalExpenses:line1-MedicalAndDentalExpenses": {
            "value": "6000.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part4-InterestYouPaid:line9-InvestmentInterest.AttachForm4952IfRequired": {
            "value": "5000.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part2-MedicalAndDentalExpenses:line2-EnterAmountFromForm1040Or1040-SrLine11": {
            "value": "5000.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part3-TaxesYouPaid:line6-OtherTaxes.ListTypeAndAmount:line6-OtherTaxes-Amount": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part3-TaxesYouPaid:line6-OtherTaxes.ListTypeAndAmount:line6-OtherTaxes-ListType": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part4-InterestYouPaid:line8-HomeMortgageInterestAndPoints:line8E-AddLines8AThrough8D": {
            "value": "28000.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part6-CasualtyAndTheftLosses:line15-AttachForm4684AndEnterTheAmountFromLine18OfThatForm": {
            "value": "3000.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part8-TotalItemizedDeductions:line17-AddTheAmountsInTheFarRightColumnForLines4Through16": {
            "value": "63625.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part3-TaxesYouPaid:line5-StateAndLocalTaxes:line5D-StateAndLocalTaxes-AddLines5AThrough5C": {
            "value": "9000.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part2-MedicalAndDentalExpenses:line4-SubtractLine3FromLine1.IfLine3IsMoreThanLine1Enter-0-": {
            "value": "5625.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part4-InterestYouPaid:line8-HomeMortgageInterestAndPoints:line8D-MortgageInsurancePremiums": {
            "value": "5000.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part5-GiftsToCharity:line11-GiftsByCashOrCheck.IfYouMadeAnyGiftOf$250OrMoreSeeInstructions": {
            "value": "600.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part3-TaxesYouPaid:line5-StateAndLocalTaxes:line5B-StateAndLocalTaxes-StateAndLocalRealEstateTaxes": {
            "value": "2000.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part3-TaxesYouPaid:line5-StateAndLocalTaxes:line5E-StateAndLocalTaxes-EnterTheSmallerOfLine5DOr$10000": {
            "value": "9000.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part8-TotalItemizedDeductions:line18-IfYouElectToItemizeDeductionsEvenThoughLessThanStandardDeduction": {
            "value": "CHECKED",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part4-InterestYouPaid:line8-HomeMortgageInterestAndPoints:line8-HomeMortgageInterestAndPoints-CheckBox": {
            "value": "CHECKED",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part3-TaxesYouPaid:line5-StateAndLocalTaxes:line5C-StateAndLocalTaxes-StateAndLocalPersonalPropertyTaxes": {
            "value": "3000.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part3-TaxesYouPaid:line5-StateAndLocalTaxes:line5A-IfYouElectToIncludeGeneralSalesTaxesInsteadOfIncomeTaxes-Amount": {
            "value": "4000.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part3-TaxesYouPaid:line5-StateAndLocalTaxes:line5A-IfYouElectToIncludeGeneralSalesTaxesInsteadOfIncomeTaxes-CheckBox": {
            "value": "CHECKED",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part4-InterestYouPaid:line8-HomeMortgageInterestAndPoints:line8A-HomeMortgageInterestAndPointsReportedToYouOnForm1098": {
            "value": "15000.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part4-InterestYouPaid:line8-HomeMortgageInterestAndPoints:line8B-HomeMortgageInterestNotReportedToYouOnForm1098-Amount": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part4-InterestYouPaid:line8-HomeMortgageInterestAndPoints:line8B-HomeMortgageInterestNotReportedToYouOnForm1098-Description": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part7-OtherItemizedDeductions:line16-Other-FromListInInstructions.ListTypeAndAmount:line16-Other-FromListInInstructions-Type": {
            "value": "GAMBLING",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part7-OtherItemizedDeductions:line16-Other-FromListInInstructions.ListTypeAndAmount:line16-Other-FromListInInstructions-Amount": {
            "value": "11000.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          },
          "a_1040_schedule_a_2021-Part4-InterestYouPaid:line8-HomeMortgageInterestAndPoints:line8C-PointsNotReportedToYouOnForm1098.SeeInstructionsForSpecialRules": {
            "value": "8000.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "1040 Schedule A (2021).pdf"
          }
        }
      }
    ]
  },
  "message": "OK"
}


Updated 11 months ago

IRS Form 1040 Schedule A (2020) - Itemized Deductions
IRS Form 1040 Schedule A (2022) - Itemized Deductions
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