// app/api/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createServerClient } from '@/lib/supabaseServer';
import { requireStaffForApi } from '@/lib/requireStaffForApi';
import { phoneForStorage } from '@/lib/phone';
import { makeProvinceKey } from '@/lib/provinceKeys';

type ParticipantPayload = {
  namePrefix?: string;
  fullName: string;
  position: 'chief_judge' | 'associate_judge' | 'director' | 'other';
  positionOther?: string;
  phone: string;
  foodType: 'normal' | 'vegetarian' | 'halal';
  hotelName?: string;
  travelMode?: string;
  travelOther?: string;
};

const OTHER_HOTEL_VALUE = '__other__';
const OTHER_PREFIX_VALUE = '__other__';
const TRAVEL_MODE_VALUES = [
  'car',
  'van',
  'bus',
  'train',
  'plane',
  'motorcycle',
  'other',
] as const;

function makeSafeFilename(value: string) {
  const cleaned = makeProvinceKey(value)
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[\\/:"*?<>|]+/g, '')
    .replace(/\.+$/g, '');
  return cleaned || 'unknown';
}

function filterFilledParticipants(list: ParticipantPayload[]) {
  return list.filter(
    (p) => typeof p.fullName === 'string' && p.fullName.trim().length > 0,
  );
}

export async function GET() {
  const auth = await requireStaffForApi();
  if (!auth.ok) return auth.response;

  const EVENT_ID = process.env.EVENT_ID;
  if (!EVENT_ID) {
    return NextResponse.json({ ok: false, message: 'MISSING_EVENT_ID' }, { status: 500 });
  }

  const supabase = createServerClient();
  const { data: event, error } = await supabase
    .from('events')
    .select('id, registration_open')
    .eq('id', EVENT_ID)
    .maybeSingle();

  if (error || !event) {
    return NextResponse.json({ ok: false, message: 'EVENT_NOT_FOUND' }, { status: 500 });
  }

  let hasRegistration = false;
  try {
    if (auth.staff.role === 'super_admin') {
      hasRegistration = true;
    } else if (auth.staff.court_id) {
      const { data: existing, error: regErr } = await supabase
        .from('attendees')
        .select('id')
        .eq('event_id', EVENT_ID)
        .eq('court_id', auth.staff.court_id)
        .limit(1)
        .maybeSingle();

      if (!regErr && existing) hasRegistration = true;
    }
  } catch {
    hasRegistration = false;
  }

  return NextResponse.json({
    ok: true,
    registrationOpen: event.registration_open !== false,
    hasRegistration,
  });
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireStaffForApi(req);
    if (!auth.ok) return auth.response;

    const formData = await req.formData();

    const organization = (formData.get('organization') || '').toString().trim();
    const province = (formData.get('province') || '').toString().trim();
    let courtId = (formData.get('courtId') || '').toString().trim();
    const regionStr = (formData.get('region') || '').toString().trim();
    const hotelNameRaw = (formData.get('hotelName') || '').toString().trim();
    const hotelName = hotelNameRaw === OTHER_HOTEL_VALUE ? '' : hotelNameRaw;
    const totalAttendeesStr = (formData.get('totalAttendees') || '0')
      .toString()
      .trim();
    const participantsJson = (formData.get('participants') || '[]')
      .toString()
      .trim();
    const slip = formData.get('slip') as File | null;
    const coordinatorPrefix = (formData.get('coordinatorPrefix') || '')
      .toString()
      .trim();
    const coordinatorPrefixOther = (formData.get('coordinatorPrefixOther') || '')
      .toString()
      .trim();
    const coordinatorName = (formData.get('coordinatorName') || '')
      .toString()
      .trim();
    const coordinatorPhone = (formData.get('coordinatorPhone') || '')
      .toString()
      .trim();
    const fallbackTravelMode = (formData.get('travelMode') || '').toString().trim();
    const fallbackTravelOther = (formData.get('travelOther') || '').toString().trim();

    // normalize and validate phones
    const coordinatorPhoneNormalized = phoneForStorage(coordinatorPhone);

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
        { status: 400 },
      );
    }

    if (!organization) {
      return NextResponse.json(
        { ok: false, message: 'กรุณาเลือกหน่วยงาน / ศาล' },
        { status: 400 },
      );
    }

    if (!province) {
      return NextResponse.json(
        { ok: false, message: 'กรุณากรอกจังหวัด' },
        { status: 400 },
      );
    }

    if (auth.staff.role !== 'super_admin') {
      if (!auth.staff.court_id) {
        return NextResponse.json(
          { ok: false, message: 'ไม่พบข้อมูลศาลของบัญชีผู้ใช้' },
          { status: 403 },
        );
      }
      if (courtId && courtId !== auth.staff.court_id) {
        return NextResponse.json(
          { ok: false, message: 'ไม่สามารถลงทะเบียนแทนศาลอื่นได้' },
          { status: 403 },
        );
      }
      courtId = auth.staff.court_id;
    }

    if (!courtId) {
      return NextResponse.json(
        { ok: false, message: 'กรุณาเลือกศาล' },
        { status: 400 },
      );
    }

    const coordinatorPrefixResolved =
      coordinatorPrefixOther ||
      (coordinatorPrefix && coordinatorPrefix !== OTHER_PREFIX_VALUE ? coordinatorPrefix : '');

    if (!coordinatorPrefixResolved) {
      return NextResponse.json(
        { ok: false, message: 'กรุณาเลือกคำนำหน้าผู้ประสานงาน' },
        { status: 400 },
      );
    }

    // ถ้าอยากให้ backend บังคับผู้ประสานงานด้วย เปิดส่วนนี้ได้เลย
    if (!coordinatorName) {
      return NextResponse.json(
        { ok: false, message: 'กรุณากรอกชื่อ-สกุลผู้ประสานงาน' },
        { status: 400 },
      );
    }

    if (!coordinatorPhone) {
      return NextResponse.json(
        { ok: false, message: 'กรุณากรอกเบอร์โทรศัพท์ผู้ประสานงาน' },
        { status: 400 },
      );
    }

    if (!coordinatorPhoneNormalized) {
      return NextResponse.json(
        { ok: false, message: 'เบอร์โทรผู้ประสานงานต้องเป็นตัวเลข 10 หลัก' },
        { status: 400 },
      );
    }
    if (fallbackTravelMode) {
      const isValidFallbackTravelMode = TRAVEL_MODE_VALUES.includes(
        fallbackTravelMode as (typeof TRAVEL_MODE_VALUES)[number],
      );
      if (!isValidFallbackTravelMode) {
        return NextResponse.json(
          { ok: false, message: 'รูปแบบวิธีเดินทางไม่ถูกต้อง' },
          { status: 400 },
        );
      }
      if (fallbackTravelMode === "other" && !fallbackTravelOther) {
        return NextResponse.json(
          { ok: false, message: 'กรุณาระบุวิธีเดินทางอื่น ๆ' },
          { status: 400 },
        );
      }
    }

    let participants: ParticipantPayload[] = [];
    try {
      const parsed = JSON.parse(participantsJson);
      participants = Array.isArray(parsed) ? parsed : [];
    } catch {
      return NextResponse.json(
        { ok: false, message: 'รูปแบบข้อมูลผู้เข้าร่วมไม่ถูกต้อง' },
        { status: 400 },
      );
    }

    const filledParticipants = filterFilledParticipants(participants);

    if (filledParticipants.length === 0) {
      return NextResponse.json(
        { ok: false, message: 'ต้องมีผู้เข้าร่วมอย่างน้อย 1 คน' },
        { status: 400 },
      );
    }

    if (!participants[0].fullName?.trim()) {
      return NextResponse.json(
        { ok: false, message: 'กรุณากรอกชื่อผู้เข้าร่วมคนที่ 1' },
        { status: 400 },
      );
    }

    const missingPrefixIndex = filledParticipants.findIndex((p) => {
      const prefix = typeof p.namePrefix === 'string' ? p.namePrefix.trim() : '';
      return !prefix || prefix === OTHER_PREFIX_VALUE;
    });
    if (missingPrefixIndex >= 0) {
      return NextResponse.json(
        {
          ok: false,
          message: `กรุณาเลือกคำนำหน้าผู้เข้าร่วมคนที่ ${missingPrefixIndex + 1}`,
        },
        { status: 400 },
      );
    }
    if (!hotelName) {
      const missingHotelIndex = filledParticipants.findIndex(
        (p) => {
          const name = typeof p.hotelName === 'string' ? p.hotelName.trim() : '';
          return !name || name === OTHER_HOTEL_VALUE;
        },
      );
      if (missingHotelIndex >= 0) {
        return NextResponse.json(
          {
            ok: false,
            message: `กรุณาเลือกโรงแรมของผู้เข้าร่วมคนที่ ${missingHotelIndex + 1}`,
          },
          { status: 400 },
        );
      }
    }

    const missingPositionOtherIndex = filledParticipants.findIndex((p) => {
      const position = typeof p.position === 'string' ? p.position.trim() : '';
      if (position !== 'other') return false;
      return !(p.positionOther ?? '').trim();
    });
    if (missingPositionOtherIndex >= 0) {
      return NextResponse.json(
        {
          ok: false,
          message: `กรุณาระบุตำแหน่งอื่น ๆ ของผู้เข้าร่วมคนที่ ${missingPositionOtherIndex + 1}`
        },
        { status: 400 },
      );
    }

    const missingTravelModeIndex = filledParticipants.findIndex((p) => {
      const rawMode = typeof p.travelMode === 'string' ? p.travelMode.trim() : '';
      const mode = rawMode || fallbackTravelMode;
      return !mode;
    });
    if (missingTravelModeIndex >= 0) {
      return NextResponse.json(
        {
          ok: false,
          message: `กรุณาเลือกวิธีเดินทางของผู้เข้าร่วมคนที่ ${missingTravelModeIndex + 1}`
        },
        { status: 400 },
      );
    }

    const invalidTravelModeIndex = filledParticipants.findIndex((p) => {
      const rawMode = typeof p.travelMode === 'string' ? p.travelMode.trim() : '';
      const mode = rawMode || fallbackTravelMode;
      return (
        !!mode &&
        !TRAVEL_MODE_VALUES.includes(mode as (typeof TRAVEL_MODE_VALUES)[number])
      );
    });
    if (invalidTravelModeIndex >= 0) {
      return NextResponse.json(
        {
          ok: false,
          message: `วิธีเดินทางของผู้เข้าร่วมคนที่ ${invalidTravelModeIndex + 1} ไม่ถูกต้อง`
        },
        { status: 400 },
      );
    }

    const missingTravelOtherIndex = filledParticipants.findIndex((p) => {
      const rawMode = typeof p.travelMode === 'string' ? p.travelMode.trim() : '';
      const mode = rawMode || fallbackTravelMode;
      const rawOther = typeof p.travelOther === 'string' ? p.travelOther.trim() : '';
      const other = rawOther || fallbackTravelOther;
      return mode === 'other' && !other;
    });
    if (missingTravelOtherIndex >= 0) {
      return NextResponse.json(
        {
          ok: false,
          message: `กรุณาระบุวิธีเดินทางอื่น ๆ ของผู้เข้าร่วมคนที่ ${missingTravelOtherIndex + 1}`
        },
        { status: 400 },
      );
    }

    const EVENT_ID = process.env.EVENT_ID;
    if (!EVENT_ID) {
      return NextResponse.json(
        { ok: false, message: 'ยังไม่ได้ตั้งค่า EVENT_ID ใน Environment' },
        { status: 500 },
      );
    }

    const supabase = createServerClient();

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, registration_open')
      .eq('id', EVENT_ID)
      .maybeSingle();

    if (eventError || !event) {
      return NextResponse.json({ ok: false, message: 'EVENT_NOT_FOUND' }, { status: 500 });
    }

    if (event.registration_open === false) {
      return NextResponse.json({ ok: false, message: 'REGISTRATION_CLOSED' }, { status: 403 });
    }

    const { data: court, error: courtError } = await supabase
      .from('courts')
      .select('id')
      .eq('id', courtId)
      .maybeSingle();

    if (courtError || !court) {
      return NextResponse.json(
        { ok: false, message: 'ไม่พบศาลที่เลือก' },
        { status: 400 },
      );
    }

    let slipUrl: string | null = null;

    // ---------- อัปโหลดไฟล์สลิป (ถ้ามี) ----------
    if (slip) {
      console.log('[Register] Starting upload for:', slip.name);

      const ext = slip.name.split('.').pop() || 'bin';
      const safeProvince = makeSafeFilename(province);
      const slipId = randomUUID();
      const filePath = `slips/${safeProvince}/${slipId}.${ext}`;

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
          { status: 500 },
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
    const rows = filledParticipants.map((p) => {
      const rawPositionOther = typeof p.positionOther === 'string' ? p.positionOther.trim() : '';
      const jobPosition =
        p.position === 'other'
          ? rawPositionOther
          : p.position === 'chief_judge'
            ? 'ผู้พิพากษาหัวหน้าศาล'
            : p.position === 'director'
              ? 'ผู้อำนวยการ'
              : 'ผู้พิพากษาสมทบ';

      const rawTravelMode = typeof p.travelMode === 'string' ? p.travelMode.trim() : '';
      const travelModeResolved = rawTravelMode || fallbackTravelMode;
      const rawTravelOther = typeof p.travelOther === 'string' ? p.travelOther.trim() : '';
      const travelOtherResolved =
        travelModeResolved === 'other' ? rawTravelOther || fallbackTravelOther || null : null;

      const foodType = p.foodType || 'normal';

      const normalizedParticipantPhone = phoneForStorage(p.phone);
      const rawPrefix = typeof p.namePrefix === 'string' ? p.namePrefix.trim() : '';
      const normalizedPrefix = rawPrefix === OTHER_PREFIX_VALUE ? '' : rawPrefix;
      const rawHotelName = typeof p.hotelName === 'string' ? p.hotelName.trim() : '';
      const cleanedHotelName = rawHotelName === OTHER_HOTEL_VALUE ? '' : rawHotelName;
      const normalizedHotelName = cleanedHotelName || hotelName || null;

      return {
        event_id: EVENT_ID,
        court_id: courtId,
        name_prefix: normalizedPrefix || null,
        full_name: p.fullName,
        phone: normalizedParticipantPhone || null,
        organization,
        job_position: jobPosition || null,
        province,
        region, // 0–9 (0 = ศาลเยาวชนกลาง)
        ticket_token: randomUUID(), // ใช้ uuid เป็น token
        qr_image_url: null,
        slip_url: slipUrl,
        food_type: foodType,
        travel_mode: travelModeResolved,
        travel_other: travelOtherResolved,
        coordinator_prefix_other: coordinatorPrefixResolved || null,
        coordinator_name: coordinatorName || null,
        coordinator_phone: coordinatorPhoneNormalized || null,
        hotel_name: normalizedHotelName,
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
        { status: 500 },
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
      { status: 200 },
    );
  } catch (error) {
    console.error('[Register] Unexpected error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { ok: false, message: `เกิดข้อผิดพลาด: ${errorMessage}` },
      { status: 500 },
    );
  }
}
