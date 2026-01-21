// app/admin/settings/page.tsx
import { redirect } from 'next/navigation';
import { requireStaffForPage } from '@/lib/requireStaffForPage';
import AdminNav from '../AdminNav';
import SettingsForm from './SettingsForm';
import StaffDeleteButton from './StaffDeleteButton';
import '../admin-page.css';

export const dynamic = 'force-dynamic';

type StaffRow = {
  id: string;
  courtName: string;
  name_prefix: string;
  phone: string;
  role: string;
  isSelf: boolean;
  roleLabel: string;
};

export default async function AdminSettingsPage() {
  const { supabase, staff } = await requireStaffForPage({ redirectTo: '/login' });
  const isSuperAdmin = staff?.role === 'super_admin';

  if (!staff || !isSuperAdmin) {
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
                <h1 className="admin-header__title">ตั้งค่าการจัดการงานสัมมนา</h1>
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
    .select('id, name, registration_open, checkin_open, checkin_round_open')
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
                <h1 className="admin-header__title">ตั้งค่าการจัดการงานสัมมนา</h1>
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
  const checkinRoundOpen =
    typeof event.checkin_round_open === 'number' ? event.checkin_round_open : 0;
  const eventName = event.name ?? null;
  const currentUserId = staff?.user_id ?? '';

  const { data: staffProfiles, error: staffProfilesError } = await supabase
    .from('staff_profiles')
    .select('user_id, role, name_prefix, phone, courts(court_name)')
    .order('court_id', { ascending: true });

  const staffRows: StaffRow[] = (staffProfiles ?? []).map((row) => {
    const courtRecord = Array.isArray(row.courts) ? row.courts[0] : row.courts;

    const courtName = (courtRecord?.court_name ?? '').trim();
    const name_prefix = (row.name_prefix ?? '').trim();
    const phone = (row.phone ?? '').trim();

    const roleLabel = row.role === 'super_admin' ? 'ซูเปอร์แอดมิน' : 'แอดมินจังหวัด';

    return {
      id: row.user_id,
      courtName,
      name_prefix,
      phone,
      role: row.role,
      isSelf: row.user_id === currentUserId,
      roleLabel,
    };
  });

  const uniqueCourtCount = new Set(
    staffRows.map((row) => row.courtName).filter((name) => name.length > 0),
  ).size;

  return (
    <div className="page-wrap">
      <div className="page-gradient" />
      <main className="admin-layout">
        <header className="admin-header">
          <div className="admin-header__top">
            <div>
              <div className="attendee-header__badge">แอดมิน</div>
              <h1 className="admin-header__title">ตั้งค่าการจัดการงานสัมมนา</h1>
              <p className="admin-header__subtitle">เปิด/ปิดการลงทะเบียน และเปิด/ปิดการเช็คอินหน้างาน</p>
            </div>
          </div>
          <AdminNav />
        </header>

        <SettingsForm
          eventId={event.id}
          eventName={eventName}
          initialRegistrationOpen={registrationOpen}
          initialCheckinOpen={checkinOpen}
          initialCheckinRoundOpen={checkinRoundOpen}
        />

        <section className="admin-form__section admin-settings">
          <div className="admin-settings__header">
            <div>
              <h2 className="admin-form__title">การจัดการแอดมินหน้างาน (รายจังหวัด)</h2>
              <p className="admin-settings__event">เพิ่มบัญชี / รีเซ็ตรหัสผ่าน สำหรับแอดมินจังหวัด</p>
            </div>
          </div>

          <div className="admin-settings__grid">
            <div className="admin-settings__card">
              <div className="admin-settings__row">
                <div className="admin-settings__info">
                  <p className="admin-settings__label">เพิ่มแอดมินจังหวัด</p>
                  <p className="admin-settings__hint">
                    สร้างบัญชีแอดมินใหม่สำหรับจังหวัด/ศาลที่ต้องการให้เข้าจัดการหน้างาน
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
                    กำหนดรหัสผ่านใหม่ให้แอดมินจังหวัด (กรณีลืมรหัส/ต้องการเปลี่ยน)
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
              <h2 className="admin-form__title">รายชื่อแอดมินจังหวัดทั้งหมด</h2>
              <p className="admin-settings__event">
                มีแล้ว {uniqueCourtCount} ศาล · ทั้งหมด {staffRows.length} บัญชี
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
                      <th>ศาล</th>
                      <th>ชื่อผู้จัดการระบบ</th>
                      <th>เบอร์โทร</th>
                      <th>สิทธิ์</th>
                      <th>ลบ</th>
                    </tr>
                  </thead>

                  <tbody>
                    {staffRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="admin-table__empty">
                          ยังไม่มีข้อมูลแอดมินจังหวัด
                        </td>
                      </tr>
                    ) : (
                      staffRows.map((row, index) => (
                        <tr key={`${row.id}-${index}`}>
                          <td>{index + 1}</td>
                          <td>{row.courtName || '-'}</td>

                          {/* ✅ แสดงชื่อผู้จัดการระบบจาก name_prefix */}
                          <td>{row.name_prefix || '-'}</td>

                          <td>{row.phone ? <code>{row.phone}</code> : '-'}</td>
                          <td>{row.roleLabel}</td>
                          <td>
                            <StaffDeleteButton
                              userId={row.id}
                              courtName={row.courtName}
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
