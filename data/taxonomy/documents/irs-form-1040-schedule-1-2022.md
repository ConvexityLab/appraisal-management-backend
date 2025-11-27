# IRS Form 1040 Schedule 1 (2022) - Additional Income and Adjustments to Income

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
IRS Form 1040 Schedule 1 (2022) - Additional Income and Adjustments to Income
Suggest Edits

This form is used to report types of income that aren't listed on the 1040, such as capital gains, alimony, unemployment payments, and gambling winnings. It also includes some common adjustments to income, like the student loan interest deduction and deductions for educator expenses.

To use the Upload PDF endpoint for this document, you must use A_1040_SCHEDULE_1_2022 in the form_type parameter.

SCHEDULE 1

The document type A_1040_SCHEDULE_1_2022 supports data capture from the IRS 1040 Schedule 1 only. The first two pages of the document 1040 are processed as a separate document type.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
a_1040_schedule_1_2022-Part1-General:year	Integer	Year
a_1040_schedule_1_2022-Part1-General:name(s)ShownOnForm1040	Text	Name(s) Shown On Form 1040
a_1040_schedule_1_2022-Part1-General:socialSecurityNumber	Social Security Number	Social Security Number
a_1040_schedule_1_2022-Part2-AdditionalIncome:line1-TaxableRefundsCreditsOrOffsetsOfStateAndLocalIncomeTaxes	Money	Line 1 - Taxable Refunds Credits Or Offsets Of State And Local Income Taxes
a_1040_schedule_1_2022-Part2-AdditionalIncome:line2A-AlimonyReceived	Money	Line 2A - Alimony Received
a_1040_schedule_1_2022-Part2-AdditionalIncome:line2B-DateOfOriginalDivorceOrSeparationAgreement	Date	Line 2B - Date Of Original Divorce Or Separation Agreement
a_1040_schedule_1_2022-Part2-AdditionalIncome:line3-BusinessIncomeOr(Loss)	Money	Line 3 - Business Income Or (Loss)
a_1040_schedule_1_2022-Part2-AdditionalIncome:line4-OtherGainsOr(Losses)	Money	Line 4 - Other Gains Or (Losses)
a_1040_schedule_1_2022-Part2-AdditionalIncome:line5-RentalRealEstateRoyaltiesPartnershipsSCorporationsTrustsEtc	Money	Line 5 - Rental Real Estate Royalties Partnerships S Corporations Trusts Etc
a_1040_schedule_1_2022-Part2-AdditionalIncome:line6-FarmIncomeOr(Loss)	Money	Line 6 - Farm Income Or (Loss)
a_1040_schedule_1_2022-Part2-AdditionalIncome:line7-UnemploymentCompensation	Money	Line 7 - Unemployment Compensation
a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8A-NetOperatingLoss	Money	Line 8 - Other Income
a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8B-Gambling	Money	Line 8 - Other Income
a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8C-CancellationOfDebt	Money	Line 8 - Other Income
a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8D-ForeignEarnedIncomeExclusionFromForm2555	Money	Line 8 - Other Income
a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8E-IncomeFromForm8853	Money	Line 8 - Other Income
a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8F-IncomeFromForm8889	Money	Line 8 - Other Income
a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8G-AlaskaPermanentFundDividends	Money	Line 8 - Other Income
a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8H-JuryDutyPay	Money	Line 8 - Other Income
a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8I-PrizesAndAwards	Money	Line 8 - Other Income
a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8J-ActivityNotEngagedInForProfitIncome	Money	Line 8 - Other Income
a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8K-StockOptions	Money	Line 8 - Other Income
a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8L-IncomeFromTheRentalOfPersonalPropertyIfYouEngagedInTheRental	Money	Line 8 - Other Income
a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8M-OlympicAndParalympicMedalsAndUsocPrizeMoney	Money	Line 8 - Other Income
a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8N-Section951(A)Inclusion	Money	Line 8 - Other Income
a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8O-Section951A(A)Inclusion	Money	Line 8 - Other Income
a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8P-Section461(L)ExcessBusinessLossAdjustment	Money	Line 8 - Other Income
a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8Q-TaxableDistributionsFromAnAbleAccount	Money	Line 8 - Other Income
a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8R-ScholarshipAndFellowshipGrantsNotReportedOnFormW-2	Money	Line 8 - Other Income
a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8S-NontaxableAmountOfMedicaidWaiverPaymentsIncluded	Money	Line 8 - Other Income
a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8T-PensionOrAnnuityFromANonqualifedDeferredCompensationPlan	Money	Line 8 - Other Income
a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8U-WagesEarnedWhileIncarcerated	Money	Line 8 - Other Income
a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8Z-OtherIncome-ListType	Text	Line 8 - Other Income
a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8Z-OtherIncome-Amount	Money	Line 8 - Other Income
a_1040_schedule_1_2022-Part2-AdditionalIncome:line9-TotalOtherIncomeAddLines8AThrough8Z	Money	Line 9 - Total Other Income Add Lines 8A Through 8Z
a_1040_schedule_1_2022-Part2-AdditionalIncome:line10-CombineLines1Through7And9EnterHereAndOnForm10401040-Sr	Money	Line 10 - Combine Lines 1 Through 7 And 9 Enter Here And On Form 1040 1040-SR
a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line11-EducatorExpenses	Money	Line 11 - Educator Expenses
a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line12-CertainBusinessExpensesOfReservistsPerformingArtists	Money	Line 12 - Certain Business Expenses Of Reservists Performing Artists
a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line13-HealthSavingsAccountDeduction	Money	Line 13 - Health Savings Account Deduction
a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line14-MovingExpensesForMembersOfTheArmedForces	Money	Line 14 - Moving Expenses For Members Of The Armed Forces
a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line15-DeductiblePartOfSelf-EmploymentTax	Money	Line 15 - Deductible Part Of Self-Employment Tax
a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line16-Self-EmployedSepSimpleAndQualifiedPlans	Money	Line 16 - Self-Employed SEP Simple And Qualified Plans
a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line17-Self-EmployedHealthInsuranceDeduction	Money	Line 17 - Self-Employed Health Insurance Deduction
a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line18-PenaltyOnEarlyWithdrawalOfSavings	Money	Line 18 - Penalty On Early Withdrawal Of Savings
a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line19A-AlimonyPaid	Money	Line 19A - Alimony Paid
a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line19B-RecipientsSsn	Social Security Number	Line 19B - Recipients SSN
a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line19C-DateOfOriginalDivorceOrSeparationAgreement	Date	Line 19C - Date Of Original Divorce Or Separation Agreement
a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line20-IraDeduction	Money	Line 20 - IRA Deduction
a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line21-StudentLoanInterestDeduction	Money	Line 21 - Student Loan Interest Deduction
a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line23-ArcherMsaDeduction	Money	Line 23 - Archer MSA Deduction
a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line24-OtherAdjustments:line24A-JuryDutyPay	Money	Line 24 - Other Adjustments
a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line24-OtherAdjustments:line24B-DeductibleExpensesRelatedToIncomeReportedOnLine8LFromTheRental	Money	Line 24 - Other Adjustments
a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line24-OtherAdjustments:line24C-NontaxableAmountOfTheValueOfOlympicAndParalympicMedals	Money	Line 24 - Other Adjustments
a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line24-OtherAdjustments:line24D-ReforestationAmortizationAndExpenses	Money	Line 24 - Other Adjustments
a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line24-OtherAdjustments:line24E-RepaymentOfSupplementalUnemploymentBenefitsUnderTheTradeActOf1974	Money	Line 24 - Other Adjustments
a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line24-OtherAdjustments:line24F-ContributionsToSection501(C)(18)(D)PensionPlans	Money	Line 24 - Other Adjustments
a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line24-OtherAdjustments:line24G-ContributionsByCertainChaplainsToSection403(B)Plans	Money	Line 24 - Other Adjustments
a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line24-OtherAdjustments:line24H-AttorneyFeesAndCourtCostsForActionsInvolvingCertainUnlawful	Money	Line 24 - Other Adjustments
a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line24-OtherAdjustments:line24I-AttorneyFeesAndCourtCostsYouPaidInConnectionWithAnAward	Money	Line 24 - Other Adjustments
a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line24-OtherAdjustments:line24J-HousingDeductionFromForm2555	Money	Line 24 - Other Adjustments
a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line24-OtherAdjustments:line24K-ExcessDeductionsOfSection67(E)ExpensesFromScheduleK-1(Form1041)	Money	Line 24 - Other Adjustments
a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line24-OtherAdjustments:line24Z-OtherAdjustments-ListType	Text	Line 24 - Other Adjustments
a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line24-OtherAdjustments:line24Z-OtherAdjustments-Amount	Money	Line 24 - Other Adjustments
a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line25-TotalOtherAdjustmentsAddLines24AThrough24Z	Money	Line 25 - Total Other Adjustments Add Lines 24A Through 24Z
a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line26-AddLines11Through23And25TheseAreYourAdjustmentsToIncome	Money	Line 26 - Add Lines 11 Through 23 And 25 These Are Your Adjustments To Income
Sample document
drive.google.com
2022 Schedule 1 (Form 1040).pdf
Sample JSON result
JSON
{
    "status": 200,
    "response": {
        "pk": 29450531,
        "uuid": "b6bf6010-eb3f-4f54-9275-fe988bba666a",
        "forms": [
            {
                "pk": 44217990,
                "uuid": "b35848f7-111b-492d-8200-f69ae6321d1a",
                "uploaded_doc_pk": 51697856,
                "form_type": "A_1040_SCHEDULE_1_2022",
                "raw_fields": {
                    "a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line19A-AlimonyPaid": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line20-IraDeduction": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line19B-RecipientsSsn": {
                        "value": "123-45-6789",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line11-EducatorExpenses": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line23-ArcherMsaDeduction": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line21-StudentLoanInterestDeduction": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line13-HealthSavingsAccountDeduction": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line18-PenaltyOnEarlyWithdrawalOfSavings": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line15-DeductiblePartOfSelf-EmploymentTax": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line24-OtherAdjustments:line24A-JuryDutyPay": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line17-Self-EmployedHealthInsuranceDeduction": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line16-Self-EmployedSepSimpleAndQualifiedPlans": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line14-MovingExpensesForMembersOfTheArmedForces": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line25-TotalOtherAdjustmentsAddLines24AThrough24Z": {
                        "value": "1200.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line19C-DateOfOriginalDivorceOrSeparationAgreement": {
                        "value": "12/01/2022",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line24-OtherAdjustments:line24Z-OtherAdjustments-Amount": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line24-OtherAdjustments:line24Z-OtherAdjustments-ListType": {
                        "value": "SAMPLE LIST",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line12-CertainBusinessExpensesOfReservistsPerformingArtists": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line24-OtherAdjustments:line24J-HousingDeductionFromForm2555": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line26-AddLines11Through23And25TheseAreYourAdjustmentsToIncome": {
                        "value": "2400.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line24-OtherAdjustments:line24D-ReforestationAmortizationAndExpenses": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line24-OtherAdjustments:line24F-ContributionsToSection501(C)(18)(D)PensionPlans": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line24-OtherAdjustments:line24G-ContributionsByCertainChaplainsToSection403(B)Plans": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line24-OtherAdjustments:line24C-NontaxableAmountOfTheValueOfOlympicAndParalympicMedals": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line24-OtherAdjustments:line24I-AttorneyFeesAndCourtCostsYouPaidInConnectionWithAnAward": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line24-OtherAdjustments:line24H-AttorneyFeesAndCourtCostsForActionsInvolvingCertainUnlawful": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line24-OtherAdjustments:line24B-DeductibleExpensesRelatedToIncomeReportedOnLine8LFromTheRental": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line24-OtherAdjustments:line24K-ExcessDeductionsOfSection67(E)ExpensesFromScheduleK-1(Form1041)": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part3-AdjustmentsToIncome:line24-OtherAdjustments:line24E-RepaymentOfSupplementalUnemploymentBenefitsUnderTheTradeActOf1974": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part1-General:year": {
                        "value": "2022",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part1-General:socialSecurityNumber": {
                        "value": "123-45-6789",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part1-General:name(s)ShownOnForm1040": {
                        "value": "JOHN SAMPLE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line2A-AlimonyReceived": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line6-FarmIncomeOr(Loss)": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line4-OtherGainsOr(Losses)": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line3-BusinessIncomeOr(Loss)": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line7-UnemploymentCompensation": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8B-Gambling": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8H-JuryDutyPay": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8K-StockOptions": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8I-PrizesAndAwards": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8A-NetOperatingLoss": {
                        "value": "-500.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line9-TotalOtherIncomeAddLines8AThrough8Z": {
                        "value": "900.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8C-CancellationOfDebt": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8E-IncomeFromForm8853": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8F-IncomeFromForm8889": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8Z-OtherIncome-Amount": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8Z-OtherIncome-ListType": {
                        "value": "SAMPLE TYPE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8N-Section951(A)Inclusion": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8O-Section951A(A)Inclusion": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line2B-DateOfOriginalDivorceOrSeparationAgreement": {
                        "value": "10/01/2021",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8G-AlaskaPermanentFundDividends": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8U-WagesEarnedWhileIncarcerated": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8J-ActivityNotEngagedInForProfitIncome": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line10-CombineLines1Through7And9EnterHereAndOnForm10401040-Sr": {
                        "value": "1600.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line1-TaxableRefundsCreditsOrOffsetsOfStateAndLocalIncomeTaxes": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8Q-TaxableDistributionsFromAnAbleAccount": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line5-RentalRealEstateRoyaltiesPartnershipsSCorporationsTrustsEtc": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8D-ForeignEarnedIncomeExclusionFromForm2555": {
                        "value": "-250.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8P-Section461(L)ExcessBusinessLossAdjustment": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8M-OlympicAndParalympicMedalsAndUsocPrizeMoney": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8S-NontaxableAmountOfMedicaidWaiverPaymentsIncluded": {
                        "value": "-250.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8R-ScholarshipAndFellowshipGrantsNotReportedOnFormW-2": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8T-PensionOrAnnuityFromANonqualifedDeferredCompensationPlan": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    },
                    "a_1040_schedule_1_2022-Part2-AdditionalIncome:line8-OtherIncome:line8L-IncomeFromTheRentalOfPersonalPropertyIfYouEngagedInTheRental": {
                        "value": "100.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "2022 Schedule 1 (Form 1040).pdf"
                    }
                },
                "form_config_pk": 197553,
                "tables": []
 },
    "message": "OK"
}


Updated 11 months ago

IRS Form 1040 Schedule 1 (2021) - Additional Income and Adjustments to Income
IRS Form 1040 Schedule 1 (2023) - Additional Income and Adjustments to Income
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