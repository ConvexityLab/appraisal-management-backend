# Homeowner Insurance Policy - Insurance Binder

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
Homeowner Insurance Policy - Insurance Binder
Suggest Edits

A Homeowner Insurance Policy provides property, casualty, and liability coverage for a specific property, protecting the homeowner from financial losses due to damage, theft, or accidents that occur on the property. An Insurance Binder is a temporary contract issued by the insurer, offering proof of coverage until the full policy is officially issued. This binder specifies key coverage details, ensuring the homeowner has immediate protection during the interim period before the formal policy is finalized.

To use the Upload PDF endpoint for this document, you must use HOMEOWNER_INSURANCE_POLICY in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
homeowner_insurance_policy-Part1-PolicyHolderInformation:isThisAnAcordForm?	YES, NO	Is This An Acord Form?
homeowner_insurance_policy-Part1-PolicyHolderInformation:insuranceCompanyOrAgency	Text	Insurance Company Or Agency
homeowner_insurance_policy-Part1-PolicyHolderInformation:insuredFullName1	Text	Insured Full Name 1
homeowner_insurance_policy-Part1-PolicyHolderInformation:insuredFullName2	Text	Insured Full Name 2
homeowner_insurance_policy-Part1-PolicyHolderInformation:insuredFullName3	Text	Insured Full Name 3
homeowner_insurance_policy-Part1-PolicyHolderInformation:insuredFullName4	Text	Insured Full Name 4
homeowner_insurance_policy-Part1-PolicyHolderInformation:policyHolderAddress:addressLine1	Text	Policy Holder Address
homeowner_insurance_policy-Part1-PolicyHolderInformation:policyHolderAddress:addressLine2	Text	Policy Holder Address
homeowner_insurance_policy-Part1-PolicyHolderInformation:policyHolderAddress:city	Text	Policy Holder Address
homeowner_insurance_policy-Part1-PolicyHolderInformation:policyHolderAddress:state	State	Policy Holder Address
homeowner_insurance_policy-Part1-PolicyHolderInformation:policyHolderAddress:zip	ZIP Code	Policy Holder Address
homeowner_insurance_policy-Part1-PolicyHolderInformation:insuredFullName5	Text	Insured Full Name 5
homeowner_insurance_policy-Part1-PolicyHolderInformation:insuredFullName6	Text	Insured Full Name 6
homeowner_insurance_policy-Part1-PolicyHolderInformation:c/oOrAttn	Text	C/O Or Attn
homeowner_insurance_policy-Part2-PolicyInformation:policyNumber	Text	Policy Number
homeowner_insurance_policy-Part2-PolicyInformation:binderNumber	Text	Binder Number
homeowner_insurance_policy-Part2-PolicyInformation:loanNumber	Text	Loan Number
homeowner_insurance_policy-Part2-PolicyInformation:year	Integer	Year
homeowner_insurance_policy-Part2-PolicyInformation:effectiveDate	Date	Effective Date
homeowner_insurance_policy-Part2-PolicyInformation:expirationDate	Date	Expiration Date
homeowner_insurance_policy-Part2-PolicyInformation:totalPremium	Money	Total Premium
homeowner_insurance_policy-Part2-PolicyInformation:dwellingCoverage	Integer	Dwelling Coverage
homeowner_insurance_policy-Part2-PolicyInformation:guaranteedReplacementCostIndicated	YES, NO	Guaranteed Replacement Cost Indicated
homeowner_insurance_policy-Part2-PolicyInformation:paidInFull	YES, NO	Paid In Full
homeowner_insurance_policy-Part2-PolicyInformation:balanceDue	Money	Balance Due
homeowner_insurance_policy-Part3-PropertyAddress:propertyAddress:addressLine1	Text	Property Address
homeowner_insurance_policy-Part3-PropertyAddress:propertyAddress:addressLine2	Text	Property Address
homeowner_insurance_policy-Part3-PropertyAddress:propertyAddress:city	City	Property Address
homeowner_insurance_policy-Part3-PropertyAddress:propertyAddress:state	State	Property Address
homeowner_insurance_policy-Part3-PropertyAddress:propertyAddress:zip	ZIP Code	Property Address
homeowner_insurance_policy-Part4-MortgageeInformation:mortgagee	Text	Mortgagee
homeowner_insurance_policy-Part4-MortgageeInformation:isMortgageeIsaoa/AtimaStated?	YES, NO	Is Mortgagee ISAOA / ATIMA Stated?
homeowner_insurance_policy-Part4-MortgageeInformation:mortgageeAddress:addressLine1	Text	Mortgagee Address
homeowner_insurance_policy-Part4-MortgageeInformation:mortgageeAddress:addressLine2	Text	Mortgagee Address
homeowner_insurance_policy-Part4-MortgageeInformation:mortgageeAddress:city	Text	Mortgagee Address
homeowner_insurance_policy-Part4-MortgageeInformation:mortgageeAddress:state	State	Mortgagee Address
homeowner_insurance_policy-Part4-MortgageeInformation:mortgageeAddress:zip	ZIP Code	Mortgagee Address
homeowner_insurance_policy-Part4-MortgageeInformation:mortgageeLoanNumber	Text	Mortgagee Loan Number
homeowner_insurance_policy-Part4-MortgageeInformation:c/oOrAttn	Text	C/O Or Attn
homeowner_insurance_policy-Part5-SecondMortgageeInformation:secondMortgagee	Text	Second Mortgagee
homeowner_insurance_policy-Part5-SecondMortgageeInformation:isSecondMortgageeIsaoa/AtimaStated?	YES, NO	Is Second Mortgagee ISAOA / ATIMA Stated?
homeowner_insurance_policy-Part5-SecondMortgageeInformation:secondMortgageeAddress:addressLine1	Text	Second Mortgagee Address
homeowner_insurance_policy-Part5-SecondMortgageeInformation:secondMortgageeAddress:addressLine2	Text	Second Mortgagee Address
homeowner_insurance_policy-Part5-SecondMortgageeInformation:secondMortgageeAddress:city	Text	Second Mortgagee Address
homeowner_insurance_policy-Part5-SecondMortgageeInformation:secondMortgageeAddress:state	State	Second Mortgagee Address
homeowner_insurance_policy-Part5-SecondMortgageeInformation:secondMortgageeAddress:zip	ZIP Code	Second Mortgagee Address
homeowner_insurance_policy-Part5-SecondMortgageeInformation:secondMortgageeLoanNumber	Text	Second Mortgagee Loan Number
homeowner_insurance_policy-Part5-SecondMortgageeInformation:c/oOrAttn	Text	C/O Or Attn
Sample document

