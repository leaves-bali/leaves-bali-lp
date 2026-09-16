import { NextResponse, type NextRequest } from 'next/server';

import { errorResponse, requireSession } from '@/lib/api';
import { publishReply } from '@/lib/reviews/publish';

export const runtime = 'nodejs';

/** ワンクリック公開。 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ replyId: string }> },
) {
  try {
    const session = await requireSession();
    const { replyId } = await params;
    const result = await publishReply(replyId, session.userId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return errorResponse(err);
  }
}
