import { redirect } from 'next/navigation';
import { requireStaffForPage } from '@/lib/requireStaffForPage';
import AdminNav from '../AdminNav';
import SettingsForm from './SettingsForm';
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
      </main>
    </div>
  );
}
