# IRS Form 1040 Schedule 8812 (2020) - Additional Child Tax Credit

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
IRS Form 1040 Schedule 8812 (2020) - Additional Child Tax Credit
Suggest Edits

This form is used to report the Additional Child Tax Credit. This credit provides additional financial assistance to eligible taxpayers who have qualifying children and may result in a refund even if they do not owe any federal income tax.

To use the Upload PDF endpoint for this document, you must use A_1040_SCHEDULE_8812_2020 in the form_type parameter.

SCHEDULE 8812

The document type A_1040_SCHEDULE_8812_2020 supports data capture from the IRS 1040 Schedule 8812 only. The first two pages of the document 1040 are processed as a separate document type.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
a_1040_schedule_8812_2020-Part1-General:year	Integer	Year
a_1040_schedule_8812_2020-Part1-General:name(s)ShownOnReturn	Text	Name(s) Shown On Return
a_1040_schedule_8812_2020-Part1-General:yourSocialSecurityNumber	Social Security Number	Your Social Security Number
a_1040_schedule_8812_2020-Part2-AllFilers:line1-IfYouAreRequiredToUseTheWorksheetInPub.972	Money	Line 1 - If You Are Required To Use The Worksheet In Pub. 972
a_1040_schedule_8812_2020-Part2-AllFilers:line2-EnterTheAmountFromLine19OfYourForm1040Form1040-SrOrForm1040-Nr	Money	Line 2 - Enter The Amount From Line 19 Of Your Form 1040 Form 1040-SR Or Form 1040-NR
a_1040_schedule_8812_2020-Part2-AllFilers:line3-SubtractLine2FromLine1IfZeroStopHereYouCannotClaimThisCredit	Money	Line 3 - Subtract Line 2 From Line 1 If Zero Stop Here You Cannot Claim This Credit
a_1040_schedule_8812_2020-Part2-AllFilers:line4-NumberOfQualifyingChildrenUnder17WithSsn:line4-NumberOfQualifyingChildrenWithSsn	Integer	Line 4 - Number Of Qualifying Children Under 17 With SSN
a_1040_schedule_8812_2020-Part2-AllFilers:line4-NumberOfQualifyingChildrenUnder17WithSsn:line4-EnterTheResult.IfZeroStopHereYouCannotClaimThisCredit	Money	Line 4 - Number Of Qualifying Children Under 17 With SSN
a_1040_schedule_8812_2020-Part2-AllFilers:line5-EnterTheSmallerOfLine3OrLine4	Money	Line 5 - Enter The Smaller Of Line 3 Or Line 4
a_1040_schedule_8812_2020-Part2-AllFilers:line6A-EarnedIncome	Money	Line 6A - Earned Income
a_1040_schedule_8812_2020-Part2-AllFilers:line6B-NontaxableCombatPay	Money	Line 6B - Nontaxable Combat Pay
a_1040_schedule_8812_2020-Part2-AllFilers:line7-IsTheAmountOnLine6AMoreThan$2500?:line7-IsTheAmountOnLine6AMoreThan$2500?-Checkbox	YES, NO	Line 7 - Is The Amount On Line 6A More Than $2500?
a_1040_schedule_8812_2020-Part2-AllFilers:line7-IsTheAmountOnLine6AMoreThan$2500?:line7-IsTheAmountOnLine6AMoreThan$2500?-EnterTheResult(IfYes)	Money	Line 7 - Is The Amount On Line 6A More Than $2500?
a_1040_schedule_8812_2020-Part2-AllFilers:line8-MultiplyTheAmountOnLine7By15%AndEnterTheResult:line8-Amount	Money	Line 8 - Multiply The Amount On Line 7 By 15% And Enter The Result
a_1040_schedule_8812_2020-Part2-AllFilers:line8-MultiplyTheAmountOnLine7By15%AndEnterTheResult:line8-OnLine4IsTheAmount$4200OrMore?-CheckBox	YES, NO	Line 8 - Multiply The Amount On Line 7 By 15% And Enter The Result
a_1040_schedule_8812_2020-Part3-CertainFilersWhoHaveThreeOrMoreQualifyingChildren:line9-WithheldSocialSecurityMedicareAndAdditionalMedicareTaxes	Money	Line 9 - Withheld Social Security Medicare And Additional Medicare Taxes
a_1040_schedule_8812_2020-Part3-CertainFilersWhoHaveThreeOrMoreQualifyingChildren:line10-EnterTheTotalOfTheAmountsFromSchedule1	Money	Line 10 - Enter The Total Of The Amounts From Schedule 1
a_1040_schedule_8812_2020-Part3-CertainFilersWhoHaveThreeOrMoreQualifyingChildren:line11-AddLines9And10	Money	Line 11 - Add Lines 9 And 10
a_1040_schedule_8812_2020-Part3-CertainFilersWhoHaveThreeOrMoreQualifyingChildren:line12-EnterTheTotalOfTheAmountsFromForm1040	Money	Line 12 - Enter The Total Of The Amounts From Form 1040
a_1040_schedule_8812_2020-Part3-CertainFilersWhoHaveThreeOrMoreQualifyingChildren:line13-SubtractLine12FromLine11IfZeroOrLessEnter-0-	Money	Line 13 - Subtract Line 12 From Line 11 If Zero Or Less Enter -0-
a_1040_schedule_8812_2020-Part3-CertainFilersWhoHaveThreeOrMoreQualifyingChildren:line14-EnterTheLargerOfLine8OrLine13	Money	Line 14 - Enter The Larger Of Line 8 Or Line 13
a_1040_schedule_8812_2020-Part4-AdditionalChildTaxCredit:line15-ThisIsYourAdditionalChildTaxCredit	Money	Line 15 - This Is Your Additional Child Tax Credit
Sample document

