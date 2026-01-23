// app/api/admin/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { createServerClient } from '@/lib/supabaseServer';
import { phoneForStorage } from '@/lib/phone';

// ให้ตรง constraint ใน DB (รองรับหลายแบบ)
type FoodType =
  | 'normal'
  | 'no_pork'
  | 'vegetarian'
  | 'vegan'
  | 'halal'
  | 'seafood_allergy'
  | 'other';

// row ที่เตรียมแล้วสำหรับใส่ใน attendees
type PreparedRow = {
  event_id: string | null;
  court_id: string | null;
  name_prefix: string | null;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  ticket_token: string;
  phone: string | null;
  organization: string | null;
  job_position: string | null;
  province: string | null;
  region: number | null; // 0–9 (0 = ศาลกลาง)
  qr_image_url: string | null;
  slip_url: string | null;
  food_type: FoodType | null;
  travel_mode: string | null;
  travel_other: string | null;
  coordinator_prefix_other: string | null;
  coordinator_name: string | null;
  coordinator_phone: string | null;
  hotel_name: string | null;
  checkin_round1_at: string | null;
  checkin_round2_at: string | null;
  checkin_round3_at: string | null;
};

// raw row จาก Excel
type RawMappedRow = Partial<Record<keyof PreparedRow, any>>;

// แปลงค่าจาก Excel → food_type ที่ใช้ใน DB
function normalizeFoodType(value: any): FoodType | null {
  if (value == null) return null;

  const s = String(value).trim().toLowerCase();
  if (!s) return null;

  switch (s) {
    // อาหารทั่วไป
    case 'normal':
    case 'ทั่วไป':
    case 'อาหารทั่วไป':
    case 'ปกติ':
      return 'normal';

    // มังสวิรัติ
    case 'vegetarian':
    case 'มังสวิรัติ':
    case 'มังสะวิรัติ':
    case 'มังฯ':
      return 'vegetarian';

    // เจ/วีแกน
    case 'vegan':
    case 'เจ':
    case 'อาหารเจ':
    case 'วีแกน':
      return 'vegan';

    // ไม่ทานหมู
    case 'no_pork':
    case 'ไม่ทานหมู':
    case 'ไม่กินหมู':
    case 'งดหมู':
      return 'no_pork';

    // แพ้อาหารทะเล
    case 'seafood_allergy':
    case 'แพ้อาหารทะเล':
    case 'แพ้อาหารทะเล/ซีฟู้ด':
    case 'แพ้ซีฟู้ด':
      return 'seafood_allergy';

    // อื่น ๆ
    case 'other':
    case 'อื่น':
    case 'อื่นๆ':
    case 'อื่น ๆ':
      return 'other';

    // ฮาลาล / อิสลาม
    case 'halal':
    case 'ฮาลาล':
    case 'อิสลาม':
    case 'อาหารอิสลาม':
    case 'มุสลิม':
      return 'halal';

    default:
      // ถ้าไม่รู้จัก แต่มีค่ามา → ให้ลงเป็นอาหารทั่วไป จะได้ไม่ชน constraint
      return 'normal';
  }
}

function normalizeHeader(header: string) {
  return header
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim();
}

function normalizeTravelMode(
  value: any,
  otherValue: any,
): { mode: string | null; other: string | null } {
  const raw = value == null ? '' : String(value).trim();
  const rawOther = otherValue == null ? '' : String(otherValue).trim();

  if (!raw) {
    if (rawOther) return { mode: 'other', other: rawOther };
    return { mode: null, other: null };
  }

  const normalized = raw.toLowerCase();
  const map: Record<string, string> = {
    car: 'car',
    'รถยนต์ส่วนตัว': 'car',
    van: 'van',
    'รถตู้': 'van',
    bus: 'bus',
    'รถบัส': 'bus',
    train: 'train',
    'รถไฟ': 'train',
    plane: 'plane',
    'เครื่องบิน': 'plane',
    motorcycle: 'motorcycle',
    'รถจักรยานยนต์': 'motorcycle',
    'มอเตอร์ไซค์': 'motorcycle',
    other: 'other',
    'อื่น': 'other',
    'อื่นๆ': 'other',
    'อื่น ๆ': 'other',
  };

  const resolved = map[normalized] ?? map[raw] ?? null;
  if (resolved && resolved !== 'other') {
    return { mode: resolved, other: null };
  }
  if (resolved === 'other') {
    const fallback = rawOther || (raw !== 'other' ? raw : '');
    return { mode: 'other', other: fallback || null };
  }

  // หากไม่รู้จักค่า ให้เก็บใน other เพื่อไม่ให้ข้อมูลหาย
  return { mode: 'other', other: rawOther || raw || null };
}

