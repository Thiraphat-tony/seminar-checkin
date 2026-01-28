// app/api/admin/export-attendees/route.ts
import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

import { requireStaffForApi } from '@/lib/requireStaffForApi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---- Types ----
type DbAttendee = {
  id: string | null;
  event_id: string | null;
  court_id: string | null;
  name_prefix: string | null;
  full_name: string | null;
  organization: string | null;
  province: string | null;
  region: number | null;
  job_position: string | null;
  phone: string | null;
  food_type: string | null;
  hotel_name: string | null;
  travel_mode: string | null;
  travel_other: string | null;
  checked_in_at: string | null;
  checkin_round1_at: string | null;
  checkin_round2_at: string | null;
  checkin_round3_at: string | null;
  slip_url: string | null;
  qr_image_url: string | null;
  ticket_token: string | null;
  created_at: string | null;
  coordinator_prefix_other: string | null;
  coordinator_name: string | null;
  coordinator_phone: string | null;
};

const REGION_ORGANIZATIONS: Record<string, string[]> = {
  '0': ['ศาลเยาวชนและครอบครัวกลาง (กรุงเทพมหานคร)'],
  '1': [
    'ศาลเยาวชนและครอบครัวจังหวัดชัยนาท',
    'ศาลเยาวชนและครอบครัวจังหวัดนนทบุรี',
    'ศาลเยาวชนและครอบครัวจังหวัดปทุมธานี',
    'ศาลเยาวชนและครอบครัวจังหวัดพระนครศรีอยุธยา',
    'ศาลเยาวชนและครอบครัวจังหวัดลพบุรี',
    'ศาลเยาวชนและครอบครัวจังหวัดสมุทรปราการ',
    'ศาลเยาวชนและครอบครัวจังหวัดสระบุรี',
    'ศาลเยาวชนและครอบครัวจังหวัดสิงห์บุรี',
    'ศาลเยาวชนและครอบครัวจังหวัดอ่างทอง',
    'ศาลแพ่งมีนบุรีและศาลอาญามีนบุรี แผนกคดีเยาวชนและครอบครัว',
  ],
  '2': [
    'ศาลเยาวชนและครอบครัวจังหวัดจันทบุรี',
    'ศาลเยาวชนและครอบครัวจังหวัดฉะเชิงเทรา',
    'ศาลเยาวชนและครอบครัวจังหวัดชลบุรี',
    'ศาลเยาวชนและครอบครัวจังหวัดตราด',
    'ศาลเยาวชนและครอบครัวจังหวัดนครนายก',
    'ศาลเยาวชนและครอบครัวจังหวัดปราจีนบุรี',
    'ศาลเยาวชนและครอบครัวจังหวัดระยอง',
    'ศาลเยาวชนและครอบครัวจังหวัดสระแก้ว',
  ],
  '3': [
    'ศาลเยาวชนและครอบครัวจังหวัดชัยภูมิ',
    'ศาลเยาวชนและครอบครัวจังหวัดนครราชสีมา',
    'ศาลเยาวชนและครอบครัวจังหวัดบุรีรัมย์',
    'ศาลเยาวชนและครอบครัวจังหวัดยโสธร',
    'ศาลเยาวชนและครอบครัวจังหวัดศรีสะเกษ',
    'ศาลเยาวชนและครอบครัวจังหวัดสุรินทร์',
    'ศาลเยาวชนและครอบครัวจังหวัดอำนาจเจริญ',
    'ศาลเยาวชนและครอบครัวจังหวัดอุบลราชธานี',
  ],
  '4': [
    'ศาลเยาวชนและครอบครัวจังหวัดกาฬสินธุ์',
    'ศาลเยาวชนและครอบครัวจังหวัดขอนแก่น',
    'ศาลเยาวชนและครอบครัวจังหวัดนครพนม',
    'ศาลเยาวชนและครอบครัวจังหวัดบึงกาฬ',
    'ศาลเยาวชนและครอบครัวจังหวัดมหาสารคาม',
    'ศาลเยาวชนและครอบครัวจังหวัดมุกดาหาร',
    'ศาลเยาวชนและครอบครัวจังหวัดร้อยเอ็ด',
    'ศาลเยาวชนและครอบครัวจังหวัดเลย',
    'ศาลเยาวชนและครอบครัวจังหวัดสกลนคร',
    'ศาลเยาวชนและครอบครัวจังหวัดหนองคาย',
    'ศาลเยาวชนและครอบครัวจังหวัดหนองบัวลำภู',
    'ศาลเยาวชนและครอบครัวจังหวัดอุดรธานี',
  ],
  '5': [
    'ศาลเยาวชนและครอบครัวจังหวัดเชียงราย',
    'ศาลเยาวชนและครอบครัวจังหวัดเชียงใหม่',
    'ศาลเยาวชนและครอบครัวจังหวัดน่าน',
    'ศาลเยาวชนและครอบครัวจังหวัดพะเยา',
    'ศาลเยาวชนและครอบครัวจังหวัดแพร่',
    'ศาลเยาวชนและครอบครัวจังหวัดแม่ฮ่องสอน',
    'ศาลเยาวชนและครอบครัวจังหวัดลำปาง',
    'ศาลเยาวชนและครอบครัวจังหวัดลำพูน',
  ],
  '6': [
    'ศาลเยาวชนและครอบครัวจังหวัดกำแพงเพชร',
    'ศาลเยาวชนและครอบครัวจังหวัดตาก',
    'ศาลเยาวชนและครอบครัวจังหวัดนครสวรรค์',
    'ศาลเยาวชนและครอบครัวจังหวัดพิจิตร',
    'ศาลเยาวชนและครอบครัวจังหวัดพิษณุโลก',
    'ศาลเยาวชนและครอบครัวจังหวัดเพชรบูรณ์',
    'ศาลเยาวชนและครอบครัวจังหวัดสุโขทัย',
    'ศาลเยาวชนและครอบครัวจังหวัดอุตรดิตถ์',
    'ศาลเยาวชนและครอบครัวจังหวัดอุทัยธานี',
    'ศาลเยาวชนและครอบครัวจังหวัดตาก (แม่สอด)',
  ],
  '7': [
    'ศาลเยาวชนและครอบครัวจังหวัดกาญจนบุรี',
    'ศาลเยาวชนและครอบครัวจังหวัดนครปฐม',
    'ศาลเยาวชนและครอบครัวจังหวัดประจวบคีรีขันธ์',
    'ศาลเยาวชนและครอบครัวจังหวัดเพชรบุรี',
    'ศาลเยาวชนและครอบครัวจังหวัดราชบุรี',
    'ศาลเยาวชนและครอบครัวจังหวัดสมุทรสงคราม',
    'ศาลเยาวชนและครอบครัวจังหวัดสมุทรสาคร',
    'ศาลเยาวชนและครอบครัวจังหวัดสุพรรณบุรี',
    'ศาลเยาวชนและครอบครัวจังหวัดกาญจนบุรี (ทองผาภูมิ)',
  ],
  '8': [
    'ศาลเยาวชนและครอบครัวจังหวัดกระบี่',
    'ศาลเยาวชนและครอบครัวจังหวัดชุมพร',
    'ศาลเยาวชนและครอบครัวจังหวัดนครศรีธรรมราช',
    'ศาลเยาวชนและครอบครัวจังหวัดภูเก็ต',
    'ศาลเยาวชนและครอบครัวจังหวัดระนอง',
    'ศาลเยาวชนและครอบครัวจังหวัดสุราษฎร์ธานี',
    'ศาลเยาวชนและครอบครัวจังหวัดพังงา',
    'ศาลเยาวชนและครอบครัวจังหวัดพังงา (ตะกั่วป่า)',
    'ศาลเยาวชนและครอบครัวจังหวัดสุราษฎร์ธานี (เกาะสมุย)',
  ],
  '9': [
    'ศาลเยาวชนและครอบครัวจังหวัดตรัง',
    'ศาลเยาวชนและครอบครัวจังหวัดนราธิวาส',
    'ศาลเยาวชนและครอบครัวจังหวัดปัตตานี',
    'ศาลเยาวชนและครอบครัวจังหวัดพัทลุง',
    'ศาลเยาวชนและครอบครัวจังหวัดยะลา',
    'ศาลเยาวชนและครอบครัวจังหวัดสงขลา',
    'ศาลเยาวชนและครอบครัวจังหวัดสตูล',
    'ศาลเยาวชนและครอบครัวจังหวัดยะลา (เบตง)',
  ],
};

