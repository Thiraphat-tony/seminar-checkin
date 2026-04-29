// app/api/registeruser/count/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { requireStaffForApi } from '@/lib/requireStaffForApi';

export async function GET(request: Request) {
  const auth = await requireStaffForApi();
  if (!auth.ok) return auth.response;

  const EVENT_ID = process.env.EVENT_ID;
  if (!EVENT_ID) {
    return NextResponse.json({ ok: false, message: 'MISSING_EVENT_ID' }, { status: 500 });
  }

  const url = new URL(request.url);
  const queryCourtId = url.searchParams.get('courtId');
  const courtId = queryCourtId || auth.staff.court_id;

  if (!courtId) {
    return NextResponse.json(
      { ok: false, message: 'ไม่พบข้อมูลศาลของบัญชีผู้ใช้' },
      { status: 403 },
    );
  }

  const supabase = createServerClient();

  try {
    const { data: attendees, error } = await supabase
      .from('attendees')
      .select('id, organization, province')
      .eq('event_id', EVENT_ID)
      .eq('court_id', courtId);

    if (error) {
      console.error('[RegisterCount] Error:', error);
      return NextResponse.json(
        { ok: false, message: 'ไม่สามารถดึงข้อมูลได้' },
        { status: 500 },
      );
    }

    const count = attendees?.length || 0;
    const organization = attendees?.[0]?.organization || '';
    const province = attendees?.[0]?.province || '';

    return NextResponse.json({
      ok: true,
      count,
      organization,
      province,
    });
  } catch (error) {
    console.error('[RegisterCount] Unexpected error:', error);
    return NextResponse.json(
      { ok: false, message: 'เกิดข้อผิดพลาด' },
      { status: 500 },
    );
  }
}
