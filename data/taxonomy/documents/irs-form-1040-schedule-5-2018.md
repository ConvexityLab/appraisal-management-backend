# IRS Form 1040 Schedule 5 (2018) - Other Payments and Refundable Credits

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
IRS Form 1040 Schedule 5 (2018) - Other Payments and Refundable Credits
Suggest Edits

IRS Form 1040 Schedule 5 for 2018 is used to report other payments and refundable credits not directly entered on Form 1040. It included estimated tax payments, excess social security and Tier 1 RRTA tax withheld, the additional child tax credit, the refundable part of the American Opportunity Tax Credit, the net premium tax credit, and other refundable credits.

To use the Upload PDF endpoint for this document, you must use A_1040_SCHEDULE_5_2018 in the form_type parameter.

SCHEDULE 5

The document type A_1040_SCHEDULE_5_2018 supports data capture from the IRS 1040 Schedule 5 only. The first two pages of the document 1040 are processed as a separate document type.

Field descriptions

The following fields are available on this document type:

JSON attribute	Data type	Description
a_1040_schedule_5_2018-Part1-General:year	Integer	Year
a_1040_schedule_5_2018-Part1-General:name(s)ShownOnForm1040	Text	Name(s) Shown On Form 1040
a_1040_schedule_5_2018-Part1-General:yourSocialSecurityNumber	Text	Your Social Security Number
a_1040_schedule_5_2018-Part2-OtherPaymentsAndRefundableCredits:line65-Reserved	Money	Line 65 - Reserved
a_1040_schedule_5_2018-Part2-OtherPaymentsAndRefundableCredits:line66-2018EstimatedTaxPaymentsAndAmountAppliedFrom2017Return	Money	Line 66 - 2018 Estimated Tax Payments And Amount Applied From 2017 Return
a_1040_schedule_5_2018-Part2-OtherPaymentsAndRefundableCredits:line67A-Reserved	Money	Line 67A - Reserved
a_1040_schedule_5_2018-Part2-OtherPaymentsAndRefundableCredits:line67B-Reserved	Money	Line 67B - Reserved
a_1040_schedule_5_2018-Part2-OtherPaymentsAndRefundableCredits:line68-69-Reserved	Money	Line 68-69 - Reserved
a_1040_schedule_5_2018-Part2-OtherPaymentsAndRefundableCredits:line70-NetPremiumTaxCredit.AttachForm8962	Money	Line 70 - Net Premium Tax Credit. Attach Form 8962
a_1040_schedule_5_2018-Part2-OtherPaymentsAndRefundableCredits:line71-AmountPaidWithRequestForExtensionToFile	Money	Line 71 - Amount Paid With Request For Extension To File
a_1040_schedule_5_2018-Part2-OtherPaymentsAndRefundableCredits:line72-ExcessSocialSecurityAndTier1RrtaTaxWithheld	Money	Line 72 - Excess Social Security And Tier 1 RRTA Tax Withheld
a_1040_schedule_5_2018-Part2-OtherPaymentsAndRefundableCredits:line73-CreditForFederalTaxOnFuels.AttachForm4136	Money	Line 73 - Credit For Federal Tax On Fuels. Attach Form 4136
a_1040_schedule_5_2018-Part2-OtherPaymentsAndRefundableCredits:line74-CreditsFromForm:line74-CreditsFromForm-CheckBox	A - 2439
C - 8885	Line 74 - Credits From Form
a_1040_schedule_5_2018-Part2-OtherPaymentsAndRefundableCredits:line74-CreditsFromForm:line74-CreditsFromForm(IfDWasChecked)-Description	Text	Line 74 - Credits From Form
a_1040_schedule_5_2018-Part2-OtherPaymentsAndRefundableCredits:line74-CreditsFromForm:line74-CreditsFromForm-Amount	Money	Line 74 - Credits From Form
a_1040_schedule_5_2018-Part2-OtherPaymentsAndRefundableCredits:line75-AddTheAmountsInTheFarRightColumn	Money	Line 75 - Add The Amounts In The Far Right Column
Sample document

Coming soon...

Sample JSON result
JSON
{
  "pk": 28181803,
  "form_type": "A_1040_SCHEDULE_5_2018",
  "other_frauds": [],
  "tables": [],
  "raw_fields": {
    "a_1040_schedule_5_2018-Part1-General:year": {
      "value": "2018",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2018 Schedule 5 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_5_2018-Part1-General:name(s)ShownOnForm1040": {
      "value": "KEMBA LOPEZ",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2018 Schedule 5 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_5_2018-Part1-General:yourSocialSecurityNumber": {
      "value": "752-56-8596",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2018 Schedule 5 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_5_2018-Part2-OtherPaymentsAndRefundableCredits:line65-Reserved": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "2018 Schedule 5 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_5_2018-Part2-OtherPaymentsAndRefundableCredits:line67A-Reserved": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "2018 Schedule 5 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_5_2018-Part2-OtherPaymentsAndRefundableCredits:line67B-Reserved": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "2018 Schedule 5 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_5_2018-Part2-OtherPaymentsAndRefundableCredits:line68-69-Reserved": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "2018 Schedule 5 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_5_2018-Part2-OtherPaymentsAndRefundableCredits:line75-AddTheAmountsInTheFarRightColumn": {
      "value": "8450.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2018 Schedule 5 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_5_2018-Part2-OtherPaymentsAndRefundableCredits:line70-NetPremiumTaxCredit.AttachForm8962": {
      "value": "4250.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2018 Schedule 5 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_5_2018-Part2-OtherPaymentsAndRefundableCredits:line71-AmountPaidWithRequestForExtensionToFile": {
      "value": "3250.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2018 Schedule 5 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_5_2018-Part2-OtherPaymentsAndRefundableCredits:line73-CreditForFederalTaxOnFuels.AttachForm4136": {
      "value": "5200.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2018 Schedule 5 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_5_2018-Part2-OtherPaymentsAndRefundableCredits:line72-ExcessSocialSecurityAndTier1RrtaTaxWithheld": {
      "value": "4500.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2018 Schedule 5 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_5_2018-Part2-OtherPaymentsAndRefundableCredits:line74-CreditsFromForm:line74-CreditsFromForm-Amount": {
      "value": "1200.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2018 Schedule 5 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_5_2018-Part2-OtherPaymentsAndRefundableCredits:line74-CreditsFromForm:line74-CreditsFromForm-CheckBox": {
      "value": "A - 2439",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2018 Schedule 5 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_5_2018-Part2-OtherPaymentsAndRefundableCredits:line66-2018EstimatedTaxPaymentsAndAmountAppliedFrom2017Return": {
      "value": "4500.00",
      "is_empty": false,
      "alias_used": null,
      "source_filename": "2018 Schedule 5 (Form 1040) Sample 1.pdf"
    },
    "a_1040_schedule_5_2018-Part2-OtherPaymentsAndRefundableCredits:line74-CreditsFromForm:line74-CreditsFromForm(IfDWasChecked)-Description": {
      "value": "",
      "is_empty": true,
      "alias_used": null,
      "source_filename": "2018 Schedule 5 (Form 1040) Sample 1.pdf"
    }
  },
  "id": 28181803
}


Updated 11 months ago

SEE ALSO
Schedule 5, Form 1040 (2018)
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