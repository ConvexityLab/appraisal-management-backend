# IRS Form 1040 Schedule B (2023) - Interest and Ordinary Dividends

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
IRS Form 1040 Schedule B (2023) - Interest and Ordinary Dividends
Suggest Edits

IRS Form 1040 Schedule B (2023) is used to report over $1,500 of taxable interest or ordinary dividends, interest from a seller-financed mortgage when the buyer used the property as a personal residence, and/or accrued interest from a bond.

To use the Upload PDF endpoint for this document, you must use A_1040_SCHEDULE_B_2023 in the form_type parameter. To learn more about this document processing, see processing Schedule B of IRS Form 1040.

SCHEDULE B

The document type A_1040_SCHEDULE_B_2023 supports data capture from the IRS 1040 Schedule B only. The first two pages of the document 1040 are processed as a separate document type.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
a_1040_schedule_b_2023-Part1-General:year	Integer	Year
a_1040_schedule_b_2023-Part1-General:name(s)ShownOnReturn	Text	Name(s) Shown On Return
a_1040_schedule_b_2023-Part1-General:yourSocialSecurityNumber	Social Security Number	Your Social Security Number
a_1040_schedule_b_2023-Part2-Interest:line2-AddTheAmountsOnLine1	Money	Line 2 - Add The Amounts On Line 1
a_1040_schedule_b_2023-Part2-Interest:line3-ExcludableInterestOnSeriesEeAndIU.S.	Money	Line 3 - Excludable Interest On Series EE And I U.S.
a_1040_schedule_b_2023-Part2-Interest:line4-SubtractLine3FromLine2.EnterTheResultHere	Money	Line 4 - Subtract Line 3 From Line 2. Enter The Result Here
a_1040_schedule_b_2023-Part3-OrdinaryDividends:line6-AddTheAmountsOnLine5.EnterTheTotalHere	Money	Line 6 - Add The Amounts On Line 5. Enter The Total Here
a_1040_schedule_b_2023-Part4-ForeignAccountsAndTrusts:line7A-AtAnyTimeDuring2023DidYouHaveAFinancialInterest-Checkbox	YES, NO	Line 7A - At Any Time During 2023 Did You Have A Financial Interest - Checkbox
a_1040_schedule_b_2023-Part4-ForeignAccountsAndTrusts:line7A-IfYesAreYouRequiredToFileFincenForm114-Checkbox	YES, NO	Line 7A - If "Yes" Are You Required To File FinCEN Form 114 - Checkbox
a_1040_schedule_b_2023-Part4-ForeignAccountsAndTrusts:line7B-IfYouAreRequiredToFileFincenForm114-ListCountry(-Ies)	Text	Line 7B - If You Are Required To File FinCEN Form 114 - List Country(-ies)
a_1040_schedule_b_2023-Part4-ForeignAccountsAndTrusts:line8-During2023DidYouReceiveADistribution-Checkbox	YES, NO	Line 8 - During 2023 Did You Receive A Distribution - Checkbox
Optional itemized line item fields captured

Field data attributed to itemized line items in the Invoice is captured as a Table object.

Form-Driven Output

column_ids associated with the Table object will be a subset of the following list that matches the line item headers as they appear on the specific form.

