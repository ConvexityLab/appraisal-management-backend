# URLA Field Reference - Optimized for AI Search

## Quick Search Index
**Keywords**: Use Ctrl+F to quickly find fields by these common terms:
- **Dates**: ApplicationReceivedDate, EmploymentStartDate, EmploymentEndDate, BorrowerBirthDate, CounselingCompletedDate, MilitaryServiceExpectedCompletionDate
- **Amounts**: AssetCashOrMarketValueAmount, LiabilityMonthlyPaymentAmount, ExpenseMonthlyPaymentAmount, EmploymentMonthlyIncomeAmount, CurrentIncomeMonthlyTotalAmount, EstimatedClosingCostsAmount, NoteAmount, BaseLoanAmount
- **Addresses**: AddressLineText, CityName, StateCode, PostalCode, CountryCode, AddressUnitIdentifier
- **Names**: FirstName, LastName, MiddleName, FullName, SuffixName
- **Identifiers**: AssetAccountIdentifier, LiabilityAccountIdentifier, PartyRoleIdentifier, TaxpayerIdentifierValue, AutomatedUnderwritingCaseIdentifier
- **Indicators**: BalloonIndicator, ConstructionLoanIndicator, HELOCIndicator, BankruptcyIndicator, SelfDeclaredMilitaryServiceIndicator
- **Types**: AssetType, LiabilityType, IncomeType, ExpenseType, MortgageType, PartyRoleType

---

## 1. MESSAGE & VERSION INFO
| Field | Path | Description |
|-------|------|-------------|
| DataVersionIdentifier | MESSAGE/ABOUT_VERSIONS/ABOUT_VERSION | Specifies the data file version |
| DataVersionName | ABOUT_VERSIONS/ABOUT_VERSION | Identifies the type of data file |

---

## 2. ASSETS
| Field | Path | Description |
|-------|------|-------------|
| **AssetAccountIdentifier** | ASSETS/ASSET/ASSET_DETAIL | Unique alphanumeric string identifying an asset |
| **AssetCashOrMarketValueAmount** | ASSETS/ASSET/ASSET_DETAIL | Cash or market value amount of the Asset Type |
| **AssetType** | ASSETS/ASSET/ASSET_DETAIL | MISMO prescribed list specifying financial assets in mortgage transaction |
| AssetTypeOtherDescription | ASSETS/ASSET/ASSET_DETAIL | Free-form text when Other is selected as Asset Type |
| **FundsSourceType** | ASSETS/ASSET/ASSET_DETAIL | MISMO prescribed list specifying party providing funds |
| FundsSourceTypeOtherDescription | ASSETS/ASSET/ASSET_DETAIL | Free-form text when Other is used for Funds Source Type |
| lpa:GiftGrantClosingCostAmount | ASSETS/ASSET/ASSET_DETAIL/EXTENSION/OTHER/ulad:ASSET_DETAIL_EXTENSION | Dollar amount of gift/grant for closing expenses |
| lpa:GiftGrantDownPaymentAmount | ASSETS/ASSET/ASSET_DETAIL/EXTENSION/OTHER/ulad:ASSET_DETAIL_EXTENSION | Dollar amount of gift/grant for down payment |
| ulad:IncludedInAssetAccountIndicator | ASSETS/ASSET/ASSET_DETAIL/EXTENSION/OTHER/ulad:ASSET_DETAIL_EXTENSION | True if item included in asset account value |

### Asset Holder Information
| Field | Path | Description |
|-------|------|-------------|
| **FullName** | ASSETS/ASSET/ASSET_HOLDER/NAME | Unparsed name of individual or legal entity |

