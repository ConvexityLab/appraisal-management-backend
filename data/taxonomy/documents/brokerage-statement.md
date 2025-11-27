# Brokerage Statement

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
Bank Statements
Brokerage Statement
Brokerage Statement - Account Summary and Transactions
Brokerage Statement - Asset Allocation Summary
Closing
Disclosure
Identification
Income/Employment
Legal
Mortgage specific forms
Other
Property
Tax forms
Data types
Brokerage Statement
Suggest Edits

An asset manager, brokerage, or bank issues a brokerage/portfolio statement to an individual to provide detailed information and the composition of assets or investments. The brokerage statement is a common form type that is found in mortgages, especially for asset verification. The Brokerage Statement form type includes mutual fund statements.

To use the Upload PDF endpoint for this document, you must use BROKERAGE_STATEMENT in the form_type parameter. To learn more about brokerage statements processing, see processing brokerage statements.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
brokerage_statement-Part1-General:bankOrBrokerageInstitutionName	Text	Bank or Brokerage Institution Name
brokerage_statement-Part1-General:accountNumber	Text	Account Number
brokerage_statement-Part1-General:retirementStatement?	YES, NO	Retirement Statement?
brokerage_statement-Part1-General:accountHolderName1	Text	Account Holder Name 1
brokerage_statement-Part1-General:accountHolderName2	Text	Account Holder Name 2
brokerage_statement-Part1-General:accountHolderAddress:addressLine1	Text	Account Holder Address
brokerage_statement-Part1-General:accountHolderAddress:addressLine2	Text	Account Holder Address
brokerage_statement-Part1-General:accountHolderAddress:city	Text	Account Holder Address
brokerage_statement-Part1-General:accountHolderAddress:state	State	Account Holder Address
brokerage_statement-Part1-General:accountHolderAddress:zip	ZIP Code	Account Holder Address
brokerage_statement-Part2-StatementDetails: statementPeriodBeginningDate	Date	Statement Period Beginning Date
brokerage_statement-Part2-StatementDetails: statementPeriodEndingDate	Date	Statement Period Ending Date
brokerage_statement-Part2-StatementDetails: statementIssueDate	Date	Statement Issue Date
brokerage_statement-Part2-StatementDetails: statementPeriodBeginningBalance	Money	Statement Period Beginning Balance
brokerage_statement-Part2-StatementDetails:statementPeriodEndingBalance	Money	Statement Period Ending Balance
brokerage_statement-Part2-StatementDetails: vestedBalance	Money	Vested Balance
brokerage_statement-Part3-AssetComposition: cash-MarketValue	Money	Cash - Market Value
brokerage_statement-Part3-AssetComposition: moneyMarket-MarketValue	Money	Money Market - Market Value
brokerage_statement-Part3-AssetComposition: fixedIncome-MarketValue	Money	Fixed Income - Market Value
brokerage_statement-Part3-AssetComposition: equity-MarketValue	Money	Equity - Market Value
Sample document

Coming soon...

Sample JSON result
JSON
{
    "status": 200,
    "response": {
        "pk": 29698370,
        "uuid": "5e83d19c-fa8b-45ca-85d9-06e1639a2736",
        "forms": [
        {
                "pk": 44337723,
                "uuid": "c549526a-1f5c-4f57-9182-9fe1d63776e7",
                "uploaded_doc_pk": 51890756,
                "form_type": "BROKERAGE_STATEMENT",
                "raw_fields": {
                    "brokerage_statement-Part3-AssetComposition:cash-MarketValue": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Brokerage Statement (1) (2).pdf"
                    },
                    "brokerage_statement-Part3-AssetComposition:equity-MarketValue": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Brokerage Statement (1) (2).pdf"
                    },
                    "brokerage_statement-Part3-AssetComposition:fixedIncome-MarketValue": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Brokerage Statement (1) (2).pdf"
                    },
                    "brokerage_statement-Part3-AssetComposition:moneyMarket-MarketValue": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Brokerage Statement (1) (2).pdf"
                    },
                    "brokerage_statement-Part1-General:accountNumber": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Brokerage Statement (1) (2).pdf"
                    },
                    "brokerage_statement-Part1-General:accountHolderName1": {
                        "value": "JOHN SAMPLE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Brokerage Statement (1) (2).pdf"
                    },
                    "brokerage_statement-Part1-General:accountHolderName2": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Brokerage Statement (1) (2).pdf"
                    },
                    "brokerage_statement-Part1-General:retirementStatement?": {
                        "value": "NO",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Brokerage Statement (1) (2).pdf"
                    },
                    "brokerage_statement-Part2-StatementDetails:vestedBalance": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Brokerage Statement (1) (2).pdf"
                    },
                    "brokerage_statement-Part1-General:accountHolderAddress:zip": {
                        "value": "12345",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Brokerage Statement (1) (2).pdf"
                    },
                    "brokerage_statement-Part1-General:accountHolderAddress:city": {
                        "value": "SAMPLE CITY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Brokerage Statement (1) (2).pdf"
                    },
                    "brokerage_statement-Part1-General:accountHolderAddress:state": {
                        "value": "NY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Brokerage Statement (1) (2).pdf"
                    },
                    "brokerage_statement-Part2-StatementDetails:statementIssueDate": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Brokerage Statement (1) (2).pdf"
                    },
                    "brokerage_statement-Part1-General:bankOrBrokerageInstitutionName": {
                        "value": "ABC MORTGAGE COMPANY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Brokerage Statement (1) (2).pdf"
                    },
                    "brokerage_statement-Part1-General:accountHolderAddress:addressLine1": {
                        "value": "123 FAKE STREET",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Brokerage Statement (1) (2).pdf"
                    },
                    "brokerage_statement-Part1-General:accountHolderAddress:addressLine2": {
                        "value": "UNIT #12",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Brokerage Statement (1) (2).pdf"
                    },
                    "brokerage_statement-Part2-StatementDetails:statementPeriodEndingDate": {
                        "value": "07/31/2022",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Brokerage Statement (1) (2).pdf"
                    },
                    "brokerage_statement-Part2-StatementDetails:statementPeriodBeginningDate": {
                        "value": "07/01/2022",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Brokerage Statement (1) (2).pdf"
                    },
                    "brokerage_statement-Part2-StatementDetails:statementPeriodEndingBalance": {
                        "value": "15000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Brokerage Statement (1) (2).pdf"
                    },
                    "brokerage_statement-Part2-StatementDetails:statementPeriodBeginningBalance": {
                        "value": "10000.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Brokerage Statement (1) (2).pdf"
                    }
                },
                "form_config_pk": 166229,
                "tables": []
            },
    "message": "OK"
}


Updated 11 months ago

Bank Statements
Brokerage Statement - Account Summary and Transactions
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