// app/admin/page.tsx
import { createServerClient } from '@/lib/supabaseServer';
import ForceCheckinButton from './ForceCheckinButton';
import AdminSlipUploadButton from './AdminSlipUploadButton';
import AdminSlipClearButton from './AdminSlipClearButton';
import AdminNav from './AdminNav';
import AdminImportButton from './AdminImportButton';
import AdminDeleteButton from './AdminDeleteButton';
import AdminFilters from './AdminFilters';

// 👉 นำเข้าไฟล์ CSS ที่สร้างขึ้นมาใช้กับหน้านี้โดยเฉพาะ
import './admin-page.css';

export const dynamic = 'force-dynamic';

type AdminPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string; // all | checked | unchecked
    region?: string;
    organization?: string;
    province?: string; // รองรับ province ใน query string
  }>;
};

type AttendeeRow = {
  id: string;
  event_id: string | null;       // ✅ event_id
  full_name: string | null;
  phone: string | null;
  organization: string | null;
  job_position: string | null;   // ✅ ตำแหน่ง
  province: string | null;       // ✅ จังหวัด
  region: number | null;         // ✅ ภาค 0–9 (0 = ศาลกลาง)
  qr_image_url: string | null;   // ✅ URL รูป QR
  slip_url: string | null;
  checked_in_at: string | null;
  ticket_token: string | null;
  food_type: string | null;      // ✅ ประเภทอาหาร
  hotel_name: string | null;     // ✅ ชื่อโรงแรม
};

function formatDateTime(isoString: string | null) {
  if (!isoString) return '-';
  try {
    return new Intl.DateTimeFormat('th-TH-u-ca-gregory', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Asia/Bangkok',
    }).format(new Date(isoString));
  } catch {
    return new Date(isoString).toLocaleString('th-TH');
  }
}

// แปลง code เป็น label ภาษาไทย
function formatFoodType(foodType: string | null): string {
  switch (foodType) {
    case 'normal':
      return 'ทั่วไป';
    case 'no_pork':
      return 'ไม่ทานหมู';
    case 'vegetarian':
      return 'มังสวิรัติ';
    case 'vegan':
      return 'เจ / วีแกน';
    case 'halal':
      return 'ฮาลาล';
    case 'seafood_allergy':
      return 'แพ้อาหารทะเล';
    case 'other':
      return 'อื่น ๆ';
    case null:
    case '':
    default:
      return 'ไม่ระบุ';
  }
}