### Owned Property Assets
| Field | Path | Description |
|-------|------|-------------|
| OwnedPropertyDispositionStatusType | ASSETS/ASSET/OWNED_PROPERTY/OWNED_PROPERTY_DETAIL | Intended disposition of owned real property |
| OwnedPropertyMaintenanceExpenseAmount | ASSETS/ASSET/OWNED_PROPERTY/OWNED_PROPERTY_DETAIL | Monthly amount for insurance, taxes, association dues |
| OwnedPropertyOwnedUnitCount | ASSETS/ASSET/OWNED_PROPERTY/OWNED_PROPERTY_DETAIL | Number of individual family dwelling units |
| **OwnedPropertyRentalIncomeGrossAmount** | ASSETS/ASSET/OWNED_PROPERTY/OWNED_PROPERTY_DETAIL | Monthly revenue from rent |
| **OwnedPropertyRentalIncomeNetAmount** | ASSETS/ASSET/OWNED_PROPERTY/OWNED_PROPERTY_DETAIL | Monthly net rental income after expenses |
| OwnedPropertySubjectIndicator | ASSETS/ASSET/OWNED_PROPERTY/OWNED_PROPERTY_DETAIL | True if owned property is subject property |

---

## 3. PROPERTIES
| Field | Path | Description |
|-------|------|-------------|
| **AddressLineText** | Multiple Paths | Address with number, street name, directionals, unit designators |
| **AddressUnitIdentifier** | Multiple Paths | Secondary address unit identifier (123, C, B1C, etc.) |
| **CityName** | Multiple Paths | Name of city or Military APO FPO designation |
| **CountryCode** | Multiple Paths | Two-character country representation |
| **PostalCode** | Multiple Paths | ZIP Code (5 or 9 digits) |
| **StateCode** | Multiple Paths | Two-character state/territory/province code |

### Subject Property Details
| Field | Path | Description |
|-------|------|-------------|
| ProjectLegalStructureType | PROPERTIES/PROPERTY/PROJECT | Form of ownership of project |
| PropertyCurrentUsageType | PROPERTIES/PROPERTY/PROPERTY_DETAIL | Current usage of property by borrower |
| **PropertyEstimatedValueAmount** | PROPERTIES/PROPERTY/PROPERTY_DETAIL | Estimated present market value from borrower/originator |
| PropertyIntendedUseType | PROPERTIES/PROPERTY/PROPERTY_DETAIL | Intended usage of property by borrower |
| PropertyExistingCleanEnergyLienIndicator | PROPERTIES/PROPERTY/PROPERTY_DETAIL | True if subject to clean energy lien |
| PropertyInProjectIndicator | PROPERTIES/PROPERTY/PROPERTY_DETAIL | True if located in a project |
| PropertyMixedUsageIndicator | PROPERTIES/PROPERTY/PROPERTY_DETAIL | True if includes commercial space |
| PUDIndicator | PROPERTIES/PROPERTY/PROPERTY_DETAIL | True if in Planned Unit Development |
| **PropertyRentalIncomeGrossAmount** | PROPERTIES/PROPERTY/PROPERTY_DETAIL | Estimated gross monthly rental income |
| **PropertyRentalIncomeNetAmount** | PROPERTIES/PROPERTY/PROPERTY_DETAIL | Estimated net monthly rental income |

---

## 4. EXPENSES & LIABILITIES

### Expenses
| Field | Path | Description |
|-------|------|-------------|
| **ExpenseMonthlyPaymentAmount** | EXPENSES/EXPENSE | Monthly payment amount for borrower's expense |
| **ExpenseType** | EXPENSES/EXPENSE/EXPENSE_DETAIL | MISMO prescribed list of borrower expenses |
| ExpenseTypeOtherDescription | EXPENSES/EXPENSE/EXPENSE_DETAIL | Free-form text when Other selected for Expense Type |
| ExpenseExclusionIndicator | EXPENSES/EXPENSE/EXPENSE_DETAIL | True if expense excluded from loan calculations |

