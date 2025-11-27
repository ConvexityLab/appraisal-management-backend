# IRS Form 1040 Schedule B (2020) - Interest and Ordinary Dividends

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
IRS Form 1040 Schedule B (2020) - Interest and Ordinary Dividends
Suggest Edits

IRS Form 1040 Schedule B (2020) is used to report over $1,500 of taxable interest or ordinary dividends, interest from a seller-financed mortgage when the buyer used the property as a personal residence, and/or accrued interest from a bond.

To use the Upload PDF endpoint for this document, you must use A_1040_SCHEDULE_B_2020 in the form_type parameter. To learn more about this document processing, see processing Schedule B of IRS Form 1040.

SCHEDULE B

The document type A_1040_SCHEDULE_B_2020 supports data capture from the IRS 1040 Schedule B only. The first two pages of the document 1040 are processed as a separate document type.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
a_1040_schedule_b_2020-General:year	Integer	Year
a_1040_schedule_b_2020-General:nameShownOnReturn	Text	Name Shown On Return
a_1040_schedule_b_2020-General:additionalNameShownOnReturn	Text	Additional Name Shown On Return
a_1040_schedule_b_2020-General:yourSocialSecurityNumber	Text	Your Social Security Number
a_1040_schedule_b_2020-Part1-InterestNontabular:line2-AddTheAmountsOnLine1	Money	Line 2 - Add The Amounts On Line 1
a_1040_schedule_b_2020-Part1-InterestNontabular:line3-ExcludableInterestOnSeriesEeAndIU.S.SavingsBondsIssuedAfter1989.AttachForm8815	Money	Line 3 - Excludable Interest On Series EE And I U.S. Savings Bonds Issued After 1989. Attach Form 8815
a_1040_schedule_b_2020-Part1-InterestNontabular:line4-SubtractLine3FromLine2	Money	Line 4 - Subtract Line 3 From Line 2
a_1040_schedule_b_2020-Part2-OrdinaryDividendsNontabular:line6-AddTheAmountsOnLine5	Money	Line 6 - Add The Amounts On Line 5
a_1040_schedule_b_2020-Part3-ForeignAccountsAndTrusts:line7A-During2020-FinancialInterestInAFinancialAccountInAForeignCountry	YES
NO	Line 7A - During 2020 - Financial Interest In A Financial Account In A Foreign Country
a_1040_schedule_b_2020-Part3-ForeignAccountsAndTrusts:line7A-IfYes-RequiredToFileFincenForm114	YES
NO	Line 7A - If Yes - Required To File FinCEN Form 114
a_1040_schedule_b_2020-Part3-ForeignAccountsAndTrusts:line7B-IfRequiredToFileFincenForm114-NameOfTheForeignCountry	Text	Line 7B - If Required To File FinCEN Form 114 - Name Of The Foreign Country
a_1040_schedule_b_2020-Part3-ForeignAccountsAndTrusts:line8-During2020-ReceivedDistributionFrom-GrantorOf-TransferorToAForeignTrust	YES
NO	Line 8 - During 2020 - Received Distribution From - Grantor Of - Transferor To A Foreign Trust
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
        "pk": 25750399,
        "uuid": "e65cccc0-1d2c-4829-b353-26c5a5f45c81",
        "forms": [
            {
                "pk": 27721768,
                "uuid": "6649e84e-ab34-4cd8-9dc3-29fd770c5c83",
                "form_type": "A_1040_SCHEDULE_B_2020",
                "form_config_pk": 11541,
                "tables": [
                    {
                        "pk": 16966,
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
                                "page_doc_pk": 128207985,
                                "page_idx": 0
                            }
                        ]
                    },
                    {
                        "pk": 16965,
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
                                        "value": "LINDA SMITH"
                                    },
                                    "line1-Amount": {
                                        "value": "19375.00"
                                    }
                                },
                                "page_doc_pk": 128207985,
                                "page_idx": 0
                            }
                        ]
                    }
                ],
                "raw_fields": {
                    "a_1040_schedule_b_2020-General:year": {
                        "value": "2020",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1040 Schedule B 2020.pdf"
                    },
                    "a_1040_schedule_b_2020-General:nameShownOnReturn": {
                        "value": "ROBERT SMITH",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1040 Schedule B 2020.pdf"
                    },
                    "a_1040_schedule_b_2020-General:yourSocialSecurityNumber": {
                        "value": "722-55-4584",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1040 Schedule B 2020.pdf"
                    },
                    "a_1040_schedule_b_2020-General:additionalNameShownOnReturn": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1040 Schedule B 2020.pdf"
                    },
                    "a_1040_schedule_b_2020-Part1-InterestNontabular:line2-AddTheAmountsOnLine1": {
                        "value": "19375.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1040 Schedule B 2020.pdf"
                    },
                    "a_1040_schedule_b_2020-Part1-InterestNontabular:line4-SubtractLine3FromLine2": {
                        "value": "19375.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1040 Schedule B 2020.pdf"
                    },
                    "a_1040_schedule_b_2020-Part2-OrdinaryDividendsNontabular:line6-AddTheAmountsOnLine5": {
                        "value": "1321.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1040 Schedule B 2020.pdf"
                    },
                    "a_1040_schedule_b_2020-Part3-ForeignAccountsAndTrusts:line7A-IfYes-RequiredToFileFincenForm114": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1040 Schedule B 2020.pdf"
                    },
                    "a_1040_schedule_b_2020-Part3-ForeignAccountsAndTrusts:line7B-IfRequiredToFileFincenForm114-NameOfTheForeignCountry": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1040 Schedule B 2020.pdf"
                    },
                    "a_1040_schedule_b_2020-Part3-ForeignAccountsAndTrusts:line7A-During2020-FinancialInterestInAFinancialAccountInAForeignCountry": {
                        "value": "NO",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1040 Schedule B 2020.pdf"
                    },
                    "a_1040_schedule_b_2020-Part3-ForeignAccountsAndTrusts:line8-During2020-ReceivedDistributionFrom-GrantorOf-TransferorToAForeignTrust": {
                        "value": "NO",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 1040 Schedule B 2020.pdf"
                    },
                    "a_1040_schedule_b_2020-Part1-InterestNontabular:line3-ExcludableInterestOnSeriesEeAndIU.S.SavingsBondsIssuedAfter1989.AttachForm8815": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 1040 Schedule B 2020.pdf"
                    }
                }
            }
        ]
    },
    "message": "OK"
}


Updated 11 months ago

IRS Form 1040 Schedule B (2019) - Interest and Ordinary Dividends
IRS Form 1040 Schedule B (2021) - Interest and Ordinary Dividends
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