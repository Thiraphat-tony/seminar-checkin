// app/api/admin/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { createServerClient } from '@/lib/supabaseServer';
import { phoneForStorage } from '@/lib/phone';

// ให้ตรง constraint ใน DB (เหลือ 3 แบบ)
type FoodType = 'normal' | 'vegetarian' | 'halal';

// row ที่เตรียมแล้วสำหรับใส่ใน attendees
type PreparedRow = {
  event_id: string | null;
  full_name: string;
  ticket_token: string;
  phone: string | null;
  organization: string | null;
  job_position: string | null;
  province: string | null;
  region: number | null; // 0–9 (0 = ศาลกลาง)
  qr_image_url: string | null;
  food_type: FoodType | null;
  coordinator_name: string | null;
  coordinator_phone: string | null;
  hotel_name: string | null;
};

// raw row จาก Excel
type RawMappedRow = Partial<Record<keyof PreparedRow, any>>;

// แปลงค่าจาก Excel → food_type ที่ใช้ใน DB (3 ค่า)
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
    .replace(/[\s._\-\/\\(){}\[\]]+/g, '')
    .trim();
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
    'ชื่อและนามสกุล',
    'ชื่อ',
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
    'โทเคน',
    'หมายเลขบัตร',
    'หมายเลขตั๋ว',
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
  if (normalized.includes('token')) return 'ticket_token';
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
  if (normalized.includes('hotel') || normalized.includes('โรงแรม') || normalized.includes('ที่พัก')) {
    return 'hotel_name';
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
  const full_name = row.full_name ?? null;
  const ticket_token = row.ticket_token ?? null;
  const phone = row.phone ?? null;
  const organization = row.organization ?? null;
  const job_position = row.job_position ?? null;
  const province = row.province ?? null;
  const region_raw = row.region ?? null;
  const qr_image_url = row.qr_image_url ?? null;
  const food_type_raw = row.food_type ?? null;
  const coordinator_name = row.coordinator_name ?? null;
  const coordinator_phone = row.coordinator_phone ?? null;
  const hotel_name = row.hotel_name ?? null;
  const event_id = row.event_id ?? null;

  // ถ้าไม่มีชื่อหรือไม่มี token → ข้าม
  if (!full_name || !ticket_token) return null;

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

  return {
    event_id: event_id ? String(event_id).trim() : null,
    full_name: String(full_name).trim(),
    ticket_token: String(ticket_token).trim(),
    phone: normalizedPhone,
    organization: organization ? String(organization).trim() : null,
    job_position: job_position ? String(job_position).trim() : null,
    province: province ? String(province).trim() : null,
    region: regionNum,
    qr_image_url: qr_image_url ? String(qr_image_url).trim() : null,
    food_type: normalizeFoodType(food_type_raw),
    coordinator_name: coordinator_name ? String(coordinator_name).trim() : null,
    coordinator_phone: normalizedCoordinatorPhone,
    hotel_name: hotel_name ? String(hotel_name).trim() : null,
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
        headerKeys[colNum - 1] = mapHeaderToKey(rawHeader);
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
    if (totalDataRows === 0) {
      return NextResponse.json(
        {
          ok: false,
          message:
            'ไม่พบข้อมูลในไฟล์ Excel (ทุกชีตไม่มีข้อมูล แถวข้อมูล หรือ header ไม่ถูกต้อง)',
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
            'ไม่พบข้อมูลที่พร้อมนำเข้า (ตรวจสอบว่ามีคอลัมน์ ชื่อ-นามสกุล และ Token/รหัสบัตร และมีข้อมูลอย่างน้อย 1 แถวในอย่างน้อย 1 ชีต)',
        },
        { status: 400 },
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
        { status: 400 },
      );
    }

    const eventId = events[0].id as string;

    // 6) upsert ลง attendees ตาม schema ใหม่
    let importedCount = 0;

    for (let i = 0; i < prepared.length; i += UPSERT_BATCH_SIZE) {
      const slice = prepared.slice(i, i + UPSERT_BATCH_SIZE);
      const { error: insertError } = await supabase
        .from('attendees')
        .upsert(
          slice.map((row) => ({
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
