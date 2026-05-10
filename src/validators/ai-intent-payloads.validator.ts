import { z } from 'zod';
import type { AiExecutableIntent } from '../types/ai-parser.types.js';
import {
  ContactMethod,
  ContactRole,
  ConstructionType,
  LoanPurpose,
  LoanType,
  OccupancyType,
  Priority,
  PropertyCondition,
  ViewType,
} from '../types/index.js';
import { OrderPriority } from '../types/order-management.js';

const nonEmptyString = z.string().trim().min(1);
const isoDateString = z.string().datetime({ offset: true });

const propertyAddressSchema = z
  .object({
    streetAddress: nonEmptyString.optional(),
    street: nonEmptyString.optional(),
    city: nonEmptyString,
    state: z.string().trim().length(2),
    zipCode: nonEmptyString.optional(),
    zip: nonEmptyString.optional(),
    county: nonEmptyString.optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.streetAddress && !value.street) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['streetAddress'],
        message: 'propertyAddress.streetAddress or propertyAddress.street is required.',
      });
    }
    if (!value.zipCode && !value.zip) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['zipCode'],
        message: 'propertyAddress.zipCode or propertyAddress.zip is required.',
      });
    }
  });

const propertyDetailsSchema = z.object({
  propertyType: nonEmptyString,
  occupancy: z.nativeEnum(OccupancyType),
  features: z.array(nonEmptyString),
  yearBuilt: z.number().int().positive().optional(),
  grossLivingArea: z.number().positive().optional(),
  lotSize: z.number().positive().optional(),
  bedrooms: z.number().nonnegative().optional(),
  bathrooms: z.number().nonnegative().optional(),
  stories: z.number().positive().optional(),
  garage: z.boolean().optional(),
  pool: z.boolean().optional(),
  condition: z.nativeEnum(PropertyCondition).optional(),
  viewType: z.nativeEnum(ViewType).optional(),
  constructionType: z.nativeEnum(ConstructionType).optional(),
});

const contactInfoSchema = z.object({
  name: nonEmptyString,
  role: z.nativeEnum(ContactRole),
  email: z.string().email().optional(),
  phone: nonEmptyString.optional(),
  preferredMethod: z.nativeEnum(ContactMethod),
  availabilityNotes: nonEmptyString.optional(),
});

const borrowerInformationSchema = z.object({
  firstName: nonEmptyString,
  lastName: nonEmptyString,
  email: z.string().email().optional(),
  phone: nonEmptyString.optional(),
  alternateContact: contactInfoSchema.optional(),
});

const loanInformationSchema = z.object({
  loanAmount: z.number().positive(),
  loanType: z.nativeEnum(LoanType),
  loanPurpose: z.nativeEnum(LoanPurpose),
  contractPrice: z.number().positive().optional(),
  downPayment: z.number().nonnegative().optional(),
  ltv: z.number().nonnegative().optional(),
  dti: z.number().nonnegative().optional(),
  creditScore: z.number().int().nonnegative().optional(),
});

const createOrderPayloadSchema = z
  .object({
    // Engagement-primacy linkage — REQUIRED.  Phase B of the order-domain
    // redesign forbids creating a VendorOrder that is not attached to an
    // existing Engagement → EngagementProperty → EngagementClientOrder.
    // The AI runtime must resolve all three IDs (via CREATE_ENGAGEMENT or
    // a TOOL_CALL search) before emitting this intent.  See
    // ai-action-dispatcher.service.ts:handleCreateOrder for the matching
    // backend contract; payloads missing any of these fields are rejected
    // up-front so the model gets a structured 400 with the missing path.
    engagementId: nonEmptyString,
    engagementPropertyId: nonEmptyString,
    clientOrderId: nonEmptyString,
    clientId: nonEmptyString,
    orderNumber: nonEmptyString,
    propertyAddress: propertyAddressSchema,
    propertyDetails: propertyDetailsSchema,
    orderType: nonEmptyString,
    productType: nonEmptyString,
    dueDate: isoDateString,
    rushOrder: z.boolean(),
    borrowerInformation: borrowerInformationSchema,
    loanInformation: loanInformationSchema,
    contactInformation: contactInfoSchema,
    priority: z.nativeEnum(Priority),
    specialInstructions: nonEmptyString.optional(),
    tags: z.array(nonEmptyString),
    metadata: z.record(z.string(), z.unknown()),
  });