// ✅ แสดง label สำหรับ region (รองรับ 0 = ศาลกลาง)
function formatRegion(region: number | null): string {
  if (region === null || Number.isNaN(region as any)) return '-';

  if (region === 0) {
    return 'ศาลเยาวชนกลาง ';
  }

  // ถ้าอยากละเอียดกว่านี้ สามารถ map ตามภาคได้ภายหลัง
  return `ภาค ${region}`;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const sp = await searchParams;
  const keyword = (sp.q ?? '').trim().toLowerCase();
  const status = sp.status ?? 'all';
  const regionFilter = (sp.region ?? '').trim();
  const organizationFilter = (sp.organization ?? '').trim().toLowerCase();
  const provinceFilter = (sp.province ?? '').trim().toLowerCase(); // ✅ ตัวกรองจังหวัด (จาก query)

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('attendees')
    .select(
      `
      id,
      event_id,
      full_name,
      phone,
      organization,
      job_position,
      province,
      region,
      qr_image_url,
      slip_url,
      checked_in_at,
      ticket_token,
      food_type,
      hotel_name
    `
    )
    .order('region', { ascending: true, nullsFirst: false })
    .order('full_name', { ascending: true });

  if (error || !data) {
    return (
      <div className="page-wrap page-wrap--center">
        <div className="card">
          <div className="card__icon-badge card__icon-badge--error">
            <span>!</span>
          </div>
          <h1 className="card__title">โหลดข้อมูลไม่สำเร็จ</h1>
          <p className="card__subtitle">
            ไม่สามารถโหลดรายชื่อผู้เข้าร่วมได้ กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ
          </p>
          <p className="card__debug">
            <code>{error?.message}</code>
          </p>
        </div>
      </div>
    );
  }

  const attendees: AttendeeRow[] = data as AttendeeRow[];

  const total = attendees.length;
  const totalChecked = attendees.filter((a) => a.checked_in_at).length;
  const totalWithSlip = attendees.filter((a) => a.slip_url).length;

  // ดึงรายการศาล / หน่วยงานทั้งหมดจากข้อมูลจริง สำหรับทำ dropdown เลือก
  const organizationOptions = Array.from(
    new Set(
      attendees
        .map((a) => a.organization ?? '')
        .filter((org) => org.trim().length > 0)
    )
  ).sort((a, b) => a.localeCompare(b, 'th-TH'));

  // ✅ ดึงรายการจังหวัดทั้งหมดจากข้อมูลจริง
  const provinceOptions = Array.from(
    new Set(
      attendees
        .map((a) => a.province ?? '')
        .filter((p) => p.trim().length > 0)
    )
  ).sort((a, b) => a.localeCompare(b, 'th-TH'));

  let filtered = attendees;

  if (keyword) {
    filtered = filtered.filter((a) => {
      const name = (a.full_name ?? '').toLowerCase();
      const org = (a.organization ?? '').toLowerCase();
      const job = (a.job_position ?? '').toLowerCase();
      const province = (a.province ?? '').toLowerCase();
      const token = (a.ticket_token ?? '').toLowerCase();
      return (
        name.includes(keyword) ||
        org.includes(keyword) ||
        job.includes(keyword) ||
        province.includes(keyword) ||
        token.includes(keyword)
      );
    });
  }

  if (status === 'checked') {
    filtered = filtered.filter((a) => a.checked_in_at);
  } else if (status === 'unchecked') {
    filtered = filtered.filter((a) => !a.checked_in_at);
  }

  if (regionFilter) {
    const target = regionFilter.trim();
    filtered = filtered.filter(
      (a) => String(a.region ?? '').trim() === target
    );
  }

  // ✅ กรองตามจังหวัด (ถ้ามีเลือก)
  if (provinceFilter) {
    filtered = filtered.filter((a) =>
      (a.province ?? '').toLowerCase().includes(provinceFilter)
    );
  }

  if (organizationFilter) {
    filtered = filtered.filter((a) =>
      (a.organization ?? '').toLowerCase().includes(organizationFilter)
    );
  }

  return (
    <div className="page-wrap">
      <div className="page-gradient" />

      <main className="admin-layout">
        {/* ---------------- Header + Summary ---------------- */}
        <header className="admin-header">
          <div className="admin-header__top">
            <div>
              <div className="attendee-header__badge">ADMIN DASHBOARD</div>
              <h1 className="admin-header__title">
                สรุปรายชื่อผู้เข้าร่วมงานสัมมนา
              </h1>
              <p className="admin-header__subtitle">
                หน้านี้สำหรับเจ้าหน้าที่ใช้ตรวจสอบสถานะการแนบสลิป การเช็กอิน และประเภทอาหารของผู้เข้าร่วม
              </p>
            </div>
          </div>

          <AdminNav />

          <section className="admin-summary">
            <div className="admin-summary__item">
              <div className="admin-summary__label">ผู้เข้าร่วมทั้งหมด</div>
              <div className="admin-summary__value">{total}</div>
            </div>
            <div className="admin-summary__item">
              <div className="admin-summary__label">เช็กอินแล้ว</div>
              <div className="admin-summary__value admin-summary__value--green">
                {totalChecked}
              </div>
            </div>
            <div className="admin-summary__item">
              <div className="admin-summary__label">มีสลิปแนบแล้ว</div>
              <div className="admin-summary__value admin-summary__value--blue">
                {totalWithSlip}
              </div>
            </div>
          </section>

          {/* ---------------- Filters + Import / Export ---------------- */}
          <section className="admin-filters">
            <AdminFilters
              keyword={keyword}
              status={status}
              regionFilter={regionFilter}
              organizationOptions={organizationOptions}
              provinceOptions={provinceOptions}
              organizationValue={sp.organization ?? ''}
              provinceValue={sp.province ?? ''}
            />
          </section>
        </header>

        {/* ---------------- Table ---------------- */}
        <section className="admin-table__wrapper">
          <div className="admin-table__inner">
            <table className="admin-table">
              <thead>
                <tr className="admin-table__head-row">
                  <th>#</th>
                  <th>ชื่อ - นามสกุล</th>
                  <th>หน่วยงาน</th>
                  <th>จังหวัด</th>
                  <th>ภาค / ศาลกลาง</th>
                  <th>เบอร์โทร</th>
                  <th>ตำแหน่ง</th>
                  <th>โรงแรม</th>
                  <th>สลิป</th>
                  <th>เช็กอิน</th>
                  <th>ประเภทอาหาร</th>
                  <th>Token</th>
                  <th>จัดการ</th>
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="admin-table__empty">
                      ไม่พบข้อมูลตามเงื่อนไขที่ค้นหา
                    </td>
                  </tr>
                ) : (
                  filtered.map((a, idx) => {
                    const hasSlip = !!a.slip_url;
                    const isChecked = !!a.checked_in_at;
                    const foodLabel = formatFoodType(a.food_type);

                    return (
                      <tr key={a.id ?? idx}>
                        <td>{idx + 1}</td>
                        <td>{a.full_name || '-'}</td>
                        <td>{a.organization || '-'}</td>
                        <td>{a.province || '-'}</td>
                        <td>{formatRegion(a.region)}</td>
                        <td>{a.phone || '-'}</td>
                        <td>{a.job_position || '-'}</td>
                        <td>{a.hotel_name || '-'}</td>
                        <td>
                          {hasSlip ? (
                            <div className="admin-table__slip-cell">
                              <a
                                href={a.slip_url ?? '#'}
                                target="_blank"
                                rel="noreferrer"
                                className="admin-pill admin-pill--blue"
                              >
                                มีสลิป
                              </a>
                              <AdminSlipClearButton attendeeId={a.id} />
                            </div>
                          ) : (
                            <div className="admin-table__slip-cell">
                              <span className="admin-pill admin-pill--muted">
                                ไม่มี
                              </span>
                              <AdminSlipUploadButton attendeeId={a.id} />
                            </div>
                          )}
                        </td>
                        <td>
                          {isChecked ? (
                            <div className="admin-table__checkin">
                              <span className="admin-pill admin-pill--green">
                                เช็กอินแล้ว
                              </span>
                              <span
                                className="admin-table__checkin-time"
                                suppressHydrationWarning
                              >
                                {formatDateTime(a.checked_in_at)}
                              </span>
                              <ForceCheckinButton
                                attendeeId={a.id}
                                action="uncheckin"
                                label="ยกเลิกเช็กอิน"
                                isCheckedIn={isChecked}
                                hasSlip={hasSlip}
                              />
                            </div>
                          ) : (
                            <div className="admin-table__checkin-actions">
                              <span className="admin-pill admin-pill--warning">
                                ยังไม่เช็กอิน
                              </span>
                              <ForceCheckinButton
                                attendeeId={a.id}
                                action="checkin"
                                label="เช็กอิน"
                                isCheckedIn={isChecked}
                                hasSlip={hasSlip}
                              />
                            </div>
                          )}
                        </td>
                        <td>
                          <span className="admin-pill admin-pill--food">
                            {foodLabel}
                          </span>
                        </td>
                        <td>
                          <code className="admin-table__token">
                            {a.ticket_token || '-'}
                          </code>
                        </td>
                        <td>
                          <a
                            href={`/admin/attendee/${a.ticket_token}`}
                            className="admin-link-edit"
                          >
                            แก้ไขข้อมูล
                          </a>
                          <AdminDeleteButton
                            attendeeId={a.id}
                            fullName={a.full_name}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
