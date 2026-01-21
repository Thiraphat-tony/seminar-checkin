import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  passphrase?: string;
  newPassword?: string;
  email?: string;
  courtId?: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function findUserIdByEmail(email: string) {
  const supabase = createServerClient();
  const admin = (supabase as any)?.auth?.admin;

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
  const supabase = createServerClient();
  const admin = (supabase as any)?.auth?.admin;

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

export async function POST(req: Request) {
  try {
    const secret = process.env.MANAGER_CREATOR_PASSPHRASE;
    if (!secret) {
      return NextResponse.json({ ok: false, error: 'SERVER_ENV' }, { status: 500 });
    }

    const body = (await req.json()) as Body;
    const passphrase = (body.passphrase ?? '').trim();
    const newPassword = (body.newPassword ?? '').trim();
    const emailFromBody = (body.email ?? '').trim();
    const courtId = (body.courtId ?? '').trim();

    if (!passphrase) {
      return NextResponse.json({ ok: false, error: 'MISSING_PASSPHRASE' }, { status: 400 });
    }
    if (passphrase !== secret) {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
    }
    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ ok: false, error: 'INVALID_PASSWORD' }, { status: 400 });
    }

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

    const update = await updatePassword(userLookup.userId, newPassword);
    if (!update.ok) {
      return NextResponse.json({ ok: false, error: update.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Set password error', e);
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
