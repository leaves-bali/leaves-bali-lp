/**
 * Supabase のテーブル型。
 *
 * supabase/migrations/*.sql と手で同期させている。スキーマを変えたらここも変える。
 * Supabase CLI がある環境なら `supabase gen types typescript` で再生成してもよい。
 */

export type ReviewLanguage = 'ja' | 'en' | 'id' | 'zh' | 'ko' | 'other';
export type ReplyStatus = 'draft' | 'edited' | 'published' | 'failed' | 'skipped';
export type LanguageSource = 'script' | 'tinyld' | 'claude' | 'manual';

export type UserRow = {
  user_id: string;
  email: string;
  google_account_id: string;
  display_name: string | null;
  picture_url: string | null;
  google_refresh_token_encrypted: string | null;
  google_token_scope: string | null;
  token_revoked_at: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export type LocationRow = {
  location_id: string;
  user_id: string;
  google_account_name: string;
  google_location_id: string;
  name: string;
  address: string | null;
  setup_complete: boolean;
  last_synced_at: string | null;
  last_sync_error: string | null;
  consecutive_failures: number;
  created_at: string;
  updated_at: string;
}

export type ReviewRow = {
  review_id: string;
  location_id: string;
  google_review_id: string;
  reviewer_display_name: string | null;
  reviewer_photo_url: string | null;
  is_anonymous: boolean;
  rating: number;
  text: string | null;
  language: ReviewLanguage;
  language_confidence: number | null;
  language_source: LanguageSource;
  google_create_time: string | null;
  google_update_time: string | null;
  has_google_reply: boolean;
  google_reply_comment: string | null;
  google_reply_time: string | null;
  created_at: string;
  updated_at: string;
}

export type ReplyRow = {
  reply_id: string;
  review_id: string;
  ai_generated_text: string | null;
  edited_text: string | null;
  final_text: string | null;
  /** [{ style: 'warm'|'standard'|'concise', text: string }] の3案 */
  options: Array<{ style: string; text: string }>;
  selected_style: string | null;
  status: ReplyStatus;
  needs_human_attention: boolean;
  /** 言語非依存の理由コード。表示時に翻訳する。 */
  attention_codes: string[];
  /** AI が書いた理由の3言語版 { ja, en, id } */
  attention_reason_i18n: Record<string, string>;
  /** 旧列。コード化以前のデータのみ入っている */
  attention_reason: string | null;
  model: string | null;
  generation_meta: Record<string, unknown>;
  regenerated_count: number;
  published_at: string | null;
  published_by: string | null;
  published_by_staff_access_id: string | null;
  publish_error: string | null;
  created_at: string;
  updated_at: string;
}

export type StaffAccessRow = {
  staff_access_id: string;
  location_id: string;
  label: string;
  passcode_hash: string;
  is_active: boolean;
  last_used_at: string | null;
  rotated_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type StaffLoginAttemptRow = {
  attempt_id: string;
  location_id: string | null;
  ip_hash: string;
  succeeded: boolean;
  attempted_at: string;
};

export type AiUsageRow = {
  ai_usage_id: string;
  location_id: string | null;
  review_id: string | null;
  model: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  purpose: string;
  created_at: string;
};

export type SyncRunRow = {
  sync_run_id: string;
  location_id: string | null;
  trigger_source: string;
  started_at: string;
  finished_at: string | null;
  reviews_fetched: number;
  reviews_new: number;
  replies_generated: number;
  replies_published: number;
  error: string | null;
}

/** review_queue ビュー: reviews LEFT JOIN replies */
export type ReviewQueueRow = {
  review_id: string;
  location_id: string;
  google_review_id: string;
  reviewer_display_name: string | null;
  rating: number;
  text: string | null;
  language: ReviewLanguage;
  language_confidence: number | null;
  google_create_time: string | null;
  has_google_reply: boolean;
  reply_id: string | null;
  ai_generated_text: string | null;
  edited_text: string | null;
  final_text: string | null;
  /** [{ style: 'warm'|'standard'|'concise', text: string }] の3案 */
  options: Array<{ style: string; text: string }>;
  selected_style: string | null;
  status: ReplyStatus | null;
  needs_human_attention: boolean | null;
  attention_codes: string[] | null;
  attention_reason_i18n: Record<string, string> | null;
  attention_reason: string | null;
  published_at: string | null;
  publish_error: string | null;
  regenerated_count: number | null;
}

type Table<Row, Relationships extends readonly unknown[] = []> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: Relationships;
};

/**
 * 外部キー定義。supabase-js は埋め込み select（`reviews!inner (...)`）の型解決に
 * この情報を使うため、省略すると join の結果が SelectQueryError になる。
 */
type LocationsToUsers = {
  foreignKeyName: 'locations_user_id_fkey';
  columns: ['user_id'];
  isOneToOne: false;
  referencedRelation: 'users';
  referencedColumns: ['user_id'];
};

type ReviewsToLocations = {
  foreignKeyName: 'reviews_location_id_fkey';
  columns: ['location_id'];
  isOneToOne: false;
  referencedRelation: 'locations';
  referencedColumns: ['location_id'];
};

type RepliesToReviews = {
  // replies.review_id には UNIQUE 制約があるため 1 対 1
  foreignKeyName: 'replies_review_id_fkey';
  columns: ['review_id'];
  isOneToOne: true;
  referencedRelation: 'reviews';
  referencedColumns: ['review_id'];
};

type RepliesToUsers = {
  foreignKeyName: 'replies_published_by_fkey';
  columns: ['published_by'];
  isOneToOne: false;
  referencedRelation: 'users';
  referencedColumns: ['user_id'];
};

type StaffAccessToLocations = {
  foreignKeyName: 'staff_access_location_id_fkey';
  columns: ['location_id'];
  isOneToOne: false;
  referencedRelation: 'locations';
  referencedColumns: ['location_id'];
};

type StaffLoginAttemptsToLocations = {
  foreignKeyName: 'staff_login_attempts_location_id_fkey';
  columns: ['location_id'];
  isOneToOne: false;
  referencedRelation: 'locations';
  referencedColumns: ['location_id'];
};

type AiUsageToLocations = {
  foreignKeyName: 'ai_usage_location_id_fkey';
  columns: ['location_id'];
  isOneToOne: false;
  referencedRelation: 'locations';
  referencedColumns: ['location_id'];
};

type SyncRunsToLocations = {
  foreignKeyName: 'sync_runs_location_id_fkey';
  columns: ['location_id'];
  isOneToOne: false;
  referencedRelation: 'locations';
  referencedColumns: ['location_id'];
};

export interface Database {
  public: {
    Tables: {
      users: Table<UserRow>;
      locations: Table<LocationRow, [LocationsToUsers]>;
      reviews: Table<ReviewRow, [ReviewsToLocations]>;
      replies: Table<ReplyRow, [RepliesToReviews, RepliesToUsers]>;
      sync_runs: Table<SyncRunRow, [SyncRunsToLocations]>;
      staff_access: Table<StaffAccessRow, [StaffAccessToLocations]>;
      staff_login_attempts: Table<StaffLoginAttemptRow, [StaffLoginAttemptsToLocations]>;
      ai_usage: Table<AiUsageRow, [AiUsageToLocations]>;
    };
    Views: {
      review_queue: { Row: ReviewQueueRow; Relationships: [] };
      ai_usage_current_month: {
        Row: {
          location_id: string | null;
          generations: number;
          input_tokens: number;
          output_tokens: number;
          cost_usd: number;
        };
        Relationships: [];
      };
    };
    Functions: { [_ in never]: never };
    Enums: {
      review_language: ReviewLanguage;
      reply_status: ReplyStatus;
      language_source: LanguageSource;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