### Liabilities
| Field | Path | Description |
|-------|------|-------------|
| HELOCMaximumBalanceAmount | LIABILITIES/LIABILITY | Maximum credit available on HELOC |
| **LiabilityAccountIdentifier** | LIABILITIES/LIABILITY/LIABILITY_DETAIL | Unique alphanumeric string identifying liability |
| LiabilityExclusionIndicator | LIABILITIES/LIABILITY/LIABILITY_DETAIL | True if excluded from loan calculations |
| **LiabilityMonthlyPaymentAmount** | LIABILITIES/LIABILITY/LIABILITY_DETAIL | Monthly payment required for liability |
| LiabilityPaymentIncludesTaxesInsuranceIndicator | LIABILITIES/LIABILITY/LIABILITY_DETAIL | True if payment includes taxes/insurance |
| LiabilityPaidOffAtClosingIndicator | LIABILITIES/LIABILITY/LIABILITY_DETAIL | True if paid off at/before closing |
| **LiabilityType** | LIABILITIES/LIABILITY/LIABILITY_DETAIL | MISMO prescribed list of financial obligations |
| LiabilityTypeOtherDescription | LIABILITIES/LIABILITY/LIABILITY_DETAIL | Free-form text when Other selected |
| **LiabilityUnpaidBalanceAmount** | LIABILITIES/LIABILITY/LIABILITY_DETAIL | Outstanding balance amount |
| SubjectLoanResubordinationIndicator | LIABILITIES/LIABILITY/LIABILITY_DETAIL | True if resubordinated to subject loan |

---

## 5. LOAN DETAILS

### Basic Loan Information
| Field | Path | Description |
|-------|------|-------------|
| LoanRoleType | LOANS/LOAN | Role the loan plays in transaction |
| **ApplicationReceivedDate** | LOANS/LOAN/LOAN_DETAIL | Date creditor received application from borrower |
| **BalloonIndicator** | LOANS/LOAN/LOAN_DETAIL | True if final balloon payment required |
| BuydownTemporarySubsidyFundingIndicator | LOANS/LOAN/LOAN_DETAIL | True if buydown funding reduces rate/payments |
| **ConstructionLoanIndicator** | LOANS/LOAN/LOAN_DETAIL | True if construction loan |
| ConversionOfContractForDeedIndicator | LOANS/LOAN/LOAN_DETAIL | True if pays off land contract |
| EnergyRelatedImprovementsIndicator | LOANS/LOAN/LOAN_DETAIL | True if includes energy improvements |
| **HELOCIndicator** | LOANS/LOAN/LOAN_DETAIL | True if Home Equity Line of Credit |
| InitialFixedPeriodEffectiveMonthsCount | LOANS/LOAN/LOAN_DETAIL | Months in initial fixed period (ARM) |
| InterestOnlyIndicator | LOANS/LOAN/LOAN_DETAIL | True if allows interest-only payments |
| LoanAffordableIndicator | LOANS/LOAN/LOAN_DETAIL | True if classified as affordable loan |
| NegativeAmortizationIndicator | LOANS/LOAN/LOAN_DETAIL | True if allows negative amortization |
| PrepaymentPenaltyIndicator | LOANS/LOAN/LOAN_DETAIL | True if includes prepayment penalty |

### Loan Terms
| Field | Path | Description |
|-------|------|-------------|
| **BaseLoanAmount** | LOANS/LOAN/TERMS_OF_LOAN | Base loan amount (excluding PMI/MIP/Funding Fee) |
| LienPriorityType | LOANS/LOAN/TERMS_OF_LOAN | Priority of lien against subject property |
| **LoanPurposeType** | LOANS/LOAN/TERMS_OF_LOAN | Purpose for loan proceeds |
| **MortgageType** | LOANS/LOAN/TERMS_OF_LOAN | Private/public entity guidelines |
| **NoteAmount** | LOANS/LOAN/TERMS_OF_LOAN | Amount to be repaid as disclosed on note |
| **NoteRatePercent** | LOANS/LOAN/TERMS_OF_LOAN | Actual interest rate on note |

