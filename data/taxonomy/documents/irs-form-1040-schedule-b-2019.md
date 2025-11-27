# IRS Form 1040 Schedule B (2019) - Interest and Ordinary Dividends

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
IRS Form 1040 Schedule B (2019) - Interest and Ordinary Dividends
Suggest Edits

IRS Form 1040 Schedule B (2019) is used to report over $1,500 of taxable interest or ordinary dividends, interest from a seller-financed mortgage when the buyer used the property as a personal residence, and/or accrued interest from a bond.

To use the Upload PDF endpoint for this document, you must use A_1040_SCHEDULE_B_2019 in the form_type parameter.

SCHEDULE B

The document type A_1040_SCHEDULE_B_2019 supports data capture from the IRS 1040 Schedule B only. The first two pages of the document 1040 are processed as a separate document type.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
a_1040_schedule_b_2019-General:year	Integer	Year
a_1040_schedule_b_2019-General:nameShownOnReturn	Text	Name Shown On Return
a_1040_schedule_b_2019-General:additionalNameShownOnReturn	Text	Additional Name Shown On Return
a_1040_schedule_b_2019-General:yourSocialSecurityNumber	Text	Your Social Security Number
a_1040_schedule_b_2019-Part1InterestNontabular:line2-AddTheAmountsOnLine1	Money	Line 2 - Add The Amounts On Line 1
a_1040_schedule_b_2019-Part1InterestNontabular:line3-ExcludableInterestOnSeriesEeAndIU.S.SavingsBondsIssuedAfter1989	Money	Line 3 - Excludable Interest On Series EE And I U.S. Savings Bonds Issued After 1989. Attach Form 8815
a_1040_schedule_b_2019-Part1InterestNontabular:line4-SubtractLine3FromLine2	Money	Line 4 - Subtract Line 3 From Line 2
a_1040_schedule_b_2019-Part2OrdinaryDividendsNontabular:line6-AddTheAmountsOnLine5	Money	Line 6 - Add The Amounts On Line 5
a_1040_schedule_b_2019-Part3ForeignAccountsAndTrusts:line7A-During2019-FinancialInterestOverAccountInAForeignCountry	YES
NO	Line 7A - During 2019 - Financial Interest In A Financial Account In A Foreign Country
a_1040_schedule_b_2019-Part3ForeignAccountsAndTrusts:line7A-IfYes-RequiredToFileFincenForm114	YES
NO	Line 7A - If Yes - Required To File FinCEN Form 114
a_1040_schedule_b_2019-Part3ForeignAccountsAndTrusts:line7B-IfRequiredToFileFincenForm114-NameOfForeignCountry	Text	Line 7B - If Required To File FinCEN Form 114 - Name Of The Foreign Country
a_1040_schedule_b_2019-Part3ForeignAccountsAndTrusts:line8-During2019-ReceiveDistributionFrom-GrantorOf-TransferorToAForeignTrust	YES
NO	Line 8 - During 2019 - Received Distribution From - Grantor Of - Transferor To A Foreign Trust
Optional itemized line item fields captured

Field data attributed to itemized line items in the Invoice is captured as a Table object.

Form-Driven Output

column_ids associated with the Table object will be a subset of the following list that matches the line item headers as they appear on the specific form.

Column ID	Data Type	Description
line5-Amount	Money	Amount
line5-List-NameOfPayer	Text	Payer Name
line1-Amount	Money	Amount
line1-List-NameOfPayer	Text	Payer Name
Sample document

Coming soon...

