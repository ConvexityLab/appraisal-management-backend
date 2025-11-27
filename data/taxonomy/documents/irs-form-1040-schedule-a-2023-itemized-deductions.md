# IRS Form 1040 Schedule A (2023) - Itemized Deductions

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
IRS Form 1040 Schedule A (2023) - Itemized Deductions
Suggest Edits

This form is used to calculate itemized deductions. Taxpayers typically can deduct either their itemized deductions or their standard deduction from their federal income tax. Generally, choosing the larger of the two deductions results in a lower federal income tax liability.

To use the Upload PDF endpoint for this document, you must use A_1040_SCHEDULE_A_2023 in the form_type parameter.

SCHEDULE A

The document type A_1040_SCHEDULE_A_2023 supports data capture from the IRS 1040 Schedule A only. The first two pages of the document 1040 are processed as a separate document type.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
a_1040_schedule_a_2023-Part01-General:year	Integer	Year
a_1040_schedule_a_2023-Part01-General:name(s)ShownOnForm1040Or1040-Sr	Text	Name(s) Shown On Form 1040 Or 1040-SR
a_1040_schedule_a_2023-Part01-General:yourSocialSecurityNumber	Social Security Number	Your Social Security Number
a_1040_schedule_a_2023-Part02-MedicalAndDentalExpenses:line1-MedicalAndDentalExpenses	Money	Line 1 - Medical And Dental Expenses
a_1040_schedule_a_2023-Part02-MedicalAndDentalExpenses:line2-EnterAmountFromForm1040Or1040-SrLine11	Money	Line 2 - Enter Amount From Form 1040 Or 1040-SR Line 11
a_1040_schedule_a_2023-Part02-MedicalAndDentalExpenses:line3-MultiplyLine2By7.5%	Money	Line 3 - Multiply Line 2 By 7.5%
a_1040_schedule_a_2023-Part02-MedicalAndDentalExpenses:line4-SubtractLine3FromLine1.IfLine3IsMoreThanLine1Enter-0-	Money	Line 4 - Subtract Line 3 From Line 1. If Line 3 Is More Than Line 1 Enter -0-
a_1040_schedule_a_2023-Part03-TaxesYouPaid:line5-StateAndLocalTaxes:line5A-StateAndLocalIncomeTaxesOrGeneralSalesTaxes-CheckBox	CHECKED, NOT CHECKED	Line 5 - State And Local Taxes
a_1040_schedule_a_2023-Part03-TaxesYouPaid:line5-StateAndLocalTaxes:line5A-StateAndLocalIncomeTaxesOrGeneralSalesTaxes-Amount	Money	Line 5 - State And Local Taxes
a_1040_schedule_a_2023-Part03-TaxesYouPaid:line5-StateAndLocalTaxes:line5B-StateAndLocalRealEstateTaxes	Money	Line 5 - State And Local Taxes
a_1040_schedule_a_2023-Part03-TaxesYouPaid:line5-StateAndLocalTaxes:line5C-StateAndLocalPersonalPropertyTaxes	Money	Line 5 - State And Local Taxes
a_1040_schedule_a_2023-Part03-TaxesYouPaid:line5-StateAndLocalTaxes:line5D-AddLines5AThrough5C	Money	Line 5 - State And Local Taxes
a_1040_schedule_a_2023-Part03-TaxesYouPaid:line5-StateAndLocalTaxes:line5E-EnterTheSmallerOfLine5DOr$10000	Money	Line 5 - State And Local Taxes
a_1040_schedule_a_2023-Part03-TaxesYouPaid:line6-OtherTaxes:line6(I)-ListType	Text	Line 6 - Other Taxes
a_1040_schedule_a_2023-Part03-TaxesYouPaid:line6-OtherTaxes:line6(I)-Amount	Money	Line 6 - Other Taxes
a_1040_schedule_a_2023-Part03-TaxesYouPaid:line6-OtherTaxes:line6(Ii)-ListType	Text	Line 6 - Other Taxes
a_1040_schedule_a_2023-Part03-TaxesYouPaid:line6-OtherTaxes:line6(Ii)-Amount	Money	Line 6 - Other Taxes
a_1040_schedule_a_2023-Part03-TaxesYouPaid:line6-OtherTaxes:total	Money	Line 6 - Other Taxes
a_1040_schedule_a_2023-Part03-TaxesYouPaid:line7-AddLines5EAnd6	Money	Line 7 - Add Lines 5E And 6
a_1040_schedule_a_2023-Part04-InterestYouPaid:line8-HomeMortgageInterestAndPoints:line8-HomeMortgageInterestAndPoints-CheckBox	CHECKED, NOT CHECKED	Line 8 - Home Mortgage Interest And Points
a_1040_schedule_a_2023-Part04-InterestYouPaid:line8-HomeMortgageInterestAndPoints:line8A-HomeMortgageInterestAndPointsReportedToYouOnForm1098	Money	Line 8 - Home Mortgage Interest And Points
a_1040_schedule_a_2023-Part04-InterestYouPaid:line8-HomeMortgageInterestAndPoints:line8B-HomeMortgageInterestNotReportedToYouOnForm1098-Description	Text	Line 8 - Home Mortgage Interest And Points
a_1040_schedule_a_2023-Part04-InterestYouPaid:line8-HomeMortgageInterestAndPoints:line8B-HomeMortgageInterestNotReportedToYouOnForm1098-Amount	Money	Line 8 - Home Mortgage Interest And Points
a_1040_schedule_a_2023-Part04-InterestYouPaid:line8-HomeMortgageInterestAndPoints:line8C-PointsNotReportedToYouOnForm1098	Money	Line 8 - Home Mortgage Interest And Points
a_1040_schedule_a_2023-Part04-InterestYouPaid:line8-HomeMortgageInterestAndPoints:line8D	Money	Line 8 - Home Mortgage Interest And Points
a_1040_schedule_a_2023-Part04-InterestYouPaid:line8-HomeMortgageInterestAndPoints:line8E-AddLines8AThrough8C	Money	Line 8 - Home Mortgage Interest And Points
a_1040_schedule_a_2023-Part04-InterestYouPaid:line9-InvestmentInterest	Money	Line 9 - Investment Interest
a_1040_schedule_a_2023-Part04-InterestYouPaid:line10-AddLines8EAnd9	Money	Line 10 - Add Lines 8E And 9
a_1040_schedule_a_2023-Part05-GiftsToCharity:line11-GiftsByCashOrCheck	Money	Line 11 - Gifts By Cash Or Check
a_1040_schedule_a_2023-Part05-GiftsToCharity:line12-OtherThanByCashOrCheck	Money	Line 12 - Other Than By Cash Or Check
a_1040_schedule_a_2023-Part05-GiftsToCharity:line13-CarryoverFromPriorYear	Money	Line 13 - Carryover From Prior Year
a_1040_schedule_a_2023-Part05-GiftsToCharity:line14-AddLines11Through13	Money	Line 14 - Add Lines 11 Through 13
a_1040_schedule_a_2023-Part06-CasualtyAndTheftLosses:line15-CasualtyAndTheftLoss(Es)FromAFederallyDeclaredDisaster	Money	Line 15 - Casualty And Theft Loss(es) From A Federally Declared Disaster
a_1040_schedule_a_2023-Part07-OtherItemizedDeductions:line16-Other-FromListInInstructions:line16(I)-ListType	Text	Line 16 - Other - From List In Instructions
a_1040_schedule_a_2023-Part07-OtherItemizedDeductions:line16-Other-FromListInInstructions:line16(I)-Amount	Money	Line 16 - Other - From List In Instructions
a_1040_schedule_a_2023-Part07-OtherItemizedDeductions:line16-Other-FromListInInstructions:line16(Ii)-ListType	Text	Line 16 - Other - From List In Instructions
a_1040_schedule_a_2023-Part07-OtherItemizedDeductions:line16-Other-FromListInInstructions:line16(Ii)-Amount	Money	Line 16 - Other - From List In Instructions
a_1040_schedule_a_2023-Part07-OtherItemizedDeductions:line16-Other-FromListInInstructions:line16(Iii)-ListType	Text	Line 16 - Other - From List In Instructions
a_1040_schedule_a_2023-Part07-OtherItemizedDeductions:line16-Other-FromListInInstructions:line16(Iii)-Amount	Money	Line 16 - Other - From List In Instructions
a_1040_schedule_a_2023-Part07-OtherItemizedDeductions:line16-Other-FromListInInstructions:total	Money	Line 16 - Other - From List In Instructions
a_1040_schedule_a_2023-Part08-TotalItemizedDeductions:line17-AddTheAmountsInTheFarRightColumnForLines4Through16	Money	Line 17 - Add The Amounts In The Far Right Column For Lines 4 Through 16
a_1040_schedule_a_2023-Part08-TotalItemizedDeductions:line18-IfYouElectToItemizeDeductionsEvenThough	CHECKED, NOT CHECKED	Line 18 - If You Elect To Itemize Deductions Even Though
Sample document

