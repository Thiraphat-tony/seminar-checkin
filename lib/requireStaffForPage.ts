// lib/requireStaffForPage.ts
import 'server-only';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabaseServer';
import { headers } from 'next/headers';

export type StaffRole = 'staff' | 'super_admin';

export type StaffProfile = {
  user_id: string;
  role: StaffRole;
  court_id: string;
  is_active: boolean;
  name_prefix: string | null;
  phone: string | null;
};

export async function requireStaffForPage(opts?: { redirectTo?: string }) {
  const redirectTo = opts?.redirectTo ?? '/login';
  const supabase = await createServerClient();

  // Read access token set by client (login flow writes `sb-access-token` cookie)
  let token: string | undefined;
  try {
    const cookieHeader = (await headers()).get('cookie') ?? '';

    // small, typed parser to avoid implicit any and make logic clearer
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
    console.error('Error reading cookie header for auth token', e);
    redirect(redirectTo);
  }

  let userData: any;
  try {
    const res = await supabase.auth.getUser(token ?? undefined);
    userData = res.data;
    const userErr = res.error;
    if (userErr || !userData?.user) redirect(redirectTo);
  } catch (e) {
    console.error('Error calling supabase.auth.getUser', e);
    redirect(redirectTo);
  }

  const { data: staff, error: staffErr } = await supabase
    .from('staff_profiles')
    .select('user_id, role, court_id, is_active, name_prefix, phone')
    .eq('user_id', userData.user.id)
    .single();

  if (staffErr || !staff) redirect(redirectTo);
  if (staff.is_active === false) redirect(redirectTo);

  return { supabase, user: userData.user, staff: staff as StaffProfile };
}
