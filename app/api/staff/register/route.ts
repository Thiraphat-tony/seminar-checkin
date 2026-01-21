import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { phoneForStorage } from "@/lib/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPER_ADMIN_COURT_NAME = "ศาลเยาวชนและครอบครัวจังหวัดสุราษฎร์ธานี";

type Body = {
  courtId: string;
  namePrefix?: string;
  phone: string;
  password: string;
  inviteCode?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const courtId = (body.courtId ?? "").trim();
    const namePrefix = typeof body.namePrefix === "string" ? body.namePrefix.trim() : "";
    const phone = (body.phone ?? "").trim();
    const password = (body.password ?? "").trim();
    const inviteCode = (body.inviteCode ?? "").trim();

    const normalizedPhone = phoneForStorage(phone);

    if (!courtId || !password || !normalizedPhone) {
      return NextResponse.json({ ok: false, message: "ข้อมูลไม่ครบ" }, { status: 400 });
    }

    // ✅ กันสมัครมั่ว (ถ้าตั้งค่าไว้)
    const NEED_CODE = process.env.STAFF_INVITE_CODE;
    if (NEED_CODE && inviteCode !== NEED_CODE) {
      return NextResponse.json({ ok: false, message: "รหัสเชิญไม่ถูกต้อง" }, { status: 403 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!url || !serviceKey) {
      return NextResponse.json({ ok: false, message: "Server env ไม่ครบ" }, { status: 500 });
    }

    const admin = createClient(url, serviceKey);

    const email = `${courtId}@staff.local`;

    const { data: court, error: courtErr } = await admin
      .from("courts")
      .select("id, court_name, max_staff")
      .eq("id", courtId)
      .maybeSingle();

    if (courtErr || !court) {
      return NextResponse.json({ ok: false, message: "ไม่พบศาลที่เลือก" }, { status: 404 });
    }

    const maxStaff =
      typeof court.max_staff === "number" && court.max_staff > 0
        ? court.max_staff
        : 1;

    const { count: staffCount, error: countErr } = await admin
      .from("staff_profiles")
      .select("id", { count: "exact", head: true })
      .eq("court_id", courtId);

    if (countErr) {
      return NextResponse.json({ ok: false, message: countErr.message }, { status: 500 });
    }

    if ((staffCount ?? 0) >= maxStaff) {
      return NextResponse.json(
        { ok: false, message: "ศาลนี้มีผู้ดูแลครบตามโควตาแล้ว" },
        { status: 409 }
      );
    }

    // ✅ เช็คว่า “ศาลนี้มีเจ้าหน้าที่แล้ว”
    const { data: existing, error: existErr } = await admin
      .from("staff_profiles")
      .select("id, court_id")
      .eq("court_id", courtId)
      .maybeSingle();

    if (existErr) {
      return NextResponse.json({ ok: false, message: existErr.message }, { status: 500 });
    }
    if (false && existing) {
      return NextResponse.json(
        { ok: false, message: "จังหวัดนี้มีเจ้าหน้าที่แล้ว (1 จังหวัดสมัครได้ 1 คน)" },
        { status: 409 }
      );
    }

    // ✅ สร้าง user ใน Supabase Auth
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createErr || !created.user) {
      return NextResponse.json(
        { ok: false, message: createErr?.message ?? "สร้างผู้ใช้ไม่สำเร็จ" },
        { status: 500 }
      );
    }

    const role =
      court.court_name === SUPER_ADMIN_COURT_NAME ? "super_admin" : "staff";

    // ✅ insert staff profile
    const { error: profErr } = await admin.from("staff_profiles").insert({
      user_id: created.user.id,
      court_id: courtId,
      name_prefix: namePrefix || null,
      phone: normalizedPhone,
      role,
    });

    // ถ้า insert ไม่ผ่าน ลบ user ทิ้งเพื่อไม่ให้ค้าง
    if (profErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      const msg =
        profErr.message.includes("duplicate") || profErr.message.includes("unique")
          ? "จังหวัดนี้มีเจ้าหน้าที่แล้ว (1 จังหวัดสมัครได้ 1 คน)"
          : profErr.message;

      return NextResponse.json({ ok: false, message: msg }, { status: 409 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
