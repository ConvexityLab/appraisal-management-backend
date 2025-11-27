# IRS Form 1099-G - Certain Government Payments

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
IRS Form 1099-G - Certain Government Payments
Suggest Edits

Form 1099-G is submitted by federal, state, or local governments to report payments made for the following purposes:

Unemployment compensation
Refunds, credits, or offsets of state or local income tax
Reemployment trade adjustment assistance
Taxable grants
Agricultural payments

Alternatively, they file this form if they've received Commodity Credit Corporation loan payments.

To use the Upload PDF endpoint for this document, you must use A_1099_G in the form_type parameter. To learn more about processing this document, click here.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
a_1099_g-Part1-PayerInformation:payer'sName	Text	Payer's Name
a_1099_g-Part1-PayerInformation:payer'sAddress:addressLine1	Text	Payer's Address
a_1099_g-Part1-PayerInformation:payer'sAddress:addressLine2	Text	Payer's Address
a_1099_g-Part1-PayerInformation:payer'sAddress:city	Text	Payer's Address
a_1099_g-Part1-PayerInformation:payer'sAddress:state	State	Payer's Address
a_1099_g-Part1-PayerInformation:payer'sAddress:zip	ZIP Code	Payer's Address
a_1099_g-Part1-PayerInformation:payer'sTin	EIN	Payer's TIN
a_1099_g-Part2-RecipientInformation:recipient'sTin	Social Security Number	Recipient's TIN
a_1099_g-Part1-PayerInformation:payer'sTelephoneNo.	Phone Number	Payer's Telephone No.
a_1099_g-Part2-RecipientInformation:recipient'sName	Text	Recipient's Name
a_1099_g-Part2-RecipientInformation:recipient'sAddress:addressLine1	Text	Recipient's Address
a_1099_g-Part2-RecipientInformation:recipient'sAddress:addressLine2	Text	Recipient's Address
a_1099_g-Part2-RecipientInformation:recipient'sAddress:city	Text	Recipient's Address
a_1099_g-Part2-RecipientInformation:recipient'sAddress:state	State	Recipient's Address
a_1099_g-Part2-RecipientInformation:recipient'sAddress:zip	ZIP Code	Recipient's Address
a_1099_g-Part2-RecipientInformation:accountNumber	Text	Account Number
a_1099_g-Part2-RecipientInformation:2ndTinNot	CHECKED, NOT CHECKED	2nd TIN Not
a_1099_g-Part3-IncomeAndTaxInformationLines1-6:forCalendarYear	Integer	For Calendar Year
a_1099_g-Part3-IncomeAndTaxInformationLines1-6:(box1)UnemploymentCompensation	Money	(Box 1) Unemployment Compensation
a_1099_g-Part3-IncomeAndTaxInformationLines1-6:(box2)StateOrLocalIncomeTaxRefundsCreditsOrOffsets	Money	(Box 2) State Or Local Income Tax Refunds Credits Or Offsets
a_1099_g-Part3-IncomeAndTaxInformationLines1-6:(box3)Box2AmountIsForTaxYear	Integer	(Box 3) Box 2 Amount Is For Tax Year
a_1099_g-Part3-IncomeAndTaxInformationLines1-6:(box4)FederalIncomeTaxWithheld	Money	(Box 4) Federal Income Tax Withheld
a_1099_g-Part3-IncomeAndTaxInformationLines1-6:(box5)RtaaPayments	Money	(Box 5) Rtaa Payments
a_1099_g-Part3-IncomeAndTaxInformationLines1-6:(box6)TaxableGrants	Money	(Box 6) Taxable Grants
a_1099_g-Part3-IncomeAndTaxInformationLines7-11:(box7)AgriculturePayments	Money	(Box 7) Agriculture Payments
a_1099_g-Part3-IncomeAndTaxInformationLines7-11:(box8)CheckIfBox2IsTradeOrBusinessIncome	CHECKED, NOT CHECKED	(Box 8) Check If Box 2 Is Trade Or Business Income
a_1099_g-Part3-IncomeAndTaxInformationLines7-11:(box9)MarketGain	Money	(Box 9) Market Gain
a_1099_g-Part3-IncomeAndTaxInformationLines7-11:(box10A)State:primary	State	(Box 10 A) State
a_1099_g-Part3-IncomeAndTaxInformationLines7-11:(box10A)State:secondary	State	(Box 10 A) State
a_1099_g-Part3-IncomeAndTaxInformationLines7-11:(box10B)StateIdentificationNo:primary	Integer	(Box 10 B) State Identification No
a_1099_g-Part3-IncomeAndTaxInformationLines7-11:(box10B)StateIdentificationNo:secondary	Integer	(Box 10 B) State Identification No
a_1099_g-Part3-IncomeAndTaxInformationLines7-11:(box11)StateIncomeTaxWithheld:primary	Money	(Box 11) State Income Tax Withheld
a_1099_g-Part3-IncomeAndTaxInformationLines7-11:(box11)StateIncomeTaxWithheld:secondary	Money	(Box 11) State Income Tax Withheld
Sample document
drive.google.com
2021 Form 1099-G.pdf
Sample JSON result
JSON
{
  "status": 200,
  "response": {
    "pk": 41452303,
    "uuid": "3500ff2e-2c9e-4e2c-ad1a-93c52f3dc724",
    "forms": [
      {
        "pk": 37904659,
        "uuid": "cafdd9cf-7293-484e-b76b-7af6e1e1e2ae",
        "form_type": "A_1099_G",
        "form_config_pk": 58137,
        "tables": [],
        "raw_fields": {
          "a_1099_g-Part1-PayerInformation:payer'sTin": {
            "value": "78-1234567",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf"
          },
          "a_1099_g-Part1-PayerInformation:payer'sName": {
            "value": "ABC SAMPLE LLC.",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf"
          },
          "a_1099_g-Part2-RecipientInformation:2ndTinNot": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf"
          },
          "a_1099_g-Part2-RecipientInformation:accountNumber": {
            "value": "12-3456AB789",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf"
          },
          "a_1099_g-Part1-PayerInformation:payer'sAddress:zip": {
            "value": "33011",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf"
          },
          "a_1099_g-Part2-RecipientInformation:recipient'sTin": {
            "value": "678-90-1234",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf"
          },
          "a_1099_g-Part1-PayerInformation:payer'sTelephoneNo.": {
            "value": "",           
            "is_empty": true,          
            "alias_used": null,           
            "source_filename": "2021 Form 1099-G.pdf"
          },
          "a_1099_g-Part1-PayerInformation:payer'sAddress:city": {
            "value": "FAKE CITY",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf"
          },
          "a_1099_g-Part2-RecipientInformation:recipient'sName": {
            "value": "JOHN SAMPLE",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf"
          },
          "a_1099_g-Part1-PayerInformation:payer'sAddress:state": {
            "value": "CA",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf"
          },
          "a_1099_g-Part2-RecipientInformation:recipient'sAddress:zip": {
            "value": "33011",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf"
          },
          "a_1099_g-Part1-PayerInformation:payer'sAddress:addressLine1": {
            "value": "123 STREET FAKE NW ROAD",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf"
          },
          "a_1099_g-Part1-PayerInformation:payer'sAddress:addressLine2": {
            "value": "SUITE 12",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf"
          },
          "a_1099_g-Part2-RecipientInformation:recipient'sAddress:city": {
            "value": "SAMPLE CITY",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf"
          },
          "a_1099_g-Part2-RecipientInformation:recipient'sAddress:state": {
            "value": "CA",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf"
          },
          "a_1099_g-Part3-IncomeAndTaxInformationLines1-6:forCalendarYear": {
            "value": "2021",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf"
          },
          "a_1099_g-Part3-IncomeAndTaxInformationLines7-11:(box9)MarketGain": {
            "value": "600.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf"
          },
          "a_1099_g-Part3-IncomeAndTaxInformationLines1-6:(box5)RtaaPayments": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf"
          },
          "a_1099_g-Part3-IncomeAndTaxInformationLines1-6:(box6)TaxableGrants": {
            "value": "650.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf"
          },
          "a_1099_g-Part2-RecipientInformation:recipient'sAddress:addressLine1": {
            "value": "1234 STREET FAKE LANE",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf"
          },
          "a_1099_g-Part2-RecipientInformation:recipient'sAddress:addressLine2": {
            "value": "APT 1",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf"
          },
          "a_1099_g-Part3-IncomeAndTaxInformationLines7-11:(box10A)State:primary": {
            "value": "CA",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf"
          },
          "a_1099_g-Part3-IncomeAndTaxInformationLines7-11:(box10A)State:secondary": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf"
          },
          "a_1099_g-Part3-IncomeAndTaxInformationLines7-11:(box7)AgriculturePayments": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf"
          },
          "a_1099_g-Part3-IncomeAndTaxInformationLines1-6:(box3)Box2AmountIsForTaxYear": {
            "value": "2020",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf"
          },
          "a_1099_g-Part3-IncomeAndTaxInformationLines1-6:(box1)UnemploymentCompensation": {
            "value": "16080.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf"
          },
          "a_1099_g-Part3-IncomeAndTaxInformationLines1-6:(box4)FederalIncomeTaxWithheld": {
            "value": "620.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf"
          },
          "a_1099_g-Part3-IncomeAndTaxInformationLines7-11:(box10B)StateIdentificationNo:primary": {
            "value": "32-1168400",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf",
            "irregular_datatype": true,
            "type_validation_error": "Invalid integer."
          },
          "a_1099_g-Part3-IncomeAndTaxInformationLines7-11:(box11)StateIncomeTaxWithheld:primary": {
            "value": "5500.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf"
          },
          "a_1099_g-Part3-IncomeAndTaxInformationLines7-11:(box10B)StateIdentificationNo:secondary": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf"
          },
          "a_1099_g-Part3-IncomeAndTaxInformationLines7-11:(box11)StateIncomeTaxWithheld:secondary": {
            "value": "",
            "is_empty": true,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf"
          },
          "a_1099_g-Part3-IncomeAndTaxInformationLines7-11:(box8)CheckIfBox2IsTradeOrBusinessIncome": {
            "value": "CHECKED",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf"
          },
          "a_1099_g-Part3-IncomeAndTaxInformationLines1-6:(box2)StateOrLocalIncomeTaxRefundsCreditsOrOffsets": {
            "value": "2250.00",
            "is_empty": false,
            "alias_used": null,
            "source_filename": "2021 Form 1099-G.pdf"
          }
        }
      }
    ]
  },
  "message": "OK"
}


Updated 11 months ago

IRS Form 1096 - Annual Summary and Transmittal of U.S. Information Returns
IRS Form 1099-INT - Interest income
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