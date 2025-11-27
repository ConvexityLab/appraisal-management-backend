# 941-X - Adjusted Employer’s QUARTERLY Federal Tax Return or Claim for Refund

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
941-X - Adjusted Employer’s QUARTERLY Federal Tax Return or Claim for Refund
Suggest Edits

Form 941-X is an IRS form used by employers to correct errors on previously filed Form 941, the Employer's Quarterly Federal Tax Return. This form allows employers to make necessary adjustments or changes to the information reported on the original Form 941.

To use the Upload PDF endpoint for this document, you must use A_941_X in the form_type parameter.

Field descriptions

The following fields are available on this form type:

JSON Attribute	Data Type	Description
a_941_x-General:employerIdentificationNumber	EIN	Employer Identification Number
a_941_x-General:name(NotYourTradeName)	Text	Name (Not Your Trade Name)
a_941_x-General:tradeName(IfAny)	Text	Trade Name (If Any)
a_941_x-General:address:numberAndStreet	Text	Address
a_941_x-General:address:suiteOrRoomNumber	Text	Address
a_941_x-General:address:city	Text	Address
a_941_x-General:address:state	State	Address
a_941_x-General:address:zipCode	ZIP Code	Address
a_941_x-General:address:foreignCountryName	Text	Address
a_941_x-General:address:foreignProvince/County	Text	Address
a_941_x-General:address:foreignPostalCode	Text	Address
a_941_x-General:returnYou'ReCorrecting:941	CHECKED, NOT CHECKED	Return You're Correcting
a_941_x-General:returnYou'ReCorrecting:941-ss	CHECKED, NOT CHECKED	Return You're Correcting
a_941_x-General:checkTheOneQuarterYou'ReCorrecting	1 - JANUARY FEBRUARY MARCH, 2 - APRIL MAY JUNE, 3 - JULY AUGUST SEPTEMBER, 4 - OCTOBER NOVEMBER DECEMBER	Check The One Quarter You're Correcting
a_941_x-General:enterTheCalendarYearOfTheQuarterYou'ReCorrecting	Integer	Enter The Calendar Year Of The Quarter You're Correcting
a_941_x-Part1-SelectOnlyOneProcess:selectOnlyOneProcess	1 - ADJUSTED EMPLOYMENT TAX RETURN, 2 - CLAIM	Select Only One Process
a_941_x-Part1-SelectOnlyOneProcess:enterTheDateYouDiscoveredErrors	Date	Enter The Date You Discovered Errors
a_941_x-Part2-CompleteTheCertifications:line3-ICertifyThatI'VeFiledOrWillFileFormsW-2WageAndTaxStatement	CHECKED, NOT CHECKED	Line 3 - I Certify That I've Filed Or Will File Forms W-2 Wage And Tax Statement
a_941_x-Part2-CompleteTheCertifications:line4-IfYouCheckedLine1BecauseYou'ReAdjustingOverreportedFederalIncomeTax:a-IRepaidOrReimbursedEachAffectedEmployeeForTheOvercollectedFederalIncomeTax	CHECKED, NOT CHECKED	Line 4 - If You Checked Line 1 Because You're Adjusting Overreported Federal Income Tax
a_941_x-Part2-CompleteTheCertifications:line4-IfYouCheckedLine1BecauseYou'ReAdjustingOverreportedFederalIncomeTax:b-TheAdjustmentsOfSocialSecurityTaxAndMedicareTaxAreForTheEmployer'SShare	CHECKED, NOT CHECKED	Line 4 - If You Checked Line 1 Because You're Adjusting Overreported Federal Income Tax
a_941_x-Part2-CompleteTheCertifications:line4-IfYouCheckedLine1BecauseYou'ReAdjustingOverreportedFederalIncomeTax:c-TheAdjustmentIsForFederalIncomeTaxSocialSecurityTaxMedicareTax	CHECKED, NOT CHECKED	Line 4 - If You Checked Line 1 Because You're Adjusting Overreported Federal Income Tax
a_941_x-Part2-CompleteTheCertifications:line5-IfYouCheckedLine2BecauseYou'ReClaimingARefundOrAbatement:a-IRepaidOrReimbursedEachAffectedEmployeeForTheOvercollectedSocialSecurityTax	CHECKED, NOT CHECKED	Line 5 - If You Checked Line 2 Because You're Claiming A Refund Or Abatement
a_941_x-Part2-CompleteTheCertifications:line5-IfYouCheckedLine2BecauseYou'ReClaimingARefundOrAbatement:b-IHaveAWrittenConsentFromEachAffectedEmployee	CHECKED, NOT CHECKED	Line 5 - If You Checked Line 2 Because You're Claiming A Refund Or Abatement
a_941_x-Part2-CompleteTheCertifications:line5-IfYouCheckedLine2BecauseYou'ReClaimingARefundOrAbatement:c-TheClaimForSocialSecurityTaxAndMedicareTaxIsForTheEmployer'SShareOnly	CHECKED, NOT CHECKED	Line 5 - If You Checked Line 2 Because You're Claiming A Refund Or Abatement
a_941_x-Part2-CompleteTheCertifications:line5-IfYouCheckedLine2BecauseYou'ReClaimingARefundOrAbatement:d-TheClaimIsForFederalIncomeTaxSocialSecurityTaxMedicareTax	CHECKED, NOT CHECKED	Line 5 - If You Checked Line 2 Because You're Claiming A Refund Or Abatement
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line6-WagesTipsAndOtherCompensation:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 6 - Wages Tips And Other Compensation
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line6-WagesTipsAndOtherCompensation:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 6 - Wages Tips And Other Compensation
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line6-WagesTipsAndOtherCompensation:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 6 - Wages Tips And Other Compensation
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line7-FederalIncomeTaxWithheldFromWagesTipsAndOtherCompensation:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 7 - Federal Income Tax Withheld From Wages Tips And Other Compensation
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line7-FederalIncomeTaxWithheldFromWagesTipsAndOtherCompensation:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 7 - Federal Income Tax Withheld From Wages Tips And Other Compensation
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line7-FederalIncomeTaxWithheldFromWagesTipsAndOtherCompensation:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 7 - Federal Income Tax Withheld From Wages Tips And Other Compensation
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line7-FederalIncomeTaxWithheldFromWagesTipsAndOtherCompensation:column4-TaxCorrection	Money	Line 7 - Federal Income Tax Withheld From Wages Tips And Other Compensation
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line8-TaxableSocialSecurityWages:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 8 - Taxable Social Security Wages
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line8-TaxableSocialSecurityWages:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 8 - Taxable Social Security Wages
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line8-TaxableSocialSecurityWages:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 8 - Taxable Social Security Wages
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line8-TaxableSocialSecurityWages:column4-TaxCorrection	Money	Line 8 - Taxable Social Security Wages
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line9-QualifiedSickLeaveWages:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 9 - Qualified Sick Leave Wages
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line9-QualifiedSickLeaveWages:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 9 - Qualified Sick Leave Wages
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line9-QualifiedSickLeaveWages:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 9 - Qualified Sick Leave Wages
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line9-QualifiedSickLeaveWages:column4-TaxCorrection	Money	Line 9 - Qualified Sick Leave Wages
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line10-QualifiedFamilyLeaveWages:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 10 - Qualified Family Leave Wages
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line10-QualifiedFamilyLeaveWages:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 10 - Qualified Family Leave Wages
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line10-QualifiedFamilyLeaveWages:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 10 - Qualified Family Leave Wages
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line10-QualifiedFamilyLeaveWages:column4-TaxCorrection	Money	Line 10 - Qualified Family Leave Wages
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line11-TaxableSocialSecurityTips:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 11 - Taxable Social Security Tips
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line11-TaxableSocialSecurityTips:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 11 - Taxable Social Security Tips
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line11-TaxableSocialSecurityTips:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 11 - Taxable Social Security Tips
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line11-TaxableSocialSecurityTips:column4-TaxCorrection	Money	Line 11 - Taxable Social Security Tips
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line12-TaxableMedicareWages&Tips:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 12 - Taxable Medicare Wages & Tips
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line12-TaxableMedicareWages&Tips:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 12 - Taxable Medicare Wages & Tips
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line12-TaxableMedicareWages&Tips:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 12 - Taxable Medicare Wages & Tips
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line12-TaxableMedicareWages&Tips:column4-TaxCorrection	Money	Line 12 - Taxable Medicare Wages & Tips
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line13-TaxableWages&TipsSubjectToAdditionalMedicareTaxWithholding:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 13 - Taxable Wages & Tips Subject To Additional Medicare Tax Withholding
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line13-TaxableWages&TipsSubjectToAdditionalMedicareTaxWithholding:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 13 - Taxable Wages & Tips Subject To Additional Medicare Tax Withholding
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line13-TaxableWages&TipsSubjectToAdditionalMedicareTaxWithholding:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 13 - Taxable Wages & Tips Subject To Additional Medicare Tax Withholding
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line13-TaxableWages&TipsSubjectToAdditionalMedicareTaxWithholding:column4-TaxCorrection	Money	Line 13 - Taxable Wages & Tips Subject To Additional Medicare Tax Withholding
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line14-Section3121(Q)NoticeAndDemand-TaxDueOnUnreportedTips:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 14 - Section 3121(Q) Notice And Demand - Tax Due On Unreported Tips
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line14-Section3121(Q)NoticeAndDemand-TaxDueOnUnreportedTips:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 14 - Section 3121(Q) Notice And Demand - Tax Due On Unreported Tips
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line14-Section3121(Q)NoticeAndDemand-TaxDueOnUnreportedTips:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 14 - Section 3121(Q) Notice And Demand - Tax Due On Unreported Tips
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line14-Section3121(Q)NoticeAndDemand-TaxDueOnUnreportedTips:column4-TaxCorrection	Money	Line 14 - Section 3121(Q) Notice And Demand - Tax Due On Unreported Tips
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line15-TaxAdjustments:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 15 - Tax Adjustments
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line15-TaxAdjustments:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 15 - Tax Adjustments
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line15-TaxAdjustments:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 15 - Tax Adjustments
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line15-TaxAdjustments:column4-TaxCorrection	Money	Line 15 - Tax Adjustments
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line16-QualifiedSmallBusinessPayrollTaxCreditForIncreasingResearchActivities:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 16 - Qualified Small Business Payroll Tax Credit For Increasing Research Activities
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line16-QualifiedSmallBusinessPayrollTaxCreditForIncreasingResearchActivities:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 16 - Qualified Small Business Payroll Tax Credit For Increasing Research Activities
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line16-QualifiedSmallBusinessPayrollTaxCreditForIncreasingResearchActivities:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 16 - Qualified Small Business Payroll Tax Credit For Increasing Research Activities
a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line16-QualifiedSmallBusinessPayrollTaxCreditForIncreasingResearchActivities:column4-TaxCorrection	Money	Line 16 - Qualified Small Business Payroll Tax Credit For Increasing Research Activities
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line17-NonrefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 17 - Nonrefundable Portion Of Credit For Qualified Sick And Family Leave Wages
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line17-NonrefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 17 - Nonrefundable Portion Of Credit For Qualified Sick And Family Leave Wages
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line17-NonrefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 17 - Nonrefundable Portion Of Credit For Qualified Sick And Family Leave Wages
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line17-NonrefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column4-TaxCorrection	Money	Line 17 - Nonrefundable Portion Of Credit For Qualified Sick And Family Leave Wages
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line18A-NonrefundablePortionOfEmployeeRetentionCredit:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 18A - Nonrefundable Portion Of Employee Retention Credit
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line18A-NonrefundablePortionOfEmployeeRetentionCredit:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 18A - Nonrefundable Portion Of Employee Retention Credit
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line18A-NonrefundablePortionOfEmployeeRetentionCredit:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 18A - Nonrefundable Portion Of Employee Retention Credit
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line18A-NonrefundablePortionOfEmployeeRetentionCredit:column4-TaxCorrection	Money	Line 18A - Nonrefundable Portion Of Employee Retention Credit
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line18B-NonrefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 18B - Nonrefundable Portion Of Credit For Qualified Sick And Family Leave Wages
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line18B-NonrefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 18B - Nonrefundable Portion Of Credit For Qualified Sick And Family Leave Wages
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line18B-NonrefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 18B - Nonrefundable Portion Of Credit For Qualified Sick And Family Leave Wages
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line18B-NonrefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column4-TaxCorrection	Money	Line 18B - Nonrefundable Portion Of Credit For Qualified Sick And Family Leave Wages
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line18C-NonrefundablePortionOfCobraPremiumAssistanceCredit:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 18C - Nonrefundable Portion Of Cobra Premium Assistance Credit
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line18C-NonrefundablePortionOfCobraPremiumAssistanceCredit:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 18C - Nonrefundable Portion Of Cobra Premium Assistance Credit
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line18C-NonrefundablePortionOfCobraPremiumAssistanceCredit:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 18C - Nonrefundable Portion Of Cobra Premium Assistance Credit
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line18C-NonrefundablePortionOfCobraPremiumAssistanceCredit:column4-TaxCorrection	Money	Line 18C - Nonrefundable Portion Of Cobra Premium Assistance Credit
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line18D-NumberOfIndividualsProvidedCobraPremiumAssistance:column1-TotalCorrectedAmount(ForAllEmployees)	Integer	Line 18D - Number Of Individuals Provided Cobra Premium Assistance
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line18D-NumberOfIndividualsProvidedCobraPremiumAssistance:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Integer	Line 18D - Number Of Individuals Provided Cobra Premium Assistance
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line18D-NumberOfIndividualsProvidedCobraPremiumAssistance:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Integer	Line 18D - Number Of Individuals Provided Cobra Premium Assistance
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line19-SpecialAdditionToWagesForFederalIncomeTax:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 19 - Special Addition To Wages For Federal Income Tax
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line19-SpecialAdditionToWagesForFederalIncomeTax:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 19 - Special Addition To Wages For Federal Income Tax
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line19-SpecialAdditionToWagesForFederalIncomeTax:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 19 - Special Addition To Wages For Federal Income Tax
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line19-SpecialAdditionToWagesForFederalIncomeTax:column4-TaxCorrection	Money	Line 19 - Special Addition To Wages For Federal Income Tax
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line20-SpecialAdditionToWagesForSocialSecurityTaxes:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 20 - Special Addition To Wages For Social Security Taxes
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line20-SpecialAdditionToWagesForSocialSecurityTaxes:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 20 - Special Addition To Wages For Social Security Taxes
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line20-SpecialAdditionToWagesForSocialSecurityTaxes:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 20 - Special Addition To Wages For Social Security Taxes
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line20-SpecialAdditionToWagesForSocialSecurityTaxes:column4-TaxCorrection	Money	Line 20 - Special Addition To Wages For Social Security Taxes
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line21-SpecialAdditionToWagesForMedicareTaxes:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 21 - Special Addition To Wages For Medicare Taxes
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line21-SpecialAdditionToWagesForMedicareTaxes:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 21 - Special Addition To Wages For Medicare Taxes
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line21-SpecialAdditionToWagesForMedicareTaxes:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 21 - Special Addition To Wages For Medicare Taxes
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line21-SpecialAdditionToWagesForMedicareTaxes:column4-TaxCorrection	Money	Line 21 - Special Addition To Wages For Medicare Taxes
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line22-SpecialAdditionToWagesForAdditionalMedicareTax:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 22 - Special Addition To Wages For Additional Medicare Tax
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line22-SpecialAdditionToWagesForAdditionalMedicareTax:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 22 - Special Addition To Wages For Additional Medicare Tax
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line22-SpecialAdditionToWagesForAdditionalMedicareTax:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 22 - Special Addition To Wages For Additional Medicare Tax
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line22-SpecialAdditionToWagesForAdditionalMedicareTax:column4-TaxCorrection	Money	Line 22 - Special Addition To Wages For Additional Medicare Tax
a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line23-CombineTheAmountsOnLines7Through22OfColumn4:column4-TaxCorrection	Money	Line 23 - Combine The Amounts On Lines 7 Through 22 Of Column 4
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line24-DeferredAmountOfSocialSecurityTax:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 24 - Deferred Amount Of Social Security Tax
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line24-DeferredAmountOfSocialSecurityTax:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 24 - Deferred Amount Of Social Security Tax
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line24-DeferredAmountOfSocialSecurityTax:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 24 - Deferred Amount Of Social Security Tax
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line24-DeferredAmountOfSocialSecurityTax:column4-TaxCorrection	Money	Line 24 - Deferred Amount Of Social Security Tax
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line25-RefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 25 - Refundable Portion Of Credit For Qualified Sick And Family Leave Wages
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line25-RefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 25 - Refundable Portion Of Credit For Qualified Sick And Family Leave Wages
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line25-RefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 25 - Refundable Portion Of Credit For Qualified Sick And Family Leave Wages
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line25-RefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column4-TaxCorrection	Money	Line 25 - Refundable Portion Of Credit For Qualified Sick And Family Leave Wages
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line26A-RefundablePortionOfEmployeeRetentionCredit:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 26A - Refundable Portion Of Employee Retention Credit
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line26A-RefundablePortionOfEmployeeRetentionCredit:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 26A - Refundable Portion Of Employee Retention Credit
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line26A-RefundablePortionOfEmployeeRetentionCredit:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 26A - Refundable Portion Of Employee Retention Credit
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line26A-RefundablePortionOfEmployeeRetentionCredit:column4-TaxCorrection	Money	Line 26A - Refundable Portion Of Employee Retention Credit
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line26B-RefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 26B - Refundable Portion Of Credit For Qualified Sick And Family Leave Wages
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line26B-RefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 26B - Refundable Portion Of Credit For Qualified Sick And Family Leave Wages
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line26B-RefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 26B - Refundable Portion Of Credit For Qualified Sick And Family Leave Wages
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line26B-RefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column4-TaxCorrection	Money	Line 26B - Refundable Portion Of Credit For Qualified Sick And Family Leave Wages
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line26C-RefundablePortionOfCobraPremiumAssistanceCredit:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 26C - Refundable Portion Of Cobra Premium Assistance Credit
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line26C-RefundablePortionOfCobraPremiumAssistanceCredit:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 26C - Refundable Portion Of Cobra Premium Assistance Credit
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line26C-RefundablePortionOfCobraPremiumAssistanceCredit:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 26C - Refundable Portion Of Cobra Premium Assistance Credit
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line26C-RefundablePortionOfCobraPremiumAssistanceCredit:column4-TaxCorrection	Money	Line 26C - Refundable Portion Of Cobra Premium Assistance Credit
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line27-TotalCombineTheAmountsOnLines23Through26COfColumn4:column4-TaxCorrection	Money	Line 27 - Total Combine The Amounts On Lines 23 Through 26C Of Column 4
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line28-QualifiedHealthPlanExpensesAllocableToQualifiedSickLeaveWages:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 28 - Qualified Health Plan Expenses Allocable To Qualified Sick Leave Wages
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line28-QualifiedHealthPlanExpensesAllocableToQualifiedSickLeaveWages:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 28 - Qualified Health Plan Expenses Allocable To Qualified Sick Leave Wages
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line28-QualifiedHealthPlanExpensesAllocableToQualifiedSickLeaveWages:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 28 - Qualified Health Plan Expenses Allocable To Qualified Sick Leave Wages
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line29-QualifiedHealthPlanExpensesAllocableToQualifiedFamilyLeaveWages:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 29 - Qualified Health Plan Expenses Allocable To Qualified Family Leave Wages
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line29-QualifiedHealthPlanExpensesAllocableToQualifiedFamilyLeaveWages:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 29 - Qualified Health Plan Expenses Allocable To Qualified Family Leave Wages
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line29-QualifiedHealthPlanExpensesAllocableToQualifiedFamilyLeaveWages:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 29 - Qualified Health Plan Expenses Allocable To Qualified Family Leave Wages
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line30-QualifiedWagesForTheEmployeeRetentionCredit:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 30 - Qualified Wages For The Employee Retention Credit
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line30-QualifiedWagesForTheEmployeeRetentionCredit:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 30 - Qualified Wages For The Employee Retention Credit
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line30-QualifiedWagesForTheEmployeeRetentionCredit:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 30 - Qualified Wages For The Employee Retention Credit
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line31A-QualifiedHealthPlanExpensesForTheEmployeeRetentionCredit:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 31A - Qualified Health Plan Expenses For The Employee Retention Credit
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line31A-QualifiedHealthPlanExpensesForTheEmployeeRetentionCredit:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 31A - Qualified Health Plan Expenses For The Employee Retention Credit
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line31A-QualifiedHealthPlanExpensesForTheEmployeeRetentionCredit:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 31A - Qualified Health Plan Expenses For The Employee Retention Credit
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line31B-CheckHereIfYou'ReEligibleForTheEmployeeRetentionCredit	CHECKED, NOT CHECKED	Line 31B - Check Here If You're Eligible For The Employee Retention Credit
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line32-CreditFromForm5884-CLine11ForThisQuarter:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 32 - Credit From Form 5884-C Line 11 For This Quarter
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line32-CreditFromForm5884-CLine11ForThisQuarter:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 32 - Credit From Form 5884-C Line 11 For This Quarter
a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line32-CreditFromForm5884-CLine11ForThisQuarter:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 32 - Credit From Form 5884-C Line 11 For This Quarter
a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line33A-QualifiedWagesPaidMarch13ThroughMarch312020ForTheEmployeeRetention:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 33A - Qualified Wages Paid March 13 Through March 31 2020 For The Employee Retention
a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line33A-QualifiedWagesPaidMarch13ThroughMarch312020ForTheEmployeeRetention:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 33A - Qualified Wages Paid March 13 Through March 31 2020 For The Employee Retention
a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line33A-QualifiedWagesPaidMarch13ThroughMarch312020ForTheEmployeeRetention:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 33A - Qualified Wages Paid March 13 Through March 31 2020 For The Employee Retention
a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line33B-DeferredAmountOfTheEmployeeShareOfSocialSecurityTax:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 33B - Deferred Amount Of The Employee Share Of Social Security Tax
a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line33B-DeferredAmountOfTheEmployeeShareOfSocialSecurityTax:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 33B - Deferred Amount Of The Employee Share Of Social Security Tax
a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line33B-DeferredAmountOfTheEmployeeShareOfSocialSecurityTax:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 33B - Deferred Amount Of The Employee Share Of Social Security Tax
a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line34-QualifiedHealthPlanExpensesAllocableToWagesReportedOnForm941Or941-Ss:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 34 - Qualified Health Plan Expenses Allocable To Wages Reported On Form 941 Or 941-SS
a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line34-QualifiedHealthPlanExpensesAllocableToWagesReportedOnForm941Or941-Ss:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 34 - Qualified Health Plan Expenses Allocable To Wages Reported On Form 941 Or 941-SS
a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line34-QualifiedHealthPlanExpensesAllocableToWagesReportedOnForm941Or941-Ss:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 34 - Qualified Health Plan Expenses Allocable To Wages Reported On Form 941 Or 941-SS
a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line35-QualifiedSickLeaveWages:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 35 - Qualified Sick Leave Wages
a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line35-QualifiedSickLeaveWages:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 35 - Qualified Sick Leave Wages
a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line35-QualifiedSickLeaveWages:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 35 - Qualified Sick Leave Wages
a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line36-QualifiedHealthPlanExpensesAllocableToQualifiedSickLeaveWages:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 36 - Qualified Health Plan Expenses Allocable To Qualified Sick Leave Wages
a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line36-QualifiedHealthPlanExpensesAllocableToQualifiedSickLeaveWages:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 36 - Qualified Health Plan Expenses Allocable To Qualified Sick Leave Wages
a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line36-QualifiedHealthPlanExpensesAllocableToQualifiedSickLeaveWages:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 36 - Qualified Health Plan Expenses Allocable To Qualified Sick Leave Wages
a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line37-AmountsUnderCertainCollectivelyBargainedAgreements:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 37 - Amounts Under Certain Collectively Bargained Agreements
a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line37-AmountsUnderCertainCollectivelyBargainedAgreements:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 37 - Amounts Under Certain Collectively Bargained Agreements
a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line37-AmountsUnderCertainCollectivelyBargainedAgreements:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 37 - Amounts Under Certain Collectively Bargained Agreements
a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line38-QualifiedFamilyLeaveWages:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 38 - Qualified Family Leave Wages
a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line38-QualifiedFamilyLeaveWages:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 38 - Qualified Family Leave Wages
a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line38-QualifiedFamilyLeaveWages:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 38 - Qualified Family Leave Wages
a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line39-QualifiedHealthPlanExpensesAllocableToQualifiedFamilyLeaveWages:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 39 - Qualified Health Plan Expenses Allocable To Qualified Family Leave Wages
a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line39-QualifiedHealthPlanExpensesAllocableToQualifiedFamilyLeaveWages:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 39 - Qualified Health Plan Expenses Allocable To Qualified Family Leave Wages
a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line39-QualifiedHealthPlanExpensesAllocableToQualifiedFamilyLeaveWages:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 39 - Qualified Health Plan Expenses Allocable To Qualified Family Leave Wages
a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line40-AmountsUnderCertainCollectivelyBargainedAgreements:column1-TotalCorrectedAmount(ForAllEmployees)	Money	Line 40 - Amounts Under Certain Collectively Bargained Agreements
a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line40-AmountsUnderCertainCollectivelyBargainedAgreements:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)	Money	Line 40 - Amounts Under Certain Collectively Bargained Agreements
a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line40-AmountsUnderCertainCollectivelyBargainedAgreements:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)	Money	Line 40 - Amounts Under Certain Collectively Bargained Agreements
a_941_x-Part4-ExplainYourCorrectionsForThisQuarter:line41-CheckHereIfAnyCorrectionsYouEnteredOnALineIncludeBothAmounts	CHECKED, NOT CHECKED	Line 41 - Check Here If Any Corrections You Entered On A Line Include Both Amounts
a_941_x-Part4-ExplainYourCorrectionsForThisQuarter:line42-CheckHereIfAnyCorrectionsInvolveReclassifiedWorkersExplainOnLine43	CHECKED, NOT CHECKED	Line 42 - Check Here If Any Corrections Involve Reclassified Workers Explain On Line 43
a_941_x-Part4-ExplainYourCorrectionsForThisQuarter:line43-YouMustGiveUsADetailedExplanationOfHowYouDeterminedYourCorrections	Text	Line 43 - You Must Give Us A Detailed Explanation Of How You Determined Your Corrections
a_941_x-Part5-SignHereYouMustCompleteAllFivePagesOfThisFormAndSignIt:signYourNameHere	SIGNED, NOT SIGNED	Sign Your Name Here
a_941_x-Part5-SignHereYouMustCompleteAllFivePagesOfThisFormAndSignIt:date	Date	Date
a_941_x-Part5-SignHereYouMustCompleteAllFivePagesOfThisFormAndSignIt:printYourNameHere	Text	Print Your Name Here
a_941_x-Part5-SignHereYouMustCompleteAllFivePagesOfThisFormAndSignIt:printYourTitleHere	Text	Print Your Title Here
a_941_x-Part5-SignHereYouMustCompleteAllFivePagesOfThisFormAndSignIt:bestDaytimePhone	Phone Number	Best Daytime Phone
a_941_x-Part6-PaidPreparerUseOnly:checkIfYou'ReSelf-Employed	CHECKED, NOT CHECKED	Check If You're Self-Employed
a_941_x-Part6-PaidPreparerUseOnly:preparer'sName	Text	Preparer's Name
a_941_x-Part6-PaidPreparerUseOnly:ptin	Text	PTIN
a_941_x-Part6-PaidPreparerUseOnly:preparer'sSignature	SIGNED, NOT SIGNED	Preparer's Signature
a_941_x-Part6-PaidPreparerUseOnly:date	Date	Date
a_941_x-Part6-PaidPreparerUseOnly:firm'sName(OrYoursIfSelf-Employed)	Text	Firm's Name (Or Yours If Self-Employed)
a_941_x-Part6-PaidPreparerUseOnly:ein	EIN	EIN
a_941_x-Part6-PaidPreparerUseOnly:phone	Phone Number	Phone
a_941_x-Part6-PaidPreparerUseOnly:address:addressLine1	Text	Address
a_941_x-Part6-PaidPreparerUseOnly:address:addressLine2	Text	Address
a_941_x-Part6-PaidPreparerUseOnly:address:city	Text	Address
a_941_x-Part6-PaidPreparerUseOnly:address:state	State	Address
a_941_x-Part6-PaidPreparerUseOnly:address:zipCode	ZIP Code	Address
Sample document
drive.google.com
941_X.pdf
Sample JSON result
JSON
{
  "pk": 40915897,
  "uuid": "c1b0cf80-5734-4d20-884c-40e636798326",
  "name": "API documentations",
  "created": "2023-10-25T17:58:37Z",
  "created_ts": "2023-10-25T17:58:37Z",
  "verified_pages_count": 35,
  "book_status": "ACTIVE",
  "id": 40915897,
  "forms": [
    {
      "pk": 50724958,
      "uuid": "20d256b1-e456-4782-8578-0718ccc33974",
      "uploaded_doc_pk": 61716143,
      "form_type": "A_941_X",
      "raw_fields": {
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line24-DeferredAmountOfSocialSecurityTax:column4-TaxCorrection": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line31B-CheckHereIfYou'ReEligibleForTheEmployeeRetentionCredit": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line23-CombineTheAmountsOnLines7Through22OfColumn4:column4-TaxCorrection": {
          "value": "-8270.54",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line26A-RefundablePortionOfEmployeeRetentionCredit:column4-TaxCorrection": {
          "value": "-61575.71",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line22-SpecialAdditionToWagesForAdditionalMedicareTax:column4-TaxCorrection": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line26C-RefundablePortionOfCobraPremiumAssistanceCredit:column4-TaxCorrection": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line27-TotalCombineTheAmountsOnLines23Through26COfColumn4:column4-TaxCorrection": {
          "value": "-69846.25",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line24-DeferredAmountOfSocialSecurityTax:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line25-RefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column4-TaxCorrection": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line26B-RefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column4-TaxCorrection": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line32-CreditFromForm5884-CLine11ForThisQuarter:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line26A-RefundablePortionOfEmployeeRetentionCredit:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "61575.71",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line30-QualifiedWagesForTheEmployeeRetentionCredit:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "99780.36",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line22-SpecialAdditionToWagesForAdditionalMedicareTax:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line26C-RefundablePortionOfCobraPremiumAssistanceCredit:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line24-DeferredAmountOfSocialSecurityTax:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line31A-QualifiedHealthPlanExpensesForTheEmployeeRetentionCredit:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line32-CreditFromForm5884-CLine11ForThisQuarter:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line24-DeferredAmountOfSocialSecurityTax:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line25-RefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line26A-RefundablePortionOfEmployeeRetentionCredit:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "61575.71",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line26B-RefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line28-QualifiedHealthPlanExpensesAllocableToQualifiedSickLeaveWages:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line30-QualifiedWagesForTheEmployeeRetentionCredit:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "99780.36",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line29-QualifiedHealthPlanExpensesAllocableToQualifiedFamilyLeaveWages:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line22-SpecialAdditionToWagesForAdditionalMedicareTax:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line26C-RefundablePortionOfCobraPremiumAssistanceCredit:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line32-CreditFromForm5884-CLine11ForThisQuarter:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line26A-RefundablePortionOfEmployeeRetentionCredit:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "0.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line30-QualifiedWagesForTheEmployeeRetentionCredit:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "0.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line22-SpecialAdditionToWagesForAdditionalMedicareTax:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line26C-RefundablePortionOfCobraPremiumAssistanceCredit:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line31A-QualifiedHealthPlanExpensesForTheEmployeeRetentionCredit:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line25-RefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line26B-RefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line28-QualifiedHealthPlanExpensesAllocableToQualifiedSickLeaveWages:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line29-QualifiedHealthPlanExpensesAllocableToQualifiedFamilyLeaveWages:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line31A-QualifiedHealthPlanExpensesForTheEmployeeRetentionCredit:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line25-RefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line26B-RefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line28-QualifiedHealthPlanExpensesAllocableToQualifiedSickLeaveWages:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-3-EnterTheCorrectionsForThisQuarter:line29-QualifiedHealthPlanExpensesAllocableToQualifiedFamilyLeaveWages:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line15-TaxAdjustments:column4-TaxCorrection": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line9-QualifiedSickLeaveWages:column4-TaxCorrection": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line10-QualifiedFamilyLeaveWages:column4-TaxCorrection": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line11-TaxableSocialSecurityTips:column4-TaxCorrection": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line12-TaxableMedicareWages&Tips:column4-TaxCorrection": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line8-TaxableSocialSecurityWages:column4-TaxCorrection": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line15-TaxAdjustments:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line21-SpecialAdditionToWagesForMedicareTaxes:column4-TaxCorrection": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line19-SpecialAdditionToWagesForFederalIncomeTax:column4-TaxCorrection": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line20-SpecialAdditionToWagesForSocialSecurityTaxes:column4-TaxCorrection": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line9-QualifiedSickLeaveWages:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line18A-NonrefundablePortionOfEmployeeRetentionCredit:column4-TaxCorrection": {
          "value": "-8270.54",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line10-QualifiedFamilyLeaveWages:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line11-TaxableSocialSecurityTips:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line12-TaxableMedicareWages&Tips:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line8-TaxableSocialSecurityWages:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line18C-NonrefundablePortionOfCobraPremiumAssistanceCredit:column4-TaxCorrection": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line14-Section3121(Q)NoticeAndDemand-TaxDueOnUnreportedTips:column4-TaxCorrection": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line6-WagesTipsAndOtherCompensation:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line15-TaxAdjustments:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line7-FederalIncomeTaxWithheldFromWagesTipsAndOtherCompensation:column4-TaxCorrection": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line13-TaxableWages&TipsSubjectToAdditionalMedicareTaxWithholding:column4-TaxCorrection": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line21-SpecialAdditionToWagesForMedicareTaxes:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line17-NonrefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column4-TaxCorrection": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line9-QualifiedSickLeaveWages:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line18B-NonrefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column4-TaxCorrection": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line15-TaxAdjustments:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line19-SpecialAdditionToWagesForFederalIncomeTax:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line10-QualifiedFamilyLeaveWages:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line11-TaxableSocialSecurityTips:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line12-TaxableMedicareWages&Tips:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line8-TaxableSocialSecurityWages:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line20-SpecialAdditionToWagesForSocialSecurityTaxes:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line16-QualifiedSmallBusinessPayrollTaxCreditForIncreasingResearchActivities:column4-TaxCorrection": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line6-WagesTipsAndOtherCompensation:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line18A-NonrefundablePortionOfEmployeeRetentionCredit:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "8270.54",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line9-QualifiedSickLeaveWages:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line18D-NumberOfIndividualsProvidedCobraPremiumAssistance:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line18C-NonrefundablePortionOfCobraPremiumAssistanceCredit:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line10-QualifiedFamilyLeaveWages:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line11-TaxableSocialSecurityTips:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line12-TaxableMedicareWages&Tips:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line14-Section3121(Q)NoticeAndDemand-TaxDueOnUnreportedTips:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line8-TaxableSocialSecurityWages:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line6-WagesTipsAndOtherCompensation:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line7-FederalIncomeTaxWithheldFromWagesTipsAndOtherCompensation:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line21-SpecialAdditionToWagesForMedicareTaxes:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line13-TaxableWages&TipsSubjectToAdditionalMedicareTaxWithholding:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line19-SpecialAdditionToWagesForFederalIncomeTax:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line20-SpecialAdditionToWagesForSocialSecurityTaxes:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line17-NonrefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line18A-NonrefundablePortionOfEmployeeRetentionCredit:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "8270.54",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line18B-NonrefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line21-SpecialAdditionToWagesForMedicareTaxes:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line18D-NumberOfIndividualsProvidedCobraPremiumAssistance:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line19-SpecialAdditionToWagesForFederalIncomeTax:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line16-QualifiedSmallBusinessPayrollTaxCreditForIncreasingResearchActivities:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line18C-NonrefundablePortionOfCobraPremiumAssistanceCredit:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line14-Section3121(Q)NoticeAndDemand-TaxDueOnUnreportedTips:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line20-SpecialAdditionToWagesForSocialSecurityTaxes:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line18A-NonrefundablePortionOfEmployeeRetentionCredit:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "0.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line7-FederalIncomeTaxWithheldFromWagesTipsAndOtherCompensation:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line13-TaxableWages&TipsSubjectToAdditionalMedicareTaxWithholding:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line18D-NumberOfIndividualsProvidedCobraPremiumAssistance:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line18C-NonrefundablePortionOfCobraPremiumAssistanceCredit:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line14-Section3121(Q)NoticeAndDemand-TaxDueOnUnreportedTips:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line17-NonrefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line18B-NonrefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line7-FederalIncomeTaxWithheldFromWagesTipsAndOtherCompensation:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line13-TaxableWages&TipsSubjectToAdditionalMedicareTaxWithholding:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line16-QualifiedSmallBusinessPayrollTaxCreditForIncreasingResearchActivities:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line17-NonrefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-2-EnterTheCorrectionsForThisQuarter:line18B-NonrefundablePortionOfCreditForQualifiedSickAndFamilyLeaveWages:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-1-EnterTheCorrectionsForThisQuarter:line16-QualifiedSmallBusinessPayrollTaxCreditForIncreasingResearchActivities:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line35-QualifiedSickLeaveWages:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line38-QualifiedFamilyLeaveWages:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line35-QualifiedSickLeaveWages:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line38-QualifiedFamilyLeaveWages:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line35-QualifiedSickLeaveWages:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line37-AmountsUnderCertainCollectivelyBargainedAgreements:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line40-AmountsUnderCertainCollectivelyBargainedAgreements:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line33B-DeferredAmountOfTheEmployeeShareOfSocialSecurityTax:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line38-QualifiedFamilyLeaveWages:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line36-QualifiedHealthPlanExpensesAllocableToQualifiedSickLeaveWages:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line39-QualifiedHealthPlanExpensesAllocableToQualifiedFamilyLeaveWages:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line33A-QualifiedWagesPaidMarch13ThroughMarch312020ForTheEmployeeRetention:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line34-QualifiedHealthPlanExpensesAllocableToWagesReportedOnForm941Or941-Ss:column1-TotalCorrectedAmount(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line37-AmountsUnderCertainCollectivelyBargainedAgreements:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line40-AmountsUnderCertainCollectivelyBargainedAgreements:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line33B-DeferredAmountOfTheEmployeeShareOfSocialSecurityTax:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line37-AmountsUnderCertainCollectivelyBargainedAgreements:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line40-AmountsUnderCertainCollectivelyBargainedAgreements:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line33B-DeferredAmountOfTheEmployeeShareOfSocialSecurityTax:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line36-QualifiedHealthPlanExpensesAllocableToQualifiedSickLeaveWages:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line39-QualifiedHealthPlanExpensesAllocableToQualifiedFamilyLeaveWages:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line33A-QualifiedWagesPaidMarch13ThroughMarch312020ForTheEmployeeRetention:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line34-QualifiedHealthPlanExpensesAllocableToWagesReportedOnForm941Or941-Ss:column3-Difference(IfThisAmountIsANegativeNumberUseAMinusSign.)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line36-QualifiedHealthPlanExpensesAllocableToQualifiedSickLeaveWages:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line39-QualifiedHealthPlanExpensesAllocableToQualifiedFamilyLeaveWages:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line33A-QualifiedWagesPaidMarch13ThroughMarch312020ForTheEmployeeRetention:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part3-4-EnterTheCorrectionsForThisQuarter:line34-QualifiedHealthPlanExpensesAllocableToWagesReportedOnForm941Or941-Ss:column2-AmountOriginallyReportedOrAsPreviouslyCorrected(ForAllEmployees)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part6-PaidPreparerUseOnly:ein": {
          "value": "66-6666666",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part6-PaidPreparerUseOnly:date": {
          "value": "02/04/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part6-PaidPreparerUseOnly:ptin": {
          "value": "P01234567",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part6-PaidPreparerUseOnly:phone": {
          "value": "987-654-3210",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0,
          "irregular_datatype": true,
          "type_validation_error": "Invalid phone number."
        },
        "a_941_x-Part6-PaidPreparerUseOnly:address:city": {
          "value": "EXAMPLE CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part6-PaidPreparerUseOnly:address:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part6-PaidPreparerUseOnly:preparer'sName": {
          "value": "DAVID FAKE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part6-PaidPreparerUseOnly:address:zipCode": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part6-PaidPreparerUseOnly:preparer'sSignature": {
          "value": "SIGNED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part6-PaidPreparerUseOnly:address:addressLine1": {
          "value": "PO BOX 1234",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part6-PaidPreparerUseOnly:address:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part6-PaidPreparerUseOnly:checkIfYou'ReSelf-Employed": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part6-PaidPreparerUseOnly:firm'sName(OrYoursIfSelf-Employed)": {
          "value": "XYZ FAKE FIRM",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part5-SignHereYouMustCompleteAllFivePagesOfThisFormAndSignIt:date": {
          "value": "02/04/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part5-SignHereYouMustCompleteAllFivePagesOfThisFormAndSignIt:bestDaytimePhone": {
          "value": "(888) 888-8888",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part5-SignHereYouMustCompleteAllFivePagesOfThisFormAndSignIt:signYourNameHere": {
          "value": "SIGNED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part5-SignHereYouMustCompleteAllFivePagesOfThisFormAndSignIt:printYourNameHere": {
          "value": "SMITH SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part5-SignHereYouMustCompleteAllFivePagesOfThisFormAndSignIt:printYourTitleHere": {
          "value": "MD",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part4-ExplainYourCorrectionsForThisQuarter:line41-CheckHereIfAnyCorrectionsYouEnteredOnALineIncludeBothAmounts": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part4-ExplainYourCorrectionsForThisQuarter:line42-CheckHereIfAnyCorrectionsInvolveReclassifiedWorkersExplainOnLine43": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part4-ExplainYourCorrectionsForThisQuarter:line43-YouMustGiveUsADetailedExplanationOfHowYouDeterminedYourCorrections": {
          "value": "AMENDING RETURN TO APPLY FOR ERC CREDITS. PLEASE SEND REFUND CHECK TO ADDRESS ON FILE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-General:address:city": {
          "value": "ANY CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-General:address:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-General:address:zipCode": {
          "value": "54321",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-General:tradeName(IfAny)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-General:name(NotYourTradeName)": {
          "value": "ABC FAKE INC",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-General:address:numberAndStreet": {
          "value": "PO BOX 123",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-General:address:foreignPostalCode": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-General:address:suiteOrRoomNumber": {
          "value": "2 SUITE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-General:address:foreignCountryName": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-General:returnYou'ReCorrecting:941": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-General:employerIdentificationNumber": {
          "value": "22-2222222",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-General:returnYou'ReCorrecting:941-ss": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-General:address:foreignProvince/County": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-General:checkTheOneQuarterYou'ReCorrecting": {
          "value": "1 - JANUARY FEBRUARY MARCH",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part1-SelectOnlyOneProcess:selectOnlyOneProcess": {
          "value": "2 - CLAIM",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-General:enterTheCalendarYearOfTheQuarterYou'ReCorrecting": {
          "value": "2022",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part1-SelectOnlyOneProcess:enterTheDateYouDiscoveredErrors": {
          "value": "02/04/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part2-CompleteTheCertifications:line3-ICertifyThatI'VeFiledOrWillFileFormsW-2WageAndTaxStatement": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part2-CompleteTheCertifications:line5-IfYouCheckedLine2BecauseYou'ReClaimingARefundOrAbatement:b-IHaveAWrittenConsentFromEachAffectedEmployee": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part2-CompleteTheCertifications:line5-IfYouCheckedLine2BecauseYou'ReClaimingARefundOrAbatement:d-TheClaimIsForFederalIncomeTaxSocialSecurityTaxMedicareTax": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part2-CompleteTheCertifications:line5-IfYouCheckedLine2BecauseYou'ReClaimingARefundOrAbatement:c-TheClaimForSocialSecurityTaxAndMedicareTaxIsForTheEmployer'SShareOnly": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part2-CompleteTheCertifications:line4-IfYouCheckedLine1BecauseYou'ReAdjustingOverreportedFederalIncomeTax:c-TheAdjustmentIsForFederalIncomeTaxSocialSecurityTaxMedicareTax": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part2-CompleteTheCertifications:line5-IfYouCheckedLine2BecauseYou'ReClaimingARefundOrAbatement:a-IRepaidOrReimbursedEachAffectedEmployeeForTheOvercollectedSocialSecurityTax": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part2-CompleteTheCertifications:line4-IfYouCheckedLine1BecauseYou'ReAdjustingOverreportedFederalIncomeTax:b-TheAdjustmentsOfSocialSecurityTaxAndMedicareTaxAreForTheEmployer'SShare": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        },
        "a_941_x-Part2-CompleteTheCertifications:line4-IfYouCheckedLine1BecauseYou'ReAdjustingOverreportedFederalIncomeTax:a-IRepaidOrReimbursedEachAffectedEmployeeForTheOvercollectedFederalIncomeTax": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "941_X.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 306329,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}



Updated 11 months ago

941-V - Payment Voucher
IRS Form 1040 (2018) - U.S. Individual Income Tax Return
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