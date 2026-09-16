import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env } from '@/lib/env';
import type { Database } from '@/lib/database.types';

/**
 * service_role キーを使う管理クライアント。
 *
 * **サーバー側専用**。'server-only' を import しているので、
 * 誤ってクライアントコンポーネントから import するとビルドが失敗する。
 */
import 'server-only';

let cached: SupabaseClient<Database> | null = null;

export function supabaseAdmin(): SupabaseClient<Database> {
  if (cached) return cached;
  cached = createClient<Database>(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
