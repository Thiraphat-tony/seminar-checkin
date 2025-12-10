// app/api/admin/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { createServerClient } from '@/lib/supabaseServer';

// raw row จาก Excel
type RawExcelRow = { [key: string]: any };

// ให้ตรง constraint ใน DB
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
  full_name: string;
  ticket_token: string;
  phone: string | null;
  organization: string | null;
  job_position: string | null;
  province: string | null;
  region: number | null;           // ✅ รองรับ 0–9 (0 = ศาลกลาง)
  qr_image_url: string | null;
  food_type: FoodType | null;
  coordinator_name: string | null;
  hotel_name: string | null;
};

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
      return 'normal';

    // ไม่ทานหมู
    case 'no_pork':
    case 'no pork':
    case 'ไม่ทานหมู':
    case 'ไม่กินหมู':
    case 'งดหมู':
      return 'no_pork';

    // มังสวิรัติ
    case 'vegetarian':
    case 'มังสวิรัติ':
    case 'มังสะวิรัติ':
      return 'vegetarian';

    // เจ / วีแกน
    case 'vegan':
    case 'วีแกน':
    case 'เจ':
    case 'เจ / วีแกน':
      return 'vegan';

    // ฮาลาล
    case 'halal':
    case 'ฮาลาล':
      return 'halal';

    // แพ้อาหารทะเล
    case 'seafood_allergy':
    case 'seafood':
    case 'แพ้อาหารทะเล':
      return 'seafood_allergy';

    // อื่น ๆ
    case 'other':
    case 'อื่น':
    case 'อื่น ๆ':
      return 'other';

    default:
      // ถ้าไม่รู้จัก ให้จัดเป็น 'other' แทนจะได้ไม่ชน constraint
      return 'other';
  }
}

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
        { status: 400 }
      );
    }

    // 2) อ่านไฟล์ Excel ด้วย ExcelJS
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    const worksheet = workbook.getWorksheet(1);

    if (!worksheet) {
      return NextResponse.json(
        {
          ok: false,
          message: 'ไฟล์ Excel ไม่มี sheet ใดเลย',
        },
        { status: 400 }
      );
    }

    // อ่านแถวข้อมูล
    const rows: RawExcelRow[] = [];
    const headers: string[] = [];

    // อ่านส่วนหัว
    const headerRow = worksheet.getRow(1);
    headerRow?.eachCell((cell, colNum) => {
      headers[colNum - 1] = String(cell.value || '').trim();
    });

    // อ่านข้อมูล
    worksheet.eachRow((row, rowNum) => {
      if (rowNum === 1) return; // ข้าม header
      const obj: RawExcelRow = {};
      row.eachCell((cell, colNum) => {
        const header = headers[colNum - 1];
        if (header) {
          obj[header] = cell.value ?? null;
        }
      });
      if (Object.keys(obj).length > 0) {
        rows.push(obj);
      }
    });

    // 3) map จาก Excel → โครงสร้าง attendees (ตาม schema ใหม่)
    const prepared: PreparedRow[] = rows
      .map((row) => {
        const full_name =
          row.full_name ??
          row['full_name'] ??
          row['ชื่อ-นามสกุล'] ??
          row['ชื่อ-สกุล'] ??
          row['ชื่อ'] ??
          null;

        const ticket_token =
          row.ticket_token ??
          row['ticket_token'] ??
          row['Token'] ??
          row['token'] ??
          row['รหัสบัตร'] ??
          row['โทเคน'] ??
          null;

        const phone =
          row.phone ??
          row['เบอร์โทร'] ??
          row['โทรศัพท์'] ??
          row['phone_number'] ??
          null;

        const organization =
          row.organization ??
          row['หน่วยงาน'] ??
          row['หน่วยงาน/สังกัด'] ??
          row['องค์กร'] ??
          null;

        const job_position =
          row.job_position ??
          row['job_position'] ??
          row['ตำแหน่ง'] ??
          row['ตำแหน่งงาน'] ??
          null;

        const province =
          row.province ??
          row['province'] ??
          row['จังหวัด'] ??
          null;

        const region_raw =
          row.region ??
          row['ภาค'] ??
          row['สังกัดภาค'] ??
          null;

        const qr_image_url =
          row.qr_image_url ??
          row['qr_image_url'] ??
          row['QR URL'] ??
          row['qr_url'] ??
          null;

        const food_type_raw =
          row.food_type ??
          row['food_type'] ??
          row['ประเภทอาหาร'] ??
          null;

        const coordinator_name =
          row.coordinator_name ??
          row['coordinator_name'] ??
          row['ชื่อผู้ประสานงาน'] ??
          row['ผู้ประสานงาน'] ??
          null;

        const hotel_name =
          row.hotel_name ??
          row['โรงแรม'] ??
          row['โรงแรมที่พัก'] ??
          row['ที่พัก'] ??
          null;

        const event_id =
          row.event_id ??
          row['event_id'] ??
          null;

        if (!full_name || !ticket_token) return null;

        // ✅ แปลง region เป็นตัวเลข 0–9
        // 0 = ศาลเยาวชนและครอบครัวกลาง
        let regionNum: number | null = null;
        if (region_raw != null) {
          const rawStr = String(region_raw).trim();

          // เผื่อกรณีเขียนเป็นข้อความในไฟล์
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

        return {
          event_id: event_id ? String(event_id).trim() : null,
          full_name: String(full_name).trim(),
          ticket_token: String(ticket_token).trim(),
          phone: phone ? String(phone).trim() : null,
          organization: organization ? String(organization).trim() : null,
          job_position: job_position ? String(job_position).trim() : null,
          province: province ? String(province).trim() : null,
          region: regionNum,
          qr_image_url: qr_image_url ? String(qr_image_url).trim() : null,
          food_type: normalizeFoodType(food_type_raw),
          coordinator_name: coordinator_name
            ? String(coordinator_name).trim()
            : null,
          hotel_name: hotel_name ? String(hotel_name).trim() : null,
        };
      })
      .filter(Boolean) as PreparedRow[];

    // 4) เช็กกรณีไม่พบข้อมูลที่นำเข้า
    if (prepared.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message:
            'ไม่พบข้อมูลที่พร้อมนำเข้า (ตรวจสอบว่ามีคอลัมน์ ชื่อ-นามสกุล และ Token ในไฟล์ หรือมีข้อมูลอย่างน้อย 1 แถว)',
        },
        { status: 400 }
      );
    }

    // 5) ดึง event ตัวแรกมาใช้เป็น event_id
    const { data: events, error: eventError } = await supabase
      .from('events')
      .select('id')
      .limit(1);

    if (eventError || !events || events.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message:
            'ไม่พบ event ในฐานข้อมูล กรุณาสร้างรายการ event ก่อนจึงจะนำเข้ารายชื่อได้',
        },
        { status: 400 }
      );
    }

    const eventId = events[0].id as string;

    // 6) upsert ลง attendees ตาม schema ใหม่
    const { data: inserted, error: insertError } = await supabase
      .from('attendees')
      .upsert(
        prepared.map((row) => ({
          event_id: eventId,
          full_name: row.full_name,
          phone: row.phone,
          organization: row.organization,
          job_position: row.job_position,
          province: row.province,
          region: row.region,
          qr_image_url: row.qr_image_url,
          food_type: row.food_type,
          coordinator_name: row.coordinator_name,
          hotel_name: row.hotel_name,
          ticket_token: row.ticket_token,
        })),
        { onConflict: 'ticket_token' }
      )
      .select('id');

    if (insertError) {
      console.error('IMPORT INSERT ERROR', insertError);
      return NextResponse.json(
        {
          ok: false,
          message:
            'เกิดข้อผิดพลาดระหว่างการบันทึกข้อมูลเข้าฐานข้อมูล (เช่น ticket_token ซ้ำ หรือข้อมูลไม่ตรง constraint)',
          detail: insertError.message,
        },
        { status: 500 }
      );
    }

    // 7) ตอบกลับสำเร็จ
    return NextResponse.json({
      ok: true,
      imported: inserted?.length ?? 0,
      message: `นำเข้าข้อมูลสำเร็จ ${inserted?.length ?? 0} รายการ`,
    });
  } catch (err) {
    console.error('IMPORT ROUTE ERROR', err);
    return NextResponse.json(
      {
        ok: false,
        message: 'เกิดข้อผิดพลาดระหว่างการประมวลผลไฟล์',
      },
      { status: 500 }
    );
  }
}
