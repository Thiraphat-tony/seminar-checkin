// app/api/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { requireStaffForApi } from '@/lib/requireStaffForApi';

export async function GET() {
  const auth = await requireStaffForApi();
  if (!auth.ok) return auth.response;

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('staff_profiles')
    .select('full_name, phone')
    .eq('user_id', auth.user.id)
    .single();

  if (error) {
    return NextResponse.json({ ok: false, message: 'ไม่สามารถดึงข้อมูลได้' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    full_name: data?.full_name || '',
    phone: data?.phone || '',
  });
}

export async function PUT(req: NextRequest) {
  const auth = await requireStaffForApi(req);
  if (!auth.ok) return auth.response;

  const supabase = createServerClient();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON' }, { status: 400 });
  }

  const full_name = (body.full_name || '').toString().trim();
  const phone = (body.phone || '').toString().trim();

  if (!full_name) {
    return NextResponse.json({ ok: false, message: 'กรุณากรอกชื่อ-นามสกุล' }, { status: 400 });
  }

  // Validate phone (optional)
  if (phone) {
    const phoneRegex = /^0\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return NextResponse.json(
        { ok: false, message: 'เบอร์โทรต้องเป็นตัวเลข 10 หลัก เริ่มต้นด้วย 0' },
        { status: 400 },
      );
    }
  }

  const { error } = await supabase
    .from('staff_profiles')
    .update({ full_name, phone })
    .eq('user_id', auth.user.id);

  if (error) {
    console.error('[Profile] Update error:', error);
    return NextResponse.json({ ok: false, message: 'ไม่สามารถบันทึกข้อมูลได้' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: 'บันทึกข้อมูลเรียบร้อยแล้ว' });
}
