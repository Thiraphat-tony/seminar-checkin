import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { courtId, provinceKey, password } = await req.json();

  const key = String(courtId ?? provinceKey ?? "").trim().toLowerCase();
  const pass = String(password ?? "").trim();

  if (!key || !pass) {
    return NextResponse.json({ ok: false, message: "กรอกข้อมูลไม่ครบ" }, { status: 400 });
  }

  const email = `${key}@staff.local`;
  const supabase = await createServerClient();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });

  if (error || !data.session) {
    return NextResponse.json({ ok: false, message: "จังหวัดหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
