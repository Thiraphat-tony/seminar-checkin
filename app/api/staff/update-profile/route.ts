import { NextRequest, NextResponse } from 'next/server';
import { requireStaffForApi } from '@/lib/requireStaffForApi';

export async function POST(req: NextRequest) {
  const auth = await requireStaffForApi();
  if (!auth.ok) return auth.response;

  const { supabase, staff } = auth;

  let body: any;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'INVALID_JSON' }, { status: 400 });
  }

  const province_name = typeof body.province_name === 'string' ? body.province_name.trim() : undefined;

  const updateObj: Record<string, any> = {};
  if (province_name !== undefined) updateObj.province_name = province_name;

  if (Object.keys(updateObj).length === 0) {
    return NextResponse.json({ ok: false, error: 'NO_UPDATES' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('staff_profiles')
    .update(updateObj)
    .eq('user_id', staff.user_id)
    .select('user_id, province_name, province_key, role')
    .single();

  if (error) {
    console.error('Failed to update staff profile', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, staff: data });
}
