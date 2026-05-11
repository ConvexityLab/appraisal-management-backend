# Order Decomposition — Decision Engine Integration Survey

**Phase N of `docs/DECISION_ENGINE_RULES_SURFACE.md`.**

`OrderDecompositionService.findRule(tenantId, clientId, productType)` is
the second rule-evaluation point in the canonical
engagement→order→matching flow. It runs *before* vendor matching: for
every `ClientOrder` on a newly-created engagement, it picks a
decomposition rule that determines which `VendorOrderTemplate[]` get
materialized into `VendorOrder` docs.

This survey captures what's there today and what needs to land for it
to be a first-class Decision Engine category alongside vendor-matching,
review-program, firing-rules, and axiom-criteria.

## Findings

### Storage

- Container: `decomposition-rules` (Cosmos, partition key `/tenantId`).
- Document type: `DecompositionRule` (see `src/types/decomposition-rule.types.ts`).
- Lookup precedence (in `findRule`):
  1. `tenantId + clientId + productType`
  2. `tenantId + productType` (no clientId)
  3. `'__global__' + productType` (platform default rules)
- Rules are SINGLETONS per (tenantId, clientId?, productType), NOT
  immutable versioned packs like the other Decision Engine categories.
- `autoApply: boolean` flag controls whether the orchestrator
  materializes vendor orders without human confirmation.

### Rule shape — fundamentally different from Prio-style rules

```typescript
interface DecompositionRule {
  id: string;                                 // recommend `rule-{scope}-{productType}`
  tenantId: string;                           // partition key
  productType: ProductType;                   // match criterion
  clientId?: string;                          // optional client override
  default?: boolean;                          // global default marker
  autoApply?: boolean;                        // skip-human-confirm flag
  vendorOrders: VendorOrderTemplate[];        // static templates (always included)
  selectors?: DecompositionSelector[];        // parameterised composition (when→include)
  conditionalTemplates?: DecompositionConditionalTemplate[];  // canonical-fact-driven
  ...audit fields
}

interface VendorOrderTemplate {
  vendorWorkType: ProductType;
  vendorFee?: number;
  instructions?: string;
  dependsOn?: string[];
  templateKey?: string;
}
```

This DOES NOT fit the Prio rule envelope
`{name, pattern_id, salience, conditions, actions[]}`. The
`conditionalTemplates[].condition` block REUSES the `ReviewFlagCondition`
shape from review-program rules — so author tools that work for review
programs work here too — but the top-level shape is its own.

### Decision recording

**No explicit decision trace today.** `findRule` returns the rule;
`compose` returns the `VendorOrderSpec[]`. The resulting `VendorOrder`
docs implicitly record the decomposition outcome (the set of
`vendorWorkType` values that got placed). There is no
`decomposition-decisions` container.

For Decision Engine analytics, the read path would have to:
- Either: add a `decompositionRuleId` field on `VendorOrder` (additive,
  no migration; populated on new orders going forward) and aggregate by
  it.
- Or: infer rule-fired from the (clientId, productType, set-of-
  vendorWorkType) triple on each VendorOrder. Lossy but works on
  existing data.

## Phase N delivery plan

1. **N0 — Survey commit (this doc).** ✅
2. **N1 — Register `order-decomposition` as a live FE category.** ✅
   - `FrontendCategoryDefinition` entry; status: 'live'.
   - Custom editor (decomposition rules don't fit Prio's JSONLogic
     editor — needs its own card-per-rule form).
   - Read-only initial cut: lists existing rules by lookup precedence.
3. **N2 — BE category registration** with `validateRules` returning
   the basic DecompositionRule shape check. Storage CRUD still flows
   through `OrderDecompositionService` (not through the generic
   `DecisionRulePackService`).
4. **N3 — Workspace CRUD wiring.** New controller at
   `/api/decision-engine/order-decomposition/*` that proxies
   `OrderDecompositionService` create/update/list/delete. Audit rows
   land in `decision-rule-audit` for consistent audit-hub display.
5. **N4 — Analytics adapter.** Stamp `decompositionRuleId` on every
   new VendorOrder; analytics aggregator counts per (rule, day).
6. **N5 — Override surface.** Operators can edit a placed VendorOrder
   to add / remove additional templates retroactively via the
   `decision.overridden` flow.

## What lands today (rev 14)

- N0 — this survey doc.
- N1 + N2 — `order-decomposition` registered as a live category. FE
  workspace shows a read-only summary of the rule. BE category
  definition has `validateRules` (basic DecompositionRule shape) +
  `analytics` stubbed to "pending" so the tab doesn't 501.
- Doc rev 14 with sized N3/N4/N5 sequence.

N3/N4/N5 are separate PRs once the team agrees the editor shape
is right (the audit-hub + override surfaces work the same way as the
other 4 categories; only the editor + storage path differ).
