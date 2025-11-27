# IRS Form 1040 Schedule C (2021) - Profit or Loss From Business

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
IRS Form 1040 Schedule C (2021) - Profit or Loss From Business
Suggest Edits

This form is used to report income or losses arising from a business operated by the taxpayer or a profession practiced as a sole proprietor. To classify an activity as a business for the purpose of this form, two key criteria must be met:

The primary intent of the taxpayer in engaging in the activity should be to generate income or profit.
The taxpayer must be actively involved in the activity with a sense of regularity and continuity.

To use the Upload PDF endpoint for this document, you must use A_1040_SCHEDULE_C_2021 in the form_type parameter.

SCHEDULE C

The document type A_1040_SCHEDULE_C_2021 supports data capture from the IRS 1040 Schedule C only. The first two pages of the document 1040 are processed as a separate document type.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
a_1040_schedule_c_2021-General:year	Text	Year
a_1040_schedule_c_2021-General:nameOfProprietor	Text	Name Of Proprietor
a_1040_schedule_c_2021-General:socialSecurityNumber(Ssn)	Social Security Number	Social Security Number (SSN)
a_1040_schedule_c_2021-General:a-PrincipalBusinessOrProfessionIncludingProductOrService	Text	A - Principal Business Or Profession Including Product Or Service
a_1040_schedule_c_2021-General:b-EnterCodeFromInstructions	Text	B - Enter Code From Instructions
a_1040_schedule_c_2021-General:c-BusinessName	Text	C - Business Name
a_1040_schedule_c_2021-General:d-EmployerIdNumber(Ein)	Text	D - Employer ID Number (EIN)
a_1040_schedule_c_2021-General:e-BusinessAddress:addressLine1	Text	E - Business Address
a_1040_schedule_c_2021-General:e-BusinessAddress:addressLine2	Text	E - Business Address
a_1040_schedule_c_2021-General:e-BusinessAddress:city	Text	E - Business Address
a_1040_schedule_c_2021-General:e-BusinessAddress:state	State	E - Business Address
a_1040_schedule_c_2021-General:e-BusinessAddress:zip	ZIP Code	E - Business Address
a_1040_schedule_c_2021-General:f-AccountingMethod	1 - CASH, 2 - ACCRUAL, 3 - OTHER	F - Accounting Method
a_1040_schedule_c_2021-General:f-AccountingMethod(SpecifyIfOther)	Text	F - Accounting Method (Specify If Other)
a_1040_schedule_c_2021-General:g-DidYouMateriallyParticipateInTheOperationOfThisBusinessDuringThisYear?	YES, NO	G - Did You Materially Participate In The Operation Of This Business During This Year?
a_1040_schedule_c_2021-General:h-IfYouStartedOrAcquiredThisBusinessDuringThisYearCheckHere	CHECKED, NOT CHECKED	H - If You Started Or Acquired This Business During This Year Check Here
a_1040_schedule_c_2021-General:i-DidYouMakeAnyPaymentsInThisYearThatWouldRequireYouToFileForm(S)1099?	YES, NO	I - Did You Make Any Payments In This Year That Would Require You To File Form(s) 1099?
a_1040_schedule_c_2021-General:j-IfYesDidYouOrWillYouFileRequiredForms1099?	YES, NO	J - If Yes Did You Or Will You File Required Forms 1099?
a_1040_schedule_c_2021-Part1-Income:line1-GrossReceiptsOrSales	Money	Line 1 - Gross Receipts Or Sales
a_1040_schedule_c_2021-Part1-Income:line1-CheckBox	CHECKED, NOT CHECKED	Line 1 - Check Box
a_1040_schedule_c_2021-Part1-Income:line2-ReturnsAndAllowances	Money	Line 2 - Returns And Allowances
a_1040_schedule_c_2021-Part1-Income:line3-SubtractLine2FromLine1	Money	Line 3 - Subtract Line 2 From Line 1
a_1040_schedule_c_2021-Part1-Income:line4-CostOfGoodsSold	Money	Line 4 - Cost Of Goods Sold
a_1040_schedule_c_2021-Part1-Income:line5-GrossProfit	Money	Line 5 - Gross Profit
a_1040_schedule_c_2021-Part1-Income:line6-OtherIncome-IncludingFederalAndState	Money	Line 6 - Other Income - Including Federal And State
a_1040_schedule_c_2021-Part1-Income:line7-GrossIncome	Money	Line 7 - Gross Income
a_1040_schedule_c_2021-Part2-Expenses:line8-Advertising	Money	Line 8 - Advertising
a_1040_schedule_c_2021-Part2-Expenses:line9-CarAndTruckExpenses	Money	Line 9 - Car And Truck Expenses
a_1040_schedule_c_2021-Part2-Expenses:line10-CommissionsAndFees	Money	Line 10 - Commissions And Fees
a_1040_schedule_c_2021-Part2-Expenses:line11-ContractLabor	Money	Line 11 - Contract Labor
a_1040_schedule_c_2021-Part2-Expenses:line12-Depletion	Money	Line 12 - Depletion
a_1040_schedule_c_2021-Part2-Expenses:line13-DepreciationAndSection179ExpenseDeduction	Money	Line 13 - Depreciation And Section 179 Expense Deduction
a_1040_schedule_c_2021-Part2-Expenses:line14-EmployeeBenefitPrograms	Money	Line 14 - Employee Benefit Programs
a_1040_schedule_c_2021-Part2-Expenses:line15-Insurance(OtherThanHealth)	Money	Line 15 - Insurance (Other Than Health)
a_1040_schedule_c_2021-Part2-Expenses:line16A-Interest-Mortgage(PaidToBanksEtc)	Money	Line 16A - Interest - Mortgage (Paid To Banks Etc)
a_1040_schedule_c_2021-Part2-Expenses:line16B-Interest-Other	Money	Line 16B - Interest - Other
a_1040_schedule_c_2021-Part2-Expenses:line17-LegalAndProfessionalServices	Money	Line 17 - Legal And Professional Services
a_1040_schedule_c_2021-Part2-Expenses:line18-OfficeExpense	Money	Line 18 - Office Expense
a_1040_schedule_c_2021-Part2-Expenses:line19-PensionAndProfit-SharingPlans	Money	Line 19 - Pension And Profit-Sharing Plans
a_1040_schedule_c_2021-Part2-Expenses:line20A-RentOrLease-VehiclesMachineryAndEquipment	Money	Line 20A - Rent Or Lease - Vehicles Machinery And Equipment
a_1040_schedule_c_2021-Part2-Expenses:line20B-RentOrLease-OtherBusinessProperty	Money	Line 20B - Rent Or Lease - Other Business Property
a_1040_schedule_c_2021-Part2-Expenses:line21-RepairsAndMaintenance	Money	Line 21 - Repairs And Maintenance
a_1040_schedule_c_2021-Part2-Expenses:line22-Supplies	Money	Line 22 - Supplies
a_1040_schedule_c_2021-Part2-Expenses:line23-TaxesAndLicenses	Money	Line 23 - Taxes And Licenses
a_1040_schedule_c_2021-Part2-Expenses:line24A-TravelAndMeals-Travel	Money	Line 24A - Travel And Meals - Travel
a_1040_schedule_c_2021-Part2-Expenses:line24B-TravelAndMeals-DeductibleMeals	Money	Line 24B - Travel And Meals - Deductible Meals
a_1040_schedule_c_2021-Part2-Expenses:line25-Utilities	Money	Line 25 - Utilities
a_1040_schedule_c_2021-Part2-Expenses:line26-Wages(LessEmploymentCredits)	Money	Line 26 - Wages (Less Employment Credits)
a_1040_schedule_c_2021-Part2-Expenses:line27A-OtherExpenses	Money	Line 27A - Other Expenses
a_1040_schedule_c_2021-Part2-Expenses:line27B-ReservedForFutureUse	Text	Line 27B - Reserved For Future Use
a_1040_schedule_c_2021-Part2-Expenses:line28-TotalExpenses	Money	Line 28 - Total Expenses
a_1040_schedule_c_2021-Part2-Expenses:line29-TentativeProfitOr(Loss)	Money	Line 29 - Tentative Profit Or (Loss)
a_1040_schedule_c_2021-Part2-Expenses:line30-ExpensesForBusinessUseOfYourHome	Money	Line 30 - Expenses For Business Use Of Your Home
a_1040_schedule_c_2021-Part2-Expenses:line30A-TotalSquareFootageOfYourHome	Text	Line 30A - Total Square Footage Of Your Home
a_1040_schedule_c_2021-Part2-Expenses:line30B-TotalSquareFootageOfThePartOfYourHomeUsedForBusiness	Text	Line 30B - Total Square Footage Of The Part Of Your Home Used For Business
a_1040_schedule_c_2021-Part2-Expenses:line31-NetProfitOr(Loss)	Money	Line 31 - Net Profit Or (Loss)
a_1040_schedule_c_2021-Part2-Expenses:line32A-CheckBox-AllInvestmentIsAtRisk	CHECKED, NOT CHECKED	Line 32A - Check Box - All Investment Is At Risk
a_1040_schedule_c_2021-Part2-Expenses:line32B-CheckBox-SomeInvestmentIsNotAtRisk	CHECKED, NOT CHECKED	Line 32B - Check Box - Some Investment Is Not At Risk
a_1040_schedule_c_2021-Part3-CostOfGoodsSold:line33-Method(S)UsedToValueClosingInventory	COST, LOWER OF COST OR MARKET, OTHER	Line 33 - Method(s) Used To Value Closing Inventory
a_1040_schedule_c_2021-Part3-CostOfGoodsSold:line34-WasThereAnyChangeInDeterminingQuantitiesCostsOrValuationsInventory?	YES, NO	Line 34 - Was There Any Change In Determining Quantities Costs Or Valuations Inventory?
a_1040_schedule_c_2021-Part3-CostOfGoodsSold:line35-InventoryAtBegininngOfYear	Money	Line 35 - Inventory At Begininng Of Year
a_1040_schedule_c_2021-Part3-CostOfGoodsSold:line36-PurchasesLessCostOfItemsWithdrawnForPersonalUse	Money	Line 36 - Purchases Less Cost Of Items Withdrawn For Personal Use
a_1040_schedule_c_2021-Part3-CostOfGoodsSold:line37-CostOfLabor	Money	Line 37 - Cost Of Labor
a_1040_schedule_c_2021-Part3-CostOfGoodsSold:line38-MaterialsAndSupplies	Money	Line 38 - Materials And Supplies
a_1040_schedule_c_2021-Part3-CostOfGoodsSold:line39-OtherCosts	Money	Line 39 - Other Costs
a_1040_schedule_c_2021-Part3-CostOfGoodsSold:line40-AddLines35Through39	Money	Line 40 - Add Lines 35 Through 39
a_1040_schedule_c_2021-Part3-CostOfGoodsSold:line41-InventoryAtEndOfYear	Money	Line 41 - Inventory At End Of Year
a_1040_schedule_c_2021-Part3-CostOfGoodsSold:line42-CostOfGoodsSold	Money	Line 42 - Cost Of Goods Sold
a_1040_schedule_c_2021-Part4-InformationOnYourVehicle:line43-WhenDidYouPlaceYourVehicleInServiceForBusinessPurposes?	Date	Line 43 - When Did You Place Your Vehicle In Service For Business Purposes?
a_1040_schedule_c_2021-Part4-InformationOnYourVehicle:line44A-Business	Text	Line 44A - Business
a_1040_schedule_c_2021-Part4-InformationOnYourVehicle:line44B-Commuting	Text	Line 44B - Commuting
a_1040_schedule_c_2021-Part4-InformationOnYourVehicle:line44C-Other	Text	Line 44C - Other
a_1040_schedule_c_2021-Part4-InformationOnYourVehicle:line45-WasYourVehicleAvailableForPersonalUseDuringOff-DutyHours?	YES, NO	Line 45 - Was Your Vehicle Available For Personal Use During Off-Duty Hours?
a_1040_schedule_c_2021-Part4-InformationOnYourVehicle:line46-DoYou(OrYourSpouse)HaveAnotherVehicleAvailableForPersonalUse?	YES, NO	Line 46 - Do You (Or Your Spouse) Have Another Vehicle Available For Personal Use?
a_1040_schedule_c_2021-Part4-InformationOnYourVehicle:line47A-DoYouHaveEvidenceToSupportYourDeduction?	YES, NO	Line 47A - Do You Have Evidence To Support Your Deduction?
a_1040_schedule_c_2021-Part4-InformationOnYourVehicle:line47B-IfYesIsTheEvidenceWritten?	YES, NO	Line 47B - If Yes Is The Evidence Written?
a_1040_schedule_c_2021-Part5-OtherExpenses:otherExpenses1-Description	Text	Other Expenses 1 - Description
a_1040_schedule_c_2021-Part5-OtherExpenses:otherExpenses1-Amount	Money	Other Expenses 1 - Amount
a_1040_schedule_c_2021-Part5-OtherExpenses:otherExpenses2-Description	Text	Other Expenses 2 - Description
a_1040_schedule_c_2021-Part5-OtherExpenses:otherExpenses2-Amount	Money	Other Expenses 2 - Amount
a_1040_schedule_c_2021-Part5-OtherExpenses:otherExpenses3-Description	Text	Other Expenses 3 - Description
a_1040_schedule_c_2021-Part5-OtherExpenses:otherExpenses3-Amount	Money	Other Expenses 3 - Amount
a_1040_schedule_c_2021-Part5-OtherExpenses:otherExpenses4-Description	Text	Other Expenses 4 - Description
a_1040_schedule_c_2021-Part5-OtherExpenses:otherExpenses4-Amount	Money	Other Expenses 4 - Amount
a_1040_schedule_c_2021-Part5-OtherExpenses:otherExpenses5-Description	Text	Other Expenses 5 - Description
a_1040_schedule_c_2021-Part5-OtherExpenses:otherExpenses5-Amount	Money	Other Expenses 5 - Amount
a_1040_schedule_c_2021-Part5-OtherExpenses:otherExpenses6-Description	Text	Other Expenses 6 - Description
a_1040_schedule_c_2021-Part5-OtherExpenses:otherExpenses6-Amount	Money	Other Expenses 6 - Amount
a_1040_schedule_c_2021-Part5-OtherExpenses:otherExpenses7-Description	Text	Other Expenses 7 - Description
a_1040_schedule_c_2021-Part5-OtherExpenses:otherExpenses7-Amount	Money	Other Expenses 7 - Amount
a_1040_schedule_c_2021-Part5-OtherExpenses:otherExpenses8-Description	Text	Other Expenses 8 - Description
a_1040_schedule_c_2021-Part5-OtherExpenses:otherExpenses8-Amount	Money	Other Expenses 8 - Amount
a_1040_schedule_c_2021-Part5-OtherExpenses:otherExpenses9-Description	Text	Other Expenses 9 - Description
a_1040_schedule_c_2021-Part5-OtherExpenses:otherExpenses9-Amount	Money	Other Expenses 9 - Amount
a_1040_schedule_c_2021-Part5-OtherExpenses:line48-TotalOtherExpenses	Money	Line 48 - Total Other Expenses
a_1040_schedule_c_2021-Part2-Expenses:line27A-OtherExpenses-Details	Text	Line 27A - Other Expenses - Details
Sample document

