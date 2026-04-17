import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SLOT_ATTEMPTS = 20;

function courtIdToEmail(courtId: string, slot: number) {
  return slot > 0 ? `${courtId}+${slot}@staff.local` : `${courtId}@staff.local`;
}

type LoginBody = {
  courtId?: string;
  provinceKey?: string;
  password?: string;
};

export async function POST(req: Request) {
  try {
    const { courtId, provinceKey, password } = (await req.json()) as LoginBody;
    const key = String(courtId ?? provinceKey ?? "").trim().toLowerCase();
    const pass = String(password ?? "").trim();

    if (!key || !pass) {
      return NextResponse.json({ ok: false, message: "MISSING_INPUT" }, { status: 400 });
    }

    const adminClient = createServerClient();

    const { count: staffCount, error: staffCountError } = await adminClient
      .from("staff_profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("court_id", key);

    if (staffCountError) {
      return NextResponse.json({ ok: false, message: "SERVER_ERROR" }, { status: 500 });
    }

    if (!staffCount || staffCount <= 0) {
      return NextResponse.json({ ok: false, message: "STAFF_NOT_FOUND" }, { status: 404 });
    }

    const { data: court, error: courtError } = await adminClient
      .from("courts")
      .select("max_staff")
      .eq("id", key)
      .maybeSingle();

    if (courtError) {
      return NextResponse.json({ ok: false, message: "SERVER_ERROR" }, { status: 500 });
    }

    const rawMaxStaff = Number(court?.max_staff ?? 1);
    const maxStaff = Number.isFinite(rawMaxStaff) ? Math.max(1, Math.floor(rawMaxStaff)) : 1;
    const slotAttempts = Math.min(MAX_SLOT_ATTEMPTS, maxStaff);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ ok: false, message: "SERVER_ENV" }, { status: 500 });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    for (let slot = 0; slot < slotAttempts; slot += 1) {
      const email = courtIdToEmail(key, slot);
      const { data, error } = await authClient.auth.signInWithPassword({
        email,
        password: pass,
      });

      if (!error && data.session) {
        return NextResponse.json({
          ok: true,
          session: {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            user: {
              id: data.user?.id ?? data.session.user?.id ?? "",
              email: data.user?.email ?? data.session.user?.email ?? null,
            },
          },
        });
      }
    }

    return NextResponse.json({ ok: false, message: "INVALID_CREDENTIALS" }, { status: 401 });
  } catch (error) {
    console.error("staff/login error", error);
    return NextResponse.json({ ok: false, message: "SERVER_ERROR" }, { status: 500 });
  }
}
