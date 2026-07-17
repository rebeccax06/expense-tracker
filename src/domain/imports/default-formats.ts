import type {
  ImportStrategy,
  SignConvention,
  ImportFormatConfig,
} from "@/lib/supabase/database.types";
import { DEFAULT_AUTOPAY_PATTERNS } from "./rules";

export interface DefaultFormatMapping {
  source_column: string;
  target_field: string;
  position: number;
}

export interface DefaultFormat {
  name: string;
  institution: string;
  strategy: ImportStrategy;
  header_signature: string[];
  sign_convention: SignConvention;
  config: ImportFormatConfig;
  mappings: DefaultFormatMapping[];
}

/**
 * Seeded per-user on first use. These make the three known bank exports work
 * out of the box; the user can edit or archive them, and add new templates.
 */
export const DEFAULT_FORMATS: DefaultFormat[] = [
  {
    name: "Chase Debit / Checking",
    institution: "Chase",
    strategy: "chase_debit",
    header_signature: [
      "Details",
      "Posting Date",
      "Description",
      "Amount",
      "Type",
      "Balance",
    ],
    sign_convention: "negative_is_spending",
    config: {
      dateFormat: "MM/DD/YYYY",
      autopayPatterns: [...DEFAULT_AUTOPAY_PATTERNS],
    },
    mappings: [
      { source_column: "Posting Date", target_field: "transaction_date", position: 0 },
      { source_column: "Description", target_field: "description", position: 1 },
      { source_column: "Amount", target_field: "amount", position: 2 },
      { source_column: "Type", target_field: "bank_type", position: 3 },
    ],
  },
  {
    name: "Chase Credit Card",
    institution: "Chase",
    strategy: "chase_credit",
    header_signature: [
      "Transaction Date",
      "Post Date",
      "Description",
      "Category",
      "Type",
      "Amount",
    ],
    sign_convention: "negative_is_spending",
    config: {
      dateFormat: "MM/DD/YYYY",
      autopayPatterns: [...DEFAULT_AUTOPAY_PATTERNS],
      paymentTypes: ["Payment"],
      refundTypes: ["Return", "Refund", "Credit"],
    },
    mappings: [
      { source_column: "Transaction Date", target_field: "transaction_date", position: 0 },
      { source_column: "Post Date", target_field: "posting_date", position: 1 },
      { source_column: "Description", target_field: "description", position: 2 },
      { source_column: "Category", target_field: "bank_category", position: 3 },
      { source_column: "Type", target_field: "bank_type", position: 4 },
      { source_column: "Amount", target_field: "amount", position: 5 },
    ],
  },
  {
    name: "Robinhood Credit Card",
    institution: "Robinhood",
    strategy: "robinhood_credit",
    header_signature: [
      "Date",
      "Amount",
      "Points",
      "Status",
      "Type",
      "Merchant",
      "Description",
    ],
    sign_convention: "positive_is_spending",
    config: {
      dateFormat: "YYYY-MM-DD",
      autopayPatterns: [...DEFAULT_AUTOPAY_PATTERNS],
      paymentTypes: ["Payment"],
      refundTypes: ["Return", "Refund", "Credit"],
    },
    mappings: [
      { source_column: "Date", target_field: "transaction_date", position: 0 },
      { source_column: "Merchant", target_field: "merchant", position: 1 },
      { source_column: "Description", target_field: "description", position: 2 },
      { source_column: "Amount", target_field: "amount", position: 3 },
      { source_column: "Type", target_field: "bank_type", position: 4 },
    ],
  },
];
