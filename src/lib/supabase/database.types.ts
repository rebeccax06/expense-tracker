// Hand-authored to mirror supabase/migrations. Replace with
// `supabase gen types typescript` output once the project is linked.

export type AccountType =
  | "checking"
  | "debit_card"
  | "credit_card"
  | "savings"
  | "cash"
  | "other";

export type NormalizedTxnType =
  | "expense"
  | "refund"
  | "transfer"
  | "income"
  | "adjustment";

export type ImportStrategy =
  | "chase_debit"
  | "chase_credit"
  | "robinhood_credit"
  | "generic";

export type SignConvention = "negative_is_spending" | "positive_is_spending";
export type ParseStatusEnum = "parsed" | "error";
export type BatchStatus = "pending" | "committed" | "failed";
export type ReimbursementBehavior = "income" | "refund" | "review";
export type ThemePref = "system" | "light" | "dark";

type Timestamps = { created_at: string };
type WithUpdated = { updated_at: string };

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          reimbursement_behavior: ReimbursementBehavior;
          theme: ThemePref;
        } & Timestamps &
          WithUpdated;
        Insert: {
          id: string;
          reimbursement_behavior?: ReimbursementBehavior;
          theme?: ThemePref;
        };
        Update: Partial<{
          reimbursement_behavior: ReimbursementBehavior;
          theme: ThemePref;
        }>;
        Relationships: [];
      };
      accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          institution: string | null;
          account_type: AccountType;
          last_four: string | null;
          currency: string;
          import_format_id: string | null;
          purchase_sign: SignConvention;
          is_active: boolean;
        } & Timestamps &
          WithUpdated;
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          institution?: string | null;
          account_type?: AccountType;
          last_four?: string | null;
          currency?: string;
          import_format_id?: string | null;
          purchase_sign?: SignConvention;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["accounts"]["Insert"]>;
        Relationships: [];
      };
      import_formats: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          institution: string | null;
          strategy: ImportStrategy;
          header_signature: string[];
          sign_convention: SignConvention;
          config: ImportFormatConfig;
          is_archived: boolean;
        } & Timestamps &
          WithUpdated;
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          institution?: string | null;
          strategy?: ImportStrategy;
          header_signature?: string[];
          sign_convention?: SignConvention;
          config?: ImportFormatConfig;
          is_archived?: boolean;
        };
        Update: Partial<
          Database["public"]["Tables"]["import_formats"]["Insert"]
        >;
        Relationships: [];
      };
      import_format_mappings: {
        Row: {
          id: string;
          user_id: string;
          format_id: string;
          source_column: string;
          target_field: string;
          transform: string | null;
          position: number;
        } & Timestamps;
        Insert: {
          id?: string;
          user_id: string;
          format_id: string;
          source_column: string;
          target_field: string;
          transform?: string | null;
          position?: number;
        };
        Update: Partial<
          Database["public"]["Tables"]["import_format_mappings"]["Insert"]
        >;
        Relationships: [];
      };
      import_batches: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          format_id: string | null;
          filename: string;
          file_hash: string | null;
          storage_path: string | null;
          status: BatchStatus;
          total_rows: number;
          imported_rows: number;
          skipped_rows: number;
        } & Timestamps;
        Insert: {
          id?: string;
          user_id: string;
          account_id: string;
          format_id?: string | null;
          filename: string;
          file_hash?: string | null;
          storage_path?: string | null;
          status?: BatchStatus;
          total_rows?: number;
          imported_rows?: number;
          skipped_rows?: number;
        };
        Update: Partial<
          Database["public"]["Tables"]["import_batches"]["Insert"]
        >;
        Relationships: [];
      };
      raw_imports: {
        Row: {
          id: string;
          user_id: string;
          batch_id: string;
          row_number: number;
          raw: Record<string, string>;
          parse_status: ParseStatusEnum;
          parse_error: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          user_id: string;
          batch_id: string;
          row_number: number;
          raw: Record<string, string>;
          parse_status?: ParseStatusEnum;
          parse_error?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["raw_imports"]["Insert"]>;
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          raw_import_id: string | null;
          batch_id: string | null;
          fingerprint: string;
          transaction_date: string;
          posting_date: string | null;
          raw_description: string;
          merchant: string | null;
          raw_amount: number;
          normalized_spending_amount: number;
          bank_category: string | null;
          bank_type: string | null;
          normalized_type: NormalizedTxnType;
          include_in_spending: boolean;
        } & Timestamps &
          WithUpdated;
        Insert: {
          id?: string;
          user_id: string;
          account_id: string;
          raw_import_id?: string | null;
          batch_id?: string | null;
          fingerprint: string;
          transaction_date: string;
          posting_date?: string | null;
          raw_description: string;
          merchant?: string | null;
          raw_amount: number;
          normalized_spending_amount: number;
          bank_category?: string | null;
          bank_type?: string | null;
          normalized_type?: NormalizedTxnType;
          include_in_spending?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["transactions"]["Insert"]>;
        Relationships: [];
      };
      transaction_overrides: {
        Row: {
          id: string;
          user_id: string;
          fingerprint: string;
          user_category_id: string | null;
          trip_id: string | null;
          location: string | null;
          notes: string | null;
          include_override: boolean | null;
          type_override: NormalizedTxnType | null;
        } & Timestamps &
          WithUpdated;
        Insert: {
          id?: string;
          user_id: string;
          fingerprint: string;
          user_category_id?: string | null;
          trip_id?: string | null;
          location?: string | null;
          notes?: string | null;
          include_override?: boolean | null;
          type_override?: NormalizedTxnType | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["transaction_overrides"]["Insert"]
        >;
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string | null;
          is_archived: boolean;
        } & Timestamps;
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color?: string | null;
          is_archived?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
        Relationships: [];
      };
      trips: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          destination: string | null;
          start_date: string | null;
          end_date: string | null;
          notes: string | null;
          is_archived: boolean;
        } & Timestamps;
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          destination?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          notes?: string | null;
          is_archived?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["trips"]["Insert"]>;
        Relationships: [];
      };
      budgets: {
        Row: {
          id: string;
          user_id: string;
          category_id: string;
          month: string;
          amount: number;
        } & Timestamps &
          WithUpdated;
        Insert: {
          id?: string;
          user_id: string;
          category_id: string;
          month: string;
          amount: number;
        };
        Update: Partial<Database["public"]["Tables"]["budgets"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      transactions_view: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          fingerprint: string;
          raw_import_id: string | null;
          batch_id: string | null;
          transaction_date: string;
          posting_date: string | null;
          raw_description: string;
          merchant: string | null;
          raw_amount: number;
          normalized_spending_amount: number;
          bank_category: string | null;
          bank_type: string | null;
          normalized_type: NormalizedTxnType;
          include_in_spending: boolean;
          created_at: string;
          updated_at: string;
          account_name: string;
          account_type: AccountType;
          user_category_id: string | null;
          trip_id: string | null;
          location: string | null;
          notes: string | null;
          type_override: NormalizedTxnType | null;
          include_override: boolean | null;
          category_name: string | null;
          category_color: string | null;
          trip_name: string | null;
          resolved_type: NormalizedTxnType;
          resolved_include: boolean;
          effective_spending: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      commit_import: {
        Args: {
          p_account_id: string;
          p_format_id: string | null;
          p_filename: string;
          p_file_hash: string | null;
          p_storage_path: string | null;
          p_rows: unknown;
          p_skip_duplicates?: boolean;
        };
        Returns: {
          batch_id: string;
          imported: number;
          skipped: number;
          total: number;
        };
      };
    };
    Enums: {
      account_type: AccountType;
      normalized_txn_type: NormalizedTxnType;
      import_strategy: ImportStrategy;
      sign_convention: SignConvention;
      parse_status: ParseStatusEnum;
      batch_status: BatchStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}

// Structured shape of import_formats.config
export interface ImportFormatConfig {
  /** Description patterns that flag a row as a suspected transfer/autopay.
   *  These require explicit user review before being excluded. */
  autopayPatterns?: string[];
  /** Date parsing hint, e.g. "MM/DD/YYYY" or "YYYY-MM-DD". */
  dateFormat?: string;
  /** For credit-card style formats: which raw "type" values map to refunds. */
  refundTypes?: string[];
  /** Raw "type" values that indicate a card payment / transfer. */
  paymentTypes?: string[];
  /** Whether a positive amount on this format means incoming money (income). */
  positiveIsIncome?: boolean;
}
