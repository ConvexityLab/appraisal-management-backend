# Balance Sheet

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
Annuity Award Letter
Balance Sheet
Career Data Brief
Change in Benefits Notice
Combat-Related Special Compensation (CRSC) Pay Statement
Disability Award Letter
IRS Form SSA-1099 - Social Security Benefit Statement
Member Data Summary
Office of Personnel Management (OPM) Annuity Statement
Income calculation definitions
Pay Stub
Pension Award Letter
Profit and Loss Statement
Social Security Award Letter
Soldier Talent Profile
Veterans Affairs (VA) Award Letter
VOE (1005) - Request for Verification of Employment
VOE (generic) - Verification of Employment Report
VOE (work number) - The Work Number Verification of Employment Report
VOIE (Finicity) - Finicity Verification of Income and Employment
Legal
Mortgage specific forms
Other
Property
Tax forms
Data types
Balance Sheet
Suggest Edits

A balance sheet is a financial statement detailing a company's assets or liabilities at a specific point in time. It is one of the main financial statements used for evaluating the performance of a business.

To use the Upload PDF endpoint for this document, you must use BALANCE_SHEET in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
balance_sheet-PartI-General:companyName	Text	Company Name
balance_sheet-PartI-General:documentDate	Date	Document Date
balance_sheet-PartIi-Assets:currentAssets-Cash&CashEquivalents(CurrentYear)	Money	Current Assets - Cash & Cash Equivalents (Current Year)
balance_sheet-PartIi-Assets:currentAssets-Cash&CashEquivalents(PreviousYear)	Money	Current Assets - Cash & Cash Equivalents (Previous Year)
balance_sheet-PartIi-Assets:currentAssets-ShortTermInvestments(CurrentYear)	Money	Current Assets - Short Term Investments (Current Year)
balance_sheet-PartIi-Assets:currentAssets-ShortTermInvestments(PreviousYear)	Money	Current Assets - Short Term Investments (Previous Year)
balance_sheet-PartIi-Assets:currentAssets-AccountsReceivable(CurrentYear)	Money	Current Assets - Accounts Receivable (Current Year)
balance_sheet-PartIi-Assets:currentAssets-AccountsReceivable(PreviousYear)	Money	Current Assets - Accounts Receivable (Previous Year)
balance_sheet-PartIi-Assets:totalCurrentAssets-CurrentYear	Money	Total Current Assets - Current Year
balance_sheet-PartIi-Assets:totalCurrentAssets-PreviousYear	Money	Total Current Assets - Previous Year
balance_sheet-PartIi-Assets:propertyPlantAndEquipmentNet-CurrentYear	Money	Property Plant And Equipment Net - Current Year
balance_sheet-PartIi-Assets:propertyPlantAndEquipmentNet-PreviousYear	Money	Property Plant And Equipment Net - Previous Year
balance_sheet-PartIi-Assets:otherCurrentAssets-CurrentYear	Money	Other Current Assets - Current Year
balance_sheet-PartIi-Assets:otherCurrentAssets-PreviousYear	Money	Other Current Assets - Previous Year
balance_sheet-PartIi-Assets:otherNon-CurrentAssets-CurrentYear	Money	Other Non-Current Assets - Current Year
balance_sheet-PartIi-Assets:otherNon-CurrentAssets-PreviousYear	Money	Other Non-Current Assets - Previous Year
balance_sheet-PartIi-Assets:otherAssets-CurrentYear	Money	Other Assets - Current Year
balance_sheet-PartIi-Assets:otherAssets-PreviousYear	Money	Other Assets - Previous Year
balance_sheet-PartIi-Assets:totalAssets-CurrentYear	Money	Total Assets - Current Year
balance_sheet-PartIi-Assets:totalAssets-PreviousYear	Money	Total Assets - Previous Year
balance_sheet-PartIii-Liabilities&Equities:accountsPayableLiabilities-CurrentYear	Money	Accounts Payable Liabilities - Current Year
balance_sheet-PartIii-Liabilities&Equities:accountsPayableLiabilities-PreviousYear	Money	Accounts Payable Liabilities - Previous Year
balance_sheet-PartIii-Liabilities&Equities:otherCurrentLiabilities-CurrentYear	Money	Other Current Liabilities - Current Year
balance_sheet-PartIii-Liabilities&Equities:otherCurrentLiabilities-PreviousYear	Money	Other Current Liabilities - Previous Year
balance_sheet-PartIii-Liabilities&Equities:otherNon-CurrentLiabilities-CurrentYear	Money	Other Non-Current Liabilities - Current Year
balance_sheet-PartIii-Liabilities&Equities:otherNon-CurrentLiabilities-PreviousYear	Money	Other Non-Current Liabilities - Previous Year
balance_sheet-PartIii-Liabilities&Equities:otherLiabilities-CurrentYear	Money	Other Liabilities - Current Year
balance_sheet-PartIii-Liabilities&Equities:otherLiabilities-PreviousYear	Money	Other Liabilities - Previous Year
balance_sheet-PartIii-Liabilities&Equities:payrollLiabilities-CurrentYear	Money	Payroll Liabilities - Current Year
balance_sheet-PartIii-Liabilities&Equities:payrollLiabilities-PreviousYear	Money	Payroll Liabilities - Previous Year
balance_sheet-PartIii-Liabilities&Equities:taxesPayable-CurrentYear	Money	Taxes Payable - Current Year
balance_sheet-PartIii-Liabilities&Equities:taxesPayable-PreviousYear	Money	Taxes Payable - Previous Year
balance_sheet-PartIii-Liabilities&Equities:currentLiabilitiesTotal-CurrentYear	Money	Current Liabilities Total - Current Year
balance_sheet-PartIii-Liabilities&Equities:currentLiabilitiesTotal-PreviousYear	Money	Current Liabilities Total - Previous Year
balance_sheet-PartIii-Liabilities&Equities:long-termLiabilitiesTotal-CurrentYear	Money	Long-Term Liabilities Total - Current Year
balance_sheet-PartIii-Liabilities&Equities:long-termLiabilitiesTotal-PreviousYear	Money	Long-Term Liabilities Total - Previous Year
balance_sheet-PartIii-Liabilities&Equities:totalLiabilities-CurrentYear	Money	Total Liabilities - Current Year
balance_sheet-PartIii-Liabilities&Equities:totalLiabilities-PreviousYear	Money	Total Liabilities - Previous Year
balance_sheet-PartIii-Liabilities&Equities:retainedEarnings-CurrentYear	Money	Retained Earnings - Current Year
balance_sheet-PartIii-Liabilities&Equities:retainedEarnings-PreviousYear	Money	Retained Earnings - Previous Year
balance_sheet-PartIii-Liabilities&Equities:totalShareholdersEquity-CurrentYear	Money	Total Shareholders Equity - Current Year
balance_sheet-PartIii-Liabilities&Equities:totalShareholdersEquity-PreviousYear	Money	Total Shareholders Equity - Previous Year
balance_sheet-PartIii-Liabilities&Equities:totalLiabilitiesAndShareholdersEquity-CurrentYear	Money	Total Liabilities And Shareholders Equity - Current Year
balance_sheet-PartIii-Liabilities&Equities:totalLiabilitiesAndShareholdersEquity-PreviousYear	Money	Total Liabilities And Shareholders Equity - Previous Year
Sample document
drive.google.com
API Balance Sheet (1).pdf
Sample JSON result
JSON
{
   "status":200,
   "response":{
      "pk":30312507,
      "uuid":"ad7d9833-f583-46b0-b837-1d771b68639c",
      "name":"Balance sheet",
      "created":"2023-03-06T16:23:46Z",
      "created_ts":"2023-03-06T16:23:46Z",
      "verified_pages_count":2,
      "book_status":"ACTIVE",
      "id":30312507,
      "forms":[
         {
            "pk":44712185,
            "uuid":"8696e86c-af6c-4249-96c3-1735298fa869",
            "uploaded_doc_pk":52501970,
            "form_type":"BALANCE_SHEET",
            "raw_fields":{
               "balance_sheet-PartI-General:companyName":{
                  "value":"A SAMPLE, INC.",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartI-General:documentDate":{
                  "value":"12/31/2022",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIi-Assets:otherAssets-CurrentYear":{
                  "value":"240031.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIi-Assets:totalAssets-CurrentYear":{
                  "value":"6858029.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIi-Assets:otherAssets-PreviousYear":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIi-Assets:totalAssets-PreviousYear":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIi-Assets:otherCurrentAssets-CurrentYear":{
                  "value":"274321.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIi-Assets:totalCurrentAssets-CurrentYear":{
                  "value":"5356120.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIi-Assets:otherCurrentAssets-PreviousYear":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIi-Assets:totalCurrentAssets-PreviousYear":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIi-Assets:otherNon-CurrentAssets-CurrentYear":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIi-Assets:otherNon-CurrentAssets-PreviousYear":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIi-Assets:propertyPlantAndEquipmentNet-CurrentYear":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIi-Assets:propertyPlantAndEquipmentNet-PreviousYear":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIi-Assets:currentAssets-AccountsReceivable(CurrentYear)":{
                  "value":"3593607.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIi-Assets:currentAssets-AccountsReceivable(PreviousYear)":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIi-Assets:currentAssets-Cash&CashEquivalents(CurrentYear)":{
                  "value":"898401.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIi-Assets:currentAssets-ShortTermInvestments(CurrentYear)":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIi-Assets:currentAssets-Cash&CashEquivalents(PreviousYear)":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIi-Assets:currentAssets-ShortTermInvestments(PreviousYear)":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIii-Liabilities&Equities:currentLiabilitiesTotal-CurrentYear":{
                  "value":"2016260.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIii-Liabilities&Equities:otherCurrentLiabilities-CurrentYear":{
                  "value":"500636.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIii-Liabilities&Equities:currentLiabilitiesTotal-PreviousYear":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIii-Liabilities&Equities:otherCurrentLiabilities-PreviousYear":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIii-Liabilities&Equities:accountsPayableLiabilities-CurrentYear":{
                  "value":"548642.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIii-Liabilities&Equities:accountsPayableLiabilities-PreviousYear":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIii-Liabilities&Equities:taxesPayable-CurrentYear":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIii-Liabilities&Equities:taxesPayable-PreviousYear":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIii-Liabilities&Equities:otherLiabilities-CurrentYear":{
                  "value":"267463.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIii-Liabilities&Equities:retainedEarnings-CurrentYear":{
                  "value":"3758200.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIii-Liabilities&Equities:totalLiabilities-CurrentYear":{
                  "value":"2887230.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIii-Liabilities&Equities:otherLiabilities-PreviousYear":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIii-Liabilities&Equities:retainedEarnings-PreviousYear":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIii-Liabilities&Equities:totalLiabilities-PreviousYear":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIii-Liabilities&Equities:payrollLiabilities-CurrentYear":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIii-Liabilities&Equities:payrollLiabilities-PreviousYear":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIii-Liabilities&Equities:totalShareholdersEquity-CurrentYear":{
                  "value":"3970799.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIii-Liabilities&Equities:totalShareholdersEquity-PreviousYear":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIii-Liabilities&Equities:long-termLiabilitiesTotal-CurrentYear":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIii-Liabilities&Equities:long-termLiabilitiesTotal-PreviousYear":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIii-Liabilities&Equities:otherNon-CurrentLiabilities-CurrentYear":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIii-Liabilities&Equities:otherNon-CurrentLiabilities-PreviousYear":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIii-Liabilities&Equities:totalLiabilitiesAndShareholdersEquity-CurrentYear":{
                  "value":"6858029.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               },
               "balance_sheet-PartIii-Liabilities&Equities:totalLiabilitiesAndShareholdersEquity-PreviousYear":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"API Balance Sheet (1).pdf"
               }
            },
            "form_config_pk":170283,
            "tables":[
               
            ]
         }
      ],
      "book_is_complete":true
   },
   "message":"OK"
}


Updated 11 months ago

Annuity Award Letter
Career Data Brief
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