# Court Judgment

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
Legal
Car Loan Deed
Court Judgment
Court Order
Deed in Lieu of Foreclosure
Foreclosure Notice
Loan Agreement
Professional Liability Insurance
Release of Judgment or Lien
Solar Panel Lease Agreement
Solar Panel Loan Agreement
Wage Garnishment Order
Mortgage specific forms
Other
Property
Tax forms
Data types
Court Judgment
Suggest Edits

This is a formal decree issued by a court of law that conclusively resolves a legal dispute and delineates the rights, responsibilities, and remedies of the involved parties.

To use the Upload PDF endpoint for this document, you must use COURT_JUDGEMENT in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
court_judgment-Part1-General:dateOfJudgment/Order	Date	Date Of Judgment/Order
court_judgment-Part1-General:courtName	Text	Court Name
court_judgment-Part1-General:caseNumber	Text	Case Number
court_judgment-Part1-General:typeOfJudgment/Order	DEFAULT JUDGMENT, SUMMARY JUDGMENT, FINAL JUDGMENT, INTERLOCUTORY ORDER, WRIT OF EXECUTION, DISMISSAL ORDER, CONSENT DECREE, DECLARATORY JUDGMENT	Type Of Judgment/Order
court_judgment-Part2-PlaintiffInformation:plaintiffName	Text	Plaintiff Name
court_judgment-Part2-PlaintiffInformation:plaintiffAddress:addressLine1	Text	Plaintiff Address
court_judgment-Part2-PlaintiffInformation:plaintiffAddress:addressLine2	Text	Plaintiff Address
court_judgment-Part2-PlaintiffInformation:plaintiffAddress:city	Text	Plaintiff Address
court_judgment-Part2-PlaintiffInformation:plaintiffAddress:state	State	Plaintiff Address
court_judgment-Part2-PlaintiffInformation:plaintiffAddress:zip	ZIP Code	Plaintiff Address
court_judgment-Part3-DefendantInformation:defendantName	Text	Defendant Name
court_judgment-Part3-DefendantInformation:defendantAddress:addressLine1	Text	Defendant Address
court_judgment-Part3-DefendantInformation:defendantAddress:addressLine2	Text	Defendant Address
court_judgment-Part3-DefendantInformation:defendantAddress:city	Text	Defendant Address
court_judgment-Part3-DefendantInformation:defendantAddress:state	State	Defendant Address
court_judgment-Part3-DefendantInformation:defendantAddress:zip	ZIP Code	Defendant Address
court_judgment-Part4-OrderInformation:amountOfJudgment	Text	Amount Of Judgment
court_judgment-Part4-OrderInformation:interestRateOfJudgment	Text	Interest Rate Of Judgment
court_judgment-Part4-OrderInformation:paymentStatus	PENDING, COMPLETE, REFUNDED, FAILED, REVOKED, PRE-APPROVED, CANCELLED	Payment Status
court_judgment-Part4-OrderInformation:bankruptcy	YES, NO, DISCHARGE, OTHER	Bankruptcy
court_judgment-Part4-OrderInformation:bankruptcy-IfOther	Text	Bankruptcy - If Other
court_judgment-Part4-OrderInformation:settlements	Text	Settlements
court_judgment-Part4-OrderInformation:garnishmentsOrLiens	Text	Garnishments Or Liens
Sample document
drive.google.com
API - COURT JUDGEMENT.pdf
Sample JSON result
JSON
{
  "pk": 39003158,
  "uuid": "80b9189e-86db-4881-9986-7eb730b94260",
  "name": "API - Q2 All Capture forms",
  "created": "2023-09-08T18:29:49Z",
  "created_ts": "2023-09-08T18:29:48Z",
  "verified_pages_count": 89,
  "book_status": "ACTIVE",
  "id": 39003158,
  "forms": [
    {
      "pk": 49666259,
      "uuid": "b0438ff5-4cca-4df3-9a81-599deb41c585",
      "uploaded_doc_pk": 59900073,
      "form_type": "COURT_JUDGMENT",
      "raw_fields": {
        "court_judgment-Part1-General:courtName": {
          "value": "DISTRICT OF NEW YORK",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT JUDGEMENT.pdf",
          "confidence": 1.0
        },
        "court_judgment-Part1-General:caseNumber": {
          "value": "ABC123456789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT JUDGEMENT.pdf",
          "confidence": 1.0
        },
        "court_judgment-Part4-OrderInformation:bankruptcy": {
          "value": "NO",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT JUDGEMENT.pdf",
          "confidence": 1.0
        },
        "court_judgment-Part1-General:dateOfJudgment/Order": {
          "value": "01/01/2022",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT JUDGEMENT.pdf",
          "confidence": 1.0
        },
        "court_judgment-Part1-General:typeOfJudgment/Order": {
          "value": "DEFAULT JUDGMENT",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT JUDGEMENT.pdf",
          "confidence": 1.0
        },
        "court_judgment-Part4-OrderInformation:settlements": {
          "value": "PLAINTIFF & DEFENDANT NOT AGREED FOR SETTLEMENT",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT JUDGEMENT.pdf",
          "confidence": 1.0
        },
        "court_judgment-Part4-OrderInformation:paymentStatus": {
          "value": "PENDING",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT JUDGEMENT.pdf",
          "confidence": 1.0
        },
        "court_judgment-Part4-OrderInformation:amountOfJudgment": {
          "value": "5100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT JUDGEMENT.pdf",
          "confidence": 1.0
        },
        "court_judgment-Part2-PlaintiffInformation:plaintiffName": {
          "value": "JOHN SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT JUDGEMENT.pdf",
          "confidence": 1.0
        },
        "court_judgment-Part3-DefendantInformation:defendantName": {
          "value": "LUCIFER F. SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT JUDGEMENT.pdf",
          "confidence": 1.0
        },
        "court_judgment-Part4-OrderInformation:bankruptcy-IfOther": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - COURT JUDGEMENT.pdf",
          "confidence": 1.0
        },
        "court_judgment-Part4-OrderInformation:garnishmentsOrLiens": {
          "value": "NO",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT JUDGEMENT.pdf",
          "confidence": 1.0
        },
        "court_judgment-Part4-OrderInformation:interestRateOfJudgment": {
          "value": "1%",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT JUDGEMENT.pdf",
          "confidence": 1.0
        },
        "court_judgment-Part2-PlaintiffInformation:plaintiffAddress:zip": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT JUDGEMENT.pdf",
          "confidence": 1.0
        },
        "court_judgment-Part3-DefendantInformation:defendantAddress:zip": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT JUDGEMENT.pdf",
          "confidence": 1.0
        },
        "court_judgment-Part2-PlaintiffInformation:plaintiffAddress:city": {
          "value": "FAKE CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT JUDGEMENT.pdf",
          "confidence": 1.0
        },
        "court_judgment-Part3-DefendantInformation:defendantAddress:city": {
          "value": "FAKE CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT JUDGEMENT.pdf",
          "confidence": 1.0
        },
        "court_judgment-Part2-PlaintiffInformation:plaintiffAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT JUDGEMENT.pdf",
          "confidence": 1.0
        },
        "court_judgment-Part3-DefendantInformation:defendantAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT JUDGEMENT.pdf",
          "confidence": 1.0
        },
        "court_judgment-Part2-PlaintiffInformation:plaintiffAddress:addressLine1": {
          "value": "123 FAKE STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT JUDGEMENT.pdf",
          "confidence": 1.0
        },
        "court_judgment-Part2-PlaintiffInformation:plaintiffAddress:addressLine2": {
          "value": "UNIT 12",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT JUDGEMENT.pdf",
          "confidence": 1.0
        },
        "court_judgment-Part3-DefendantInformation:defendantAddress:addressLine1": {
          "value": "123 SAMPLE MEMORIAL AVE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT JUDGEMENT.pdf",
          "confidence": 1.0
        },
        "court_judgment-Part3-DefendantInformation:defendantAddress:addressLine2": {
          "value": "#12",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT JUDGEMENT.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 276018,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Car Loan Deed
Court Order
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