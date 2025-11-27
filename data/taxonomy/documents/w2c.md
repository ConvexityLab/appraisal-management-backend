# W-2C - Corrected Wage and Tax Statement

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
W-2C - Corrected Wage and Tax Statement
Suggest Edits

This form is used to correct errors on a previously filed W-2 form, such as incorrect income, tax withheld, or other details. It allows employers to provide accurate information to both the employee and the IRS.

To use the Upload PDF endpoint for this document, you must use A_W_2C in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
a_w_2c-Part1-General:boxA-Employer'SName	Text	Box A - Employer's Name
a_w_2c-Part1-General:boxA-Employer'SAddress:addressLine1	Text	Box A - Employer's Address
a_w_2c-Part1-General:boxA-Employer'SAddress:addressLine2	Text	Box A - Employer's Address
a_w_2c-Part1-General:boxA-Employer'SAddress:city	Text	Box A - Employer's Address
a_w_2c-Part1-General:boxA-Employer'SAddress:state	State	Box A - Employer's Address
a_w_2c-Part1-General:boxA-Employer'SAddress:zip	ZIP Code	Box A - Employer's Address
a_w_2c-Part1-General:boxB-EmployerIdentificationNumber(Ein)	EIN	Box B - Employer Identification Number (EIN)
a_w_2c-Part1-General:boxC-TaxYear	Integer	Box C - Tax Year
a_w_2c-Part1-General:boxC-FormCorrected	Integer	Box C - Form Corrected
a_w_2c-Part1-General:boxD-Employee'SCorrectSsn	Social Security Number	Box D - Employee's Correct SSN
a_w_2c-Part1-General:boxE-CorrectedSsnAnd/OrName	CHECKED, UNCHECKED	Box E - Corrected SSN And/Or Name
a_w_2c-Part1-General:boxF-Employee'SPreviouslyReportedSsn	Social Security Number	Box F - Employee's Previously Reported SSN
a_w_2c-Part1-General:boxG-Employee'SPreviouslyReportedName	Text	Box G - Employee's Previously Reported Name
a_w_2c-Part1-General:boxH-Employee'SFirstNameAndInitial	Text	Box H - Employee's First Name And Initial
a_w_2c-Part1-General:boxH-Employee'SLastName	Text	Box H - Employee's Last Name
a_w_2c-Part1-General:boxH-Employee'SSuff.	Text	Box H - Employee's Suff.
a_w_2c-Part1-General:boxI-Employee'SAddress:addressLine1	Text	Box I - Employee's Address
a_w_2c-Part1-General:boxI-Employee'SAddress:addressLine2	Text	Box I - Employee's Address
a_w_2c-Part1-General:boxI-Employee'SAddress:city	Text	Box I - Employee's Address
a_w_2c-Part1-General:boxI-Employee'SAddress:state	State	Box I - Employee's Address
a_w_2c-Part1-General:boxI-Employee'SAddress:zip	ZIP Code	Box I - Employee's Address
a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box1-WagesTipsOtherCompensation:previouslyReported	Money	Box 1 - Wages Tips Other Compensation
a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box1-WagesTipsOtherCompensation:correctInformation	Money	Box 1 - Wages Tips Other Compensation
a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box2-FederalIncomeTaxWithheld:previouslyReported	Money	Box 2 - Federal Income Tax Withheld
a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box2-FederalIncomeTaxWithheld:correctInformation	Money	Box 2 - Federal Income Tax Withheld
a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box3-SocialSecurityWages:previouslyReported	Money	Box 3 - Social Security Wages
a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box3-SocialSecurityWages:correctInformation	Money	Box 3 - Social Security Wages
a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box4-SocialSecurityTaxWithheld:previouslyReported	Money	Box 4 - Social Security Tax Withheld
a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box4-SocialSecurityTaxWithheld:correctInformation	Money	Box 4 - Social Security Tax Withheld
a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box5-MedicareWagesAndTips:previouslyReported	Money	Box 5 - Medicare Wages And Tips
a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box5-MedicareWagesAndTips:correctInformation	Money	Box 5 - Medicare Wages And Tips
a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box6-MedicareTaxWithheld:previouslyReported	Money	Box 6 - Medicare Tax Withheld
a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box6-MedicareTaxWithheld:correctInformation	Money	Box 6 - Medicare Tax Withheld
a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box7-SocialSecurityTips:previouslyReported	Money	Box 7 - Social Security Tips
a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box7-SocialSecurityTips:correctInformation	Money	Box 7 - Social Security Tips
a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box8-AllocatedTips:previouslyReported	Money	Box 8 - Allocated Tips
a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box8-AllocatedTips:correctInformation	Money	Box 8 - Allocated Tips
a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:box9:previouslyReported	Text	Box 9
a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:box9:correctInformation	Text	Box 9
a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:box10-DependentCareBenefits:previouslyReported	Money	Box 10 - Dependent Care Benefits
a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:box10-DependentCareBenefits:correctInformation	Money	Box 10 - Dependent Care Benefits
a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:box11-NonqualifiedPlans:previouslyReported	Money	Box 11 - Nonqualified Plans
a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:box11-NonqualifiedPlans:correctInformation	Money	Box 11 - Nonqualified Plans
a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12A-SeeInstructionsForBox12:previouslyReported-Code	A, B, C, D, E, F, G, H, J, K, L, M, N, P, Q, R, S, T, V, W, Y, Z, AA, BB, DD, EE, FF, GG, HH, II	Line 12 A - See Instructions For Box 12
a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12A-SeeInstructionsForBox12:previouslyReported-Amount	Money	Line 12 A - See Instructions For Box 12
a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12A-SeeInstructionsForBox12:correctInformation-Code	A, B, C, D, E, F, G, H, J, K, L, M, N, P, Q, R, S, T, V, W, Y, Z, AA, BB, DD, EE, FF, GG, HH, II	Line 12 A - See Instructions For Box 12
a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12A-SeeInstructionsForBox12:correctInformation-Amount	Money	Line 12 A - See Instructions For Box 12
a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12B-SeeInstructionsForBox12:previouslyReported-Code	A, B, C, D, E, F, G, H, J, K, L, M, N, P, Q, R, S, T, V, W, Y, Z, AA, BB, DD, EE, FF, GG, HH, II	Line 12 B - See Instructions For Box 12
a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12B-SeeInstructionsForBox12:previouslyReported-Amount	Money	Line 12 B - See Instructions For Box 12
a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12B-SeeInstructionsForBox12:correctInformation-Code	A, B, C, D, E, F, G, H, J, K, L, M, N, P, Q, R, S, T, V, W, Y, Z, AA, BB, DD, EE, FF, GG, HH, II	Line 12 B - See Instructions For Box 12
a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12B-SeeInstructionsForBox12:correctInformation-Amount	Money	Line 12 B - See Instructions For Box 12
a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12C-SeeInstructionsForBox12:previouslyReported-Code	A, B, C, D, E, F, G, H, J, K, L, M, N, P, Q, R, S, T, V, W, Y, Z, AA, BB, DD, EE, FF, GG, HH, II	Line 12 C - See Instructions For Box 12
a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12C-SeeInstructionsForBox12:previouslyReported-Amount	Money	Line 12 C - See Instructions For Box 12
a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12C-SeeInstructionsForBox12:correctInformation-Code	A, B, C, D, E, F, G, H, J, K, L, M, N, P, Q, R, S, T, V, W, Y, Z, AA, BB, DD, EE, FF, GG, HH, II	Line 12 C - See Instructions For Box 12
a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12C-SeeInstructionsForBox12:correctInformation-Amount	Money	Line 12 C - See Instructions For Box 12
a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12D-SeeInstructionsForBox12:previouslyReported-Code	A, B, C, D, E, F, G, H, J, K, L, M, N, P, Q, R, S, T, V, W, Y, Z, AA, BB, DD, EE, FF, GG, HH, II	Line 12 D - See Instructions For Box 12
a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12D-SeeInstructionsForBox12:previouslyReported-Amount	Money	Line 12 D - See Instructions For Box 12
a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12D-SeeInstructionsForBox12:correctInformation-Code	A, B, C, D, E, F, G, H, J, K, L, M, N, P, Q, R, S, T, V, W, Y, Z, AA, BB, DD, EE, FF, GG, HH, II	Line 12 D - See Instructions For Box 12
a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12D-SeeInstructionsForBox12:correctInformation-Amount	Money	Line 12 D - See Instructions For Box 12
a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:box13-PreviouslyReported-CheckBox:statutoryEmployee	CHECKED, UNCHECKED	Box 13 - Previously Reported - Check Box
a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:box13-PreviouslyReported-CheckBox:retirementPlan	CHECKED, UNCHECKED	Box 13 - Previously Reported - Check Box
a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:box13-PreviouslyReported-CheckBox:third-partySickPay	CHECKED, UNCHECKED	Box 13 - Previously Reported - Check Box
a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:box13-CorrectInformation-CheckBox:statutoryEmployee	CHECKED, UNCHECKED	Box 13 - Correct Information - Check Box
a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:box13-CorrectInformation-CheckBox:retirementPlan	CHECKED, UNCHECKED	Box 13 - Correct Information - Check Box
a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:box13-CorrectInformation-CheckBox:third-partySickPay	CHECKED, UNCHECKED	Box 13 - Correct Information - Check Box
a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:box14-Other(SeeInstructions):previouslyReported	Text	Box 14 - Other (See Instructions)
a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:box14-Other(SeeInstructions):correctInformation	Text	Box 14 - Other (See Instructions)
a_w_2c-Part4-StateCorrectionInformation:box15-State1:previouslyReported	State	Box 15 - State 1
a_w_2c-Part4-StateCorrectionInformation:box15-State1:correctInformation	State	Box 15 - State 1
a_w_2c-Part4-StateCorrectionInformation:box15-State2:previouslyReported	State	Box 15 - State 2
a_w_2c-Part4-StateCorrectionInformation:box15-State2:correctInformation	State	Box 15 - State 2
a_w_2c-Part4-StateCorrectionInformation:box15-Employer'SStateIdNumber1:previouslyReported	EIN	Box 15 - Employer's State ID Number 1
a_w_2c-Part4-StateCorrectionInformation:box15-Employer'SStateIdNumber1:correctInformation	EIN	Box 15 - Employer's State ID Number 1
a_w_2c-Part4-StateCorrectionInformation:box15-Employer'SStateIdNumber2:previouslyReported	EIN	Box 15 - Employer's State ID Number 2
a_w_2c-Part4-StateCorrectionInformation:box15-Employer'SStateIdNumber2:correctInformation	EIN	Box 15 - Employer's State ID Number 2
a_w_2c-Part4-StateCorrectionInformation:box16-StateWagesTipsEtc.1:previouslyReported	Money	Box 16 - State Wages Tips Etc. 1
a_w_2c-Part4-StateCorrectionInformation:box16-StateWagesTipsEtc.1:correctInformation	Money	Box 16 - State Wages Tips Etc. 1
a_w_2c-Part4-StateCorrectionInformation:box16-StateWagesTipsEtc.2:previouslyReported	Money	Box 16 - State Wages Tips Etc. 2
a_w_2c-Part4-StateCorrectionInformation:box16-StateWagesTipsEtc.2:correctInformation	Money	Box 16 - State Wages Tips Etc. 2
a_w_2c-Part4-StateCorrectionInformation:box17-StateIncomeTax1:previouslyReported	Money	Box 17 - State Income Tax 1
a_w_2c-Part4-StateCorrectionInformation:box17-StateIncomeTax1:correctInformation	Money	Box 17 - State Income Tax 1
a_w_2c-Part4-StateCorrectionInformation:box17-StateIncomeTax2:previouslyReported	Money	Box 17 - State Income Tax 2
a_w_2c-Part4-StateCorrectionInformation:box17-StateIncomeTax2:correctInformation	Money	Box 17 - State Income Tax 2
a_w_2c-Part5-LocalityCorrectionInformation:box18-LocalWagesTipsEtc.1:previouslyReported	Money	Box 18 - Local Wages Tips Etc. 1
a_w_2c-Part5-LocalityCorrectionInformation:box18-LocalWagesTipsEtc.1:correctInformation	Money	Box 18 - Local Wages Tips Etc. 1
a_w_2c-Part5-LocalityCorrectionInformation:box18-LocalWagesTipsEtc.2:previouslyReported	Money	Box 18 - Local Wages Tips Etc. 2
a_w_2c-Part5-LocalityCorrectionInformation:box18-LocalWagesTipsEtc.2:correctInformation	Money	Box 18 - Local Wages Tips Etc. 2
a_w_2c-Part5-LocalityCorrectionInformation:box19-LocalIncomeTax1:previouslyReported	Money	Box 19 - Local Income Tax 1
a_w_2c-Part5-LocalityCorrectionInformation:box19-LocalIncomeTax1:correctInformation	Money	Box 19 - Local Income Tax 1
a_w_2c-Part5-LocalityCorrectionInformation:box19-LocalIncomeTax2:previouslyReported	Money	Box 19 - Local Income Tax 2
a_w_2c-Part5-LocalityCorrectionInformation:box19-LocalIncomeTax2:correctInformation	Money	Box 19 - Local Income Tax 2
a_w_2c-Part5-LocalityCorrectionInformation:box20-LocalityName1:previouslyReported	Text	Box 20 - Locality Name 1
a_w_2c-Part5-LocalityCorrectionInformation:box20-LocalityName1:correctInformation	Text	Box 20 - Locality Name 1
a_w_2c-Part5-LocalityCorrectionInformation:box20-LocalityName2:previouslyReported	Text	Box 20 - Locality Name 2
a_w_2c-Part5-LocalityCorrectionInformation:box20-LocalityName2:correctInformation	Text	Box 20 - Locality Name 2
Sample document
drive.google.com
W-2C.pdf
Sample JSON result
JSON
{
  "pk": 52623290,
  "uuid": "91726ac4-a76e-4bd9-96ac-ce5813f35801",
  "name": "W-2C",
  "created": "2024-08-14T19:55:48Z",
  "created_ts": "2024-08-14T19:55:48Z",
  "verified_pages_count": 1,
  "book_status": "ACTIVE",
  "id": 52623290,
  "forms": [
    {
      "pk": 57467252,
      "uuid": "42b451f8-7c07-478f-a2f1-b21afd1bb37a",
      "uploaded_doc_pk": 76631097,
      "form_type": "A_W_2C",
      "raw_fields": {
        "a_w_2c-Part1-General:boxC-TaxYear": {
          "value": "2023",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part1-General:boxC-FormCorrected": {
          "value": "24",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part1-General:boxA-Employer'SName": {
          "value": "JOHN SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part1-General:boxH-Employee'SSuff.": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part1-General:boxH-Employee'SLastName": {
          "value": "SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part1-General:boxD-Employee'SCorrectSsn": {
          "value": "123-45-6789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part1-General:boxA-Employer'SAddress:zip": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part1-General:boxI-Employee'SAddress:zip": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part1-General:boxA-Employer'SAddress:city": {
          "value": "ANY CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part1-General:boxE-CorrectedSsnAnd/OrName": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part1-General:boxI-Employee'SAddress:city": {
          "value": "ANY CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part1-General:boxA-Employer'SAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part1-General:boxI-Employee'SAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part1-General:boxH-Employee'SFirstNameAndInitial": {
          "value": "JOHN M",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part1-General:boxA-Employer'SAddress:addressLine1": {
          "value": "123 ANY SW STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part1-General:boxA-Employer'SAddress:addressLine2": {
          "value": "APT 123",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part1-General:boxI-Employee'SAddress:addressLine1": {
          "value": "123 ANY SW STREET ROAD",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part1-General:boxI-Employee'SAddress:addressLine2": {
          "value": "APT 123",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part1-General:boxF-Employee'SPreviouslyReportedSsn": {
          "value": "123-44-5678",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part1-General:boxG-Employee'SPreviouslyReportedName": {
          "value": "JOHN S SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part1-General:boxB-EmployerIdentificationNumber(Ein)": {
          "value": "12-3456789",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part4-StateCorrectionInformation:box15-State1:correctInformation": {
          "value": "CA",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part4-StateCorrectionInformation:box15-State1:previouslyReported": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part4-StateCorrectionInformation:box15-State2:correctInformation": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part4-StateCorrectionInformation:box15-State2:previouslyReported": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part4-StateCorrectionInformation:box17-StateIncomeTax1:correctInformation": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part4-StateCorrectionInformation:box17-StateIncomeTax1:previouslyReported": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part4-StateCorrectionInformation:box17-StateIncomeTax2:correctInformation": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part4-StateCorrectionInformation:box17-StateIncomeTax2:previouslyReported": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part5-LocalityCorrectionInformation:box20-LocalityName1:correctInformation": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part5-LocalityCorrectionInformation:box20-LocalityName1:previouslyReported": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part5-LocalityCorrectionInformation:box20-LocalityName2:correctInformation": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part5-LocalityCorrectionInformation:box20-LocalityName2:previouslyReported": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:box9:correctInformation": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:box9:previouslyReported": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part5-LocalityCorrectionInformation:box19-LocalIncomeTax1:correctInformation": {
          "value": "800.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part5-LocalityCorrectionInformation:box19-LocalIncomeTax1:previouslyReported": {
          "value": "500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part5-LocalityCorrectionInformation:box19-LocalIncomeTax2:correctInformation": {
          "value": "660.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part5-LocalityCorrectionInformation:box19-LocalIncomeTax2:previouslyReported": {
          "value": "550.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part4-StateCorrectionInformation:box16-StateWagesTipsEtc.1:correctInformation": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part4-StateCorrectionInformation:box16-StateWagesTipsEtc.1:previouslyReported": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part4-StateCorrectionInformation:box16-StateWagesTipsEtc.2:correctInformation": {
          "value": "100.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part4-StateCorrectionInformation:box16-StateWagesTipsEtc.2:previouslyReported": {
          "value": "200.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part5-LocalityCorrectionInformation:box18-LocalWagesTipsEtc.1:correctInformation": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part5-LocalityCorrectionInformation:box18-LocalWagesTipsEtc.1:previouslyReported": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part5-LocalityCorrectionInformation:box18-LocalWagesTipsEtc.2:correctInformation": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part5-LocalityCorrectionInformation:box18-LocalWagesTipsEtc.2:previouslyReported": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part4-StateCorrectionInformation:box15-Employer'SStateIdNumber1:correctInformation": {
          "value": "22-2222222",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part4-StateCorrectionInformation:box15-Employer'SStateIdNumber1:previouslyReported": {
          "value": "22-2222222",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part4-StateCorrectionInformation:box15-Employer'SStateIdNumber2:correctInformation": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part4-StateCorrectionInformation:box15-Employer'SStateIdNumber2:previouslyReported": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box8-AllocatedTips:correctInformation": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box8-AllocatedTips:previouslyReported": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box7-SocialSecurityTips:correctInformation": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box7-SocialSecurityTips:previouslyReported": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box3-SocialSecurityWages:correctInformation": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box3-SocialSecurityWages:previouslyReported": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box6-MedicareTaxWithheld:correctInformation": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box6-MedicareTaxWithheld:previouslyReported": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:box11-NonqualifiedPlans:correctInformation": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:box11-NonqualifiedPlans:previouslyReported": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box5-MedicareWagesAndTips:correctInformation": {
          "value": "200.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box5-MedicareWagesAndTips:previouslyReported": {
          "value": "250.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:box10-DependentCareBenefits:correctInformation": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:box10-DependentCareBenefits:previouslyReported": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box2-FederalIncomeTaxWithheld:correctInformation": {
          "value": "2600.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box2-FederalIncomeTaxWithheld:previouslyReported": {
          "value": "2500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:box14-Other(SeeInstructions):correctInformation": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:box14-Other(SeeInstructions):previouslyReported": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box4-SocialSecurityTaxWithheld:correctInformation": {
          "value": "250.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box4-SocialSecurityTaxWithheld:previouslyReported": {
          "value": "2500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:box13-CorrectInformation-CheckBox:retirementPlan": {
          "value": "UNCHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:box13-PreviouslyReported-CheckBox:retirementPlan": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box1-WagesTipsOtherCompensation:correctInformation": {
          "value": "150.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part2-PreviouslyReportedAndCorrectInformationBox1-8:box1-WagesTipsOtherCompensation:previouslyReported": {
          "value": "200.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:box13-CorrectInformation-CheckBox:statutoryEmployee": {
          "value": "UNCHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:box13-PreviouslyReported-CheckBox:statutoryEmployee": {
          "value": "UNCHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:box13-CorrectInformation-CheckBox:third-partySickPay": {
          "value": "CHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:box13-PreviouslyReported-CheckBox:third-partySickPay": {
          "value": "UNCHECKED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12A-SeeInstructionsForBox12:correctInformation-Code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12A-SeeInstructionsForBox12:previouslyReported-Code": {
          "value": "B",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12B-SeeInstructionsForBox12:correctInformation-Code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12B-SeeInstructionsForBox12:previouslyReported-Code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12C-SeeInstructionsForBox12:correctInformation-Code": {
          "value": "C",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12C-SeeInstructionsForBox12:previouslyReported-Code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12D-SeeInstructionsForBox12:correctInformation-Code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12D-SeeInstructionsForBox12:previouslyReported-Code": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12A-SeeInstructionsForBox12:correctInformation-Amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12A-SeeInstructionsForBox12:previouslyReported-Amount": {
          "value": "250.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12B-SeeInstructionsForBox12:correctInformation-Amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12B-SeeInstructionsForBox12:previouslyReported-Amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12C-SeeInstructionsForBox12:correctInformation-Amount": {
          "value": "325.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12C-SeeInstructionsForBox12:previouslyReported-Amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12D-SeeInstructionsForBox12:correctInformation-Amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        },
        "a_w_2c-Part3-PreviouslyReportedAndCorrectInformationBox9-14:line12D-SeeInstructionsForBox12:previouslyReported-Amount": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "W-2C.pdf",
          "confidence": 1.0
        }
      },
      "form_config_pk": 717097,
      "tables": [],
      "attribute_data": null
    }
  ],
  "book_is_complete": true
}


Updated 10 months ago

IRS Form W-2 - Wage and Tax State
W9 - Request for Taxpayer Identification Number and Certification
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