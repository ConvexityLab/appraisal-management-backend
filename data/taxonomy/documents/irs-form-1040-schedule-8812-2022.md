# IRS Form 1040 Schedule 8812 (2022) - Credits for Qualifying Children and Other Dependents

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
IRS Form 1040 Schedule 8812 (2022) - Credits for Qualifying Children and Other Dependents
Suggest Edits

This form is used to report the Additional Child Tax Credit. This credit provides additional financial assistance to eligible taxpayers who have qualifying children and may result in a refund even if they do not owe any federal income tax.

To use the Upload PDF endpoint for this document, you must use A_1040_SCHEDULE_8812_2022 in the form_type parameter.

SCHEDULE 8812

The document type A_1040_SCHEDULE_8812_2022 supports data capture from the IRS 1040 Schedule 8812 only. The first two pages of the document 1040 are processed as a separate document type.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
a_1040_schedule_8812_2022-Part1-General:year	Integer	Year
a_1040_schedule_8812_2022-Part1-General:name(s)ShownOnReturn	Text	Name(S) Shown On Return
a_1040_schedule_8812_2022-Part1-General:yourSocialSecurityNumber	Social Security Number	Your Social Security Number
a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line1-EnterTheAmountFromLine11OfYourForm10401040-SrOr1040-Nr	Money	Line 1 - Enter The Amount From Line 11 Of Your Form 1040 1040-SR Or 1040-NR
a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line2A-EnterIncomeFromPuertoRicoThatYouExcluded	Money	Line 2A - Enter Income From Puerto Rico That You Excluded
a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line2B-EnterTheAmountsFromLines45And50OfYourForm2555	Money	Line 2B - Enter The Amounts From Lines 45 And 50 Of Your Form 2555
a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line2C-EnterTheAmountFromLine15OfYourForm4563	Money	Line 2C - Enter The Amount From Line 15 Of Your Form 4563
a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line2D-AddLines2AThrough2C	Money	Line 2D - Add Lines 2A Through 2C
a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line3-AddLines1And2D	Money	Line 3 - Add Lines 1 And 2D
a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line4-NumberOfQualifyingChildrenUnderAge17WithTheRequiredSocialSecurity	Integer	Line 4 - Number Of Qualifying Children Under Age 17 With The Required Social Security
a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line5-MultiplyLine4By$2000	Money	Line 5 - Multiply Line 4 By $2000
a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line6-NoOfOtherDependentsIncludingAnyQualifyingChildrenWhoNotUnderAge17	Integer	Line 6 - No Of Other Dependents Including Any Qualifying Children Who Not Under Age 17
a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line7-MultiplyLine6By$500	Money	Line 7 - Multiply Line 6 By $500
a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line8-AddLines5And7	Money	Line 8 - Add Lines 5 And 7
a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line9-EnterTheAmountShownBelowForYourFilingStatus	Money	Line 9 - Enter The Amount Shown Below For Your Filing Status
a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line10-SubtractLine9FromLine3	Money	Line 10 - Subtract Line 9 From Line 3
a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line11-MultiplyLine10By5%	Money	Line 11 - Multiply Line 10 By 5%
a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line12-IsTheAmountOnLine8MoreThanTheAmountOnLine11?:line12-IsTheAmountOnLine8MoreThanTheAmountOnLine11?-CheckBox	NO - STOP YOU CANNOT TAKE THE CHILD TAX CREDIT, YES - SUBTRACT LINE 11 FROM LINE 8 ENTER THE RESULT	Line 12 - Is The Amount On Line 8 More Than The Amount On Line 11?
a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line12-IsTheAmountOnLine8MoreThanTheAmountOnLine11?:line12-IsTheAmountOnLine8MoreThanTheAmountOnLine11?-Amount	Money	Line 12 - Is The Amount On Line 8 More Than The Amount On Line 11?
a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line13-EnterTheAmountFromTheCreditLimitWorksheetA	Money	Line 13 - Enter The Amount From The Credit Limit Worksheet A
a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line14-EnterTheSmallerOfLine12Or13ThisIsYourChildTaxCredit	Money	Line 14 - Enter The Smaller Of Line 12 Or 13 This Is Your Child Tax Credit
a_1040_schedule_8812_2022-Part2A-AdditionalChildTaxCreditForAllFilers:line15-CheckThisBoxIfYouDoNotWantToClaimTheAdditionalChildTaxCredit	CHECKED, NOT CHECKED	Line 15 - Check This Box If You Do Not Want To Claim The Additional Child Tax Credit
a_1040_schedule_8812_2022-Part2A-AdditionalChildTaxCreditForAllFilers:line16A-SubtractLine14FromLine12IfZeroStopHere	Money	Line 16A - Subtract Line 14 From Line 12 If Zero Stop Here
a_1040_schedule_8812_2022-Part2A-AdditionalChildTaxCreditForAllFilers:line16B-NumberOfQualifyingChildrenUnder17WithTheRequiredSsn:line16B-NumberOfQualifyingChildren	Integer	Line 16B - Number Of Qualifying Children Under 17 With The Required SSN
a_1040_schedule_8812_2022-Part2A-AdditionalChildTaxCreditForAllFilers:line16B-NumberOfQualifyingChildrenUnder17WithTheRequiredSsn:line16B-EnterTheResultIfZeroStopHereYouCanTClaimAdditionalChildTaxCredit`	Money	Line 16B - Number Of Qualifying Children Under 17 With The Required SSN
a_1040_schedule_8812_2022-Part2A-AdditionalChildTaxCreditForAllFilers:line17-EnterTheSmallerOfLine16AOrLine16B	Money	Line 17 - Enter The Smaller Of Line 16A Or Line 16B
a_1040_schedule_8812_2022-Part2A-AdditionalChildTaxCreditForAllFilers:line18A-EarnedIncome	Money	Line 18A -Earned Income
a_1040_schedule_8812_2022-Part2A-AdditionalChildTaxCreditForAllFilers:line18B-NontaxableCombatPay	Money	Line 18B - Nontaxable Combat Pay
a_1040_schedule_8812_2022-Part2A-AdditionalChildTaxCreditForAllFilers:line19-IsTheAmountOnLine18AMoreThan$2500?:line19-IsTheAmountOnLine18AMoreThan$2500?-Checkbox	NO - LEAVE LINE 19 BLANK & ENTER -0- ON LINE 20, YES - SUBTRACT $2500 FROM THE AMOUNT ON LINE 18A ENTER THE RESULT	Line 19 - Is The Amount On Line 18A More Than $2500?
a_1040_schedule_8812_2022-Part2A-AdditionalChildTaxCreditForAllFilers:line19-IsTheAmountOnLine18AMoreThan$2500?:line19-IsTheAmountOnLine18AMoreThan$2500?EnterTheResult(IfYes)-Amount	Money	Line 19 - Is The Amount On Line 18A More Than $2500?
a_1040_schedule_8812_2022-Part2A-AdditionalChildTaxCreditForAllFilers:line20-MultiplyTheAmountOnLine19By15%:line20-EnterTheResult-Amount	Money	Line 20 - Multiply The Amount On Line 19 By 15%
a_1040_schedule_8812_2022-Part2A-AdditionalChildTaxCreditForAllFilers:line20-MultiplyTheAmountOnLine19By15%:line20-OnLine16BIsTheAmount$4500OrMore?-CheckBox	NO - IF YOU ARE A BONA FIDE RESIDENT OF PUERTO RICO GO TO LINE 21, YES - IF LINE 20 IS EQUAL TO OR MORE THAN LINE 17	Line 20 - Multiply The Amount On Line 19 By 15%
a_1040_schedule_8812_2022-Part2B-CertainsFilersWhoHaveThreeOrMoreQualifyingChildren:line21-WithheldSocialSecurityMedicareAndAdditionalMedicareTaxes	Money	Line 21 - Withheld Social Security Medicare And Additional Medicare Taxes
a_1040_schedule_8812_2022-Part2B-CertainsFilersWhoHaveThreeOrMoreQualifyingChildren:line22-EnterTheTotalOfTheAmountsFromSchedule1	Money	Line 22 - Enter The Total Of The Amounts From Schedule 1
a_1040_schedule_8812_2022-Part2B-CertainsFilersWhoHaveThreeOrMoreQualifyingChildren:line23-AddLines21And22	Money	Line 23 - Add Lines 21 And 22
a_1040_schedule_8812_2022-Part2B-CertainsFilersWhoHaveThreeOrMoreQualifyingChildren:line24-EnterTheTotalOfTheAmountsFromForm1040Or1040-SrLine27	Money	Line 24 - Enter The Total Of The Amounts From Form 1040 Or 1040-SR Line 27
a_1040_schedule_8812_2022-Part2B-CertainsFilersWhoHaveThreeOrMoreQualifyingChildren:line25-SubtractLine24FromLine23IfZeroOrLessEnter-0-	Money	Line 25 - Subtract Line 24 From Line 23 If Zero Or Less Enter -0-
a_1040_schedule_8812_2022-Part2B-CertainsFilersWhoHaveThreeOrMoreQualifyingChildren:line26-EnterTheLargerOfLine20OrLine25	Money	Line 26 - Enter The Larger Of Line 20 Or Line 25
a_1040_schedule_8812_2022-Part2C-AdditionalChildTaxCredit:line27-ThisIsYourAdditionalChildTaxCreditEnterTheAmount	Money	Line 27 - This Is Your Additional Child Tax Credit Enter The Amount
Sample document
drive.google.com
1040 sch 8812 2022.pdf
Sample JSON result
JSON
{
    "status": 200,
    "response": {
        "pk": 29450531,
        "uuid": "b6bf6010-eb3f-4f54-9275-fe988bba666a",
        "forms": [
         {
                "pk": 44164196,
                "uuid": "2a68b4ef-8aac-4c8e-95ae-600d7a133f33",
                "uploaded_doc_pk": 51631822,
                "form_type": "A_1040_SCHEDULE_8812_2022",
                "raw_fields": {
                    "a_1040_schedule_8812_2022-Part2A-AdditionalChildTaxCreditForAllFilers:line18A-EarnedIncome": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2A-AdditionalChildTaxCreditForAllFilers:line18B-NontaxableCombatPay": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2B-CertainsFilersWhoHaveThreeOrMoreQualifyingChildren:line23-AddLines21And22": {
                        "value": "4000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2A-AdditionalChildTaxCreditForAllFilers:line17-EnterTheSmallerOfLine16AOrLine16B": {
                        "value": "1000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2C-AdditionalChildTaxCredit:line27-ThisIsYourAdditionalChildTaxCreditEnterTheAmount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2A-AdditionalChildTaxCreditForAllFilers:line16A-SubtractLine14FromLine12IfZeroStopHere": {
                        "value": "1000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2B-CertainsFilersWhoHaveThreeOrMoreQualifyingChildren:line26-EnterTheLargerOfLine20OrLine25": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2B-CertainsFilersWhoHaveThreeOrMoreQualifyingChildren:line22-EnterTheTotalOfTheAmountsFromSchedule1": {
                        "value": "3000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2B-CertainsFilersWhoHaveThreeOrMoreQualifyingChildren:line25-SubtractLine24FromLine23IfZeroOrLessEnter-0-": {
                        "value": "0.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2A-AdditionalChildTaxCreditForAllFilers:line20-MultiplyTheAmountOnLine19By15%:line20-EnterTheResult-Amount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2A-AdditionalChildTaxCreditForAllFilers:line15-CheckThisBoxIfYouDoNotWantToClaimTheAdditionalChildTaxCredit": {
                        "value": "NOT CHECKED",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2B-CertainsFilersWhoHaveThreeOrMoreQualifyingChildren:line24-EnterTheTotalOfTheAmountsFromForm1040Or1040-SrLine27": {
                        "value": "5000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2B-CertainsFilersWhoHaveThreeOrMoreQualifyingChildren:line21-WithheldSocialSecurityMedicareAndAdditionalMedicareTaxes": {
                        "value": "1000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2A-AdditionalChildTaxCreditForAllFilers:line20-MultiplyTheAmountOnLine19By15%:line20-OnLine16BIsTheAmount$4500OrMore?-CheckBox": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2A-AdditionalChildTaxCreditForAllFilers:line19-IsTheAmountOnLine18AMoreThan$2500?:line19-IsTheAmountOnLine18AMoreThan$2500?-Checkbox": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2A-AdditionalChildTaxCreditForAllFilers:line16B-NumberOfQualifyingChildrenUnder17WithTheRequiredSsn:line16B-NumberOfQualifyingChildren": {
                        "value": "2",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2A-AdditionalChildTaxCreditForAllFilers:line19-IsTheAmountOnLine18AMoreThan$2500?:line19-IsTheAmountOnLine18AMoreThan$2500?EnterTheResult(IfYes)-Amount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2A-AdditionalChildTaxCreditForAllFilers:line16B-NumberOfQualifyingChildrenUnder17WithTheRequiredSsn:line16B-EnterTheResultIfZeroStopHereYouCan`TClaimAdditionalChildTaxCredit": {
                        "value": "3000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part1-General:year": {
                        "value": "2022",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part1-General:name(s)ShownOnReturn": {
                        "value": "AMASA SAMPLE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part1-General:yourSocialSecurityNumber": {
                        "value": "487-65-4331",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line8-AddLines5And7": {
                        "value": "5000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line3-AddLines1And2D": {
                        "value": "30000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line11-MultiplyLine10By5%": {
                        "value": "0.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line7-MultiplyLine6By$500": {
                        "value": "1000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line2D-AddLines2AThrough2C": {
                        "value": "10000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line5-MultiplyLine4By$2000": {
                        "value": "4000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line10-SubtractLine9FromLine3": {
                        "value": "0.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line2C-EnterTheAmountFromLine15OfYourForm4563": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line2A-EnterIncomeFromPuertoRicoThatYouExcluded": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line13-EnterTheAmountFromTheCreditLimitWorksheetA": {
                        "value": "4000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line9-EnterTheAmountShownBelowForYourFilingStatus": {
                        "value": "400000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line2B-EnterTheAmountsFromLines45And50OfYourForm2555": {
                        "value": "10000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line14-EnterTheSmallerOfLine12Or13ThisIsYourChildTaxCredit": {
                        "value": "4000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line1-EnterTheAmountFromLine11OfYourForm10401040-SrOr1040-Nr": {
                        "value": "20000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line4-NumberOfQualifyingChildrenUnderAge17WithTheRequiredSocialSecurity": {
                        "value": "2",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line6-NoOfOtherDependentsIncludingAnyQualifyingChildrenWhoNotUnderAge\n17": {
                        "value": "2",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line12-IsTheAmountOnLine8MoreThanTheAmountOnLine11?:line12-IsTheAmountOnLine8MoreThanTheAmountOnLine11?-Amount": {
                        "value": "5000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    },
                    "a_1040_schedule_8812_2022-Part2-ChildTaxCredit&CreditForOtherDependentsLines:line12-IsTheAmountOnLine8MoreThanTheAmountOnLine11?:line12-IsTheAmountOnLine8MoreThanTheAmountOnLine11?-CheckBox": {
                        "value": "YES - SUBTRACT LINE 11 FROM LINE 8 ENTER THE RESULT",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 8812 2022.pdf"
                    }
                },
                "form_config_pk": 197555,
                "tables": []
            },
    "message": "OK"
}


Updated 11 months ago

IRS Form 1040 Schedule 8812 (2021) - Credits for Qualifying Children and Other Dependents
IRS Form 1040 Schedule 8812 (2023) - Credits for Qualifying Children and Other Dependents
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