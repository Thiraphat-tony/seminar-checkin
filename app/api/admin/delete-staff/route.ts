import { NextResponse } from 'next/server';
import { requireStaffForApi } from '@/lib/requireStaffForApi';

type Body = {
  userId?: string;
};

async function deleteAuthUser(supabase: any, userId: string) {
  const admin = supabase?.auth?.admin;

  if (typeof admin?.deleteUser === 'function') {
    const { error } = await admin.deleteUser(userId);
    if (error) {
      return { ok: false as const, error: error.message ?? 'DELETE_FAILED' };
    }
    return { ok: true as const };
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  if (!serviceKey || !baseUrl) {
    return { ok: false as const, error: 'SERVER_ENV' };
  }

  const res = await fetch(`${baseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });

  if (!res.ok) {
    const json = await res.json().catch(() => null);
    const message =
      json?.message ?? json?.error_description ?? (typeof json === 'string' ? json : null);
    return { ok: false as const, error: message ?? 'DELETE_FAILED' };
  }

  return { ok: true as const };
}

export async function POST(request: Request) {
  try {
    const auth = await requireStaffForApi(request);
    if (!auth.ok) return auth.response;

    const provinceKey = (auth.staff.province_key ?? '').trim().toUpperCase();
    const isSurat =
      provinceKey === 'SRT' || (auth.staff.province_name ?? '').includes('สุราษฎร์ธานี');
    if (!isSurat) {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as Body | null;
    const userId = (body?.userId ?? '').trim();
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'MISSING_USER_ID' }, { status: 400 });
    }
    if (userId === auth.staff.user_id) {
      return NextResponse.json({ ok: false, error: 'CANNOT_DELETE_SELF' }, { status: 400 });
    }

    const { data: staffProfile, error: staffProfileError } = await auth.supabase
      .from('staff_profiles')
      .select('user_id, role, province_name')
      .eq('user_id', userId)
      .maybeSingle();

    if (staffProfileError) {
      return NextResponse.json(
        { ok: false, error: staffProfileError.message ?? 'LOOKUP_FAILED' },
        { status: 500 },
      );
    }

    if (!staffProfile) {
      return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
    }

    if (staffProfile.role === 'super_admin') {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
    }

    const deleted = await deleteAuthUser(auth.supabase, userId);
    if (!deleted.ok) {
      return NextResponse.json(
        { ok: false, error: deleted.error ?? 'DELETE_FAILED' },
        { status: 500 },
      );
    }

    const { error: deleteProfileError } = await auth.supabase
      .from('staff_profiles')
      .delete()
      .eq('user_id', userId);

    if (deleteProfileError) {
      return NextResponse.json(
        { ok: false, error: deleteProfileError.message ?? 'DELETE_PROFILE_FAILED' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Delete staff error:', error);
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