Coming soon...

Sample JSON result
JSON
{
  "pk": 45678806,
  "uuid": "7c91980d-a62e-4be6-9bea-dfe15e7f9793",
  "name": "A_1040_SCHEDULE_A_2023_API",
  "created": "2024-01-31T17:14:32Z",
  "created_ts": "2024-01-31T17:14:32Z",
  "verified_pages_count": 1,
  "book_status": "ACTIVE",
  "id": 45678806,
  "forms": [
    {
      "pk": 52748572,
      "uuid": "0ccdb7eb-7c5f-46d5-8c0a-e2a9769b6b6f",
      "uploaded_doc_pk": 66247420,
      "form_type": "A_1040_SCHEDULE_A_2023",
      "raw_fields": {
        "a_1040_schedule_a_2023-Part01-General:year": {
          "value": "2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part01-General:yourSocialSecurityNumber": {
          "value": "123-45-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part03-TaxesYouPaid:line7-AddLines5EAnd6": {
          "value": "6000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part03-TaxesYouPaid:line6-OtherTaxes:total": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part04-InterestYouPaid:line10-AddLines8EAnd9": {
          "value": "6000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part01-General:name(s)ShownOnForm1040Or1040-Sr": {
          "value": "JOHN SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part04-InterestYouPaid:line9-InvestmentInterest": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part05-GiftsToCharity:line11-GiftsByCashOrCheck": {
          "value": "250.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part05-GiftsToCharity:line14-AddLines11Through13": {
          "value": "600.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part05-GiftsToCharity:line12-OtherThanByCashOrCheck": {
          "value": "150.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part05-GiftsToCharity:line13-CarryoverFromPriorYear": {
          "value": "200.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part03-TaxesYouPaid:line6-OtherTaxes:line6(I)-Amount": {
          "value": "500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part03-TaxesYouPaid:line6-OtherTaxes:line6(Ii)-Amount": {
          "value": "500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part03-TaxesYouPaid:line6-OtherTaxes:line6(I)-ListType": {
          "value": "PAYROLL TAX",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part03-TaxesYouPaid:line6-OtherTaxes:line6(Ii)-ListType": {
          "value": "TARIFFS",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part02-MedicalAndDentalExpenses:line3-MultiplyLine2By7.5%": {
          "value": "150.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part02-MedicalAndDentalExpenses:line1-MedicalAndDentalExpenses": {
          "value": "2000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part04-InterestYouPaid:line8-HomeMortgageInterestAndPoints:line8D": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part03-TaxesYouPaid:line5-StateAndLocalTaxes:line5D-AddLines5AThrough5C": {
          "value": "5000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part07-OtherItemizedDeductions:line16-Other-FromListInInstructions:total": {
          "value": "300.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part02-MedicalAndDentalExpenses:line2-EnterAmountFromForm1040Or1040-SrLine11": {
          "value": "2000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part08-TotalItemizedDeductions:line18-IfYouElectToItemizeDeductionsEvenThough": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part03-TaxesYouPaid:line5-StateAndLocalTaxes:line5B-StateAndLocalRealEstateTaxes": {
          "value": "2000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part03-TaxesYouPaid:line5-StateAndLocalTaxes:line5E-EnterTheSmallerOfLine5DOr$10000": {
          "value": "5000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part07-OtherItemizedDeductions:line16-Other-FromListInInstructions:line16(I)-Amount": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part07-OtherItemizedDeductions:line16-Other-FromListInInstructions:line16(Ii)-Amount": {
          "value": "200.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part04-InterestYouPaid:line8-HomeMortgageInterestAndPoints:line8E-AddLines8AThrough8C": {
          "value": "5000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part07-OtherItemizedDeductions:line16-Other-FromListInInstructions:line16(I)-ListType": {
          "value": "GIFT TAXES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part07-OtherItemizedDeductions:line16-Other-FromListInInstructions:line16(Iii)-Amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part03-TaxesYouPaid:line5-StateAndLocalTaxes:line5C-StateAndLocalPersonalPropertyTaxes": {
          "value": "3000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part07-OtherItemizedDeductions:line16-Other-FromListInInstructions:line16(Ii)-ListType": {
          "value": "EDUCATIONAL DEDUCTION",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part07-OtherItemizedDeductions:line16-Other-FromListInInstructions:line16(Iii)-ListType": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part08-TotalItemizedDeductions:line17-AddTheAmountsInTheFarRightColumnForLines4Through16": {
          "value": "15750.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part02-MedicalAndDentalExpenses:line4-SubtractLine3FromLine1.IfLine3IsMoreThanLine1Enter-0-": {
          "value": "1850.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part06-CasualtyAndTheftLosses:line15-CasualtyAndTheftLoss(Es)FromAFederallyDeclaredDisaster": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part04-InterestYouPaid:line8-HomeMortgageInterestAndPoints:line8C-PointsNotReportedToYouOnForm1098": {
          "value": "3000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part03-TaxesYouPaid:line5-StateAndLocalTaxes:line5A-StateAndLocalIncomeTaxesOrGeneralSalesTaxes-Amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part04-InterestYouPaid:line8-HomeMortgageInterestAndPoints:line8-HomeMortgageInterestAndPoints-CheckBox": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part03-TaxesYouPaid:line5-StateAndLocalTaxes:line5A-StateAndLocalIncomeTaxesOrGeneralSalesTaxes-CheckBox": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part04-InterestYouPaid:line8-HomeMortgageInterestAndPoints:line8A-HomeMortgageInterestAndPointsReportedToYouOnForm1098": {
          "value": "2000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part04-InterestYouPaid:line8-HomeMortgageInterestAndPoints:line8B-HomeMortgageInterestNotReportedToYouOnForm1098-Amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_a_2023-Part04-InterestYouPaid:line8-HomeMortgageInterestAndPoints:line8B-HomeMortgageInterestNotReportedToYouOnForm1098-Description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1040 SCHEDULE A 2023.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 379973,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

IRS Form 1040 Schedule A (2022) - Itemized Deductions
1040 Schedule A (2024) - Itemized Deductions
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