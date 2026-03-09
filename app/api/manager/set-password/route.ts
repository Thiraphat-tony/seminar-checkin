import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  mode?: 'listStaff' | 'resetPassword';
  passphrase?: string;
  newPassword?: string;
  email?: string;
  courtId?: string;
  userId?: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

type StaffOption = {
  userId: string;
  namePrefix: string;
  fullName: string;
  phone: string;
  isActive: boolean;
};

type AdminApi = {
  getUserByEmail?: (
    email: string,
  ) => Promise<{ data?: { user?: { id?: string } | null } | null; error?: { message?: string } | null }>;
  updateUserById?: (
    userId: string,
    attrs: { password: string },
  ) => Promise<{ error?: { message?: string } | null }>;
  updateUser?: (
    userId: string,
    attrs: { password: string },
  ) => Promise<{ error?: { message?: string } | null }>;
};

function getAdminApi() {
  const supabase = createServerClient() as { auth?: { admin?: AdminApi } };
  return supabase.auth?.admin;
}

async function findUserIdByEmail(email: string) {
  const admin = getAdminApi();

  if (typeof admin?.getUserByEmail === 'function') {
    const { data, error } = await admin.getUserByEmail(email);
    if (error || !data?.user?.id) {
      return { ok: false as const, error: error?.message ?? 'USER_NOT_FOUND' };
    }
    return { ok: true as const, userId: data.user.id };
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  if (!serviceKey || !baseUrl) {
    return { ok: false as const, error: 'SERVER_ENV' };
  }

  const url = `${baseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false as const, error: json?.message ?? 'USER_NOT_FOUND' };
  }

  const list = Array.isArray(json) ? json : json?.users ?? [];
  const userId = list?.[0]?.id;
  if (!userId) {
    return { ok: false as const, error: 'USER_NOT_FOUND' };
  }

  return { ok: true as const, userId };
}

async function updatePassword(userId: string, newPassword: string) {
  const admin = getAdminApi();

  if (typeof admin?.updateUserById === 'function') {
    const { error } = await admin.updateUserById(userId, { password: newPassword });
    if (error) {
      console.error('Admin updateUserById error', error);
      return { ok: false as const, error: error.message ?? 'UPDATE_FAILED' };
    }
    return { ok: true as const };
  }

  if (typeof admin?.updateUser === 'function') {
    const { error } = await admin.updateUser(userId, { password: newPassword });
    if (error) {
      console.error('Admin updateUser error', error);
      return { ok: false as const, error: error.message ?? 'UPDATE_FAILED' };
    }
    return { ok: true as const };
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  if (!serviceKey || !baseUrl) {
    return { ok: false as const, error: 'SERVER_ENV' };
  }

  const adminUrl = `${baseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`;
  const res = await fetch(adminUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ password: newPassword }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    console.error('Admin REST update failed', res.status, json);
    const message =
      json?.message ?? json?.error_description ?? (typeof json === 'string' ? json : null);
    return { ok: false as const, error: message ?? 'UPDATE_FAILED' };
  }

  return { ok: true as const };
}

async function listStaffByCourt(courtId: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('staff_profiles')
    .select('user_id, name_prefix, full_name, phone, is_active')
    .eq('court_id', courtId)
    .order('full_name', { ascending: true });

  if (error) {
    return { ok: false as const, error: error.message ?? 'LOOKUP_FAILED' };
  }

  const staff: StaffOption[] = (data ?? []).map((row) => ({
    userId: (row.user_id ?? '').trim(),
    namePrefix: (row.name_prefix ?? '').trim(),
    fullName: (row.full_name ?? '').trim(),
    phone: (row.phone ?? '').trim(),
    isActive: row.is_active !== false,
  }));

  return { ok: true as const, staff };
}

async function validateStaffUserInCourt(userId: string, courtId: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('staff_profiles')
    .select('user_id')
    .eq('user_id', userId)
    .eq('court_id', courtId)
    .limit(1)
    .maybeSingle();

  if (error) {
    return { ok: false as const, error: error.message ?? 'LOOKUP_FAILED' };
  }

  if (!data?.user_id) {
    return { ok: false as const, error: 'STAFF_NOT_FOUND' };
  }

  return { ok: true as const };
}

export async function POST(req: Request) {
  try {
    const secret = process.env.MANAGER_CREATOR_PASSPHRASE;
    if (!secret) {
      return NextResponse.json({ ok: false, error: 'SERVER_ENV' }, { status: 500 });
    }

    const body = (await req.json()) as Body;
    const mode = (body.mode ?? 'resetPassword').trim();
    const passphrase = (body.passphrase ?? '').trim();
    const newPassword = (body.newPassword ?? '').trim();
    const emailFromBody = (body.email ?? '').trim();
    const courtId = (body.courtId ?? '').trim();
    const userIdFromBody = (body.userId ?? '').trim();

    if (!passphrase) {
      return NextResponse.json({ ok: false, error: 'MISSING_PASSPHRASE' }, { status: 400 });
    }
    if (passphrase !== secret) {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
    }

    if (mode === 'listStaff') {
      if (!courtId) {
        return NextResponse.json({ ok: false, error: 'MISSING_COURT' }, { status: 400 });
      }

      const list = await listStaffByCourt(courtId);
      if (!list.ok) {
        return NextResponse.json({ ok: false, error: list.error }, { status: 500 });
      }

      return NextResponse.json({ ok: true, staff: list.staff });
    }

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ ok: false, error: 'INVALID_PASSWORD' }, { status: 400 });
    }

    let targetUserId = '';
    if (userIdFromBody) {
      if (courtId) {
        const check = await validateStaffUserInCourt(userIdFromBody, courtId);
        if (!check.ok) {
          const status = check.error === 'STAFF_NOT_FOUND' ? 404 : 500;
          return NextResponse.json({ ok: false, error: check.error }, { status });
        }
      }
      targetUserId = userIdFromBody;
    } else {
      let targetEmail = '';
      if (courtId) {
        targetEmail = normalizeEmail(`${courtId}@staff.local`);
      } else {
        const defaultEmail = process.env.MANAGER_ADMIN_EMAIL ?? '';
        targetEmail = normalizeEmail(emailFromBody || defaultEmail);
      }
      if (!targetEmail) {
        return NextResponse.json({ ok: false, error: 'MISSING_EMAIL' }, { status: 400 });
      }

      const userLookup = await findUserIdByEmail(targetEmail);
      if (!userLookup.ok) {
        return NextResponse.json({ ok: false, error: userLookup.error }, { status: 404 });
      }
      targetUserId = userLookup.userId;
    }

    const update = await updatePassword(targetUserId, newPassword);
    if (!update.ok) {
      return NextResponse.json({ ok: false, error: update.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Set password error', e);
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
