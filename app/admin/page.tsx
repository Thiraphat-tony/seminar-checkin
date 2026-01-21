// app/admin/page.tsx
import type { ReactNode } from 'react';

import { requireStaffForPage } from '@/lib/requireStaffForPage';
import { maskPhone } from '@/lib/maskPhone';

import AdminNav from './AdminNav';
import AdminFilters from './AdminFilters';

import ForceCheckinButton from './ForceCheckinButton';
import AdminDeleteButton from './AdminDeleteButton';

import AdminSlipUploadButton from './AdminSlipUploadButton';
import AdminSlipClearButton from './AdminSlipClearButton';

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
    page?: string;
  }>;
};

type AttendeeRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  organization: string | null;
  job_position: string | null;
  province: string | null;
  region: number | null;
  slip_url: string | null;
  checked_in_at: string | null;
  ticket_token: string | null;
  food_type: string | null;
  hotel_name: string | null;
  coordinator_name: string | null;
  coordinator_phone: string | null;
  travel_mode: string | null;
  travel_other: string | null;
  checkin_round1_at: string | null;
  checkin_round2_at: string | null;
  checkin_round3_at: string | null;
};

type SummaryCounts = {
  total: number;
  round1: number;
  round2: number;
  round3: number;
  slip: number;
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

// Map enum values and legacy "????" strings from old registration encoding.
const JOB_POSITION_LABELS: Record<string, string> = {
  chief_judge: 'ผู้พิพากษาหัวหน้าศาล',
  associate_judge: 'ผู้พิพากษาสมทบ',
  '????????????????????': 'ผู้พิพากษาหัวหน้าศาล',
  '??????????????': 'ผู้พิพากษาสมทบ',
};

function formatJobPosition(jobPosition: string | null): string {
  if (!jobPosition) return '-';
  const trimmed = jobPosition.trim();
  if (!trimmed) return '-';
  return JOB_POSITION_LABELS[trimmed] ?? trimmed;
}

const TRAVEL_MODE_LABELS: Record<string, string> = {
  car: 'รถยนต์ส่วนตัว',
  van: 'รถตู้',
  bus: 'รถบัส',
  train: 'รถไฟ',
  plane: 'เครื่องบิน',
  motorcycle: 'มอเตอร์ไซค์',
  other: 'อื่น ๆ',
};

function formatTravelMode(mode: string | null, other: string | null): string {
  if (!mode) return '-';
  const trimmed = mode.trim();
  if (!trimmed) return '-';
  const label = TRAVEL_MODE_LABELS[trimmed] ?? trimmed;
  if (trimmed === 'other') {
    const extra = (other ?? '').trim();
    return extra ? `${label}: ${extra}` : label;
  }
  return label;
}

function formatRegion(region: number | null): string {
  if (region === null || Number.isNaN(region as any)) return '-';
  if (region === 0) return 'ศาลเยาวชนและครอบครัวกลาง';
  return `ภาค ${region}`;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const sp = await searchParams;

  const PAGE_SIZE = 5;
  const pageParam =
    sp.page && typeof sp.page === 'string' && !isNaN(Number(sp.page))
      ? parseInt(sp.page, 10)
      : 1;
  const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // --- Filter params ---
  const keyword = (sp.q ?? '').trim().toLowerCase();
  const status = sp.status ?? 'all';
  const regionFilter = (sp.region ?? '').trim();
  const regionFilterNum =
    regionFilter && !Number.isNaN(Number(regionFilter)) ? Number(regionFilter) : null;
  const organizationFilter = (sp.organization ?? '').trim();
  const provinceFilter = (sp.province ?? '').trim();

  const { supabase, staff } = await requireStaffForPage({ redirectTo: '/login' });
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
            กรุณาตั้งค่า EVENT_ID ในระบบก่อนใช้งานหน้าแอดมิน
          </p>
        </div>
      </div>
    );
  }

  const applyFilters = (query: any) => {
    let q = query;

    q = q.eq('event_id', eventId);

    if (keyword) {
      q = q.or(
        `full_name.ilike.%${keyword}%,organization.ilike.%${keyword}%,job_position.ilike.%${keyword}%,province.ilike.%${keyword}%,ticket_token.ilike.%${keyword}%,coordinator_name.ilike.%${keyword}%,coordinator_phone.ilike.%${keyword}%`,
      );
    }
    if (status === 'checked') q = q.filter('checked_in_at', 'not.is', null);
    else if (status === 'unchecked') q = q.filter('checked_in_at', 'is', null);
    if (regionFilterNum !== null) q = q.eq('region', regionFilterNum);
    if (provinceFilter) q = q.eq('province', provinceFilter);
    if (organizationFilter) q = q.eq('organization', organizationFilter);

    // Staff are scoped to their own court_id unless super_admin
    if (staff && staff.role !== 'super_admin') {
      const staffCourtId = staff.court_id;
      if (staffCourtId) {
        q = q.eq('court_id', staffCourtId);
      }
    }

    return q;
  };

  const staffCourtId =
    staff && staff.role !== 'super_admin' ? (staff.court_id ?? null) : null;

  // --- Query paged data ---
  let dataQuery = supabase
    .from('v_attendees_checkin_rounds')
    .select(
      `
      id,
      full_name,
      phone,
      organization,
      job_position,
      province,
      region,
      slip_url,
      checked_in_at,
      ticket_token,
      food_type,
      hotel_name,
      coordinator_name,
      coordinator_phone,
      travel_mode,
      travel_other,
      checkin_round1_at,
      checkin_round2_at,
      checkin_round3_at
    `,
    )
    .order('region', { ascending: true, nullsFirst: false })
    .order('full_name', { ascending: true })
    .range(from, to);

  dataQuery = applyFilters(dataQuery);

  const summaryParams = {
    p_event_id: eventId,
    p_keyword: keyword || null,
    p_status: status,
    p_region: regionFilterNum,
    p_province: provinceFilter || null,
    p_organization: organizationFilter || null,
    p_court_id: staffCourtId || null,
  };

  const [{ data: summaryDataRaw, error: summaryError }, { data, error }] = await Promise.all([
    supabase.rpc('attendee_summary_counts', summaryParams).single(),
    dataQuery,
  ]);
  const summaryData = summaryDataRaw as SummaryCounts | null;

  if (summaryError) {
    console.error('Admin summary query error:', summaryError);
  }

  let totalFiltered = summaryData?.total ?? 0;
  if (!summaryData) {
    const { count: fallbackCount, error: fallbackError } = await applyFilters(
      supabase
        .from('v_attendees_checkin_rounds')
        .select('id', { count: 'exact', head: true }),
    );
    if (fallbackError) {
      console.error('Admin count query error:', fallbackError);
    } else {
      totalFiltered = fallbackCount ?? 0;
    }
  }

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

  // --- options สำหรับ dropdown (ตามโค้ดเดิม: จากข้อมูลหน้าเดียว) ---
  const organizationOptions = Array.from(
    new Set(attendees.map((a) => a.organization ?? '').filter((org) => org.trim().length > 0)),
  ).sort((a, b) => a.localeCompare(b, 'th-TH'));

  const provinceOptions = Array.from(
    new Set(attendees.map((a) => a.province ?? '').filter((p) => p.trim().length > 0)),
  ).sort((a, b) => a.localeCompare(b, 'th-TH'));

  const totalCheckedRound1 = summaryData?.round1 ?? 0;
  const totalCheckedRound2 = summaryData?.round2 ?? 0;
  const totalCheckedRound3 = summaryData?.round3 ?? 0;
  const totalWithSlip = summaryData?.slip ?? 0;

  const safeTotalFiltered = totalFiltered ?? 0;
  const totalPages = Math.ceil(safeTotalFiltered / PAGE_SIZE);

  function renderPagination(page: number, totalPages: number, sp: Record<string, any>) {
    if (totalPages <= 1) return null;

    const pageLinks: ReactNode[] = [];

    const createPageForm = (p: number, label?: ReactNode, active?: boolean, disabled?: boolean) => (
      <form method="get" style={{ display: 'inline' }} key={`page-${p}-${String(label) || 'd'}`}>
        {Object.entries(sp).map(([k, v]) =>
          k !== 'page' && v ? <input key={k} type="hidden" name={k} value={v} /> : null,
        )}
        <button
          type="submit"
          name="page"
          value={p}
          disabled={disabled}
          style={{
            margin: '0 2px',
            fontWeight: active ? 'bold' : undefined,
            color: active ? '#e75480' : '#333',
            background: 'none',
            border: 'none',
            cursor: disabled ? 'default' : 'pointer',
            textDecoration: active ? 'underline' : undefined,
            minWidth: 28,
            fontSize: 18,
            outline: 'none',
            borderRadius: 4,
            padding: '2px 6px',
            transition: 'color 0.2s',
          }}
        >
          {label || p}
        </button>
      </form>
    );

    let start = Math.max(1, page - 3);
    let end = Math.min(totalPages, page + 3);

    if (page <= 4) {
      start = 1;
      end = Math.min(7, totalPages);
    } else if (page >= totalPages - 3) {
      start = Math.max(1, totalPages - 6);
      end = totalPages;
    }

    if (start > 1) {
      pageLinks.push(createPageForm(1, '1', page === 1));
      if (start > 2) pageLinks.push(<span key="start-ellipsis">...</span>);
    }

    for (let i = start; i <= end; i++) {
      pageLinks.push(createPageForm(i, undefined, page === i));
    }

    if (end < totalPages) {
      if (end < totalPages - 1) pageLinks.push(<span key="end-ellipsis">...</span>);
      pageLinks.push(createPageForm(totalPages, String(totalPages), page === totalPages));
    }

    pageLinks.push(
      createPageForm(
        page + 1,
        <>
          Next <span style={{ fontWeight: 'bold' }}>&gt;</span>
        </>,
        false,
        page >= totalPages,
      ),
    );

    pageLinks.push(
      <form
        method="get"
        key="jump"
        style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 12, gap: 4 }}
      >
        {Object.entries(sp).map(([k, v]) =>
          k !== 'page' && v ? <input key={k} type="hidden" name={k} value={v} /> : null,
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
            border: '1px solid #ccc',
            borderRadius: 4,
            padding: '2px 6px',
            margin: '0 2px',
          }}
        />
        <button
          type="submit"
          style={{
            fontSize: 16,
            padding: '2px 10px',
            borderRadius: 4,
            border: '1px solid #e75480',
            background: '#fff',
            color: '#e75480',
            cursor: 'pointer',
            marginLeft: 2,
          }}
        >
          ไป
        </button>
      </form>,
    );

    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '0.25rem',
          margin: '1rem 0',
          flexWrap: 'wrap',
          borderTop: '1px solid #eee',
          borderRadius: '6px',
          paddingTop: '0.5rem',
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
        <header className="admin-header">
          <div className="admin-header__top">
            <div>
              <div className="attendee-header__badge">ADMIN DASHBOARD</div>
              <h1 className="admin-header__title">สรุปรายชื่อผู้เข้าร่วมงานสัมมนา</h1>
              <p className="admin-header__subtitle">
                หน้านี้สำหรับเจ้าหน้าที่ใช้ตรวจสอบสถานะการแนบสลิป การเช็กอิน ประเภทอาหาร และข้อมูลผู้ประสานงานของผู้เข้าร่วม
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
              <div className="admin-summary__label">เช็กอินรอบ 1</div>
              <div className="admin-summary__value admin-summary__value--green">
                {totalCheckedRound1}
              </div>
            </div>
            <div className="admin-summary__item">
              <div className="admin-summary__label">เช็กอินรอบ 2</div>
              <div className="admin-summary__value admin-summary__value--green">
                {totalCheckedRound2}
              </div>
            </div>
            <div className="admin-summary__item">
              <div className="admin-summary__label">เช็กอินรอบ 3</div>
              <div className="admin-summary__value admin-summary__value--green">
                {totalCheckedRound3}
              </div>
            </div>
            <div className="admin-summary__item">
              <div className="admin-summary__label">มีสลิปแนบแล้ว</div>
              <div className="admin-summary__value admin-summary__value--blue">
                {totalWithSlip}
              </div>
            </div>
          </section>

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
                  <th>การเดินทาง</th>
                  <th>สลิป</th>
                  <th>เช็กอิน</th>
                  <th>ประเภทอาหาร</th>
                  <th>จัดการ</th>
                </tr>
              </thead>

              <tbody>
                {attendees.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="admin-table__empty">
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

                        <td>
                          <div>{a.full_name || '-'}</div>
                          <div>
                            <small>{maskPhone(a.phone)}</small>
                          </div>
                        </td>

                        <td>
                          <div>{a.organization || '-'}</div>
                          <div>
                            <small>{a.province || '-'}</small>
                          </div>
                        </td>

                        <td>{formatRegion(a.region)}</td>
                        <td>{formatJobPosition(a.job_position)}</td>

                        <td>
                          <div>{a.coordinator_name || '-'}</div>
                          <div>
                            <small>{maskPhone(a.coordinator_phone)}</small>
                          </div>
                        </td>

                        <td>{a.hotel_name || '-'}</td>
                        <td>{formatTravelMode(a.travel_mode, a.travel_other)}</td>

                        <td>
                          <div className="admin-table__slip-cell">
                            {hasSlip ? (
                              <span className="admin-pill admin-pill--blue">มีสลิป</span>
                            ) : (
                              <span className="admin-pill admin-pill--muted">ไม่มี</span>
                            )}
                          </div>
                        </td>

                        <td>
                          {isChecked ? (
                            <div className="admin-table__checkin">
                              <span className="admin-pill admin-pill--green">เช็กอินแล้ว</span>
                              <span className="admin-table__checkin-time" suppressHydrationWarning>
                                {formatDateTime(a.checked_in_at)}
                              </span>
                            </div>
                          ) : (
                            <div className="admin-table__checkin">
                              <span className="admin-pill admin-pill--warning">ยังไม่เช็กอิน</span>
                            </div>
                          )}
                        </td>

                        <td>
                          <span className="admin-pill admin-pill--food">{foodLabel}</span>
                        </td>

                        <td>
                          <details>
                            <summary className="admin-link-edit">จัดการ</summary>

                            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                              <a
                                href={`/admin/attendee/${a.ticket_token}`}
                                className="admin-link-edit"
                              >
                                แก้ไขข้อมูล
                              </a>

                              {hasSlip ? (
                                <a
                                  href={a.slip_url ?? '#'}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="admin-link-edit"
                                >
                                  ดูสลิป
                                </a>
                              ) : (
                                <span className="admin-pill admin-pill--muted">ไม่มีสลิป</span>
                              )}

                              {isChecked ? (
                                <ForceCheckinButton
                                  attendeeId={a.id}
                                  action="uncheckin"
                                  label="ยกเลิกเช็กอิน"
                                  isCheckedIn={isChecked}
                                  hasSlip={hasSlip}
                                />
                              ) : (
                                <ForceCheckinButton
                                  attendeeId={a.id}
                                  action="checkin"
                                  label="เช็กอิน"
                                  isCheckedIn={isChecked}
                                  hasSlip={hasSlip}
                                />
                              )}

                              {/* ✅ สลิป: ถ้ามีสลิป = แสดงปุ่มยกเลิกสลิป, ถ้าไม่มีสลิป = แสดงปุ่มแนบสลิป */}
                              {hasSlip ? (
                                <AdminSlipClearButton attendeeId={a.id} />
                              ) : (
                                <AdminSlipUploadButton attendeeId={a.id} />
                              )}

                              <AdminDeleteButton attendeeId={a.id} fullName={a.full_name} />
                            </div>
                          </details>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {renderPagination(page, totalPages, sp)}
          </div>
        </section>
      </main>
    </div>
  );
}
