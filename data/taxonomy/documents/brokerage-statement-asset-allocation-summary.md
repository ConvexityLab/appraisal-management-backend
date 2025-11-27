# Brokerage Statement - Asset Allocation Summary

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
Brokerage Statement - Asset Allocation Summary
Suggest Edits

An asset manager, brokerage, or bank issues a brokerage/portfolio statement to an individual to provide detailed information and the composition of assets or investments. The brokerage statement is a common form type that is found in mortgages, especially for asset verification. The Brokerage Statement form type includes mutual fund statements.

To use the Upload PDF endpoint for this document, you must use BROKERAGE_STATEMENT_ASSET_ALLOCATION_SUMMARY in the form_type parameter.

Optional itemized line item fields captured

Field data attributed to itemized line items in the Brokerage Statement is captured as Table objects.

Form-Driven Output

column_ids associated with the Table objects will be a subset of the following list that matches the line item headers as they appear on the specific form.

Column ID	Data Type	Description
assetType	Text	Asset Type
marketValue(ThisPeriod)	Money	Market Value (This Period)
Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
brokerage_statement_asset_allocation_summary-Part1-General:bankOrBrokerageInstitutionName	Text	Bank or Brokerage Institution Name
brokerage_statement_asset_allocation_summary-Part1-General:accountNumber	Text	Account Number
brokerage_statement_asset_allocation_summary-Part1-General:retirementStatement?	YES, NO	Retirement Statement?
brokerage_statement_asset_allocation_summary-Part1-General:accountHolderName1	Text	Account Holder Name 1
brokerage_statement_asset_allocation_summary-Part1-General:accountHolderName2	Text	Account Holder Name 2
brokerage_statement_asset_allocation_summary-Part1-General:accountHolderAddress:addressLine1	Text	Account Holder Address
brokerage_statement_asset_allocation_summary-Part1-General:accountHolderAddress:addressLine2	Text	Account Holder Address
brokerage_statement_asset_allocation_summary-Part1-General:accountHolderAddress:city	Text	Account Holder Address
brokerage_statement_asset_allocation_summary-Part1-General:accountHolderAddress:state	State	Account Holder Address
brokerage_statement_asset_allocation_summary-Part1-General:accountHolderAddress:zip	ZIP Code	Account Holder Address
brokerage_statement_asset_allocation_summary-Part2-StatementDetails:statementPeriodBeginningDate	Date	Statement Period Beginning Date
brokerage_statement_asset_allocation_summary-Part2-StatementDetails:statementPeriodEndingDate	Date	Statement Period Ending Date
brokerage_statement_asset_allocation_summary-Part2-StatementDetails:statementIssueDate	Date	Statement Issue Date
brokerage_statement_asset_allocation_summary-Part2-StatementDetails:statementPeriodBeginningBalance	Money	Statement Period Beginning Balance
brokerage_statement_asset_allocation_summary-Part2-StatementDetails:statementPeriodEndingBalance	Money	Statement Period Ending Balance
brokerage_statement_asset_allocation_summary-Part2-StatementDetails:vestedBalance	Money	Vested Balance
Sample document
drive.google.com
Brokerage Statement.pdf
Sample JSON result
JSON
{
  "pk": 49881920,
  "uuid": "e5003556-f714-4f7f-b1a1-e8f92412b429",
  "name": "Brokerage Statement Brex",
  "created": "2024-05-01T20:18:41Z",
  "created_ts": "2024-05-01T20:18:41Z",
  "verified_pages_count": 77,
  "book_status": "ACTIVE",
  "id": 49881920,
  "forms": [
    {
      "pk": 54919009,
      "uuid": "620fe968-bf9e-45ba-8444-088351a90b15",
      "uploaded_doc_pk": 70807137,
      "form_type": "brokerage_statement_asset_allocation_summary",
      "raw_fields": {
        "brokerage_statement_asset_allocation_summary-Part1-General:accountNumber": {
          "value": "333-333333",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part1-General:accountHolderName1": {
          "value": "JOHN W. DOE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part1-General:accountHolderName2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part1-General:retirementStatement?": {
          "value": "NO",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part2-StatementDetails:vestedBalance": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part1-General:accountHolderAddress:zip": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part1-General:accountHolderAddress:city": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part1-General:accountHolderAddress:state": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part2-StatementDetails:statementIssueDate": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part1-General:bankOrBrokerageInstitutionName": {
          "value": "FIDELITY INVESTMENTS",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part1-General:accountHolderAddress:addressLine1": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part1-General:accountHolderAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part2-StatementDetails:statementPeriodEndingDate": {
          "value": "07/31/2015",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part2-StatementDetails:statementPeriodBeginningDate": {
          "value": "07/01/2015",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part2-StatementDetails:statementPeriodEndingBalance": {
          "value": "28457.90",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part2-StatementDetails:statementPeriodBeginningBalance": {
          "value": "27935.44",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 542510,
      "tables": [],
      "attribute_data": null
    },
    {
      "pk": 54918996,
      "uuid": "91927362-ebd8-4617-8552-1f4a971257e4",
      "uploaded_doc_pk": 70807137,
      "form_type": "brokerage_statement_asset_allocation_summary",
      "raw_fields": {
        "brokerage_statement_asset_allocation_summary-Part1-General:accountNumber": {
          "value": "222-222222",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part1-General:accountHolderName1": {
          "value": "JOHN W. DOE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part1-General:accountHolderName2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part1-General:retirementStatement?": {
          "value": "YES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part2-StatementDetails:vestedBalance": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part1-General:accountHolderAddress:zip": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part1-General:accountHolderAddress:city": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part1-General:accountHolderAddress:state": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part2-StatementDetails:statementIssueDate": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part1-General:bankOrBrokerageInstitutionName": {
          "value": "FIDELITY INVESTMENTS",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part1-General:accountHolderAddress:addressLine1": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part1-General:accountHolderAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part2-StatementDetails:statementPeriodEndingDate": {
          "value": "07/31/2015",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part2-StatementDetails:statementPeriodBeginningDate": {
          "value": "07/01/2015",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part2-StatementDetails:statementPeriodEndingBalance": {
          "value": "142413.12",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part2-StatementDetails:statementPeriodBeginningBalance": {
          "value": "147593.80",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 542510,
      "tables": [
        {
          "pk": 43290,
          "table_type": "brokerage_statement_asset_allocation_summary-Part3-AssetAllocationSummary",
          "columns": [
            {
              "column_id": "assetType",
              "alias_used": "Asset Type"
            },
            {
              "column_id": "marketValue(ThisPeriod)",
              "alias_used": "Market Value (This Period)"
            }
          ],
          "rows": [
            {
              "cells": {
                "assetType": {
                  "value": "STOCKS"
                },
                "marketValue(ThisPeriod)": {
                  "value": "99,215"
                }
              },
              "page_doc_pk": 494663230,
              "page_idx": 18
            },
            {
              "cells": {
                "assetType": {
                  "value": "BONDS"
                },
                "marketValue(ThisPeriod)": {
                  "value": "35,475"
                }
              },
              "page_doc_pk": 494663230,
              "page_idx": 18
            },
            {
              "cells": {
                "assetType": {
                  "value": "OTHER"
                },
                "marketValue(ThisPeriod)": {
                  "value": "5,651"
                }
              },
              "page_doc_pk": 494663230,
              "page_idx": 18
            },
            {
              "cells": {
                "assetType": {
                  "value": "CORE ACCOUNT"
                },
                "marketValue(ThisPeriod)": {
                  "value": "2,070"
                }
              },
              "page_doc_pk": 494663230,
              "page_idx": 18
            }
          ]
        }
      ],
      "attribute_data": null
    },
    {
      "pk": 54918950,
      "uuid": "aec78719-19d2-422d-aded-6a618f02a93f",
      "uploaded_doc_pk": 70807137,
      "form_type": "brokerage_statement_asset_allocation_summary",
      "raw_fields": {
        "brokerage_statement_asset_allocation_summary-Part1-General:accountNumber": {
          "value": "111-111111",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part1-General:retirementStatement?": {
          "value": "NO",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part2-StatementDetails:vestedBalance": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part2-StatementDetails:statementPeriodEndingBalance": {
          "value": "103351.18",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part2-StatementDetails:statementPeriodBeginningBalance": {
          "value": "88053.95",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part1-General:accountHolderName1": {
          "value": "JOHN W. DOE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part1-General:accountHolderName2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part1-General:accountHolderAddress:zip": {
          "value": "02201",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part1-General:accountHolderAddress:city": {
          "value": "BOSTON",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part1-General:accountHolderAddress:state": {
          "value": "MA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part2-StatementDetails:statementIssueDate": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part1-General:bankOrBrokerageInstitutionName": {
          "value": "FIDELITY INVESTMENTS",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part1-General:accountHolderAddress:addressLine1": {
          "value": "100 MAIN ST.",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part1-General:accountHolderAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part2-StatementDetails:statementPeriodEndingDate": {
          "value": "07/31/2015",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        },
        "brokerage_statement_asset_allocation_summary-Part2-StatementDetails:statementPeriodBeginningDate": {
          "value": "07/01/2015",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Brokerage Statement.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 542510,
      "tables": [
        {
          "pk": 43293,
          "table_type": "brokerage_statement_asset_allocation_summary-Part3-AssetAllocationSummary",
          "columns": [
            {
              "column_id": "assetType",
              "alias_used": "Asset Type"
            },
            {
              "column_id": "marketValue(ThisPeriod)",
              "alias_used": "Market Value (This Period)"
            }
          ],
          "rows": [
            {
              "cells": {
                "assetType": {
                  "value": "MUTUAL FUNDS"
                },
                "marketValue(ThisPeriod)": {
                  "value": "16,387"
                }
              },
              "page_doc_pk": 494663215,
              "page_idx": 3
            },
            {
              "cells": {
                "assetType": {
                  "value": "STOCKS"
                },
                "marketValue(ThisPeriod)": {
                  "value": "43,724"
                }
              },
              "page_doc_pk": 494663215,
              "page_idx": 3
            },
            {
              "cells": {
                "assetType": {
                  "value": "OTHER"
                },
                "marketValue(ThisPeriod)": {
                  "value": "6,740"
                }
              },
              "page_doc_pk": 494663215,
              "page_idx": 3
            },
            {
              "cells": {
                "assetType": {
                  "value": "CORE ACCOUNT"
                },
                "marketValue(ThisPeriod)": {
                  "value": "3,500"
                }
              },
              "page_doc_pk": 494663215,
              "page_idx": 3
            },
            {
              "cells": {
                "assetType": {
                  "value": "EXCHANGE TRADED PRODUCTS"
                },
                "marketValue(ThisPeriod)": {
                  "value": "14,462"
                }
              },
              "page_doc_pk": 494663215,
              "page_idx": 3
            },
            {
              "cells": {
                "assetType": {
                  "value": "BONDS"
                },
                "marketValue(ThisPeriod)": {
                  "value": "50,656"
                }
              },
              "page_doc_pk": 494663215,
              "page_idx": 3
            }
          ]
        }
      ],
      "attribute_data": null 
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Brokerage Statement - Account Summary and Transactions
Closing
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