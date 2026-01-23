// app/admin/namecards/page.tsx
import { requireStaffForPage } from '@/lib/requireStaffForPage';
import AdminNav from '../AdminNav';
import '../admin-page.css';
import { maskPhone } from '@/lib/maskPhone';
import NamecardsFilters from './NamecardsFilters';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<{
    q?: string;
    region?: string;
  }>;
};

type AttendeeCardRow = {
  id: string;
  event_id: string | null;
  name_prefix: string | null;
  full_name: string | null;
  phone: string | null;
  organization: string | null;
  job_position: string | null;
  province: string | null;
  region: number | null;
  qr_image_url: string | null;
  ticket_token: string | null;
  hotel_name: string | null;
};

// Map enum values and legacy "????" strings from old registration encoding.
const JOB_POSITION_LABELS: Record<string, string> = {
  chief_judge: 'ผู้พิพากษาหัวหน้าศาล',
  associate_judge: 'ผู้พิพากษาสมทบ',
  '????????????????????': 'ผู้พิพากษาหัวหน้าศาล',
  '??????????????': 'ผู้พิพากษาสมทบ',
};

function formatJobPosition(jobPosition: string | null, fallback = 'ไม่ระบุตำแหน่ง'): string {
  if (!jobPosition) return fallback;
  const trimmed = jobPosition.trim();
  if (!trimmed) return fallback;
  return JOB_POSITION_LABELS[trimmed] ?? trimmed;
}

// ถ้าใน DB ยังไม่มี qr_image_url ให้ fallback เป็นลิงก์ QR จาก ticket_token
function buildQrUrl(ticketToken: string | null, qrImageUrl: string | null) {
  if (qrImageUrl && qrImageUrl.trim().length > 0) {
    return qrImageUrl;
  }
  if (!ticketToken) return null;
  const encoded = encodeURIComponent(ticketToken);
  return `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encoded}`;
}

export default async function NamecardsPage({ searchParams }: PageProps) {
  const { supabase } = await requireStaffForPage({ redirectTo: '/login' });
  const sp = await searchParams;
  const keywordRaw = (sp.q ?? '').trim();
  const keyword = keywordRaw.toLowerCase();
  const regionParam = sp.region;
  const regionFilter = typeof regionParam === 'string' ? regionParam.trim() : '';
  const regionValue = regionParam == null ? '0' : regionFilter;
  const jobPositionCodes = keyword
    ? Array.from(
        new Set(
          Object.entries(JOB_POSITION_LABELS)
            .filter(([, label]) => label.toLowerCase().includes(keyword))
            .map(([code]) => code),
        ),
      )
    : [];

  const eventId = (process.env.EVENT_ID ?? '').trim();

  if (!eventId) {
    return (
      <div className="page-wrap page-wrap--center">
        <div className="card">
          <div className="card__icon-badge card__icon-badge--error">
            <span>!</span>
          </div>
          <h1 className="card__title">ยังไม่ได้ตั้งค่า EVENT_ID</h1>
          <p className="card__subtitle">
            กรุณาตั้งค่า EVENT_ID ในระบบก่อนใช้งานหน้านามบัตร
          </p>
        </div>
      </div>
    );
  }

  let dataQuery = supabase
    .from('attendees')
    .select(
      `
      id,
      event_id,
      name_prefix,
      full_name,
      phone,
      organization,
      job_position,
      province,
      region,
      qr_image_url,
      ticket_token,
      hotel_name
    `
    )
    .order('full_name', { ascending: true });

  dataQuery = dataQuery.eq('event_id', eventId);

  if (regionValue) {
    dataQuery = dataQuery.eq('region', regionValue);
  }

  if (keywordRaw) {
    const orParts = [
      `full_name.ilike.%${keywordRaw}%`,
      `name_prefix.ilike.%${keywordRaw}%`,
      `organization.ilike.%${keywordRaw}%`,
      `job_position.ilike.%${keywordRaw}%`,
      `province.ilike.%${keywordRaw}%`,
      `ticket_token.ilike.%${keywordRaw}%`,
    ];

    if (jobPositionCodes.length > 0) {
      orParts.push(`job_position.in.(${jobPositionCodes.join(',')})`);
    }

    dataQuery = dataQuery.or(orParts.join(','));
  }

  const { data, error } = await dataQuery;

  if (error || !data) {
    return (
      <div className="page-wrap page-wrap--center">
        <div className="card">
          <div className="card__icon-badge card__icon-badge--error">
            <span>!</span>
          </div>
          <h1 className="card__title">โหลดข้อมูลไม่สำเร็จ</h1>
          <p className="card__subtitle">
            ไม่สามารถโหลดรายชื่อผู้เข้าร่วมสำหรับหน้านามบัตรได้
            กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ
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

  const attendees: AttendeeCardRow[] = data as AttendeeCardRow[];

  return (
    <div className="page-wrap">
      <div className="page-gradient" />

      <main className="admin-layout">
        {/* ---------- Header ---------- */}
        <header className="admin-header">
          <div className="admin-header__top">
            <div>
              <div className="attendee-header__badge">ADMIN • หน้านามบัตร (QR)</div>
              <h1 className="admin-header__title">
                หน้านามบัตรผู้เข้าร่วมงาน (QR Name Cards)
              </h1>
              <p className="admin-header__subtitle">
                แสดงนามบัตรสำหรับผู้เข้าร่วมแต่ละคน พร้อม QR Code ที่ใช้สแกนหน้างาน
                เหมาะสำหรับพิมพ์หรือเปิดบนแท็บเล็ต
              </p>
            </div>
          </div>

          <AdminNav />

          <NamecardsFilters keywordRaw={keywordRaw} regionValue={regionValue} />
        </header>

        {/* ---------- Namecard List ---------- */}
        <section className="namecard-list">
          {attendees.length === 0 ? (
            <p className="admin-table__empty">ไม่พบนามบัตรตามเงื่อนไขที่ค้นหา</p>
          ) : (
            <div className="namecard-grid">
              {attendees.map((a) => {
                const qrUrl = buildQrUrl(a.ticket_token, a.qr_image_url);
                const prefix = (a.name_prefix ?? '').trim();
                const fullName = (a.full_name ?? '').trim();
                const displayName = fullName
                  ? `${prefix ? `${prefix} ` : ''}${fullName}`
                  : prefix || 'ไม่ระบุชื่อ';

                return (
                  <article key={a.id} className="namecard-item">
                    <header className="namecard-item__header">
                      <h2 className="namecard-item__name">
                        {displayName}
                      </h2>
                      <p className="namecard-item__org">
                        หน่วยงาน: {a.organization || 'ไม่ระบุหน่วยงาน'}
                      </p>
                      <p className="namecard-item__job">
                        ตำแหน่ง: {formatJobPosition(a.job_position)}
                      </p>
                      <p className="namecard-item__province">
                        จังหวัด: {a.province || 'ไม่ระบุจังหวัด'}
                      </p>
                      <p className="namecard-item__phone">
                        โทรศัพท์: {maskPhone(a.phone, 'ไม่ระบุ')}
                      </p>
                    </header>

                    <div className="namecard-item__body">
                      <div className="namecard-item__qr">
                        {qrUrl ? (
                          <img src={qrUrl} alt={a.ticket_token || 'QR Code'} />
                        ) : (
                          <span>ไม่มี QR Code</span>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
