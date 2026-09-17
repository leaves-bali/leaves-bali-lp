import { NextResponse, type NextRequest } from 'next/server';

import { clientIp, errorResponse } from '@/lib/api';
import { hashIp, loginWithPasscode } from '@/lib/auth/staffLogin';
import { env } from '@/lib/env';
import { createStaffSession } from '@/lib/session';

export const runtime = 'nodejs';

/** スタッフのパスコードログイン。 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { passcode?: string };
    if (!body.passcode) {
      return NextResponse.json({ error: 'パスコードを入力してください。' }, { status: 400 });
    }

    // IP は生のまま保存しない。SESSION_SECRET をソルトにしてハッシュ化する。
    const ipHash = hashIp(clientIp(request), env.sessionSecret);
    const outcome = await loginWithPasscode(body.passcode, ipHash);

    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.message }, { status: outcome.status });
    }

    await createStaffSession({
      userId: outcome.userId,
      locationId: outcome.locationId,
      staffAccessId: outcome.staffAccessId,
      staffLabel: outcome.staffLabel,
    });

    return NextResponse.json({ ok: true, label: outcome.staffLabel });
  } catch (err) {
    return errorResponse(err);
  }
}