Coming soon...

Sample JSON result
JSON
{
  "pk": 28252912,
  "form_type": "A_1040_SCHEDULE_8812_2020",
  "other_frauds": [],
  "tables": [],
  "raw_fields": {
    "a_1040_schedule_8812_2020-Part1-General:year": {
      "value": "2020",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2020 Schedule 8812 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_8812_2020-Part1-General:name(s)ShownOnReturn": {
      "value": "ANTHONY GEPRGE",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2020 Schedule 8812 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_8812_2020-Part2-AllFilers:line6A-EarnedIncome": {
      "value": "14852.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2020 Schedule 8812 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_8812_2020-Part1-General:yourSocialSecurityNumber": {
      "value": "251-53-6584",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2020 Schedule 8812 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_8812_2020-Part2-AllFilers:line6B-NontaxableCombatPay": {
      "value": "5600.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2020 Schedule 8812 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_8812_2020-Part2-AllFilers:line5-EnterTheSmallerOfLine3OrLine4": {
      "value": "1000.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2020 Schedule 8812 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_8812_2020-Part2-AllFilers:line1-IfYouAreRequiredToUseTheWorksheetInPub.972": {
      "value": "1800.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2020 Schedule 8812 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_8812_2020-Part4-AdditionalChildTaxCredit:line15-ThisIsYourAdditionalChildTaxCredit": {
      "value": "800.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2020 Schedule 8812 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_8812_2020-Part3-CertainFilersWhoHaveThreeOrMoreQualifyingChildren:line11-AddLines9And10": {
      "value": "20612.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2020 Schedule 8812 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_8812_2020-Part2-AllFilers:line8-MultiplyTheAmountOnLine7By15%AndEnterTheResult:line8-Amount": {
      "value": "1852.80",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2020 Schedule 8812 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_8812_2020-Part2-AllFilers:line3-SubtractLine2FromLine1IfZeroStopHereYouCannotClaimThisCredit": {
      "value": "921.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2020 Schedule 8812 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_8812_2020-Part2-AllFilers:line2-EnterTheAmountFromLine19OfYourForm1040Form1040-SrOrForm1040-Nr": {
      "value": "879.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2020 Schedule 8812 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_8812_2020-Part3-CertainFilersWhoHaveThreeOrMoreQualifyingChildren:line14-EnterTheLargerOfLine8OrLine13": {
      "value": "2560.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2020 Schedule 8812 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_8812_2020-Part3-CertainFilersWhoHaveThreeOrMoreQualifyingChildren:line12-EnterTheTotalOfTheAmountsFromForm1040": {
      "value": "4500.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2020 Schedule 8812 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_8812_2020-Part3-CertainFilersWhoHaveThreeOrMoreQualifyingChildren:line10-EnterTheTotalOfTheAmountsFromSchedule1": {
      "value": "8560.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2020 Schedule 8812 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_8812_2020-Part2-AllFilers:line4-NumberOfQualifyingChildrenUnder17WithSsn:line4-NumberOfQualifyingChildrenWithSsn": {
      "value": "2",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2020 Schedule 8812 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_8812_2020-Part2-AllFilers:line7-IsTheAmountOnLine6AMoreThan$2500?:line7-IsTheAmountOnLine6AMoreThan$2500?-Checkbox": {
      "value": "YES",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2020 Schedule 8812 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_8812_2020-Part3-CertainFilersWhoHaveThreeOrMoreQualifyingChildren:line13-SubtractLine12FromLine11IfZeroOrLessEnter-0-": {
      "value": "16112.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2020 Schedule 8812 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_8812_2020-Part2-AllFilers:line8-MultiplyTheAmountOnLine7By15%AndEnterTheResult:line8-OnLine4IsTheAmount$4200OrMore?-CheckBox": {
      "value": "NO",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2020 Schedule 8812 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_8812_2020-Part2-AllFilers:line7-IsTheAmountOnLine6AMoreThan$2500?:line7-IsTheAmountOnLine6AMoreThan$2500?-EnterTheResult(IfYes)": {
      "value": "12352.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2020 Schedule 8812 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_8812_2020-Part3-CertainFilersWhoHaveThreeOrMoreQualifyingChildren:line9-WithheldSocialSecurityMedicareAndAdditionalMedicareTaxes": {
      "value": "12052.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2020 Schedule 8812 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_8812_2020-Part2-AllFilers:line4-NumberOfQualifyingChildrenUnder17WithSsn:line4-EnterTheResult.IfZeroStopHereYouCannotClaimThisCredit": {
      "value": "2800.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2020 Schedule 8812 (Form 1040) Sample 1.pdf"
    }
  },
  "id": 28252912
}


Updated 11 months ago

IRS Form 1040 Schedule 8812 (2019) - Additional Child Tax Credit
IRS Form 1040 Schedule 8812 (2021) - Credits for Qualifying Children and Other Dependents
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