Sample JSON result
JSON
{
    "status": 200,
    "response": {
        "pk": 25750384,
        "uuid": "e4023c66-44fa-43bb-8d29-cce5e3ec6958",
        "forms": [
            {
                "pk": 27721765,
                "uuid": "7a6a8d4a-127f-45be-80f6-f4abceab4a61",
                "form_type": "A_1040_SCHEDULE_B_2019",
                "form_config_pk": 11540,
                "tables": [
                    {
                        "pk": 16964,
                        "columns": [
                            {
                                "column_id": "line5-ListNameOfPayer",
                                "alias_used": "Line 5 - List Name Of Payer"
                            },
                            {
                                "column_id": "line5-Amount",
                                "alias_used": "Line 5 - Amount"
                            }
                        ],
                        "rows": [
                            {
                                "cells": {
                                    "line5-ListNameOfPayer": {
                                        "value": "FIDELITY BROKERAGE SERVICES, LLC"
                                    },
                                    "line5-Amount": {
                                        "value": "1321.00"
                                    }
                                },
                                "page_doc_pk": 128207901,
                                "page_idx": 0
                            }
                        ]
                    },
                    {
                        "pk": 16963,
                        "columns": [
                            {
                                "column_id": "line1-ListNameOfPayer",
                                "alias_used": "Line 1 - List Name Of Payer"
                            },
                            {
                                "column_id": "line1-Amount",
                                "alias_used": "Line 1 - Amount"
                            }
                        ],
                        "rows": [
                            {
                                "cells": {
                                    "line1-ListNameOfPayer": {
                                        "value": "STEVE BROWN"
                                    },
                                    "line1-Amount": {
                                        "value": "20754.00"
                                    }
                                },
                                "page_doc_pk": 128207901,
                                "page_idx": 0
                            }
                        ]
                    }
                ],
                "raw_fields": {
                    "a_1040_schedule_b_2019-General:year": {
                        "value": "2019",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1040 Schedule B 2019.pdf"
                    },
                    "a_1040_schedule_b_2019-General:nameShownOnReturn": {
                        "value": "KEVIN BROWN",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1040 Schedule B 2019.pdf"
                    },
                    "a_1040_schedule_b_2019-General:yourSocialSecurityNumber": {
                        "value": "453-56-8421",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1040 Schedule B 2019.pdf"
                    },
                    "a_1040_schedule_b_2019-General:additionalNameShownOnReturn": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1040 Schedule B 2019.pdf"
                    },
                    "a_1040_schedule_b_2019-Part1InterestNontabular:line2-AddTheAmountsOnLine1": {
                        "value": "20754.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1040 Schedule B 2019.pdf"
                    },
                    "a_1040_schedule_b_2019-Part1InterestNontabular:line4-SubtractLine3FromLine2": {
                        "value": "20754.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1040 Schedule B 2019.pdf"
                    },
                    "a_1040_schedule_b_2019-Part2OrdinaryDividendsNontabular:line6-AddTheAmountsOnLine5": {
                        "value": "1321.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1040 Schedule B 2019.pdf"
                    },
                    "a_1040_schedule_b_2019-Part3ForeignAccountsAndTrusts:line7A-IfYes-RequiredToFileFincenForm114": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1040 Schedule B 2019.pdf"
                    },
                    "a_1040_schedule_b_2019-Part3ForeignAccountsAndTrusts:line7B-IfRequiredToFileFincenForm114-NameOfForeignCountry": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1040 Schedule B 2019.pdf"
                    },
                    "a_1040_schedule_b_2019-Part1InterestNontabular:line3-ExcludableInterestOnSeriesEeAndIU.S.SavingsBondsIssuedAfter1989": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1040 Schedule B 2019.pdf"
                    },
                    "a_1040_schedule_b_2019-Part3ForeignAccountsAndTrusts:line7A-During2019-FinancialInterestOverAccountInAForeignCountry": {
                        "value": "NO",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1040 Schedule B 2019.pdf"
                    },
                    "a_1040_schedule_b_2019-Part3ForeignAccountsAndTrusts:line8-During2019-ReceiveDistributionFrom-GrantorOf-TransferorToAForeignTrust": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1040 Schedule B 2019.pdf"
                    }
                }
            }
        ]
    },
    "message": "OK"
}


Updated 11 months ago

IRS Form 1040 Schedule B (2018) - Interest and Ordinary Dividends
IRS Form 1040 Schedule B (2020) - Interest and Ordinary Dividends
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