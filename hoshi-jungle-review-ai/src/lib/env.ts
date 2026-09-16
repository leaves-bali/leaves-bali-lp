/**
 * 環境変数の一元管理。
 *
 * 方針: 起動時に全部を検証して落とすのではなく、実際に使うタイミングで
 * 必要なキーだけを要求する（例: Cron だけ動かしたいときに SESSION_SECRET が
 * 未設定でもビルドが通るようにするため）。
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `環境変数 ${name} が未設定です。.env.example を参照して設定してください。`,
    );
  }
  return value;
}

function optional(name: string, fallback = ''): string {
  return process.env[name]?.trim() || fallback;
}

function bool(name: string, fallback = false): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === '') return fallback;
  return raw === 'true' || raw === '1' || raw === 'yes';
}

function int(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  get appUrl(): string {
    // Vercel のプレビュー環境では NEXT_PUBLIC_APP_URL が本番 URL のままになりがちなので、
    // VERCEL_URL があればそちらを優先する。
    const configured = optional('NEXT_PUBLIC_APP_URL');
    if (configured) return configured.replace(/\/$/, '');
    const vercel = optional('VERCEL_URL');
    if (vercel) return `https://${vercel}`;
    return 'http://localhost:3000';
  },

  // --- Supabase ---
  get supabaseUrl(): string {
    return required('SUPABASE_URL');
  },
  get supabaseServiceRoleKey(): string {
    return required('SUPABASE_SERVICE_ROLE_KEY');
  },

  // --- Google OAuth ---
  get googleClientId(): string {
    return required('GOOGLE_CLIENT_ID');
  },
  get googleClientSecret(): string {
    return required('GOOGLE_CLIENT_SECRET');
  },
  get googleRedirectUri(): string {
    return (
      optional('GOOGLE_REDIRECT_URI') || `${env.appUrl}/api/auth/google/callback`
    );
  },

  // --- Anthropic ---
  get anthropicApiKey(): string {
    return required('ANTHROPIC_API_KEY');
  },
  get anthropicModel(): string {
    return optional('ANTHROPIC_MODEL', 'claude-opus-5');
  },
  get anthropicEffort(): 'low' | 'medium' | 'high' | 'xhigh' | 'max' {
    const raw = optional('ANTHROPIC_EFFORT', 'low');
    const allowed = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
    return (allowed as readonly string[]).includes(raw)
      ? (raw as (typeof allowed)[number])
      : 'low';
  },

  // --- 秘密鍵 ---
  get tokenEncryptionKey(): string {
    return required('TOKEN_ENCRYPTION_KEY');
  },
  get sessionSecret(): string {
    return required('SESSION_SECRET');
  },
  get cronSecret(): string {
    return required('CRON_SECRET');
  },

  // --- 運用ポリシー ---
  get autoPublishEnabled(): boolean {
    return bool('AUTO_PUBLISH_ENABLED', false);
  },
  get autoPublishLanguages(): string[] {
    return optional('AUTO_PUBLISH_LANGUAGES')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      // インドネシア語の完全自動公開は仕様上禁止。env が誤設定でも通さない。
      .filter((l) => l !== 'id');
  },
  get autoPublishMinRating(): number {
    return int('AUTO_PUBLISH_MIN_RATING', 4);
  },
  get maxGenerationsPerRun(): number {
    return int('MAX_GENERATIONS_PER_RUN', 25);
  },

  // --- ホテル情報 ---
  get hotelName(): string {
    return optional('HOTEL_NAME', 'Hoshi Jungle');
  },
  get hotelLocation(): string {
    return optional('HOTEL_LOCATION', 'Ubud, Bali, Indonesia');
  },
  get hotelSignature(): string {
    return optional('HOTEL_SIGNATURE', 'Hoshi Jungle Team');
  },
  get hotelContactEmail(): string {
    return optional('HOTEL_CONTACT_EMAIL');
  },
};
