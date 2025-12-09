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
  coordinator_name: string | null; // 👈 เพิ่มบรรทัดนี้
};

// เดานามสกุลรูปจาก URL
function getImageExtension(url: string): 'png' | 'jpeg' | null {
  const lower = url.toLowerCase();
  if (lower.endsWith('.png')) return 'png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'jpeg';
  return null;
}

// ดึงรูปจาก URL เป็น Buffer
async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch (e) {
    console.error('fetchImageBuffer error', e);
    return null;
  }
}

// แปลง code ประเภทอาหารเป็นภาษาไทย
function formatFoodType(foodType: string | null): string {
  switch (foodType) {
    case 'normal':
      return 'อาหารทั่วไป';
    case 'vegetarian':
      return 'มังสวิรัติ';
    case 'halal':
      return 'ฮาลาล';
    default:
      return 'ไม่ระบุ';
  }
}

export async function GET(req: NextRequest) {
  const supabase = createServerClient();

  const regionParam = req.nextUrl.searchParams.get('region');
  const regionNumber = regionParam ? Number(regionParam) : Number.NaN;
  const regionFilter = Number.isFinite(regionNumber) && regionNumber >= 1 && regionNumber <= 9
    ? regionNumber
    : null;

  // ❌ ไม่ใส่ generic <DbAttendee> ที่ select แล้ว ให้ TS จัดการเอง
  const query = supabase
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
      coordinator_name
    `
    )
    .order('full_name', { ascending: true });

  if (regionFilter) {
    query.eq('region', regionFilter);
  }

  const { data, error } = await query;

  if (error || !data) {
    return NextResponse.json(
      { success: false, message: 'โหลดข้อมูลไม่สำเร็จ', error },
      { status: 500 }
    );
  }

  // ✅ cast ตรงนี้แทน ให้ data กลายเป็น DbAttendee[]
  const attendees = data as DbAttendee[];

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Attendees');

  sheet.columns = [
    { header: 'ชื่อ-นามสกุล', key: 'full_name', width: 30 },
    { header: 'เบอร์โทร', key: 'phone', width: 16 },
    { header: 'หน่วยงาน', key: 'organization', width: 28 },
    { header: 'ตำแหน่ง', key: 'job_position', width: 24 },
    { header: 'จังหวัด', key: 'province', width: 18 },
    { header: 'ภาค', key: 'region', width: 12 },
    { header: 'ประเภทอาหาร', key: 'food_type', width: 18 },
    { header: 'ชื่อผู้ประสานงาน', key: 'coordinator_name', width: 26 },
    { header: 'โรงแรม', key: 'hotel_name', width: 24 },
    { header: 'สถานะเช็กอิน', key: 'checkin_status', width: 16 },
    { header: 'สลิป (รูป)', key: 'slip', width: 20 },
    { header: 'รหัสบัตร', key: 'ticket_token', width: 26 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

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
      hotel_name: a.hotel_name ?? '',
      checkin_status: a.checked_in_at ? 'เช็กอินแล้ว' : 'ยังไม่เช็กอิน',
      slip: '',
      ticket_token: a.ticket_token ?? '',
    });

    const excelRow = row.number;

    // -------- ฝังรูปสลิป (ถ้ามี) --------
    if (a.slip_url) {
      const ext = getImageExtension(a.slip_url);
      if (ext) {
        const imgBuffer = await fetchImageBuffer(a.slip_url);
        if (imgBuffer) {
          const imageId = workbook.addImage({
            buffer: imgBuffer as any,
            extension: ext,
          });

          sheet.addImage(imageId, {
            tl: { col: 10.1, row: excelRow - 0.9 }, // คอลัมน์สลิป (คอลัมน์ที่ 11)
            ext: { width: 90, height: 90 },
          });

          sheet.getRow(excelRow).height = 80;
        }
      }
    }


  }

  const fileArrayBuffer = await workbook.xlsx.writeBuffer();

  const fileSuffix = regionFilter ? `-region-${regionFilter}` : '';
  const filename = `attendees${fileSuffix}.xlsx`;

  return new NextResponse(fileArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        `attachment; filename="${filename}"`,
    },
  });
}
