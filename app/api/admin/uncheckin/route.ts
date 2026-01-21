// app/api/admin/uncheckin/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

type Body = {
  attendeeId?: string;
  round?: number | 'all';
  eventId?: string;
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

    if (!body || !body.attendeeId) {
      return NextResponse.json(
        { success: false, message: 'ไม่พบ attendeeId ในคำขอ' },
        { status: 400 },
      );
    }

    const attendeeId = String(body.attendeeId);
    const roundAll = body.round === 'all' || body.round == null;
    const requestedRound =
      typeof body.round === 'number' ? normalizeRound(body.round) : null;

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

    const roundToUse = roundAll ? null : requestedRound;
    if (!roundAll && !roundToUse) {
      return NextResponse.json(
        { success: false, message: 'ROUND_REQUIRED' },
        { status: 400 },
      );
    }

    let deleteQuery = supabase.from('attendee_checkins').delete().eq('attendee_id', attendee.id);
    if (roundToUse) {
      deleteQuery = deleteQuery.eq('round', roundToUse);
    }

    const { data: deleted, error: deleteError } = await deleteQuery.select('round');

    if (deleteError) {
      console.error('uncheckin delete error:', deleteError);
      return NextResponse.json(
        {
          success: false,
          message: 'ยกเลิกเช็กอินไม่สำเร็จ กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ',
        },
        { status: 500 },
      );
    }

    if (!deleted || deleted.length === 0) {
      return NextResponse.json(
        {
          success: true,
          alreadyUnchecked: true,
          message: 'ผู้เข้าร่วมรายนี้ยังไม่ได้เช็กอินอยู่แล้ว',
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `ยกเลิกเช็กอินให้ผู้เข้าร่วม “${attendee.full_name ?? ''}” เรียบร้อย`,
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('uncheckin error:', err);
    return NextResponse.json(
      {
        success: false,
        message: 'เกิดข้อผิดพลาดในระบบขณะยกเลิกเช็กอิน กรุณาลองใหม่',
      },
      { status: 500 },
    );
  }
}