Coming soon...

Sample JSON result
JSON
{
    "pk": 35184555,
    "forms": [
        {
            "form_pk": 33452263,
            "type": "A_1040_SCHEDULE_C_2021",
            "pages": [
                {
                    "page_idx": 0,
                    "uploaded_doc_pk": 35184555,
                    "fields": {
                        "Year": {
                            "value": "2021",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "C - Business Name": {
                            "value": "DANIEL DAVIS",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Name Of Proprietor": {
                            "value": "LUCAS MILLER",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "F - Accounting Method": {
                            "value": "1 - CASH",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 1 - Check Box": {
                            "value": "NOT CHECKED",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "E - Business Address Zip": {
                            "value": "10201-2452",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "E - Business Address City": {
                            "value": "CHICOPEE",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 5 - Gross Profit": {
                            "value": "850.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 7 - Gross Income": {
                            "value": "3850.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 22 - Supplies": {
                            "value": "150.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "D - Employer ID Number (EIN)": {
                            "value": "154364564",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "E - Business Address State": {
                            "value": "MA",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 12 - Depletion": {
                            "value": "50.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 25 - Utilities": {
                            "value": "100.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 8 - Advertising": {
                            "value": "50.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Social Security Number (SSN)": {
                            "value": "507-64-2541",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 4 - Cost Of Goods Sold": {
                            "value": "1650.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "B - Enter Code From Instructions": {
                            "value": "202965",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 11 - Contract Labor": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 18 - Office Expense": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 28 - Total Expenses": {
                            "value": "2750.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 27A - Other Expenses": {
                            "value": "1900.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 16B - Interest - Other": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "E - Business Address Address Line 1": {
                            "value": "591 MEMORIAL DR",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "E - Business Address Address Line 2": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 23 - Taxes And Licenses": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 1 - Gross Receipts Or Sales": {
                            "value": "3000.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 2 - Returns And Allowances": {
                            "value": "500.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 31 - Net Profit Or (Loss)": {
                            "value": "800.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 10 - Commissions And Fees": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 9 - Car And Truck Expenses": {
                            "value": "50.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 3 - Subtract Line 2 From Line 1": {
                            "value": "2500.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "F - Accounting Method (Specify If Other)": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 21 - Repairs And Maintenance": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 27B - Reserved For Future Use": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 24A - Travel And Meals - Travel": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 14 - Employee Benefit Programs": {
                            "value": "100.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 29 - Tentative Profit Or (Loss)": {
                            "value": "1100.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 15 - Insurance (Other Than Health)": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 17 - Legal And Professional Services": {
                            "value": "100.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 26 - Wages (Less Employment Credits)": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 19 - Pension And Profit-Sharing Plans": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 30A - Total Square Footage Of Your Home": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "J - If Yes Did You Or Will You File Required Forms 1099?": {
                            "value": "NO",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 24B - Travel And Meals - Deductible Meals": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 32A - Check Box - All Investment Is At Risk": {
                            "value": "NOT CHECKED",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 30 - Expenses For Business Use Of Your Home": {
                            "value": "300.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 6 - Other Income - Including Federal And State": {
                            "value": "3000.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 16A - Interest - Mortgage (Paid To Banks Etc)": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 20B - Rent Or Lease - Other Business Property": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 32B - Check Box - Some Investment Is Not At Risk": {
                            "value": "NOT CHECKED",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 13 - Depreciation And Section 179 Expense Deduction": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "A - Principal Business Or Profession Including Product Or Service": {
                            "value": "DAYCARE OPERATOR",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 20A - Rent Or Lease - Vehicles Machinery And Equipment": {
                            "value": "250.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "H - If You Started Or Acquired This Business During This Year Check Here": {
                            "value": "NOT CHECKED",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 30B - Total Square Footage Of The Part Of Your Home Used For Business": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "I - Did You Make Any Payments In This Year That Would Require You To File Form(s) 1099?": {
                            "value": "NO",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "G - Did You Materially Participate In The Operation Of This Business During This Year?": {
                            "value": "YES",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        }
                    },
                    "other_frauds": []
                },
                {
                    "page_idx": 1,
                    "uploaded_doc_pk": 35184555,
                    "fields": {
                        "Line 39 - Other Costs": {
                            "value": "550.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 37 - Cost Of Labor": {
                            "value": "1000.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Other Expenses 1 - Amount": {
                            "value": "50.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Other Expenses 2 - Amount": {
                            "value": "100.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Other Expenses 3 - Amount": {
                            "value": "650.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Other Expenses 4 - Amount": {
                            "value": "450.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Other Expenses 5 - Amount": {
                            "value": "650.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Other Expenses 6 - Amount": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Other Expenses 7 - Amount": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Other Expenses 8 - Amount": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Other Expenses 9 - Amount": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 42 - Cost Of Goods Sold": {
                            "value": "1650.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 44C - Other": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 48 - Total Other Expenses": {
                            "value": "1900.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Other Expenses 1 - Description": {
                            "value": "BANK CHARGES",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Other Expenses 2 - Description": {
                            "value": "DUES & SUBSCRIPTIONS",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Other Expenses 3 - Description": {
                            "value": "MEMBERSHIP",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Other Expenses 4 - Description": {
                            "value": "POSTAGE & DELIVERY",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Other Expenses 5 - Description": {
                            "value": "SMALL TOOLS & EQUIPMENT",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Other Expenses 6 - Description": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Other Expenses 7 - Description": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Other Expenses 8 - Description": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Other Expenses 9 - Description": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 44A - Business": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 40 - Add Lines 35 Through 39": {
                            "value": "5650.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 44B - Commuting": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 38 - Materials And Supplies": {
                            "value": "500.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 41 - Inventory At End Of Year": {
                            "value": "4000.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 35 - Inventory At Begininng Of Year": {
                            "value": "3000.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 33 - Method(s) Used To Value Closing Inventory": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 47B - If Yes Is The Evidence Written?": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 36 - Purchases Less Cost Of Items Withdrawn For Personal Use": {
                            "value": "600.00",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 47A - Do You Have Evidence To Support Your Deduction?": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 43 - When Did You Place Your Vehicle In Service For Business Purposes?": {
                            "value": "11/09/2021",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 45 - Was Your Vehicle Available For Personal Use During Off-Duty Hours?": {
                            "value": "NO",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 34 - Was There Any Change In Determining Quantities Costs Or Valuations Inventory?": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 46 - Do You (Or Your Spouse) Have Another Vehicle Available For Personal Use?": {
                            "value": "",
                            "is_empty": true,
                            "alias_used": null,
                            "page_doc_pk": 172813543,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        },
                        "Line 27A - Other Expenses - Details": {
                            "value": "FROM LINE 48",
                            "is_empty": false,
                            "alias_used": null,
                            "page_doc_pk": 172813544,
                            "source_filename": "Sample 1 - 2021 Schedule C (Form 1040).pdf"
                        }
                    },
                    "other_frauds": []
                }
            ],
            "tables": []
        }
    ]
}


Updated 10 months ago

IRS Form 1040 Schedule C (2020) - Profit or Loss From Business
IRS Form 1040 Schedule C (2022) - Profit or Loss From Business
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