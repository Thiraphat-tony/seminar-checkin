import { NextRequest, NextResponse } from 'next/server';
import { requireStaffForApi } from '@/lib/requireStaffForApi';

export async function GET(request: NextRequest) {
  const { staff, supabase } = await requireStaffForApi(request);

  if (!staff) {
    return NextResponse.json(
      { ok: false, error: 'ไม่พบข้อมูล staff' },
      { status: 403 }
    );
  }

  const courtId = staff.court_id;
  if (!courtId) {
    return NextResponse.json(
      { ok: false, error: 'ไม่พบข้อมูลศาลของคุณ' },
      { status: 403 }
    );
  }

  const eventId = (process.env.EVENT_ID ?? '').trim();
  if (!eventId) {
    return NextResponse.json(
      { ok: false, error: 'ยังไม่ได้ตั้งค่า EVENT_ID' },
      { status: 500 }
    );
  }

  const { data: attendees, error } = await supabase
    .from('attendees')
    .select('coordinator_prefix_other, coordinator_name, coordinator_phone, court_id')
    .eq('event_id', eventId)
    .eq('court_id', courtId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching coordinator info:', error);
    return NextResponse.json(
      { ok: false, error: 'โหลดข้อมูลไม่สำเร็จ' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    coordinator: {
      prefix: attendees?.coordinator_prefix_other ?? '',
      name: attendees?.coordinator_name ?? '',
      phone: attendees?.coordinator_phone ?? '',
    },
  });
}

export async function PUT(request: NextRequest) {
  const { staff, supabase } = await requireStaffForApi(request);

  if (!staff) {
    return NextResponse.json(
      { ok: false, error: 'ไม่พบข้อมูล staff' },
      { status: 403 }
    );
  }

  const courtId = staff.court_id;
  if (!courtId) {
    return NextResponse.json(
      { ok: false, error: 'ไม่พบข้อมูลศาลของคุณ' },
      { status: 403 }
    );
  }

  const eventId = (process.env.EVENT_ID ?? '').trim();
  if (!eventId) {
    return NextResponse.json(
      { ok: false, error: 'ยังไม่ได้ตั้งค่า EVENT_ID' },
      { status: 500 }
    );
  }

  let body: { prefix?: string; name?: string; phone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'ข้อมูลไม่ถูกต้อง' },
      { status: 400 }
    );
  }

  const prefix = (body.prefix ?? '').trim();
  const name = (body.name ?? '').trim();
  const phone = (body.phone ?? '').trim();

  if (!name) {
    return NextResponse.json(
      { ok: false, error: 'กรุณากรอกชื่อผู้ประสานงาน' },
      { status: 400 }
    );
  }

  if (!phone) {
    return NextResponse.json(
      { ok: false, error: 'กรุณากรอกเบอร์โทรผู้ประสานงาน' },
      { status: 400 }
    );
  }

  if (!/^\d{10}$/.test(phone)) {
    return NextResponse.json(
      { ok: false, error: 'เบอร์โทรต้องเป็นตัวเลข 10 หลัก' },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from('attendees')
    .update({
      coordinator_prefix_other: prefix,
      coordinator_name: name,
      coordinator_phone: phone,
    })
    .eq('event_id', eventId)
    .eq('court_id', courtId);

  if (error) {
    console.error('Error updating coordinator info:', error);
    return NextResponse.json(
      { ok: false, error: 'บันทึกข้อมูลไม่สำเร็จ' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
