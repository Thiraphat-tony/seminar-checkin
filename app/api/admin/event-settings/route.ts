import { NextResponse } from 'next/server';
import { requireStaffForApi } from '@/lib/requireStaffForApi';

type Body = {
  eventId?: string;
  registrationOpen?: boolean;
  checkinOpen?: boolean;
  checkinRoundOpen?: number;
};

export async function POST(req: Request) {
  const auth = await requireStaffForApi(req);
  if (!auth.ok) return auth.response;
  const isSuperAdmin = auth.staff.role === 'super_admin';
  if (!isSuperAdmin) {
    return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: 'INVALID_BODY' }, { status: 400 });
  }

  const eventId = (body.eventId ?? process.env.EVENT_ID ?? '').trim();
  if (!eventId) {
    return NextResponse.json({ ok: false, error: 'MISSING_EVENT_ID' }, { status: 400 });
  }

  const updateData: Record<string, boolean | number> = {};
  if (typeof body.registrationOpen === 'boolean') {
    updateData.registration_open = body.registrationOpen;
  }
  if (typeof body.checkinOpen === 'boolean') {
    updateData.checkin_open = body.checkinOpen;
  }
  if (typeof body.checkinRoundOpen === 'number') {
    if (!Number.isFinite(body.checkinRoundOpen)) {
      return NextResponse.json({ ok: false, error: 'INVALID_CHECKIN_ROUND' }, { status: 400 });
    }
    const normalizedRound = Math.max(0, Math.min(3, Math.trunc(body.checkinRoundOpen)));
    updateData.checkin_round_open = normalizedRound;
  }

  if (typeof body.checkinOpen === 'boolean' && body.checkinOpen === false) {
    updateData.checkin_round_open = 0;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ ok: false, error: 'NO_FIELDS' }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from('events')
    .update(updateData)
    .eq('id', eventId)
    .select('id, registration_open, checkin_open, checkin_round_open')
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? 'UPDATE_FAILED' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, event: data });
}
