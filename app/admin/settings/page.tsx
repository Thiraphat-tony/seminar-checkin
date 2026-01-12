import { redirect } from 'next/navigation';
import { requireStaffForPage } from '@/lib/requireStaffForPage';
import AdminNav from '../AdminNav';
import SettingsForm from './SettingsForm';
import StaffDeleteButton from './StaffDeleteButton';
import '../admin-page.css';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const { supabase, staff } = await requireStaffForPage({ redirectTo: '/login' });
  const provinceKey = (staff?.province_key ?? '').trim().toUpperCase();
  const isSurat =
    provinceKey === 'SRT' || (staff?.province_name ?? '').includes('สุราษฎร์ธานี');

  if (!staff || !isSurat) {
    redirect('/admin');
  }

  const eventId = (process.env.EVENT_ID ?? '').trim();

  if (!eventId) {
    return (
      <div className="page-wrap">
        <div className="page-gradient" />
        <main className="admin-layout">
          <header className="admin-header">
            <div className="admin-header__top">
              <div>
                <div className="attendee-header__badge">แอดมิน</div>
                <h1 className="admin-header__title">ตั้งค่าการเข้าถึงงานสัมมนา</h1>
                <p className="admin-header__subtitle">ยังไม่ได้ตั้งค่า EVENT_ID</p>
              </div>
            </div>
            <AdminNav />
          </header>
        </main>
      </div>
    );
  }

  const { data: event, error } = await supabase
    .from('events')
    .select('id, name, registration_open, checkin_open')
    .eq('id', eventId)
    .maybeSingle();

  if (error || !event) {
    return (
      <div className="page-wrap">
        <div className="page-gradient" />
        <main className="admin-layout">
          <header className="admin-header">
            <div className="admin-header__top">
              <div>
                <div className="attendee-header__badge">แอดมิน</div>
                <h1 className="admin-header__title">ตั้งค่าการเข้าถึงงานสัมมนา</h1>
                <p className="admin-header__subtitle">ไม่สามารถโหลดการตั้งค่าได้</p>
                <p className="card__debug">
                  <code>{error?.message ?? 'EVENT_NOT_FOUND'}</code>
                </p>
              </div>
            </div>
            <AdminNav />
          </header>
        </main>
      </div>
    );
  }

  const registrationOpen = event.registration_open !== false;
  const checkinOpen = event.checkin_open !== false;
  const eventName = event.name ?? null;
  const currentUserId = staff?.user_id ?? '';

  const { data: staffProfiles, error: staffProfilesError } = await supabase
    .from('staff_profiles')
    .select('user_id, province_name, province_key, role')
    .order('province_name', { ascending: true });

  const staffRows = (staffProfiles ?? []).map((row) => {
    const provinceName = (row.province_name ?? '').trim();
    const provinceKey = (row.province_key ?? '').trim().toUpperCase();
    const roleLabel = row.role === 'super_admin' ? 'ซูเปอร์แอดมิน' : 'แอดมินจังหวัด';
    const email = provinceKey ? `${provinceKey}@staff.local` : '-';
    return {
      id: row.user_id,
      provinceName,
      provinceKey,
      email,
      role: row.role,
      isSelf: row.user_id === currentUserId,
      roleLabel,
    };
  });

  const uniqueProvinceCount = new Set(
    staffRows.map((row) => row.provinceName).filter((name) => name.length > 0),
  ).size;

  return (
    <div className="page-wrap">
      <div className="page-gradient" />
      <main className="admin-layout">
        <header className="admin-header">
          <div className="admin-header__top">
            <div>
              <div className="attendee-header__badge">แอดมิน</div>
              <h1 className="admin-header__title">ตั้งค่าการเข้าถึงงานสัมมนา</h1>
              <p className="admin-header__subtitle">
                เปิด/ปิดการลงทะเบียนและการเช็คอินหน้างาน
              </p>
            </div>
          </div>
          <AdminNav />
        </header>

        <SettingsForm
          eventId={event.id}
          eventName={eventName}
          initialRegistrationOpen={registrationOpen}
          initialCheckinOpen={checkinOpen}
        />
        <section className="admin-form__section admin-settings">
          <div className="admin-settings__header">
            <div>
              <h2 className="admin-form__title">
                การจัดการ admin ทั้งหมดของ 77 จังหวัด
              </h2>
              <p className="admin-settings__event">
                เพิ่ม แก้ไข และรีเซ็ตรหัสผ่านแอดมินประจำจังหวัด
              </p>
            </div>
          </div>
          <div className="admin-settings__grid">
            <div className="admin-settings__card">
              <div className="admin-settings__row">
                <div className="admin-settings__info">
                  <p className="admin-settings__label">เพิ่มแอดมินจังหวัด</p>
                  <p className="admin-settings__hint">
                    สร้างบัญชีแอดมินใหม่สำหรับจังหวัดที่ต้องการ
                  </p>
                </div>
                <div className="admin-settings__status">
                  <a
                    className="admin-form__button admin-form__button--primary admin-settings__button"
                    href="/staff/register"
                  >
                    ไปหน้าสร้างแอดมิน
                  </a>
                </div>
              </div>
            </div>
            <div className="admin-settings__card">
              <div className="admin-settings__row">
                <div className="admin-settings__info">
                  <p className="admin-settings__label">รีเซ็ตรหัสผ่านแอดมินจังหวัด</p>
                  <p className="admin-settings__hint">
                    กำหนดรหัสผ่านใหม่ให้แอดมินประจำจังหวัด
                  </p>
                </div>
                <div className="admin-settings__status">
                  <a
                    className="admin-form__button admin-form__button--primary admin-settings__button"
                    href="/manager"
                  >
                    ไปหน้าจัดการรหัสผ่าน
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="admin-form__section admin-settings">
          <div className="admin-settings__header">
            <div>
              <h2 className="admin-form__title">รายชื่อแอดมินจังหวัดในระบบ</h2>
              <p className="admin-settings__event">
                มีแล้ว {uniqueProvinceCount} จังหวัด จาก 77 · ทั้งหมด {staffRows.length} บัญชี
              </p>
            </div>
          </div>
          {staffProfilesError ? (
            <p className="admin-settings__message admin-settings__message--error">
              ไม่สามารถโหลดรายชื่อแอดมินได้
            </p>
          ) : (
            <div className="admin-table__wrapper">
              <div className="admin-table__inner">
                <table className="admin-table">
                    <thead>
                      <tr className="admin-table__head-row">
                        <th>#</th>
                        <th>จังหวัด</th>
                        <th>รหัสจังหวัด</th>
                        <th>อีเมลล็อกอิน</th>
                        <th>สิทธิ์</th>
                        <th>ลบ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="admin-table__empty">
                            ยังไม่มีข้อมูลแอดมินในระบบ
                          </td>
                        </tr>
                    ) : (
                      staffRows.map((row, index) => (
                        <tr key={`${row.id}-${index}`}>
                          <td>{index + 1}</td>
                          <td>{row.provinceName || '-'}</td>
                          <td>{row.provinceKey ? <code>{row.provinceKey}</code> : '-'}</td>
                          <td>{row.email !== '-' ? <code>{row.email}</code> : '-'}</td>
                          <td>{row.roleLabel}</td>
                          <td>
                            <StaffDeleteButton
                              userId={row.id}
                              provinceName={row.provinceName}
                              role={row.role}
                              isSelf={row.isSelf}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
