// app/api/admin/export-attendees/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import ExcelJS from 'exceljs';
import { Buffer } from 'buffer';

export const runtime = 'nodejs';

// ---- Types จากฐานข้อมูล ----
type DbAttendee = {
  event_id: string | null;
  full_name: string | null;
  organization: string | null;
  province: string | null;
  region: number | null;
  job_position: string | null;
  phone: string | null;
  food_type: string | null;
  hotel_name: string | null;
  checked_in_at: string | null;
  slip_url: string | null;
  qr_image_url: string | null;
  ticket_token: string | null;
  created_at: string | null;
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
    case 'vegetarian':
      return 'มังสวิรัติ';
    case 'halal':
      return 'ฮาลาล';
    default:
      return '-';
  }
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
    { header: 'ชื่อ-สกุล', key: 'full_name', width: 30 },
    { header: 'โทรศัพท์', key: 'phone', width: 16 },
    { header: 'หน่วยงาน', key: 'organization', width: 28 },
    { header: 'ตำแหน่ง', key: 'job_position', width: 24 },
    { header: 'จังหวัด', key: 'province', width: 18 },
    { header: 'ภาค', key: 'region', width: 12 },
    { header: 'อาหาร', key: 'food_type', width: 18 },
    { header: 'ผู้ประสานงาน', key: 'coordinator_name', width: 26 },
    { header: 'เบอร์ผู้ประสานงาน', key: 'coordinator_phone', width: 20 },
    { header: 'โรงแรม', key: 'hotel_name', width: 24 },
    { header: 'สถานะเช็กอิน', key: 'checkin_status', width: 16 },
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
    const supabase = createServerClient();

    // ✅ รองรับ region = 0 (ศาลกลาง) + 1–9
    const regionParam = req.nextUrl.searchParams.get('region');
    const regionNumberRaw = regionParam !== null ? Number(regionParam) : Number.NaN;

    const hasRegionFilter =
      Number.isFinite(regionNumberRaw) &&
      regionNumberRaw >= 0 &&
      regionNumberRaw <= 9;

    const regionFilter: number | null = hasRegionFilter ? regionNumberRaw : null;

    let query = supabase
      .from('attendees')
      .select(
        `
        event_id,
        full_name,
        organization,
        province,
        region,
        job_position,
        phone,
        food_type,
        hotel_name,
        checked_in_at,
        slip_url,
        qr_image_url,
        ticket_token,
        created_at,
        coordinator_name,
        coordinator_phone
      `,
      )
      .order('region', { ascending: true, nullsFirst: false })
      .order('full_name', { ascending: true });

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
        const sheet = workbook.addWorksheet('????????');
        setupSheetColumns(sheet);

        for (const a of attendees) {
          const row = sheet.addRow({
            full_name: a.full_name ?? '',
            phone: a.phone ?? '',
            organization: a.organization ?? '',
            job_position: a.job_position ?? '',
            province: a.province ?? '',
            region: a.region ?? '',
            food_type: formatFoodType(a.food_type ?? null),
            coordinator_name: a.coordinator_name ?? '',
            coordinator_phone: a.coordinator_phone ?? '',
            hotel_name: a.hotel_name ?? '',
            checkin_status: formatCheckinStatus(a.checked_in_at),
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

        for (const a of attendees) {
          const organization = (a.organization ?? '').trim();
          if (!allowedSet.has(organization)) continue;
          const sheet = getOrganizationSheet(organization);
          const row = sheet.addRow({
            full_name: a.full_name ?? '',
            phone: a.phone ?? '',
            organization: a.organization ?? '',
            job_position: a.job_position ?? '',
            province: a.province ?? '',
            region: a.region ?? '',
            food_type: formatFoodType(a.food_type ?? null),
            coordinator_name: a.coordinator_name ?? '',
            coordinator_phone: a.coordinator_phone ?? '',
            hotel_name: a.hotel_name ?? '',
            checkin_status: formatCheckinStatus(a.checked_in_at),
            slip: '',
            ticket_token: a.ticket_token ?? '',
          });

          setSlipLink(row.getCell('slip'), a.slip_url, a.province);
        }
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
        full_name: a.full_name ?? '',
        phone: a.phone ?? '',
        organization: a.organization ?? '',
        job_position: a.job_position ?? '',
        province: a.province ?? '',
        region: a.region ?? '',
        food_type: formatFoodType(a.food_type ?? null),
        coordinator_name: a.coordinator_name ?? '',
        coordinator_phone: a.coordinator_phone ?? '',
        hotel_name: a.hotel_name ?? '',
        checkin_status: formatCheckinStatus(a.checked_in_at),
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









