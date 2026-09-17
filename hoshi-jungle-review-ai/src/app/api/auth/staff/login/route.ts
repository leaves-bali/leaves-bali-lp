import { NextResponse, type NextRequest } from 'next/server';

import { clientIp, errorResponse } from '@/lib/api';
import { hashIp, loginWithPasscode } from '@/lib/auth/staffLogin';
import { env } from '@/lib/env';
import { t } from '@/lib/i18n';
import { createStaffSession } from '@/lib/session';
import { getUiLang, UI_LANG_COOKIE } from '@/lib/uiLang';

export const runtime = 'nodejs';

/** スタッフのパスコードログイン。 */
export async function POST(request: NextRequest) {
  try {
    // 画面の言語に合わせてエラーを返す（読めないエラーは何の助けにもならない）
    const d = t(await getUiLang());

    const body = (await request.json().catch(() => ({}))) as { passcode?: string };
    if (!body.passcode) {
      return NextResponse.json({ error: d.passcode }, { status: 400 });
    }

    // IP は生のまま保存しない。SESSION_SECRET をソルトにしてハッシュ化する。
    const ipHash = hashIp(clientIp(request), env.sessionSecret);
    const outcome = await loginWithPasscode(body.passcode, ipHash);

    if (!outcome.ok) {
      const message =
        outcome.reason === 'rate_limited'
          ? d.errTooManyAttempts(outcome.waitMinutes ?? 15)
          : outcome.reason === 'empty'
            ? d.passcode
            : d.errPasscodeWrong;
      return NextResponse.json({ error: message }, { status: outcome.status });
    }

    await createStaffSession({
      userId: outcome.userId,
      locationId: outcome.locationId,
      staffAccessId: outcome.staffAccessId,
      staffLabel: outcome.staffLabel,
      uiLang: outcome.uiLang,
    });

    const response = NextResponse.json({
      ok: true,
      label: outcome.staffLabel,
      uiLang: outcome.uiLang,
    });

    // 共有端末対策。
    // パスコード自身に言語が設定されている場合だけ、ログイン画面に残っていた
    // 選択を捨てる（前に座っていた人の残りである可能性があるため）。
    // 設定が無い場合は捨てない。いま入った人がログイン画面でわざわざ切り替えた
    // 言語を消してしまうと、読めない画面に放り込むことになる。
    if (outcome.uiLangFromPasscode) {
      response.cookies.delete(UI_LANG_COOKIE);
    }
    return response;
  } catch (err) {
    return await errorResponse(err);
  }
}
