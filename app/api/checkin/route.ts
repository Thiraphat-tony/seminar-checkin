// app/api/checkin/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';

import { createServerClient } from '@/lib/supabaseServer';
import { checkRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

type FoodType =
  | 'normal'
  | 'no_pork'
  | 'vegetarian'
  | 'vegan'
  | 'halal'
  | 'seafood_allergy'
  | 'other';

const ALLOWED_FOOD_TYPES: FoodType[] = [
  'normal',
  'no_pork',
  'vegetarian',
  'vegan',
  'halal',
  'seafood_allergy',
  'other',
];

type EventSettings = {
  id: string;
  checkin_open: boolean | null;
  checkin_round_open: number | null;
};

type AttendeeCheckinView = {
  id: string;
  event_id: string | null;
  ticket_token?: string | null;
  checked_in_at: string | null;
  checkin_round1_at: string | null;
  checkin_round2_at: string | null;
  checkin_round3_at: string | null;
};

type CheckinGetResponse =
  | {
      ok: true;
      success: true;
      checkinOpen: boolean;
      checkinRoundOpen: number;
      allowed: boolean;
      withinWindow: boolean;
      alreadyCheckedIn: boolean;
      checkedInAt: string | null;
      checked_in_at?: string | null;
      rounds: {
        round1At: string | null;
        round2At: string | null;
        round3At: string | null;
      };
    }
  | {
      ok: false;
      success: false;
      message: string;
    };

type CheckinPostResponse =
  | {
      ok: true;
      success: true;
      status: 'checked_in' | 'already_checked_in';
      round: number;
      checked_in_at: string | null;
      checkedInAt?: string | null;
      alreadyCheckedIn: boolean;
      message: string;
    }
  | {
      ok: false;
      success: false;
      status: 'closed' | 'round_not_open' | 'invalid';
      message: string;
      checkinOpen?: boolean;
      checkinRoundOpen?: number;
    };

type RateLimitConfig = {
  ip: { limit: number; windowSec: number };
  token: { limit: number; windowSec: number };
};

const RATE_LIMIT: RateLimitConfig = {
  ip: { limit: 300, windowSec: 300 },
  token: { limit: 30, windowSec: 300 },
};

const GENERIC_NOT_FOUND_MESSAGE = 'ไม่พบข้อมูลผู้เข้าร่วม';

function normalizeFoodType(raw: unknown): FoodType {
  if (!raw) return 'normal';
  const value = String(raw).trim();
  if (!value) return 'normal';
  return ALLOWED_FOOD_TYPES.includes(value as FoodType) ? (value as FoodType) : 'other';
}

function normalizeRound(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  if (parsed < 0) return 0;
  if (parsed > 3) return 0;
  return parsed;
}

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

function hashTokenHex(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function hashTokenBuffer(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}

function timingSafeTokenMatch(token: string, stored: string | null | undefined): boolean {
  const provided = hashTokenBuffer(token);
  const storedHash = hashTokenBuffer(stored ?? '');
  return timingSafeEqual(provided, storedHash);
}

function resolveEventId(requestEventId: unknown, attendeeEventId: string | null) {
  const fromRequest = typeof requestEventId === 'string' ? requestEventId.trim() : '';
  if (fromRequest) return fromRequest;

  const fromAttendee = (attendeeEventId ?? '').trim();
  if (fromAttendee) return fromAttendee;

  const fromEnv = (process.env.EVENT_ID ?? '').trim();
  return fromEnv || null;
}

async function loadEventSettings(
  supabase: ReturnType<typeof createServerClient>,
  eventId: string,
) {
  return supabase
    .from('events')
    .select('id, checkin_open, checkin_round_open')
    .eq('id', eventId)
    .maybeSingle();
}

async function enforceRateLimit(req: NextRequest, ticketToken: string) {
  const ip = getClientIp(req);
  const tokenHash = hashTokenHex(ticketToken);
  const isLocalIp =
    ip === '::1' || ip === '127.0.0.1' || ip.startsWith('::ffff:127.');

  if (process.env.NODE_ENV !== 'production' || isLocalIp) {
    return { blocked: false };
  }

  const [ipLimit, tokenLimit] = await Promise.all([
    checkRateLimit({
      key: `checkin:ip:${ip}`,
      limit: RATE_LIMIT.ip.limit,
      windowSec: RATE_LIMIT.ip.windowSec,
    }),
    checkRateLimit({
      key: `checkin:token:${tokenHash}`,
      limit: RATE_LIMIT.token.limit,
      windowSec: RATE_LIMIT.token.windowSec,
    }),
  ]);

  if (!ipLimit.allowed || !tokenLimit.allowed) {
    console.warn('checkin rate limit blocked', {
      ip,
      tokenHash,
      ipRemaining: ipLimit.remaining,
      tokenRemaining: tokenLimit.remaining,
    });
    const resetAt = Math.max(ipLimit.resetAt, tokenLimit.resetAt);
    const retryAfterSec = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
    return {
      blocked: true,
      retryAfterSec,
      message: 'คำขอมากเกินไป กรุณาลองใหม่อีกครั้งในภายหลัง',
    };
  }

  return { blocked: false };
}

type CheckinRow = {
  round: number | null;
  checked_in_at: string | null;
};

function mergeRoundValue(current: string | null, next: string | null) {
  if (!next) return current;
  if (!current) return next;
  return new Date(next) < new Date(current) ? next : current;
}

function buildRoundsFromRows(rows: CheckinRow[] | null | undefined) {
  const rounds = { round1At: null as string | null, round2At: null as string | null, round3At: null as string | null };
  for (const row of rows ?? []) {
    if (!row || !row.round) continue;
    if (row.round === 1) rounds.round1At = mergeRoundValue(rounds.round1At, row.checked_in_at);
    if (row.round === 2) rounds.round2At = mergeRoundValue(rounds.round2At, row.checked_in_at);
    if (row.round === 3) rounds.round3At = mergeRoundValue(rounds.round3At, row.checked_in_at);
  }
  return rounds;
}

export async function GET(req: NextRequest) {
  const ticketToken = req.nextUrl.searchParams.get('ticket_token')?.trim();
  if (!ticketToken) {
    return NextResponse.json<CheckinGetResponse>(
      { ok: false, success: false, message: 'MISSING_TICKET_TOKEN' },
      { status: 400 },
    );
  }

  const rateLimit = await enforceRateLimit(req, ticketToken);
  if (rateLimit.blocked) {
    return NextResponse.json<CheckinGetResponse>(
      { ok: false, success: false, message: rateLimit.message ?? 'คำขอมากเกินไป กรุณาลองใหม่อีกครั้ง' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSec) } },
    );
  }

  const supabase = createServerClient();

  let attendee: AttendeeCheckinView | null = null;
  let rounds = { round1At: null as string | null, round2At: null as string | null, round3At: null as string | null };

  const { data: viewRow, error: viewError } = await supabase
    .from('v_attendees_checkin_rounds')
    .select(
      'id, event_id, ticket_token, checked_in_at, checkin_round1_at, checkin_round2_at, checkin_round3_at',
    )
    .eq('ticket_token', ticketToken)
    .maybeSingle();

  if (!viewError && viewRow) {
    attendee = viewRow as AttendeeCheckinView;
    rounds = {
      round1At: viewRow.checkin_round1_at ?? null,
      round2At: viewRow.checkin_round2_at ?? null,
      round3At: viewRow.checkin_round3_at ?? null,
    };
  } else if (viewError) {
    console.warn('checkin: v_attendees_checkin_rounds query failed, falling back', viewError);
    const { data: attendeeBase, error: attendeeBaseError } = await supabase
      .from('attendees')
      .select('id, event_id, ticket_token, checked_in_at')
      .eq('ticket_token', ticketToken)
      .maybeSingle();

    if (attendeeBaseError) {
      return NextResponse.json<CheckinGetResponse>(
        { ok: false, success: false, message: 'ATTENDEE_QUERY_FAILED' },
        { status: 500 },
      );
    }

    if (attendeeBase) {
      attendee = attendeeBase as AttendeeCheckinView;
      const { data: checkinRows, error: checkinsError } = await supabase
        .from('attendee_checkins')
        .select('round, checked_in_at')
        .eq('attendee_id', attendeeBase.id);

      if (checkinsError) {
        console.warn('checkin: attendee_checkins fallback failed', checkinsError);
      } else {
        rounds = buildRoundsFromRows(checkinRows as CheckinRow[]);
      }
    }
  }

  const tokenMatches = timingSafeTokenMatch(ticketToken, attendee?.ticket_token);

  if (!attendee || !tokenMatches) {
    return NextResponse.json<CheckinGetResponse>(
      { ok: false, success: false, message: GENERIC_NOT_FOUND_MESSAGE },
      { status: 404 },
    );
  }

  const eventId = resolveEventId(
    req.nextUrl.searchParams.get('event_id'),
    attendee.event_id,
  );
  if (!eventId) {
    return NextResponse.json<CheckinGetResponse>(
      { ok: false, success: false, message: GENERIC_NOT_FOUND_MESSAGE },
      { status: 400 },
    );
  }

  const { data: event, error: eventError } = await loadEventSettings(supabase, eventId);

  if (eventError || !event) {
    return NextResponse.json<CheckinGetResponse>(
      { ok: false, success: false, message: 'EVENT_NOT_FOUND' },
      { status: 404 },
    );
  }

  const checkinOpen = event.checkin_open !== false;
  const checkinRoundOpen = normalizeRound(event.checkin_round_open);
  const allowed = checkinOpen && checkinRoundOpen > 0;

  return NextResponse.json<CheckinGetResponse>({
    ok: true,
    success: true,
    checkinOpen,
    checkinRoundOpen,
    allowed,
    withinWindow: true,
    alreadyCheckedIn: !!attendee.checked_in_at,
    checkedInAt: attendee.checked_in_at ?? null,
    checked_in_at: attendee.checked_in_at ?? null,
    rounds,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body.ticket_token !== 'string') {
      return NextResponse.json<CheckinPostResponse>(
        {
          ok: false,
          success: false,
          status: 'invalid',
          message: 'ไม่พบหรือรูปแบบ ticket_token ไม่ถูกต้องในคำขอ',
        },
        { status: 400 },
      );
    }

    const ticketToken = body.ticket_token.trim();
    if (!ticketToken) {
      return NextResponse.json<CheckinPostResponse>(
        {
          ok: false,
          success: false,
          status: 'invalid',
          message: 'ticket_token ห้ามเป็นค่าว่าง',
        },
        { status: 400 },
      );
    }

    const rateLimit = await enforceRateLimit(req, ticketToken);
    if (rateLimit.blocked) {
      return NextResponse.json<CheckinPostResponse>(
        {
          ok: false,
          success: false,
          status: 'invalid',
          message: rateLimit.message ?? 'คำขอมากเกินไป กรุณาลองใหม่อีกครั้ง',
        },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSec) } },
      );
    }

    const hasFoodType =
      typeof body.food_type === 'string' && body.food_type.trim().length > 0;
    const foodType = hasFoodType ? normalizeFoodType(body.food_type) : null;

    const supabase = createServerClient();

    const { data: attendee, error: attendeeError } = await supabase
      .from('attendees')
      .select('id, event_id, checked_in_at, ticket_token, food_type')
      .eq('ticket_token', ticketToken)
      .maybeSingle();

    if (attendeeError) {
      console.error('checkin: attendee query error', attendeeError);
      return NextResponse.json<CheckinPostResponse>(
        {
          ok: false,
          success: false,
          status: 'invalid',
          message: 'เกิดข้อผิดพลาดในการค้นหาข้อมูลผู้เข้าร่วม',
        },
        { status: 500 },
      );
    }
    const tokenMatches = timingSafeTokenMatch(ticketToken, attendee?.ticket_token);

    if (!attendee || !tokenMatches) {
      return NextResponse.json<CheckinPostResponse>(
        {
          ok: false,
          success: false,
          status: 'invalid',
          message: GENERIC_NOT_FOUND_MESSAGE,
        },
        { status: 404 },
      );
    }

    const eventId = resolveEventId(body.event_id, attendee.event_id);
    if (!eventId) {
      return NextResponse.json<CheckinPostResponse>(
        {
          ok: false,
          success: false,
          status: 'invalid',
          message: 'EVENT_ID_REQUIRED',
        },
        { status: 400 },
      );
    }

    const { data: event, error: eventError } = await loadEventSettings(supabase, eventId);

    if (eventError || !event) {
      console.error('checkin: event query error', eventError);
      return NextResponse.json<CheckinPostResponse>(
        {
          ok: false,
          success: false,
          status: 'invalid',
          message: 'ไม่พบข้อมูลการตั้งค่าลงทะเบียน',
        },
        { status: 404 },
      );
    }

    const checkinOpen = event.checkin_open !== false;
    const checkinRoundOpen = normalizeRound(event.checkin_round_open);
    const allowed = checkinOpen && checkinRoundOpen > 0;

    if (!allowed) {
      return NextResponse.json<CheckinPostResponse>(
        {
          ok: false,
          success: false,
          status: checkinOpen ? 'round_not_open' : 'closed',
          message: checkinOpen ? 'ROUND_NOT_OPEN' : 'CHECKIN_CLOSED',
          checkinOpen,
          checkinRoundOpen,
        },
        { status: 403 },
      );
    }

    const { data: existingCheckin, error: existingError } = await supabase
      .from('attendee_checkins')
      .select('checked_in_at')
      .eq('attendee_id', attendee.id)
      .eq('round', checkinRoundOpen)
      .maybeSingle();

    if (existingError) {
      console.error('checkin: existing checkin query error', existingError);
      return NextResponse.json<CheckinPostResponse>(
        {
          ok: false,
          success: false,
          status: 'invalid',
          message: 'ไม่สามารถตรวจสอบสถานะการลงทะเบียนรอบนี้ได้',
        },
        { status: 500 },
      );
    }

    if (existingCheckin) {
      return NextResponse.json<CheckinPostResponse>({
        ok: true,
        success: true,
        status: 'already_checked_in',
        round: checkinRoundOpen,
        checked_in_at: existingCheckin.checked_in_at ?? attendee.checked_in_at ?? null,
        checkedInAt: existingCheckin.checked_in_at ?? attendee.checked_in_at ?? null,
        alreadyCheckedIn: true,
        message: 'ลงทะเบียนรอบนี้ไว้แล้ว',
      });
    }

    const { data: inserted, error: insertError } = await supabase
      .from('attendee_checkins')
      .insert({
        attendee_id: attendee.id,
        round: checkinRoundOpen,
        checked_in_by: null,
      })
      .select('checked_in_at')
      .single();

    if (insertError) {
      const isDuplicate = insertError.code === '23505';
      if (isDuplicate) {
        return NextResponse.json<CheckinPostResponse>({
          ok: true,
          success: true,
          status: 'already_checked_in',
          round: checkinRoundOpen,
          checked_in_at: attendee.checked_in_at ?? null,
          checkedInAt: attendee.checked_in_at ?? null,
          alreadyCheckedIn: true,
          message: 'ลงทะเบียนรอบนี้ไว้แล้ว',
        });
      }

      console.error('checkin: insert attendee_checkins failed', insertError);
      return NextResponse.json<CheckinPostResponse>(
        {
          ok: false,
          success: false,
          status: 'invalid',
          message: 'ลงทะเบียนไม่สำเร็จ กรุณาลองใหม่หรือติดต่อเจ้าหน้าที่',
        },
        { status: 500 },
      );
    }

    if (hasFoodType && foodType) {
      const { error: updateError } = await supabase
        .from('attendees')
        .update({ food_type: foodType })
        .eq('id', attendee.id);

      if (updateError) {
        console.warn('checkin: food_type update failed', updateError);
      }
    }

    return NextResponse.json<CheckinPostResponse>({
      ok: true,
      success: true,
      status: 'checked_in',
      round: checkinRoundOpen,
      checked_in_at: inserted?.checked_in_at ?? null,
      checkedInAt: inserted?.checked_in_at ?? null,
      alreadyCheckedIn: false,
      message: `ลงทะเบียนรอบ ${checkinRoundOpen} สำเร็จ`,
    });
  } catch (err) {
    console.error('checkin: unexpected error', err);
    return NextResponse.json<CheckinPostResponse>(
      {
        ok: false,
        success: false,
        status: 'invalid',
        message: 'เกิดข้อผิดพลาดในระบบลงทะเบียน กรุณาลองใหม่หรือติดต่อเจ้าหน้าที่',
      },
      { status: 500 },
    );
  }
}

