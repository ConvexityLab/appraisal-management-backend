# HUD-1 Settlement Statement

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
Getting started with supported documents
All supported documents
Assets
Closing
HUD-1 Settlement Statement
Disclosure
Identification
Income/Employment
Legal
Mortgage specific forms
Other
Property
Tax forms
Data types
HUD-1 Settlement Statement
Suggest Edits

A document that lists all charges and credits to the buyer and to the seller in a real estate settlement, or all the charges in a mortgage refinance.

To use the Upload PDF endpoint for this document, you must use HUD_1_SETTLEMENT_STATEMENT in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
hud_1_settlement_statement-Part01-B.TypeOfLoan:line1-Fha	CHECKED, NOT CHECKED	Line 1 - FHA
hud_1_settlement_statement-Part01-B.TypeOfLoan:line2-Rhs	CHECKED, NOT CHECKED	Line 2 - RHS
hud_1_settlement_statement-Part01-B.TypeOfLoan:line3-Conv.Unins.	CHECKED, NOT CHECKED	Line 3 - Conv. Unins.
hud_1_settlement_statement-Part01-B.TypeOfLoan:line4-Va	CHECKED, NOT CHECKED	Line 4 - VA
hud_1_settlement_statement-Part01-B.TypeOfLoan:line5-Conv.Ins.	CHECKED, NOT CHECKED	Line 5 - Conv. Ins.
hud_1_settlement_statement-Part01-B.TypeOfLoan:line6-FileNumber	Text	Line 6 - File Number
hud_1_settlement_statement-Part01-B.TypeOfLoan:line7-LoanNumber	Text	Line 7 - Loan Number
hud_1_settlement_statement-Part01-B.TypeOfLoan:line8-MortgageInsuranceCaseNumber	Text	Line 8 - Mortgage Insurance Case Number
hud_1_settlement_statement-Part02-General:c.Note:description	Text	C. Note
hud_1_settlement_statement-Part02-General:d.Name&AddressOfBorrower:borrowerName	Text	D. Name & Address Of Borrower
hud_1_settlement_statement-Part02-General:d.Name&AddressOfBorrower:addressLine1	Text	D. Name & Address Of Borrower
hud_1_settlement_statement-Part02-General:d.Name&AddressOfBorrower:addressLine2	Text	D. Name & Address Of Borrower
hud_1_settlement_statement-Part02-General:d.Name&AddressOfBorrower:city	Text	D. Name & Address Of Borrower
hud_1_settlement_statement-Part02-General:d.Name&AddressOfBorrower:state	State	D. Name & Address Of Borrower
hud_1_settlement_statement-Part02-General:d.Name&AddressOfBorrower:zip	ZIP Code	D. Name & Address Of Borrower
hud_1_settlement_statement-Part02-General:e.Name&AddressOfSeller:sellerName	Text	E. Name & Address Of Seller
hud_1_settlement_statement-Part02-General:e.Name&AddressOfSeller:addressLine1	Text	E. Name & Address Of Seller
hud_1_settlement_statement-Part02-General:e.Name&AddressOfSeller:addressLine2	Text	E. Name & Address Of Seller
hud_1_settlement_statement-Part02-General:e.Name&AddressOfSeller:city	Text	E. Name & Address Of Seller
hud_1_settlement_statement-Part02-General:e.Name&AddressOfSeller:state	State	E. Name & Address Of Seller
hud_1_settlement_statement-Part02-General:e.Name&AddressOfSeller:zip	ZIP Code	E. Name & Address Of Seller
hud_1_settlement_statement-Part02-General:f.Name&AddressOfLender:lenderName	Text	F. Name & Address Of Lender
hud_1_settlement_statement-Part02-General:f.Name&AddressOfLender:addressLine1	Text	F. Name & Address Of Lender
hud_1_settlement_statement-Part02-General:f.Name&AddressOfLender:addressLine2	Text	F. Name & Address Of Lender
hud_1_settlement_statement-Part02-General:f.Name&AddressOfLender:city	Text	F. Name & Address Of Lender
hud_1_settlement_statement-Part02-General:f.Name&AddressOfLender:state	State	F. Name & Address Of Lender
hud_1_settlement_statement-Part02-General:f.Name&AddressOfLender:zip	ZIP Code	F. Name & Address Of Lender
hud_1_settlement_statement-Part02-General:g.PropertyLocation:addressLine1	Text	G. Property Location
hud_1_settlement_statement-Part02-General:g.PropertyLocation:addressLine2	Text	G. Property Location
hud_1_settlement_statement-Part02-General:g.PropertyLocation:city	Text	G. Property Location
hud_1_settlement_statement-Part02-General:g.PropertyLocation:state	State	G. Property Location
hud_1_settlement_statement-Part02-General:g.PropertyLocation:zip	ZIP Code	G. Property Location
hud_1_settlement_statement-Part02-General:h.SettlementAgent	Text	H. Settlement Agent
hud_1_settlement_statement-Part02-General:phoneNumber	Phone Number	Phone Number
hud_1_settlement_statement-Part02-General:placeOfSettlement:addressLine1	Text	Place Of Settlement
hud_1_settlement_statement-Part02-General:placeOfSettlement:addressLine2	Text	Place Of Settlement
hud_1_settlement_statement-Part02-General:placeOfSettlement:city	Text	Place Of Settlement
hud_1_settlement_statement-Part02-General:placeOfSettlement:state	State	Place Of Settlement
hud_1_settlement_statement-Part02-General:placeOfSettlement:zip	ZIP Code	Place Of Settlement
hud_1_settlement_statement-Part02-General:i.SettlementDate	Date	I. Settlement Date
hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-GrossAmountDueFromBorrower:line101-ContractSalesPrice-Amount	Money	Section 100 - Gross Amount Due From Borrower
hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-GrossAmountDueFromBorrower:line102-PersonalProperty-Amount	Money	Section 100 - Gross Amount Due From Borrower
hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-GrossAmountDueFromBorrower:line103-SettlementChargesToBorrower(Line1400)-Amount	Money	Section 100 - Gross Amount Due From Borrower
hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-GrossAmountDueFromBorrower:line104-Description	Text	Section 100 - Gross Amount Due From Borrower
hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-GrossAmountDueFromBorrower:line104-Amount	Money	Section 100 - Gross Amount Due From Borrower
hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-GrossAmountDueFromBorrower:line105-Description	Text	Section 100 - Gross Amount Due From Borrower
hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-GrossAmountDueFromBorrower:line105-Amount	Money	Section 100 - Gross Amount Due From Borrower
hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line106-City/TownTaxes-DateFrom	Date	Section 100 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line106-City/TownTaxes-DateTo	Date	Section 100 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line106-City/TownTaxes-Amount	Money	Section 100 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line107-CountyTaxes-DateFrom	Date	Section 100 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line107-CountyTaxes-DateTo	Date	Section 100 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line107-CountyTaxes-Amount	Money	Section 100 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line108-Assessments-DateFrom	Date	Section 100 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line108-Assessments-DateTo	Date	Section 100 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line108-Assessments-Amount	Money	Section 100 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line109-Description	Text	Section 100 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line109-Amount	Money	Section 100 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line110-Description	Text	Section 100 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line110-Amount	Money	Section 100 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line111-Description	Text	Section 100 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line111-Amount	Money	Section 100 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line112-Description	Text	Section 100 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line112-Amount	Money	Section 100 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:line120-GrossAmountDueFromBorrower-Amount	Money	Line 120 - Gross Amount Due From Borrower - Amount
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line201-DepositOrEarnestMoney-Amount	Money	Section 200 - Amount Paid By Or In Behalf Of Borrower
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line202-PrincipalAmountOfNewLoan(S)-Description	Text	Section 200 - Amount Paid By Or In Behalf Of Borrower
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line202-PrincipalAmountOfNewLoan(S)-Amount	Money	Section 200 - Amount Paid By Or In Behalf Of Borrower
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line203-ExistingLoan(S)TakenSubjectTo-Amount	Money	Section 200 - Amount Paid By Or In Behalf Of Borrower
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line204-Description	Text	Section 200 - Amount Paid By Or In Behalf Of Borrower
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line204-Amount	Money	Section 200 - Amount Paid By Or In Behalf Of Borrower
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line205-Description	Text	Section 200 - Amount Paid By Or In Behalf Of Borrower
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line205-Amount	Money	Section 200 - Amount Paid By Or In Behalf Of Borrower
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line206-Description	Text	Section 200 - Amount Paid By Or In Behalf Of Borrower
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line206-Amount	Money	Section 200 - Amount Paid By Or In Behalf Of Borrower
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line207-Description	Text	Section 200 - Amount Paid By Or In Behalf Of Borrower
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line207-Amount	Money	Section 200 - Amount Paid By Or In Behalf Of Borrower
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line208-Description	Text	Section 200 - Amount Paid By Or In Behalf Of Borrower
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line208-Amount	Money	Section 200 - Amount Paid By Or In Behalf Of Borrower
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line209-Description	Text	Section 200 - Amount Paid By Or In Behalf Of Borrower
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line209-Amount	Money	Section 200 - Amount Paid By Or In Behalf Of Borrower
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line210-City/TownTaxes-DateFrom	Date	Section 200 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line210-City/TownTaxes-DateTo	Date	Section 200 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line210-City/TownTaxes-Amount	Money	Section 200 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line211-CountyTaxes-DateFrom	Date	Section 200 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line211-CountyTaxes-DateTo	Date	Section 200 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line211-CountyTaxes-Amount	Money	Section 200 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line212-Assessments-DateFrom	Date	Section 200 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line212-Assessments-DateTo	Date	Section 200 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line212-Assessments-Amount	Money	Section 200 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line213-Description	Text	Section 200 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line213-Amount	Money	Section 200 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line214-Description	Text	Section 200 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line214-Amount	Money	Section 200 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line215-Description	Text	Section 200 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line215-Amount	Money	Section 200 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line216-Description	Text	Section 200 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line216-Amount	Money	Section 200 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line217-Description	Text	Section 200 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line217-Amount	Money	Section 200 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line218-Description	Text	Section 200 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line218-Amount	Money	Section 200 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line219-Description	Text	Section 200 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line219-Amount	Money	Section 200 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:line220-TotalPaidBy/ForBorrower-Amount	Money	Line 220 - Total Paid By/For Borrower - Amount
hud_1_settlement_statement-Part05-J.SummaryOfBorrower'STransaction:section300-CashAtSettlementFrom/ToBorrower:line301-GrossAmountDueFromBorrower(Line120)-Amount	Money	Section 300 - Cash At Settlement From/To Borrower
hud_1_settlement_statement-Part05-J.SummaryOfBorrower'STransaction:section300-CashAtSettlementFrom/ToBorrower:line302-LessAmountsPaidBy/ForBorrower(Line220)-Amount	Money	Section 300 - Cash At Settlement From/To Borrower
hud_1_settlement_statement-Part05-J.SummaryOfBorrower'STransaction:section300-CashAtSettlementFrom/ToBorrower:line303-Cash-Checkbox	CASH FROM, TO BORROWER	Section 300 - Cash At Settlement From/To Borrower
hud_1_settlement_statement-Part05-J.SummaryOfBorrower'STransaction:section300-CashAtSettlementFrom/ToBorrower:line303-Cash-Amount	Money	Section 300 - Cash At Settlement From/To Borrower
hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-GrossAmountDueToSeller:line401-ContractSalesPrice-Amount	Money	Section 400 - Gross Amount Due To Seller
hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-GrossAmountDueToSeller:line402-PersonalProperty-Amount	Money	Section 400 - Gross Amount Due To Seller
hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-GrossAmountDueToSeller:line403-Description	Text	Section 400 - Gross Amount Due To Seller
hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-GrossAmountDueToSeller:line403-Amount	Money	Section 400 - Gross Amount Due To Seller
hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-GrossAmountDueToSeller:line404-Description	Text	Section 400 - Gross Amount Due To Seller
hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-GrossAmountDueToSeller:line404-Amount	Money	Section 400 - Gross Amount Due To Seller
hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-GrossAmountDueToSeller:line405-Description	Text	Section 400 - Gross Amount Due To Seller
hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-GrossAmountDueToSeller:line405-Amount	Money	Section 400 - Gross Amount Due To Seller
hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line406-City/TownTaxes-DateFrom	Date	Section 400 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line406-City/TownTaxes-DateTo	Date	Section 400 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line406-City/TownTaxes-Amount	Money	Section 400 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line407-CountyTaxes-DateFrom	Date	Section 400 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line407-CountyTaxes-DateTo	Date	Section 400 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line407-CountyTaxes-Amount	Money	Section 400 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line408-Assessments-DateFrom	Date	Section 400 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line408-Assessments-DateTo	Date	Section 400 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line408-Assessments-Amount	Money	Section 400 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line409-Description	Text	Section 400 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line409-Amount	Money	Section 400 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line410-Description	Text	Section 400 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line410-Amount	Money	Section 400 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line411-Description	Text	Section 400 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line411-Amount	Money	Section 400 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line412-Description	Text	Section 400 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line412-Amount	Money	Section 400 - Adjustment For Items Paid By Seller In Advance
hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:line420-GrossAmountDueToSeller-Amount	Money	Line 420 - Gross Amount Due To Seller - Amount
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-ReductionsInAmountDueToSeller:line501-ExcessDeposit-Amount	Money	Section 500 - Reductions In Amount Due To Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-ReductionsInAmountDueToSeller:line502-SettlementChargesToSeller(Line1400)-Amount	Money	Section 500 - Reductions In Amount Due To Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-ReductionsInAmountDueToSeller:line503-ExistingLoan(S)TakenSubjectTo-Amount	Money	Section 500 - Reductions In Amount Due To Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-ReductionsInAmountDueToSeller:line504-PayoffOfFirstMortgageLoan-Amount	Money	Section 500 - Reductions In Amount Due To Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-ReductionsInAmountDueToSeller:line505-PayoffOfSecondMortgageLoan-Amount	Money	Section 500 - Reductions In Amount Due To Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-ReductionsInAmountDueToSeller:line506-Description	Text	Section 500 - Reductions In Amount Due To Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-ReductionsInAmountDueToSeller:line506-Amount	Money	Section 500 - Reductions In Amount Due To Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-ReductionsInAmountDueToSeller:line507-Description	Text	Section 500 - Reductions In Amount Due To Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-ReductionsInAmountDueToSeller:line507-Amount	Money	Section 500 - Reductions In Amount Due To Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-ReductionsInAmountDueToSeller:line508-Description	Text	Section 500 - Reductions In Amount Due To Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-ReductionsInAmountDueToSeller:line508-Amount	Money	Section 500 - Reductions In Amount Due To Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-ReductionsInAmountDueToSeller:line509-Description	Text	Section 500 - Reductions In Amount Due To Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-ReductionsInAmountDueToSeller:line509-Amount	Money	Section 500 - Reductions In Amount Due To Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line510-City/TownTaxes-DateFrom	Date	Section 500 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line510-City/TownTaxes-DateTo	Date	Section 500 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line510-City/TownTaxes-Amount	Money	Section 500 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line511-CountyTaxes-DateFrom	Date	Section 500 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line511-CountyTaxes-DateTo	Date	Section 500 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line511-CountyTaxes-Amount	Money	Section 500 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line512-Assessments-DateFrom	Date	Section 500 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line512-Assessments-DateTo	Date	Section 500 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line512-Assessments-Amount	Money	Section 500 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line513-Description	Text	Section 500 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line513-Amount	Money	Section 500 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line514-Description	Text	Section 500 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line514-Amount	Money	Section 500 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line515-Description	Text	Section 500 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line515-Amount	Money	Section 500 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line516-Description	Text	Section 500 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line516-Amount	Money	Section 500 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line517-Description	Text	Section 500 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line517-Amount	Money	Section 500 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line518-Description	Text	Section 500 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line518-Amount	Money	Section 500 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line519-Description	Text	Section 500 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line519-Amount	Money	Section 500 - Adjustments For Items Unpaid By Seller
hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:line520-TotalReductionAmountDueSeller-Amount	Money	Line 520 - Total Reduction Amount Due Seller - Amount
hud_1_settlement_statement-Part08-K.SummaryOfSeller'STransaction:section600-CashAtSettlementTo/FromSeller:line601-GrossAmountDueToSeller(Line420)-Amount	Money	Section 600 - Cash At Settlement To/From Seller
hud_1_settlement_statement-Part08-K.SummaryOfSeller'STransaction:section600-CashAtSettlementTo/FromSeller:line602-LessReductionsInAmountsDueSeller(Line520)-Amount	Money	Section 600 - Cash At Settlement To/From Seller
hud_1_settlement_statement-Part08-K.SummaryOfSeller'STransaction:section600-CashAtSettlementTo/FromSeller:line603-Cash-Checkbox	CASH TO, FROM SELLER	Section 600 - Cash At Settlement To/From Seller
hud_1_settlement_statement-Part08-K.SummaryOfSeller'STransaction:section600-CashAtSettlementTo/FromSeller:line603-Cash-Amount	Money	Section 600 - Cash At Settlement To/From Seller
hud_1_settlement_statement-Part09-L.SettlementCharges:line700-TotalRealEstateBrokerFees	Text	Line 700 - Total Real Estate Broker Fees
hud_1_settlement_statement-Part09-L.SettlementCharges:line701-Amount	Money	Line 701 - Amount
hud_1_settlement_statement-Part09-L.SettlementCharges:line701-To-Description	Text	Line 701 - To - Description
hud_1_settlement_statement-Part09-L.SettlementCharges:line702-Amount	Money	Line 702 - Amount
hud_1_settlement_statement-Part09-L.SettlementCharges:line702-To-Description	Text	Line 702 - To - Description
hud_1_settlement_statement-Part09-L.SettlementCharges:line703-CommissionPaidAtSettlement:paidFromBorrower'SFundsAtSettlement-Amount	Money	Line 703 - Commission Paid At Settlement
hud_1_settlement_statement-Part09-L.SettlementCharges:line703-CommissionPaidAtSettlement:paidFromSeller'SFundsAtSettlement-Amount	Money	Line 703 - Commission Paid At Settlement
hud_1_settlement_statement-Part09-L.SettlementCharges:line704-Description	Text	Line 704 - Description
hud_1_settlement_statement-Part09-L.SettlementCharges:line704-PaidFromBorrower'SFundsAtSettlement-Amount	Money	Line 704 - Paid From Borrower's Funds At Settlement - Amount
hud_1_settlement_statement-Part09-L.SettlementCharges:line704-PaidFromSeller'SFundsAtSettlement-Amount	Money	Line 704 - Paid From Seller's Funds At Settlement - Amount
hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line801-OurOriginationCharge-Description	Text	Section 800 - Items Payable In Connection With Loan
hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line801-OurOriginationCharge-Amount	Money	Section 800 - Items Payable In Connection With Loan
hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line802-YourCreditOrCharge(Points)ForTheSpecificInterestRateChosen-Description	Text	Section 800 - Items Payable In Connection With Loan
hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line802-YourCreditOrCharge(Points)ForTheSpecificInterestRateChosen-Amount	Money	Section 800 - Items Payable In Connection With Loan
hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line803-YourAdjustedOriginationCharges-PaidFromBorrower'SFundsAtSettlement-Amount	Money	Section 800 - Items Payable In Connection With Loan
hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line804-AppraisalFeeTo-Description	Text	Section 800 - Items Payable In Connection With Loan
hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line804-AppraisalFeeTo-PaidFromBorrower'SFundsAtSettlement-Amount	Money	Section 800 - Items Payable In Connection With Loan
hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line805-CreditReportTo-Description	Text	Section 800 - Items Payable In Connection With Loan
hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line805-CreditReportTo-PaidFromBorrower'SFundsAtSettlement-Amount	Money	Section 800 - Items Payable In Connection With Loan
hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line806-TaxServiceTo-Description	Text	Section 800 - Items Payable In Connection With Loan
hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line806-TaxServiceTo-PaidFromBorrower'SFundsAtSettlement-Amount	Money	Section 800 - Items Payable In Connection With Loan
hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line807-FloodCertificationTo-Description	Text	Section 800 - Items Payable In Connection With Loan
hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line807-FloodCertificationTo-PaidFromBorrower'SFundsAtSettlement-Amount	Money	Section 800 - Items Payable In Connection With Loan
hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line808-Description	Text	Section 800 - Items Payable In Connection With Loan
hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line808-PaidFromBorrower'SFundsAtSettlement-Amount	Money	Section 800 - Items Payable In Connection With Loan
hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line809-Description	Text	Section 800 - Items Payable In Connection With Loan
hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line809-PaidFromBorrower'SFundsAtSettlement-Amount	Money	Section 800 - Items Payable In Connection With Loan
hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line810-Description	Text	Section 800 - Items Payable In Connection With Loan
hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line810-PaidFromBorrower'SFundsAtSettlement-Amount	Money	Section 800 - Items Payable In Connection With Loan
hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line811-Description	Text	Section 800 - Items Payable In Connection With Loan
hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line811-PaidFromBorrower'SFundsAtSettlement-Amount	Money	Section 800 - Items Payable In Connection With Loan
hud_1_settlement_statement-Part11-L.SettlementCharges:section900-ItemsRequiredByLenderToBePaidInAdvance:line901-DailyInterestCharges-DateFrom	Date	Section 900 - Items Required By Lender To Be Paid In Advance
hud_1_settlement_statement-Part11-L.SettlementCharges:section900-ItemsRequiredByLenderToBePaidInAdvance:line901-DailyInterestCharges-DateTo	Date	Section 900 - Items Required By Lender To Be Paid In Advance
hud_1_settlement_statement-Part11-L.SettlementCharges:section900-ItemsRequiredByLenderToBePaidInAdvance:line901-DailyInterestCharges-AmountPerDay	Money	Section 900 - Items Required By Lender To Be Paid In Advance
hud_1_settlement_statement-Part11-L.SettlementCharges:section900-ItemsRequiredByLenderToBePaidInAdvance:line901-DailyInterestCharges-PaidFromBorrower'SFundsAtSettlement-Amount	Money	Section 900 - Items Required By Lender To Be Paid In Advance
hud_1_settlement_statement-Part11-L.SettlementCharges:section900-ItemsRequiredByLenderToBePaidInAdvance:line902-MortgageInsurancePremiumFor	Text	Section 900 - Items Required By Lender To Be Paid In Advance
hud_1_settlement_statement-Part11-L.SettlementCharges:section900-ItemsRequiredByLenderToBePaidInAdvance:line902-MortgageInsurancePremium-MonthsTo	Text	Section 900 - Items Required By Lender To Be Paid In Advance
hud_1_settlement_statement-Part11-L.SettlementCharges:section900-ItemsRequiredByLenderToBePaidInAdvance:line902-MortgageInsurancePremium-PaidFromBorrower'SFundsAtSettlement-Amount	Money	Section 900 - Items Required By Lender To Be Paid In Advance
hud_1_settlement_statement-Part11-L.SettlementCharges:section900-ItemsRequiredByLenderToBePaidInAdvance:line903-Homeowner'SInsuranceFor	Text	Section 900 - Items Required By Lender To Be Paid In Advance
hud_1_settlement_statement-Part11-L.SettlementCharges:section900-ItemsRequiredByLenderToBePaidInAdvance:line903-Homeowner'SInsurance-YearsTo	Text	Section 900 - Items Required By Lender To Be Paid In Advance
hud_1_settlement_statement-Part11-L.SettlementCharges:section900-ItemsRequiredByLenderToBePaidInAdvance:line903-Homeowner'SInsurance-PaidFromBorrower'SFundsAtSettlement-Amount	Money	Section 900 - Items Required By Lender To Be Paid In Advance
hud_1_settlement_statement-Part11-L.SettlementCharges:section900-ItemsRequiredByLenderToBePaidInAdvance:line904-Description	Text	Section 900 - Items Required By Lender To Be Paid In Advance
hud_1_settlement_statement-Part11-L.SettlementCharges:section900-ItemsRequiredByLenderToBePaidInAdvance:line904-PaidFromBorrower'SFundsAtSettlement-Amount	Money	Section 900 - Items Required By Lender To Be Paid In Advance
hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1001-InitialDepositForYourEscrowAccount-PaidFromBorrower'SFundsAtSettlement-Amount	Money	Section 1000 - Reserves Deposited With Lender
hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1002-Homeowner'SInsurance-Months	Text	Section 1000 - Reserves Deposited With Lender
hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1002-Homeowner'SInsurance-PerMonth-Amount	Money	Section 1000 - Reserves Deposited With Lender
hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1002-Homeowner'SInsurance-Amount	Money	Section 1000 - Reserves Deposited With Lender
hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1003-MortgageInsurance-Months	Text	Section 1000 - Reserves Deposited With Lender
hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1003-MortgageInsurance-PerMonth-Amount	Money	Section 1000 - Reserves Deposited With Lender
hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1003-MortgageInsurance-Amount	Money	Section 1000 - Reserves Deposited With Lender
hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1004-PropertyTaxes-Months	Text	Section 1000 - Reserves Deposited With Lender
hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1004-PropertyTaxes-PerMonth-Amount	Money	Section 1000 - Reserves Deposited With Lender
hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1004-PropertyTaxes-Amount	Money	Section 1000 - Reserves Deposited With Lender
hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1005-Months	Text	Section 1000 - Reserves Deposited With Lender
hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1005-PerMonth-Amount	Money	Section 1000 - Reserves Deposited With Lender
hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1005-Amount	Money	Section 1000 - Reserves Deposited With Lender
hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1006-Months	Text	Section 1000 - Reserves Deposited With Lender
hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1006-PerMonth-Amount	Money	Section 1000 - Reserves Deposited With Lender
hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1006-Amount	Money	Section 1000 - Reserves Deposited With Lender
hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1007-AggregateAdjustment-Amount	Money	Section 1000 - Reserves Deposited With Lender
hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1101-TitleServicesAndLender'STitleInsurance-PaidFromBorrower'SFundsAtSettlement-Amount	Money	Section 1100 - Title Charges
hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1102-SettlementOrClosingFee-Description	Text	Section 1100 - Title Charges
hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1102-SettlementOrClosingFee-Amount	Money	Section 1100 - Title Charges
hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1102-SettlementOrClosingFee-PaidFromSeller'SFundsAtSettlement-Amount	Money	Section 1100 - Title Charges
hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1103-Owner'STitleInsurance-Description	Text	Section 1100 - Title Charges
hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1103-Owner'STitleInsurance-PaidFromBorrower'SFundsAtSettlement-Amount	Money	Section 1100 - Title Charges
hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1104-Lender'STitleInsurance-Description	Text	Section 1100 - Title Charges
hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1104-Lender'STitleInsurance-Amount	Money	Section 1100 - Title Charges
hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1105-Lender'STitlePolicyLimit-Amount	Money	Section 1100 - Title Charges
hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1106-Owner'STitlePolicyLimit-Amount	Money	Section 1100 - Title Charges
hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1107-Agent'SPortionOfTheTotalTitleInsurancePremiumTo-Description	Text	Section 1100 - Title Charges
hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1107-Agent'SPortionOfTheTotalTitleInsurancePremiumTo-Amount	Money	Section 1100 - Title Charges
hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1108-Underwriter'SPortionOfTheTotalTitleInsurancePremiumTo-Description	Text	Section 1100 - Title Charges
hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1108-Underwriter'SPortionOfTheTotalTitleInsurancePremiumTo-Amount	Money	Section 1100 - Title Charges
hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1109-Description	Text	Section 1100 - Title Charges
hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1109-PaidFromBorrower'SFundsAtSettlement-Amount	Money	Section 1100 - Title Charges
hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1109-PaidFromSeller'SFundsAtSettlement-Amount	Money	Section 1100 - Title Charges
hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1110-Description	Text	Section 1100 - Title Charges
hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1110-PaidFromBorrower'SFundsAtSettlement-Amount	Money	Section 1100 - Title Charges
hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1110-PaidFromSeller'SFundsAtSettlement-Amount	Money	Section 1100 - Title Charges
hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1111-Description	Text	Section 1100 - Title Charges
hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1111-PaidFromBorrower'SFundsAtSettlement-Amount	Money	Section 1100 - Title Charges
hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1111-PaidFromSeller'SFundsAtSettlement-Amount	Money	Section 1100 - Title Charges
hud_1_settlement_statement-Part14-L.SettlementCharges:section1200-GovernmentRecordingAndTransferCharges:line1201-GovernmentRecordingCharges-PaidFromBorrower'SFundsAtSettlement-Amount	Money	Section 1200 - Government Recording And Transfer Charges
hud_1_settlement_statement-Part14-L.SettlementCharges:section1200-GovernmentRecordingAndTransferCharges:line1202-Deed-Amount	Money	Section 1200 - Government Recording And Transfer Charges
hud_1_settlement_statement-Part14-L.SettlementCharges:section1200-GovernmentRecordingAndTransferCharges:line1202-Mortgage-Amount	Money	Section 1200 - Government Recording And Transfer Charges
hud_1_settlement_statement-Part14-L.SettlementCharges:section1200-GovernmentRecordingAndTransferCharges:line1202-Release-Amount	Money	Section 1200 - Government Recording And Transfer Charges
hud_1_settlement_statement-Part14-L.SettlementCharges:section1200-GovernmentRecordingAndTransferCharges:line1202-PaidFromSeller'SFundsAtSettlement-Amount	Money	Section 1200 - Government Recording And Transfer Charges
hud_1_settlement_statement-Part14-L.SettlementCharges:section1200-GovernmentRecordingAndTransferCharges:line1203-TransferTaxes-PaidFromBorrower'SFundsAtSettlement-Amount	Money	Section 1200 - Government Recording And Transfer Charges
hud_1_settlement_statement-Part14-L.SettlementCharges:section1200-GovernmentRecordingAndTransferCharges:line1204-City/CountyTax/Stamps-Deed-Amount	Money	Section 1200 - Government Recording And Transfer Charges
hud_1_settlement_statement-Part14-L.SettlementCharges:section1200-GovernmentRecordingAndTransferCharges:line1204-City/CountyTax/Stamps-Mortgage-Amount	Money	Section 1200 - Government Recording And Transfer Charges
hud_1_settlement_statement-Part14-L.SettlementCharges:section1200-GovernmentRecordingAndTransferCharges:line1204-City/CountyTax/Stamps-PaidFromSeller'SFundsAtSettlement-Amount	Money	Section 1200 - Government Recording And Transfer Charges
hud_1_settlement_statement-Part14-L.SettlementCharges:section1200-GovernmentRecordingAndTransferCharges:line1205-StateTax/Stamps-Deed-Amount	Money	Section 1200 - Government Recording And Transfer Charges
hud_1_settlement_statement-Part14-L.SettlementCharges:section1200-GovernmentRecordingAndTransferCharges:line1205-StateTax/Stamps-Mortgage-Amount	Money	Section 1200 - Government Recording And Transfer Charges
hud_1_settlement_statement-Part14-L.SettlementCharges:section1200-GovernmentRecordingAndTransferCharges:line1205-StateTax/Stamps-PaidFromSeller'SFundsAtSettlement-Amount	Money	Section 1200 - Government Recording And Transfer Charges
hud_1_settlement_statement-Part14-L.SettlementCharges:section1200-GovernmentRecordingAndTransferCharges:line1206-Description	Text	Section 1200 - Government Recording And Transfer Charges
hud_1_settlement_statement-Part14-L.SettlementCharges:section1200-GovernmentRecordingAndTransferCharges:line1206-PaidFromBorrower'SFundsAtSettlement-Amount	Money	Section 1200 - Government Recording And Transfer Charges
hud_1_settlement_statement-Part14-L.SettlementCharges:section1200-GovernmentRecordingAndTransferCharges:line1206-PaidFromSeller'SFundsAtSettlement-Amount	Money	Section 1200 - Government Recording And Transfer Charges
hud_1_settlement_statement-Part15-L.SettlementCharges:section1300-AdditionalSettlementCharges:line1301-RequiredServicesThatYouCanShopFor-PaidFromBorrower'SFundsAtSettlement-Amount	Money	Section 1300 - Additional Settlement Charges
hud_1_settlement_statement-Part15-L.SettlementCharges:section1300-AdditionalSettlementCharges:line1302-Description	Text	Section 1300 - Additional Settlement Charges
hud_1_settlement_statement-Part15-L.SettlementCharges:section1300-AdditionalSettlementCharges:line1302-Amount	Money	Section 1300 - Additional Settlement Charges
hud_1_settlement_statement-Part15-L.SettlementCharges:section1300-AdditionalSettlementCharges:line1302-PaidFromBorrower'SFundsAtSettlement-Amount	Money	Section 1300 - Additional Settlement Charges
hud_1_settlement_statement-Part15-L.SettlementCharges:section1300-AdditionalSettlementCharges:line1302-PaidFromSeller'SFundsAtSettlement-Amount	Money	Section 1300 - Additional Settlement Charges
hud_1_settlement_statement-Part15-L.SettlementCharges:section1300-AdditionalSettlementCharges:line1303-Description	Text	Section 1300 - Additional Settlement Charges
hud_1_settlement_statement-Part15-L.SettlementCharges:section1300-AdditionalSettlementCharges:line1303-Amount	Money	Section 1300 - Additional Settlement Charges
hud_1_settlement_statement-Part15-L.SettlementCharges:section1300-AdditionalSettlementCharges:line1303-PaidFromBorrower'SFundsAtSettlement-Amount	Money	Section 1300 - Additional Settlement Charges
hud_1_settlement_statement-Part15-L.SettlementCharges:section1300-AdditionalSettlementCharges:line1303-PaidFromSeller'SFundsAtSettlement-Amount	Money	Section 1300 - Additional Settlement Charges
hud_1_settlement_statement-Part15-L.SettlementCharges:section1300-AdditionalSettlementCharges:line1304-Description	Text	Section 1300 - Additional Settlement Charges
hud_1_settlement_statement-Part15-L.SettlementCharges:section1300-AdditionalSettlementCharges:line1304-PaidFromBorrower'SFundsAtSettlement-Amount	Money	Section 1300 - Additional Settlement Charges
hud_1_settlement_statement-Part15-L.SettlementCharges:section1300-AdditionalSettlementCharges:line1304-PaidFromSeller'SFundsAtSettlement-Amount	Money	Section 1300 - Additional Settlement Charges
hud_1_settlement_statement-Part15-L.SettlementCharges:section1300-AdditionalSettlementCharges:line1305-Description	Text	Section 1300 - Additional Settlement Charges
hud_1_settlement_statement-Part15-L.SettlementCharges:section1300-AdditionalSettlementCharges:line1305-PaidFromBorrower'SFundsAtSettlement-Amount	Money	Section 1300 - Additional Settlement Charges
hud_1_settlement_statement-Part15-L.SettlementCharges:section1300-AdditionalSettlementCharges:line1305-PaidFromSeller'SFundsAtSettlement-Amount	Money	Section 1300 - Additional Settlement Charges
hud_1_settlement_statement-Part15-L.SettlementCharges:line1400-TotalSettlementCharges-PaidFromBorrower'SFundsAtSettlement-Amount	Money	Line 1400 - Total Settlement Charges - Paid From Borrower's Funds At Settlement - Amount
hud_1_settlement_statement-Part15-L.SettlementCharges:line1400-TotalSettlementCharges-PaidFromSeller'SFundsAtSettlement-Amount	Money	Line 1400 - Total Settlement Charges - Paid From Seller's Funds At Settlement - Amount
hud_1_settlement_statement-Part16-ComparisonOfGoodFaithEstimate(Gfe)AndHud-1Charges:ourOriginationCharge#801:goodFaithEstimate-Amount	Money	Our Origination Charge # 801
hud_1_settlement_statement-Part16-ComparisonOfGoodFaithEstimate(Gfe)AndHud-1Charges:ourOriginationCharge#801:hud-1-Amount	Money	Our Origination Charge # 801
hud_1_settlement_statement-Part16-ComparisonOfGoodFaithEstimate(Gfe)AndHud-1Charges:yourCreditOrCharge(Points)ForTheSpecificInterestRateChosen#802:goodFaithEstimate-Amount	Money	Your Credit Or Charge (Points) For The Specific Interest Rate Chosen # 802
hud_1_settlement_statement-Part16-ComparisonOfGoodFaithEstimate(Gfe)AndHud-1Charges:yourCreditOrCharge(Points)ForTheSpecificInterestRateChosen#802:hud-1-Amount	Money	Your Credit Or Charge (Points) For The Specific Interest Rate Chosen # 802
hud_1_settlement_statement-Part16-ComparisonOfGoodFaithEstimate(Gfe)AndHud-1Charges:yourAdjustedOriginationCharges#803:goodFaithEstimate-Amount	Money	Your Adjusted Origination Charges # 803
hud_1_settlement_statement-Part16-ComparisonOfGoodFaithEstimate(Gfe)AndHud-1Charges:yourAdjustedOriginationCharges#803:hud-1-Amount	Money	Your Adjusted Origination Charges # 803
hud_1_settlement_statement-Part16-ComparisonOfGoodFaithEstimate(Gfe)AndHud-1Charges:transferTaxes#1203:goodFaithEstimate-Amount	Money	Transfer Taxes # 1203
hud_1_settlement_statement-Part16-ComparisonOfGoodFaithEstimate(Gfe)AndHud-1Charges:transferTaxes#1203:hud-1-Amount	Money	Transfer Taxes # 1203
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:governmentRecordingCharges#1201:goodFaithEstimate-Amount	Money	Government Recording Charges # 1201
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:governmentRecordingCharges#1201:hud-1-Amount	Money	Government Recording Charges # 1201
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge1:description	Text	Charge 1
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge1:hud-1LineNumber	Text	Charge 1
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge1:goodFaithEstimate-Amount	Money	Charge 1
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge1:hud-1-Amount	Money	Charge 1
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge2:description	Text	Charge 2
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge2:hud-1LineNumber	Text	Charge 2
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge2:goodFaithEstimate-Amount	Money	Charge 2
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge2:hud-1-Amount	Money	Charge 2
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge3:description	Text	Charge 3
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge3:hud-1LineNumber	Text	Charge 3
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge3:goodFaithEstimate-Amount	Money	Charge 3
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge3:hud-1-Amount	Money	Charge 3
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge4:description	Text	Charge 4
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge4:hud-1LineNumber	Text	Charge 4
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge4:goodFaithEstimate-Amount	Money	Charge 4
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge4:hud-1-Amount	Money	Charge 4
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge5:description	Text	Charge 5
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge5:hud-1LineNumber	Text	Charge 5
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge5:goodFaithEstimate-Amount	Money	Charge 5
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge5:hud-1-Amount	Money	Charge 5
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge6:description	Text	Charge 6
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge6:hud-1LineNumber	Text	Charge 6
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge6:goodFaithEstimate-Amount	Money	Charge 6
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge6:hud-1-Amount	Money	Charge 6
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge7:description	Text	Charge 7
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge7:hud-1LineNumber	Text	Charge 7
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge7:goodFaithEstimate-Amount	Money	Charge 7
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge7:hud-1-Amount	Money	Charge 7
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:total-GoodFaithEstimate-Amount	Money	Total - Good Faith Estimate - Amount
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:total-Hud-1-Amount	Money	Total - HUD-1 - Amount
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:increaseBetweenGfeAndHud-1Charges:goodFaithEstimate-Amount	Money	Increase Between GFE And HUD-1 Charges
hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:increaseBetweenGfeAndHud-1Charges:hud-1-Percentage	Percentage	Increase Between GFE And HUD-1 Charges
hud_1_settlement_statement-Part18-ChargesThatCanChange:initialDepositForYourEscrowAccount#1001:goodFaithEstimate-Amount	Money	Initial Deposit For Your Escrow Account # 1001
hud_1_settlement_statement-Part18-ChargesThatCanChange:initialDepositForYourEscrowAccount#1001:hud-1-Amount	Money	Initial Deposit For Your Escrow Account # 1001
hud_1_settlement_statement-Part18-ChargesThatCanChange:dailyInterestCharges#901:amount-PerDay	Money	Daily Interest Charges # 901
hud_1_settlement_statement-Part18-ChargesThatCanChange:dailyInterestCharges#901:goodFaithEstimate-Amount	Money	Daily Interest Charges # 901
hud_1_settlement_statement-Part18-ChargesThatCanChange:dailyInterestCharges#901:hud-1-Amount	Money	Daily Interest Charges # 901
hud_1_settlement_statement-Part18-ChargesThatCanChange:homeowner'sInsurance#903:goodFaithEstimate-Amount	Money	Homeowner's Insurance # 903
hud_1_settlement_statement-Part18-ChargesThatCanChange:homeowner'sInsurance#903:hud-1-Amount	Money	Homeowner's Insurance # 903
hud_1_settlement_statement-Part18-ChargesThatCanChange:charge1:description	Text	Charge 1
hud_1_settlement_statement-Part18-ChargesThatCanChange:charge1:hud-1LineNumber	Text	Charge 1
hud_1_settlement_statement-Part18-ChargesThatCanChange:charge1:goodFaithEstimate-Amount	Money	Charge 1
hud_1_settlement_statement-Part18-ChargesThatCanChange:charge1:hud-1-Amount	Money	Charge 1
hud_1_settlement_statement-Part18-ChargesThatCanChange:charge2:description	Text	Charge 2
hud_1_settlement_statement-Part18-ChargesThatCanChange:charge2:hud-1LineNumber	Text	Charge 2
hud_1_settlement_statement-Part18-ChargesThatCanChange:charge2:goodFaithEstimate-Amount	Money	Charge 2
hud_1_settlement_statement-Part18-ChargesThatCanChange:charge2:hud-1-Amount	Money	Charge 2
hud_1_settlement_statement-Part18-ChargesThatCanChange:charge3:description	Text	Charge 3
hud_1_settlement_statement-Part18-ChargesThatCanChange:charge3:hud-1LineNumber	Text	Charge 3
hud_1_settlement_statement-Part18-ChargesThatCanChange:charge3:goodFaithEstimate-Amount	Money	Charge 3
hud_1_settlement_statement-Part18-ChargesThatCanChange:charge3:hud-1-Amount	Money	Charge 3
hud_1_settlement_statement-Part19-LoanTerms:yourInitialLoanAmountIs-Amount	Money	Your Initial Loan Amount Is - Amount
hud_1_settlement_statement-Part19-LoanTerms:yourLoanTermIs-Years	Integer	Your Loan Term Is - Years
hud_1_settlement_statement-Part19-LoanTerms:yourInitialInterestRateIs-Percentage	Percentage	Your Initial Interest Rate Is - Percentage
hud_1_settlement_statement-Part19-LoanTerms:yourInitialMonthlyAmountOwedForPrincipalInterestAndAnyMortgageInsuranceIs:amount	Money	Your Initial Monthly Amount Owed For Principal Interest And Any Mortgage Insurance Is
hud_1_settlement_statement-Part19-LoanTerms:yourInitialMonthlyAmountOwedForPrincipalInterestAndAnyMortgageInsuranceIs:principal	CHECKED, NOT CHECKED	Your Initial Monthly Amount Owed For Principal Interest And Any Mortgage Insurance Is
hud_1_settlement_statement-Part19-LoanTerms:yourInitialMonthlyAmountOwedForPrincipalInterestAndAnyMortgageInsuranceIs:interest	CHECKED, NOT CHECKED	Your Initial Monthly Amount Owed For Principal Interest And Any Mortgage Insurance Is
hud_1_settlement_statement-Part19-LoanTerms:yourInitialMonthlyAmountOwedForPrincipalInterestAndAnyMortgageInsuranceIs:mortgageInsurance	CHECKED, NOT CHECKED	Your Initial Monthly Amount Owed For Principal Interest And Any Mortgage Insurance Is
hud_1_settlement_statement-Part19-LoanTerms:canYourInterestRateRise?:canYourInterestRateRise-Checkbox	YES, NO	Can Your Interest Rate Rise?
hud_1_settlement_statement-Part19-LoanTerms:canYourInterestRateRise?:itCanRiseToAMaximumOf-Percentage	Percentage	Can Your Interest Rate Rise?
hud_1_settlement_statement-Part19-LoanTerms:canYourInterestRateRise?:theFirstChangeWillBeOn-Date	Date	Can Your Interest Rate Rise?
hud_1_settlement_statement-Part19-LoanTerms:canYourInterestRateRise?:andCanChangeAgainEvery	Text	Can Your Interest Rate Rise?
hud_1_settlement_statement-Part19-LoanTerms:canYourInterestRateRise?:after-Date	Date	Can Your Interest Rate Rise?
hud_1_settlement_statement-Part19-LoanTerms:canYourInterestRateRise?:yourInterestRateCanIncreaseOrDecreaseBy-Percentage	Percentage	Can Your Interest Rate Rise?
hud_1_settlement_statement-Part19-LoanTerms:canYourInterestRateRise?:yourInterestRateIsGuaranteedToNeverBeLowerThan-Percentage	Percentage	Can Your Interest Rate Rise?
hud_1_settlement_statement-Part19-LoanTerms:canYourInterestRateRise?:orHigherThan-Percentage	Percentage	Can Your Interest Rate Rise?
hud_1_settlement_statement-Part19-LoanTerms:evenIfYouMakePaymentsOnTimeCanYourLoanBalanceRise?:evenIfYouMakePaymentsOnTimeCanYourLoanBalanceRise-Checkbox	YES, NO	Even If You Make Payments On Time Can Your Loan Balance Rise?
hud_1_settlement_statement-Part19-LoanTerms:evenIfYouMakePaymentsOnTimeCanYourLoanBalanceRise?:itCanRiseToAMaximumOf-Amount	Money	Even If You Make Payments On Time Can Your Loan Balance Rise?
hud_1_settlement_statement-Part19-LoanTerms:evenIfYouMakePaymentsOnTimeCanYourMonthlyAmountRise?:evenIfYouMakePaymentsOnTimeCanYourMonthlyAmountRise-Checkbox	YES, NO	Even If You Make Payments On Time Can Your Monthly Amount Rise?
hud_1_settlement_statement-Part19-LoanTerms:evenIfYouMakePaymentsOnTimeCanYourMonthlyAmountRise?:theFirstIncreaseCanBeOn-Date	Date	Even If You Make Payments On Time Can Your Monthly Amount Rise?
hud_1_settlement_statement-Part19-LoanTerms:evenIfYouMakePaymentsOnTimeCanYourMonthlyAmountRise?:theMonthlyAmountOwedCanRiseTo-Amount	Money	Even If You Make Payments On Time Can Your Monthly Amount Rise?
hud_1_settlement_statement-Part19-LoanTerms:evenIfYouMakePaymentsOnTimeCanYourMonthlyAmountRise?:theMaximumItCanEverRiseToIs-Amount	Money	Even If You Make Payments On Time Can Your Monthly Amount Rise?
hud_1_settlement_statement-Part19-LoanTerms:doesYourLoanHaveAPrepaymentPenalty?:doesYourLoanHaveAPrepaymentPenalty-Checkbox	YES, NO	Does Your Loan Have A Prepayment Penalty?
hud_1_settlement_statement-Part19-LoanTerms:doesYourLoanHaveAPrepaymentPenalty?:yourMaximumPrepaymentPenaltyIs-Amount	Money	Does Your Loan Have A Prepayment Penalty?
hud_1_settlement_statement-Part19-LoanTerms:doesYourLoanHaveABalloonPayment?:doesYourLoanHaveABalloonPayment-Checkbox	YES, NO	Does Your Loan Have A Balloon Payment?
hud_1_settlement_statement-Part19-LoanTerms:doesYourLoanHaveABalloonPayment?:youHaveABalloonPaymentOf-Amount	Money	Does Your Loan Have A Balloon Payment?
hud_1_settlement_statement-Part19-LoanTerms:doesYourLoanHaveABalloonPayment?:youHaveABalloonPaymentOf-DueIn-Years	Integer	Does Your Loan Have A Balloon Payment?
hud_1_settlement_statement-Part19-LoanTerms:doesYourLoanHaveABalloonPayment?:youHaveABalloonPaymentOf-On-Date	Date	Does Your Loan Have A Balloon Payment?
hud_1_settlement_statement-Part19-LoanTerms:totalMonthlyAmountOwedIncludingEscrowAccountPayments:youDoNotHaveAMonthlyEscrowPaymentForItemsSuchAsPropertyTaxes-Checkbox	CHECKED, NOT CHECKED	Total Monthly Amount Owed Including Escrow Account Payments
hud_1_settlement_statement-Part19-LoanTerms:totalMonthlyAmountOwedIncludingEscrowAccountPayments:youHaveAnAdditionalMonthlyEscrowPaymentOf-CheckBox	CHECKED, NOT CHECKED	Total Monthly Amount Owed Including Escrow Account Payments
hud_1_settlement_statement-Part19-LoanTerms:totalMonthlyAmountOwedIncludingEscrowAccountPayments:youHaveAnAdditionalMonthlyEscrowPaymentOf-Amount	Money	Total Monthly Amount Owed Including Escrow Account Payments
hud_1_settlement_statement-Part19-LoanTerms:totalMonthlyAmountOwedIncludingEscrowAccountPayments:totalInitialMonthlyAmountOwedOf-Amount	Money	Total Monthly Amount Owed Including Escrow Account Payments
hud_1_settlement_statement-Part19-LoanTerms:totalMonthlyAmountOwedIncludingEscrowAccountPayments:itemsCheckedBelow-PropertyTaxes	CHECKED, NOT CHECKED	Total Monthly Amount Owed Including Escrow Account Payments
hud_1_settlement_statement-Part19-LoanTerms:totalMonthlyAmountOwedIncludingEscrowAccountPayments:itemsCheckedBelow-Homeowner'SInsurance	CHECKED, NOT CHECKED	Total Monthly Amount Owed Including Escrow Account Payments
hud_1_settlement_statement-Part19-LoanTerms:totalMonthlyAmountOwedIncludingEscrowAccountPayments:itemsCheckedBelow-FloodInsurance	CHECKED, NOT CHECKED	Total Monthly Amount Owed Including Escrow Account Payments
hud_1_settlement_statement-Part19-LoanTerms:totalMonthlyAmountOwedIncludingEscrowAccountPayments:itemsCheckedBelow-1-Checkbox	CHECKED, NOT CHECKED	Total Monthly Amount Owed Including Escrow Account Payments
hud_1_settlement_statement-Part19-LoanTerms:totalMonthlyAmountOwedIncludingEscrowAccountPayments:itemsCheckedBelow-Item1-Description	Text	Total Monthly Amount Owed Including Escrow Account Payments
hud_1_settlement_statement-Part19-LoanTerms:totalMonthlyAmountOwedIncludingEscrowAccountPayments:itemsCheckedBelow-2-Checkbox	CHECKED, NOT CHECKED	Total Monthly Amount Owed Including Escrow Account Payments
hud_1_settlement_statement-Part19-LoanTerms:totalMonthlyAmountOwedIncludingEscrowAccountPayments:itemsCheckedBelow-Item2-Description	Text	Total Monthly Amount Owed Including Escrow Account Payments
hud_1_settlement_statement-Part19-LoanTerms:totalMonthlyAmountOwedIncludingEscrowAccountPayments:itemsCheckedBelow-3-Checkbox	CHECKED, NOT CHECKED	Total Monthly Amount Owed Including Escrow Account Payments
hud_1_settlement_statement-Part19-LoanTerms:totalMonthlyAmountOwedIncludingEscrowAccountPayments:itemsCheckedBelow-Item3-Description	Text	Total Monthly Amount Owed Including Escrow Account Payments
Sample document
drive.google.com
HUD-1 SETTLEMENT STATEMENT.pdf
Sample JSON result
JSON
{
  "pk": 42619185,
  "uuid": "69433aae-6491-4340-af75-a7f6d03a3708",
  "name": "Hud-1 API",
  "created": "2023-12-06T13:16:44Z",
  "created_ts": "2023-12-06T13:16:44Z",
  "verified_pages_count": 3,
  "book_status": "ACTIVE",
  "id": 42619185,
  "forms": [
    {
      "pk": 51501182,
      "uuid": "9d38f3b7-1e3d-4af3-bd48-a71c49867f6d",
      "uploaded_doc_pk": 63104115,
      "form_type": "HUD_1_SETTLEMENT_STATEMENT",
      "raw_fields": {
        "hud_1_settlement_statement-Part19-LoanTerms:yourLoanTermIs-Years": {
          "value": "30",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part18-ChargesThatCanChange:charge1:description": {
          "value": "CREDIT CHARGES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part18-ChargesThatCanChange:charge2:description": {
          "value": "OWNER'S TITLE INSURANCE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part18-ChargesThatCanChange:charge3:description": {
          "value": "OWNER'S MORTGAGE INSURANCE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:yourInitialLoanAmountIs-Amount": {
          "value": "10000000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part18-ChargesThatCanChange:charge1:hud-1-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part18-ChargesThatCanChange:charge2:hud-1-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part18-ChargesThatCanChange:charge3:hud-1-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part18-ChargesThatCanChange:charge1:hud-1LineNumber": {
          "value": "# 904",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part18-ChargesThatCanChange:charge2:hud-1LineNumber": {
          "value": "# 1110",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part18-ChargesThatCanChange:charge3:hud-1LineNumber": {
          "value": "# 1111",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:canYourInterestRateRise?:after-Date": {
          "value": "10/20/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:yourInitialInterestRateIs-Percentage": {
          "value": "2.10%",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part18-ChargesThatCanChange:charge1:goodFaithEstimate-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part18-ChargesThatCanChange:charge2:goodFaithEstimate-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part18-ChargesThatCanChange:charge3:goodFaithEstimate-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:canYourInterestRateRise?:andCanChangeAgainEvery": {
          "value": "10",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part18-ChargesThatCanChange:dailyInterestCharges#901:hud-1-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part18-ChargesThatCanChange:homeowner'sInsurance#903:hud-1-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:canYourInterestRateRise?:orHigherThan-Percentage": {
          "value": "2.45%",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part18-ChargesThatCanChange:dailyInterestCharges#901:amount-PerDay": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:total-Hud-1-Amount": {
          "value": "8000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:canYourInterestRateRise?:theFirstChangeWillBeOn-Date": {
          "value": "01/01/2022",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge1:description": {
          "value": "FEES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge2:description": {
          "value": "OTHER FEES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge3:description": {
          "value": "CREDIT REPORT",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge4:description": {
          "value": "TITLE SERVICE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge5:description": {
          "value": "OTHER TAX WAGES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge6:description": {
          "value": "SURVEY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge7:description": {
          "value": "FEES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge1:hud-1-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge2:hud-1-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge3:hud-1-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge4:hud-1-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge5:hud-1-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge6:hud-1-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge7:hud-1-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge1:hud-1LineNumber": {
          "value": "# 1202",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge2:hud-1LineNumber": {
          "value": "# 1203",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge3:hud-1LineNumber": {
          "value": "# 1204",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge4:hud-1LineNumber": {
          "value": "# 1205",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge5:hud-1LineNumber": {
          "value": "# 1206",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge6:hud-1LineNumber": {
          "value": "# 1302",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge7:hud-1LineNumber": {
          "value": "# 1305",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:canYourInterestRateRise?:canYourInterestRateRise-Checkbox": {
          "value": "YES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:canYourInterestRateRise?:itCanRiseToAMaximumOf-Percentage": {
          "value": "2.45%",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part18-ChargesThatCanChange:dailyInterestCharges#901:goodFaithEstimate-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part18-ChargesThatCanChange:homeowner'sInsurance#903:goodFaithEstimate-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part18-ChargesThatCanChange:initialDepositForYourEscrowAccount#1001:hud-1-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:total-GoodFaithEstimate-Amount": {
          "value": "8000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:doesYourLoanHaveABalloonPayment?:youHaveABalloonPaymentOf-Amount": {
          "value": "10000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:doesYourLoanHaveABalloonPayment?:youHaveABalloonPaymentOf-On-Date": {
          "value": "01/01/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge1:goodFaithEstimate-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge2:goodFaithEstimate-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge3:goodFaithEstimate-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge4:goodFaithEstimate-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge5:goodFaithEstimate-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge6:goodFaithEstimate-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:charge7:goodFaithEstimate-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:doesYourLoanHaveABalloonPayment?:youHaveABalloonPaymentOf-DueIn-Years": {
          "value": "2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part16-ComparisonOfGoodFaithEstimate(Gfe)AndHud-1Charges:transferTaxes#1203:hud-1-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:doesYourLoanHaveABalloonPayment?:doesYourLoanHaveABalloonPayment-Checkbox": {
          "value": "YES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:doesYourLoanHaveAPrepaymentPenalty?:yourMaximumPrepaymentPenaltyIs-Amount": {
          "value": "100000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part18-ChargesThatCanChange:initialDepositForYourEscrowAccount#1001:goodFaithEstimate-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:canYourInterestRateRise?:yourInterestRateCanIncreaseOrDecreaseBy-Percentage": {
          "value": "1.5%",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part16-ComparisonOfGoodFaithEstimate(Gfe)AndHud-1Charges:ourOriginationCharge#801:hud-1-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:governmentRecordingCharges#1201:hud-1-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:doesYourLoanHaveAPrepaymentPenalty?:doesYourLoanHaveAPrepaymentPenalty-Checkbox": {
          "value": "YES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:evenIfYouMakePaymentsOnTimeCanYourLoanBalanceRise?:itCanRiseToAMaximumOf-Amount": {
          "value": "10000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:yourInitialMonthlyAmountOwedForPrincipalInterestAndAnyMortgageInsuranceIs:amount": {
          "value": "10000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:evenIfYouMakePaymentsOnTimeCanYourMonthlyAmountRise?:theFirstIncreaseCanBeOn-Date": {
          "value": "01/01/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:totalMonthlyAmountOwedIncludingEscrowAccountPayments:itemsCheckedBelow-1-Checkbox": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:totalMonthlyAmountOwedIncludingEscrowAccountPayments:itemsCheckedBelow-2-Checkbox": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:totalMonthlyAmountOwedIncludingEscrowAccountPayments:itemsCheckedBelow-3-Checkbox": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:canYourInterestRateRise?:yourInterestRateIsGuaranteedToNeverBeLowerThan-Percentage": {
          "value": "2.00%",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:yourInitialMonthlyAmountOwedForPrincipalInterestAndAnyMortgageInsuranceIs:interest": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part16-ComparisonOfGoodFaithEstimate(Gfe)AndHud-1Charges:transferTaxes#1203:goodFaithEstimate-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:yourInitialMonthlyAmountOwedForPrincipalInterestAndAnyMortgageInsuranceIs:principal": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:increaseBetweenGfeAndHud-1Charges:hud-1-Percentage": {
          "value": "5%",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:totalMonthlyAmountOwedIncludingEscrowAccountPayments:itemsCheckedBelow-PropertyTaxes": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:totalMonthlyAmountOwedIncludingEscrowAccountPayments:itemsCheckedBelow-FloodInsurance": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part16-ComparisonOfGoodFaithEstimate(Gfe)AndHud-1Charges:yourAdjustedOriginationCharges#803:hud-1-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:evenIfYouMakePaymentsOnTimeCanYourMonthlyAmountRise?:theMaximumItCanEverRiseToIs-Amount": {
          "value": "1000000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:totalMonthlyAmountOwedIncludingEscrowAccountPayments:itemsCheckedBelow-Item1-Description": {
          "value": "OTHERS",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:totalMonthlyAmountOwedIncludingEscrowAccountPayments:itemsCheckedBelow-Item2-Description": {
          "value": "OTHER TAX",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:totalMonthlyAmountOwedIncludingEscrowAccountPayments:itemsCheckedBelow-Item3-Description": {
          "value": "OTHER FEES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part16-ComparisonOfGoodFaithEstimate(Gfe)AndHud-1Charges:ourOriginationCharge#801:goodFaithEstimate-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:evenIfYouMakePaymentsOnTimeCanYourMonthlyAmountRise?:theMonthlyAmountOwedCanRiseTo-Amount": {
          "value": "100000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:governmentRecordingCharges#1201:goodFaithEstimate-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:totalMonthlyAmountOwedIncludingEscrowAccountPayments:itemsCheckedBelow-Homeowner'SInsurance": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:totalMonthlyAmountOwedIncludingEscrowAccountPayments:totalInitialMonthlyAmountOwedOf-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:yourInitialMonthlyAmountOwedForPrincipalInterestAndAnyMortgageInsuranceIs:mortgageInsurance": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part17-ChargesThatInTotalCannotIncreaseMoreThan10%:increaseBetweenGfeAndHud-1Charges:goodFaithEstimate-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part16-ComparisonOfGoodFaithEstimate(Gfe)AndHud-1Charges:yourAdjustedOriginationCharges#803:goodFaithEstimate-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:totalMonthlyAmountOwedIncludingEscrowAccountPayments:youHaveAnAdditionalMonthlyEscrowPaymentOf-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:totalMonthlyAmountOwedIncludingEscrowAccountPayments:youHaveAnAdditionalMonthlyEscrowPaymentOf-CheckBox": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:evenIfYouMakePaymentsOnTimeCanYourLoanBalanceRise?:evenIfYouMakePaymentsOnTimeCanYourLoanBalanceRise-Checkbox": {
          "value": "YES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:evenIfYouMakePaymentsOnTimeCanYourMonthlyAmountRise?:evenIfYouMakePaymentsOnTimeCanYourMonthlyAmountRise-Checkbox": {
          "value": "YES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part16-ComparisonOfGoodFaithEstimate(Gfe)AndHud-1Charges:yourCreditOrCharge(Points)ForTheSpecificInterestRateChosen#802:hud-1-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part19-LoanTerms:totalMonthlyAmountOwedIncludingEscrowAccountPayments:youDoNotHaveAMonthlyEscrowPaymentForItemsSuchAsPropertyTaxes-Checkbox": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part16-ComparisonOfGoodFaithEstimate(Gfe)AndHud-1Charges:yourCreditOrCharge(Points)ForTheSpecificInterestRateChosen#802:goodFaithEstimate-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part09-L.SettlementCharges:line701-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part09-L.SettlementCharges:line702-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part09-L.SettlementCharges:line704-Description": {
          "value": "OTHER",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part09-L.SettlementCharges:line701-To-Description": {
          "value": "REMAX SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part09-L.SettlementCharges:line702-To-Description": {
          "value": "FAKE DMAX COMPANY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part09-L.SettlementCharges:line700-TotalRealEstateBrokerFees": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1109-Description": {
          "value": "DEED PREPARATION",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1110-Description": {
          "value": "OWNER'S TITLE INSURANCE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1111-Description": {
          "value": "OWNER'S MORTGAGE INSURANCE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part09-L.SettlementCharges:line704-PaidFromSeller'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part09-L.SettlementCharges:line704-PaidFromBorrower'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1005-Amount": {
          "value": "2500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1005-Months": {
          "value": "5",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1006-Amount": {
          "value": "2500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1006-Months": {
          "value": "5",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part15-L.SettlementCharges:section1300-AdditionalSettlementCharges:line1302-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part15-L.SettlementCharges:section1300-AdditionalSettlementCharges:line1303-Amount": {
          "value": "500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part15-L.SettlementCharges:section1300-AdditionalSettlementCharges:line1302-Description": {
          "value": "SURVEY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part15-L.SettlementCharges:section1300-AdditionalSettlementCharges:line1303-Description": {
          "value": "PEST INSPECTION",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part15-L.SettlementCharges:section1300-AdditionalSettlementCharges:line1304-Description": {
          "value": "SURVEY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part15-L.SettlementCharges:section1300-AdditionalSettlementCharges:line1305-Description": {
          "value": "FEES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line808-Description": {
          "value": "HOMEOWNER INSURANCE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line809-Description": {
          "value": "INTEREST CHARGE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line810-Description": {
          "value": "MORTGAGE INSURANCE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line811-Description": {
          "value": "OTHER INSURANCE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1102-SettlementOrClosingFee-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1104-Lender'STitleInsurance-Amount": {
          "value": "500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1005-PerMonth-Amount": {
          "value": "500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1006-PerMonth-Amount": {
          "value": "500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1106-Owner'STitlePolicyLimit-Amount": {
          "value": "10000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1105-Lender'STitlePolicyLimit-Amount": {
          "value": "10000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1103-Owner'STitleInsurance-Description": {
          "value": "TO SAMPLE NATIONAL TITLE INSURANCE COMPANY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1102-SettlementOrClosingFee-Description": {
          "value": "OTHER MORTGAGE SAMPLE FEES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1104-Lender'STitleInsurance-Description": {
          "value": "TO SAMPLE NATIONAL TITLE INSURANCE COMPANY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part11-L.SettlementCharges:section900-ItemsRequiredByLenderToBePaidInAdvance:line904-Description": {
          "value": "CREDIT CHARGES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1004-PropertyTaxes-Amount": {
          "value": "1500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1004-PropertyTaxes-Months": {
          "value": "3",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part14-L.SettlementCharges:section1200-GovernmentRecordingAndTransferCharges:line1202-Deed-Amount": {
          "value": "500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part14-L.SettlementCharges:section1200-GovernmentRecordingAndTransferCharges:line1206-Description": {
          "value": "GRANTOR DEED RECORDING TAX",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part15-L.SettlementCharges:line1400-TotalSettlementCharges-PaidFromSeller'SFundsAtSettlement-Amount": {
          "value": "17000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1003-MortgageInsurance-Amount": {
          "value": "1500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1003-MortgageInsurance-Months": {
          "value": "3",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part14-L.SettlementCharges:section1200-GovernmentRecordingAndTransferCharges:line1202-Release-Amount": {
          "value": "500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1109-PaidFromSeller'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1110-PaidFromSeller'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1111-PaidFromSeller'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part14-L.SettlementCharges:section1200-GovernmentRecordingAndTransferCharges:line1202-Mortgage-Amount": {
          "value": "500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part15-L.SettlementCharges:line1400-TotalSettlementCharges-PaidFromBorrower'SFundsAtSettlement-Amount": {
          "value": "32000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part09-L.SettlementCharges:line703-CommissionPaidAtSettlement:paidFromSeller'SFundsAtSettlement-Amount": {
          "value": "2000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1007-AggregateAdjustment-Amount": {
          "value": "-2500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line806-TaxServiceTo-Description": {
          "value": "FAKE SAMPLE SOLUTIONS",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1002-Homeowner'SInsurance-Amount": {
          "value": "1500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1002-Homeowner'SInsurance-Months": {
          "value": "3",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1109-PaidFromBorrower'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1110-PaidFromBorrower'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1111-PaidFromBorrower'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part09-L.SettlementCharges:line703-CommissionPaidAtSettlement:paidFromBorrower'SFundsAtSettlement-Amount": {
          "value": "2000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line804-AppraisalFeeTo-Description": {
          "value": "APPRAISERS UNITED SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line805-CreditReportTo-Description": {
          "value": "CREDIT SAMPLE SOLUTIONS",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1004-PropertyTaxes-PerMonth-Amount": {
          "value": "500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line801-OurOriginationCharge-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part11-L.SettlementCharges:section900-ItemsRequiredByLenderToBePaidInAdvance:line903-Homeowner'SInsuranceFor": {
          "value": "1.0",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1003-MortgageInsurance-PerMonth-Amount": {
          "value": "500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line801-OurOriginationCharge-Description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line807-FloodCertificationTo-Description": {
          "value": "FAKE SAMPLE COMPANY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part11-L.SettlementCharges:section900-ItemsRequiredByLenderToBePaidInAdvance:line901-DailyInterestCharges-DateTo": {
          "value": "09/30/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part11-L.SettlementCharges:section900-ItemsRequiredByLenderToBePaidInAdvance:line902-MortgageInsurancePremiumFor": {
          "value": "JANUARY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1002-Homeowner'SInsurance-PerMonth-Amount": {
          "value": "500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part11-L.SettlementCharges:section900-ItemsRequiredByLenderToBePaidInAdvance:line903-Homeowner'SInsurance-YearsTo": {
          "value": "ELEPHANT INSURANCE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part14-L.SettlementCharges:section1200-GovernmentRecordingAndTransferCharges:line1205-StateTax/Stamps-Deed-Amount": {
          "value": "500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part11-L.SettlementCharges:section900-ItemsRequiredByLenderToBePaidInAdvance:line901-DailyInterestCharges-DateFrom": {
          "value": "01/01/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1107-Agent'SPortionOfTheTotalTitleInsurancePremiumTo-Amount": {
          "value": "500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part15-L.SettlementCharges:section1300-AdditionalSettlementCharges:line1302-PaidFromSeller'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part15-L.SettlementCharges:section1300-AdditionalSettlementCharges:line1303-PaidFromSeller'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part15-L.SettlementCharges:section1300-AdditionalSettlementCharges:line1304-PaidFromSeller'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part15-L.SettlementCharges:section1300-AdditionalSettlementCharges:line1305-PaidFromSeller'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part14-L.SettlementCharges:section1200-GovernmentRecordingAndTransferCharges:line1205-StateTax/Stamps-Mortgage-Amount": {
          "value": "500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part11-L.SettlementCharges:section900-ItemsRequiredByLenderToBePaidInAdvance:line901-DailyInterestCharges-AmountPerDay": {
          "value": "10.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part11-L.SettlementCharges:section900-ItemsRequiredByLenderToBePaidInAdvance:line902-MortgageInsurancePremium-MonthsTo": {
          "value": "SEPTEMBER",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part15-L.SettlementCharges:section1300-AdditionalSettlementCharges:line1302-PaidFromBorrower'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part15-L.SettlementCharges:section1300-AdditionalSettlementCharges:line1303-PaidFromBorrower'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part15-L.SettlementCharges:section1300-AdditionalSettlementCharges:line1304-PaidFromBorrower'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part15-L.SettlementCharges:section1300-AdditionalSettlementCharges:line1305-PaidFromBorrower'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part14-L.SettlementCharges:section1200-GovernmentRecordingAndTransferCharges:line1204-City/CountyTax/Stamps-Deed-Amount": {
          "value": "500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1107-Agent'SPortionOfTheTotalTitleInsurancePremiumTo-Description": {
          "value": "SAMPLE REAL ESTATE SERVICES, LLC",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line808-PaidFromBorrower'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line809-PaidFromBorrower'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line810-PaidFromBorrower'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line811-PaidFromBorrower'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1108-Underwriter'SPortionOfTheTotalTitleInsurancePremiumTo-Amount": {
          "value": "500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part14-L.SettlementCharges:section1200-GovernmentRecordingAndTransferCharges:line1204-City/CountyTax/Stamps-Mortgage-Amount": {
          "value": "500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1102-SettlementOrClosingFee-PaidFromSeller'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1103-Owner'STitleInsurance-PaidFromBorrower'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1108-Underwriter'SPortionOfTheTotalTitleInsurancePremiumTo-Description": {
          "value": "SAMPLE NATIONAL TITLE INSURANCE COMPANY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part14-L.SettlementCharges:section1200-GovernmentRecordingAndTransferCharges:line1202-PaidFromSeller'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part14-L.SettlementCharges:section1200-GovernmentRecordingAndTransferCharges:line1206-PaidFromSeller'SFundsAtSettlement-Amount": {
          "value": "3000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part11-L.SettlementCharges:section900-ItemsRequiredByLenderToBePaidInAdvance:line904-PaidFromBorrower'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part14-L.SettlementCharges:section1200-GovernmentRecordingAndTransferCharges:line1206-PaidFromBorrower'SFundsAtSettlement-Amount": {
          "value": "2000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line806-TaxServiceTo-PaidFromBorrower'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line804-AppraisalFeeTo-PaidFromBorrower'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line805-CreditReportTo-PaidFromBorrower'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line807-FloodCertificationTo-PaidFromBorrower'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part13-L.SettlementCharges:section1100-TitleCharges:line1101-TitleServicesAndLender'STitleInsurance-PaidFromBorrower'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part14-L.SettlementCharges:section1200-GovernmentRecordingAndTransferCharges:line1203-TransferTaxes-PaidFromBorrower'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part14-L.SettlementCharges:section1200-GovernmentRecordingAndTransferCharges:line1205-StateTax/Stamps-PaidFromSeller'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line802-YourCreditOrCharge(Points)ForTheSpecificInterestRateChosen-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part11-L.SettlementCharges:section900-ItemsRequiredByLenderToBePaidInAdvance:line901-DailyInterestCharges-PaidFromBorrower'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part11-L.SettlementCharges:section900-ItemsRequiredByLenderToBePaidInAdvance:line903-Homeowner'SInsurance-PaidFromBorrower'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part14-L.SettlementCharges:section1200-GovernmentRecordingAndTransferCharges:line1204-City/CountyTax/Stamps-PaidFromSeller'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line802-YourCreditOrCharge(Points)ForTheSpecificInterestRateChosen-Description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part10-L.SettlementCharges:section800-ItemsPayableInConnectionWithLoan:line803-YourAdjustedOriginationCharges-PaidFromBorrower'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part11-L.SettlementCharges:section900-ItemsRequiredByLenderToBePaidInAdvance:line902-MortgageInsurancePremium-PaidFromBorrower'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part15-L.SettlementCharges:section1300-AdditionalSettlementCharges:line1301-RequiredServicesThatYouCanShopFor-PaidFromBorrower'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part12-L.SettlementCharges:section1000-ReservesDepositedWithLender:line1001-InitialDepositForYourEscrowAccount-PaidFromBorrower'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part14-L.SettlementCharges:section1200-GovernmentRecordingAndTransferCharges:line1201-GovernmentRecordingCharges-PaidFromBorrower'SFundsAtSettlement-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:phoneNumber": {
          "value": "(800) 123-4567",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part01-B.TypeOfLoan:line4-Va": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part01-B.TypeOfLoan:line1-Fha": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part01-B.TypeOfLoan:line2-Rhs": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:i.SettlementDate": {
          "value": "01/01/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:h.SettlementAgent": {
          "value": "SAMPLE REAL ESTATE SERVICES, LLC",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:c.Note:description": {
          "value": "THIS FORM IS FURNISHED TO GIVE YOU A STATEMENT OF ACTUAL SETTLEMENT COSTS. AMOUNTS PAID TO AND BY THE SETTLEMENT AGENT ARE SHOWN. ITEMS MARKED \"(P.O.C.)\" WERE PAID OUTSIDE THE CLOSING; THEY ARE SHOWN HERE FOR INFORMATIONAL PURPOSES AND ARE NOT INCLUDED IN THE TOTALS.",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part01-B.TypeOfLoan:line5-Conv.Ins.": {
          "value": "NOT CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part01-B.TypeOfLoan:line6-FileNumber": {
          "value": "ABC12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part01-B.TypeOfLoan:line7-LoanNumber": {
          "value": "1234567890",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:placeOfSettlement:zip": {
          "value": "12345-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part01-B.TypeOfLoan:line3-Conv.Unins.": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:g.PropertyLocation:zip": {
          "value": "12345-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:placeOfSettlement:city": {
          "value": "SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:g.PropertyLocation:city": {
          "value": "FAKE CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:placeOfSettlement:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:g.PropertyLocation:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:e.Name&AddressOfSeller:zip": {
          "value": "12345-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:f.Name&AddressOfLender:zip": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:e.Name&AddressOfSeller:city": {
          "value": "FAKE CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:f.Name&AddressOfLender:city": {
          "value": "CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:d.Name&AddressOfBorrower:zip": {
          "value": "12345-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:e.Name&AddressOfSeller:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:f.Name&AddressOfLender:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:d.Name&AddressOfBorrower:city": {
          "value": "SAMPLE CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:d.Name&AddressOfBorrower:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:placeOfSettlement:addressLine1": {
          "value": "1234 SAMPLE DRIVE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:placeOfSettlement:addressLine2": {
          "value": "STE. C",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:g.PropertyLocation:addressLine1": {
          "value": "123 SAMPLE MEMORIAL STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:g.PropertyLocation:addressLine2": {
          "value": "UNIT #01",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:e.Name&AddressOfSeller:sellerName": {
          "value": "SMITH SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:f.Name&AddressOfLender:lenderName": {
          "value": "BANK OF SAMPLE LLC",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:e.Name&AddressOfSeller:addressLine1": {
          "value": "123 SAMPLE MEMORIAL STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:e.Name&AddressOfSeller:addressLine2": {
          "value": "UNIT #01",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:f.Name&AddressOfLender:addressLine1": {
          "value": "ABC STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:f.Name&AddressOfLender:addressLine2": {
          "value": "SUITE 12",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:d.Name&AddressOfBorrower:addressLine1": {
          "value": "123 FAKE AVENUE STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:d.Name&AddressOfBorrower:addressLine2": {
          "value": "#12",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part02-General:d.Name&AddressOfBorrower:borrowerName": {
          "value": "JOHN SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part01-B.TypeOfLoan:line8-MortgageInsuranceCaseNumber": {
          "value": "0987654321",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:line420-GrossAmountDueToSeller-Amount": {
          "value": "137000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:line220-TotalPaidBy/ForBorrower-Amount": {
          "value": "190000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:line120-GrossAmountDueFromBorrower-Amount": {
          "value": "257000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:line520-TotalReductionAmountDueSeller-Amount": {
          "value": "95000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-GrossAmountDueToSeller:line403-Amount": {
          "value": "20000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-GrossAmountDueToSeller:line404-Amount": {
          "value": "20000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-GrossAmountDueToSeller:line405-Amount": {
          "value": "20000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-GrossAmountDueToSeller:line403-Description": {
          "value": "SETTLEMENT CHARGES TO BUYER",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-GrossAmountDueToSeller:line404-Description": {
          "value": "AGREEMENT FOR DEED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-GrossAmountDueToSeller:line405-Description": {
          "value": "MORTGAGE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-GrossAmountDueFromBorrower:line104-Amount": {
          "value": "50000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-GrossAmountDueFromBorrower:line105-Amount": {
          "value": "50000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-ReductionsInAmountDueToSeller:line506-Amount": {
          "value": "5000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-ReductionsInAmountDueToSeller:line507-Amount": {
          "value": "5000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-ReductionsInAmountDueToSeller:line508-Amount": {
          "value": "5000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-ReductionsInAmountDueToSeller:line509-Amount": {
          "value": "5000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-GrossAmountDueFromBorrower:line104-Description": {
          "value": "ESCROW",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-GrossAmountDueFromBorrower:line105-Description": {
          "value": "MORTGAGE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line513-Amount": {
          "value": "5000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line514-Amount": {
          "value": "5000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line515-Amount": {
          "value": "5000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line516-Amount": {
          "value": "5000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line517-Amount": {
          "value": "5000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line518-Amount": {
          "value": "5000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line519-Amount": {
          "value": "5000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line204-Amount": {
          "value": "10000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line205-Amount": {
          "value": "10000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line206-Amount": {
          "value": "10000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line207-Amount": {
          "value": "10000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line208-Amount": {
          "value": "10000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line209-Amount": {
          "value": "10000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-ReductionsInAmountDueToSeller:line506-Description": {
          "value": "ADDITIONAL",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-ReductionsInAmountDueToSeller:line507-Description": {
          "value": "(DEPOSIT DISB. AS PROCEEDS)",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-ReductionsInAmountDueToSeller:line508-Description": {
          "value": "OTHER CHARGES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-ReductionsInAmountDueToSeller:line509-Description": {
          "value": "INITIAL CHARGES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part08-K.SummaryOfSeller'STransaction:section600-CashAtSettlementTo/FromSeller:line603-Cash-Amount": {
          "value": "42000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line213-Amount": {
          "value": "10000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line214-Amount": {
          "value": "10000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line215-Amount": {
          "value": "10000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line216-Amount": {
          "value": "10000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line217-Amount": {
          "value": "10000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line218-Amount": {
          "value": "10000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line219-Amount": {
          "value": "10000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part08-K.SummaryOfSeller'STransaction:section600-CashAtSettlementTo/FromSeller:line603-Cash-Checkbox": {
          "value": "CASH TO",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part05-J.SummaryOfBorrower'STransaction:section300-CashAtSettlementFrom/ToBorrower:line303-Cash-Amount": {
          "value": "67000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line513-Description": {
          "value": "ADDITIONAL",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line514-Description": {
          "value": "FIRST MORTGAGE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line515-Description": {
          "value": "SECOND MORTGAGE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line516-Description": {
          "value": "INITIAL DEPOSIT",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line517-Description": {
          "value": "OTHER CHARGES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line518-Description": {
          "value": "OTHER FEES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line519-Description": {
          "value": "TOKEN MONEY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line204-Description": {
          "value": "TOKEN MONEY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line205-Description": {
          "value": "INITIAL DEPOSIT",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line206-Description": {
          "value": "INITIAL DEPOSIT - CHARGES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line207-Description": {
          "value": "FEES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line208-Description": {
          "value": "CHARGES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line209-Description": {
          "value": "ADDITIONAL",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line409-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line410-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line411-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line412-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-GrossAmountDueToSeller:line402-PersonalProperty-Amount": {
          "value": "20000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line213-Description": {
          "value": "ADDITIONAL",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line214-Description": {
          "value": "FIRST MORTGAGE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line215-Description": {
          "value": "SECOND MORTGAGE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line216-Description": {
          "value": "INITIAL DEPOSIT",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line217-Description": {
          "value": "OTHER CHARGES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line218-Description": {
          "value": "OTHER FEES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line219-Description": {
          "value": "TOKEN MONEY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part05-J.SummaryOfBorrower'STransaction:section300-CashAtSettlementFrom/ToBorrower:line303-Cash-Checkbox": {
          "value": "CASH FROM",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line109-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line110-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line111-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line112-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-GrossAmountDueToSeller:line401-ContractSalesPrice-Amount": {
          "value": "50000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-ReductionsInAmountDueToSeller:line501-ExcessDeposit-Amount": {
          "value": "5000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line409-Description": {
          "value": "ESCROW ACCOUNT",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line410-Description": {
          "value": "BROKERAGE ACCOUNT",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line411-Description": {
          "value": "SAVINGS ACCOUNT",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line412-Description": {
          "value": "CHECKING ACCOUNT",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-GrossAmountDueFromBorrower:line102-PersonalProperty-Amount": {
          "value": "50000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line511-CountyTaxes-Amount": {
          "value": "5000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line511-CountyTaxes-DateTo": {
          "value": "09/01/2001",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line512-Assessments-Amount": {
          "value": "5000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line512-Assessments-DateTo": {
          "value": "09/01/2001",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line109-Description": {
          "value": "ESCROW ACCOUNT",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line110-Description": {
          "value": "BROKERAGE ACCOUNT",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line111-Description": {
          "value": "SAVINGS ACCOUNT",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line112-Description": {
          "value": "CHECKING ACCOUNT",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-GrossAmountDueFromBorrower:line101-ContractSalesPrice-Amount": {
          "value": "50000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line211-CountyTaxes-Amount": {
          "value": "10000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line211-CountyTaxes-DateTo": {
          "value": "09/30/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line212-Assessments-Amount": {
          "value": "10000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line212-Assessments-DateTo": {
          "value": "09/30/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line511-CountyTaxes-DateFrom": {
          "value": "07/01/2001",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line512-Assessments-DateFrom": {
          "value": "07/01/2001",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line510-City/TownTaxes-Amount": {
          "value": "5000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line510-City/TownTaxes-DateTo": {
          "value": "09/01/2001",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line211-CountyTaxes-DateFrom": {
          "value": "01/01/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line212-Assessments-DateFrom": {
          "value": "01/01/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line210-City/TownTaxes-Amount": {
          "value": "10000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line210-City/TownTaxes-DateTo": {
          "value": "09/30/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-AdjustmentsForItemsUnpaidBySeller:line510-City/TownTaxes-DateFrom": {
          "value": "07/01/2001",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line407-CountyTaxes-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line407-CountyTaxes-DateTo": {
          "value": "09/30/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line408-Assessments-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line408-Assessments-DateTo": {
          "value": "09/30/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AdjustmentsForItemsUnpaidBySeller:line210-City/TownTaxes-DateFrom": {
          "value": "01/01/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line107-CountyTaxes-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line107-CountyTaxes-DateTo": {
          "value": "09/30/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line108-Assessments-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line108-Assessments-DateTo": {
          "value": "09/30/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line407-CountyTaxes-DateFrom": {
          "value": "01/01/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line408-Assessments-DateFrom": {
          "value": "01/01/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line406-City/TownTaxes-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line406-City/TownTaxes-DateTo": {
          "value": "09/30/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line107-CountyTaxes-DateFrom": {
          "value": "01/01/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line108-Assessments-DateFrom": {
          "value": "01/01/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-ReductionsInAmountDueToSeller:line504-PayoffOfFirstMortgageLoan-Amount": {
          "value": "5000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line106-City/TownTaxes-Amount": {
          "value": "1000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line106-City/TownTaxes-DateTo": {
          "value": "09/30/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line201-DepositOrEarnestMoney-Amount": {
          "value": "10000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part06-K.SummaryOfSeller'STransaction:section400-AdjustmentForItemsPaidBySellerInAdvance:line406-City/TownTaxes-DateFrom": {
          "value": "01/01/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-ReductionsInAmountDueToSeller:line505-PayoffOfSecondMortgageLoan-Amount": {
          "value": "5000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-AdjustmentForItemsPaidBySellerInAdvance:line106-City/TownTaxes-DateFrom": {
          "value": "01/01/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-ReductionsInAmountDueToSeller:line503-ExistingLoan(S)TakenSubjectTo-Amount": {
          "value": "5000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part08-K.SummaryOfSeller'STransaction:section600-CashAtSettlementTo/FromSeller:line601-GrossAmountDueToSeller(Line420)-Amount": {
          "value": "137000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line202-PrincipalAmountOfNewLoan(S)-Amount": {
          "value": "10000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line203-ExistingLoan(S)TakenSubjectTo-Amount": {
          "value": "10000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part07-K.SummaryOfSeller'STransaction:section500-ReductionsInAmountDueToSeller:line502-SettlementChargesToSeller(Line1400)-Amount": {
          "value": "5000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part03-J.SummaryOfBorrower'STransaction:section100-GrossAmountDueFromBorrower:line103-SettlementChargesToBorrower(Line1400)-Amount": {
          "value": "50000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part04-J.SummaryOfBorrower'STransaction:section200-AmountPaidByOrInBehalfOfBorrower:line202-PrincipalAmountOfNewLoan(S)-Description": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part05-J.SummaryOfBorrower'STransaction:section300-CashAtSettlementFrom/ToBorrower:line301-GrossAmountDueFromBorrower(Line120)-Amount": {
          "value": "257000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part08-K.SummaryOfSeller'STransaction:section600-CashAtSettlementTo/FromSeller:line602-LessReductionsInAmountsDueSeller(Line520)-Amount": {
          "value": "-95000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        },
        "hud_1_settlement_statement-Part05-J.SummaryOfBorrower'STransaction:section300-CashAtSettlementFrom/ToBorrower:line302-LessAmountsPaidBy/ForBorrower(Line220)-Amount": {
          "value": "-190000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "HUD-1 SETTLEMENT STATEMENT.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 309250,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Closing
Disclosure
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