import 'server-only';

import { cookies, headers } from 'next/headers';

import { DEFAULT_UI_LANG, isUiLang, pickFromAcceptLanguage, type UiLang } from '@/lib/i18n';

/**
 * 画面の表示言語を決める。
 *
 *   1. 本人が選んだ言語（Cookie）
 *   2. ブラウザの Accept-Language
 *   3. 既定（日本語）
 *
 * Cookie にしている理由: サーバーコンポーネントで描画時に確定させたいため。
 * localStorage だと最初に日本語で描画してから書き換わり、ちらつく。
 */

export const UI_LANG_COOKIE = 'hj_ui_lang';

export async function getUiLang(): Promise<UiLang> {
  const store = await cookies();
  const chosen = store.get(UI_LANG_COOKIE)?.value;
  if (isUiLang(chosen)) return chosen;

  const h = await headers();
  return pickFromAcceptLanguage(h.get('accept-language')) ?? DEFAULT_UI_LANG;
}
