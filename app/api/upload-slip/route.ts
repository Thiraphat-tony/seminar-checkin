// app/api/upload-slip/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createServerClient } from '@/lib/supabaseServer';
import { makeProvinceKey } from '@/lib/provinceKeys';

export const runtime = 'nodejs';

function makeSafeFilename(value: string) {
  const raw = value.trim();
  if (!raw) return 'unknown';

  // Some provinces can be stored as "สุราษฎร์ธานี (เกาะสมุย)".
  // Strip trailing parenthetical text so province-code mapping still works.
  const normalizedProvince = raw.replace(/\s*\([^)]*\)\s*$/, '').trim() || raw;

  const cleaned = makeProvinceKey(normalizedProvince)
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[\\/:"*?<>|]+/g, '')
    .replace(/\.+$/g, '');

  if (/^[A-Za-z0-9_-]+$/.test(cleaned)) {
    return cleaned.toLowerCase();
  }

  // Fallback for unmapped/non-ASCII provinces.
  const encoded = encodeURIComponent(raw)
    .replace(/%/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '')
    .toLowerCase();

  return encoded.slice(0, 64) || 'unknown';
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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData().catch(() => null);

    if (!formData) {
      return NextResponse.json(
        { success: false, message: 'รูปแบบข้อมูลที่ส่งมาไม่ถูกต้อง (formData)' },
        { status: 400 }
      );
    }

    const attendeeId = formData.get('attendeeId');
    const fileField = formData.get('file');

    if (!attendeeId || typeof attendeeId !== 'string') {
      return NextResponse.json(
        { success: false, message: 'ไม่พบ attendeeId ในคำขอ' },
        { status: 400 }
      );
    }

    if (!(fileField instanceof Blob)) {
      return NextResponse.json(
        { success: false, message: 'ไม่พบไฟล์แนบในคำขอ' },
        { status: 400 }
      );
    }
    const file = fileField;
    const incomingFileName = fileField instanceof File ? fileField.name : '';

    const supabase = createServerClient();

    const { data: attendee, error: attendeeError } = await supabase
      .from('attendees')
      .select('province')
      .eq('id', attendeeId)
      .single();

    if (attendeeError || !attendee) {
      console.error('upload-slip: attendee not found', attendeeError);
      return NextResponse.json(
        {
          success: false,
          message: 'ไม่พบข้อมูลผู้เข้าร่วม อาจถูกลบแล้ว',
        },
        { status: 404 }
      );
    }

    const safeProvince = makeSafeFilename(attendee.province ?? '');

    const safeAttendeeId = attendeeId.replace(/[^a-zA-Z0-9_-]/g, '') || 'unknown';
    const fileExt = resolveFileExt(file, incomingFileName);
    const fileName = `${safeAttendeeId}-${Date.now()}-${randomUUID()}.${fileExt}`;
    const filePath = `slips/${safeProvince}/${fileName}`;
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('payments')
      .upload(filePath, fileBuffer, {
        contentType: file.type || 'image/jpeg',
      });

    if (uploadError || !uploadData) {
      console.error('upload-slip: upload error', uploadError);
      return NextResponse.json(
        {
          success: false,
          message: 'อัปโหลดไฟล์สลิปไม่สำเร็จ กรุณาลองใหม่หรือติดต่อเจ้าหน้าที่',
        },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from('payments')
      .getPublicUrl(uploadData.path);

    const slipUrl = publicUrlData.publicUrl;

    const { data: updated, error: updateError } = await supabase
      .from('attendees')
      .update({ slip_url: slipUrl })
      .eq('id', attendeeId)
      .select('id, slip_url')
      .single();

    if (updateError || !updated) {
      console.error('upload-slip: update attendee error', updateError);
      return NextResponse.json(
        {
          success: false,
          message:
            'บันทึกลิงก์สลิปลงระบบไม่สำเร็จ กรุณาลองใหม่หรือติดต่อเจ้าหน้าที่',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'อัปโหลดสลิปเรียบร้อยแล้ว',
        slipUrl: updated.slip_url,
        slip_url: updated.slip_url,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('upload-slip: unexpected error', err);
    return NextResponse.json(
      {
        success: false,
        message:
          'เกิดข้อผิดพลาดในระบบระหว่างอัปโหลดสลิป กรุณาลองใหม่หรือติดต่อเจ้าหน้าที่',
      },
      { status: 500 }
    );
  }
}
