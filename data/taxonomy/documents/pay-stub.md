# Pay Stub

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
Pay Stub
Suggest Edits

Our pay stub capture lets you make informed decisions involving a prospective borrower's recent income history. We identify and categorize the earnings and deductions listed on a pay stub, separating recurring base pay from one-time bonuses or commissions. Finally, the net pay distribution allows you to compare deposit amounts against bank statement transactions, giving you confidence in your lending decision.

Pay stubs work a little differently

Due to the bespoke nature of pay stubs, we do not support the PAYSTUB form type on any of the Form data endpoints. Please use one of the Pay stub data endpoints instead.

Usage guide

Here's how you can capture data from a pay stub:

If you haven't already, create a Book to hold the documents you'd like to capture.
Upload a pay stub to the Book with one of the following methods:
If your pay stub is contained in a PDF, you may upload it directly.
If your pay stub is contained in a sequence of images, upload them individually and finalize the resulting image group when you've finished.
Once the pay stub is processed, you can retrieve the captured data with one of the following methods:
You can retrieve a specific pay stub's captured data by calling this endpoint with its UUID.
You can retrieve the captured data for all pay stubs in a Book by providing the Book's UUID to this endpoint.

You can use webhook notifications to be immediately notified when we finish processing the pay stub. You can also poll the aforementioned endpoints.

Pay stub data structure

The pay stub full extraction output diagram is below.

The composite data type Pay stub, consists of several fields and composite data types. The items in blue denote a composite data type; for example, the Net Pay object consists of an array of Pay Distribution objects and a single Total object.

Details about the composite data structures can be found on the Pay stub composite data type page. You can find sample documents there as well.

PayStub

A representation of the data we've extracted from a given pay stub.

Learn more about how we process pay stubs here.

Properties
Name	Type	Description
uuid	string(uuid)	ID for the Paystub
book_uuid	string(uuid)	ID for the Book containing the Paystub
doc_uuid	string(uuid)	ID for the document containing the Paystub
doc_page_numbers	[integer]	Pay stub page number according to the order of pages at the time of upload.
uploaded_image_bucket_uuid	string(uuid)	A unique identifier for the storage location (bucket) where uploaded images are stored
employer	Employer	Name of the employer
employee	Employee	Name of the employee
employment_details	EmploymentDetails	Details of the employee
paystub_details	PayStubDetails	Employee's pay stub details
net_pay	NetPay	Net pay amount
earnings	Earnings	Total earnings
deductions	Deductions	Total deductions
Employer
Properties
Name	Type	Description
name	string¦null	Name of the employer
address	Address	Address of the employer
Employee
Properties
Name	Type	Description
name	string	Name of the employee
address	Address	Address of the employee
marital_status	string¦null	Tax filing status if printed on the pay stub
taxpayer_id	TaxpayerId	A unique identification number of the tax payer
Enumerated Values
Property	Value
marital_status	Married
marital_status	Single
marital_status	Not listed
EmploymentDetails
Properties
Name	Type	Description
hire_date	string(date)¦null	Date of hiring
annual_salary	numerical¦null	Annual salary
pay_basis	string¦null	The explicit pay basis if present on the pay stub
hourly_rate	numerical¦null	If a value is explicitly present on pay stub summary outside of the earnings table
Enumerated Values
Property	Value
pay_basis	Hourly
pay_basis	Salary
pay_basis	Other
pay_basis	Not listed
PayStubDetails
Properties
Name	Type	Description
pay_period_start_date	string(date)¦null	The date on which a specific pay period begins
pay_period_end_date	string(date)¦null	The date on which a specific pay period ends
pay_date	string(date)¦null	Date of payment
paystub_provider	string¦null	Name of the pay stub provider
pay_frequency	string¦null	system-calculated pay frequency when both pay_period_start_date and pay_period_end_date are explicitly present in the document
pay_frequency_captured	string¦null	The explicit pay frequency printed on the pay stub
Enumerated Values
Property	Value
pay_frequency	Weekly
pay_frequency	Biweekly
pay_frequency	Semi-monthly
pay_frequency	Monthly
pay_frequency	Annually
pay_frequency_captured	Weekly
pay_frequency_captured	Biweekly
pay_frequency_captured	Semi-monthly
pay_frequency_captured	Monthly
pay_frequency_captured	Annually
pay_frequency_captured	Not listed
NetPay
Properties
Name	Type	Description
distribution_details	[PayDistribution]	Net pay distribution details
totals	Total	Total pay
PayDistribution
Properties
Name	Type	Description
description	string¦null	Pay distribution description
bank_name	string¦null	Name of the bank where payment is received
account_number	string¦null	Account number in which payment is received
bank_account_type	string¦null	Type of bank account in which payment is received
current_pay	numerical¦null	Current pay amount
Earnings
Properties
Name	Type	Description
subtotals	[EarningsSubtotal]	Sub total earning
totals	[EarningsTotal]	Total earning
Deductions
Properties
Name	Type	Description
subtotals	[Total]	Sub total deductions
totals	[Total]	Total deductions
Total
Properties
Name	Type	Description
description	string¦null	Text of the line item as printed on the pay stub
canonical_description	CanonicalPayStubDescription	Commonly used term to describe the line item, e.g. Social Security Employee Tax
NULL value is provided when a line item is not recognized by Ocrolus.
current_pay	numerical¦null	Current pay amount
ytd_pay	numerical¦null	Payment amount of the year-to-date
EarningsTotal
Properties