### Loan Identifiers
| Field | Path | Description |
|-------|------|-------------|
| LoanOriginationSystemIdentifier | LOANS/LOAN/ORIGINATION_SYSTEMS/ORIGINATION_SYSTEM | Vendor identifier for loan origination system |
| LoanOriginationSystemVersionIdentifier | LOANS/LOAN/ORIGINATION_SYSTEMS/ORIGINATION_SYSTEM | Version of loan origination system |

### Payment Information
| Field | Path | Description |
|-------|------|-------------|
| **InitialPrincipalAndInterestPaymentAmount** | LOANS/LOAN/PAYMENT/PAYMENT_RULE | P&I payment amount as stated on Note |
| lpa:PaymentDeferredFirstFiveYearsIndicator | LOANS/LOAN/PAYMENT/PAYMENT_RULE/EXTENSION/OTHER/lpa:PAYMENT_RULE_EXTENSION | True if P&I not due first 5+ years |

### Refinance Information
| Field | Path | Description |
|-------|------|-------------|
| **RefinanceCashOutAmount** | LOANS/LOAN/REFINANCE | Cash borrower receives at closing (refinance) |
| **RefinanceCashOutDeterminationType** | LOANS/LOAN/REFINANCE | Classification of refinanced loan |

---

## 6. BORROWER INFORMATION

### Basic Borrower Details
| Field | Path | Description |
|-------|------|-------------|
| **FirstName** | PARTIES/PARTY/INDIVIDUAL/NAME | First name of individual |
| **LastName** | PARTIES/PARTY/INDIVIDUAL/NAME | Last name of individual |
| **MiddleName** | PARTIES/PARTY/INDIVIDUAL/NAME | Middle name of individual |
| **SuffixName** | PARTIES/PARTY/INDIVIDUAL/NAME | Name suffix (JR, SR, etc.) |
| **BorrowerBirthDate** | PARTIES/PARTY/ROLES/ROLE/BORROWER/BORROWER_DETAIL | Borrower's date of birth |
| BorrowerTotalMortgagedPropertiesCount | PARTIES/PARTY/ROLES/ROLE/BORROWER/BORROWER_DETAIL | Number of 1-4 unit financed properties |
| CommunityPropertyStateResidentIndicator | PARTIES/PARTY/ROLES/ROLE/BORROWER/BORROWER_DETAIL | True if lives in community property state |
| DependentCount | PARTIES/PARTY/ROLES/ROLE/BORROWER/BORROWER_DETAIL | Total number of dependents |
| JointAssetLiabilityReportingType | PARTIES/PARTY/ROLES/ROLE/BORROWER/BORROWER_DETAIL | How assets/liabilities reported |
| **MaritalStatusType** | PARTIES/PARTY/ROLES/ROLE/BORROWER/BORROWER_DETAIL | Marital status |
| **SelfDeclaredMilitaryServiceIndicator** | PARTIES/PARTY/ROLES/ROLE/BORROWER/BORROWER_DETAIL | True if served/serving in US Armed Forces |
| SpousalVABenefitsEligibilityIndicator | PARTIES/PARTY/ROLES/ROLE/BORROWER/BORROWER_DETAIL | True if eligible for VA spousal benefits |

### Contact Information
| Field | Path | Description |
|-------|------|-------------|
| ContactPointRoleType | PARTIES/PARTY/INDIVIDUAL/CONTACT_POINTS/CONTACT_POINT/CONTACT_POINT_DETAIL | Location associated with contact point |
| **ContactPointTelephoneValue** | PARTIES/PARTY/INDIVIDUAL/CONTACT_POINTS/CONTACT_POINT/CONTACT_POINT_TELEPHONE | Telephone number |