function normalizeTimestamp(value: any): string | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  const str = String(value).trim();
  if (!str) return null;
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

const HEADER_ALIAS_MAP: Record<string, keyof PreparedRow> = (() => {
  const map: Record<string, keyof PreparedRow> = {};
  const add = (key: keyof PreparedRow, aliases: string[]) => {
    for (const alias of aliases) {
      const normalized = normalizeHeader(alias);
      if (normalized) map[normalized] = key;
    }
  };

  add('full_name', [
    'full_name',
    'full name',
    'fullname',
    'ชื่อ-สกุล',
    'ชื่อสกุล',
    'ชื่อ-นามสกุล',
    'ชื่อ–นามสกุล',
    'ชื่อ นามสกุล',
    'ชื่อนามสกุล',
    'ชื่อ/นามสกุล',
    'ชื่อผู้เข้าร่วม',
    'ชื่อผู้ลงทะเบียน',
    'ชื่อและนามสกุล',
    'ชื่อ',
  ]);
  add('first_name', [
    'first_name',
    'first name',
    'firstname',
    'ชื่อ',
    'ชื่อจริง',
    'ชื่อผู้เข้าร่วม',
  ]);
  add('last_name', [
    'last_name',
    'last name',
    'lastname',
    'surname',
    'นามสกุล',
    'ชื่อสกุล',
  ]);
  add('name_prefix', [
    'name_prefix',
    'prefix',
    'คำนำหน้า',
    'คำนำหน้าชื่อ',
    'title',
  ]);
  add('ticket_token', [
    'ticket_token',
    'ticket token',
    'token',
    'ticket',
    'qr token',
    'qr code',
    'qrcode',
    'qr_code',
    'ticket id',
    'ticketid',
    'token id',
    'tokenอ่านอย่างเดียว',
    'โทเคน',
    'หมายเลขบัตร',
    'หมายเลขตั๋ว',
    'รหัสบัตร',
    'รหัสบัตรtoken',
    'รหัสตั๋ว',
  ]);
  add('phone', [
    'phone',
    'phone_number',
    'phone number',
    'mobile',
    'mobile_phone',
    'tel',
    'telephone',
    'เบอร์โทร',
    'เบอร์โทรศัพท์',
    'โทรศัพท์',
    'เบอร์มือถือ',
  ]);
  add('slip_url', [
    'slip_url',
    'slip url',
    'slip',
    'สลิป',
    'หลักฐานการชำระเงิน',
  ]);
  add('organization', [
    'organization',
    'org',
    'หน่วยงาน',
    'หน่วยงานต้นสังกัด',
    'ต้นสังกัด',
    'องค์กร',
    'หน่วยงาน/องค์กร',
  ]);
  add('job_position', [
    'job_position',
    'job position',
    'position',
    'ตำแหน่ง',
    'ตำแหน่งงาน',
    'หน้าที่',
  ]);
  add('province', ['province', 'จังหวัด']);
  add('region', ['region', 'ภาค']);
  add('qr_image_url', [
    'qr_image_url',
    'qr image url',
    'qr url',
    'qr_url',
    'qrlink',
    'qr link',
    'ลิงก์ qr',
    'ลิงก์QR',
  ]);
  add('food_type', [
    'food_type',
    'food type',
    'food',
    'ประเภทอาหาร',
    'อาหาร',
    'ประเภทอาหารที่ต้องการ',
  ]);
  add('coordinator_name', [
    'coordinator_name',
    'coordinator name',
    'coordinator',
    'ชื่อผู้ประสานงาน',
    'ผู้ประสานงาน',
    'ชื่อผู้ติดต่อ',
    'ผู้ติดต่อ',
  ]);
  add('coordinator_phone', [
    'coordinator_phone',
    'coordinator phone',
    'coordinator tel',
    'coordinator mobile',
    'เบอร์ผู้ประสานงาน',
    'โทรผู้ประสานงาน',
    'เบอร์ผู้ติดต่อ',
    'โทรผู้ติดต่อ',
  ]);
  add('hotel_name', [
    'hotel_name',
    'hotel name',
    'hotel',
    'โรงแรม',
    'ชื่อโรงแรม',
    'ที่พัก',
  ]);
  add('travel_mode', [
    'travel_mode',
    'travel mode',
    'การเดินทาง',
    'พาหนะ',
    'วิธีเดินทาง',
  ]);
  add('travel_other', [
    'travel_other',
    'travel other',
    'การเดินทางอื่น',
    'พาหนะอื่น',
    'วิธีเดินทางอื่น',
  ]);
  add('coordinator_prefix_other', [
    'coordinator_prefix',
    'coordinator prefix',
    'คำนำหน้าผู้ประสานงาน',
    'คำนำหน้าผู้ติดต่อ',
  ]);
  add('court_id', ['court_id', 'court id', 'court']);
  add('checkin_round1_at', [
    'checkin_round1_at',
    'checkin round1',
    'round1',
    'รอบลงทะเบียน1',
    'รอบลงทะเบียน 1',
  ]);
  add('checkin_round2_at', [
    'checkin_round2_at',
    'checkin round2',
    'round2',
    'รอบลงทะเบียน2',
    'รอบลงทะเบียน 2',
  ]);
  add('checkin_round3_at', [
    'checkin_round3_at',
    'checkin round3',
    'round3',
    'รอบลงทะเบียน3',
    'รอบลงทะเบียน 3',
  ]);
  add('event_id', ['event_id', 'event id', 'event']);

  return map;
})();

