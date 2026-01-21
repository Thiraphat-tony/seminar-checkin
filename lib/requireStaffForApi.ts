// lib/requireStaffForApi.ts
import 'server-only';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import type { StaffProfile } from '@/lib/requireStaffForPage';
import { headers } from 'next/headers';

export async function requireStaffForApi(request?: Request) {
  const supabase = await createServerClient();

  let token: string | undefined;
  try {
    // If a Request object is provided (route handlers), prefer reading the cookie from it.
    const cookieHeader = request ? (request.headers.get('cookie') ?? '') : ((await headers()).get('cookie') ?? '');

    function parseCookies(header: string): Record<string, string> {
      return header
        .split(';')
        .map((part: string) => part.trim())
        .reduce<Record<string, string>>((acc, part) => {
          const idx = part.indexOf('=');
          if (idx === -1) return acc;
          const name = part.slice(0, idx);
          const value = part.slice(idx + 1);
          acc[name] = decodeURIComponent(value);
          return acc;
        }, {});
    }

    const cookies = parseCookies(cookieHeader);
    token = cookies['sb-access-token'];
  } catch (e) {
    console.error('Error reading cookie header for auth token (API)', e);
    return { ok: false as const, response: NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 }) };
  }

  let userData: any;
  try {
    const res = await supabase.auth.getUser(token ?? undefined);
    userData = res.data;
    const userErr = res.error;
    if (userErr || !userData?.user) {
      return { ok: false as const, response: NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 }) };
    }
  } catch (e) {
    console.error('Error calling supabase.auth.getUser (API)', e);
    return { ok: false as const, response: NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 }) };
  }

  const { data: staff, error: staffErr } = await supabase
    .from('staff_profiles')
    .select('user_id, role, court_id, is_active, name_prefix, phone')
    .eq('user_id', userData.user.id)
    .single();

  if (staffErr || !staff) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 }) };
  }
  if (staff.is_active === false) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 }) };
  }

  return { ok: true as const, supabase, user: userData.user, staff: staff as StaffProfile };
}