allOf

Name	Type	Description
*anonymous*	Total	Anonymous

and

Name	Type	Description
*anonymous*	object	Anonymous
» current_hours	number	Current hours
EarningsSubtotal
Properties

allOf

Name	Type	Description
*anonymous*	EarningsTotal	Anonymous

and

Name	Type	Description
*anonymous*	object	Anonymous
» current_rate	number	Current rate
Address
Properties
Name	Type	Description
line1	string¦null	Address Line 1
line2	string¦null	Address Line 2
city	string¦null	City
state_code	string¦null	Usually a two-letter state code
postal_code	string¦null	Usually a 5-digit postal code
TaxpayerId

The identity of a person who pays taxes. Usually, it will be a social security number, but not always.

Properties
Name	Type	Description
id_type	string¦null	Type of ID, e.g. 'SSN'
last_4_digits	string¦null	The last 4 digits of the unique number of ID
Number

It usually represents US dollars.

Properties
Name	Type	Description
amount	numerical¦null	Numerical value most likely has at least two decimal digits
currency	string¦null	Example: USD
Status
Properties
Name	Description
status	Status of the pay stub processing. The available options are COMPLETED and REJECTED. The below example will help you understand one of the rejection scenarios:

Example: Consider that you uploaded multiple pages of PDF in which a few pages are marked as non-paystub pages. In such case, the status will return as REJECTED.

In the rejected pay stub, all the values are set to null. However, the document still retains its page indexes to indicate the position of each page in the PDF.
rejection_reason	The reason why the pay stub was rejected.
CanonicalPayStubDescription

Because pay stubs don't follow a standard format in the same way that tax forms do, different pay stubs may offer their own names for the same concept. Ocrolus is able to link common terms identified on pay stubs to a canonical description. Given below is the library of terms found on pay stubs that Ocrolus recognizes and maps to a canonical form field value.

If we couldn't map a pay stub entry to one of the aforementioned canonical names, then its canonical_description field in the returned object will be null. If you believe such an entry should have an alias or its own canonical description, please contact us with details about your use case.

Enumerated Values

Any use of CanonicalPayStubDescription refers to any of the below values. They are listed as earnings and deductions for convenience.

Earnings
Value	Description
ALLOWANCE	Any other allowance or stipend aside from PER DIEM
BEREAVEMENT	Bereavement leave earnings
BONUS	Bonus earnings besides retention, signing, and referral bonuses
COMMISSION	Commission earnings
DENTAL	Employer-sponsored dental contributions
HEALTH SAVINGS ACCOUNT/HSA/FSA	Employer HSA/FSA contributions
HOLIDAY PAY	Holiday earnings
INVESTMENTS	Employer contributions to stock or retirement investments
JURY DUTY	Jury duty earnings
LIFE INSURANCE	Employer-sponsored life insurance contributions
LEAVE	Leave earnings that don't fit one of these other descriptions
LOAN	Student loan repayment
LONG TERM DISABILITY PAYMENT	Long-term disability earnings
MEDICAL	Employer-sponsored medical contributions
MILITARY PAY	BAS, BAH, BAF
OTHER	Items that do not fit other categories
OVERTIME	Overtime earnings
PAID TIME OFF	Paid time off earnings
PER DIEM	Daily allowance and compensation earnings
REFERRAL BONUS	Referral award compensation
REGULAR PAY	Total base pay earnings
REIMBURSEMENTS	Any reimbursement if added to earnings
RETENTION BONUS	Retention award compensation
RETROACTIVE/BACK PAY	Compensation earned from previous pay periods
RSU	Restricted stock unit earnings
SEVERANCE PAY	Compensation for termination of employment
SHIFT DIFFERENTIAL	Additional earnings for working outside normal business hours
SHORT TERM DISABILITY PAYMENT	Short-term disability earnings
SICK PAY	Sick pay earnings
SIGNING BONUS	Sign-on award compensation
TIPS INCOME	Tips earnings
VACATION	Vacation earnings
VISION	Employer-sponsored vision plan contributions
Deductions

Deductions from the pay stub

