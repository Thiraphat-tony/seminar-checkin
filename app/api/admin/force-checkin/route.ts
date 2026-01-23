import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

type Body = {
  attendeeId?: string;
  action?: 'checkin' | 'uncheckin';
  round?: number | 'all';
  eventId?: string;
};

type EventSettings = {
  id: string;
  checkin_open: boolean | null;
  checkin_round_open: number | null;
};

function normalizeRound(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  if (parsed < 0 || parsed > 3) return 0;
  return parsed;
}

function resolveEventId(requestEventId: unknown, attendeeEventId: string | null) {
  const fromRequest = typeof requestEventId === 'string' ? requestEventId.trim() : '';
  if (fromRequest) return fromRequest;
  const fromAttendee = (attendeeEventId ?? '').trim();
  if (fromAttendee) return fromAttendee;
  const fromEnv = (process.env.EVENT_ID ?? '').trim();
  return fromEnv || null;
}

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;

    if (!body || !body.attendeeId || !body.action) {
      return NextResponse.json(
        { success: false, message: 'ไม่พบ attendeeId หรือ action ในคำขอ' },
        { status: 400 },
      );
    }

    const attendeeId = String(body.attendeeId);
    const action = body.action;
    const requestedRound =
      typeof body.round === 'number' ? normalizeRound(body.round) : null;
    const roundAll = body.round === 'all';

    const supabase = createServerClient();

    const { data: attendee, error: attendeeError } = await supabase
      .from('attendees')
      .select('id, full_name, checked_in_at, event_id')
      .eq('id', attendeeId)
      .single();

    if (attendeeError || !attendee) {
      return NextResponse.json(
        { success: false, message: 'ไม่พบผู้เข้าร่วมในระบบ' },
        { status: 404 },
      );
    }

    const eventId = resolveEventId(body.eventId, attendee.event_id);
    if (!eventId) {
      return NextResponse.json(
        { success: false, message: 'EVENT_ID_REQUIRED' },
        { status: 400 },
      );
    }

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, checkin_open, checkin_round_open')
      .eq('id', eventId)
      .maybeSingle();

    if (eventError || !event) {
      return NextResponse.json(
        { success: false, message: 'ไม่พบข้อมูลการตั้งค่าลงทะเบียน' },
        { status: 404 },
      );
    }

    const eventSettings = event as EventSettings;
    const defaultRound = normalizeRound(eventSettings.checkin_round_open);

    if (action === 'checkin') {
      let roundToUse = requestedRound || defaultRound;

      if (!roundToUse) {
        const { data: existingRounds, error: roundsError } = await supabase
          .from('attendee_checkins')
          .select('round')
          .eq('attendee_id', attendee.id);

        if (roundsError) {
          return NextResponse.json(
            {
              success: false,
              message: 'ไม่สามารถตรวจสอบรอบลงทะเบียนของผู้เข้าร่วมได้',
            },
            { status: 500 },
          );
        }

        const taken = new Set((existingRounds ?? []).map((r: any) => r.round));
        const nextRound = [1, 2, 3].find((r) => !taken.has(r));
        if (!nextRound) {
          return NextResponse.json(
            {
              success: true,
              alreadyCheckedIn: true,
              round: 3,
              message: 'ผู้เข้าร่วมรายนี้ลงทะเบียนครบทุกรอบแล้ว',
            },
            { status: 200 },
          );
        }
        roundToUse = nextRound;
      }

      const { data: existing, error: existingError } = await supabase
        .from('attendee_checkins')
        .select('checked_in_at')
        .eq('attendee_id', attendee.id)
        .eq('round', roundToUse)
        .maybeSingle();

      if (existingError) {
        return NextResponse.json(
          {
            success: false,
            message: 'ไม่สามารถตรวจสอบสถานะการลงทะเบียนรอบนี้ได้',
          },
          { status: 500 },
        );
      }

      if (existing) {
        return NextResponse.json(
          {
            success: true,
            alreadyCheckedIn: true,
            round: roundToUse,
            message: `ผู้เข้าร่วมรายนี้ลงทะเบียนรอบ ${roundToUse} ไว้แล้ว`,
          },
          { status: 200 },
        );
      }

      const { data: inserted, error: insertError } = await supabase
        .from('attendee_checkins')
        .insert({
          attendee_id: attendee.id,
          round: roundToUse,
          checked_in_by: null,
        })
        .select('checked_in_at')
        .single();

      if (insertError) {
        const isDuplicate = insertError.code === '23505';
        if (isDuplicate) {
          return NextResponse.json(
            {
              success: true,
              alreadyCheckedIn: true,
              round: roundToUse,
              message: `ผู้เข้าร่วมรายนี้ลงทะเบียนรอบ ${roundToUse} ไว้แล้ว`,
            },
            { status: 200 },
          );
        }

        console.error('force checkin insert error:', insertError);
        return NextResponse.json(
          {
            success: false,
            message: 'ลงทะเบียนแทนไม่สำเร็จ กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ',
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        {
          success: true,
          alreadyCheckedIn: false,
          round: roundToUse,
          checked_in_at: inserted?.checked_in_at ?? null,
          message: `ลงทะเบียนรอบ ${roundToUse} ให้ผู้เข้าร่วม “${attendee.full_name ?? ''}” เรียบร้อย`,
        },
        { status: 200 },
      );
    }

    if (action === 'uncheckin') {
      let roundToUse = roundAll ? null : requestedRound || defaultRound;

      if (!roundAll && !roundToUse) {
        const { data: existingRounds, error: roundsError } = await supabase
          .from('attendee_checkins')
          .select('round')
          .eq('attendee_id', attendee.id);

        if (roundsError) {
          return NextResponse.json(
            {
              success: false,
              message: 'ไม่สามารถตรวจสอบรอบลงทะเบียนของผู้เข้าร่วมได้',
            },
            { status: 500 },
          );
        }

        const rounds = (existingRounds ?? []).map((r: any) => r.round);
        if (rounds.length === 0) {
          return NextResponse.json(
            {
              success: true,
              alreadyUnchecked: true,
              round: 'all',
              message: 'ผู้เข้าร่วมรายนี้ยังไม่ได้ลงทะเบียนในระบบ',
            },
            { status: 200 },
          );
        }
        roundToUse = Math.max(...rounds);
      }

      let deleteQuery = supabase.from('attendee_checkins').delete().eq('attendee_id', attendee.id);
      if (roundToUse) {
        deleteQuery = deleteQuery.eq('round', roundToUse);
      }

      const { data: deleted, error: deleteError } = await deleteQuery.select('round');

      if (deleteError) {
        console.error('force uncheckin delete error:', deleteError);
        return NextResponse.json(
          {
            success: false,
            message: 'ยกเลิกลงทะเบียนไม่สำเร็จ กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ',
          },
          { status: 500 },
        );
      }

      if (!deleted || deleted.length === 0) {
        return NextResponse.json(
          {
            success: true,
            alreadyUnchecked: true,
            round: roundToUse ?? 'all',
            message: 'ผู้เข้าร่วมรายนี้ยังไม่ได้ลงทะเบียนในรอบที่เลือก',
          },
          { status: 200 },
        );
      }

      return NextResponse.json(
        {
          success: true,
          round: roundToUse ?? 'all',
          message: `ยกเลิกลงทะเบียนให้ผู้เข้าร่วม “${attendee.full_name ?? ''}” เรียบร้อย`,
        },
        { status: 200 },
      );
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('force checkin error:', err);
    return NextResponse.json(
      {
        success: false,
        message: 'เกิดข้อผิดพลาดในระบบขณะลงทะเบียนแทน กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ',
      },
      { status: 500 },
    );
  }
}