const OTHER_ORGANIZATION_LABEL = 'อื่น ๆ';

const SHEET_NAME_CENTRAL = 'ศาลกลาง';
const SHEET_NAME_OTHER = 'อื่น ๆ';
const SHEET_NAME_EXPORT = 'ส่งออก';
const SHEET_NAME_REGION_PREFIX = 'ภาค';

function sanitizeSheetName(name: string) {
  const invalid = /[:\\/?*\[\]]/g;
  const cleaned = name.replace(invalid, ' ').trim();
  const safe = cleaned.length > 31 ? cleaned.slice(0, 31) : cleaned;
  return safe || 'Sheet';
}

function toAsciiFilename(name: string, fallback: string) {
  const ascii = name.replace(/[^\x20-\x7E]/g, '_').replace(/\s+/g, ' ').trim();
  const safe = ascii.length ? ascii : fallback;
  return safe.endsWith('.xlsx') ? safe : `${safe}.xlsx`;
}

function formatOrganizationSheetName(organization: string) {
  const trimmed = organization.trim();
  const prefixes = [
    'ศาลเยาวชนและครอบครัวจังหวัด',
    'ศาลเยาวชนและครอบครัว',
  ];
  let name = trimmed;
  for (const prefix of prefixes) {
    if (name.startsWith(prefix)) {
      name = name.slice(prefix.length).trim();
      break;
    }
  }
  return name || trimmed;
}
function setSlipLink(cell: ExcelJS.Cell, url?: string | null, province?: string | null) {
  if (!url) return;
  const label = (province ?? '').trim() || 'สลิป';
  cell.value = { text: label, hyperlink: url };
  cell.font = { color: { argb: 'FF2563EB' }, underline: true };
}