const engagementPropertySchema = z.object({
  address: nonEmptyString,
  city: nonEmptyString,
  state: z.string().trim().length(2),
  zipCode: nonEmptyString,
  county: nonEmptyString,
  coordinates: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  propertyType: z.enum(['SINGLE_FAMILY', 'CONDO', 'TOWNHOME', 'MULTI_FAMILY', 'COMMERCIAL', 'LAND']),
  yearBuilt: z.number().int().positive().optional(),
  squareFootage: z.number().positive().optional(),
  estimatedValue: z.number().positive().optional(),
  lotSize: z.number().positive().optional(),
  bedrooms: z.number().nonnegative().optional(),
  bathrooms: z.number().nonnegative().optional(),
  stories: z.number().positive().optional(),
  hasBasement: z.boolean().optional(),
  hasGarage: z.boolean().optional(),
  accessConcerns: nonEmptyString.optional(),
  specialInstructions: nonEmptyString.optional(),
});

const engagementProductSchema = z.object({
  productType: nonEmptyString,
  instructions: nonEmptyString.optional(),
  fee: z.number().positive().optional(),
  dueDate: isoDateString.optional(),
});

const createEngagementPayloadSchema = z.object({
  client: z.object({
    clientId: nonEmptyString,
    subClientId: nonEmptyString.optional(),
    clientName: nonEmptyString,
    loanOfficer: nonEmptyString.optional(),
    loanOfficerEmail: z.string().email().optional(),
    loanOfficerPhone: nonEmptyString.optional(),
  }),
  loans: z.array(z.object({
    loanNumber: nonEmptyString,
    borrowerName: nonEmptyString,
    borrowerEmail: z.string().email().optional(),
    loanOfficer: nonEmptyString.optional(),
    loanOfficerEmail: z.string().email().optional(),
    loanOfficerPhone: nonEmptyString.optional(),
    loanType: nonEmptyString.optional(),
    fhaCase: nonEmptyString.optional(),
    property: engagementPropertySchema,
    products: z.array(engagementProductSchema).min(1),
  })).min(1),
  priority: z.nativeEnum(OrderPriority).optional(),
  clientDueDate: isoDateString.optional(),
  internalDueDate: isoDateString.optional(),
  totalEngagementFee: z.number().positive().optional(),
  accessInstructions: nonEmptyString.optional(),
  specialInstructions: nonEmptyString.optional(),
  engagementInstructions: nonEmptyString.optional(),
});

const triggerAutoAssignmentPayloadSchema = z.object({
  orderIds: z.array(nonEmptyString).min(1),
});

const assignVendorPayloadSchema = z
  .object({
    orderId: nonEmptyString.optional(),
    orderIds: z.array(nonEmptyString).min(1).optional(),
    vendorId: nonEmptyString.optional(),
    appraiserId: nonEmptyString.optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.orderId && !value.orderIds?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['orderIds'],
        message: 'ASSIGN_VENDOR requires orderId or orderIds.',
      });
    }
    if (!value.vendorId && !value.appraiserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['vendorId'],
        message: 'ASSIGN_VENDOR requires vendorId or appraiserId.',
      });
    }
  });

const executableIntentPayloadSchemas = {
  CREATE_ORDER: createOrderPayloadSchema,
  CREATE_ENGAGEMENT: createEngagementPayloadSchema,
  ASSIGN_VENDOR: assignVendorPayloadSchema,
  TRIGGER_AUTO_ASSIGNMENT: triggerAutoAssignmentPayloadSchema,
} satisfies Record<AiExecutableIntent, z.ZodTypeAny>;

export type CreateOrderPayload = z.infer<typeof createOrderPayloadSchema>;
export type CreateEngagementPayload = z.infer<typeof createEngagementPayloadSchema>;
export type AssignVendorPayload = z.infer<typeof assignVendorPayloadSchema>;
export type TriggerAutoAssignmentPayload = z.infer<typeof triggerAutoAssignmentPayloadSchema>;

export function validateAiIntentPayload<TIntent extends AiExecutableIntent>(
  intent: TIntent,
  payload: unknown,
): z.infer<(typeof executableIntentPayloadSchemas)[TIntent]> {
  return executableIntentPayloadSchemas[intent].parse(payload) as z.infer<(typeof executableIntentPayloadSchemas)[TIntent]>;
}

export function safeValidateAiIntentPayload<TIntent extends AiExecutableIntent>(
  intent: TIntent,
  payload: unknown,
) {
  return executableIntentPayloadSchemas[intent].safeParse(payload);
}