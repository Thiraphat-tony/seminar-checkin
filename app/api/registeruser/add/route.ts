// app/api/registeruser/add/route.ts
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
  const raw = value.trim();
  if (!raw) return 'unknown';

  const normalizedProvince = raw.replace(/\s*\([^)]*\)\s*$/, '').trim() || raw;

  const cleaned = makeProvinceKey(normalizedProvince)
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[\\/:"*?<>|]+/g, '')
    .replace(/\.+$/g, '');

  if (/^[A-Za-z0-9_-]+$/.test(cleaned)) {
    return cleaned.toLowerCase();
  }

  const encoded = encodeURIComponent(raw)
    .replace(/%/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '')
    .toLowerCase();

  return encoded.slice(0, 64) || 'unknown';
}

function filterFilledParticipants(list: ParticipantPayload[]) {
  return list.filter(
    (p) => typeof p.fullName === 'string' && p.fullName.trim().length > 0,
  );
}

function resolveFileExt(file: Blob, fileName = '') {
  const extFromName = fileName.trim().split('.').pop()?.toLowerCase();
  if (extFromName && /^[a-z0-9]{1,10}$/.test(extFromName)) {
    return extFromName;
  }

  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  };
  return mimeToExt[file.type] ?? 'bin';
}

async function uploadSlipFile(params: {
  supabase: ReturnType<typeof createServerClient>;
  file: Blob;
  fileName: string;
  province: string;
  pathPrefix: string;
}) {
  const { supabase, file, fileName, province, pathPrefix } = params;

  const ext = resolveFileExt(file, fileName);
  const safeProvince = makeSafeFilename(province);
  const filePath = `slips/${safeProvince}/${pathPrefix}-${randomUUID()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from('slips')
    .upload(filePath, bytes, {
      contentType: file.type || 'application/octet-stream',
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: publicUrlData } = supabase.storage.from('slips').getPublicUrl(filePath);
  return publicUrlData.publicUrl;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireStaffForApi(req);
    if (!auth.ok) return auth.response;

    const formData = await req.formData();

    const participantsJson = (formData.get('participants') || '[]').toString().trim();
    const slip = formData.get('slip') as File | null;
    const hasCombinedSlip = slip instanceof File && slip.size > 0;

    const participantSlips = new Map<number, File>();
    for (const [key, value] of formData.entries()) {
      if (!key.startsWith('participantSlip_')) continue;
      if (!(value instanceof File)) continue;
      if (value.size <= 0) continue;
      const index = Number.parseInt(key.replace('participantSlip_', ''), 10);
      if (!Number.isInteger(index) || index < 0) continue;
      participantSlips.set(index, value);
    }

    let courtId = auth.staff.court_id;

    if (!courtId) {
      return NextResponse.json(
        { ok: false, message: 'ไม่พบข้อมูลศาลของบัญชีผู้ใช้' },
        { status: 403 },
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

    // ตรวจสอบว่าศาลนี้ลงทะเบียนแล้วหรือยัง
    const { data: existingAttendees, error: existingError } = await supabase
      .from('attendees')
      .select('organization, province, region, coordinator_prefix_other, coordinator_name, coordinator_phone')
      .eq('event_id', EVENT_ID)
      .eq('court_id', courtId)
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error('[RegisterAdd] Existing registration check error:', existingError);
      return NextResponse.json(
        { ok: false, message: 'FAILED_TO_CHECK_EXISTING_REGISTRATION' },
        { status: 500 },
      );
    }

    if (!existingAttendees) {
      return NextResponse.json(
        { ok: false, message: 'NOT_REGISTERED_YET' },
        { status: 400 },
      );
    }

    const organization = existingAttendees.organization;
    const province = existingAttendees.province;
    const region = existingAttendees.region;
    const coordinatorPrefixResolved = existingAttendees.coordinator_prefix_other || '';
    const coordinatorName = existingAttendees.coordinator_name || '';
    const coordinatorPhoneNormalized = existingAttendees.coordinator_phone || '';

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

    const invalidTravelModeIndex = filledParticipants.findIndex((p) => {
      const mode = typeof p.travelMode === 'string' ? p.travelMode.trim() : '';
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
      const mode = typeof p.travelMode === 'string' ? p.travelMode.trim() : '';
      const other = typeof p.travelOther === 'string' ? p.travelOther.trim() : '';
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

    const hasAnyParticipantSlip = Array.from(participantSlips.keys()).some(
      (index) => index >= 0 && index < filledParticipants.length,
    );

    if (!hasCombinedSlip && !hasAnyParticipantSlip) {
      return NextResponse.json(
        {
          ok: false,
          message: 'กรุณาแนบหลักฐานอย่างน้อย 1 แบบ (รายบุคคล หรือสลิปรวม)',
        },
        { status: 400 },
      );
    }

    // validate participant phones
    for (let idx = 0; idx < participants.length; idx++) {
      const p = participants[idx];
      if (!p.fullName.trim()) continue;

      const rawPhone = (p.phone ?? '').trim();
      if (!rawPhone) continue;

      const { normalizePhone, isValidPhone } = await import('@/lib/phone');
      const n = normalizePhone(rawPhone);
      if (!isValidPhone(n)) {
        return NextResponse.json(
          {
            ok: false,
            message: `เบอร์โทรของผู้เข้าร่วมคนที่ ${idx + 1} ต้องเป็นตัวเลข 10 หลัก`,
          },
          { status: 400 },
        );
      }
    }

    let combinedSlipUrl: string | null = null;
    const participantSlipUrlByIndex = new Map<number, string>();

    // อัปโหลดไฟล์สลิปรวม
    if (hasCombinedSlip && slip) {
      console.log('[RegisterAdd] Starting upload for combined slip:', slip.name);

      combinedSlipUrl = await uploadSlipFile({
        supabase,
        file: slip,
        fileName: slip.name,
        province,
        pathPrefix: 'additional-combined',
      });

      console.log('[RegisterAdd] Combined slip upload successful');
    }

    // อัปโหลดไฟล์สลิปรายบุคคล
    try {
      for (const [index, participantSlip] of participantSlips.entries()) {
        if (index < 0 || index >= filledParticipants.length) continue;
        const uploadedUrl = await uploadSlipFile({
          supabase,
          file: participantSlip,
          fileName: participantSlip.name,
          province,
          pathPrefix: `additional-participant-${index + 1}`,
        });
        participantSlipUrlByIndex.set(index, uploadedUrl);
      }
      console.log('[RegisterAdd] Participant slip uploads:', participantSlipUrlByIndex.size);
    } catch (uploadError) {
      console.error('[RegisterAdd] Participant slip upload error:', uploadError);
      return NextResponse.json(
        {
          ok: false,
          message: `อัปโหลดไฟล์สลิปรายบุคคลไม่สำเร็จ: ${
            uploadError instanceof Error ? uploadError.message : 'unknown error'
          }`,
        },
        { status: 500 },
      );
    }

    const rows = filledParticipants.map((p, index) => {
      const rawPositionOther = typeof p.positionOther === 'string' ? p.positionOther.trim() : '';
      const jobPosition =
        p.position === 'other'
          ? rawPositionOther
          : p.position === 'chief_judge'
            ? 'ผู้พิพากษาหัวหน้าศาล'
            : p.position === 'director'
              ? 'ผู้อำนวยการ'
              : 'ผู้พิพากษาสมทบ';

      const travelModeResolved = typeof p.travelMode === 'string' ? p.travelMode.trim() || null : null;
      const rawTravelOther = typeof p.travelOther === 'string' ? p.travelOther.trim() : '';
      const travelOtherResolved = travelModeResolved === 'other' ? rawTravelOther || null : null;

      const foodType = p.foodType || 'normal';

      const normalizedParticipantPhone = phoneForStorage(p.phone);
      const rawPrefix = typeof p.namePrefix === 'string' ? p.namePrefix.trim() : '';
      const normalizedPrefix = rawPrefix === OTHER_PREFIX_VALUE ? '' : rawPrefix;
      const rawHotelName = typeof p.hotelName === 'string' ? p.hotelName.trim() : '';
      const cleanedHotelName = rawHotelName === OTHER_HOTEL_VALUE ? '' : rawHotelName;

      return {
        event_id: EVENT_ID,
        court_id: courtId,
        name_prefix: normalizedPrefix || null,
        full_name: p.fullName,
        phone: normalizedParticipantPhone || null,
        organization,
        job_position: jobPosition || null,
        province,
        region,
        ticket_token: randomUUID(),
        qr_image_url: null,
        slip_url: participantSlipUrlByIndex.get(index) ?? combinedSlipUrl,
        food_type: foodType,
        travel_mode: travelModeResolved,
        travel_other: travelOtherResolved,
        coordinator_prefix_other: coordinatorPrefixResolved || null,
        coordinator_name: coordinatorName || null,
        coordinator_phone: coordinatorPhoneNormalized || null,
        hotel_name: cleanedHotelName || null,
      };
    });

    console.log('[RegisterAdd] Inserting rows:', rows.length);

    const { error: insertError } = await supabase
      .from('attendees')
      .insert(rows);

    if (insertError) {
      console.error('[RegisterAdd] Insert error:', insertError);
      return NextResponse.json(
        {
          ok: false,
          message: `บันทึกข้อมูลผู้เข้าร่วมไม่สำเร็จ: ${insertError.message}`,
        },
        { status: 500 },
      );
    }

    console.log('[RegisterAdd] Insert successful');

    return NextResponse.json(
      {
        ok: true,
        message: 'เพิ่มผู้เข้าร่วมเรียบร้อยแล้ว',
        count: rows.length,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[RegisterAdd] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { ok: false, message: `เกิดข้อผิดพลาด: ${errorMessage}` },
      { status: 500 },
    );
  }
}
