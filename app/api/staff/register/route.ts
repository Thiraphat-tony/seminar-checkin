import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  provinceName: string;
  password: string;
  inviteCode?: string;
};

import { makeProvinceKey } from '@/lib/provinceKeys';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const provinceName = (body.provinceName ?? "").trim();
    const password = (body.password ?? "").trim();
    const inviteCode = (body.inviteCode ?? "").trim();

    if (!provinceName || !password) {
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

    const provinceKey = makeProvinceKey(provinceName);
    const email = `${provinceKey}@staff.local`;

    // ✅ เช็คว่า “จังหวัดนี้มีเจ้าหน้าที่แล้ว” หรือ “provinceKey ซ้ำ”
    const { data: existing, error: existErr } = await admin
      .from("staff_profiles")
      .select("id, province_name, province_key")
      .or(`province_name.eq.${provinceName},province_key.eq.${provinceKey}`)
      .maybeSingle();

    if (existErr) {
      return NextResponse.json({ ok: false, message: existErr.message }, { status: 500 });
    }
    if (existing) {
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

    // ✅ insert staff profile (unique province_name = กันซ้ำ)
    const { error: profErr } = await admin.from("staff_profiles").insert({
      user_id: created.user.id,
      province_name: provinceName,
      province_key: provinceKey,
      role: "staff",
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
