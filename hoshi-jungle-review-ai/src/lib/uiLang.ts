import 'server-only';

import { cookies, headers } from 'next/headers';

import { isUiLang, resolveUiLang, type UiLang } from '@/lib/i18n';
import { getSession } from '@/lib/session';

/**
 * 画面の表示言語を決める。
 *
 * 【共有端末という前提】
 * Hoshi Jungle ではフロントの共用 PC を日本人・インドネシア人・アメリカ人の
 * スタッフが回し使いする。「選んだ言語をずっと覚えている」のは個人の端末では
 * 正しい挙動だが、共有端末では **前の人の言語で固まる** という事故になる。
 *
 * そこで優先順位を 2 層に分ける。
 *
 *   1. いま座っている人の一時的な選択（Cookie / 30 分のスライド式）
 *        → 操作が続く限り延長され、離席すると失効する
 *   2. この入室に紐づく既定言語（セッション JWT）
 *        → パスコードごとの設定、無ければホテルの既定言語
 *   3. ブラウザの Accept-Language（未ログインの初回アクセス用）
 *   4. 日本語
 *
 * 1 が失効すると自動的に 2 へ戻る。つまり「その場の切り替えは残らない、
 * 既定値は残る」。次に座った人が読めない画面を見ることがなくなる。
 *
 * Cookie にしている理由: サーバーコンポーネントで描画時に確定させたいため。
 * localStorage だと最初に日本語で描画してから書き換わり、ちらつく。
 */

export const UI_LANG_COOKIE = 'hj_ui_lang';

/**
 * 手動で選んだ言語を保持する時間（秒）。
 *
 * 操作のたびに延長される（UiLangKeepAlive）ので、作業中に切り替わることはない。
 * 離席してこの時間が過ぎると失効し、ホテルの既定言語に戻る。
 * 短すぎると作業中に戻ってしまい、長すぎると共有端末が固まる。フロント業務の
 * 一区切り（チェックイン対応 1 件）を想定して 30 分とした。
 */
export const UI_LANG_OVERRIDE_MAX_AGE_SECONDS = 30 * 60;

export async function getUiLang(): Promise<UiLang> {
  const store = await cookies();
  const override = store.get(UI_LANG_COOKIE)?.value;

  // Cookie で決まるなら、セッションも Accept-Language も読む必要がない
  if (isUiLang(override)) return override;

  const [session, h] = await Promise.all([getSession(), headers()]);
  return resolveUiLang({
    sessionLang: session?.uiLang,
    acceptLanguage: h.get('accept-language'),
  });
}

/**
 * 一時的な選択を除いた「この端末が待機状態のときに戻る言語」。
 *
 * 画面側で「30 分操作がないと ◯◯ に戻ります」と予告するために使う。
 * 何に戻るか分からないまま勝手に切り替わるのが、共有端末で一番嫌われる。
 */
export async function getFallbackUiLang(): Promise<UiLang> {
  const [session, h] = await Promise.all([getSession(), headers()]);
  return resolveUiLang({
    sessionLang: session?.uiLang,
    acceptLanguage: h.get('accept-language'),
  });
}

/**
 * 一時的な言語選択を捨てる。ログアウト時に呼ぶ。
 *
 * 共有端末では、席を立つ人の言語を次の人に引き継がせてはいけない。
 */
export async function clearUiLangOverride(): Promise<void> {
  const store = await cookies();
  store.delete(UI_LANG_COOKIE);
}
