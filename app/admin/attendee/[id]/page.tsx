// ❌ ไม่ใช้ไฟล์เฉพาะแล้ว
// import './attendee-edit-page.css';

// ✅ ใช้ CSS รวมของหน้า admin
import '../../admin-page.css';

import { createServerClient } from '@/lib/supabaseServer';
import AttendeeEditForm from '../../AttendeeEditForm';
import AdminNav from '../../AdminNav';

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = 'force-dynamic';

export default async function AttendeeEditPage({ params }: PageProps) {
  const { id } = await params;
  const token = id;

  if (!token) {
    return (
      <div className="page-wrap page-wrap--center">
        <div className="card">
          <div className="card__icon-badge card__icon-badge--error">
            <span>!</span>
          </div>
          <h1 className="card__title">ไม่พบข้อมูลผู้เข้าร่วม</h1>
          <p className="card__subtitle">
            ไม่สามารถอ่าน Token จาก URL ได้อย่างถูกต้อง กรุณากลับไปหน้าแอดมินแล้วลองใหม่อีกครั้ง
          </p>
          <p className="card__debug">
            <code>token from params is invalid</code>
          </p>
          <a href="/admin" className="admin-filters__link-reset">
            ← กลับไปหน้า Admin
          </a>
        </div>
      </div>
    );
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('attendees')
    .select(
      `
      id,
      full_name,
      phone,
      organization,
      job_position,
      province,
      region,
      hotel_name,
      ticket_token
    `
    )
    .eq('ticket_token', token)
    .single();

  if (error || !data) {
    return (
      <div className="page-wrap page-wrap--center">
        <div className="card">
          <div className="card__icon-badge card__icon-badge--error">
            <span>!</span>
          </div>
          <h1 className="card__title">ไม่พบข้อมูลผู้เข้าร่วม</h1>
          <p className="card__subtitle">
            ไม่สามารถโหลดข้อมูลผู้เข้าร่วมได้ กรุณากลับไปหน้าแอดมินแล้วลองใหม่อีกครั้ง
          </p>
          <p className="card__debug">
            <code>{error?.message}</code>
          </p>
          <a href="/admin" className="admin-filters__link-reset">
            ← กลับไปหน้า Admin
          </a>
        </div>
      </div>
    );
  }

  // สร้างตัวอักษรแรกจากชื่อสำหรับ avatar
  const getInitial = (name: string | null) => {
    if (!name) return '👤';
    return name.trim().charAt(0).toUpperCase();
  };

  return (
    <div className="page-wrap">
      <div className="page-gradient" />
      <main className="admin-layout attendee-edit-page">
        <header className="admin-header attendee-edit-header">
          <div className="admin-header__top">
            <div>
              {/* Breadcrumb */}
              <nav className="attendee-edit-breadcrumb">
                <a href="/admin">แอดมิน</a>
                <span className="attendee-edit-breadcrumb__separator">›</span>
                <span className="attendee-edit-breadcrumb__current">
                  แก้ไขผู้เข้าร่วม
                </span>
              </nav>

              {/* Badge */}
              <div className="attendee-edit-header__badge">
                ADMIN • แก้ไขผู้เข้าร่วม
              </div>

              <h1 className="admin-header__title attendee-edit-header__title">
                แก้ไขข้อมูลผู้เข้าร่วมงานสัมมนา
              </h1>
              <p className="admin-header__subtitle attendee-edit-header__subtitle">
                ปรับแก้ชื่อ เบอร์โทร หน่วยงาน ตำแหน่ง และจังหวัดของผู้เข้าร่วม
              </p>

              {/* Status Indicator */}
              <div className="attendee-edit-status attendee-edit-status--editing">
                กำลังแก้ไขข้อมูล
              </div>
            </div>
          </div>

          <AdminNav />
        </header>

        {/* User Info Card */}
        <section className="attendee-edit-userinfo">
          <div className="attendee-edit-userinfo__avatar">
            {getInitial(data.full_name)}
          </div>
          <div className="attendee-edit-userinfo__details">
            <h2 className="attendee-edit-userinfo__name">
              {data.full_name || 'ไม่ระบุชื่อ'}
            </h2>
            <p className="attendee-edit-userinfo__token">
              Token: <span>{data.ticket_token}</span>
            </p>
            <p className="attendee-edit-userinfo__org">
              {data.organization || 'ไม่ระบุหน่วยงาน'}
            </p>
          </div>
        </section>

        {/* Edit Form */}
        <AttendeeEditForm attendee={data} />

        {/* Action Buttons */}
        <section className="attendee-edit-actions">
          <a
            href="/admin"
            className="attendee-edit-action-btn attendee-edit-action-btn--back"
          >
            กลับไปหน้าแอดมิน
          </a>
          <a
            href={`/attendee/${data.ticket_token}`}
            className="attendee-edit-action-btn attendee-edit-action-btn--view"
            target="_blank"
            rel="noopener noreferrer"
          >
            ดูหน้าผู้เข้าร่วม
          </a>
        </section>

        {/* Help Section */}
        <section className="attendee-edit-help">
          <h3 className="attendee-edit-help__title">คำแนะนำในการแก้ไข</h3>
          <ul className="attendee-edit-help__list">
            <li>ตรวจสอบข้อมูลให้ถูกต้องก่อนกดบันทึก</li>
            <li>เบอร์โทรศัพท์จะถูกใช้สำหรับการติดต่อกับผู้เข้าร่วม</li>
            <li>
              ชื่อ หน่วยงาน ตำแหน่ง และจังหวัด
              อาจถูกนำไปใช้แสดงบนเอกสารหรือรายงานต่าง ๆ
            </li>
            <li>Token ไม่สามารถแก้ไขได้เพื่อความปลอดภัยของระบบ</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