Coming soon...

Sample JSON result
JSON
{
    "status": 200,
    "response": {
        "pk": 47368637,
        "uuid": "6a14d2be-d070-453b-ab60-ee19089ef105",
        "forms": [
            {
                "pk": 41499209,
                "uuid": "65995e58-0468-4ef8-96af-80f4cf2057a4",
                "form_type": "HOMEOWNER_INSURANCE_POLICY",
                "form_config_pk": 124031,
                "tables": [],
                "raw_fields": {
                    "homeowner_insurance_policy-Part2-PolicyInformation:balanceDue": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part4-MortgageeInformation:mortgagee": {
                        "value": "WELLS FARGO BANK, N. A. #936",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part4-MortgageeInformation:mortgageeLoanNumber": {
                        "value": "0545976458",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part4-MortgageeInformation:mortgageeAddress:zip": {
                        "value": "29502-0515",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part4-MortgageeInformation:mortgageeAddress:city": {
                        "value": "FLORENCE",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part5-SecondMortgageeInformation:secondMortgagee": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part4-MortgageeInformation:mortgageeAddress:state": {
                        "value": "SC",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part4-MortgageeInformation:isMortgageeIsaoa/AtimaStated?": {
                        "value": "YES",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part4-MortgageeInformation:mortgageeAddress:addressLine1": {
                        "value": "P O BOX 100515",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part4-MortgageeInformation:mortgageeAddress:addressLine2": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part5-SecondMortgageeInformation:secondMortgageeLoanNumber": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part5-SecondMortgageeInformation:secondMortgageeAddress:zip": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part5-SecondMortgageeInformation:secondMortgageeAddress:city": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part5-SecondMortgageeInformation:secondMortgageeAddress:state": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part5-SecondMortgageeInformation:isSecondMortgageeIsaoa/AtimaStated?": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part5-SecondMortgageeInformation:secondMortgageeAddress:addressLine1": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part5-SecondMortgageeInformation:secondMortgageeAddress:addressLine2": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part2-PolicyInformation:year": {
                        "value": "2020",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part2-PolicyInformation:loanNumber": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part2-PolicyInformation:paidInFull": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part2-PolicyInformation:binderNumber": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part2-PolicyInformation:policyNumber": {
                        "value": "OG3625419",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part2-PolicyInformation:totalPremium": {
                        "value": "830.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part2-PolicyInformation:effectiveDate": {
                        "value": "03/20/2020",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part2-PolicyInformation:expirationDate": {
                        "value": "03/16/2021",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part2-PolicyInformation:dwellingCoverage": {
                        "value": "139500.00",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part3-PropertyAddress:propertyAddress:zip": {
                        "value": "12550",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part3-PropertyAddress:propertyAddress:city": {
                        "value": "NEWBURGH",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part3-PropertyAddress:propertyAddress:state": {
                        "value": "NY",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part1-PolicyHolderInformation:insuredFullName1": {
                        "value": "MARK KNOX",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part1-PolicyHolderInformation:insuredFullName2": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part1-PolicyHolderInformation:insuredFullName3": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part1-PolicyHolderInformation:insuredFullName4": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part1-PolicyHolderInformation:insuredFullName5": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part1-PolicyHolderInformation:insuredFullName6": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part1-PolicyHolderInformation:isThisAnAcordForm?": {
                        "value": "NO",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part3-PropertyAddress:propertyAddress:addressLine1": {
                        "value": "1201 RT 300",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part3-PropertyAddress:propertyAddress:addressLine2": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part1-PolicyHolderInformation:policyHolderAddress:zip": {
                        "value": "23015",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part1-PolicyHolderInformation:insuranceCompanyOrAgency": {
                        "value": "SAFECO INSURANCE COMPANY OF AMERICA",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part1-PolicyHolderInformation:policyHolderAddress:city": {
                        "value": "BROCKTON",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part1-PolicyHolderInformation:policyHolderAddress:state": {
                        "value": "MA",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part2-PolicyInformation:guaranteedReplacementCostIndicated": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part1-PolicyHolderInformation:policyHolderAddress:addressLine1": {
                        "value": "700 OAK STREET",
                        "is_empty": false,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part1-PolicyHolderInformation:policyHolderAddress:addressLine2": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part1-PolicyHolderInformation:c/oOrAttn": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part4-MortgageeInformation:c/oOrAttn": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    },
                    "homeowner_insurance_policy-Part5-SecondMortgageeInformation:c/oOrAttn": {
                        "value": "",
                        "is_empty": true,
                        "alias_used": null,
                        "source_filename": "Sample 2 Homeowner Insurance (1).pdf"
                    }
                }
            }
        ]
    },
    "message": "OK"
}


Updated 10 months ago

Homeowners Association Statement
Mortgage Statement
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