function mapHeaderToKey(header: string): keyof PreparedRow | null {
  const normalized = normalizeHeader(header);
  if (!normalized) return null;

  const direct = HEADER_ALIAS_MAP[normalized];
  if (direct) return direct;

  if (normalized.includes('qr') && (normalized.includes('url') || normalized.includes('image'))) {
    return 'qr_image_url';
  }
  if (normalized.includes('token') || normalized.includes('ticket') || normalized.includes('รหัสบัตร')) {
    return 'ticket_token';
  }
  if (
    (normalized.includes('coordinator') ||
      normalized.includes('ผู้ประสานงาน') ||
      normalized.includes('ผู้ติดต่อ')) &&
    (normalized.includes('phone') ||
      normalized.includes('tel') ||
      normalized.includes('mobile') ||
      normalized.includes('เบอร์') ||
      normalized.includes('โทร'))
  ) {
    return 'coordinator_phone';
  }
  if (
    (normalized.includes('coordinator') ||
      normalized.includes('ผู้ประสานงาน') ||
      normalized.includes('ผู้ติดต่อ')) &&
    (normalized.includes('name') || normalized.includes('ชื่อ'))
  ) {
    return 'coordinator_name';
  }
  if (
    normalized.includes('phone') ||
    normalized.includes('tel') ||
    normalized.includes('mobile') ||
    normalized.includes('เบอร์') ||
    normalized.includes('โทร')
  ) {
    return 'phone';
  }
  if (normalized.includes('slip') || normalized.includes('สลิป')) return 'slip_url';
  if (normalized.includes('prefix') || normalized.includes('คำนำหน้า')) return 'name_prefix';
  if (normalized.includes('hotel') || normalized.includes('โรงแรม') || normalized.includes('ที่พัก')) {
    return 'hotel_name';
  }
  if (normalized.includes('travel') || normalized.includes('เดินทาง') || normalized.includes('พาหนะ')) {
    return 'travel_mode';
  }
  if (
    normalized.includes('organization') ||
    normalized.includes('org') ||
    normalized.includes('หน่วยงาน') ||
    normalized.includes('องค์กร') ||
    normalized.includes('ต้นสังกัด')
  ) {
    return 'organization';
  }
  if (normalized.includes('position') || normalized.includes('ตำแหน่ง') || normalized.includes('หน้าที่')) {
    return 'job_position';
  }
  if (normalized.includes('province') || normalized.includes('จังหวัด')) return 'province';
  if (normalized.includes('region') || normalized.includes('ภาค')) return 'region';
  if (normalized.includes('food') || normalized.includes('อาหาร')) return 'food_type';

  return null;
}