Value	Description
401K	Both pre-tax and post-tax deductions for defined-contribution retirement plans: 401(k), 403(b), and 457(b)
ALIMONY & CHILD SUPPORT	Garnishments to pay Alimony (to a former spouse) or Child Support (from a non-custodial parent)
CAFETERIA/CAFE	Repayment for meals purchased from the company's cafeteria or cafe. Not to be confused with Section 125 Cafeteria plan deductions such as for Medical and Dental insurance, FSAs, HSAs, etc.
CITY/COUNTY TAX	Any city or county tax withholdings
DENTAL	Dental insurance deductions. If Medical and Dental are combined, call it Medical; if Dental and Vision are combined, call it Dental.
DEPENDENT CARE	FSA to spend on daycare or other childcare. They separate from Health Savings Account/HSA/FSA.
DISABILITY & FAMILY LEAVE TAX	Taxes that fund State Disability Insurance (SDI) and Paid Family (Medical) Leave (Insurance) programs, e.g. SDI, FML, PFL, PFML, FLI, etc.
DONATIONS	Charitable and political donations (do not include membership dues or fees)
DUES	Miscellaneous dues deducted from gross pay (e.g. Union Dues)
FEDERAL WITHHOLDINGS	Federal income tax withholdings, but not Social Security or Medicare (or FICA)
FICA	Combined Social Security and Medicare tax withholdings
GARNISHMENTS	Any wage garnishments besides Child Support or Alimony
HEALTH SAVINGS ACCOUNT/HSA/FSA	Health savings account and flexible spending account contributions except for Dependent Care. Also, section 125 Cafeteria plan deductions and AFLAC don't specify that they are for Medical, Dental, etc.
INVESTMENTS	A broad category for retirement plans and other investments besides those included in 401k, including IRA, Pension, and STRS
LEGAL & IDENTITY PROTECTION	Legal and/or identity theft protection services
LIFE INSURANCE	Life Insurance including Accidental Death and Dismemberment insurance (AD&D), Accident / Injury insurance, and Critical Illness insurance
LOAN	Any loan payment deducted from employee's earnings, including 401(k) loan and Advance
LONG TERM DISABILITY	Long-term disability insurance deductions
MEDICAL	Medical insurance and hospital. The AD&D and Critical Illness coverage fall under Life Insurance. If Medical and Dental are combined, call it Medical
MEDICARE TAX	Medicare tax withholdings. If Social Security and Medicare are combined, that goes to FICA
OFFSETS	Deductions to cancel out an amount from the Earnings section, because the amount is not being paid as part of the paycheck. For example, if the amount is being paid into the employee's stock account, or paid as a gift card
OTHER	Items that do not fit other categories
SHORT TERM DISABILITY	Short-term disability insurance deductions
SOCIAL SECURITY TAX	Social Security tax withholdings, including OASDI (not to be confused with SDI). If Social Security and Medicare are combined, that goes to FICA
STATE TAX	State tax withholdings, including for Unemployment Insurance. The SDI and all flavors of PFL fall under the Disability & Family Leave Tax
UNIFORMS	Deductions used to pay for workers' uniforms, shoes, boots, safety equipment, and similar
VISION	Vision insurance deductions. If Dental and Vision are combined, call it Dental.
Sample pay stub

The below Ocrolus Sample PDF (input) matches the below sample JSON result (output).

