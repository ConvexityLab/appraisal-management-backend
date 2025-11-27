# Purchase Contract

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
Disclosure
Identification
Income/Employment
Legal
Mortgage specific forms
Other
Property
1004 - Uniform Residential Appraisal Report
1032 - One-Unit Residential Appraisal Field Review Report
Appraisal Notice
Certificate of Liability Insurance
Final Inspection
Homeowners Association Statement
Homeowner Insurance Policy - Insurance Binder
Mortgage Statement
Payoff Letter
Preliminary Title Report
Property Tax Bill
Purchase Contract
Residential Lease Agreement
Tax forms
Data types
Purchase Contract
Suggest Edits

A purchase contract, or purchase agreement, is a contract between a purchaser and a seller. It outlines the different terms and conditions that relate to a sale.

To use the Upload PDF endpoint for this document, you must use PURCHASE_CONTRACT-PAGEINFORMATION in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
purchase_contract-PageInformation:buyer1-NotePagesWithMissingInitials(CommaSeparated)	Text	Buyer 1 - Note Pages With Missing Initials (Comma Separated)
purchase_contract-PageInformation:buyer2-NotePagesWithMissingInitials(CommaSeparated)	Text	Buyer 2 - Note Pages With Missing Initials (Comma Separated)
purchase_contract-PageInformation:seller1-NotePagesWithMissingInitials(CommaSeparated)	Text	Seller 1 - Note Pages With Missing Initials (Comma Separated)
purchase_contract-PageInformation:seller2-NotePagesWithMissingInitials(CommaSeparated)	Text	Seller 2 - Note Pages With Missing Initials (Comma Separated)
purchase_contract-Part1-PurchaseContract-General:date	Date	Date
purchase_contract-Part1-PurchaseContract-General:sellerName1	Text	Seller Name 1
purchase_contract-Part1-PurchaseContract-General:sellerName2	Text	Seller Name 2
purchase_contract-Part1-PurchaseContract-General:buyerName1	Text	Buyer Name 1
purchase_contract-Part1-PurchaseContract-General:buyerName2	Text	Buyer Name 2
purchase_contract-Part1-PurchaseContract-General:purchaseContract-OfferExpirationDate	Date	Purchase Contract - Offer Expiration Date
purchase_contract-Part1-PurchaseContract-General:purchaseContract-ClosingDate	Date	Purchase Contract - Closing Date
purchase_contract-Part1-PurchaseContract-General:purchaseContract-PurchasePropertyAddress:addressLine1	Text	Purchase Contract - Purchase Property Address
purchase_contract-Part1-PurchaseContract-General:purchaseContract-PurchasePropertyAddress:addressLine2	Text	Purchase Contract - Purchase Property Address
purchase_contract-Part1-PurchaseContract-General:purchaseContract-PurchasePropertyAddress:city	City	Purchase Contract - Purchase Property Address
purchase_contract-Part1-PurchaseContract-General:purchaseContract-PurchasePropertyAddress:state	State	Purchase Contract - Purchase Property Address
purchase_contract-Part1-PurchaseContract-General:purchaseContract-PurchasePropertyAddress:zip	ZIP Code	Purchase Contract - Purchase Property Address
purchase_contract-Part1-PurchaseContract-General:purchaseContract-AssessorParcelNumber	Text	Purchase Contract - Assessor Parcel Number
purchase_contract-Part2-PurchaseContract-PurchasePrice&Financing:purchaseContract-PurchasePrice(SalesPrice)	Money	Purchase Contract - Purchase Price (Sales Price)
purchase_contract-Part2-PurchaseContract-PurchasePrice&Financing:purchaseContract-LoanAmount($)	Money	Purchase Contract - Loan Amount ($)
purchase_contract-Part2-PurchaseContract-PurchasePrice&Financing:purchaseContract-EarnestMoney(EscrowDeposit)	Money	Purchase Contract - Earnest Money (Escrow Deposit)
purchase_contract-Part2-PurchaseContract-PurchasePrice&Financing:purchaseContract-AdditionalEscrowDeposit(IfAny)	Money	Purchase Contract - Additional Escrow Deposit (If Any)
purchase_contract-Part2-PurchaseContract-PurchasePrice&Financing:purchaseContract-SellerConcessions-Amount	Money	Purchase Contract - Seller Concessions - Amount
purchase_contract-Part2-PurchaseContract-PurchasePrice&Financing:purchaseContract-SellerConcessions-Percentage	Percentage	Purchase Contract - Seller Concessions - Percentage
purchase_contract-Part3-PurchaseContract-Signatures:purchaseContract-ContractSignedByBuyer1?	SIGNED, NOT SIGNED	Purchase Contract - Contract Signed By Buyer 1?
purchase_contract-Part3-PurchaseContract-Signatures:purchaseContract-ContractSignedByBuyer2?	SIGNED, NOT SIGNED	Purchase Contract - Contract Signed By Buyer 2?
purchase_contract-Part3-PurchaseContract-Signatures:purchaseContract-DateOfBuyer1Signature	Date	Purchase Contract - Date Of Buyer 1 Signature
purchase_contract-Part3-PurchaseContract-Signatures:purchaseContract-DateOfBuyer2Signature	Date	Purchase Contract - Date Of Buyer 2 Signature
purchase_contract-Part3-PurchaseContract-Signatures:purchaseContract-ContractSignedBySeller1?	SIGNED, NOT SIGNED	Purchase Contract - Contract Signed By Seller 1?
purchase_contract-Part3-PurchaseContract-Signatures:purchaseContract-ContractSignedBySeller2?	SIGNED, NOT SIGNED	Purchase Contract - Contract Signed By Seller 2?
purchase_contract-Part3-PurchaseContract-Signatures:purchaseContract-DateOfSeller1Signature	Date	Purchase Contract - Date Of Seller 1 Signature
purchase_contract-Part3-PurchaseContract-Signatures:purchaseContract-DateOfSeller2Signature	Date	Purchase Contract - Date Of Seller 2 Signature
purchase_contract-Part4-Addendum-General:addendum-Date	Date	Addendum - Date
purchase_contract-Part4-Addendum-General:addendum-OfferExpirationDate	Date	Addendum - Offer Expiration Date
purchase_contract-Part4-Addendum-General:addendum-ClosingDate	Date	Addendum - Closing Date
purchase_contract-Part4-Addendum-General:addendum-PurchasePropertyAddress:addressLine1	Text	Addendum - Purchase Property Address
purchase_contract-Part4-Addendum-General:addendum-PurchasePropertyAddress:addressLine2	Text	Addendum - Purchase Property Address
purchase_contract-Part4-Addendum-General:addendum-PurchasePropertyAddress:city	City	Addendum - Purchase Property Address
purchase_contract-Part4-Addendum-General:addendum-PurchasePropertyAddress:state	State	Addendum - Purchase Property Address
purchase_contract-Part4-Addendum-General:addendum-PurchasePropertyAddress:zip	ZIP Code	Addendum - Purchase Property Address
purchase_contract-Part5-Addendum-PurchasePrice&Financing:addendum-PurchasePrice(SalesPrice)	Money	Addendum - Purchase Price (Sales Price)
purchase_contract-Part5-Addendum-PurchasePrice&Financing:addendum-LoanAmount($)	Money	Addendum - Loan Amount ($)
purchase_contract-Part5-Addendum-PurchasePrice&Financing:addendum-EarnestMoney(EscrowDeposit)	Money	Addendum - Earnest Money (Escrow Deposit)
purchase_contract-Part5-Addendum-PurchasePrice&Financing:addendum-AdditionalEscrowDeposit(IfAny)	Money	Addendum - Additional Escrow Deposit (If Any)
purchase_contract-Part5-Addendum-PurchasePrice&Financing:addendum-SellerConcessions-Amount	Money	Addendum - Seller Concessions - Amount
purchase_contract-Part5-Addendum-PurchasePrice&Financing:addendum-SellerConcessions-Percentage	Percentage	Addendum - Seller Concessions - Percentage
purchase_contract-Part6-Addendum-Signatures:addendum-ContractSignedByBuyer1?	SIGNED, NOT SIGNED	Addendum - Contract Signed By Buyer 1?
purchase_contract-Part6-Addendum-Signatures:addendum-ContractSignedByBuyer2?	SIGNED, NOT SIGNED	Addendum - Contract Signed By Buyer 2?
purchase_contract-Part6-Addendum-Signatures:addendum-DateOfBuyer1Signature	Date	Addendum - Date Of Buyer 1 Signature
purchase_contract-Part6-Addendum-Signatures:addendum-DateOfBuyer2Signature	Date	Addendum - Date Of Buyer 2 Signature
purchase_contract-Part6-Addendum-Signatures:addendum-ContractSignedBySeller1?	SIGNED, NOT SIGNED	Addendum - Contract Signed By Seller 1?
purchase_contract-Part6-Addendum-Signatures:addendum-ContractSignedBySeller2?	SIGNED, NOT SIGNED	Addendum - Contract Signed By Seller 2?
purchase_contract-Part6-Addendum-Signatures:addendum-DateOfSeller1Signature	Date	Addendum - Date Of Seller 1 Signature
purchase_contract-Part6-Addendum-Signatures:addendum-DateOfSeller2Signature	Date	Addendum - Date Of Seller 2 Signature
purchase_contract-Part7-CounterOffer-General:counterOffer-Date	Date	Counter Offer - Date
purchase_contract-Part7-CounterOffer-General:counterOffer-OfferExpirationDate	Date	Counter Offer - Offer Expiration Date
purchase_contract-Part7-CounterOffer-General:counterOffer-ClosingDate	Date	Counter Offer - Closing Date
purchase_contract-Part7-CounterOffer-General:counterOffer-PurchasePropertyAddress:addressLine1	Text	Counter Offer - Purchase Property Address
purchase_contract-Part7-CounterOffer-General:counterOffer-PurchasePropertyAddress:addressLine2	Text	Counter Offer - Purchase Property Address
purchase_contract-Part7-CounterOffer-General:counterOffer-PurchasePropertyAddress:city	City	Counter Offer - Purchase Property Address
purchase_contract-Part7-CounterOffer-General:counterOffer-PurchasePropertyAddress:state	State	Counter Offer - Purchase Property Address
purchase_contract-Part7-CounterOffer-General:counterOffer-PurchasePropertyAddress:zip	ZIP Code	Counter Offer - Purchase Property Address
purchase_contract-Part8-CounterOffer-PurchasePrice&Financing:counterOffer-PurchasePrice(SalesPrice)	Money	Counter Offer - Purchase Price (Sales Price)
purchase_contract-Part8-CounterOffer-PurchasePrice&Financing:counterOffer-LoanAmount($)	Money	Counter Offer - Loan Amount ($)
purchase_contract-Part8-CounterOffer-PurchasePrice&Financing:counterOffer-EarnestMoney(EscrowDeposit)	Money	Counter Offer - Earnest Money (Escrow Deposit)
purchase_contract-Part8-CounterOffer-PurchasePrice&Financing:counterOffer-AdditionalEscrowDeposit(IfAny)	Money	Counter Offer - Additional Escrow Deposit (If Any)
purchase_contract-Part8-CounterOffer-PurchasePrice&Financing:counterOffer-SellerConcessions-Amount	Money	Counter Offer - Seller Concessions - Amount
purchase_contract-Part8-CounterOffer-PurchasePrice&Financing:counterOffer-SellerConcessions-Percentage	Percentage	Counter Offer - Seller Concessions - Percentage
purchase_contract-Part9-CounterOffer-Signatures:counterOffer-ContractSignedByBuyer1?	SIGNED, NOT SIGNED	Counter Offer - Contract Signed By Buyer 1?
purchase_contract-Part9-CounterOffer-Signatures:counterOffer-ContractSignedByBuyer2?	SIGNED, NOT SIGNED	Counter Offer - Contract Signed By Buyer 2?
purchase_contract-Part9-CounterOffer-Signatures:counterOffer-DateOfBuyer1Signature	Date	Counter Offer - Date Of Buyer 1 Signature
purchase_contract-Part9-CounterOffer-Signatures:counterOffer-DateOfBuyer2Signature	Date	Counter Offer - Date Of Buyer 2 Signature
purchase_contract-Part9-CounterOffer-Signatures:counterOffer-ContractSignedBySeller1?	SIGNED, NOT SIGNED	Counter Offer - Contract Signed By Seller 1?
purchase_contract-Part9-CounterOffer-Signatures:counterOffer-ContractSignedBySeller2?	SIGNED, NOT SIGNED	Counter Offer - Contract Signed By Seller 2?
purchase_contract-Part9-CounterOffer-Signatures:counterOffer-DateOfSeller1Signature	Date	Counter Offer - Date Of Seller 1 Signature
purchase_contract-Part9-CounterOffer-Signatures:counterOffer-DateOfSeller2Signature	Date	Counter Offer - Date Of Seller 2 Signature
Sample document
drive.google.com
Purchase Contract PDF Sample.pdf
Sample JSON result
JSON
{
	"status": 200,
	"response": {
		"pk": 28332710,
		"uuid": "21628227-2696-4c65-aeb4-32d126ddecd7",
		"name": "Purchase Contract - API",
		"created": "2023-01-17T19:22:20Z",
		"created_ts": "2023-01-17T19:22:20Z",
		"verified_pages_count": 7,
		"book_status": "ACTIVE",
		"id": 28332710,
		"forms": [{
			"pk": 43554364,
			"uuid": "ff64de38-6cb0-4aab-9607-4fdc3b6ceefc",
			"uploaded_doc_pk": 50501529,
			"form_type": "PURCHASE_CONTRACT",
			"raw_fields": {
				"purchase_contract-Part1-PurchaseContract-General:date": {
					"value": "12/10/2022",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part1-PurchaseContract-General:buyerName1": {
					"value": "JOHN SAMPLE",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part1-PurchaseContract-General:buyerName2": {
					"value": "DAVID SAMPLE",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part1-PurchaseContract-General:sellerName1": {
					"value": "JAMES FAKE",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part1-PurchaseContract-General:sellerName2": {
					"value": "ROBERT FAKE",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part1-PurchaseContract-General:purchaseContract-AssessorParcelNumber": {
					"value": "AD897654321",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part1-PurchaseContract-General:purchaseContract-PurchasePropertyAddress:zip": {
					"value": "98765",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part1-PurchaseContract-General:purchaseContract-PurchasePropertyAddress:city": {
					"value": "NEW YORK",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part1-PurchaseContract-General:purchaseContract-PurchasePropertyAddress:state": {
					"value": "NY",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part2-PurchaseContract-PurchasePrice&Financing:purchaseContract-LoanAmount($)": {
					"value": "15000.00",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part1-PurchaseContract-General:purchaseContract-PurchasePropertyAddress:addressLine1": {
					"value": "12 MAIN STREET",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part1-PurchaseContract-General:purchaseContract-PurchasePropertyAddress:addressLine2": {
					"value": "",
					"is_empty": true,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part2-PurchaseContract-PurchasePrice&Financing:purchaseContract-SellerConcessions-Amount": {
					"value": "",
					"is_empty": true,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part2-PurchaseContract-PurchasePrice&Financing:purchaseContract-PurchasePrice(SalesPrice)": {
					"value": "20000.00",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part2-PurchaseContract-PurchasePrice&Financing:purchaseContract-EarnestMoney(EscrowDeposit)": {
					"value": "5000.00",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part2-PurchaseContract-PurchasePrice&Financing:purchaseContract-SellerConcessions-Percentage": {
					"value": "",
					"is_empty": true,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part2-PurchaseContract-PurchasePrice&Financing:purchaseContract-AdditionalEscrowDeposit(IfAny)": {
					"value": "",
					"is_empty": true,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part7-CounterOffer-General:counterOffer-Date": {
					"value": "01/15/2023",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part7-CounterOffer-General:counterOffer-ClosingDate": {
					"value": "",
					"is_empty": true,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part7-CounterOffer-General:counterOffer-OfferExpirationDate": {
					"value": "",
					"is_empty": true,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part9-CounterOffer-Signatures:counterOffer-DateOfBuyer1Signature": {
					"value": "01/15/2023",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part9-CounterOffer-Signatures:counterOffer-DateOfBuyer2Signature": {
					"value": "01/15/2023",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part9-CounterOffer-Signatures:counterOffer-DateOfSeller1Signature": {
					"value": "01/15/2023",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part9-CounterOffer-Signatures:counterOffer-DateOfSeller2Signature": {
					"value": "01/15/2023",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part9-CounterOffer-Signatures:counterOffer-ContractSignedByBuyer1?": {
					"value": "SIGNED",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part9-CounterOffer-Signatures:counterOffer-ContractSignedByBuyer2?": {
					"value": "SIGNED",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part7-CounterOffer-General:counterOffer-PurchasePropertyAddress:zip": {
					"value": "98765",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part9-CounterOffer-Signatures:counterOffer-ContractSignedBySeller1?": {
					"value": "SIGNED",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part9-CounterOffer-Signatures:counterOffer-ContractSignedBySeller2?": {
					"value": "SIGNED",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part7-CounterOffer-General:counterOffer-PurchasePropertyAddress:city": {
					"value": "NEW YORK",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part7-CounterOffer-General:counterOffer-PurchasePropertyAddress:state": {
					"value": "NY",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part8-CounterOffer-PurchasePrice&Financing:counterOffer-LoanAmount($)": {
					"value": "12000.00",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part7-CounterOffer-General:counterOffer-PurchasePropertyAddress:addressLine1": {
					"value": "12 MAIN STREET",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part7-CounterOffer-General:counterOffer-PurchasePropertyAddress:addressLine2": {
					"value": "",
					"is_empty": true,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part8-CounterOffer-PurchasePrice&Financing:counterOffer-SellerConcessions-Amount": {
					"value": "",
					"is_empty": true,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part8-CounterOffer-PurchasePrice&Financing:counterOffer-PurchasePrice(SalesPrice)": {
					"value": "18000.00",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part8-CounterOffer-PurchasePrice&Financing:counterOffer-EarnestMoney(EscrowDeposit)": {
					"value": "200.00",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part8-CounterOffer-PurchasePrice&Financing:counterOffer-SellerConcessions-Percentage": {
					"value": "",
					"is_empty": true,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part8-CounterOffer-PurchasePrice&Financing:counterOffer-AdditionalEscrowDeposit(IfAny)": {
					"value": "",
					"is_empty": true,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part4-Addendum-General:addendum-Date": {
					"value": "01/05/2023",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part4-Addendum-General:addendum-ClosingDate": {
					"value": "",
					"is_empty": true,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part4-Addendum-General:addendum-OfferExpirationDate": {
					"value": "",
					"is_empty": true,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part6-Addendum-Signatures:addendum-DateOfBuyer1Signature": {
					"value": "01/05/2023",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part6-Addendum-Signatures:addendum-DateOfBuyer2Signature": {
					"value": "01/05/2023",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part6-Addendum-Signatures:addendum-DateOfSeller1Signature": {
					"value": "01/05/2023",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part6-Addendum-Signatures:addendum-DateOfSeller2Signature": {
					"value": "01/05/2023",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part6-Addendum-Signatures:addendum-ContractSignedByBuyer1?": {
					"value": "SIGNED",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part6-Addendum-Signatures:addendum-ContractSignedByBuyer2?": {
					"value": "SIGNED",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part4-Addendum-General:addendum-PurchasePropertyAddress:zip": {
					"value": "98765",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part6-Addendum-Signatures:addendum-ContractSignedBySeller1?": {
					"value": "SIGNED",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part6-Addendum-Signatures:addendum-ContractSignedBySeller2?": {
					"value": "SIGNED",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part4-Addendum-General:addendum-PurchasePropertyAddress:city": {
					"value": "NEW YORK",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part4-Addendum-General:addendum-PurchasePropertyAddress:state": {
					"value": "NY",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part5-Addendum-PurchasePrice&Financing:addendum-LoanAmount($)": {
					"value": "",
					"is_empty": true,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part4-Addendum-General:addendum-PurchasePropertyAddress:addressLine1": {
					"value": "12 MAIN STREET",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part4-Addendum-General:addendum-PurchasePropertyAddress:addressLine2": {
					"value": "",
					"is_empty": true,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part5-Addendum-PurchasePrice&Financing:addendum-SellerConcessions-Amount": {
					"value": "",
					"is_empty": true,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part5-Addendum-PurchasePrice&Financing:addendum-PurchasePrice(SalesPrice)": {
					"value": "19000.00",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part5-Addendum-PurchasePrice&Financing:addendum-EarnestMoney(EscrowDeposit)": {
					"value": "",
					"is_empty": true,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part5-Addendum-PurchasePrice&Financing:addendum-SellerConcessions-Percentage": {
					"value": "",
					"is_empty": true,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part5-Addendum-PurchasePrice&Financing:addendum-AdditionalEscrowDeposit(IfAny)": {
					"value": "",
					"is_empty": true,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part3-PurchaseContract-Signatures:purchaseContract-DateOfSeller1Signature": {
					"value": "12/30/2022",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part3-PurchaseContract-Signatures:purchaseContract-DateOfSeller2Signature": {
					"value": "12/30/2022",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part3-PurchaseContract-Signatures:purchaseContract-ContractSignedBySeller1?": {
					"value": "SIGNED",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part3-PurchaseContract-Signatures:purchaseContract-ContractSignedBySeller2?": {
					"value": "SIGNED",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part1-PurchaseContract-General:purchaseContract-ClosingDate": {
					"value": "",
					"is_empty": true,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part1-PurchaseContract-General:purchaseContract-OfferExpirationDate": {
					"value": "01/31/2023",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part3-PurchaseContract-Signatures:purchaseContract-DateOfBuyer1Signature": {
					"value": "12/30/2022",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part3-PurchaseContract-Signatures:purchaseContract-DateOfBuyer2Signature": {
					"value": "12/30/2022",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part3-PurchaseContract-Signatures:purchaseContract-ContractSignedByBuyer1?": {
					"value": "SIGNED",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-Part3-PurchaseContract-Signatures:purchaseContract-ContractSignedByBuyer2?": {
					"value": "SIGNED",
					"is_empty": false,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-PageInformation:buyer1-NotePagesWithMissingInitials(CommaSeparated)": {
					"value": "",
					"is_empty": true,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-PageInformation:buyer2-NotePagesWithMissingInitials(CommaSeparated)": {
					"value": "",
					"is_empty": true,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-PageInformation:seller1-NotePagesWithMissingInitials(CommaSeparated)": {
					"value": "",
					"is_empty": true,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				},
				"purchase_contract-PageInformation:seller2-NotePagesWithMissingInitials(CommaSeparated)": {
					"value": "",
					"is_empty": true,
					"alias_used": null,
					"source_filename": "API - Purchase Contract Sample.pdf"
				}
			},
			"form_config_pk": 167340,
			"tables": []
		}],
		"book_is_complete": true
	},
	"message": "OK"
}


Updated 11 months ago

Property Tax Bill
Residential Lease Agreement
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