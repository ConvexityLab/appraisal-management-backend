# Payoff Letter

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
Mortgage specific forms
Other
Property
1004 - Uniform Residential Appraisal Report
1032 - One-Unit Residential Appraisal Field Review Report
Appraisal Notice
Certificate of Liability Insurance
Final Inspection
Homeowners Association Statement
Homeowner Insurance Policy - Insurance Binder
Mortgage Statement
Payoff Letter
Preliminary Title Report
Property Tax Bill
Purchase Contract
Residential Lease Agreement
Tax forms
Data types
Payoff Letter
Suggest Edits

The payoff statement documents a mortgage principal paydown/payoff as issued by the lender.

To use the Upload PDF endpoint for this document, you must use PAYOFF_STATEMENT in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON attribute	Data type	Description
payoff_statement-PartI-General:payoffDate	Date	Payoff Date
payoff_statement-PartI-General:payoffAmount	Money	Payoff Amount
payoff_statement-PartIi-Borrower/Co-BorrowerInfo:borrowerName	Text	Borrower Name
payoff_statement-PartIi-Borrower/Co-BorrowerInfo:borrowerAddress:addressLine1	Text	Borrower Address
payoff_statement-PartIi-Borrower/Co-BorrowerInfo:borrowerAddress:addressLine2	Text	Borrower Address
payoff_statement-PartIi-Borrower/Co-BorrowerInfo:borrowerAddress:city	Text	Borrower Address
payoff_statement-PartIi-Borrower/Co-BorrowerInfo:borrowerAddress:state	State	Borrower Address
payoff_statement-PartIi-Borrower/Co-BorrowerInfo:borrowerAddress:zip	ZIP Code	Borrower Address
payoff_statement-PartIi-Borrower/Co-BorrowerInfo:co-borrowerName	Text	Co-Borrower Name
payoff_statement-PartIi-Borrower/Co-BorrowerInfo:co-borrowerAddress:addressLine1	Text	Co-Borrower Address
payoff_statement-PartIi-Borrower/Co-BorrowerInfo:co-borrowerAddress:addressLine2	Text	Co-Borrower Address
payoff_statement-PartIi-Borrower/Co-BorrowerInfo:co-borrowerAddress:city	Text	Co-Borrower Address
payoff_statement-PartIi-Borrower/Co-BorrowerInfo:co-borrowerAddress:state	State	Co-Borrower Address
payoff_statement-PartIi-Borrower/Co-BorrowerInfo:co-borrowerAddress:zip	ZIP Code	Co-Borrower Address
payoff_statement-PartIii-LenderAndPropertyInfo:lenderCompanyName	Text	Lender Company Name
payoff_statement-PartIii-LenderAndPropertyInfo:lenderCompanyAddress:addressLine1	Text	Lender Company Address
payoff_statement-PartIii-LenderAndPropertyInfo:lenderCompanyAddress:addressLine2	Text	Lender Company Address
payoff_statement-PartIii-LenderAndPropertyInfo:lenderCompanyAddress:city	Text	Lender Company Address
payoff_statement-PartIii-LenderAndPropertyInfo:lenderCompanyAddress:state	State	Lender Company Address
payoff_statement-PartIii-LenderAndPropertyInfo:lenderCompanyAddress:zip	ZIP Code	Lender Company Address
payoff_statement-PartIii-LenderAndPropertyInfo:propertyAddress:addressLine1	Text	Property Address
payoff_statement-PartIii-LenderAndPropertyInfo:propertyAddress:addressLine2	Text	Property Address
payoff_statement-PartIii-LenderAndPropertyInfo:propertyAddress:city	Text	Property Address
payoff_statement-PartIii-LenderAndPropertyInfo:propertyAddress:state	State	Property Address
payoff_statement-PartIii-LenderAndPropertyInfo:propertyAddress:zip	ZIP Code	Property Address
payoff_statement-PartIv-LoanInformation:loanNumber	Text	Loan Number
payoff_statement-PartIv-LoanInformation:loanType	Text	Loan Type
payoff_statement-PartIv-LoanInformation:dueDate	Date	Due Date
payoff_statement-PartIv-LoanInformation:interestRate	Percentage	Interest Rate
payoff_statement-PartIv-LoanInformation:beneficiaryBankName	Text	Beneficiary Bank Name
payoff_statement-PartIv-LoanInformation:beneficiaryBankAccountNumber	Text	Beneficiary Bank Account Number
Sample document