drive.google.com
Ocrolus - Paystub Sample.pdf
Sample JSON response
JSON
{
  "book_uuid": "69d1673c-9c30-4e1a-8f0e-5758e12b1f13",
  "uploaded_image_bucket_uuid": null,
  "doc_uuid": "7b662595-e811-4548-9a2a-e76dd6ffbd07",
  "doc_page_numbers": [
    1
  ],
  "uuid": "3fdbf4ea-097a-47e0-bc20-1f32a265ef3d",
  "employer": {
    "name": "INSTANT CARD NATIONAL",
    "address": {
      "line1": "2712 WHITE RIVER AVE.",
      "line2": null,
      "city": "OAKLAND",
      "state_code": "CA",
      "postal_code": "94621"
    }
  },
  "employee": {
    "name": "TAMIKA S. NOTE",
    "address": {
      "line1": "4654 SYCAMORE ST.",
      "line2": null,
      "city": "SAN JOSE",
      "state_code": "CA",
      "postal_code": "95113"
    },
    "marital_status": "SINGLE",
    "taxpayer_id": {
      "id_type": "SSN",
      "last_4_digits": "2323"
    }
  },
  "employment_details": {
    "hire_date": null,
    "annual_salary": {
      "amount": null,
      "currency": null
    },
    "pay_basis": null,
    "hourly_rate": {
      "amount": null,
      "currency": null
    }
  },
  "paystub_details": {
    "pay_period_start_date": "2022-03-04",
    "pay_period_end_date": "2022-03-17",
    "pay_date": "2022-03-18",
    "paystub_provider": null,
    "pay_frequency": "BI_WEEKLY",
    "pay_frequency_captured": "NOT LISTED"
  },
  "net_pay": {
    "distribution_details": [
      {
        "description": "UNION CREDIT BANK SAVINGS 5252",
        "bank_name": "UNION CREDIT BANK",
        "account_number": "5252",
        "bank_account_type": "SAVINGS",
        "current_pay": {
          "amount": "100.00",
          "currency": "USD"
        }
      },
      {
        "description": "FEDERAL CREDIT UNION CHECKING 3328",
        "bank_name": "FEDERAL CREDIT UNION",
        "account_number": "3328",
        "bank_account_type": "CHECKING",
        "current_pay": {
          "amount": "863.60",
          "currency": "USD"
        }
      }
    ],
    "totals": {
      "description": "NET PAY",
      "canonical_description": null,
      "current_pay": {
        "amount": "963.60",
        "currency": "USD"
      },
      "ytd_pay": {
        "amount": "8952.65",
        "currency": "USD"
      }
    }
  },
  "earnings": {
    "subtotals": [
      {
        "description": "REGULAR",
        "canonical_description": "REGULAR PAY",
        "current_pay": {
          "amount": "1600.00",
          "currency": "USD"
        },
        "ytd_pay": {
          "amount": "9600.00",
          "currency": "USD"
        },
        "current_hours": "80.00",
        "current_rate": "20.00"
      },
      {
        "description": "ANNUAL BONUS",
        "canonical_description": "BONUS",
        "current_pay": {
          "amount": "0.00",
          "currency": "USD"
        },
        "ytd_pay": {
          "amount": "5250.00",
          "currency": "USD"
        },
        "current_hours": null,
        "current_rate": null
      }
    ],
    "totals": [
      {
        "description": "GROSS PAY",
        "canonical_description": null,
        "current_pay": {
          "amount": "1600.00",
          "currency": "USD"
        },
        "ytd_pay": {
          "amount": "14850.00",
          "currency": "USD"
        },
        "current_hours": null
      }
    ]
  },
  "deductions": {
    "subtotals": [
      {
        "description": "HEALTH PLAN",
        "canonical_description": "MEDICAL",
        "current_pay": {
          "amount": "46.00",
          "currency": "USD"
        },
        "ytd_pay": {
          "amount": "417.66",
          "currency": "USD"
        }
      },
      {
        "description": "FEDERAL TAX",
        "canonical_description": "FEDERAL WITHHOLDINGS",
        "current_pay": {
          "amount": "352.00",
          "currency": "USD"
        },
        "ytd_pay": {
          "amount": "3267.00",
          "currency": "USD"
        }
      },
      {
        "description": "SOCIAL SECURITY",
        "canonical_description": "SOCIAL SECURITY EMPLOYEE TAX",
        "current_pay": {
          "amount": "99.20",
          "currency": "USD"
        },
        "ytd_pay": {
          "amount": "920.70",
          "currency": "USD"
        }
      },
      {
        "description": "MEDICARE",
        "canonical_description": "EMPLOYEE MEDICARE",
        "current_pay": {
          "amount": "23.20",
          "currency": "USD"
        },
        "ytd_pay": {
          "amount": "215.36",
          "currency": "USD"
        }
      },
      {
        "description": "STATE TAX",
        "canonical_description": "STATE TAX",
        "current_pay": {
          "amount": "116.00",
          "currency": "USD"
        },
        "ytd_pay": {
          "amount": "1076.63",
          "currency": "USD"
        }
      }
    ],
    "totals": [
      {
        "description": "DEDUCTIONS",
        "canonical_description": null,
        "current_pay": {
          "amount": "636.40",
          "currency": "USD"
        },
        "ytd_pay": {
          "amount": "5897.35",
          "currency": "USD"
        }
      }
    ]
  },
  "status": "COMPLETED",
  "rejection_reason": null
}


Updated 3 months ago

SEE ALSO
Pay stub processing
Did this page help you?
Yes
No
TABLE OF CONTENTS
Usage guide
Pay stub data structure
PayStub
Properties
Employer
Properties
Employee
Properties
EmploymentDetails
Properties
PayStubDetails
Properties
NetPay
Properties
PayDistribution
Properties
Earnings
Properties
Deductions
Properties
Total
Properties
EarningsTotal
Properties
EarningsSubtotal
Properties
Address
Properties
TaxpayerId
Properties
Number
Properties
Status
Properties
CanonicalPayStubDescription
Enumerated Values
Sample pay stub
Sample JSON response
Home
Guides
API
Supported documents
Release notes

Ocrolus © 2025. All rights reserved. Legal | Privacy Policy