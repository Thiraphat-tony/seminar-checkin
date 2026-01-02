import { NextResponse } from 'next/server';
import { requireStaffForApi } from '@/lib/requireStaffForApi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  email?: string;
};

export async function POST(req: Request) {
  try {
    const auth = await requireStaffForApi();
    if (!auth.ok) return auth.response;

    const body = (await req.json()) as Body;
    const email = (body.email ?? '').trim();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ ok: false, error: 'INVALID_EMAIL' }, { status: 400 });
    }

    // Use server-side supabase (created with service role key inside requireStaffForApi)
    const supabase = auth.supabase;
    const staff = auth.staff;

    // Call Supabase Admin API to update the user's email (service role key)
    // Note: Supabase admin methods return { data, error }
    try {
      // Prefer the admin SDK method when available
      const adminUpdateFn = (supabase as any)?.auth?.admin?.updateUser;
      if (typeof adminUpdateFn === 'function') {
        // @ts-ignore
        const { data, error } = await adminUpdateFn.call((supabase as any).auth.admin, staff.user_id, { email });
        if (error) {
          console.error('Admin updateUser error', error);
          return NextResponse.json({ ok: false, error: error.message ?? 'UPDATE_FAILED' }, { status: 500 });
        }
        return NextResponse.json({ ok: true, user: data?.user ?? null });
      }

      // Fallback: use Supabase Admin REST API directly (PATCH /auth/v1/admin/users/:id)
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
      if (!serviceKey || !baseUrl) {
        console.error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL');
        return NextResponse.json({ ok: false, error: 'SERVER_ENV' }, { status: 500 });
      }

      const adminUrl = `${baseUrl}/auth/v1/admin/users/${encodeURIComponent(staff.user_id)}`;
      const r = await fetch(adminUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ email }),
      });

      const json = await r.json().catch(() => null);
      if (!r.ok) {
        console.error('Admin REST update failed', r.status, json);
        return NextResponse.json({ ok: false, error: json?.message ?? json?.error_description ?? 'UPDATE_FAILED' }, { status: r.status });
      }

      return NextResponse.json({ ok: true, user: json ?? null });
    } catch (e: any) {
      console.error('Error calling admin.updateUser (fallback)', e);
      return NextResponse.json({ ok: false, error: e?.message ?? 'UPDATE_FAILED' }, { status: 500 });
    }
  } catch (e) {
    console.error('Unexpected error in update-email', e);
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