### Income Information
| Field | Path | Description |
|-------|------|-------------|
| **CurrentIncomeMonthlyTotalAmount** | PARTIES/PARTY/ROLES/ROLE/BORROWER/CURRENT_INCOME/CURRENT_INCOME_ITEMS/CURRENT_INCOME_ITEM/CURRENT_INCOME_ITEM_DETAIL | Monthly total for specified income item |
| EmploymentIncomeIndicator | PARTIES/PARTY/ROLES/ROLE/BORROWER/CURRENT_INCOME/CURRENT_INCOME_ITEMS/CURRENT_INCOME_ITEM/CURRENT_INCOME_ITEM_DETAIL | True if from employment source |
| **IncomeType** | PARTIES/PARTY/ROLES/ROLE/BORROWER/CURRENT_INCOME/CURRENT_INCOME_ITEMS/CURRENT_INCOME_ITEM/CURRENT_INCOME_ITEM_DETAIL | MISMO prescribed list of borrower income items |
| IncomeTypeOtherDescription | PARTIES/PARTY/ROLES/ROLE/BORROWER/CURRENT_INCOME/CURRENT_INCOME_ITEMS/CURRENT_INCOME_ITEM/CURRENT_INCOME_ITEM_DETAIL | Free-form text when Other selected |

### Employment Information
| Field | Path | Description |
|-------|------|-------------|
| EmploymentBorrowerSelfEmployedIndicator | PARTIES/PARTY/ROLES/ROLE/BORROWER/EMPLOYERS/EMPLOYER/EMPLOYMENT | True if borrower self-employed |
| EmploymentClassificationType | PARTIES/PARTY/ROLES/ROLE/BORROWER/EMPLOYERS/EMPLOYER/EMPLOYMENT | Primary or secondary employment |
| **EmploymentMonthlyIncomeAmount** | PARTIES/PARTY/ROLES/ROLE/BORROWER/EMPLOYERS/EMPLOYER/EMPLOYMENT | Monthly income from employment |
| EmploymentPositionDescription | PARTIES/PARTY/ROLES/ROLE/BORROWER/EMPLOYERS/EMPLOYER/EMPLOYMENT | Employment position/title |
| **EmploymentStartDate** | PARTIES/PARTY/ROLES/ROLE/BORROWER/EMPLOYERS/EMPLOYER/EMPLOYMENT | Date borrower started position |
| **EmploymentEndDate** | PARTIES/PARTY/ROLES/ROLE/BORROWER/EMPLOYERS/EMPLOYER/EMPLOYMENT | Date borrower left position |
| **EmploymentStatusType** | PARTIES/PARTY/ROLES/ROLE/BORROWER/EMPLOYERS/EMPLOYER/EMPLOYMENT | Current or previous employment |
| EmploymentTimeInLineOfWorkMonthsCount | PARTIES/PARTY/ROLES/ROLE/BORROWER/EMPLOYERS/EMPLOYER/EMPLOYMENT | Months employed in line of work |
| OwnershipInterestType | PARTIES/PARTY/ROLES/ROLE/BORROWER/EMPLOYERS/EMPLOYER/EMPLOYMENT | Percentage of self-owned business |
| SpecialBorrowerEmployerRelationshipIndicator | PARTIES/PARTY/ROLES/ROLE/BORROWER/EMPLOYERS/EMPLOYER/EMPLOYMENT | True if employed by family/party to transaction |

