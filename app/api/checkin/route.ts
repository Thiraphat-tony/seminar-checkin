// app/api/checkin/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

type FoodType =
  | 'normal' // อาหารทั่วไป
  | 'no_pork' // ไม่ทานหมู
  | 'vegetarian' // มังสวิรัติ
  | 'vegan' // เจ / วีแกน
  | 'halal' // ฮาลาล
  | 'seafood_allergy' // แพ้อาหารทะเล
  | 'other'; // อื่น ๆ

const ALLOWED_FOOD_TYPES: FoodType[] = [
  'normal',
  'no_pork',
  'vegetarian',
  'vegan',
  'halal',
  'seafood_allergy',
  'other',
];

type JsonResponse = {
  success: boolean;
  message: string;
  checked_in_at?: string | null;
  alreadyCheckedIn?: boolean;
  debug?: Record<string, unknown>;
};

function json(data: JsonResponse, status = 200) {
  return NextResponse.json(data, { status });
}

// เหลือไว้เผื่ออนาคตกลับมาใช้ตรวจเวลา
export async function GET(req: NextRequest) {
  const ticketToken = req.nextUrl.searchParams.get('ticket_token')?.trim();
  if (!ticketToken) {
    return NextResponse.json({ ok: false, message: 'MISSING_TICKET_TOKEN' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data: attendee, error: attendeeError } = await supabase
    .from('attendees')
    .select('id, event_id, checked_in_at')
    .eq('ticket_token', ticketToken)
    .maybeSingle();

  if (attendeeError) {
    return NextResponse.json({ ok: false, message: 'ATTENDEE_QUERY_FAILED' }, { status: 500 });
  }

  if (!attendee) {
    return NextResponse.json({ ok: false, message: 'ATTENDEE_NOT_FOUND' }, { status: 404 });
  }

  if (attendee.checked_in_at) {
    return NextResponse.json({ ok: true, allowed: true, alreadyCheckedIn: true });
  }

  if (!attendee.event_id) {
    return NextResponse.json({ ok: true, allowed: true, checkinOpen: true, withinWindow: true });
  }

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, checkin_open')
    .eq('id', attendee.event_id)
    .maybeSingle();

  if (eventError || !event) {
    return NextResponse.json({ ok: false, message: 'EVENT_NOT_FOUND' }, { status: 500 });
  }

  const checkinOpen = event.checkin_open !== false;
  const allowed = checkinOpen;

  return NextResponse.json({ ok: true, checkinOpen, withinWindow: true, allowed });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body.ticket_token !== 'string') {
      return json(
        {
          success: false,
          message: 'ไม่พบหรือรูปแบบ ticket_token ไม่ถูกต้องในคำขอ',
        },
        400
      );
    }

    const ticketToken = body.ticket_token.trim();
    if (!ticketToken) {
      return json(
        {
          success: false,
          message: 'ticket_token ห้ามเป็นค่าว่าง',
        },
        400
      );
    }

    // ✅ อ่าน food_type จาก body
    const rawFoodType = (body.food_type ?? '') as string;
    let foodType: FoodType = 'normal';

    if (!rawFoodType) {
      foodType = 'normal';
    } else if (
      ALLOWED_FOOD_TYPES.includes(rawFoodType as FoodType)
    ) {
      foodType = rawFoodType as FoodType;
    } else {
      // ถ้าได้ค่าที่ไม่รู้จัก ให้เก็บเป็น other
      foodType = 'other';
    }

    const supabase = createServerClient();

    // ใช้ maybeSingle กันเคส 0 แถวไม่ให้ error 500
    const { data: attendee, error: attendeeError } = await supabase
      .from('attendees')
      .select('id, event_id, checked_in_at, ticket_token, food_type')
      .eq('ticket_token', ticketToken)
      .maybeSingle();

    if (attendeeError) {
      console.error('checkin: attendee query error', attendeeError);
      return json(
        {
          success: false,
          message: 'เกิดข้อผิดพลาดในการค้นหาข้อมูลผู้เข้าร่วม',
        },
        500
      );
    }

    if (!attendee) {
      return json(
        {
          success: false,
          message: 'ไม่พบผู้เข้าร่วมงานจาก ticket_token นี้',
        },
        404
      );
    }

    // ถ้าเช็กอินไปแล้ว ไม่เขียนทับ (ถ้าอยากให้แก้ไขประเภทอาหารแม้เช็กอินแล้ว ค่อยมาเปลี่ยน logic ตรงนี้)
    if (attendee.checked_in_at) {
      return json(
        {
          success: true,
          alreadyCheckedIn: true,
          checked_in_at: attendee.checked_in_at,
          message: 'ผู้เข้าร่วมรายนี้เช็กอินแล้ว',
        },
        200
      );
    }

    // ------------ ข้ามการตรวจช่วงเวลาเช็กอิน (ให้เช็กอินได้ตลอด) ------------

    const nowIso = new Date().toISOString();

    // ถ้าไม่มี event_id ก็เช็กอินให้เลยเหมือนเดิม
    if (!attendee.event_id) {
      const { data: updated, error: updateError } = await supabase
        .from('attendees')
        .update({
          checked_in_at: nowIso,
          food_type: foodType, // ✅ บันทึกประเภทอาหารด้วย
        })
        .eq('id', attendee.id)
        .select('id, checked_in_at, food_type')
        .single();

      if (updateError || !updated) {
        console.error('checkin: update without event failed', updateError);
        return json(
          {
            success: false,
            message: 'เช็กอินไม่สำเร็จ กรุณาลองใหม่หรือติดต่อเจ้าหน้าที่',
          },
          500
        );
      }

      return json(
        {
          success: true,
          alreadyCheckedIn: false,
          checked_in_at: updated.checked_in_at,
          message: 'เช็กอินสำเร็จ',
          debug: { noEventId: true, food_type: updated.food_type },
        },
        200
      );
    }

    // ดึง event แค่เพื่อ debug/อนาคต (ไม่ได้ใช้บล็อกเวลาแล้ว)
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, name, checkin_open')
      .eq('id', attendee.event_id)
      .maybeSingle();

    if (eventError) {
      console.error('checkin: event query error', eventError);
    }

    if (!event) {
      console.warn('checkin: event not found for attendee', {
        attendeeId: attendee.id,
        eventId: attendee.event_id,
      });
    }

    if (event) {
      const checkinOpen = event.checkin_open !== false;

      if (!checkinOpen) {
        return json(
          {
            success: false,
            message: 'CHECKIN_CLOSED',
          },
          403
        );
      }
    }
    const { data: updated, error: updateError } = await supabase
      .from('attendees')
      .update({
        checked_in_at: nowIso,
        food_type: foodType, // ✅ บันทึกประเภทอาหาร
      })
      .eq('id', attendee.id)
      .select('id, checked_in_at, food_type')
      .single();

    if (updateError || !updated) {
      console.error('checkin: update attendee failed', updateError);
      return json(
        {
          success: false,
          message: 'เช็กอินไม่สำเร็จ กรุณาลองใหม่หรือติดต่อเจ้าหน้าที่',
        },
        500
      );
    }

    return json(
      {
        success: true,
        alreadyCheckedIn: false,
        checked_in_at: updated.checked_in_at,
        message: 'เช็กอินสำเร็จ',
        debug: { eventId: attendee.event_id, food_type: updated.food_type },
      },
      200
    );
  } catch (err) {
    console.error('checkin: unexpected error', err);
    return json(
      {
        success: false,
        message: 'เกิดข้อผิดพลาดในระบบเช็กอิน กรุณาลองใหม่หรือติดต่อเจ้าหน้าที่',
      },
      500
    );
  }
}
