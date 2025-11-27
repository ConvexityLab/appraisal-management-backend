# IRS Form 1065 (2023) - U.S. Return of Partnership Income

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
IRS Form 1065 (2023) - U.S. Return of Partnership Income
Suggest Edits

This form is issued for all business partnerships to report their partnership's earnings, losses, deductions, and credits to the Internal Revenue Service (IRS).

To use the Upload PDF endpoint for this document, you must use A_1065_2023 in the form_type parameter. To learn more about this document processing, see processing 1065 forms.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
a_1065_2023-Part1-PartnershipDetails:year	Integer	Year
a_1065_2023-Part1-PartnershipDetails:beginningDateOfTaxYear	Date	Beginning Date Of Tax Year
a_1065_2023-Part1-PartnershipDetails:endingDateOfTaxYear	Date	Ending Date Of Tax Year
a_1065_2023-Part1-PartnershipDetails:nameOfPartnership	Text	Name Of Partnership
a_1065_2023-Part1-PartnershipDetails:address:addresssLine1	Text	Address
a_1065_2023-Part1-PartnershipDetails:address:addresssLine2	Text	Address
a_1065_2023-Part1-PartnershipDetails:address:city	Text	Address
a_1065_2023-Part1-PartnershipDetails:address:state	State	Address
a_1065_2023-Part1-PartnershipDetails:address:zip	ZIP Code	Address
a_1065_2023-Part1-PartnershipDetails:address:provinceAndCountryAndForeignPostalCode	Text	Address
a_1065_2023-Part1-PartnershipDetails:a-PrincipalBusinessActivity	Text	A - Principal Business Activity
a_1065_2023-Part1-PartnershipDetails:b-PrincipalProductOrService	Text	B - Principal Product Or Service
a_1065_2023-Part1-PartnershipDetails:c-BusinessCodeNumber	Integer	C - Business Code Number
a_1065_2023-Part1-PartnershipDetails:d-EmployerIdentificationNumber	EIN	D - Employer Identification Number
a_1065_2023-Part1-PartnershipDetails:e-DateBusinessStarted	Date	E - Date Business Started
a_1065_2023-Part1-PartnershipDetails:f-TotalAssets	Money	F - Total Assets
a_1065_2023-Part1-PartnershipDetails:g-CheckApplicableBoxes:(1)InitialReturn	CHECKED, NOT CHECKED	G - Check Applicable Boxes
a_1065_2023-Part1-PartnershipDetails:g-CheckApplicableBoxes:(2)FinalReturn	CHECKED, NOT CHECKED	G - Check Applicable Boxes
a_1065_2023-Part1-PartnershipDetails:g-CheckApplicableBoxes:(3)NameChange	CHECKED, NOT CHECKED	G - Check Applicable Boxes
a_1065_2023-Part1-PartnershipDetails:g-CheckApplicableBoxes:(4)AddressChange	CHECKED, NOT CHECKED	G - Check Applicable Boxes
a_1065_2023-Part1-PartnershipDetails:g-CheckApplicableBoxes:(5)AmendedReturn	CHECKED, NOT CHECKED	G - Check Applicable Boxes
a_1065_2023-Part1-PartnershipDetails:h-CheckAccountingMethod:(1)Cash	CHECKED, NOT CHECKED	H - Check Accounting Method
a_1065_2023-Part1-PartnershipDetails:h-CheckAccountingMethod:(2)Accrual	CHECKED, NOT CHECKED	H - Check Accounting Method
a_1065_2023-Part1-PartnershipDetails:h-CheckAccountingMethod:(3)Other(Specify)	CHECKED, NOT CHECKED	H - Check Accounting Method
a_1065_2023-Part1-PartnershipDetails:h-CheckAccountingMethod:(3)Other(Specify)-Detail	Text	H - Check Accounting Method
a_1065_2023-Part1-PartnershipDetails:i-NumberOfSchedulesK-1	Text	I - Number Of Schedules K-1
a_1065_2023-Part1-PartnershipDetails:j-CheckIfSchedulesCAndM-3AreAttached	CHECKED, NOT CHECKED	J - Check If Schedules C And M-3 Are Attached
a_1065_2023-Part1-PartnershipDetails:k-CheckIfPartnership:(1)AggregatedActivitiesForSection465At-RiskPurposes	CHECKED, NOT CHECKED	K - Check If Partnership
a_1065_2023-Part1-PartnershipDetails:k-CheckIfPartnership:(2)GroupedActivitiesForSection469PassiveActivityPurposes	CHECKED, NOT CHECKED	K - Check If Partnership
a_1065_2023-Part2-Income:line1A-GrossReceiptsOrSales	Money	Line 1A - Gross Receipts Or Sales
a_1065_2023-Part2-Income:line1B-LessReturnsAndAllowances	Money	Line 1B - Less Returns And Allowances
a_1065_2023-Part2-Income:line1C-Balance	Money	Line 1C - Balance
a_1065_2023-Part2-Income:line2-CostOfGoodsSold(AttachForm1125-A)	Money	Line 2 - Cost Of Goods Sold (Attach Form 1125-A)
a_1065_2023-Part2-Income:line3-GrossProfit.SubtractLine2FromLine1C	Money	Line 3 - Gross Profit. Subtract Line 2 From Line 1C
a_1065_2023-Part2-Income:line4-OrdinaryIncome(Loss)FromOtherPartnershipsEstatesAndTrusts	Money	Line 4 - Ordinary Income (Loss) From Other Partnerships Estates And Trusts
a_1065_2023-Part2-Income:line5-NetFarmProfit(Loss)(AttachScheduleF(Form1040))	Money	Line 5 - Net Farm Profit (Loss) (Attach Schedule F (Form 1040))
a_1065_2023-Part2-Income:line6-NetGain(Loss)FromForm4797	Money	Line 6 - Net Gain (Loss) From Form 4797
a_1065_2023-Part2-Income:line7-OtherIncome(Loss)	Money	Line 7 - Other Income (Loss)
a_1065_2023-Part2-Income:line8-TotalIncome(Loss).CombineLines3Through7	Money	Line 8 - Total Income (Loss). Combine Lines 3 Through 7
a_1065_2023-Part3-Deductions:line9-SalariesAndWages(OtherThanToPartners)(LessEmploymentCredits)	Money	Line 9 - Salaries And Wages (Other Than To Partners) (Less Employment Credits)
a_1065_2023-Part3-Deductions:line10-GuaranteedPaymentsToPartners	Money	Line 10 - Guaranteed Payments To Partners
a_1065_2023-Part3-Deductions:line11-RepairsAndMaintenance	Money	Line 11 - Repairs And Maintenance
a_1065_2023-Part3-Deductions:line12-BadDebts	Money	Line 12 - Bad Debts
a_1065_2023-Part3-Deductions:line13-Rent	Money	Line 13 - Rent
a_1065_2023-Part3-Deductions:line14-TaxesAndLicenses	Money	Line 14 - Taxes And Licenses
a_1065_2023-Part3-Deductions:line15-Interest	Money	Line 15 - Interest
a_1065_2023-Part3-Deductions:line16A-Depreciation(IfRequiredAttachForm4562)	Money	Line 16A - Depreciation (If Required Attach Form 4562)
a_1065_2023-Part3-Deductions:line16B-LessDepreciationReportedOnForm1125-AAndElsewhereOnReturn	Money	Line 16B - Less Depreciation Reported On Form 1125-A And Elsewhere On Return
a_1065_2023-Part3-Deductions:line16C-Depreciation	Money	Line 16C - Depreciation
a_1065_2023-Part3-Deductions:line17-Depletion(DoNotDeductOilAndGasDepletion)	Money	Line 17 - Depletion (Do Not Deduct Oil And Gas Depletion)
a_1065_2023-Part3-Deductions:line18-RetirementPlansEtc.	Money	Line 18 - Retirement Plans Etc.
a_1065_2023-Part3-Deductions:line19-EmployeeBenefitPrograms	Money	Line 19 - Employee Benefit Programs
a_1065_2023-Part3-Deductions:line20-EnergyEfficientCommercialBuildingsDeduction(AttachForm7205)	Money	Line 20 - Energy Efficient Commercial Buildings Deduction (Attach Form 7205)
a_1065_2023-Part3-Deductions:line21-OtherDeductions	Money	Line 21 - Other Deductions
a_1065_2023-Part3-Deductions:line22-TotalDeductions.AddAmountsShownInFarRightColumnForLines9Through21	Money	Line 22 - Total Deductions. Add Amounts Shown In Far Right Column For Lines 9 Through 21
a_1065_2023-Part3-Deductions:line23-OrdinaryBusinessIncome(Loss).SubtractLine22FromLine8	Money	Line 23 - Ordinary Business Income (Loss). Subtract Line 22 From Line 8
a_1065_2023-Part4-TaxAndPayment:line24-InterestDueUnderTheLook-BackMethod-CompletedLong-TermContracts	Money	Line 24 - Interest Due Under The Look-Back Method - Completed Long-Term Contracts
a_1065_2023-Part4-TaxAndPayment:line25-InterestDueUnderTheLook-BackMethod-IncomeForecastMethod	Money	Line 25 - Interest Due Under The Look-Back Method - Income Forecast Method
a_1065_2023-Part4-TaxAndPayment:line26-BbaAarImputedUnderpayment	Money	Line 26 - BBA AAR Imputed Underpayment
a_1065_2023-Part4-TaxAndPayment:line27-OtherTaxes	Money	Line 27 - Other Taxes
a_1065_2023-Part4-TaxAndPayment:line28-TotalBalanceDue.AddLines24Through27	Money	Line 28 - Total Balance Due. Add Lines 24 Through 27
a_1065_2023-Part4-TaxAndPayment:line29-ElectivePaymentElectionAmountFromForm3800	Money	Line 29 - Elective Payment Election Amount From Form 3800
a_1065_2023-Part4-TaxAndPayment:line30-Payment	Money	Line 30 - Payment
a_1065_2023-Part4-TaxAndPayment:line31-AmountOwed	Money	Line 31 - Amount Owed
a_1065_2023-Part4-TaxAndPayment:line32-Overpayment	Money	Line 32 - Overpayment
a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:signatureOfPartnerOrLimitedLiabilityCompanyMember	SIGNED, PRINTED	Signature Of Partner Or Limited Liability Company Member
a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:signHereDate	Date	Sign Here Date
a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:mayTheIrsDiscussThisReturnWithThePreparerShownBelow?:yes	CHECKED, NOT CHECKED	May The IRS Discuss This Return With The Preparer Shown Below?
a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:mayTheIrsDiscussThisReturnWithThePreparerShownBelow?:no	CHECKED, NOT CHECKED	May The IRS Discuss This Return With The Preparer Shown Below?
a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:print/typePreparer'SName	Text	Print/Type Preparer's Name
a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:preparer'sSignature	SIGNED, PRINTED	Preparer's Signature
a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:date	Date	Date
a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:checkIfSelf-Employed	CHECKED, NOT CHECKED	Check If Self-Employed
a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:ptin	Text	PTIN
a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:firm'sName	Text	Firm's Name
a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:firm'sAddress:addressLine1	Text	Firm's Address
a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:firm'sAddress:addressLine2	Text	Firm's Address
a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:firm'sAddress:city	Text	Firm's Address
a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:firm'sAddress:state	State	Firm's Address
a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:firm'sAddress:zip	ZIP Code	Firm's Address
a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:firm'sEin	EIN	Firm's EIN
a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:phoneNo.	Phone Number	Phone No.
Sample document
drive.google.com
A_1065_2023.pdf
Sample JSON result
JSON
{
  "pk": 45658071,
  "uuid": "7c0012db-9440-4d58-bb72-cd63f64bf005",
  "name": "A_1065_2023_API",
  "created": "2024-01-31T01:57:23Z",
  "created_ts": "2024-01-31T01:57:23Z",
  "verified_pages_count": 1,
  "book_status": "ACTIVE",
  "id": 45658071,
  "forms": [
    {
      "pk": 52738470,
      "uuid": "0e415dc4-82c6-4473-81f9-cb8527e8c7ff",
      "uploaded_doc_pk": 66223277,
      "form_type": "A_1065_2023",
      "raw_fields": {
        "a_1065_2023-Part2-Income:line1C-Balance": {
          "value": "2000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part3-Deductions:line13-Rent": {
          "value": "5000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part1-PartnershipDetails:year": {
          "value": "2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part3-Deductions:line12-BadDebts": {
          "value": "4000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part3-Deductions:line15-Interest": {
          "value": "7000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part4-TaxAndPayment:line30-Payment": {
          "value": "0.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part1-PartnershipDetails:address:zip": {
          "value": "12345-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part2-Income:line7-OtherIncome(Loss)": {
          "value": "5000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part1-PartnershipDetails:address:city": {
          "value": "SAMPLE CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part3-Deductions:line16C-Depreciation": {
          "value": "8000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part4-TaxAndPayment:line27-OtherTaxes": {
          "value": "4000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part4-TaxAndPayment:line31-AmountOwed": {
          "value": "0.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part1-PartnershipDetails:address:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part1-PartnershipDetails:f-TotalAssets": {
          "value": "50000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part4-TaxAndPayment:line32-Overpayment": {
          "value": "0.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part3-Deductions:line21-OtherDeductions": {
          "value": "13000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:date": {
          "value": "01/01/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:ptin": {
          "value": "P00001234",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part2-Income:line1A-GrossReceiptsOrSales": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part3-Deductions:line14-TaxesAndLicenses": {
          "value": "6000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part1-PartnershipDetails:nameOfPartnership": {
          "value": "SAMPLE SOFTWARE SERVICE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part3-Deductions:line18-RetirementPlansEtc.": {
          "value": "10000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:phoneNo.": {
          "value": "(800) 123-4567",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part1-PartnershipDetails:endingDateOfTaxYear": {
          "value": "12/31/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part2-Income:line1B-LessReturnsAndAllowances": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part2-Income:line6-NetGain(Loss)FromForm4797": {
          "value": "4000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:firm'sEin": {
          "value": "12-3456789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part1-PartnershipDetails:c-BusinessCodeNumber": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part3-Deductions:line11-RepairsAndMaintenance": {
          "value": "3000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:firm'sName": {
          "value": "SAMPLE MORTGAGE LLC",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part1-PartnershipDetails:address:addresssLine1": {
          "value": "123 FAKE MEMORIAL AVE.",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part1-PartnershipDetails:address:addresssLine2": {
          "value": "UNIT #1",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part1-PartnershipDetails:e-DateBusinessStarted": {
          "value": "12/01/2000",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part1-PartnershipDetails:beginningDateOfTaxYear": {
          "value": "01/01/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part1-PartnershipDetails:i-NumberOfSchedulesK-1": {
          "value": "1",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part3-Deductions:line19-EmployeeBenefitPrograms": {
          "value": "11000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:signHereDate": {
          "value": "01/01/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part1-PartnershipDetails:a-PrincipalBusinessActivity": {
          "value": "SOFWARE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part1-PartnershipDetails:b-PrincipalProductOrService": {
          "value": "SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part2-Income:line2-CostOfGoodsSold(AttachForm1125-A)": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part3-Deductions:line10-GuaranteedPaymentsToPartners": {
          "value": "2000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part4-TaxAndPayment:line26-BbaAarImputedUnderpayment": {
          "value": "3000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:firm'sAddress:zip": {
          "value": "12345-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:firm'sAddress:city": {
          "value": "SAMPLE CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part2-Income:line3-GrossProfit.SubtractLine2FromLine1C": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:firm'sAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:preparer'sSignature": {
          "value": "SIGNED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part1-PartnershipDetails:d-EmployerIdentificationNumber": {
          "value": "12-3456789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:checkIfSelf-Employed": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part1-PartnershipDetails:h-CheckAccountingMethod:(1)Cash": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part2-Income:line8-TotalIncome(Loss).CombineLines3Through7": {
          "value": "15000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part1-PartnershipDetails:h-CheckAccountingMethod:(2)Accrual": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:print/typePreparer'SName": {
          "value": "JOHN SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part1-PartnershipDetails:g-CheckApplicableBoxes:(3)NameChange": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part1-PartnershipDetails:j-CheckIfSchedulesCAndM-3AreAttached": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:firm'sAddress:addressLine1": {
          "value": "123 SAMPLE STREET AVE.",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:firm'sAddress:addressLine2": {
          "value": "SUITE #12",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part1-PartnershipDetails:g-CheckApplicableBoxes:(2)FinalReturn": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part4-TaxAndPayment:line28-TotalBalanceDue.AddLines24Through27": {
          "value": "10000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part3-Deductions:line16A-Depreciation(IfRequiredAttachForm4562)": {
          "value": "4000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part1-PartnershipDetails:g-CheckApplicableBoxes:(1)InitialReturn": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part1-PartnershipDetails:g-CheckApplicableBoxes:(4)AddressChange": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part1-PartnershipDetails:g-CheckApplicableBoxes:(5)AmendedReturn": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part3-Deductions:line17-Depletion(DoNotDeductOilAndGasDepletion)": {
          "value": "9000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part2-Income:line5-NetFarmProfit(Loss)(AttachScheduleF(Form1040))": {
          "value": "3000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part1-PartnershipDetails:h-CheckAccountingMethod:(3)Other(Specify)": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part4-TaxAndPayment:line29-ElectivePaymentElectionAmountFromForm3800": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part1-PartnershipDetails:address:provinceAndCountryAndForeignPostalCode": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part1-PartnershipDetails:h-CheckAccountingMethod:(3)Other(Specify)-Detail": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part2-Income:line4-OrdinaryIncome(Loss)FromOtherPartnershipsEstatesAndTrusts": {
          "value": "2000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part3-Deductions:line23-OrdinaryBusinessIncome(Loss).SubtractLine22FromLine8": {
          "value": "-76000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part3-Deductions:line16B-LessDepreciationReportedOnForm1125-AAndElsewhereOnReturn": {
          "value": "4000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part4-TaxAndPayment:line25-InterestDueUnderTheLook-BackMethod-IncomeForecastMethod": {
          "value": "2000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part3-Deductions:line20-EnergyEfficientCommercialBuildingsDeduction(AttachForm7205)": {
          "value": "12000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part3-Deductions:line9-SalariesAndWages(OtherThanToPartners)(LessEmploymentCredits)": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:signatureOfPartnerOrLimitedLiabilityCompanyMember": {
          "value": "SIGNED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part3-Deductions:line22-TotalDeductions.AddAmountsShownInFarRightColumnForLines9Through21": {
          "value": "91000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part4-TaxAndPayment:line24-InterestDueUnderTheLook-BackMethod-CompletedLong-TermContracts": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:mayTheIrsDiscussThisReturnWithThePreparerShownBelow?:no": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part5-SignHere/PaidPreparerUseOnly:mayTheIrsDiscussThisReturnWithThePreparerShownBelow?:yes": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part1-PartnershipDetails:k-CheckIfPartnership:(1)AggregatedActivitiesForSection465At-RiskPurposes": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        },
        "a_1065_2023-Part1-PartnershipDetails:k-CheckIfPartnership:(2)GroupedActivitiesForSection469PassiveActivityPurposes": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "1065 2023.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 379883,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

IRS Form 1065 (2022) - U.S. Return of Partnership Income
1065 (2024) - U.S. Return of Partnership Income
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