function prepareRow(row: RawMappedRow): PreparedRow | null {
  const name_prefix = row.name_prefix ?? null;
  const full_name = row.full_name ?? null;
  const first_name = row.first_name ?? null;
  const last_name = row.last_name ?? null;
  const ticket_token = row.ticket_token ?? null;
  const phone = row.phone ?? null;
  const organization = row.organization ?? null;
  const job_position = row.job_position ?? null;
  const province = row.province ?? null;
  const region_raw = row.region ?? null;
  const qr_image_url = row.qr_image_url ?? null;
  const slip_url = row.slip_url ?? null;
  const food_type_raw = row.food_type ?? null;
  const travel_mode_raw = row.travel_mode ?? null;
  const travel_other_raw = row.travel_other ?? null;
  const coordinator_prefix_other = row.coordinator_prefix_other ?? null;
  const coordinator_name = row.coordinator_name ?? null;
  const coordinator_phone = row.coordinator_phone ?? null;
  const hotel_name = row.hotel_name ?? null;
  const event_id = row.event_id ?? null;
  const court_id = row.court_id ?? null;
  const checkin_round1_at = row.checkin_round1_at ?? null;
  const checkin_round2_at = row.checkin_round2_at ?? null;
  const checkin_round3_at = row.checkin_round3_at ?? null;

  const resolvedFullName = (() => {
    if (full_name) {
      const trimmed = String(full_name).trim();
      if (trimmed) return trimmed;
    }
    const first = first_name ? String(first_name).trim() : '';
    const last = last_name ? String(last_name).trim() : '';
    const combined = [first, last].filter(Boolean).join(' ').trim();
    return combined || null;
  })();

  // ถ้าไม่มีชื่อหรือไม่มี token → ข้าม
  if (!resolvedFullName || !ticket_token) return null;

  // ✅ แปลง region เป็นตัวเลข 0–9
  let regionNum: number | null = null;
  if (region_raw != null) {
    const rawStr = String(region_raw).trim();

    if (
      rawStr === 'ศาลกลาง' ||
      rawStr === 'ศาลเยาวชนและครอบครัวกลาง' ||
      rawStr === '0'
    ) {
      regionNum = 0;
    } else {
      const parsed = parseInt(rawStr, 10);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 9) {
        regionNum = parsed;
      }
    }
  }

  const normalizedPhone = phone ? phoneForStorage(String(phone).trim()) : null;
  const normalizedCoordinatorPhone = coordinator_phone
    ? phoneForStorage(String(coordinator_phone).trim())
    : null;
  if (phone && !normalizedPhone) {
    console.warn('[IMPORT] invalid phone, setting null', { phone });
  }
  if (coordinator_phone && !normalizedCoordinatorPhone) {
    console.warn('[IMPORT] invalid coordinator phone, setting null', { coordinator_phone });
  }

  const travel = normalizeTravelMode(travel_mode_raw, travel_other_raw);

  return {
    event_id: event_id ? String(event_id).trim() : null,
    court_id: court_id ? String(court_id).trim() : null,
    name_prefix: name_prefix ? String(name_prefix).trim() : null,
    full_name: resolvedFullName,
    first_name: first_name ? String(first_name).trim() : null,
    last_name: last_name ? String(last_name).trim() : null,
    ticket_token: String(ticket_token).trim(),
    phone: normalizedPhone,
    organization: organization ? String(organization).trim() : null,
    job_position: job_position ? String(job_position).trim() : null,
    province: province ? String(province).trim() : null,
    region: regionNum,
    qr_image_url: qr_image_url ? String(qr_image_url).trim() : null,
    slip_url: slip_url ? String(slip_url).trim() : null,
    food_type: normalizeFoodType(food_type_raw),
    travel_mode: travel.mode,
    travel_other: travel.other,
    coordinator_prefix_other: coordinator_prefix_other
      ? String(coordinator_prefix_other).trim()
      : null,
    coordinator_name: coordinator_name ? String(coordinator_name).trim() : null,
    coordinator_phone: normalizedCoordinatorPhone,
    hotel_name: hotel_name ? String(hotel_name).trim() : null,
    checkin_round1_at: normalizeTimestamp(checkin_round1_at),
    checkin_round2_at: normalizeTimestamp(checkin_round2_at),
    checkin_round3_at: normalizeTimestamp(checkin_round3_at),
  };
}

