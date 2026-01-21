import { NextRequest, NextResponse } from 'next/server';
import { requireStaffForApi } from '@/lib/requireStaffForApi';

export async function POST(req: NextRequest) {
  const auth = await requireStaffForApi(req);
  if (!auth.ok) return auth.response;

  const { supabase, staff } = auth;

  let body: any;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'INVALID_JSON' }, { status: 400 });
  }

  const name_prefix = typeof body.name_prefix === 'string' ? body.name_prefix.trim() : undefined;
  const phone = typeof body.phone === 'string' ? body.phone.trim() : undefined;

  const updateObj: Record<string, any> = {};
  if (name_prefix !== undefined) updateObj.name_prefix = name_prefix || null;
  if (phone !== undefined) updateObj.phone = phone || null;

  if (Object.keys(updateObj).length === 0) {
    return NextResponse.json({ ok: false, error: 'NO_UPDATES' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('staff_profiles')
    .update(updateObj)
    .eq('user_id', staff.user_id)
    .select('user_id, role, court_id, is_active, name_prefix, phone')
    .single();

  if (error) {
    console.error('Failed to update staff profile', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, staff: data });
}