function formatFoodType(foodType: string | null): string {
  if (!foodType) return 'ไม่ระบุ';
  const trimmed = foodType.trim();
  if (!trimmed) return 'ไม่ระบุ';
  const normalized = trimmed.toLowerCase();

  switch (normalized) {
    case 'normal':
    case 'ทั่วไป':
    case 'อาหารทั่วไป':
    case 'ปกติ':
      return 'ปกติ';
    case 'no_pork':
    case 'ไม่ทานหมู':
    case 'ไม่กินหมู':
    case 'งดหมู':
      return 'ไม่ทานหมู';
    case 'vegetarian':
    case 'มังสวิรัติ':
    case 'มังสะวิรัติ':
    case 'มังฯ':
      return 'มังสวิรัติ';
    case 'vegan':
    case 'เจ':
    case 'อาหารเจ':
    case 'วีแกน':
      return 'เจ / วีแกน';
    case 'halal':
    case 'ฮาลาล':
    case 'อิสลาม':
    case 'อาหารอิสลาม':
    case 'มุสลิม':
      return 'ฮาลาล';
    case 'seafood_allergy':
    case 'แพ้อาหารทะเล':
    case 'แพ้อาหารทะเล/ซีฟู้ด':
    case 'แพ้ซีฟู้ด':
      return 'แพ้อาหารทะเล';
    case 'other':
    case 'อื่น':
    case 'อื่นๆ':
    case 'อื่น ๆ':
      return 'อื่น ๆ';
    case '-':
    case 'ไม่ระบุ':
      return 'ไม่ระบุ';
    default:
      return trimmed;
  }
}

const JOB_POSITION_LABELS: Record<string, string> = {
  chief_judge: 'ผู้พิพากษาหัวหน้าศาล',
  associate_judge: 'ผู้พิพากษาสมทบ',
  '????????????????????': 'ผู้พิพากษาหัวหน้าศาล',
  '??????????????': 'ผู้พิพากษาสมทบ',
};

function formatJobPosition(jobPosition: string | null): string {
  if (!jobPosition) return '';
  const trimmed = jobPosition.trim();
  if (!trimmed) return '';
  return JOB_POSITION_LABELS[trimmed] ?? trimmed;
}

