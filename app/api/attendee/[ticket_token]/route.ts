import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';

import { createServerClient } from '@/lib/supabaseServer';
import { checkRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

type AttendeeResponse =
  | {
      ok: true;
      attendee: {
        id: string;
        full_name: string | null;
        phone: string | null;
        organization: string | null;
        job_position: string | null;
        province: string | null;
        region: number | null;
        checked_in_at: string | null;
      };
    }
  | {
      ok: false;
      message: string;
    };

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for') || '';
  const first = forwarded.split(',')[0]?.trim();
  if (first) return first;
  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  const cfIp = req.headers.get('cf-connecting-ip')?.trim();
  if (cfIp) return cfIp;
  return 'unknown';
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function GET(
  req: NextRequest,
  context: { params: { ticket_token?: string } },
) {
  const token = context.params.ticket_token?.trim() ?? '';
  if (!token) {
    return NextResponse.json<AttendeeResponse>(
      { ok: false, message: 'MISSING_TICKET_TOKEN' },
      { status: 400 },
    );
  }

  const ip = getClientIp(req);
  const tokenHash = hashToken(token);

  const [ipLimit, tokenLimit] = await Promise.all([
    checkRateLimit({ key: `attendee:ip:${ip}`, limit: 60, windowSec: 300 }),
    checkRateLimit({ key: `attendee:token:${tokenHash}`, limit: 20, windowSec: 300 }),
  ]);

  if (!ipLimit.allowed || !tokenLimit.allowed) {
    const resetAt = Math.max(ipLimit.resetAt, tokenLimit.resetAt);
    const retryAfterSec = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
    console.warn('attendee api rate limit blocked', {
      ip,
      tokenHash,
      ipRemaining: ipLimit.remaining,
      tokenRemaining: tokenLimit.remaining,
    });
    return NextResponse.json<AttendeeResponse>(
      { ok: false, message: 'คำขอมากเกินไป กรุณาลองใหม่อีกครั้งในภายหลัง' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
    );
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('attendees')
    .select(
      `
      id,
      full_name,
      phone,
      organization,
      job_position,
      province,
      region,
      checked_in_at
    `,
    )
    .eq('ticket_token', token)
    .maybeSingle();

  if (error) {
    return NextResponse.json<AttendeeResponse>(
      { ok: false, message: 'ATTENDEE_QUERY_FAILED' },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json<AttendeeResponse>(
      { ok: false, message: 'ATTENDEE_NOT_FOUND' },
      { status: 404 },
    );
  }

  return NextResponse.json<AttendeeResponse>({ ok: true, attendee: data });
}
