import { z } from "zod";

const ACCOUNT_TYPES = [
  "checking",
  "debit_card",
  "credit_card",
  "savings",
  "cash",
  "other",
] as const;

const SIGN_CONVENTIONS = ["negative_is_spending", "positive_is_spending"] as const;
const STRATEGIES = ["chase_debit", "chase_credit", "robinhood_credit", "generic"] as const;
const TXN_TYPES = ["expense", "refund", "transfer", "income", "adjustment"] as const;

// ---- Auth ----
export const credentialsSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const emailSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

// ---- Accounts ----
export const accountSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  institution: z.string().trim().max(80).optional().or(z.literal("")),
  account_type: z.enum(ACCOUNT_TYPES),
  last_four: z
    .string()
    .regex(/^[0-9]{3,4}$/, "3–4 digits")
    .optional()
    .or(z.literal("")),
  currency: z.string().trim().length(3).default("USD"),
  import_format_id: z.string().uuid().nullable().optional(),
  purchase_sign: z.enum(SIGN_CONVENTIONS),
  is_active: z.boolean().default(true),
});

// ---- Categories ----
export const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color")
    .nullable()
    .optional(),
});

// ---- Trips ----
export const tripSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  destination: z.string().trim().max(120).optional().or(z.literal("")),
  start_date: z.string().date().nullable().optional().or(z.literal("")),
  end_date: z.string().date().nullable().optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

// ---- Budgets ----
export const budgetSchema = z.object({
  category_id: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}-01$/, "Expected YYYY-MM-01"),
  amount: z.number().nonnegative(),
});

// ---- Import formats ----
export const formatMappingSchema = z.object({
  source_column: z.string().min(1),
  target_field: z.enum([
    "transaction_date",
    "posting_date",
    "description",
    "merchant",
    "amount",
    "bank_category",
    "bank_type",
    "ignore",
  ]),
  position: z.number().int().nonnegative().default(0),
});

export const importFormatSchema = z.object({
  name: z.string().trim().min(1).max(80),
  institution: z.string().trim().max(80).optional().or(z.literal("")),
  strategy: z.enum(STRATEGIES).default("generic"),
  header_signature: z.array(z.string()).default([]),
  sign_convention: z.enum(SIGN_CONVENTIONS),
  config: z
    .object({
      autopayPatterns: z.array(z.string()).optional(),
      dateFormat: z.string().optional(),
      refundTypes: z.array(z.string()).optional(),
      paymentTypes: z.array(z.string()).optional(),
      positiveIsIncome: z.boolean().optional(),
    })
    .default({}),
  mappings: z.array(formatMappingSchema).default([]),
});

// ---- Transaction overrides / bulk edit ----
export const overrideSchema = z.object({
  fingerprints: z.array(z.string().min(1)).min(1),
  user_category_id: z.string().uuid().nullable().optional(),
  trip_id: z.string().uuid().nullable().optional(),
  location: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  include_override: z.boolean().nullable().optional(),
  type_override: z.enum(TXN_TYPES).nullable().optional(),
});

// ---- Import commit ----
export const importCommitRowSchema = z.object({
  rowNumber: z.number().int(),
  raw: z.record(z.string(), z.string()),
  fingerprint: z.string().min(1),
  transaction_date: z.string().date(),
  posting_date: z.string().date().nullable(),
  raw_description: z.string(),
  merchant: z.string().nullable(),
  raw_amount: z.number(),
  normalized_spending_amount: z.number(),
  bank_category: z.string().nullable(),
  bank_type: z.string().nullable(),
  normalized_type: z.enum(TXN_TYPES),
  include_in_spending: z.boolean(),
});

export const importCommitSchema = z.object({
  account_id: z.string().uuid(),
  format_id: z.string().uuid().nullable(),
  filename: z.string().min(1).max(255),
  file_hash: z.string().nullable(),
  storage_path: z.string().nullable(),
  rows: z.array(importCommitRowSchema).min(1),
  skipDuplicates: z.boolean().default(true),
});

export type AccountInput = z.infer<typeof accountSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type TripInput = z.infer<typeof tripSchema>;
export type BudgetInput = z.infer<typeof budgetSchema>;
export type ImportFormatInput = z.infer<typeof importFormatSchema>;
export type OverrideInput = z.infer<typeof overrideSchema>;
export type ImportCommitInput = z.infer<typeof importCommitSchema>;