### Declarations
| Field | Path | Description |
|-------|------|-------------|
| **BankruptcyIndicator** | PARTIES/PARTY/ROLES/ROLE/BORROWER/DECLARATION/DECLARATION_DETAIL | True if declared bankruptcy within 7 years |
| **CitizenshipResidencyType** | PARTIES/PARTY/ROLES/ROLE/BORROWER/DECLARATION/DECLARATION_DETAIL | US citizenship or alien status |
| FHASecondaryResidenceIndicator | PARTIES/PARTY/ROLES/ROLE/BORROWER/DECLARATION/DECLARATION_DETAIL | True if under FHA Secondary Residence policy |
| HomeownerPastThreeYearsType | PARTIES/PARTY/ROLES/ROLE/BORROWER/DECLARATION/DECLARATION_DETAIL | Ownership interest in property last 3 years |
| **IntentToOccupyType** | PARTIES/PARTY/ROLES/ROLE/BORROWER/DECLARATION/DECLARATION_DETAIL | Intent to occupy as primary residence |
| OutstandingJudgmentsIndicator | PARTIES/PARTY/ROLES/ROLE/BORROWER/DECLARATION/DECLARATION_DETAIL | True if outstanding judgments |
| PresentlyDelinquentIndicator | PARTIES/PARTY/ROLES/ROLE/BORROWER/DECLARATION/DECLARATION_DETAIL | True if delinquent on federal debt |
| PriorPropertyDeedInLieuConveyedIndicator | PARTIES/PARTY/ROLES/ROLE/BORROWER/DECLARATION/DECLARATION_DETAIL | True if deed in lieu within 7 years |
| PriorPropertyForeclosureCompletedIndicator | PARTIES/PARTY/ROLES/ROLE/BORROWER/DECLARATION/DECLARATION_DETAIL | True if foreclosure within 7 years |
| PriorPropertyShortSaleCompletedIndicator | PARTIES/PARTY/ROLES/ROLE/BORROWER/DECLARATION/DECLARATION_DETAIL | True if short sale within 7 years |
| PriorPropertyUsageType | PARTIES/PARTY/ROLES/ROLE/BORROWER/DECLARATION/DECLARATION_DETAIL | Usage of previously owned property |

### Housing Expenses
| Field | Path | Description |
|-------|------|-------------|
| **HousingExpensePaymentAmount** | PARTIES/PARTY/ROLES/ROLE/BORROWER/HOUSING_EXPENSES/HOUSING_EXPENSE | Monthly housing expense amount |
| HousingExpenseTimingType | PARTIES/PARTY/ROLES/ROLE/BORROWER/HOUSING_EXPENSES/HOUSING_EXPENSE | Present or proposed timing |
| **HousingExpenseType** | PARTIES/PARTY/ROLES/ROLE/BORROWER/HOUSING_EXPENSES/HOUSING_EXPENSE | Type of housing expense |
| HousingExpenseTypeOtherDescription | PARTIES/PARTY/ROLES/ROLE/BORROWER/HOUSING_EXPENSES/HOUSING_EXPENSE | Free-form text when Other selected |

### Military Service
| Field | Path | Description |
|-------|------|-------------|
| **MilitaryServiceExpectedCompletionDate** | PARTIES/PARTY/ROLES/ROLE/BORROWER/MILITARY_SERVICES/MILITARY_SERVICE | Expected end date of military service |
| **MilitaryStatusType** | PARTIES/PARTY/ROLES/ROLE/BORROWER/MILITARY_SERVICES/MILITARY_SERVICE | Duty status of military personnel |

### Residences
| Field | Path | Description |
|-------|------|-------------|
| BorrowerResidencyBasisType | PARTIES/PARTY/ROLES/ROLE/BORROWER/RESIDENCES/RESIDENCE/RESIDENCE_DETAIL | Basis of residence (own, rent, etc.) |
| BorrowerResidencyDurationMonthsCount | PARTIES/PARTY/ROLES/ROLE/BORROWER/RESIDENCES/RESIDENCE/RESIDENCE_DETAIL | Months resided at address |
| **BorrowerResidencyType** | PARTIES/PARTY/ROLES/ROLE/BORROWER/RESIDENCES/RESIDENCE/RESIDENCE_DETAIL | Current or prior residence |
| MonthlyRentAmount | PARTIES/PARTY/ROLES/ROLE/BORROWER/RESIDENCES/RESIDENCE/LANDLORD/LANDLORD_DETAIL | Monthly rent amount |

