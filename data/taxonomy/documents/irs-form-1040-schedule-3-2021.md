# IRS Form 1040 Schedule 3 (2021) - Additional Credits and Payments

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
IRS Form 1040 Schedule 3 (2021) - Additional Credits and Payments
Suggest Edits

This form is used to claim non-refundable credits, such as education credits or foreign tax credits, and other payments.

To use the Upload PDF endpoint for this document, you must use A_1040_SCHEDULE_3_2021 in the form_type parameter.

SCHEDULE 3

The document type A_1040_SCHEDULE_3_2021 supports data capture from the IRS 1040 Schedule 3 only. The first two pages of the document 1040 are processed as a separate document type.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
a_1040_schedule_3_2021-General:year	Integer	Year
a_1040_schedule_3_2021-General:name(s)ShownOnForm10401040-SrOr1040-Nr	Text	Name(S) Shown On Form 1040 1040-Sr Or 1040-Nr
a_1040_schedule_3_2021-General:yourSocialSecurityNumber	Social Security Number	Your Social Security Number
a_1040_schedule_3_2021-Part2-NonrefundableCredits:line1-ForeignTaxCreditAttachForm1116IfRequired	Money	Line 1 - Foreign Tax Credit Attach Form 1116 If Required
a_1040_schedule_3_2021-Part2-NonrefundableCredits:line2-CreditForChildAndDependentCareExpensesFromForm2441	Money	Line 2 - Credit For Child And Dependent Care Expenses From Form 2441
a_1040_schedule_3_2021-Part2-NonrefundableCredits:line3-EducationCreditsFromForm8863Line19	Money	Line 3 - Education Credits From Form 8863 Line 19
a_1040_schedule_3_2021-Part2-NonrefundableCredits:line4-RetirementSavingsContributionsCreditAttachForm8880	Money	Line 4 - Retirement Savings Contributions Credit Attach Form 8880
a_1040_schedule_3_2021-Part2-NonrefundableCredits:line5-ResidentialEnergyCreditsAttachForm5695	Money	Line 5 - Residential Energy Credits Attach Form 5695
a_1040_schedule_3_2021-Part2-NonrefundableCredits:line6-OtherNonrefundableCredits:line6A-GeneralBusinessCreditAttachForm3800	Money	Line 6 - Other Nonrefundable Credits
a_1040_schedule_3_2021-Part2-NonrefundableCredits:line6-OtherNonrefundableCredits:line6B-CreditForPriorYearMinimumTaxAttachForm8801	Money	Line 6 - Other Nonrefundable Credits
a_1040_schedule_3_2021-Part2-NonrefundableCredits:line6-OtherNonrefundableCredits:line6C-AdoptionCreditAttachForm8839	Money	Line 6 - Other Nonrefundable Credits
a_1040_schedule_3_2021-Part2-NonrefundableCredits:line6-OtherNonrefundableCredits:line6D-CreditForTheElderlyOrDisabledAttachScheduleR	Money	Line 6 - Other Nonrefundable Credits
a_1040_schedule_3_2021-Part2-NonrefundableCredits:line6-OtherNonrefundableCredits:line6E-AlternativeMotorVehicleCreditAttachForm8910	Money	Line 6 - Other Nonrefundable Credits
a_1040_schedule_3_2021-Part2-NonrefundableCredits:line6-OtherNonrefundableCredits:line6F-QualifiedPlug-InMotorVehicleCreditAttachForm8936	Money	Line 6 - Other Nonrefundable Credits
a_1040_schedule_3_2021-Part2-NonrefundableCredits:line6-OtherNonrefundableCredits:line6G-MortgageInterestCreditAttachForm8396	Money	Line 6 - Other Nonrefundable Credits
a_1040_schedule_3_2021-Part2-NonrefundableCredits:line6-OtherNonrefundableCredits:line6H-DistrictOfColumbiaFirst-TimeHomebuyerCreditAttachForm8859	Money	Line 6 - Other Nonrefundable Credits
a_1040_schedule_3_2021-Part2-NonrefundableCredits:line6-OtherNonrefundableCredits:line6I-QualifiedElectricVehicleCreditAttachForm8834	Money	Line 6 - Other Nonrefundable Credits
a_1040_schedule_3_2021-Part2-NonrefundableCredits:line6-OtherNonrefundableCredits:line6J-AlternativeFuelVehicleRefuelingPropertyCreditAttachForm8911	Money	Line 6 - Other Nonrefundable Credits
a_1040_schedule_3_2021-Part2-NonrefundableCredits:line6-OtherNonrefundableCredits:line6K-CreditToHoldersOfTaxCreditBondsAttachForm8912	Money	Line 6 - Other Nonrefundable Credits
a_1040_schedule_3_2021-Part2-NonrefundableCredits:line6-OtherNonrefundableCredits:line6L-AmountOnForm8978Line14SeeInstructions	Money	Line 6 - Other Nonrefundable Credits
a_1040_schedule_3_2021-Part2-NonrefundableCredits:line6-OtherNonrefundableCredits:line6Z-OtherNonrefundableCreditsList-Type	Text	Line 6 - Other Nonrefundable Credits
a_1040_schedule_3_2021-Part2-NonrefundableCredits:line6-OtherNonrefundableCredits:line6Z-OtherNonrefundableCreditsAmount	Money	Line 6 - Other Nonrefundable Credits
a_1040_schedule_3_2021-Part2-NonrefundableCredits:line7-TotalOtherNonrefundableCreditsAddLines6AThrough6Z	Money	Line 7 - Total Other Nonrefundable Credits Add Lines 6A Through 6Z
a_1040_schedule_3_2021-Part2-NonrefundableCredits:line8-AddLines1Through5And7EnterHereAndOnForm10401040-SrOr1040-Nr	Money	Line 8 - Add Lines 1 Through 5 And 7 Enter Here And On Form 1040 1040-Sr Or 1040-Nr
a_1040_schedule_3_2021-Part3-NonrefundableCredits:line9-NetPremiumTaxCreditAttachForm8962	Money	Line 9 - Net Premium Tax Credit Attach Form 8962
a_1040_schedule_3_2021-Part3-NonrefundableCredits:line10-AmountPaidWithRequestForExtensionToFile(SeeInstructions)	Money	Line 10 - Amount Paid With Request For Extension To File (See Instructions)
a_1040_schedule_3_2021-Part3-NonrefundableCredits:line11-ExcessSocialSecurityAndTier1RrtaTaxWithheld	Money	Line 11 - Excess Social Security And Tier 1 Rrta Tax Withheld
a_1040_schedule_3_2021-Part3-NonrefundableCredits:line12-CreditForFederalTaxOnFuelsAttachForm4136	Money	Line 12 - Credit For Federal Tax On Fuels Attach Form 4136
a_1040_schedule_3_2021-Part3-NonrefundableCredits:line13-OtherPaymentsOrRefundableCredits:line13A-Form2439	Money	Line 13 - Other Payments Or Refundable Credits
a_1040_schedule_3_2021-Part3-NonrefundableCredits:line13-OtherPaymentsOrRefundableCredits:line13B-QualifiedSickAndFamilyLeaveCreditsFromSchedule(S)HAndForm(S)720	Money	Line 13 - Other Payments Or Refundable Credits
a_1040_schedule_3_2021-Part3-NonrefundableCredits:line13-OtherPaymentsOrRefundableCredits:line13C-HealthCoverageTaxCreditFromForm8885	Money	Line 13 - Other Payments Or Refundable Credits
a_1040_schedule_3_2021-Part3-NonrefundableCredits:line13-OtherPaymentsOrRefundableCredits:line13D-CreditForRepaymentOfAmountsIncludedInIncomeFromEarlierYears	Money	Line 13 - Other Payments Or Refundable Credits
a_1040_schedule_3_2021-Part3-NonrefundableCredits:line13-OtherPaymentsOrRefundableCredits:line13E-ReservedForFutureUse	Money	Line 13 - Other Payments Or Refundable Credits
a_1040_schedule_3_2021-Part3-NonrefundableCredits:line13-OtherPaymentsOrRefundableCredits:line13F-DeferredAmountOfNet965TaxLiability(SeeInstructions)	Money	Line 13 - Other Payments Or Refundable Credits
a_1040_schedule_3_2021-Part3-NonrefundableCredits:line13-OtherPaymentsOrRefundableCredits:line13G-CreditForChildAndDependentCareExpensesFromForm2441Line10	Money	Line 13 - Other Payments Or Refundable Credits
a_1040_schedule_3_2021-Part3-NonrefundableCredits:line13-OtherPaymentsOrRefundableCredits:line13H-QualifiedSickAndFamilyLeaveCreditsFromSchedule(S)HAndForm(S)7202	Money	Line 13 - Other Payments Or Refundable Credits
a_1040_schedule_3_2021-Part3-NonrefundableCredits:line13-OtherPaymentsOrRefundableCredits:line13Z-OtherPaymentsOrRefundableCreditsList-Type	Text	Line 13 - Other Payments Or Refundable Credits
a_1040_schedule_3_2021-Part3-NonrefundableCredits:line13-OtherPaymentsOrRefundableCredits:line13Z-OtherPaymentsOrRefundableCreditsAmount	Money	Line 13 - Other Payments Or Refundable Credits
a_1040_schedule_3_2021-Part3-NonrefundableCredits:line14-TotalOtherPaymentsOrRefundableCreditsAddLines13AThrough13Z	Money	Line 14 - Total Other Payments Or Refundable Credits Add Lines 13A Through 13Z
a_1040_schedule_3_2021-Part3-NonrefundableCredits:line15-AddLines9Through12And14EnterHereAndOnForm10401040-SrOr1040-Nr	Money	Line 15 - Add Lines 9 Through 12 And 14 Enter Here And On Form 1040 1040-Sr Or 1040-Nr
Sample document
drive.google.com
1040 Sch 3 2021.pdf
Sample JSON result
JSON
{
                "pk": 44202676,
                "uuid": "e8bc59bf-fb50-464e-ac13-bb3b811dc1db",
                "uploaded_doc_pk": 51667649,
                "form_type": "A_1040_SCHEDULE_3_2021",
                "raw_fields": {
                    "a_1040_schedule_3_2021-Part3-NonrefundableCredits:line9-NetPremiumTaxCreditAttachForm8962": {
                        "value": "5100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part3-NonrefundableCredits:line12-CreditForFederalTaxOnFuelsAttachForm4136": {
                        "value": "600.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part3-NonrefundableCredits:line11-ExcessSocialSecurityAndTier1RrtaTaxWithheld": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part3-NonrefundableCredits:line13-OtherPaymentsOrRefundableCredits:line13A-Form2439": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part3-NonrefundableCredits:line10-AmountPaidWithRequestForExtensionToFile(SeeInstructions)": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part3-NonrefundableCredits:line14-TotalOtherPaymentsOrRefundableCreditsAddLines13AThrough13Z": {
                        "value": "4200.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part3-NonrefundableCredits:line13-OtherPaymentsOrRefundableCredits:line13E-ReservedForFutureUse": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part3-NonrefundableCredits:line15-AddLines9Through12And14EnterHereAndOnForm10401040-SrOr1040-Nr": {
                        "value": "9900.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part3-NonrefundableCredits:line13-OtherPaymentsOrRefundableCredits:line13C-HealthCoverageTaxCreditFromForm8885": {
                        "value": "700.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part3-NonrefundableCredits:line13-OtherPaymentsOrRefundableCredits:line13Z-OtherPaymentsOrRefundableCreditsAmount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part3-NonrefundableCredits:line13-OtherPaymentsOrRefundableCredits:line13Z-OtherPaymentsOrRefundableCreditsList-Type": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part3-NonrefundableCredits:line13-OtherPaymentsOrRefundableCredits:line13F-DeferredAmountOfNet965TaxLiability(SeeInstructions)": {
                        "value": "900.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part3-NonrefundableCredits:line13-OtherPaymentsOrRefundableCredits:line13G-CreditForChildAndDependentCareExpensesFromForm2441Line10": {
                        "value": "600.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part3-NonrefundableCredits:line13-OtherPaymentsOrRefundableCredits:line13D-CreditForRepaymentOfAmountsIncludedInIncomeFromEarlierYears": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part3-NonrefundableCredits:line13-OtherPaymentsOrRefundableCredits:line13B-QualifiedSickAndFamilyLeaveCreditsFromSchedule(S)HAndForm(S)720": {
                        "value": "2000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part3-NonrefundableCredits:line13-OtherPaymentsOrRefundableCredits:line13H-QualifiedSickAndFamilyLeaveCreditsFromSchedule(S)HAndForm(S)7202": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-General:year": {
                        "value": "2021",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-General:yourSocialSecurityNumber": {
                        "value": "487-65-4328",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-General:name(s)ShownOnForm10401040-SrOr1040-Nr": {
                        "value": "MAY DOE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part2-NonrefundableCredits:line3-EducationCreditsFromForm8863Line19": {
                        "value": "1800.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part2-NonrefundableCredits:line5-ResidentialEnergyCreditsAttachForm5695": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part2-NonrefundableCredits:line1-ForeignTaxCreditAttachForm1116IfRequired": {
                        "value": "1200.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part2-NonrefundableCredits:line7-TotalOtherNonrefundableCreditsAddLines6AThrough6Z": {
                        "value": "3400.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part2-NonrefundableCredits:line2-CreditForChildAndDependentCareExpensesFromForm2441": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part2-NonrefundableCredits:line4-RetirementSavingsContributionsCreditAttachForm8880": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part2-NonrefundableCredits:line8-AddLines1Through5And7EnterHereAndOnForm10401040-SrOr1040-Nr": {
                        "value": "6400.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part2-NonrefundableCredits:line6-OtherNonrefundableCredits:line6C-AdoptionCreditAttachForm8839": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part2-NonrefundableCredits:line6-OtherNonrefundableCredits:line6Z-OtherNonrefundableCreditsAmount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part2-NonrefundableCredits:line6-OtherNonrefundableCredits:line6Z-OtherNonrefundableCreditsList-Type": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part2-NonrefundableCredits:line6-OtherNonrefundableCredits:line6A-GeneralBusinessCreditAttachForm3800": {
                        "value": "1000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part2-NonrefundableCredits:line6-OtherNonrefundableCredits:line6G-MortgageInterestCreditAttachForm8396": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part2-NonrefundableCredits:line6-OtherNonrefundableCredits:line6L-AmountOnForm8978Line14SeeInstructions": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part2-NonrefundableCredits:line6-OtherNonrefundableCredits:line6B-CreditForPriorYearMinimumTaxAttachForm8801": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part2-NonrefundableCredits:line6-OtherNonrefundableCredits:line6E-AlternativeMotorVehicleCreditAttachForm8910": {
                        "value": "800.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part2-NonrefundableCredits:line6-OtherNonrefundableCredits:line6D-CreditForTheElderlyOrDisabledAttachScheduleR": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part2-NonrefundableCredits:line6-OtherNonrefundableCredits:line6I-QualifiedElectricVehicleCreditAttachForm8834": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part2-NonrefundableCredits:line6-OtherNonrefundableCredits:line6K-CreditToHoldersOfTaxCreditBondsAttachForm8912": {
                        "value": "900.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part2-NonrefundableCredits:line6-OtherNonrefundableCredits:line6F-QualifiedPlug-InMotorVehicleCreditAttachForm8936": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part2-NonrefundableCredits:line6-OtherNonrefundableCredits:line6H-DistrictOfColumbiaFirst-TimeHomebuyerCreditAttachForm8859": {
                        "value": "700.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    },
                    "a_1040_schedule_3_2021-Part2-NonrefundableCredits:line6-OtherNonrefundableCredits:line6J-AlternativeFuelVehicleRefuelingPropertyCreditAttachForm8911": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 Sch 3 2021 (1).pdf"
                    }
                },
                "form_config_pk": 197576,
                "tables": []
            },          
    "message": "OK"
}


Updated 5 months ago

IRS Form 1040 Schedule 3 (2020) - Additional Credits and Payments
IRS Form 1040 Schedule 3 (2022) - Additional Credits and Payments
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