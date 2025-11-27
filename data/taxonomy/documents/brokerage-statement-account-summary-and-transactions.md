# Brokerage Statement - Account Summary and Transactions

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
Brokerage Statement - Account Summary and Transactions
Suggest Edits

An asset manager, brokerage, or bank issues a brokerage/portfolio statement to an individual to provide detailed information and the composition of assets or investments. The brokerage statement is a common form type that is found in mortgages, especially for asset verification. The Brokerage Statement form type includes mutual fund statements.

To use the Upload PDF endpoint for this document, you must use BROKERAGE_STATEMENT_ACCOUNT_SUMMARY_AND_TRANSACTIONS in the form_type parameter.

Optional itemized line item fields captured

Field data attributed to itemized line items in the Brokerage Statement is captured as Table objects.

Form-Driven Output

column_ids associated with the Table objects will be a subset of the following list that matches the line item headers as they appear on the specific form.

Column ID	Data Type	Description
activityType	Text	Activity type
amount	Money	Amount
balance	Money	Balance
date	Date	Date
description	Text	Description
amountThisStatementPeriod	Money	Amount this statement period
amountYtd	Money	Amount YTD
description	Text	Description
Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
brokerage_statement_account_summary_and_transactions-Part1-General:bankOrBrokerageInstitutionName	Text	Bank or Brokerage Institution Name
brokerage_statement_account_summary_and_transactions-Part1-General:accountNumber	Text	Account Number
brokerage_statement_account_summary_and_transactions-Part1-General:retirementStatement?	YES, NO	Retirement Statement?
brokerage_statement_account_summary_and_transactions-Part1-General:accountHolderName1	Text	Account Holder Name 1
brokerage_statement_account_summary_and_transactions-Part1-General:accountHolderName2	Text	Account Holder Name 2
brokerage_statement_account_summary_and_transactions-Part1-General:accountHolderAddress:addressLine1	Text	Account Holder Address
brokerage_statement_account_summary_and_transactions-Part1-General:accountHolderAddress:addressLine2	Text	Account Holder Address
brokerage_statement_account_summary_and_transactions-Part1-General:accountHolderAddress:city	Text	Account Holder Address
brokerage_statement_account_summary_and_transactions-Part1-General:accountHolderAddress:state	State	Account Holder Address
brokerage_statement_account_summary_and_transactions-Part1-General:accountHolderAddress:zip	ZIP Code	Account Holder Address
brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:statementPeriodBeginningDate	Date	Statement Period Beginning Date
brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:statementPeriodEndingDate	Date	Statement Period Ending Date
brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:statementIssueDate	Date	Statement Issue Date
brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:statementPeriodBeginningBalance	Money	Statement Period Beginning Balance
brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:statementPeriodEndingBalance	Money	Statement Period Ending Balance
brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:vestedBalance	Money	Vested Balance
brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:openLoansBalance	Money	Open Loans Balance
brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:accountType	Text	Account Type
brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:accountCurrency	USD, OTHER	Account Currency
brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:accountCurrency(IfOther)	Text	Account Currency (If Other)
Sample document
drive.google.com
Brokerage Statement.pdf
Sample JSON result
JSON
{
  "pk": 49562803,
  "uuid": "91e9077c-0e63-4b5b-b4ee-e6e6ce2e9d06",
  "name": "Brokerage Statement (Account Summary And Transactions)",
  "created": "2024-04-25T13:27:05Z",
  "created_ts": "2024-04-25T13:27:05Z",
  "verified_pages_count": 49,
  "book_status": "ACTIVE",
  "id": 49562803,
  "forms": [
    {
      "pk": 54751678,
      "uuid": "b8b10ea7-5f35-4eeb-8f6b-654c7dab3d03",
      "uploaded_doc_pk": 70458530,
      "form_type": "BROKERAGE_STATEMENT_ACCOUNT_SUMMARY_AND_TRANSACTIONS",
      "raw_fields": {
        "brokerage_statement_account_summary_and_transactions-Part1-General:accountNumber": {
          "value": "333-333333",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part1-General:accountHolderName1": {
          "value": "JOHN W. DOE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part1-General:accountHolderName2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part1-General:retirementStatement?": {
          "value": "NO",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:accountType": {
          "value": "EDUCATION ACCOUNT",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:vestedBalance": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part1-General:accountHolderAddress:zip": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:accountCurrency": {
          "value": "USD",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part1-General:accountHolderAddress:city": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:openLoansBalance": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part1-General:accountHolderAddress:state": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:statementIssueDate": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part1-General:bankOrBrokerageInstitutionName": {
          "value": "FIDELITY INVESTMENTS",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part1-General:accountHolderAddress:addressLine1": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part1-General:accountHolderAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:accountCurrency(IfOther)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:statementPeriodEndingDate": {
          "value": "07/31/2015",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:statementPeriodBeginningDate": {
          "value": "07/01/2015",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:statementPeriodEndingBalance": {
          "value": "28457.90",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:statementPeriodBeginningBalance": {
          "value": "27935.44",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 525926,
      "tables": [
        {
          "pk": 43050,
          "table_type": "brokerage_statement_account_summary_and_transactions-Part3-AccountSummary",
          "columns": [
            {
              "column_id": "amountYtd",
              "alias_used": "Amount YTD"
            },
            {
              "column_id": "description",
              "alias_used": "Description"
            },
            {
              "column_id": "amountThisStatementPeriod",
              "alias_used": "Amount This Statement Period"
            }
          ],
          "rows": [
            {
              "cells": {
                "amountYtd": {
                  "value": "1,832.11"
                },
                "description": {
                  "value": "CHANGE IN INVESTMENT VALUE"
                },
                "amountThisStatementPeriod": {
                  "value": "522.46"
                }
              },
              "page_doc_pk": 492039827,
              "page_idx": 24
            },
            {
              "cells": {
                "amountYtd": {
                  "value": "1,962.88"
                },
                "description": {
                  "value": "Contributions"
                },
                "amountThisStatementPeriod": {
                  "value": ""
                }
              },
              "page_doc_pk": 492039827,
              "page_idx": 24
            },
            {
              "cells": {
                "amountYtd": {
                  "value": ""
                },
                "description": {
                  "value": "Distributions"
                },
                "amountThisStatementPeriod": {
                  "value": ""
                }
              },
              "page_doc_pk": 492039827,
              "page_idx": 24
            }
          ]
        },
        {
          "pk": 43049,
          "table_type": "brokerage_statement_account_summary_and_transactions-Part4-Transactions-DepositsAndWithdrawals",
          "columns": [
            {
              "column_id": "date",
              "alias_used": "Date"
            },
            {
              "column_id": "amount",
              "alias_used": "Amount"
            },
            {
              "column_id": "balance",
              "alias_used": "Balance"
            },
            {
              "column_id": "description",
              "alias_used": "Description"
            },
            {
              "column_id": "activityType",
              "alias_used": "Activity Type"
            }
          ],
          "rows": []
        }
      ],
      "attribute_data": null
    },
    {
      "pk": 54751669,
      "uuid": "2690880c-b99d-4754-90dc-fde9e511ce6b",
      "uploaded_doc_pk": 70458530,
      "form_type": "BROKERAGE_STATEMENT_ACCOUNT_SUMMARY_AND_TRANSACTIONS",
      "raw_fields": {
        "brokerage_statement_account_summary_and_transactions-Part1-General:accountNumber": {
          "value": "222-222222",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part1-General:accountHolderName1": {
          "value": "JOHN W. DOE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part1-General:accountHolderName2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part1-General:retirementStatement?": {
          "value": "YES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:accountType": {
          "value": "TRADITIONAL IRA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:vestedBalance": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part1-General:accountHolderAddress:zip": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:accountCurrency": {
          "value": "USD",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part1-General:accountHolderAddress:city": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:openLoansBalance": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part1-General:accountHolderAddress:state": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:statementIssueDate": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part1-General:bankOrBrokerageInstitutionName": {
          "value": "FIDELITY INVESTMENTS",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part1-General:accountHolderAddress:addressLine1": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part1-General:accountHolderAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:accountCurrency(IfOther)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:statementPeriodEndingDate": {
          "value": "07/31/2015",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:statementPeriodBeginningDate": {
          "value": "07/01/2015",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:statementPeriodEndingBalance": {
          "value": "142413.12",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:statementPeriodBeginningBalance": {
          "value": "147593.80",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 525926,
      "tables": [
        {
          "pk": 43052,
          "table_type": "brokerage_statement_account_summary_and_transactions-Part3-AccountSummary",
          "columns": [
            {
              "column_id": "amountYtd",
              "alias_used": "Amount YTD"
            },
            {
              "column_id": "description",
              "alias_used": "Description"
            },
            {
              "column_id": "amountThisStatementPeriod",
              "alias_used": "Amount This Statement Period"
            }
          ],
          "rows": [
            {
              "cells": {
                "amountYtd": {
                  "value": "1,836.49"
                },
                "description": {
                  "value": "OTHER ADDITIONS"
                },
                "amountThisStatementPeriod": {
                  "value": ""
                }
              },
              "page_doc_pk": 492039821,
              "page_idx": 18
            },
            {
              "cells": {
                "amountYtd": {
                  "value": "5,000.00"
                },
                "description": {
                  "value": "Contributions"
                },
                "amountThisStatementPeriod": {
                  "value": ""
                }
              },
              "page_doc_pk": 492039821,
              "page_idx": 18
            },
            {
              "cells": {
                "amountYtd": {
                  "value": "-692.22"
                },
                "description": {
                  "value": "SECURITIES TRANSFERRED OUT"
                },
                "amountThisStatementPeriod": {
                  "value": ""
                }
              },
              "page_doc_pk": 492039821,
              "page_idx": 18
            },
            {
              "cells": {
                "amountYtd": {
                  "value": "5,509.48"
                },
                "description": {
                  "value": "SECURITIES TRANSFERRED IN"
                },
                "amountThisStatementPeriod": {
                  "value": ""
                }
              },
              "page_doc_pk": 492039821,
              "page_idx": 18
            },
            {
              "cells": {
                "amountYtd": {
                  "value": "-230.74"
                },
                "description": {
                  "value": "TRANS . COSTS , FEES & CHARGES"
                },
                "amountThisStatementPeriod": {
                  "value": ""
                }
              },
              "page_doc_pk": 492039821,
              "page_idx": 18
            },
            {
              "cells": {
                "amountYtd": {
                  "value": "-461.48"
                },
                "description": {
                  "value": "TAXES WITHHELD"
                },
                "amountThisStatementPeriod": {
                  "value": ""
                }
              },
              "page_doc_pk": 492039821,
              "page_idx": 18
            },
            {
              "cells": {
                "amountYtd": {
                  "value": "-461.48"
                },
                "description": {
                  "value": "OTHER SUBTRACTIONS"
                },
                "amountThisStatementPeriod": {
                  "value": ""
                }
              },
              "page_doc_pk": 492039821,
              "page_idx": 18
            },
            {
              "cells": {
                "amountYtd": {
                  "value": "-461.48"
                },
                "description": {
                  "value": "CARDS , CHECKING & BILL PAYMENTS"
                },
                "amountThisStatementPeriod": {
                  "value": ""
                }
              },
              "page_doc_pk": 492039821,
              "page_idx": 18
            },
            {
              "cells": {
                "amountYtd": {
                  "value": "3,612.98"
                },
                "description": {
                  "value": "CHANGE IN INVESTMENT VALUE"
                },
                "amountThisStatementPeriod": {
                  "value": "-5,180.68"
                }
              },
              "page_doc_pk": 492039821,
              "page_idx": 18
            },
            {
              "cells": {
                "amountYtd": {
                  "value": "-4,065.21"
                },
                "description": {
                  "value": "Distributions"
                },
                "amountThisStatementPeriod": {
                  "value": ""
                }
              },
              "page_doc_pk": 492039821,
              "page_idx": 18
            }
          ]
        },
        {
          "pk": 43051,
          "table_type": "brokerage_statement_account_summary_and_transactions-Part4-Transactions-DepositsAndWithdrawals",
          "columns": [
            {
              "column_id": "date",
              "alias_used": "Date"
            },
            {
              "column_id": "amount",
              "alias_used": "Amount"
            },
            {
              "column_id": "balance",
              "alias_used": "Balance"
            },
            {
              "column_id": "description",
              "alias_used": "Description"
            },
            {
              "column_id": "activityType",
              "alias_used": "Activity Type"
            }
          ],
          "rows": []
        }
      ],
      "attribute_data": null
    },
    {
      "pk": 54751627,
      "uuid": "50dfd2bc-5eff-4fe1-a412-4a31f20e8e43",
      "uploaded_doc_pk": 70458530,
      "form_type": "BROKERAGE_STATEMENT_ACCOUNT_SUMMARY_AND_TRANSACTIONS",
      "raw_fields": {
        "brokerage_statement_account_summary_and_transactions-Part1-General:accountNumber": {
          "value": "111-111111",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part1-General:accountHolderName2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part1-General:retirementStatement?": {
          "value": "NO",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:accountType": {
          "value": "INDIVIDUAL TOD",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:vestedBalance": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:accountCurrency": {
          "value": "USD",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:openLoansBalance": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:statementIssueDate": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:accountCurrency(IfOther)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:statementPeriodEndingDate": {
          "value": "07/31/2015",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:statementPeriodBeginningDate": {
          "value": "07/01/2015",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:statementPeriodEndingBalance": {
          "value": "103351.18",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part2-StatementDetails:statementPeriodBeginningBalance": {
          "value": "88053.95",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part1-General:accountHolderName1": {
          "value": "JOHN W. DOE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part1-General:accountHolderAddress:zip": {
          "value": "02201",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part1-General:accountHolderAddress:city": {
          "value": "BOSTON",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part1-General:accountHolderAddress:state": {
          "value": "MA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part1-General:bankOrBrokerageInstitutionName": {
          "value": "FIDELITY INVESTMENTS",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part1-General:accountHolderAddress:addressLine1": {
          "value": "100 MAIN ST.",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_account_summary_and_transactions-Part1-General:accountHolderAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 525926,
      "tables": [
        {
          "pk": 43048,
          "table_type": "brokerage_statement_account_summary_and_transactions-Part3-AccountSummary",
          "columns": [
            {
              "column_id": "amountYtd",
              "alias_used": "Amount YTD"
            },
            {
              "column_id": "description",
              "alias_used": "Description"
            },
            {
              "column_id": "amountThisStatementPeriod",
              "alias_used": "Amount This Statement Period"
            }
          ],
          "rows": [
            {
              "cells": {
                "amountYtd": {
                  "value": "-625.87"
                },
                "description": {
                  "value": "TRANS. COSTS, FEES & CHARGES"
                },
                "amountThisStatementPeriod": {
                  "value": "-139.77"
                }
              },
              "page_doc_pk": 492039806,
              "page_idx": 3
            },
            {
              "cells": {
                "amountYtd": {
                  "value": "-32,581.02"
                },
                "description": {
                  "value": "Withdrawals"
                },
                "amountThisStatementPeriod": {
                  "value": "-5,485.00"
                }
              },
              "page_doc_pk": 492039806,
              "page_idx": 3
            },
            {
              "cells": {
                "amountYtd": {
                  "value": "-54,258.13"
                },
                "description": {
                  "value": "CARDS, CHECKING & BILL PAYMENTS"
                },
                "amountThisStatementPeriod": {
                  "value": "-33,842.96"
                }
              },
              "page_doc_pk": 492039806,
              "page_idx": 3
            },
            {
              "cells": {
                "amountYtd": {
                  "value": "-5,000.00"
                },
                "description": {
                  "value": "SECURITIES TRANSFERRED OUT"
                },
                "amountThisStatementPeriod": {
                  "value": "-5,000.00"
                }
              },
              "page_doc_pk": 492039806,
              "page_idx": 3
            },
            {
              "cells": {
                "amountYtd": {
                  "value": "35,871.01"
                },
                "description": {
                  "value": "Deposits"
                },
                "amountThisStatementPeriod": {
                  "value": "9,465.00"
                }
              },
              "page_doc_pk": 492039806,
              "page_idx": 3
            },
            {
              "cells": {
                "amountYtd": {
                  "value": "71,253.69"
                },
                "description": {
                  "value": "SECURITIES TRANSFERRED IN"
                },
                "amountThisStatementPeriod": {
                  "value": "49,804.64"
                }
              },
              "page_doc_pk": 492039806,
              "page_idx": 3
            },
            {
              "cells": {
                "amountYtd": {
                  "value": "13,612.98"
                },
                "description": {
                  "value": "CHANGE IN INVESTMENT VALUE *"
                },
                "amountThisStatementPeriod": {
                  "value": "1,458.33"
                }
              },
              "page_doc_pk": 492039806,
              "page_idx": 3
            },
            {
              "cells": {
                "amountYtd": {
                  "value": "-1,832.74"
                },
                "description": {
                  "value": "TAXES WITHHELD"
                },
                "amountThisStatementPeriod": {
                  "value": "-963.01"
                }
              },
              "page_doc_pk": 492039806,
              "page_idx": 3
            }
          ]
        },
        {
          "pk": 43047,
          "table_type": "brokerage_statement_account_summary_and_transactions-Part4-Transactions-DepositsAndWithdrawals",
          "columns": [
            {
              "column_id": "date",
              "alias_used": "Date"
            },
            {
              "column_id": "amount",
              "alias_used": "Amount"
            },
            {
              "column_id": "balance",
              "alias_used": "Balance"
            },
            {
              "column_id": "description",
              "alias_used": "Description"
            },
            {
              "column_id": "activityType",
              "alias_used": "Activity Type"
            }
          ],
          "rows": [
            {
              "cells": {
                "date": {
                  "value": "7/8"
                },
                "amount": {
                  "value": "-25.00"
                },
                "balance": {
                  "value": ""
                },
                "description": {
                  "value": "WIRE TRANSFER TO BANK"
                },
                "activityType": {
                  "value": ""
                }
              },
              "page_doc_pk": 492039816,
              "page_idx": 13
            },
            {
              "cells": {
                "date": {
                  "value": "7/3"
                },
                "amount": {
                  "value": "400.00"
                },
                "balance": {
                  "value": ""
                },
                "description": {
                  "value": "WIRE TRANSFER FROM BANK"
                },
                "activityType": {
                  "value": ""
                }
              },
              "page_doc_pk": 492039816,
              "page_idx": 13
            },
            {
              "cells": {
                "date": {
                  "value": "7/18"
                },
                "amount": {
                  "value": "300.00"
                },
                "balance": {
                  "value": ""
                },
                "description": {
                  "value": "WIRE TRANSFER FROM BANK"
                },
                "activityType": {
                  "value": ""
                }
              },
              "page_doc_pk": 492039816,
              "page_idx": 13
            },
            {
              "cells": {
                "date": {
                  "value": "7/17"
                },
                "amount": {
                  "value": "-1,000.00"
                },
                "balance": {
                  "value": ""
                },
                "description": {
                  "value": "WIRE TRANSFER TO BANK"
                },
                "activityType": {
                  "value": ""
                }
              },
              "page_doc_pk": 492039816,
              "page_idx": 13
            },
            {
              "cells": {
                "date": {
                  "value": "7/2"
                },
                "amount": {
                  "value": "15.00"
                },
                "balance": {
                  "value": ""
                },
                "description": {
                  "value": "DEPOSIT RECEIVED"
                },
                "activityType": {
                  "value": ""
                }
              },
              "page_doc_pk": 492039816,
              "page_idx": 13
            },
            {
              "cells": {
                "date": {
                  "value": "7/29"
                },
                "amount": {
                  "value": "-210.00"
                },
                "balance": {
                  "value": ""
                },
                "description": {
                  "value": "DEBIT AMERICAN EXPRESS"
                },
                "activityType": {
                  "value": ""
                }
              },
              "page_doc_pk": 492039816,
              "page_idx": 13
            },
            {
              "cells": {
                "date": {
                  "value": "7/12"
                },
                "amount": {
                  "value": "1,000.00"
                },
                "balance": {
                  "value": ""
                },
                "description": {
                  "value": "WIRE TRANSFER FROM BANK"
                },
                "activityType": {
                  "value": ""
                }
              },
              "page_doc_pk": 492039816,
              "page_idx": 13
            },
            {
              "cells": {
                "date": {
                  "value": "7/25"
                },
                "amount": {
                  "value": "500.00"
                },
                "balance": {
                  "value": ""
                },
                "description": {
                  "value": "WIRE TRANSFER FROM BANK"
                },
                "activityType": {
                  "value": ""
                }
              },
              "page_doc_pk": 492039816,
              "page_idx": 13
            },
            {
              "cells": {
                "date": {
                  "value": "7/1"
                },
                "amount": {
                  "value": "5,000.00"
                },
                "balance": {
                  "value": ""
                },
                "description": {
                  "value": "WIRE TRANSFER FROM BANK"
                },
                "activityType": {
                  "value": ""
                }
              },
              "page_doc_pk": 492039816,
              "page_idx": 13
            },
            {
              "cells": {
                "date": {
                  "value": "7/19"
                },
                "amount": {
                  "value": "250.00"
                },
                "balance": {
                  "value": ""
                },
                "description": {
                  "value": "WIRE TRANSFER FROM BANK"
                },
                "activityType": {
                  "value": ""
                }
              },
              "page_doc_pk": 492039816,
              "page_idx": 13
            },
            {
              "cells": {
                "date": {
                  "value": "7/3"
                },
                "amount": {
                  "value": "-750.00"
                },
                "balance": {
                  "value": ""
                },
                "description": {
                  "value": "WIRE TRANSFER TO BANK"
                },
                "activityType": {
                  "value": ""
                }
              },
              "page_doc_pk": 492039816,
              "page_idx": 13
            },
            {
              "cells": {
                "date": {
                  "value": "7/26"
                },
                "amount": {
                  "value": "500.00"
                },
                "balance": {
                  "value": ""
                },
                "description": {
                  "value": "WIRE TRANSFER FROM BANK"
                },
                "activityType": {
                  "value": ""
                }
              },
              "page_doc_pk": 492039816,
              "page_idx": 13
            },
            {
              "cells": {
                "date": {
                  "value": "7/16"
                },
                "amount": {
                  "value": "1,500.00"
                },
                "balance": {
                  "value": ""
                },
                "description": {
                  "value": "WIRE TRANSFER FROM BANK"
                },
                "activityType": {
                  "value": ""
                }
              },
              "page_doc_pk": 492039816,
              "page_idx": 13
            },
            {
              "cells": {
                "date": {
                  "value": "7/30"
                },
                "amount": {
                  "value": "-500.00"
                },
                "balance": {
                  "value": ""
                },
                "description": {
                  "value": "WIRE TRANSFER TO BANK"
                },
                "activityType": {
                  "value": ""
                }
              },
              "page_doc_pk": 492039816,
              "page_idx": 13
            },
            {
              "cells": {
                "date": {
                  "value": "7/2"
                },
                "amount": {
                  "value": "-3,000.00"
                },
                "balance": {
                  "value": ""
                },
                "description": {
                  "value": "WIRE TRANSFER TO BANK"
                },
                "activityType": {
                  "value": ""
                }
              },
              "page_doc_pk": 492039816,
              "page_idx": 13
            }
          ]
        }
      ],
      "attribute_data": null
    }
}


Updated 11 months ago

Brokerage Statement
Brokerage Statement - Asset Allocation Summary
Did this page help you?
Yes
No
TABLE OF CONTENTS
Optional itemized line item fields captured
Field descriptions
Sample document
Sample JSON result
Home
Guides
API
Supported documents
Release notes

Ocrolus © 2025. All rights reserved. Legal | Privacy Policy