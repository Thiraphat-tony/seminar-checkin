import { NextResponse } from 'next/server';
import { requireStaffForApi } from '@/lib/requireStaffForApi';

type Body = {
  eventId?: string;
  registrationOpen?: boolean;
  checkinOpen?: boolean;
};

export async function POST(req: Request) {
  const auth = await requireStaffForApi(req);
  if (!auth.ok) return auth.response;
  const provinceKey = (auth.staff.province_key ?? '').trim().toUpperCase();
  const isSurat =
    provinceKey === 'SRT' || (auth.staff.province_name ?? '').includes('สุราษฎร์ธานี');

  if (!isSurat) {
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

  const updateData: Record<string, boolean> = {};
  if (typeof body.registrationOpen === 'boolean') {
    updateData.registration_open = body.registrationOpen;
  }
  if (typeof body.checkinOpen === 'boolean') {
    updateData.checkin_open = body.checkinOpen;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ ok: false, error: 'NO_FIELDS' }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from('events')
    .update(updateData)
    .eq('id', eventId)
    .select('id, registration_open, checkin_open')
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? 'UPDATE_FAILED' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, event: data });
}
