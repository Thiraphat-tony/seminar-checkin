import { NextRequest, NextResponse } from 'next/server';
import { requireStaffForApi } from '@/lib/requireStaffForApi';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { attendeeId?: string } | null;

  if (!body?.attendeeId) {
    return NextResponse.json(
      { error: 'missing attendeeId' },
      { status: 400 }
    );
  }

  const auth = await requireStaffForApi();
  if (!auth.ok) return auth.response;
  const { supabase, staff } = auth;
  let upd = supabase
    .from('attendees')
    .update({ slip_url: null })
    .eq('id', body.attendeeId);
  if (staff.role !== 'super_admin') {
    upd = upd.eq('province', staff.province_name);
  }
  const { error } = await upd;

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
