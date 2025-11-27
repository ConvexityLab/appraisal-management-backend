# IRS Form 1040 Schedule 2 (2022) - Additional Taxes

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
IRS Form 1040 Schedule 2 (2022) - Additional Taxes
Suggest Edits

This form is used to calculate and address the Alternative Minimum Tax (AMT) to ensure taxpayer's compliance with this specific tax requirement. It is also used for the repayment of excess premium tax credits received by taxpayers.

To use the Upload PDF endpoint for this document, you must use A_1040_SCHEDULE_2_2022 in the form_type parameter.

SCHEDULE 2

The document type A_1040_SCHEDULE_2_2022 supports data capture from the IRS 1040 Schedule 2 only. The first two pages of the document 1040 are processed as a separate document type.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
a_1040_schedule_2_2022-Part1-General:year	Integer	Year
a_1040_schedule_2_2022-Part1-General:name(s)ShownOnForm10401040-SrOr1040-Nr	Text	Name(S) Shown On Form 1040 1040-Sr Or 1040-Nr
a_1040_schedule_2_2022-Part1-General:yourSocialSecurityNumber	Social Security Number	Your Social Security Number
a_1040_schedule_2_2022-Part2-OtherTaxesLine1-3:line1-AlternativeMinimumTaxAttachForm6251	Money	Line 1 - Alternative Minimum Tax Attach Form 6251
a_1040_schedule_2_2022-Part2-OtherTaxesLine1-3:line2-ExcessAdvancePremiumTaxCreditRepaymentAttachForm8962	Money	Line 2 - Excess Advance Premium Tax Credit Repayment Attach Form 8962
a_1040_schedule_2_2022-Part2-OtherTaxesLine1-3:line3-AddLines1And2EnterHereAndOnForm10401040-SrOr1040-NrLine17	Money	Line 3 - Add Lines 1 And 2 Enter Here And On Form 1040 1040-SR Or 1040-NR Line 17
a_1040_schedule_2_2022-Part3-OtherTaxesLines4-16:line4-Self-EmploymentTaxAttachScheduleSe	Money	Line 4 - Self-Employment Tax Attach Schedule SE
a_1040_schedule_2_2022-Part3-OtherTaxesLines4-16:line5-SocialSecurityAndMedicareTaxOnUnreportedTipIncomeAttachForm4137	Money	Line 5 - Social Security And Medicare Tax On Unreported Tip Income Attach Form 4137
a_1040_schedule_2_2022-Part3-OtherTaxesLines4-16:line6-UncollectedSocialSecurityAndMedicareTaxOnWagesAttachForm8919	Money	Line 6 - Uncollected Social Security And Medicare Tax On Wages Attach Form 8919
a_1040_schedule_2_2022-Part3-OtherTaxesLines4-16:line7-TotalAdditionalSocialSecurityAndMedicareTaxAddLines5And6	Money	Line 7 - Total Additional Social Security And Medicare Tax Add Lines 5 And 6
a_1040_schedule_2_2022-Part3-OtherTaxesLines4-16:line8-AdditionalTaxOnIrasOrOtherTax-FavoredAccountsAttachForm5329-CheckBox	CHECKED, NOT CHECKED	Line 8 - Additional Tax On IRAs Or Other Tax-Favored Accounts Attach Form 5329 - Check Box
a_1040_schedule_2_2022-Part3-OtherTaxesLines4-16:line8-AdditionalTaxOnIrasOrOtherTax-FavoredAccountsAttachForm5329-Amount	Money	Line 8 - Additional Tax On IRAs Or Other Tax-Favored Accounts Attach Form 5329 - Amount
a_1040_schedule_2_2022-Part3-OtherTaxesLines4-16:line9-HouseholdEmploymentTaxesAttachScheduleH	Money	Line 9 - Household Employment Taxes Attach Schedule H
a_1040_schedule_2_2022-Part3-OtherTaxesLines4-16:line10-RepaymentOfFirst-TimeHomebuyerCreditAttachForm5405IfRequired	Money	Line 10 - Repayment Of First-Time Homebuyer Credit Attach Form 5405 If Required
a_1040_schedule_2_2022-Part3-OtherTaxesLines4-16:line11-AdditionalMedicareTaxAttachForm8959	Money	Line 11 - Additional Medicare Tax Attach Form 8959
a_1040_schedule_2_2022-Part3-OtherTaxesLines4-16:line12-NetInvestmentIncomeTaxAttachForm8960	Money	Line 12 - Net Investment Income Tax Attach Form 8960
a_1040_schedule_2_2022-Part3-OtherTaxesLines4-16:line13-UncollectedSocialSecurityAndMedicareOrRrtaTaxOnTips	Money	Line 13 - Uncollected Social Security And Medicare Or RRTA Tax On Tips
a_1040_schedule_2_2022-Part3-OtherTaxesLines4-16:line14-InterestOnTaxDueOnInstallmentIncomeFromTheSaleOfCertainResidential	Money	Line 14 - Interest On Tax Due On Installment Income From The Sale Of Certain Residential
a_1040_schedule_2_2022-Part3-OtherTaxesLines4-16:line15-InterestOnTheDeferredTaxOnGainFromCertainInstallmentSalesWithASales	Money	Line 15 - Interest On The Deferred Tax On Gain From Certain Installment Sales With A Sales
a_1040_schedule_2_2022-Part3-OtherTaxesLines4-16:line16-RecaptureOfLow-IncomeHousingCreditAttachForm8611	Money	Line 16 - Recapture Of Low-Income Housing Credit Attach Form 8611
a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17A-RecaptureOfOtherCreditsListType	Text	Line 17 - Other Additional Taxes
a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17A-RecaptureOfOtherCreditsFormNumber	Text	Line 17 - Other Additional Taxes
a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17A-RecaptureOfOtherCreditsAmount	Money	Line 17 - Other Additional Taxes
a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17A-RecaptureOfOtherCredits	Money	Line 17 - Other Additional Taxes
a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17B-RecaptureOfFederalMortgageSubsidyIfYouSoldYourHome	Money	Line 17 - Other Additional Taxes
a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17C-AdditionalTaxOnHsaDistributionsAttachForm8889	Money	Line 17 - Other Additional Taxes
a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17D-AdditionalTaxOnAnHsaBecauseYouDidn'TRemainAnEligible	Money	Line 17 - Other Additional Taxes
a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17E-AdditionalTaxOnArcherMsaDistributionsAttachForm8853	Money	Line 17 - Other Additional Taxes
a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17F-AdditionalTaxOnMedicareAdvantageMsaDistributionsAttachForm8853	Money	Line 17 - Other Additional Taxes
a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17G-RecaptureOfACharitableContributionDeductionRelatedToAFractional	Money	Line 17 - Other Additional Taxes
a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17H-IncomeYouReceivedFromANonqualifiedDeferredCompensationPlan	Money	Line 17 - Other Additional Taxes
a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17I-CompensationYouReceivedFromANonqualifiedDeferredCompensation	Money	Line 17 - Other Additional Taxes
a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17J-Section72(M)(5)ExcessBenefitsTax	Money	Line 17 - Other Additional Taxes
a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17K-GoldenParachutePayments	Money	Line 17 - Other Additional Taxes
a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17L-TaxOnAccumulationDistributionOfTrusts	Money	Line 17 - Other Additional Taxes
a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17M-ExciseTaxOnInsiderStockCompensationFromAnExpatriatedCorporation	Money	Line 17 - Other Additional Taxes
a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17N-Look-BackInterestUnderSection167(G)Or460(B)FromForm8697Or8866	Money	Line 17 - Other Additional Taxes
a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17O-TaxOnNon-EffectivelyConnectedIncomeForAnyPartOfTheYear	Money	Line 17 - Other Additional Taxes
a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17P-AnyInterestFromForm8621Line16FRelatingToDistributionsFrom	Money	Line 17 - Other Additional Taxes
a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17Q-AnyInterestFromForm8621Line24	Money	Line 17 - Other Additional Taxes
a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17Z-AnyOtherTaxesListType	Text	Line 17 - Other Additional Taxes
a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17Z-AnyOtherTaxesAmount	Money	Line 17 - Other Additional Taxes
a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17Z-AnyOtherTaxes	Money	Line 17 - Other Additional Taxes
a_1040_schedule_2_2022-Part5-OtherTaxesLines18-21:line18-TotalAdditionalTaxesAddLines17AThrough17Z	Money	Line 18 - Total Additional Taxes Add Lines 17A Through 17Z
a_1040_schedule_2_2022-Part5-OtherTaxesLines18-21:line20-Section965NetTaxLiabilityInstallmentFromForm965-A	Money	Line 20 - Section 965 Net Tax Liability Installment From Form 965-A
a_1040_schedule_2_2022-Part5-OtherTaxesLines18-21:line21-AddLines47Through16And18TheseAreYourTotalOtherTaxes	Money	Line 21 - Add Lines 4 7 Through 16 And 18 These Are Your Total Other Taxes
Sample document
drive.google.com
1040 sch 2.pdf
Sample JSON result
JSON
{
    "status": 200,
    "response": {
        "pk": 29450531,
        "uuid": "b6bf6010-eb3f-4f54-9275-fe988bba666a",
        "forms": [
         {
                "pk": 44164150,
                "uuid": "e4eb60dd-6afd-4aac-a153-c41a6de9f542",
                "uploaded_doc_pk": 51631758,
                "form_type": "A_1040_SCHEDULE_2_2022",
                "raw_fields": {
                    "a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17Z-AnyOtherTaxes": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part5-OtherTaxesLines18-21:line18-TotalAdditionalTaxesAddLines17AThrough17Z": {
                        "value": "1500.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17Z-AnyOtherTaxesAmount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17Z-AnyOtherTaxesListType": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17A-RecaptureOfOtherCredits": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17K-GoldenParachutePayments": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part5-OtherTaxesLines18-21:line20-Section965NetTaxLiabilityInstallmentFromForm965-A": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part5-OtherTaxesLines18-21:line21-AddLines47Through16And18TheseAreYourTotalOtherTaxes": {
                        "value": "3100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17A-RecaptureOfOtherCreditsAmount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17Q-AnyInterestFromForm8621Line24": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17A-RecaptureOfOtherCreditsListType": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17J-Section72(M)(5)ExcessBenefitsTax": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17A-RecaptureOfOtherCreditsFormNumber": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17L-TaxOnAccumulationDistributionOfTrusts": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17C-AdditionalTaxOnHsaDistributionsAttachForm8889": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17B-RecaptureOfFederalMortgageSubsidyIfYouSoldYourHome": {
                        "value": "200.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17E-AdditionalTaxOnArcherMsaDistributionsAttachForm8853": {
                        "value": "300.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17D-AdditionalTaxOnAnHsaBecauseYouDidn'TRemainAnEligible": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17O-TaxOnNon-EffectivelyConnectedIncomeForAnyPartOfThe\nYear": {
                        "value": "300.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17P-AnyInterestFromForm8621Line16FRelatingToDistributions\nFrom": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17H-IncomeYouReceivedFromANonqualifiedDeferredCompensation\nPlan": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17I-CompensationYouReceivedFromANonqualifiedDeferred\nCompensation": {
                        "value": "500.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17N-Look-BackInterestUnderSection167(G)Or460(B)FromForm\n8697Or8866": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17F-AdditionalTaxOnMedicareAdvantageMsaDistributionsAttach\nForm8853": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17G-RecaptureOfACharitableContributionDeductionRelatedToA\nFractional": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part4-OtherTaxesLine17:line17-OtherAdditionalTaxes:line17M-ExciseTaxOnInsiderStockCompensationFromAnExpatriated\nCorporation": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part1-General:year": {
                        "value": "2022",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part1-General:yourSocialSecurityNumber": {
                        "value": "487-65-4327",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part1-General:name(s)ShownOnForm10401040-SrOr1040-Nr": {
                        "value": "ROBERT FAKE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part2-OtherTaxesLine1-3:line1-AlternativeMinimumTaxAttachForm6251": {
                        "value": "500.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part3-OtherTaxesLines4-16:line4-Self-EmploymentTaxAttachScheduleSe": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part3-OtherTaxesLines4-16:line11-AdditionalMedicareTaxAttachForm8959": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part3-OtherTaxesLines4-16:line12-NetInvestmentIncomeTaxAttachForm8960": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part3-OtherTaxesLines4-16:line9-HouseholdEmploymentTaxesAttachScheduleH": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part3-OtherTaxesLines4-16:line16-RecaptureOfLow-IncomeHousingCreditAttachForm8611": {
                        "value": "200.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part2-OtherTaxesLine1-3:line2-ExcessAdvancePremiumTaxCreditRepaymentAttachForm8962": {
                        "value": "400.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part3-OtherTaxesLines4-16:line13-UncollectedSocialSecurityAndMedicareOrRrtaTaxOnTips": {
                        "value": "500.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part2-OtherTaxesLine1-3:line3-AddLines1And2EnterHereAndOnForm10401040-SrOr1040-NrLine17": {
                        "value": "900.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part3-OtherTaxesLines4-16:line7-TotalAdditionalSocialSecurityAndMedicareTaxAddLines5And6": {
                        "value": "500.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part3-OtherTaxesLines4-16:line6-UncollectedSocialSecurityAndMedicareTaxOnWagesAttachForm8919": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part3-OtherTaxesLines4-16:line10-RepaymentOfFirst-TimeHomebuyerCreditAttachForm5405IfRequired": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part3-OtherTaxesLines4-16:line5-SocialSecurityAndMedicareTaxOnUnreportedTipIncomeAttachForm4137": {
                        "value": "500.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part3-OtherTaxesLines4-16:line8-AdditionalTaxOnIrasOrOtherTax-FavoredAccountsAttachForm5329-Amount": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part3-OtherTaxesLines4-16:line14-InterestOnTaxDueOnInstallmentIncomeFromTheSaleOfCertainResidential": {
                        "value": "200.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part3-OtherTaxesLines4-16:line15-InterestOnTheDeferredTaxOnGainFromCertainInstallmentSalesWithASales": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    },
                    "a_1040_schedule_2_2022-Part3-OtherTaxesLines4-16:line8-AdditionalTaxOnIrasOrOtherTax-FavoredAccountsAttachForm5329-CheckBox": {
                        "value": "NOT CHECKED",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "1040 sch 2.pdf"
                    }
                },
                "form_config_pk": 197554,
                "tables": []
            },
    "message": "OK"
}


Updated 11 months ago

IRS Form 1040 Schedule 2 (2021) - Additional Taxes
IRS Form 1040 Schedule 2 (2023) - Additional Taxes
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