const UPSERT_BATCH_SIZE = 500;

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();

    // 1) รับไฟล์จาก FormData
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof Blob)) {
      return NextResponse.json(
        {
          ok: false,
          message: 'ไม่พบไฟล์ที่อัปโหลด หรือรูปแบบไม่ถูกต้อง',
        },
        { status: 400 },
      );
    }

    // 2) อ่านไฟล์ Excel ด้วย ExcelJS
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    // 🔹 อ่านทุกชีตในไฟล์ ไม่ใช่แค่ชีตที่ 1
    const prepared: PreparedRow[] = [];
    let totalDataRows = 0;

    const rawHeaders = new Set<string>();
    const mappedHeaders = new Set<string>();

    for (const worksheet of workbook.worksheets) {
      if (!worksheet) continue;
      const sheetName = worksheet.name;
      console.log('[IMPORT] reading sheet:', sheetName);

      const headerKeys: Array<keyof PreparedRow | null> = [];

      // header row (แถวที่ 1 ของชีตนั้น)
      const headerRow = worksheet.getRow(1);
      if (!headerRow || headerRow.cellCount === 0) {
        console.log('[IMPORT] sheet has empty header, skip:', sheetName);
        continue;
      }

      headerRow.eachCell((cell, colNum) => {
        const rawHeader = String(cell.value || '').trim();
        if (rawHeader) rawHeaders.add(rawHeader);
        const mappedKey = mapHeaderToKey(rawHeader);
        headerKeys[colNum - 1] = mappedKey;
        if (mappedKey) mappedHeaders.add(String(mappedKey));
      });

      let sheetRowCount = 0;

      worksheet.eachRow((row, rowNum) => {
        if (rowNum === 1) return; // ข้าม header ในชีตนั้น

        const obj: RawMappedRow = {};
        row.eachCell((cell, colNum) => {
          const mappedKey = headerKeys[colNum - 1];
          if (mappedKey) {
            obj[mappedKey] = cell.value ?? null;
          }
        });

        if (Object.keys(obj).length > 0) {
          totalDataRows += 1;
          sheetRowCount += 1;
          const preparedRow = prepareRow(obj);
          if (preparedRow) prepared.push(preparedRow);
        }
      });

      console.log(
        `[IMPORT] sheet "${sheetName}" → ${sheetRowCount} data rows`,
      );
    }

    // ถ้าทุกชีตว่างจริง ๆ
    const rawHeaderPreview = Array.from(rawHeaders).slice(0, 20).join(', ');
    const mappedHeaderPreview = Array.from(mappedHeaders).slice(0, 20).join(', ');

    if (totalDataRows === 0) {
      return NextResponse.json(
        {
          ok: false,
          message:
            `ไม่พบข้อมูลในไฟล์ Excel (ทุกชีตไม่มีข้อมูล แถวข้อมูล หรือ header ไม่ถูกต้อง) พบหัวตาราง: ${rawHeaderPreview || '-'}`,
        },
        { status: 400 },
      );
    }

    // 4) เช็กกรณีไม่พบข้อมูลที่พร้อมนำเข้า (หลังจาก filter null ออก)
    if (prepared.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message:
            `ไม่พบข้อมูลที่พร้อมนำเข้า (ตรวจสอบว่ามีคอลัมน์ ชื่อ-นามสกุล และ Token/รหัสบัตร และมีข้อมูลอย่างน้อย 1 แถว) พบหัวตาราง: ${rawHeaderPreview || '-'} | จับคู่ได้: ${mappedHeaderPreview || '-'}`,
        },
        { status: 400 },
      );
    }

    // 5) ใช้ EVENT_ID จาก env เป็นค่าเริ่มต้น
    const envEventId = (process.env.EVENT_ID ?? '').trim();
    if (!envEventId) {
      return NextResponse.json(
        { ok: false, message: 'ยังไม่ได้ตั้งค่า EVENT_ID ใน Environment' },
        { status: 500 },
      );
    }

    const { data: eventRow, error: eventError } = await supabase
      .from('events')
      .select('id')
      .eq('id', envEventId)
      .maybeSingle();

    if (eventError || !eventRow) {
      return NextResponse.json(
        { ok: false, message: 'EVENT_ID ไม่ถูกต้อง หรือไม่พบ event' },
        { status: 400 },
      );
    }

    const eventId = eventRow.id as string;

    // 6) upsert ลง attendees ตาม schema ใหม่
    let importedCount = 0;

    for (let i = 0; i < prepared.length; i += UPSERT_BATCH_SIZE) {
      const slice = prepared.slice(i, i + UPSERT_BATCH_SIZE);
      const { error: insertError } = await supabase
        .from('attendees')
        .upsert(
          slice.map((row) => ({
            event_id: eventId,
            court_id: row.court_id,
            name_prefix: row.name_prefix,
            full_name: row.full_name,
            phone: row.phone,
            organization: row.organization,
            job_position: row.job_position,
            province: row.province,
            region: row.region,
            qr_image_url: row.qr_image_url,
            slip_url: row.slip_url,
            food_type: row.food_type,
            travel_mode: row.travel_mode,
            travel_other: row.travel_other,
            coordinator_prefix_other: row.coordinator_prefix_other,
            coordinator_name: row.coordinator_name,
            coordinator_phone: row.coordinator_phone,
            hotel_name: row.hotel_name,
            ticket_token: row.ticket_token,
          })),
          { onConflict: 'ticket_token' },
        );

      if (insertError) {
        console.error('IMPORT INSERT ERROR', insertError);
        return NextResponse.json(
          {
            ok: false,
            message:
              'เกิดข้อผิดพลาดระหว่างการบันทึกข้อมูลเข้าฐานข้อมูล (เช่น ticket_token ซ้ำ หรือข้อมูลไม่ตรง constraint)',
            detail: insertError.message,
          },
          { status: 500 },
        );
      }

      importedCount += slice.length;
    }

    // 6.1) ถ้ามีข้อมูลลงทะเบียนรายรอบ ให้เขียนลง attendee_checkins
    const checkinSeed = prepared.flatMap((row) => {
      const items: Array<{ ticket_token: string; round: number; checked_in_at: string }> = [];
      if (row.checkin_round1_at) {
        items.push({
          ticket_token: row.ticket_token,
          round: 1,
          checked_in_at: row.checkin_round1_at,
        });
      }
      if (row.checkin_round2_at) {
        items.push({
          ticket_token: row.ticket_token,
          round: 2,
          checked_in_at: row.checkin_round2_at,
        });
      }
      if (row.checkin_round3_at) {
        items.push({
          ticket_token: row.ticket_token,
          round: 3,
          checked_in_at: row.checkin_round3_at,
        });
      }
      return items;
    });

    if (checkinSeed.length > 0) {
      const tokenList = Array.from(new Set(checkinSeed.map((c) => c.ticket_token)));
      for (let i = 0; i < tokenList.length; i += UPSERT_BATCH_SIZE) {
        const tokenBatch = tokenList.slice(i, i + UPSERT_BATCH_SIZE);
        const { data: attendeeIds, error: attendeeError } = await supabase
          .from('attendees')
          .select('id, ticket_token')
          .in('ticket_token', tokenBatch);

        if (attendeeError) {
          return NextResponse.json(
            { ok: false, message: `ดึง attendee_id ไม่สำเร็จ: ${attendeeError.message}` },
            { status: 500 },
          );
        }

        const idMap = new Map(
          (attendeeIds ?? []).map((row: any) => [row.ticket_token, row.id]),
        );

        const checkinRows = checkinSeed
          .filter((c) => tokenBatch.includes(c.ticket_token))
          .map((c) => ({
            attendee_id: idMap.get(c.ticket_token),
            round: c.round,
            checked_in_at: c.checked_in_at,
          }))
          .filter((row) => Boolean(row.attendee_id));

        if (checkinRows.length > 0) {
          const { error: checkinError } = await supabase
            .from('attendee_checkins')
            .upsert(checkinRows, { onConflict: 'attendee_id,round' });

          if (checkinError) {
            return NextResponse.json(
              { ok: false, message: `บันทึกลงทะเบียนรายรอบไม่สำเร็จ: ${checkinError.message}` },
              { status: 500 },
            );
          }
        }
      }
    }

    // 7) ตอบกลับสำเร็จ
    return NextResponse.json({
      ok: true,
      imported: importedCount,
      message: `นำเข้าข้อมูลสำเร็จ ${importedCount} รายการ`,
    });
  } catch (err) {
    console.error('IMPORT ROUTE ERROR', err);
    return NextResponse.json(
      {
        ok: false,
        message: 'เกิดข้อผิดพลาดระหว่างการประมวลผลไฟล์',
      },
      { status: 500 },
    );
  }
}
