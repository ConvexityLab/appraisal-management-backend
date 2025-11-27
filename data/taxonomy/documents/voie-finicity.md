# VOIE (Finicity) - Finicity Verification of Income and Employment

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
VOIE (Finicity) - Finicity Verification of Income and Employment
Suggest Edits

Finicity's VOIE service digitally extracts paystub data and cross-verifies it with income transaction data from financial institutions. This process creates a real-time picture of an applicant's income and employment, which can be used to generate fast and accurate reports.

To use the Upload PDF endpoint endpoint for this document, you must use VERIFICATION_OF_INCOME_AND_EMPLOYMENT_FINICITY in the form_type parameter.

Optional itemized line item fields captured

Field data attributed to itemized line items in this document is captured as Table objects.

Form-Driven Output

column_ids associated with the Table objects will be a subset of the following list that matches the line item headers as they appear on the specific form.

Column ID	Data Type	Description
currentDeductions	Money	Current Deductions
description	Text	Description of Current Deductions
currentDeductions	Money	Current Earning Deductions
currentPay	Money	Current Earning Pay
description	Text	Description of Earning
hours	Money	Hours of Earning
rate	Money	Rate of Earning
ytdTotal	Money	YTD Total Earning
Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
verification_of_income_and_employment_finicity-Part1-BorrowerAndEmployerDetails:borrowerName	Text	Borrower Name
verification_of_income_and_employment_finicity-Part1-BorrowerAndEmployerDetails:borrowerAddress:addressLine1	Text	Borrower Address
verification_of_income_and_employment_finicity-Part1-BorrowerAndEmployerDetails:borrowerAddress:addressLine2	Text	Borrower Address
verification_of_income_and_employment_finicity-Part1-BorrowerAndEmployerDetails:borrowerAddress:city	Text	Borrower Address
verification_of_income_and_employment_finicity-Part1-BorrowerAndEmployerDetails:borrowerAddress:state	State	Borrower Address
verification_of_income_and_employment_finicity-Part1-BorrowerAndEmployerDetails:borrowerAddress:zip	ZIP Code	Borrower Address
verification_of_income_and_employment_finicity-Part1-BorrowerAndEmployerDetails:employerName	Text	Employer Name
verification_of_income_and_employment_finicity-Part1-BorrowerAndEmployerDetails:employerAddress:addressLine1	Text	Employer Address
verification_of_income_and_employment_finicity-Part1-BorrowerAndEmployerDetails:employerAddress:addressLine2	Text	Employer Address
verification_of_income_and_employment_finicity-Part1-BorrowerAndEmployerDetails:employerAddress:city	Text	Employer Address
verification_of_income_and_employment_finicity-Part1-BorrowerAndEmployerDetails:employerAddress:state	State	Employer Address
verification_of_income_and_employment_finicity-Part1-BorrowerAndEmployerDetails:employerAddress:zip	ZIP Code	Employer Address
verification_of_income_and_employment_finicity-Part2-PaystubData:payPeriodStartDate	Date	Pay Period Start Date
verification_of_income_and_employment_finicity-Part2-PaystubData:payPeriodEndDate	Date	Pay Period End Date
verification_of_income_and_employment_finicity-Part2-PaystubData:payDate	Date	Pay Date
verification_of_income_and_employment_finicity-Part2-PaystubData:netPay	Money	Net Pay
verification_of_income_and_employment_finicity-Part2-PaystubData:ytdGross	Money	YTD Gross
Sample document
drive.google.com
VOIE (Finicity) - Finicity Verification of Income and Employment.pdf
Sample JSON result
JSON
{
  "pk": 51623494,
  "uuid": "83112c10-2196-4cd5-abab-85005b2c5d1b",
  "name": "API - VOIE",
  "created": "2024-07-03T18:24:26Z",
  "created_ts": "2024-07-03T18:24:26Z",
  "verified_pages_count": 1,
  "book_status": "ACTIVE",
  "id": 51623494,
  "forms": [
    {
      "pk": 56456154,
      "uuid": "1713624e-821f-467e-acf3-aa70870f75d6",
      "uploaded_doc_pk": 74163596,
      "form_type": "VERIFICATION_OF_INCOME_AND_EMPLOYMENT_FINICITY",
      "raw_fields": {
        "verification_of_income_and_employment_finicity-Part2-PaystubData:netPay": {
          "value": "1423.25",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VOIE (Finicity) - Finicity Verification of Income and Employment.pdf",
          "confidence": 1.0
        },
        "verification_of_income_and_employment_finicity-Part2-PaystubData:payDate": {
          "value": "09/13/2019",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VOIE (Finicity) - Finicity Verification of Income and Employment.pdf",
          "confidence": 1.0
        },
        "verification_of_income_and_employment_finicity-Part2-PaystubData:ytdGross": {
          "value": "32200.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VOIE (Finicity) - Finicity Verification of Income and Employment.pdf",
          "confidence": 1.0
        },
        "verification_of_income_and_employment_finicity-Part2-PaystubData:payPeriodEndDate": {
          "value": "09/07/2019",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VOIE (Finicity) - Finicity Verification of Income and Employment.pdf",
          "confidence": 1.0
        },
        "verification_of_income_and_employment_finicity-Part2-PaystubData:payPeriodStartDate": {
          "value": "08/25/2019",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VOIE (Finicity) - Finicity Verification of Income and Employment.pdf",
          "confidence": 1.0
        },
        "verification_of_income_and_employment_finicity-Part1-BorrowerAndEmployerDetails:borrowerName": {
          "value": "DONNA SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VOIE (Finicity) - Finicity Verification of Income and Employment.pdf",
          "confidence": 1.0
        },
        "verification_of_income_and_employment_finicity-Part1-BorrowerAndEmployerDetails:employerName": {
          "value": "ABC FAKE LABORATORIES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VOIE (Finicity) - Finicity Verification of Income and Employment.pdf",
          "confidence": 1.0
        },
        "verification_of_income_and_employment_finicity-Part1-BorrowerAndEmployerDetails:borrowerAddress:zip": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VOIE (Finicity) - Finicity Verification of Income and Employment.pdf",
          "confidence": 1.0
        },
        "verification_of_income_and_employment_finicity-Part1-BorrowerAndEmployerDetails:employerAddress:zip": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "VOIE (Finicity) - Finicity Verification of Income and Employment.pdf",
          "confidence": 1.0
        },
        "verification_of_income_and_employment_finicity-Part1-BorrowerAndEmployerDetails:borrowerAddress:city": {
          "value": "PORTLAND",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VOIE (Finicity) - Finicity Verification of Income and Employment.pdf",
          "confidence": 1.0
        },
        "verification_of_income_and_employment_finicity-Part1-BorrowerAndEmployerDetails:employerAddress:city": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "VOIE (Finicity) - Finicity Verification of Income and Employment.pdf",
          "confidence": 1.0
        },
        "verification_of_income_and_employment_finicity-Part1-BorrowerAndEmployerDetails:borrowerAddress:state": {
          "value": "OR",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VOIE (Finicity) - Finicity Verification of Income and Employment.pdf",
          "confidence": 1.0
        },
        "verification_of_income_and_employment_finicity-Part1-BorrowerAndEmployerDetails:employerAddress:state": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "VOIE (Finicity) - Finicity Verification of Income and Employment.pdf",
          "confidence": 1.0
        },
        "verification_of_income_and_employment_finicity-Part1-BorrowerAndEmployerDetails:borrowerAddress:addressLine1": {
          "value": "123 MAIN ST.",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "VOIE (Finicity) - Finicity Verification of Income and Employment.pdf",
          "confidence": 1.0
        },
        "verification_of_income_and_employment_finicity-Part1-BorrowerAndEmployerDetails:borrowerAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "VOIE (Finicity) - Finicity Verification of Income and Employment.pdf",
          "confidence": 1.0
        },
        "verification_of_income_and_employment_finicity-Part1-BorrowerAndEmployerDetails:employerAddress:addressLine1": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "VOIE (Finicity) - Finicity Verification of Income and Employment.pdf",
          "confidence": 1.0
        },
        "verification_of_income_and_employment_finicity-Part1-BorrowerAndEmployerDetails:employerAddress:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "VOIE (Finicity) - Finicity Verification of Income and Employment.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 629440,
      "tables": [
        {
          "pk": 46355,
          "table_type": "verification_of_income_and_employment_finicity-Part3-Earnings",
          "columns": [
            {
              "column_id": "rate",
              "alias_used": "Rate"
            },
            {
              "column_id": "hours",
              "alias_used": "Hours"
            },
            {
              "column_id": "ytdTotal",
              "alias_used": "YTD Total"
            },
            {
              "column_id": "currentPay",
              "alias_used": "Current Pay"
            },
            {
              "column_id": "description",
              "alias_used": "Description"
            }
          ],
          "rows": [
            {
              "cells": {
                "rate": {
                  "value": ""
                },
                "hours": {
                  "value": ""
                },
                "ytdTotal": {
                  "value": "5200.00"
                },
                "currentPay": {
                  "value": "650.00"
                },
                "description": {
                  "value": "COMMISSION"
                }
              },
              "page_doc_pk": 519444274,
              "page_idx": 0
            },
            {
              "cells": {
                "rate": {
                  "value": "50.00"
                },
                "hours": {
                  "value": "30"
                },
                "ytdTotal": {
                  "value": "27000.00"
                },
                "currentPay": {
                  "value": "1500.00"
                },
                "description": {
                  "value": "REGULAR"
                }
              },
              "page_doc_pk": 519444274,
              "page_idx": 0
            }
          ]
        },
        {
          "pk": 46354,
          "table_type": "verification_of_income_and_employment_finicity-Part4-Deductions",
          "columns": [
            {
              "column_id": "description",
              "alias_used": "Description"
            },
            {
              "column_id": "currentDeductions",
              "alias_used": "Current Deductions"
            }
          ],
          "rows": [
            {
              "cells": {
                "description": {
                  "value": "FICA - SOCIAL SECURITY"
                },
                "currentDeductions": {
                  "value": "129.00"
                }
              },
              "page_doc_pk": 519444274,
              "page_idx": 0
            },
            {
              "cells": {
                "description": {
                  "value": "401K"
                },
                "currentDeductions": {
                  "value": "107.50"
                }
              },
              "page_doc_pk": 519444274,
              "page_idx": 0
            },
            {
              "cells": {
                "description": {
                  "value": "FICA - MEDICARE"
                },
                "currentDeductions": {
                  "value": "32.25"
                }
              },
              "page_doc_pk": 519444274,
              "page_idx": 0
            },
            {
              "cells": {
                "description": {
                  "value": "FEDERAL TAX"
                },
                "currentDeductions": {
                  "value": "150.50"
                }
              },
              "page_doc_pk": 519444274,
              "page_idx": 0
            },
            {
              "cells": {
                "description": {
                  "value": "HEALTH INSURANCE"
                },
                "currentDeductions": {
                  "value": "200.00"
                }
              },
              "page_doc_pk": 519444274,
              "page_idx": 0
            },
            {
              "cells": {
                "description": {
                  "value": "STATE TAX"
                },
                "currentDeductions": {
                  "value": "107.50"
                }
              },
              "page_doc_pk": 519444274,
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


Updated about 2 months ago

VOE (work number) - The Work Number Verification of Employment Report
Legal
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