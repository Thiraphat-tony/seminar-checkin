import '../../admin-page.css';

import { requireStaffForPage } from '@/lib/requireStaffForPage';
import AdminNav from '../../AdminNav';
import AdminAttendeesBulkEditForm from './AdminAttendeesBulkEditForm';

type PageProps = {
  searchParams: Promise<{
    ids?: string;
  }>;
};

type BulkAttendeeRow = {
  id: string;
  name_prefix: string | null;
  full_name: string | null;
  phone: string | null;
  job_position: string | null;
  hotel_name: string | null;
  travel_mode: string | null;
  travel_other: string | null;
  food_type: string | null;
};

export const dynamic = 'force-dynamic';

function parseIds(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export default async function AdminBulkEditPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const ids = parseIds(sp.ids);

  const { supabase } = await requireStaffForPage({ redirectTo: '/login' });

  if (ids.length === 0) {
    return (
      <div className="page-wrap page-wrap--center">
        <div className="card">
          <div className="card__icon-badge card__icon-badge--error">
            <span>!</span>
          </div>
          <h1 className="card__title">ไม่พบรายการที่เลือก</h1>
          <p className="card__subtitle">กรุณากลับไปหน้าแอดมิน แล้วเลือกผู้เข้าร่วมอย่างน้อย 1 รายการ</p>
          <a href="/admin" className="admin-filters__link-reset">
            ← กลับไปหน้า Admin
          </a>
        </div>
      </div>
    );
  }

  const { data, error } = await supabase
    .from('attendees')
    .select(
      `
      id,
      name_prefix,
      full_name,
      phone,
      job_position,
      hotel_name,
      travel_mode,
      travel_other,
      food_type
    `,
    )
    .in('id', ids);

  if (error || !data || data.length === 0) {
    return (
      <div className="page-wrap page-wrap--center">
        <div className="card">
          <div className="card__icon-badge card__icon-badge--error">
            <span>!</span>
          </div>
          <h1 className="card__title">ไม่สามารถโหลดข้อมูลผู้เข้าร่วม</h1>
          <p className="card__subtitle">กรุณาลองใหม่อีกครั้ง หรือกลับไปเลือกข้อมูลใหม่จากหน้าแอดมิน</p>
          <p className="card__debug">
            <code>{error?.message ?? 'NO_DATA'}</code>
          </p>
          <a href="/admin" className="admin-filters__link-reset">
            ← กลับไปหน้า Admin
          </a>
        </div>
      </div>
    );
  }

  const orderMap = new Map(ids.map((id, idx) => [id, idx]));
  const attendees = (data as BulkAttendeeRow[]).sort(
    (a, b) => (orderMap.get(a.id) ?? 9999) - (orderMap.get(b.id) ?? 9999),
  );

  return (
    <div className="page-wrap">
      <div className="page-gradient" />
      <main className="admin-layout attendee-edit-page attendee-edit-page--bulk">
        <header className="admin-header attendee-edit-header">
          <div className="admin-header__top">
            <div>
              <nav className="attendee-edit-breadcrumb">
                <a href="/admin">แอดมิน</a>
                <span className="attendee-edit-breadcrumb__separator">›</span>
                <span className="attendee-edit-breadcrumb__current">แก้ไขหลายรายการ</span>
              </nav>

              <div className="attendee-edit-header__badge">ADMIN • BULK EDIT</div>
              <h1 className="admin-header__title attendee-edit-header__title">แก้ไขข้อมูลผู้เข้าร่วมหลายรายการ</h1>
              <p className="admin-header__subtitle attendee-edit-header__subtitle">
                ปรับข้อมูลของผู้เข้าร่วมหลายคนในหน้าเดียวกัน (รูปแบบเดียวกับหน้ากรอกผู้เข้าร่วม)
              </p>
            </div>
          </div>

          <AdminNav />
        </header>

        <AdminAttendeesBulkEditForm attendees={attendees} />
      </main>
    </div>
  );
}
