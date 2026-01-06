// app/admin/page.tsx
import { requireStaffForPage } from '@/lib/requireStaffForPage';
import ForceCheckinButton from './ForceCheckinButton';
import AdminSlipUploadButton from './AdminSlipUploadButton';
import AdminSlipClearButton from './AdminSlipClearButton';
import AdminNav from './AdminNav';
import AdminImportButton from './AdminImportButton';
import AdminDeleteButton from './AdminDeleteButton';
import AdminFilters from './AdminFilters';
import { redirect } from "next/navigation";
import { maskPhone } from '@/lib/maskPhone';

// 👉 นำเข้าไฟล์ CSS ที่สร้างขึ้นมาใช้กับหน้านี้โดยเฉพาะ
import './admin-page.css';

export const dynamic = 'force-dynamic';

type AdminPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    region?: string;
    organization?: string;
    province?: string;
    page?: string; // <-- Add this line
  }>;
};

type AttendeeRow = {
  id: string;
  event_id: string | null; // event_id
  full_name: string | null;
  phone: string | null;
  organization: string | null;
  job_position: string | null; // ตำแหน่ง
  province: string | null; // จังหวัด
  region: number | null; // ภาค 0–9 (0 = ศาลกลาง)
  qr_image_url: string | null; // URL รูป QR
  slip_url: string | null;
  checked_in_at: string | null;
  ticket_token: string | null;
  food_type: string | null; // ประเภทอาหาร
  hotel_name: string | null; // ชื่อโรงแรม
  coordinator_name: string | null; // ✅ ชื่อผู้ประสานงาน
  coordinator_phone: string | null; // ✅ เบอร์ผู้ประสานงาน
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

// แสดง label สำหรับ region (รองรับ 0 = ศาลกลาง)
function formatRegion(region: number | null): string {
  if (region === null || Number.isNaN(region as any)) return '-';

  if (region === 0) {
    return 'ศาลเยาวชนและครอบครัวกลาง';
  }

  return `ภาค ${region}`;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const sp = await searchParams;

  const PAGE_SIZE = 5;
  // ป้องกัน parseInt ได้ NaN กรณี sp.page เป็น undefined/null/ไม่ใช่ string
  const pageParam = sp.page && typeof sp.page === "string" && !isNaN(Number(sp.page))
    ? parseInt(sp.page, 10)
    : 1;
  const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // --- Filter params ---
  const keyword = (sp.q ?? '').trim().toLowerCase();
  const status = sp.status ?? 'all';
  const regionFilter = (sp.region ?? '').trim();
  const organizationFilter = (sp.organization ?? '').trim().toLowerCase();
  const provinceFilter = (sp.province ?? '').trim().toLowerCase();

  const { supabase, staff } = await requireStaffForPage({ redirectTo: '/login' });

  // --- Count all filtered rows (for pagination) ---
  let countQuery = supabase
    .from('attendees')
    .select('*', { count: 'exact', head: true });

  // Apply filters to count query
  if (keyword) {
    countQuery = countQuery.or(
      `full_name.ilike.%${keyword}%,organization.ilike.%${keyword}%,job_position.ilike.%${keyword}%,province.ilike.%${keyword}%,ticket_token.ilike.%${keyword}%,coordinator_name.ilike.%${keyword}%,coordinator_phone.ilike.%${keyword}%`
    );
  }
  if (status === 'checked') countQuery = countQuery.filter('checked_in_at', 'not.is', null);
  else if (status === 'unchecked') countQuery = countQuery.filter('checked_in_at', 'is', null);
  if (regionFilter) countQuery = countQuery.eq('region', regionFilter);
  if (provinceFilter) countQuery = countQuery.ilike('province', `%${provinceFilter}%`);
  if (organizationFilter) countQuery = countQuery.ilike('organization', `%${organizationFilter}%`);

  // If the logged-in staff is not super_admin, restrict to their province only
  // Exception: staff from สุราษฎร์ธานี can view all provinces
  if (staff && staff.role !== 'super_admin') {
    const prov = (staff.province_name ?? '').trim();
    const isSurat = prov.includes('สุราษฎร์');
    if (prov && !isSurat) {
      // apply additional province filter (case-insensitive)
      countQuery = countQuery.ilike('province', `%${prov}%`);
    }
  }

  const { count: totalFiltered = 0 } = await countQuery;

  // --- Query paged data ---
  let dataQuery = supabase
    .from('attendees')
    .select(`
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
      hotel_name,
      coordinator_name,
      coordinator_phone
    `)
    .order('region', { ascending: true, nullsFirst: false })
    .order('full_name', { ascending: true })
    .range(from, to);

  // Apply filters to data query
  if (keyword) {
    dataQuery = dataQuery.or(
      `full_name.ilike.%${keyword}%,organization.ilike.%${keyword}%,job_position.ilike.%${keyword}%,province.ilike.%${keyword}%,ticket_token.ilike.%${keyword}%,coordinator_name.ilike.%${keyword}%,coordinator_phone.ilike.%${keyword}%`
    );
  }
  if (status === 'checked') dataQuery = dataQuery.filter('checked_in_at', 'not.is', null);
  else if (status === 'unchecked') dataQuery = dataQuery.filter('checked_in_at', 'is', null);
  if (regionFilter) dataQuery = dataQuery.eq('region', regionFilter);
  if (provinceFilter) dataQuery = dataQuery.ilike('province', `%${provinceFilter}%`);
  if (organizationFilter) dataQuery = dataQuery.ilike('organization', `%${organizationFilter}%`);

  // If the logged-in staff is not super_admin, restrict to their province only
  // Exception: staff from สุราษฎร์ธานี can view all provinces
  if (staff && staff.role !== 'super_admin') {
    const prov = (staff.province_name ?? '').trim();
    const isSurat = prov.includes('สุราษฎร์');
    if (prov && !isSurat) {
      dataQuery = dataQuery.ilike('province', `%${prov}%`);
    }
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

  // --- ดึง options เฉพาะ organization/province ที่จำเป็น (ไม่ดึง attendee ทั้งหมด) ---
  // (ถ้าต้องการ performance สูงสุด ควรแยก query เฉพาะ column ที่ต้องการ)
  // รายการศาล / หน่วยงานทั้งหมดจากข้อมูลจริง สำหรับทำ dropdown เลือก
  const organizationOptions = Array.from(
    new Set(
      attendees
        .map((a) => a.organization ?? '')
        .filter((org) => org.trim().length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b, 'th-TH'));

  // รายการจังหวัดทั้งหมดจากข้อมูลจริง
  const provinceOptions = Array.from(
    new Set(
      attendees
        .map((a) => a.province ?? '')
        .filter((p) => p.trim().length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b, 'th-TH'));

  const total = attendees.length;
  const totalChecked = attendees.filter((a) => a.checked_in_at).length;
  const totalWithSlip = attendees.filter((a) => a.slip_url).length;

  const safeTotalFiltered = totalFiltered ?? 0;
  const totalPages = Math.ceil(safeTotalFiltered / PAGE_SIZE);

  // --- Pagination rendering function ---
  function renderPagination(page: number, totalPages: number, sp: Record<string, any>) {
    if (totalPages <= 1) return null;
    const pageLinks = [];
    // ใช้ React.ReactNode ตามที่ต้องการ
    const createPageForm = (
      p: number,
      label?: React.ReactNode,
      active?: boolean,
      disabled?: boolean
    ) => (
      <form
        method="get"
        style={{ display: "inline" }}
        key={`page-${p}-${String(label) || 'default'}`}
      >
        {Object.entries(sp).map(([k, v]) =>
          k !== "page" && v ? (
            <input key={k} type="hidden" name={k} value={v} />
          ) : null
        )}
        <button
          type="submit"
          name="page"
          value={p}
          disabled={disabled}
          style={{
            margin: "0 2px",
            fontWeight: active ? "bold" : undefined,
            color: active ? "#e75480" : "#333",
            background: "none",
            border: "none",
            cursor: disabled ? "default" : "pointer",
            textDecoration: active ? "underline" : undefined,
            minWidth: 28,
            fontSize: 18,
            outline: "none",
            borderRadius: 4,
            padding: "2px 6px",
            transition: "color 0.2s",
          }}
        >
          {label || p}
        </button>
      </form>
    );

    // Always show first, last, current, and neighbors
    let start = Math.max(1, page - 3);
    let end = Math.min(totalPages, page + 3);

    if (page <= 4) {
      start = 1;
      end = Math.min(7, totalPages);
    } else if (page >= totalPages - 3) {
      start = Math.max(1, totalPages - 6);
      end = totalPages;
    }

    // First page
    if (start > 1) {
      pageLinks.push(createPageForm(1, "1", page === 1));
      if (start > 2) pageLinks.push(<span key="start-ellipsis">...</span>);
    }

    // Middle pages
    for (let i = start; i <= end; i++) {
      pageLinks.push(createPageForm(i, undefined, page === i));
    }

    // Last page
    if (end < totalPages) {
      if (end < totalPages - 1) pageLinks.push(<span key="end-ellipsis">...</span>);
      pageLinks.push(createPageForm(totalPages, String(totalPages), page === totalPages));
    }

    // Next
    pageLinks.push(
      createPageForm(page + 1, <>Next <span style={{fontWeight: "bold"}}>&gt;</span></>, false, page >= totalPages)
    );

    // --- Jump to page input ---
    pageLinks.push(
      <form
        method="get"
        key="jump"
        style={{
          display: "inline-flex",
          alignItems: "center",
          marginLeft: 12,
          gap: 4,
        }}
      >
        {Object.entries(sp).map(([k, v]) =>
          k !== "page" && v ? (
            <input key={k} type="hidden" name={k} value={v} />
          ) : null
        )}
        <span>ไปหน้า</span>
        <input
          type="number"
          name="page"
          min={1}
          max={totalPages}
          defaultValue={page}
          style={{
            width: 48,
            fontSize: 16,
            border: "1px solid #ccc",
            borderRadius: 4,
            padding: "2px 6px",
            margin: "0 2px",
          }}
        />
        <button
          type="submit"
          style={{
            fontSize: 16,
            padding: "2px 10px",
            borderRadius: 4,
            border: "1px solid #e75480",
            background: "#fff",
            color: "#e75480",
            cursor: "pointer",
            marginLeft: 2,
          }}
        >
          ไป
        </button>
      </form>
    );

    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "0.25rem",
          margin: "1rem 0",
          flexWrap: "wrap",
          borderTop: "1px solid #eee",
          borderRadius: "6px",
          paddingTop: "0.5rem"
        }}
      >
        {pageLinks}
      </div>
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
        <h1 className="admin-header__title">สรุปรายชื่อผู้เข้าร่วมงานสัมมนา</h1>
        <p className="admin-header__subtitle">
          หน้านี้สำหรับเจ้าหน้าที่ใช้ตรวจสอบสถานะการแนบสลิป การเช็กอิน
          ประเภทอาหาร และข้อมูลผู้ประสานงานของผู้เข้าร่วม
        </p>
      </div>
    </div>

    <AdminNav />

    <section className="admin-summary">
      <div className="admin-summary__item">
        <div className="admin-summary__label">ผู้เข้าร่วมทั้งหมด</div>
        <div className="admin-summary__value">{totalFiltered}</div>
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
          <th>ภาค/ศาลกลาง</th>
          <th>ตำแหน่ง</th>
          <th>ผู้ประสานงาน</th>
          <th>โรงแรม</th>
          <th>สลิป</th>
          <th>เช็กอิน</th>
          <th>ประเภทอาหาร</th>
          <th>จัดการ</th>
        </tr>
      </thead>

      <tbody>
        {attendees.length === 0 ? (
          <tr>
            <td colSpan={11} className="admin-table__empty">
              ไม่พบข้อมูลตามเงื่อนไขที่ค้นหา
            </td>
          </tr>
        ) : (
          attendees.map((a, idx) => {
            const hasSlip = !!a.slip_url;
            const isChecked = !!a.checked_in_at;
            const foodLabel = formatFoodType(a.food_type);

            return (
              <tr key={a.id ?? idx}>
                <td>{from + idx + 1}</td>

                {/* ✅ ชื่อ + เบอร์โทร (เบอร์อยู่บรรทัดล่าง) */}
                <td>
                  <div>{a.full_name || '-'}</div>
                  <div>
                    <small>{maskPhone(a.phone)}</small>
                  </div>
                </td>

                {/* ✅ หน่วยงาน + จังหวัด (จังหวัดอยู่บรรทัดล่าง) */}
                <td>
                  <div>{a.organization || '-'}</div>
                  <div>
                    <small>{a.province || '-'}</small>
                  </div>
                </td>

                <td>{formatRegion(a.region)}</td>
                <td>{a.job_position || '-'}</td>

                {/* ✅ ผู้ประสานงาน: ชื่อ + เบอร์ (เบอร์อยู่บรรทัดล่าง) */}
                <td>
                  <div>{a.coordinator_name || '-'}</div>
                  <div>
                    <small>{maskPhone(a.coordinator_phone)}</small>
                  </div>
                </td>

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

                {/* ✅ ไม่แสดงรหัสบัตร */}
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
    {/* --- Pagination Controls --- */}
    {renderPagination(page, totalPages, sp)}
    {/* --- End Pagination Controls --- */}
  </div>
</section>

</main>

    </div>
  );
}
