# Soldier Talent Profile

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
Soldier Talent Profile
Suggest Edits

This document is used to capture and assess a soldier's skills, qualifications, and career preferences. It serves as a comprehensive record of a soldier's capabilities, including their education, training, certifications, and personal career aspirations. This document is instrumental in aligning soldiers' talents with appropriate roles and opportunities within the military to ensure that their skills are utilized effectively and they are placed in positions that match their expertise and career goals.

To use the Upload PDF endpoint for this document, you must use SOLDIER_TALENT_PROFILE in the form_type parameter.

Optional itemized line item fields captured

Field data attributed to itemized line items in this document is captured as Table objects.

Form-Driven Output

column_ids associated with the Table objects will be a subset of the following list that matches the line item headers as they appear on the specific form.

Column ID	Data Type	Description
description	Text	A brief description of Service Data Accessions including personnel entry into military service, qualifications, and demographics.
details	Text	Detail of Service Data Accessions.
beginDate	Date	Start date of readiness assignment eligibility test.
code	Text	A unique code assigned for the readiness assignment eligibility test.
endDate	Date	End date of readiness assignment eligibility test.
restriction	Text	Restrictions in the readiness assignment eligibility test.
beginDate	Date	The start date of the soldier's Suspension of Favorable Personnel Actions (SFPA) is when the soldier becomes ineligible for favorable actions, such as promotions or awards, due to unresolved issues or non-compliance with standards.
code	Text	The unique code assigned to the soldier's SFPA.
endDate	Date	The end date of the soldier's Suspension of Favorable Personnel Actions (SFPA) is when the soldier becomes eligible for favorable actions.
restriction	Text	The restrictions of the soldier's SFPA.
description	Text	A brief description of the soldier's readiness.
details	Text	Details of the soldier's readiness.
date	Date	The start date of a soldier's rank progression is when a soldier begins their advancement to the next rank based on eligibility, time in service, and meeting the necessary performance and qualification standards.
rank	Text	Rank of the soldier.
Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
soldier_talent_profile-Part1-BasicData:documentDate	Date	Document Date
soldier_talent_profile-Part1-BasicData:fullName	Text	Full Name
soldier_talent_profile-Part1-BasicData:currentRank	Text	Current Rank
Sample document
drive.google.com
SOLDIER TALENT PROFILE.pdf
Sample JSON result
JSON
{
  "pk": 52275782,
  "uuid": "a7a8ad41-3a15-4254-bcc3-31dee9ac4121",
  "name": "STP",
  "created": "2024-07-30T21:24:45Z",
  "created_ts": "2024-07-30T21:24:45Z",
  "verified_pages_count": 1,
  "book_status": "ACTIVE",
  "id": 52275782,
  "forms": [
    {
      "pk": 57102472,
      "uuid": "91755f8a-4064-4335-b5cc-319a847c2a17",
      "uploaded_doc_pk": 75716675,
      "form_type": "SOLDIER_TALENT_PROFILE",
      "raw_fields": {
        "soldier_talent_profile-Part1-BasicData:fullName": {
          "value": "SAMPLE DOE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "SOLDIER TALENT PROFILE.pdf",
          "confidence": 1.0
        },
        "soldier_talent_profile-Part1-BasicData:currentRank": {
          "value": "SPC",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "SOLDIER TALENT PROFILE.pdf",
          "confidence": 1.0
        },
        "soldier_talent_profile-Part1-BasicData:documentDate": {
          "value": "01/01/2024",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "SOLDIER TALENT PROFILE.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 700400,
      "tables": [
        {
          "pk": 49044,
          "table_type": "soldier_talent_profile-Part2-RankProgression",
          "columns": [
            {
              "column_id": "date",
              "alias_used": "Date"
            },
            {
              "column_id": "rank",
              "alias_used": "Rank"
            }
          ],
          "rows": [
            {
              "cells": {
                "date": {
                  "value": ""
                },
                "rank": {
                  "value": "SSG"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            },
            {
              "cells": {
                "date": {
                  "value": "05/01/2022"
                },
                "rank": {
                  "value": "PFC"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            },
            {
              "cells": {
                "date": {
                  "value": "08/02/2021"
                },
                "rank": {
                  "value": "PV1"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            },
            {
              "cells": {
                "date": {
                  "value": ""
                },
                "rank": {
                  "value": "M"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            },
            {
              "cells": {
                "date": {
                  "value": "02/02/2022"
                },
                "rank": {
                  "value": "PV2"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            },
            {
              "cells": {
                "date": {
                  "value": ""
                },
                "rank": {
                  "value": "SFC"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            },
            {
              "cells": {
                "date": {
                  "value": "08/02/2023"
                },
                "rank": {
                  "value": "SPC"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            },
            {
              "cells": {
                "date": {
                  "value": "08/02/2023"
                },
                "rank": {
                  "value": "CPL"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            },
            {
              "cells": {
                "date": {
                  "value": ""
                },
                "rank": {
                  "value": "SGT"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            }
          ]
        },
        {
          "pk": 49043,
          "table_type": "soldier_talent_profile-Part3-Readiness",
          "columns": [
            {
              "column_id": "details",
              "alias_used": "Details"
            },
            {
              "column_id": "description",
              "alias_used": "Description"
            }
          ],
          "rows": [
            {
              "cells": {
                "details": {
                  "value": "01/01/2021"
                },
                "description": {
                  "value": "DATE CLEARANCE GRANTED:"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": "MRC1"
                },
                "description": {
                  "value": "MRC CODE:"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": "01/01/2025"
                },
                "description": {
                  "value": "CURRENT AAGT END:"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": ""
                },
                "description": {
                  "value": "MACP DATE:"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": "9999-12"
                },
                "description": {
                  "value": "YMAV DATE:"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": ""
                },
                "description": {
                  "value": "OPEN INVESTIGATION TYPE:"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": ""
                },
                "description": {
                  "value": "EFMP EVAL DATE:"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": ""
                },
                "description": {
                  "value": "OPEN INVESTIGATION TYPE:"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": "NONE"
                },
                "description": {
                  "value": "SECURITY CLEARANCE:"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": "SOLDIER IS CURRENT AND NO ISSUES"
                },
                "description": {
                  "value": "MRC REASON:"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": ""
                },
                "description": {
                  "value": "CONTINUOUS VETTING DATE:"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": "O"
                },
                "description": {
                  "value": "CLOSED INVESTIGATION TYPE:"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": "01/01/2025"
                },
                "description": {
                  "value": "ETS DATE:"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": "05/05/2023"
                },
                "description": {
                  "value": "PHA EXAM DATE:"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": "01/01/2023"
                },
                "description": {
                  "value": "MRC REASON START DATE:"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            }
          ]
        },
        {
          "pk": 49042,
          "table_type": "soldier_talent_profile-Part4-Readiness-SfpaFlags",
          "columns": [
            {
              "column_id": "code",
              "alias_used": "Code"
            },
            {
              "column_id": "endDate",
              "alias_used": "End Date"
            },
            {
              "column_id": "beginDate",
              "alias_used": "Begin Date"
            },
            {
              "column_id": "restriction",
              "alias_used": "Restriction"
            }
          ],
          "rows": []
        },
        {
          "pk": 49041,
          "table_type": "soldier_talent_profile-Part5-Readiness-AssignmentEligibility(Aea)Flags",
          "columns": [
            {
              "column_id": "code",
              "alias_used": "Code"
            },
            {
              "column_id": "endDate",
              "alias_used": "End Date"
            },
            {
              "column_id": "beginDate",
              "alias_used": "Begin Date"
            },
            {
              "column_id": "restriction",
              "alias_used": "Restriction"
            }
          ],
          "rows": []
        },
        {
          "pk": 49040,
          "table_type": "soldier_talent_profile-Part6-ServiceData-AccessionsData",
          "columns": [
            {
              "column_id": "details",
              "alias_used": "Details"
            },
            {
              "column_id": "description",
              "alias_used": "Description"
            }
          ],
          "rows": [
            {
              "cells": {
                "details": {
                  "value": ""
                },
                "description": {
                  "value": "DT:"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": "10/10/2041"
                },
                "description": {
                  "value": "NON-REG RET DT:"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": ""
                },
                "description": {
                  "value": "TYPE OF ORIGINAL APT:"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": ""
                },
                "description": {
                  "value": "CURRENT STATUTORY AUTH:"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": ""
                },
                "description": {
                  "value": "COMMISSIONING YEAR:"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": "01/01/2025"
                },
                "description": {
                  "value": "END CURRENT ASSIGNMENT:"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": ""
                },
                "description": {
                  "value": "CURRENT PPN:"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": ""
                },
                "description": {
                  "value": "MO/DAYS/AFCS:"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": "01/01/2041"
                },
                "description": {
                  "value": "REGULAR REF:"
                }
              },
              "page_doc_pk": 530434574,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": "01/01/2022"
                },
                "description": {
                  "value": "BASD:"
                }
              },
              "page_doc_pk": 530434574,
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


Updated 4 months ago

Social Security Award Letter
Veterans Affairs (VA) Award Letter
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