// app/api/admin/export-attendees/route.ts
import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

import { requireStaffForApi } from '@/lib/requireStaffForApi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---- Types จากฐานข้อมูล ----
type DbAttendee = {
  event_id: string | null;
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
    'ศาลแพ่งมีนบุรีแผนกคดีเยาวชนและครอบครัว',
    'ศาลอาญามีนบุรีแผนกคดีเยาวชนและครอบครัว',
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

function sanitizeSheetName(name: string) {
  const invalid = /[:\\/?*\[\]]/g;
  const cleaned = name.replace(invalid, ' ').trim();
  return cleaned.length > 31 ? cleaned.slice(0, 31) : cleaned || 'ไม่ระบุจังหวัด';
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
  const label = (province ?? '').trim() || 'ดาวน์โหลด';
  cell.value = { text: label, hyperlink: url };
  cell.font = { color: { argb: 'FF2563EB' }, underline: true };
}

function formatFoodType(foodType: string | null): string {
  switch (foodType) {
    case 'normal':
      return 'ปกติ';
    case 'no_pork':
      return 'ไม่ทานหมู';
    case 'vegetarian':
      return 'มังสวิรัติ';
    case 'vegan':
      return 'เจ / วีแกน';
    case 'halal':
      return 'ฮาลาล';
    case 'seafood_allergy':
      return 'แพ้อาหารทะเล';
    case 'other':
      return 'อื่น ๆ';
    default:
      return '-';
  }
}

function formatJobPosition(jobPosition: string | null): string {
  if (!jobPosition) return '';
  const trimmed = jobPosition.trim();
  if (!trimmed) return '';
  if (trimmed === 'chief_judge' || trimmed === '????????????????????') {
    return 'ผู้พิพากษาหัวหน้าศาล';
  }
  if (trimmed === 'associate_judge' || trimmed === '??????????????') {
    return 'ผู้พิพากษาสมทบ';
  }
  return trimmed;
}

function formatTravelMode(mode: string | null, other: string | null): string {
  switch (mode) {
    case 'car':
      return 'รถยนต์ส่วนตัว';
    case 'van':
      return 'รถตู้';
    case 'bus':
      return 'รถบัส';
    case 'train':
      return 'รถไฟ';
    case 'plane':
      return 'เครื่องบิน';
    case 'motorcycle':
      return 'มอเตอร์ไซค์';
    case 'other': {
      const extra = (other ?? '').trim();
      return extra ? `อื่น ๆ: ${extra}` : 'อื่น ๆ';
    }
    default:
      return '-';
  }
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
  if (!checkedInAt) return 'ยังไม่เช็กอิน';
  const date = new Date(checkedInAt);
  if (Number.isNaN(date.getTime())) return 'ยังไม่เช็กอิน';
  const formatted = date.toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: '2-digit',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `เช็กอินแล้ว ${formatted}`;
}
// ตั้งคอลัมน์และ header ให้ชีตแต่ละภาค
function setupSheetColumns(sheet: ExcelJS.Worksheet) {
  sheet.columns = [
    { header: 'คำนำหน้า', key: 'name_prefix', width: 12 },
    { header: 'ชื่อ-สกุล', key: 'full_name', width: 30 },
    { header: 'โทรศัพท์', key: 'phone', width: 16 },
    { header: 'หน่วยงาน', key: 'organization', width: 28 },
    { header: 'ตำแหน่ง', key: 'job_position', width: 24 },
    { header: 'จังหวัด', key: 'province', width: 18 },
    { header: 'ภาค', key: 'region', width: 12 },
    { header: 'อาหาร', key: 'food_type', width: 18 },
    { header: 'คำนำหน้าผู้ประสานงาน', key: 'coordinator_prefix', width: 20 },
    { header: 'ผู้ประสานงาน', key: 'coordinator_name', width: 26 },
    { header: 'เบอร์ผู้ประสานงาน', key: 'coordinator_phone', width: 20 },
    { header: 'โรงแรม', key: 'hotel_name', width: 24 },
    { header: 'วิธีเดินทาง', key: 'travel_mode', width: 20 },
    { header: 'วิธีเดินทางอื่น ๆ', key: 'travel_other', width: 24 },
    { header: 'สถานะเช็กอิน', key: 'checkin_status', width: 16 },
    { header: 'เช็กอินรอบ 1', key: 'checkin_round1_at', width: 18 },
    { header: 'เช็กอินรอบ 2', key: 'checkin_round2_at', width: 18 },
    { header: 'เช็กอินรอบ 3', key: 'checkin_round3_at', width: 18 },
    { header: 'สลิป (ลิงก์)', key: 'slip', width: 20 },
    { header: 'รหัสบัตร', key: 'ticket_token', width: 26 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // ให้หัวตารางค้างไว้ เวลาเลื่อนลง
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

    // ✅ รองรับ region = 0 (ศาลกลาง) + 1–9
    const regionParam = req.nextUrl.searchParams.get('region');
    const regionNumberRaw = regionParam !== null ? Number(regionParam) : Number.NaN;

    const hasRegionFilter =
      Number.isFinite(regionNumberRaw) &&
      regionNumberRaw >= 0 &&
      regionNumberRaw <= 9;

    const regionFilter: number | null = hasRegionFilter ? regionNumberRaw : null;

    let query = supabase
      .from('v_attendees_checkin_rounds')
      .select(
        `
        event_id,
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
      `,
      )
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

    const { data, error } = await query;

    if (error || !data) {
      console.error('export-attendees supabase error:', error);
      return NextResponse.json(
        { success: false, message: 'ไม่สามารถดึงข้อมูลผู้เข้าร่วมได้', error },
        { status: 500 },
      );
    }

    const attendees = data as DbAttendee[];

    const workbook = new ExcelJS.Workbook();
    if (regionFilter !== null) {
      if (regionFilter === 0) {
        const sheet = workbook.addWorksheet('ส่วนกลาง');
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
        const sheet = workbook.addWorksheet('ไม่มีข้อมูล');
        setupSheetColumns(sheet);
      }

      const fileArrayBuffer = await workbook.xlsx.writeBuffer();
      const filename =
        regionFilter === 0
          ? 'attendees-central-court.xlsx'
          : `attendees-region-${regionFilter}-by-organization.xlsx`;

      return new NextResponse(fileArrayBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const centralSheet = workbook.addWorksheet('ส่วนกลาง');
    setupSheetColumns(centralSheet);

    const regionSheets: Record<string, ExcelJS.Worksheet> = {};
    for (let r = 1; r <= 9; r += 1) {
      const sheet = workbook.addWorksheet(`ภาค ${r}`);
      setupSheetColumns(sheet);
      regionSheets[String(r)] = sheet;
    }

    let otherSheet: ExcelJS.Worksheet | null = null;
    const getOtherSheet = () => {
      if (!otherSheet) {
        otherSheet = workbook.addWorksheet('ไม่ระบุภาค');
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
    const filename = 'attendees-by-region.xlsx';

    return new NextResponse(fileArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('export-attendees unexpected error:', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: `เกิดข้อผิดพลาด: ${msg}` },
      { status: 500 },
    );
  }
}












