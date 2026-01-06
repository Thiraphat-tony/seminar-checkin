// app/api/admin/delete-attendee/route.ts
import { NextResponse } from 'next/server';
import { requireStaffForApi } from '@/lib/requireStaffForApi';

type DeleteBody = {
  attendeeId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DeleteBody;
    const attendeeId = body.attendeeId;

    if (!attendeeId) {
      return NextResponse.json(
        {
          ok: false,
          message: 'กรุณาระบุ attendeeId',
        },
        { status: 400 }
      );
    }

    const auth = await requireStaffForApi(request);
    if (!auth.ok) return auth.response;
    const { supabase, staff } = auth;
    // Log attempt for debugging
    console.log('Attempt delete attendee', { attendeeId, staff_user: staff.user_id, staff_province: staff.province_name, staff_role: staff.role });

    let delQuery = supabase
      .from('attendees')
      .delete()
      .eq('id', attendeeId);

    // If not super_admin, restrict by province — but staff from สุราษฎร์ธานี can operate across provinces (same logic as admin page)
    if (staff.role !== 'super_admin') {
      const prov = (staff.province_name ?? '').trim();
      const isSurat = prov.includes('สุราษฎร์');
      if (prov && !isSurat) {
        delQuery = delQuery.eq('province', prov);
      }
    }

    // Request deleted rows back to confirm deletion
    const { data, error } = await delQuery.select('id');

    if (error) {
      console.error('Delete attendee error:', error);
      return NextResponse.json(
        {
          ok: false,
          message: 'ลบข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
          error: error.message,
        },
        { status: 500 }
      );
    }

    // If nothing was deleted, return 404 so client can show appropriate message
    if (!data || (Array.isArray(data) && data.length === 0)) {
      console.warn('Delete attendee: no matching row found for delete', { attendeeId, staff_user: staff.user_id, staff_province: staff.province_name });
      return NextResponse.json(
        {
          ok: false,
          message: 'ไม่พบผู้เข้าร่วมที่ต้องการลบ หรือคุณไม่มีสิทธิ์ลบข้อมูลนี้',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: 'ลบข้อมูลผู้เข้าร่วมเรียบร้อยแล้ว',
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('Delete attendee unexpected error:', err);
    return NextResponse.json(
      {
        ok: false,
        message: 'เกิดข้อผิดพลาดไม่คาดคิดระหว่างลบข้อมูล',
      },
      { status: 500 }
    );
  }
}
