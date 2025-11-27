# Profit and Loss Statement

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
Profit and Loss Statement
Suggest Edits

A profit and loss statement, also known as a P&L or an income statement is a financial report that shows how much your business has spent and earned over a specified time. It also shows whether you've made a profit or a loss over that time.

To use the Upload PDF endpoint for this document, you must use PROFIT_AND_LOSS in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
profit_and_loss-Part1-General:companyName	Text	Company Name
profit_and_loss-Part1-General:periodOfProfitAndLoss:beginingDate	Date	Period Of Profit And Loss
profit_and_loss-Part1-General:periodOfProfitAndLoss:closingDate	Date	Period Of Profit And Loss
profit_and_loss-Part2-Sales&Revenue:salesReturnsAndAllowances	Money	Sales Returns And Allowances
profit_and_loss-Part2-Sales&Revenue:salesTotal	Money	Sales Total
profit_and_loss-Part2-Sales&Revenue:totalIncome	Money	Total Income
profit_and_loss-Part2-Sales&Revenue:grossProfit	Money	Gross Profit
profit_and_loss-Part3-Expenses&NetProfit:totalExpenses	Money	Total Expenses
profit_and_loss-Part3-Expenses&NetProfit:netIncome	Money	Net Income
profit_and_loss-Part3-Expenses&NetProfit:isSigned?	YES, NO	Is Signed?
profit_and_loss-Part3-Expenses&NetProfit:isDated?	YES, NO	Is Dated?
Sample document
drive.google.com
Profit and Loss Sample.pdf
Sample JSON result
JSON
{
   "status":200,
   "response":{
      "pk":45702308,
      "uuid":"cef68afa-096d-45c7-827d-a0ff9168b9eb",
      "forms":[
         {
            "pk":40493532,
            "uuid":"9ea92dfb-eb8d-4fdf-af9c-6beeedcdc7f8",
            "form_type":"PROFIT_AND_LOSS",
            "form_config_pk":103537,
            "tables":[
               
            ],
            "raw_fields":{
               "profit_and_loss-Part1-General:companyName":{
                  "value":"3M SAMPLE COMPANY",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Profit and Loss API.pdf"
               },
               "profit_and_loss-Part2-Sales&Revenue:salesTotal":{
                  "value":"1234.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Profit and Loss API.pdf"
               },
               "profit_and_loss-Part2-Sales&Revenue:grossProfit":{
                  "value":"345678.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Profit and Loss API.pdf"
               },
               "profit_and_loss-Part2-Sales&Revenue:totalIncome":{
                  "value":"1012.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Profit and Loss API.pdf"
               },
               "profit_and_loss-Part3-Expenses&NetProfit:isDated?":{
                  "value":"YES",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Profit and Loss API.pdf"
               },
               "profit_and_loss-Part3-Expenses&NetProfit:isSigned?":{
                  "value":"YES",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Profit and Loss API.pdf"
               },
               "profit_and_loss-Part3-Expenses&NetProfit:netIncome":{
                  "value":"123456.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Profit and Loss API.pdf"
               },
               "profit_and_loss-Part3-Expenses&NetProfit:totalExpenses":{
                  "value":"123445.00",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Profit and Loss API.pdf"
               },
               "profit_and_loss-Part2-Sales&Revenue:salesReturnsAndAllowances":{
                  "value":"",
                  "is_empty":true,
                  "alias_used":null,
                  "source_filename":"Profit and Loss API.pdf"
               },
               "profit_and_loss-Part1-General:periodOfProfitAndLoss:closingDate":{
                  "value":"12/01/2021",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Profit and Loss API.pdf"
               },
               "profit_and_loss-Part1-General:periodOfProfitAndLoss:beginingDate":{
                  "value":"01/01/2021",
                  "is_empty":false,
                  "alias_used":null,
                  "source_filename":"Profit and Loss API.pdf"
               }
            }
         }
      ]
   },
   "message":"OK"
}


Updated 11 months ago

Pension Award Letter
Social Security Award Letter
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