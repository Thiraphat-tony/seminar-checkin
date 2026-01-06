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

  const auth = await requireStaffForApi(req);
  if (!auth.ok) return auth.response;
  const { supabase, staff } = auth;

  let updQuery = supabase
    .from('attendees')
    .update({ slip_url: null })
    .eq('id', body.attendeeId);

  if (staff.role !== 'super_admin') {
    const prov = (staff.province_name ?? '').trim();
    const isSurat = prov.includes('สุราษฎร์');
    if (prov && !isSurat) {
      updQuery = updQuery.eq('province', prov);
    }
  }

  const { data, error } = await updQuery.select('id');

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return NextResponse.json({ error: 'ไม่พบผู้เข้าร่วมหรือไม่มีสิทธิ์อัปเดต' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