---

## 7. PARTY ROLES & IDENTIFIERS
| Field | Path | Description |
|-------|------|-------------|
| **PartyRoleType** | Multiple Paths | Role party plays in transaction |
| **PartyRoleIdentifier** | Multiple Paths | Unique identifier for party role |
| **TaxpayerIdentifierType** | PARTIES/PARTY/TAXPAYER_IDENTIFIERS/TAXPAYER_IDENTIFIER | Type of taxpayer ID (SSN, EIN, etc.) |
| **TaxpayerIdentifierValue** | PARTIES/PARTY/TAXPAYER_IDENTIFIERS/TAXPAYER_IDENTIFIER | Value of taxpayer identifier |

---

## 8. SERVICES & CREDIT
| Field | Path | Description |
|-------|------|-------------|
| **CreditReportIdentifier** | SERVICES/SERVICE/CREDIT/CREDIT_REQUEST/CREDIT_REQUEST_DATAS/CREDIT_REQUEST_DATA/CREDIT_REQUEST_DATA_DETAIL | Reference number for credit report |
| CreditReportRequestActionType | SERVICES/SERVICE/CREDIT/CREDIT_REQUEST/CREDIT_REQUEST_DATAS/CREDIT_REQUEST_DATA/CREDIT_REQUEST_DATA_DETAIL | Type of service action requested |
| **CreditReportType** | SERVICES/SERVICE/CREDIT/CREDIT_REQUEST/CREDIT_REQUEST_DATAS/CREDIT_REQUEST_DATA/CREDIT_REQUEST_DATA_DETAIL | Type of credit report |
| CreditRequestType | SERVICES/SERVICE/CREDIT/CREDIT_REQUEST/CREDIT_REQUEST_DATAS/CREDIT_REQUEST_DATA/CREDIT_REQUEST_DATA_DETAIL | Individual or Joint report |
| lpa:ServiceType | SERVICES/SERVICE/EXTENSION/OTHER/lpa:SERVICE_EXTENSION/lpa:SERVICE_DETAIL | Type of service being defined |

---

## 9. UNDERWRITING
| Field | Path | Description |
|-------|------|-------------|
| **AutomatedUnderwritingCaseIdentifier** | LOANS/LOAN/UNDERWRITING/AUTOMATED_UNDERWRITINGS/AUTOMATED_UNDERWRITING | Unique identifier for underwriting case |

---

## Usage Notes for AI Models:

1. **Search Strategy**: Use field names (bolded entries) for exact matches, or search descriptions for conceptual matches.

2. **Path Structure**: Paths show the XML/JSON hierarchy. Use "/" to separate levels when constructing queries.

3. **Key Data Types**:
   - **Amount**: Fields ending in "Amount" contain dollar values
   - **Indicator**: Boolean fields (true/false) ending in "Indicator"  
   - **Type**: Enumerated values from MISMO prescribed lists
   - **Date**: Date fields clearly marked with "Date" in name
   - **Count**: Integer values ending in "Count"

4. **Common Patterns**:
   - Extension paths (EXTENSION/OTHER/) contain vendor-specific fields
   - Multiple similar paths indicate repeating elements
   - "OtherDescription" fields provide free-form text when "Other" is selected

5. **Critical Fields for Loan Processing**:
   - **ApplicationReceivedDate**: Key for timeline calculations
   - **NoteAmount/BaseLoanAmount**: Core loan amounts
   - **BorrowerBirthDate**: Required for borrower identification
   - **EmploymentStartDate/EndDate**: Employment verification
   - **AssetCashOrMarketValueAmount**: Asset verification
   - **LiabilityMonthlyPaymentAmount**: Debt calculations
   - **MilitaryServiceIndicator**: VA loan eligibility

6. **VA-Specific Fields**: Look for "Military", "VA", or "SelfDeclaredMilitaryServiceIndicator" for VA loan processing.