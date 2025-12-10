// app/api/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createServerClient } from '@/lib/supabaseServer';

type ParticipantPayload = {
  fullName: string;
  position: 'chief_judge' | 'associate_judge';
  phone: string;
  foodType:
    | 'normal'
    | 'no_pork'
    | 'vegetarian'
    | 'vegan'
    | 'halal'
    | 'seafood_allergy'
    | 'other';
  // ✅ รองรับข้อความระบุอาหารอื่น ๆ
  foodOther?: string;
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const organization = (formData.get('organization') || '').toString().trim();
    const province = (formData.get('province') || '').toString().trim();
    const regionStr = (formData.get('region') || '').toString().trim();
    const hotelName = (formData.get('hotelName') || '').toString().trim();
    const totalAttendeesStr = (formData.get('totalAttendees') || '0')
      .toString()
      .trim();
    const participantsJson = (formData.get('participants') || '[]')
      .toString()
      .trim();
    const slip = formData.get('slip') as File | null;
    const coordinatorName = (formData.get('coordinatorName') || '')
      .toString()
      .trim();

    // ✅ แปลง region เป็นตัวเลข (รองรับ 0–9 โดย 0 = ศาลเยาวชนและครอบครัวกลาง)
    const region = Number.parseInt(regionStr, 10);
    const totalAttendees = Number.parseInt(totalAttendeesStr || '0', 10) || 0;

    if (Number.isNaN(region) || region < 0 || region > 9) {
      return NextResponse.json(
        {
          ok: false,
          message:
            'สังกัดภาคไม่ถูกต้อง (ต้องเป็น 0–9 โดย 0 = ศาลเยาวชนและครอบครัวกลาง)',
        },
        { status: 400 }
      );
    }

    if (!organization) {
      return NextResponse.json(
        { ok: false, message: 'กรุณาเลือกหน่วยงาน / ศาล' },
        { status: 400 }
      );
    }

    if (!province) {
      return NextResponse.json(
        { ok: false, message: 'กรุณากรอกจังหวัด' },
        { status: 400 }
      );
    }

    // ✅ เพิ่ม validation โรงแรมฝั่ง backend ให้ตรงกับฟอร์มหน้าเว็บ
    if (!hotelName) {
      return NextResponse.json(
        { ok: false, message: 'กรุณาเลือกโรงแรมที่พัก' },
        { status: 400 }
      );
    }

    // ถ้าจะบังคับ coordinatorName ฝั่ง backend ด้วยก็ทำได้ (ทาง frontend บังคับแล้ว)
    // if (!coordinatorName) {
    //   return NextResponse.json(
    //     { ok: false, message: 'กรุณากรอกชื่อ-สกุลผู้ประสานงาน' },
    //     { status: 400 }
    //   );
    // }

    // ทำให้สลิปเป็น optional ชั่วคราว (ถ้าจะบังคับก็เอา comment ออก)
    // if (!slip) {
    //   return NextResponse.json(
    //     { ok: false, message: 'กรุณาแนบไฟล์หลักฐานค่าลงทะเบียน' },
    //     { status: 400 }
    //   );
    // }

    let participants: ParticipantPayload[] = [];
    try {
      participants = JSON.parse(participantsJson);
    } catch {
      return NextResponse.json(
        { ok: false, message: 'รูปแบบข้อมูลผู้เข้าร่วมไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    if (!participants || participants.length === 0) {
      return NextResponse.json(
        { ok: false, message: 'ต้องมีผู้เข้าร่วมอย่างน้อย 1 คน' },
        { status: 400 }
      );
    }

    if (!participants[0].fullName?.trim()) {
      return NextResponse.json(
        { ok: false, message: 'กรุณากรอกชื่อผู้เข้าร่วมคนที่ 1' },
        { status: 400 }
      );
    }

    const EVENT_ID = process.env.EVENT_ID;
    if (!EVENT_ID) {
      return NextResponse.json(
        { ok: false, message: 'ยังไม่ได้ตั้งค่า EVENT_ID ใน Environment' },
        { status: 500 }
      );
    }

    const supabase = createServerClient();

    let slipUrl: string | null = null;

    // ---------- อัปโหลดไฟล์สลิป (ถ้ามี) ----------
    if (slip) {
      console.log('[Register] Starting upload for:', slip.name);

      const ext = slip.name.split('.').pop() || 'bin';
      const filePath = `slips/${Date.now()}-${randomUUID()}.${ext}`;

      const arrayBuffer = await slip.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      console.log('[Register] Uploading to:', filePath);

      const { error: uploadError } = await supabase.storage
        .from('slips')
        .upload(filePath, bytes, {
          contentType: slip.type || 'application/octet-stream',
        });

      if (uploadError) {
        console.error('[Register] Upload error:', uploadError);
        return NextResponse.json(
          {
            ok: false,
            message: `อัปโหลดไฟล์สลิปไม่สำเร็จ: ${uploadError.message}`,
          },
          { status: 500 }
        );
      }

      console.log('[Register] Upload successful');

      const { data: publicUrlData } = supabase.storage
        .from('slips')
        .getPublicUrl(filePath);

      slipUrl = publicUrlData.publicUrl;
    } else {
      console.log('[Register] No slip file provided, skipping upload');
    }

    // ---------- เตรียม data สำหรับ insert ----------
    const rows = participants.map((p) => {
      const jobPosition =
        p.position === 'chief_judge'
          ? 'ผู้พิพากษาหัวหน้าศาลฯ'
          : 'ผู้พิพากษาสมทบ';

      // ✅ รองรับข้อความอาหารอื่น ๆ จาก payload (ถ้ามี)
      const rawFoodOther =
        typeof (p as any).foodOther === 'string'
          ? (p as any).foodOther.trim()
          : '';

      const foodType = p.foodType || 'normal';

      return {
        event_id: EVENT_ID,
        full_name: p.fullName,
        phone: p.phone || null,
        organization,
        job_position: jobPosition,
        province,
        region, // 0–9 (0 = ศาลเยาวชนกลาง)
        ticket_token: randomUUID(), // ใช้ uuid เป็น token
        qr_image_url: null,
        slip_url: slipUrl,
        food_type: foodType,
        food_other:
          foodType === 'other' && rawFoodOther.length > 0
            ? rawFoodOther
            : null,
        coordinator_name: coordinatorName || null,
        hotel_name: hotelName || null,
      };
    });

    console.log('[Register] Inserting rows:', rows.length);

    const { error: insertError } = await supabase
      .from('attendees')
      .insert(rows);

    if (insertError) {
      console.error('[Register] Insert error:', insertError);
      return NextResponse.json(
        {
          ok: false,
          message: `บันทึกข้อมูลผู้เข้าร่วมไม่สำเร็จ: ${insertError.message}`,
        },
        { status: 500 }
      );
    }

    console.log('[Register] Insert successful');

    return NextResponse.json(
      {
        ok: true,
        message: 'บันทึกข้อมูลการลงทะเบียนเรียบร้อย',
        count: rows.length,
        totalAttendees: totalAttendees || rows.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Register] Unexpected error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { ok: false, message: `เกิดข้อผิดพลาด: ${errorMessage}` },
      { status: 500 }
    );
  }
}