const TRAVEL_MODE_LABELS: Record<string, string> = {
  car: 'รถยนต์ส่วนตัว',
  van: 'รถตู้',
  bus: 'รถโดยสาร/รถบัส',
  train: 'รถไฟ',
  plane: 'เครื่องบิน',
  motorcycle: 'รถจักรยานยนต์',
  other: 'อื่น ๆ',
  'รถยนต์ส่วนตัว': 'รถยนต์ส่วนตัว',
  'รถตู้': 'รถตู้',
  'รถโดยสาร/รถบัส': 'รถโดยสาร/รถบัส',
  'รถบัส': 'รถโดยสาร/รถบัส',
  'รถไฟ': 'รถไฟ',
  'เครื่องบิน': 'เครื่องบิน',
  'รถจักรยานยนต์': 'รถจักรยานยนต์',
  'มอเตอร์ไซค์': 'รถจักรยานยนต์',
  'อื่น': 'อื่น ๆ',
  'อื่นๆ': 'อื่น ๆ',
  'อื่น ๆ': 'อื่น ๆ',
};

function formatTravelMode(mode: string | null, other: string | null): string {
  const trimmedMode = (mode ?? '').trim();
  const trimmedOther = (other ?? '').trim();

  if (!trimmedMode) {
    return trimmedOther ? `อื่น ๆ: ${trimmedOther}` : '-';
  }

  const normalized = trimmedMode.toLowerCase();
  const label =
    TRAVEL_MODE_LABELS[trimmedMode] ?? TRAVEL_MODE_LABELS[normalized] ?? trimmedMode;
  const isOther =
    normalized === 'other' ||
    trimmedMode === 'อื่น' ||
    trimmedMode === 'อื่นๆ' ||
    trimmedMode === 'อื่น ๆ';

  if (isOther) {
    return trimmedOther ? `อื่น ๆ: ${trimmedOther}` : 'อื่น ๆ';
  }

  if (label === trimmedMode && trimmedOther) {
    return `${label}: ${trimmedOther}`;
  }

  return label;
}

function formatCheckinTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: '2-digit',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
function formatCheckinStatus(checkedInAt: string | null) {
  if (!checkedInAt) return 'ยังไม่ได้ลงทะเบียน';
  const date = new Date(checkedInAt);
  if (Number.isNaN(date.getTime())) return 'ยังไม่ได้ลงทะเบียน';
  const formatted = date.toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: '2-digit',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `ลงทะเบียนเมื่อ ${formatted}`;
}
// setup header columns
function setupSheetColumns(sheet: ExcelJS.Worksheet) {
  sheet.columns = [
    { header: 'คำนำหน้า', key: 'name_prefix', width: 12 },
    { header: 'ชื่อ-นามสกุล', key: 'full_name', width: 30 },
    { header: 'เบอร์โทรศัพท์', key: 'phone', width: 16 },
    { header: 'หน่วยงาน', key: 'organization', width: 28 },
    { header: 'ตำแหน่ง', key: 'job_position', width: 24 },
    { header: 'จังหวัด', key: 'province', width: 18 },
    { header: 'ภาค', key: 'region', width: 12 },
    { header: 'ประเภทอาหาร', key: 'food_type', width: 18 },
    { header: 'คำนำหน้าผู้ประสานงาน', key: 'coordinator_prefix', width: 20 },
    { header: 'ชื่อผู้ประสานงาน', key: 'coordinator_name', width: 26 },
    { header: 'เบอร์ผู้ประสานงาน', key: 'coordinator_phone', width: 20 },
    { header: 'โรงแรม', key: 'hotel_name', width: 24 },
    { header: 'การเดินทาง', key: 'travel_mode', width: 20 },
    { header: 'การเดินทางอื่น', key: 'travel_other', width: 24 },
    { header: 'สถานะลงทะเบียน', key: 'checkin_status', width: 18 },
    { header: 'รอบลงทะเบียน 1', key: 'checkin_round1_at', width: 18 },
    { header: 'รอบลงทะเบียน 2', key: 'checkin_round2_at', width: 18 },
    { header: 'รอบลงทะเบียน 3', key: 'checkin_round3_at', width: 18 },
    { header: 'สลิป', key: 'slip', width: 20 },
    { header: 'รหัสบัตร', key: 'ticket_token', width: 26 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Freeze header row
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireStaffForApi(req);
    if (!auth.ok) return auth.response;
    const { supabase, staff } = auth;
    const eventId = (process.env.EVENT_ID ?? '').trim();

    if (!eventId) {
      return NextResponse.json(
        { success: false, message: 'EVENT_ID_REQUIRED' },
        { status: 400 },
      );
    }

    // region = 0 (central court) + 1–9
    const regionParam = req.nextUrl.searchParams.get('region');
    const regionNumberRaw = regionParam !== null ? Number(regionParam) : Number.NaN;

    const hasRegionFilter =
      Number.isFinite(regionNumberRaw) &&
      regionNumberRaw >= 0 &&
      regionNumberRaw <= 9;

    const regionFilter: number | null = hasRegionFilter ? regionNumberRaw : null;

    const selectColumns = `
        id,
        event_id,
        court_id,
        name_prefix,
        full_name,
        organization,
        province,
        region,
        job_position,
        phone,
        food_type,
        hotel_name,
        travel_mode,
        travel_other,
        checked_in_at,
        checkin_round1_at,
        checkin_round2_at,
        checkin_round3_at,
        slip_url,
        qr_image_url,
        ticket_token,
        created_at,
        coordinator_prefix_other,
        coordinator_name,
        coordinator_phone
      `;

    let query = supabase
      .from('v_attendees_checkin_rounds')
      .select(selectColumns)
      .order('region', { ascending: true, nullsFirst: false })
      .order('full_name', { ascending: true });

    if (eventId) {
      query = query.eq('event_id', eventId);
    }

    if (regionFilter !== null) {
      query = query.eq('region', regionFilter);
    }

    if (staff.role !== 'super_admin') {
      const staffCourtId = (staff.court_id ?? '').trim();
      if (staffCourtId) {
        query = query.eq('court_id', staffCourtId);
      }
    }

    let { data, error } = await query;

    const fetchFromTables = async () => {
      let baseQuery = supabase
        .from('attendees')
        .select(
          `
          id,
          event_id,
          court_id,
          name_prefix,
          full_name,
          organization,
          province,
          region,
          job_position,
          phone,
          food_type,
          hotel_name,
          travel_mode,
          travel_other,
          checked_in_at,
          slip_url,
          qr_image_url,
          ticket_token,
          created_at,
          coordinator_prefix_other,
          coordinator_name,
          coordinator_phone
        `,
        )
        .order('region', { ascending: true, nullsFirst: false })
        .order('full_name', { ascending: true });

      baseQuery = baseQuery.eq('event_id', eventId);

      if (regionFilter !== null) {
        baseQuery = baseQuery.eq('region', regionFilter);
      }

      if (staff.role !== 'super_admin') {
        const staffCourtId = (staff.court_id ?? '').trim();
        if (staffCourtId) {
          baseQuery = baseQuery.eq('court_id', staffCourtId);
        }
      }

      const { data: attendeeRows, error: attendeeError } = await baseQuery;
      if (attendeeError || !attendeeRows) {
        return { ok: false as const, error: attendeeError };
      }

      const ids = attendeeRows
        .map((row) => row.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);

      const checkinMap = new Map<
        string,
        { round1At: string | null; round2At: string | null; round3At: string | null }
      >();

      if (ids.length > 0) {
        const chunkSize = 500;
        for (let i = 0; i < ids.length; i += chunkSize) {
          const chunk = ids.slice(i, i + chunkSize);
          const { data: checkins, error: checkinError } = await supabase
            .from('attendee_checkins')
            .select('attendee_id, round, checked_in_at')
            .in('attendee_id', chunk);

          if (checkinError) {
            return { ok: false as const, error: checkinError };
          }

          for (const row of checkins ?? []) {
            const attendeeId = row.attendee_id as string | null;
            const round = row.round as number | null;
            if (!attendeeId || !round) continue;

            const entry = checkinMap.get(attendeeId) ?? {
              round1At: null,
              round2At: null,
              round3At: null,
            };

            if (round === 1) entry.round1At = row.checked_in_at ?? entry.round1At;
            if (round === 2) entry.round2At = row.checked_in_at ?? entry.round2At;
            if (round === 3) entry.round3At = row.checked_in_at ?? entry.round3At;

            checkinMap.set(attendeeId, entry);
          }
        }
      }

      const merged = attendeeRows.map((row) => {
        const entry = checkinMap.get(row.id) ?? {
          round1At: null,
          round2At: null,
          round3At: null,
        };
        return {
          ...row,
          checkin_round1_at: entry.round1At,
          checkin_round2_at: entry.round2At,
          checkin_round3_at: entry.round3At,
        } as DbAttendee;
      });

      return { ok: true as const, data: merged };
    };

    if (error || !data) {
      console.error('export-attendees view error, fallback to tables:', error);
      const fallback = await fetchFromTables();
      if (!fallback.ok) {
        console.error('export-attendees fallback error:', fallback.error);
        return NextResponse.json(
          { success: false, message: 'EXPORT_FAILED', error: fallback.error },
          { status: 500 },
        );
      }
      data = fallback.data;
    }

    const attendees = (data ?? []) as DbAttendee[];

    const workbook = new ExcelJS.Workbook();
    if (regionFilter !== null) {
      if (regionFilter === 0) {
        const sheet = workbook.addWorksheet(sanitizeSheetName(SHEET_NAME_CENTRAL));
        setupSheetColumns(sheet);

        for (const a of attendees) {
          const row = sheet.addRow({
            name_prefix: a.name_prefix ?? '',
            full_name: a.full_name ?? '',
            phone: a.phone ?? '',
            organization: a.organization ?? '',
            job_position: formatJobPosition(a.job_position ?? null),
            province: a.province ?? '',
            region: a.region ?? '',
            food_type: formatFoodType(a.food_type ?? null),
            coordinator_prefix: a.coordinator_prefix_other ?? '',
            coordinator_name: a.coordinator_name ?? '',
            coordinator_phone: a.coordinator_phone ?? '',
            hotel_name: a.hotel_name ?? '',
            travel_mode: formatTravelMode(a.travel_mode ?? null, a.travel_other ?? null),
            travel_other: a.travel_other ?? '',
            checkin_status: formatCheckinStatus(a.checked_in_at),
            checkin_round1_at: formatCheckinTime(a.checkin_round1_at),
            checkin_round2_at: formatCheckinTime(a.checkin_round2_at),
            checkin_round3_at: formatCheckinTime(a.checkin_round3_at),
            slip: '',
            ticket_token: a.ticket_token ?? '',
          });

          setSlipLink(row.getCell('slip'), a.slip_url, a.province);
        }
      } else {
        const allowedOrganizations = REGION_ORGANIZATIONS[String(regionFilter)] ?? [];
        const allowedSet = new Set(
          allowedOrganizations.map((org) => org.trim()).filter((org) => org.length > 0),
        );
        const organizationSheets = new Map<string, ExcelJS.Worksheet>();
        const usedSheetNames = new Set<string>();
        let otherSheet: ExcelJS.Worksheet | null = null;
        const getOrganizationSheet = (organization: string) => {
          let sheet = organizationSheets.get(organization);
          if (!sheet) {
            const baseName = sanitizeSheetName(formatOrganizationSheetName(organization));
            let sheetName = baseName;
            let counter = 2;
            while (usedSheetNames.has(sheetName)) {
              const suffix = ` (${counter})`;
              const trimmedBase = baseName.slice(0, 31 - suffix.length).trim();
              sheetName = `${trimmedBase}${suffix}`;
              counter += 1;
            }
            usedSheetNames.add(sheetName);
            sheet = workbook.addWorksheet(sheetName);
            setupSheetColumns(sheet);
            organizationSheets.set(organization, sheet);
          }
          return sheet;
        };
        const getOtherSheet = () => {
          if (!otherSheet) {
            const baseName = sanitizeSheetName(OTHER_ORGANIZATION_LABEL);
            let sheetName = baseName;
            let counter = 2;
            while (usedSheetNames.has(sheetName)) {
              const suffix = ` (${counter})`;
              const trimmedBase = baseName.slice(0, 31 - suffix.length).trim();
              sheetName = `${trimmedBase}${suffix}`;
              counter += 1;
            }
            usedSheetNames.add(sheetName);
            otherSheet = workbook.addWorksheet(sheetName);
            setupSheetColumns(otherSheet);
          }
          return otherSheet;
        };

        for (const a of attendees) {
          const organization = (a.organization ?? '').trim();
          const sheet = allowedSet.has(organization)
            ? getOrganizationSheet(organization)
            : getOtherSheet();
          const row = sheet.addRow({
            name_prefix: a.name_prefix ?? '',
            full_name: a.full_name ?? '',
            phone: a.phone ?? '',
            organization: a.organization ?? '',
            job_position: formatJobPosition(a.job_position ?? null),
            province: a.province ?? '',
            region: a.region ?? '',
            food_type: formatFoodType(a.food_type ?? null),
            coordinator_prefix: a.coordinator_prefix_other ?? '',
            coordinator_name: a.coordinator_name ?? '',
            coordinator_phone: a.coordinator_phone ?? '',
            hotel_name: a.hotel_name ?? '',
            travel_mode: formatTravelMode(a.travel_mode ?? null, a.travel_other ?? null),
            travel_other: a.travel_other ?? '',
            checkin_status: formatCheckinStatus(a.checked_in_at),
            checkin_round1_at: formatCheckinTime(a.checkin_round1_at),
            checkin_round2_at: formatCheckinTime(a.checkin_round2_at),
            checkin_round3_at: formatCheckinTime(a.checkin_round3_at),
            slip: '',
            ticket_token: a.ticket_token ?? '',
          });

          setSlipLink(row.getCell('slip'), a.slip_url, a.province);
        }
      }

      if (workbook.worksheets.length === 0) {
        const sheet = workbook.addWorksheet(sanitizeSheetName(SHEET_NAME_EXPORT));
        setupSheetColumns(sheet);
      }

      const fileArrayBuffer = await workbook.xlsx.writeBuffer();
      const filename =
        regionFilter === 0
          ? 'รายชื่อผู้เข้าร่วม-ศาลกลาง.xlsx'
          : `รายชื่อผู้เข้าร่วม-ภาค-${regionFilter}-แยกหน่วยงาน.xlsx`;
      const encodedFilename = encodeURIComponent(filename);
      const asciiFilename = toAsciiFilename(filename, 'attendees.xlsx');

      return new NextResponse(fileArrayBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const centralSheet = workbook.addWorksheet(sanitizeSheetName(SHEET_NAME_CENTRAL));
    setupSheetColumns(centralSheet);

    const regionSheets: Record<string, ExcelJS.Worksheet> = {};
    for (let r = 1; r <= 9; r += 1) {
      const sheet = workbook.addWorksheet(sanitizeSheetName(`${SHEET_NAME_REGION_PREFIX} ${r}`));
      setupSheetColumns(sheet);
      regionSheets[String(r)] = sheet;
    }

    let otherSheet: ExcelJS.Worksheet | null = null;
    const getOtherSheet = () => {
      if (!otherSheet) {
        otherSheet = workbook.addWorksheet(sanitizeSheetName(SHEET_NAME_OTHER));
        setupSheetColumns(otherSheet);
      }
      return otherSheet;
    };
    for (const a of attendees) {
      const regionValue = a.region ?? -1;

      let targetSheet: ExcelJS.Worksheet;

      if (regionValue === 0) {
        targetSheet = centralSheet;
      } else if (regionValue >= 1 && regionValue <= 9) {
        targetSheet = regionSheets[String(regionValue)];
      } else {
        targetSheet = getOtherSheet();
      }

      const row = targetSheet.addRow({
        name_prefix: a.name_prefix ?? '',
        full_name: a.full_name ?? '',
        phone: a.phone ?? '',
        organization: a.organization ?? '',
        job_position: formatJobPosition(a.job_position ?? null),
        province: a.province ?? '',
        region: a.region ?? '',
        food_type: formatFoodType(a.food_type ?? null),
        coordinator_prefix: a.coordinator_prefix_other ?? '',
        coordinator_name: a.coordinator_name ?? '',
        coordinator_phone: a.coordinator_phone ?? '',
        hotel_name: a.hotel_name ?? '',
        travel_mode: formatTravelMode(a.travel_mode ?? null, a.travel_other ?? null),
        travel_other: a.travel_other ?? '',
        checkin_status: formatCheckinStatus(a.checked_in_at),
        checkin_round1_at: formatCheckinTime(a.checkin_round1_at),
        checkin_round2_at: formatCheckinTime(a.checkin_round2_at),
        checkin_round3_at: formatCheckinTime(a.checkin_round3_at),
        slip: '',
        ticket_token: a.ticket_token ?? '',
      });

      setSlipLink(row.getCell('slip'), a.slip_url, a.province);
    }

    const fileArrayBuffer = await workbook.xlsx.writeBuffer();
    const filename = 'รายชื่อผู้เข้าร่วม-แยกตามภาค.xlsx';
    const encodedFilename = encodeURIComponent(filename);
    const asciiFilename = toAsciiFilename(filename, 'attendees-by-region.xlsx');

    return new NextResponse(fileArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('export-attendees unexpected error:', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: `EXPORT_FAILED: ${msg}` },
      { status: 500 },
    );
  }
}













