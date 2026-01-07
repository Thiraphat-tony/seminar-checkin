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

    if (regionFilter !== null) {
      query = query.eq('region', regionFilter);
    }

    const { data, error } = await query;

    if (error || !data) {
      console.error('export-attendees supabase error:', error);
      return NextResponse.json(
        { success: false, message: 'ดึงข้อมูลไม่สำเร็จ', error },
        { status: 500 },
      );
    }

    const attendees = data as DbAttendee[];

    const workbook = new ExcelJS.Workbook();

    // -------------------- โหมด 1: export เฉพาะภาคเดียว (มี ?region=) --------------------
    if (regionFilter !== null) {
      const sheetName = regionFilter === 0 ? 'ส่วนกลาง' : `ภาค ${regionFilter}`;
      const sheet = workbook.addWorksheet(sheetName);
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
          checkin_status: a.checked_in_at ? 'เช็กอินแล้ว' : 'ยังไม่เช็กอิน',
          slip: '',
          ticket_token: a.ticket_token ?? '',
        });

        setSlipLink(row.getCell('slip'), a.slip_url, a.province);
      }

      const fileArrayBuffer = await workbook.xlsx.writeBuffer();
      const filename =
        regionFilter === 0
          ? 'attendees-central-court.xlsx'
          : `attendees-region-${regionFilter}.xlsx`;

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
        checkin_status: a.checked_in_at ? 'เช็กอินแล้ว' : 'ยังไม่เช็กอิน',
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