Column ID	Data Type	Description
amount	Money	Amount
listNameOfPayer	Text	List name of the payer
amount	Money	Amount
listNameOfPayer	Text	List name of the payer
Sample document
drive.google.com
Sample_A_1040_SCHEDULE_B_2023.pdf
Sample JSON result
JSON
{
  "pk": 51050293,
  "uuid": "f169a252-b654-4c56-8024-5a9a0b57f2d2",
  "name": "A_1040_SCHEDULE_B_2023",
  "created": "2024-06-10T19:23:18Z",
  "created_ts": "2024-06-10T19:23:18Z",
  "verified_pages_count": 1,
  "book_status": "ACTIVE",
  "id": 51050293,
  "forms": [
    {
      "pk": 55875850,
      "uuid": "801e8619-2a26-44d3-b6d7-368fd0d533c0",
      "uploaded_doc_pk": 72822977,
      "form_type": "A_1040_SCHEDULE_B_2023",
      "raw_fields": {
        "a_1040_schedule_b_2023-Part1-General:year": {
          "value": "2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "A_1040_SCHEDULE_B_2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_b_2023-Part1-General:name(s)ShownOnReturn": {
          "value": "JOHN SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "A_1040_SCHEDULE_B_2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_b_2023-Part1-General:yourSocialSecurityNumber": {
          "value": "123-45-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "A_1040_SCHEDULE_B_2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_b_2023-Part2-Interest:line2-AddTheAmountsOnLine1": {
          "value": "16000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "A_1040_SCHEDULE_B_2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_b_2023-Part2-Interest:line3-ExcludableInterestOnSeriesEeAndIU.S.": {
          "value": "5000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "A_1040_SCHEDULE_B_2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_b_2023-Part2-Interest:line4-SubtractLine3FromLine2.EnterTheResultHere": {
          "value": "11000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "A_1040_SCHEDULE_B_2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_b_2023-Part3-OrdinaryDividends:line6-AddTheAmountsOnLine5.EnterTheTotalHere": {
          "value": "9000.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "A_1040_SCHEDULE_B_2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_b_2023-Part4-ForeignAccountsAndTrusts:line8-During2023DidYouReceiveADistribution-Checkbox": {
          "value": "YES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "A_1040_SCHEDULE_B_2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_b_2023-Part4-ForeignAccountsAndTrusts:line7A-IfYesAreYouRequiredToFileFincenForm114-Checkbox": {
          "value": "NO",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "A_1040_SCHEDULE_B_2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_b_2023-Part4-ForeignAccountsAndTrusts:line7B-IfYouAreRequiredToFileFincenForm114-ListCountry(-Ies)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "A_1040_SCHEDULE_B_2023.pdf",
          "confidence": 1.0
        },
        "a_1040_schedule_b_2023-Part4-ForeignAccountsAndTrusts:line7A-AtAnyTimeDuring2023DidYouHaveAFinancialInterest-Checkbox": {
          "value": "YES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "A_1040_SCHEDULE_B_2023.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 601016,
      "tables": [
        {
          "pk": 44875,
          "table_type": "a_1040_schedule_b_2023-Part6-Line5-ListNameOfPayer",
          "columns": [
            {
              "column_id": "amount",
              "alias_used": "Amount"
            },
            {
              "column_id": "listNameOfPayer",
              "alias_used": "List Name Of Payer"
            }
          ],
          "rows": [
            {
              "cells": {
                "amount": {
                  "value": "5,000.00"
                },
                "listNameOfPayer": {
                  "value": "ABC CORP"
                }
              },
              "page_doc_pk": 510073725,
              "page_idx": 0
            },
            {
              "cells": {
                "amount": {
                  "value": "1,000.00"
                },
                "listNameOfPayer": {
                  "value": "NICK SAMPLE"
                }
              },
              "page_doc_pk": 510073725,
              "page_idx": 0
            },
            {
              "cells": {
                "amount": {
                  "value": "3,000.00"
                },
                "listNameOfPayer": {
                  "value": "ABC BANK"
                }
              },
              "page_doc_pk": 510073725,
              "page_idx": 0
            }
          ]
        },
        {
          "pk": 44874,
          "table_type": "a_1040_schedule_b_2023-Part5-Line1-ListNameOfPayer",
          "columns": [
            {
              "column_id": "amount",
              "alias_used": "Amount"
            },
            {
              "column_id": "listNameOfPayer",
              "alias_used": "List Name Of Payer"
            }
          ],
          "rows": [
            {
              "cells": {
                "amount": {
                  "value": "6,000.00"
                },
                "listNameOfPayer": {
                  "value": "XYZ BANK"
                }
              },
              "page_doc_pk": 510073725,
              "page_idx": 0
            },
            {
              "cells": {
                "amount": {
                  "value": "2,000.00"
                },
                "listNameOfPayer": {
                  "value": "NIKE SAMPLE"
                }
              },
              "page_doc_pk": 510073725,
              "page_idx": 0
            },
            {
              "cells": {
                "amount": {
                  "value": "5,000.00"
                },
                "listNameOfPayer": {
                  "value": "TIM FAKE"
                }
              },
              "page_doc_pk": 510073725,
              "page_idx": 0
            },
            {
              "cells": {
                "amount": {
                  "value": "3,000.00"
                },
                "listNameOfPayer": {
                  "value": "E TRADE"
                }
              },
              "page_doc_pk": 510073725,
              "page_idx": 0
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

IRS Form 1040 Schedule B (2022) - Interest and Ordinary Dividends
1040 Schedule B (2024) - Interest and Ordinary Dividends
Did this page help you?
Yes
No
TABLE OF CONTENTS
Field descriptions
Optional itemized line item fields captured
Sample document
Sample JSON result
Home
Guides
API
Supported documents
Release notes

Ocrolus © 2025. All rights reserved. Legal | Privacy Policy