# Court Order

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
Court Order
Suggest Edits

This is an authoritative directive issued by a court of law, typically legally binding, that compels a particular action, decision, or restriction, and is often applicable to the parties involved.

To use the Upload PDF endpoint for this document, you must use COURT_ORDER in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
court_order-Part1-General:dateOfJudgment/Order	Date	Date Of Judgment/Order
court_order-Part1-General:courtName	Text	Court Name
court_order-Part1-General:caseNumber	Text	Case Number
court_order-Part1-General:typeOfJudgment/Order	DEFAULT JUDGMENT, SUMMARY JUDGMENT, FINAL JUDGMENT, INTERLOCUTORY ORDER, WRIT OF EXECUTION, DISMISSAL ORDER, CONSENT DECREE, DECLARATORY JUDGMENT, OTHER	Type Of Judgment/Order
court_order-Part1-General:typeOfJudgment/Order-Other	Text	Type Of Judgment/Order - Other
court_order-Part1-General:amountOfJudgment	Amount	Amount Of Judgment
court_order-Part1-General:paymentStatus	PENDING, COMPLETE, REFUNDED, FAILED, REVOKED, PREAPPROVED, CANCELLED	Payment Status
court_order-Part1-General:paymentStatus-Other	Text	Payment Status - Other
court_order-Part2-PlaintiffInformation:nameOfPlaintiff	Text	Name Of Plaintiff
court_order-Part2-PlaintiffInformation:addressOfPlaintiff/Respondent:addressLine1	Text	Address Of Plaintiff/Respondent
court_order-Part2-PlaintiffInformation:addressOfPlaintiff/Respondent:addressLine2	Text	Address Of Plaintiff/Respondent
court_order-Part2-PlaintiffInformation:addressOfPlaintiff/Respondent:city	Text	Address Of Plaintiff/Respondent
court_order-Part2-PlaintiffInformation:addressOfPlaintiff/Respondent:state	State	Address Of Plaintiff/Respondent
court_order-Part2-PlaintiffInformation:addressOfPlaintiff/Respondent:zip	ZIP Code	Address Of Plaintiff/Respondent
court_order-Part3-DefendantInformation:nameOfDefendant	Text	Name Of Defendant
court_order-Part3-DefendantInformation:addressOfDefendant:addressLine1	Text	Address Of Defendant
court_order-Part3-DefendantInformation:addressOfDefendant:addressLine2	Text	Address Of Defendant
court_order-Part3-DefendantInformation:addressOfDefendant:city	Text	Address Of Defendant
court_order-Part3-DefendantInformation:addressOfDefendant:state	State	Address Of Defendant
court_order-Part3-DefendantInformation:addressOfDefendant:zip	ZIP Code	Address Of Defendant
court_order-Part4-OrderInformation:durationOfTheJudgment	Text	Duration Of The Judgment
court_order-Part4-OrderInformation:appeals	Text	Appeals
court_order-Part4-OrderInformation:bankruptcy	YES, NO, DISCHARGE, OTHER	Bankruptcy
court_order-Part4-OrderInformation:bankruptcy-Other	Text	Bankruptcy - Other
court_order-Part4-OrderInformation:settlements	Text	Settlements
court_order-Part4-OrderInformation:garnishmentsOrLiens	Text	Garnishments Or Liens
court_order-Part4-OrderInformation:descriptionOfTheDispute	Text	Description Of The Dispute
Sample document
drive.google.com
API - COURT ORDER.pdf
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
      "pk": 49666263,
      "uuid": "77a7b5a8-e31a-421a-be7d-3a8f41acecb4",
      "uploaded_doc_pk": 59900088,
      "form_type": "COURT_ORDER",
      "raw_fields": {
        "court_order-Part1-General:courtName": {
          "value": "UNITED STATES COURT OF APPEALS",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT ORDER.pdf",
          "confidence": 1.0
        },
        "court_order-Part1-General:caseNumber": {
          "value": "12-3456",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT ORDER.pdf",
          "confidence": 1.0
        },
        "court_order-Part1-General:paymentStatus": {
          "value": "CANCELLED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT ORDER.pdf",
          "confidence": 1.0
        },
        "court_order-Part1-General:amountOfJudgment": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - COURT ORDER.pdf",
          "confidence": 1.0
        },
        "court_order-Part4-OrderInformation:appeals": {
          "value": "NO APPEALS ARE RAISED FOR THE JUDGMENT.",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT ORDER.pdf",
          "confidence": 1.0
        },
        "court_order-Part1-General:paymentStatus-Other": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - COURT ORDER.pdf",
          "confidence": 1.0
        },
        "court_order-Part4-OrderInformation:bankruptcy": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - COURT ORDER.pdf",
          "confidence": 1.0
        },
        "court_order-Part1-General:dateOfJudgment/Order": {
          "value": "06/06/2022",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT ORDER.pdf",
          "confidence": 1.0
        },
        "court_order-Part1-General:typeOfJudgment/Order": {
          "value": "DISMISSAL ORDER",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT ORDER.pdf",
          "confidence": 1.0
        },
        "court_order-Part4-OrderInformation:settlements": {
          "value": "BOTH PARTIES HAVE REACHED A SETTLEMENT.",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT ORDER.pdf",
          "confidence": 1.0
        },
        "court_order-Part4-OrderInformation:bankruptcy-Other": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - COURT ORDER.pdf",
          "confidence": 1.0
        },
        "court_order-Part1-General:typeOfJudgment/Order-Other": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - COURT ORDER.pdf",
          "confidence": 1.0
        },
        "court_order-Part2-PlaintiffInformation:nameOfPlaintiff": {
          "value": "JOHN SMITH",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT ORDER.pdf",
          "confidence": 1.0
        },
        "court_order-Part3-DefendantInformation:nameOfDefendant": {
          "value": "JANE DOE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT ORDER.pdf",
          "confidence": 1.0
        },
        "court_order-Part4-OrderInformation:garnishmentsOrLiens": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - COURT ORDER.pdf",
          "confidence": 1.0
        },
        "court_order-Part4-OrderInformation:durationOfTheJudgment": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - COURT ORDER.pdf",
          "confidence": 1.0
        },
        "court_order-Part4-OrderInformation:descriptionOfTheDispute": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - COURT ORDER.pdf",
          "confidence": 1.0
        },
        "court_order-Part3-DefendantInformation:addressOfDefendant:zip": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - COURT ORDER.pdf",
          "confidence": 1.0
        },
        "court_order-Part3-DefendantInformation:addressOfDefendant:city": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - COURT ORDER.pdf",
          "confidence": 1.0
        },
        "court_order-Part3-DefendantInformation:addressOfDefendant:state": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - COURT ORDER.pdf",
          "confidence": 1.0
        },
        "court_order-Part3-DefendantInformation:addressOfDefendant:addressLine1": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - COURT ORDER.pdf",
          "confidence": 1.0
        },
        "court_order-Part3-DefendantInformation:addressOfDefendant:addressLine2": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "API - COURT ORDER.pdf",
          "confidence": 1.0
        },
        "court_order-Part2-PlaintiffInformation:addressOfPlaintiff/Respondent:zip": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT ORDER.pdf",
          "confidence": 1.0
        },
        "court_order-Part2-PlaintiffInformation:addressOfPlaintiff/Respondent:city": {
          "value": "FAKE CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT ORDER.pdf",
          "confidence": 1.0
        },
        "court_order-Part2-PlaintiffInformation:addressOfPlaintiff/Respondent:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT ORDER.pdf",
          "confidence": 1.0
        },
        "court_order-Part2-PlaintiffInformation:addressOfPlaintiff/Respondent:addressLine1": {
          "value": "123 FAKE STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT ORDER.pdf",
          "confidence": 1.0
        },
        "court_order-Part2-PlaintiffInformation:addressOfPlaintiff/Respondent:addressLine2": {
          "value": "FL 1",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "API - COURT ORDER.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 253709,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 11 months ago

Court Judgment
Deed in Lieu of Foreclosure
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