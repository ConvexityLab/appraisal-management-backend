# Pension Award Letter

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
Pension Award Letter
Suggest Edits

This award letter is issued annually by the state or government agency detailing the pension benefits earned by an individual. Pension award letters are commonly used in the mortgage industry, especially for income verification.

To use the Upload PDF endpoint for this document, you must use PENSION_AWARD_LETTER in the form_type parameter.

To learn more about processing pension award letter form type, see Pension Award Letter processing.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
pension_award_letter-General:issueDate	Date	Issue Date
pension_award_letter-General:benefitYear	Integer	Benefit Year
pension_award_letter-General:socialSecurityNumber	Social Security Number	Social Security Number
pension_award_letter-General:companyName	Text	Issuing Company Name
pension_award_letter-General:recipientName	Text	Recipient Name
pension_award_letter-General:address:addressLine1	Text	Recipient Address
pension_award_letter-General:address:addressLine2	Text	Recipient Address
pension_award_letter-General:address:city	Text	Recipient Address
pension_award_letter-General:address:state	State	Recipient Address
pension_award_letter-General:address:zip	ZIP Code	Recipient Address
pension_award_letter-General:currentBenefitAmount(Gross)	Money	Current Monthly Benefit Amount (Gross)
pension_award_letter-General:projectedAnnualIncome	Money	Projected Annual Income
pension_award_letter-General:benefitExpirationDate	Date	Benefit Expiration Date
pension_award_letter-General:isLifetimeBenefit?	YES, NO	Is Lifetime Benefit?
Sample document
drive.google.com
PENSION_AWARD_LETTER.pdf
Sample JSON result
JSON
{
  "pk": 47309170,
  "uuid": "f8a203c4-7115-43e5-b689-8995704d9413",
  "name": "PENSION_AWARD_LETTER (API)",
  "created": "2024-03-08T20:50:33Z",
  "created_ts": "2024-03-08T20:50:33Z",
  "verified_pages_count": 1,
  "book_status": "ACTIVE",
  "id": 47309170,
  "forms": [
    {
      "pk": 53577146,
      "uuid": "22e403fc-512d-4200-a7e9-e94dfa7a2394",
      "uploaded_doc_pk": 68027948,
      "form_type": "PENSION_AWARD_LETTER",
      "raw_fields": {
        "pension_award_letter-General:issueDate": {
          "value": "04/19/2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "PENSION_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "pension_award_letter-General:address:zip": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "PENSION_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "pension_award_letter-General:benefitYear": {
          "value": "2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "PENSION_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "pension_award_letter-General:companyName": {
          "value": "SAMPLE STATE RETIREMENT SYSTEM",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "PENSION_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "pension_award_letter-General:address:city": {
          "value": "UNKNOWN CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "PENSION_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "pension_award_letter-General:address:state": {
          "value": "CA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "PENSION_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "pension_award_letter-General:recipientName": {
          "value": "DONNA FAKE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "PENSION_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "pension_award_letter-General:isLifetimeBenefit?": {
          "value": "YES",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "PENSION_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "pension_award_letter-General:address:addressLine1": {
          "value": "FAKE UNKNOWN RD",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "PENSION_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "pension_award_letter-General:address:addressLine2": {
          "value": "FL 1",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "PENSION_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "pension_award_letter-General:socialSecurityNumber": {
          "value": "123-45-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "PENSION_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "pension_award_letter-General:benefitExpirationDate": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "PENSION_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "pension_award_letter-General:projectedAnnualIncome": {
          "value": "9045.72",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "PENSION_AWARD_LETTER.pdf",
          "confidence": 1.0
        },
        "pension_award_letter-General:currentBenefitAmount(Gross)": {
          "value": "753.81",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "PENSION_AWARD_LETTER.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 331203,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Pay Stub
Profit and Loss Statement
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