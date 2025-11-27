# Career Data Brief

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
Career Data Brief
Suggest Edits

A Career Data Brief (CDB) is a document that includes information about a person's military service and civilian employment, such as their service dates, academic information, decorations, and duty history.

To use the Upload PDF endpoint endpoint for this document, you must use CAREER_DATA_BRIEF in the form_type parameter.

Optional itemized line item fields captured

Field data attributed to itemized line items in this document is captured as Table objects.

Form-Driven Output

column_ids associated with the Table objects will be a subset of the following list that matches the line item headers as they appear on the specific form.

Column ID	Data Type	Description
description	Text	Description of promotion information
details	Text	Details of the promotion information
date	Date	Date of service
description	Text	Description of service dates
description	Text	Description of restrictions
details	Text	Details of the restriction
Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
career_data_brief-Part1-GeneralInformation:documentDate	Date	Document Date
career_data_brief-Part1-GeneralInformation:name	Text	Name
career_data_brief-Part1-GeneralInformation:recordStatus	Text	Record Status
Sample document
drive.google.com
Career Data Brief.pdf
Sample JSON result
JSON
{
  "pk": 51705170,
  "uuid": "26a79529-fedf-4b9e-95fb-84221c2dfed2",
  "name": "CDB_API",
  "created": "2024-07-08T16:24:20Z",
  "created_ts": "2024-07-08T16:24:20Z",
  "verified_pages_count": 1,
  "book_status": "ACTIVE",
  "id": 51705170,
  "forms": [
    {
      "pk": 56528883,
      "uuid": "e75634bc-fbd0-4429-a279-786c9e79fd83",
      "uploaded_doc_pk": 74308243,
      "form_type": "CAREER_DATA_BRIEF",
      "raw_fields": {
        "career_data_brief-Part1-GeneralInformation:name": {
          "value": "JOHN SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Career Data Brief.pdf",
          "confidence": 1.0
        },
        "career_data_brief-Part1-GeneralInformation:documentDate": {
          "value": "12/02/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Career Data Brief.pdf",
          "confidence": 1.0
        },
        "career_data_brief-Part1-GeneralInformation:recordStatus": {
          "value": "ACTIVE NO PROJECTED ACTION",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "Career Data Brief.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 642996,
      "tables": [
        {
          "pk": 46574,
          "table_type": "career_data_brief-Part2-Restrictions",
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
                  "value": "ASD:"
                }
              },
              "page_doc_pk": 520364906,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": ""
                },
                "description": {
                  "value": "ALC EXP:"
                }
              },
              "page_doc_pk": 520364906,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": ""
                },
                "description": {
                  "value": "1ST ASSIGN:"
                }
              },
              "page_doc_pk": 520364906,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": ""
                },
                "description": {
                  "value": "RNLTD:"
                }
              },
              "page_doc_pk": 520364906,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": ""
                },
                "description": {
                  "value": "REENL ELIG:"
                }
              },
              "page_doc_pk": 520364906,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": "28, BASE OF PREFERENCE, 11 NOV 2024"
                },
                "description": {
                  "value": "ASG AVL CD:"
                }
              },
              "page_doc_pk": 520364906,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": ""
                },
                "description": {
                  "value": "AAN:"
                }
              },
              "page_doc_pk": 520364906,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": ""
                },
                "description": {
                  "value": "UIF:"
                }
              },
              "page_doc_pk": 520364906,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": ""
                },
                "description": {
                  "value": "PES:"
                }
              },
              "page_doc_pk": 520364906,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": ""
                },
                "description": {
                  "value": "ASG LIM CD:"
                }
              },
              "page_doc_pk": 520364906,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": "00-PRESENT FOR DUTY"
                },
                "description": {
                  "value": "DUTY STATUS:"
                }
              },
              "page_doc_pk": 520364906,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": "11 NOV 2024"
                },
                "description": {
                  "value": "AAC EXP:"
                }
              },
              "page_doc_pk": 520364906,
              "page_idx": 0
            }
          ]
        },
        {
          "pk": 46573,
          "table_type": "career_data_brief-Part3-ServiceDates",
          "columns": [
            {
              "column_id": "date",
              "alias_used": "Date"
            },
            {
              "column_id": "description",
              "alias_used": "Description"
            }
          ],
          "rows": [
            {
              "cells": {
                "date": {
                  "value": "1"
                },
                "description": {
                  "value": "#SHORT TRS"
                }
              },
              "page_doc_pk": 520364906,
              "page_idx": 0
            },
            {
              "cells": {
                "date": {
                  "value": "13 SEP 2011"
                },
                "description": {
                  "value": "EAD:"
                }
              },
              "page_doc_pk": 520364906,
              "page_idx": 0
            },
            {
              "cells": {
                "date": {
                  "value": "10 DEC 2018"
                },
                "description": {
                  "value": "STRD"
                }
              },
              "page_doc_pk": 520364906,
              "page_idx": 0
            },
            {
              "cells": {
                "date": {
                  "value": "17 OCT 2027"
                },
                "description": {
                  "value": "ETS:"
                }
              },
              "page_doc_pk": 520364906,
              "page_idx": 0
            },
            {
              "cells": {
                "date": {
                  "value": "17 OCT 2027"
                },
                "description": {
                  "value": "DOS:"
                }
              },
              "page_doc_pk": 520364906,
              "page_idx": 0
            },
            {
              "cells": {
                "date": {
                  "value": "13 SEP 2011"
                },
                "description": {
                  "value": "TAFMSD:"
                }
              },
              "page_doc_pk": 520364906,
              "page_idx": 0
            },
            {
              "cells": {
                "date": {
                  "value": "11 NOV 2022"
                },
                "description": {
                  "value": "DAS"
                }
              },
              "page_doc_pk": 520364906,
              "page_idx": 0
            },
            {
              "cells": {
                "date": {
                  "value": "01 NOV 2022"
                },
                "description": {
                  "value": "DDLDS:"
                }
              },
              "page_doc_pk": 520364906,
              "page_idx": 0
            },
            {
              "cells": {
                "date": {
                  "value": "10 DEC 2018"
                },
                "description": {
                  "value": "ODSD:"
                }
              },
              "page_doc_pk": 520364906,
              "page_idx": 0
            },
            {
              "cells": {
                "date": {
                  "value": ""
                },
                "description": {
                  "value": "1405 DT:"
                }
              },
              "page_doc_pk": 520364906,
              "page_idx": 0
            },
            {
              "cells": {
                "date": {
                  "value": ""
                },
                "description": {
                  "value": "RSSP:"
                }
              },
              "page_doc_pk": 520364906,
              "page_idx": 0
            },
            {
              "cells": {
                "date": {
                  "value": "13 SEP 2033"
                },
                "description": {
                  "value": "HYT:"
                }
              },
              "page_doc_pk": 520364906,
              "page_idx": 0
            },
            {
              "cells": {
                "date": {
                  "value": ""
                },
                "description": {
                  "value": "RET/SEP:"
                }
              },
              "page_doc_pk": 520364906,
              "page_idx": 0
            },
            {
              "cells": {
                "date": {
                  "value": "13 SEP 2011"
                },
                "description": {
                  "value": "PAYDT:"
                }
              },
              "page_doc_pk": 520364906,
              "page_idx": 0
            },
            {
              "cells": {
                "date": {
                  "value": ""
                },
                "description": {
                  "value": "DEROS:"
                }
              },
              "page_doc_pk": 520364906,
              "page_idx": 0
            },
            {
              "cells": {
                "date": {
                  "value": ""
                },
                "description": {
                  "value": "TYSD:"
                }
              },
              "page_doc_pk": 520364906,
              "page_idx": 0
            }
          ]
        },
        {
          "pk": 46572,
          "table_type": "career_data_brief-Part4-PromotionInformation",
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
                  "value": "01 MAR 2020"
                },
                "description": {
                  "value": "DOR:"
                }
              },
              "page_doc_pk": 520364906,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": "TSG"
                },
                "description": {
                  "value": "RANK:"
                }
              },
              "page_doc_pk": 520364906,
              "page_idx": 0
            },
            {
              "cells": {
                "details": {
                  "value": ""
                },
                "description": {
                  "value": "PROJ GRADE:"
                }
              },
              "page_doc_pk": 520364906,
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

Balance Sheet
Change in Benefits Notice
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