Coming soon...

Sample JSON result
JSON
{
  "pk": 36631317,
  "forms": [
    {
      "form_pk": 34446191,
      "type": "PAYOFF_STATEMENT",
      "pages": [
        {
          "page_idx": 0,
          "uploaded_doc_pk": 36631317,
          "fields": {
            "Payoff Date": {
              "value": "08/17/2020",
              "is_empty": false,
              "alias_used": null,
              "page_doc_pk": 182524868,
              "source_filename": "Sample 1 - Payoff statement.pdf"
            },
            "Payoff Amount": {
              "value": "115.00",
              "is_empty": false,
              "alias_used": null,
              "page_doc_pk": 182524868,
              "source_filename": "Sample 1 - Payoff statement.pdf"
            },
            "Due Date": {
              "value": "09/10/2020",
              "is_empty": false,
              "alias_used": null,
              "page_doc_pk": 182524868,
              "source_filename": "Sample 1 - Payoff statement.pdf"
            },
            "Loan Number": {
              "value": "659-56114526",
              "is_empty": false,
              "alias_used": null,
              "page_doc_pk": 182524868,
              "source_filename": "Sample 1 - Payoff statement.pdf"
            },
            "Interest Rate": {
              "value": "0.00%",
              "is_empty": false,
              "alias_used": null,
              "page_doc_pk": 182524868,
              "source_filename": "Sample 1 - Payoff statement.pdf"
            },
            "Beneficiary Bank Name": {
              "value": "TCF NATIONAL BANK",
              "is_empty": false,
              "alias_used": null,
              "page_doc_pk": 182524868,
              "source_filename": "Sample 1 - Payoff statement.pdf"
            },
            "Borrower Name": {
              "value": "LUIS FIGO",
              "is_empty": false,
              "alias_used": null,
              "page_doc_pk": 182524868,
              "source_filename": "Sample 1 - Payoff statement.pdf"
            },
            "Co-Borrower Name": {
              "value": "BRUNO FIGO",
              "is_empty": false,
              "alias_used": null,
              "page_doc_pk": 182524868,
              "source_filename": "Sample 1 - Payoff statement.pdf"
            },
            "Lender Company Name": {
              "value": "TCF NATIONAL BANK",
              "is_empty": false,
              "alias_used": null,
              "page_doc_pk": 182524868,
              "source_filename": "Sample 1 - Payoff statement.pdf"
            },
            "Property Address Zip": {
              "value": "95841-9600",
              "is_empty": false,
              "alias_used": null,
              "page_doc_pk": 182524868,
              "source_filename": "Sample 1 - Payoff statement.pdf"
            },
            "Property Address City": {
              "value": "DAPHNE",
              "is_empty": false,
              "alias_used": null,
              "page_doc_pk": 182524868,
              "source_filename": "Sample 1 - Payoff statement.pdf"
            },
            "Borrower Address Zip": {
              "value": "",
              "is_empty": true,
              "alias_used": null,
              "page_doc_pk": 182524868,
              "source_filename": "Sample 1 - Payoff statement.pdf"
            },
            "Property Address State": {
              "value": "AL",
              "is_empty": false,
              "alias_used": null,
              "page_doc_pk": 182524868,
              "source_filename": "Sample 1 - Payoff statement.pdf"
            },
            "Beneficiary Bank Account Number": {
              "value": "65921964961",
              "is_empty": false,
              "alias_used": null,
              "page_doc_pk": 182524868,
              "source_filename": "Sample 1 - Payoff statement.pdf"
            },
            "Borrower Address City": {
              "value": "",
              "is_empty": true,
              "alias_used": null,
              "page_doc_pk": 182524868,
              "source_filename": "Sample 1 - Payoff statement.pdf"
            },
            "Borrower Address State": {
              "value": "",
              "is_empty": true,
              "alias_used": null,
              "page_doc_pk": 182524868,
              "source_filename": "Sample 1 - Payoff statement.pdf"
            },
            "Co-Borrower Address Zip": {
              "value": "",
              "is_empty": true,
              "alias_used": null,
              "page_doc_pk": 182524868,
              "source_filename": "Sample 1 - Payoff statement.pdf"
            },
            "Lender Company Address Zip": {
              "value": "69521-5214",
              "is_empty": false,
              "alias_used": null,
              "page_doc_pk": 182524868,
              "source_filename": "Sample 1 - Payoff statement.pdf"
            },
            "Co-Borrower Address City": {
              "value": "",
              "is_empty": true,
              "alias_used": null,
              "page_doc_pk": 182524868,
              "source_filename": "Sample 1 - Payoff statement.pdf"
            },
            "Lender Company Address City": {
              "value": "HOPE",
              "is_empty": false,
              "alias_used": null,
              "page_doc_pk": 182524868,
              "source_filename": "Sample 1 - Payoff statement.pdf"
            },
            "Co-Borrower Address State": {
              "value": "",
              "is_empty": true,
              "alias_used": null,
              "page_doc_pk": 182524868,
              "source_filename": "Sample 1 - Payoff statement.pdf"
            },
            "Lender Company Address State": {
              "value": "AR",
              "is_empty": false,
              "alias_used": null,
              "page_doc_pk": 182524868,
              "source_filename": "Sample 1 - Payoff statement.pdf"
            },
            "Property Address Address Line 1": {
              "value": "2091 DOUGLAS AVE",
              "is_empty": false,
              "alias_used": null,
              "page_doc_pk": 182524868,
              "source_filename": "Sample 1 - Payoff statement.pdf"
            },
            "Property Address Address Line 2": {
              "value": "",
              "is_empty": true,
              "alias_used": null,
              "page_doc_pk": 182524868,
              "source_filename": "Sample 1 - Payoff statement.pdf"
            },
            "Borrower Address Address Line 1": {
              "value": "",
              "is_empty": true,
              "alias_used": null,
              "page_doc_pk": 182524868,
              "source_filename": "Sample 1 - Payoff statement.pdf"
            },
            "Borrower Address Address Line 2": {
              "value": "",
              "is_empty": true,
              "alias_used": null,
              "page_doc_pk": 182524868,
              "source_filename": "Sample 1 - Payoff statement.pdf"
            },
            "Co-Borrower Address Address Line 1": {
              "value": "",
              "is_empty": true,
              "alias_used": null,
              "page_doc_pk": 182524868,
              "source_filename": "Sample 1 - Payoff statement.pdf"
            },
            "Co-Borrower Address Address Line 2": {
              "value": "",
              "is_empty": true,
              "alias_used": null,
              "page_doc_pk": 182524868,
              "source_filename": "Sample 1 - Payoff statement.pdf"
            },
            "Lender Company Address Address Line 1": {
              "value": "142 PIKE ST",
              "is_empty": false,
              "alias_used": null,
              "page_doc_pk": 182524868,
              "source_filename": "Sample 1 - Payoff statement.pdf"
            },
            "Lender Company Address Address Line 2": {
              "value": "PO BOX 1584",
              "is_empty": false,
              "alias_used": null,
              "page_doc_pk": 182524868,
              "source_filename": "Sample 1 - Payoff statement.pdf"
            }
          },
          "other_frauds": []
        },
        {
          "page_idx": 1,
          "uploaded_doc_pk": 36631317,
          "fields": {
            "Loan Type": {
              "value": "",
              "is_empty": true,
              "alias_used": null,
              "page_doc_pk": 182524867,
              "source_filename": "Sample 1 - Payoff statement.pdf"
            }
          },
          "other_frauds": []
        }
      ],
      "tables": []
    }
  ]
}


Updated 11 months ago

Mortgage Statement
Preliminary Title Report
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