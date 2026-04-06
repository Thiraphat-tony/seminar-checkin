// app/admin/page.tsx
import type { ReactNode } from 'react';

import { requireStaffForPage } from '@/lib/requireStaffForPage';

import AdminNav from './AdminNav';
import AdminFilters from './AdminFilters';
import AdminAttendeeTableClient from './AdminAttendeeTableClient';
import type { AdminAttendeeRow } from './types';

// 👉 นำเข้าไฟล์ CSS ที่สร้างขึ้นมาใช้กับหน้านี้โดยเฉพาะ
import './admin-page.css';

export const dynamic = 'force-dynamic';

type AdminPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    slip?: string;
    region?: string;
    organization?: string;
    province?: string;
    page?: string;
  }>;
};

type SummaryCounts = {
  total: number;
  round1: number;
  round2: number;
  round3: number;
  slip: number;
};

type FilterOptionSourceRow = {
  organization: string | null;
  province: string | null;
};

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
  const slipStatus =
    sp.slip === 'attached' || sp.slip === 'missing' ? sp.slip : 'all';
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
    if (slipStatus === 'attached') q = q.not('slip_url', 'is', null);
    else if (slipStatus === 'missing') q = q.filter('slip_url', 'is', null);
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
      name_prefix,
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
    p_status: status === 'all' ? null : status,
    p_region: regionFilterNum,
    p_province: provinceFilter || null,
    p_organization: organizationFilter || null,
    p_court_id: staffCourtId || null,
  };

  let filterOptionsQuery = supabase
    .from('v_attendees_checkin_rounds')
    .select('organization, province')
    .eq('event_id', eventId);

  if (regionFilterNum !== null) {
    filterOptionsQuery = filterOptionsQuery.eq('region', regionFilterNum);
  }
  if (status === 'checked') {
    filterOptionsQuery = filterOptionsQuery.not('checked_in_at', 'is', null);
  } else if (status === 'unchecked') {
    filterOptionsQuery = filterOptionsQuery.filter('checked_in_at', 'is', null);
  }
  if (slipStatus === 'attached') {
    filterOptionsQuery = filterOptionsQuery.not('slip_url', 'is', null);
  } else if (slipStatus === 'missing') {
    filterOptionsQuery = filterOptionsQuery.filter('slip_url', 'is', null);
  }
  if (staffCourtId) {
    filterOptionsQuery = filterOptionsQuery.eq('court_id', staffCourtId);
  }

  // RPC summary currently does not support slip-status filtering.
  // When slip filter is active, use fallback count queries so totals stay accurate.
  const summaryQueryPromise =
    slipStatus === 'all'
      ? supabase.rpc('attendee_summary_counts', summaryParams).single()
      : Promise.resolve({ data: null, error: null });

  const [
    { data: summaryDataRaw, error: summaryError },
    { data, error },
    { data: filterOptionRowsRaw, error: filterOptionsError },
  ] = await Promise.all([
    summaryQueryPromise,
    dataQuery,
    filterOptionsQuery,
  ]);
  const summaryData = summaryDataRaw as SummaryCounts | null;
  const filterOptionRows = (filterOptionRowsRaw ?? []) as FilterOptionSourceRow[];

  if (summaryError) {
    console.error('Admin summary query error:', summaryError);
  }
  if (filterOptionsError) {
    console.error('Admin filter options query error:', filterOptionsError);
  }

  let fallbackSummary: SummaryCounts | null = null;
  if (!summaryData) {
    const baseCountQuery = () =>
      supabase.from('v_attendees_checkin_rounds').select('id', { count: 'exact', head: true });

    const [
      totalRes,
      round1Res,
      round2Res,
      round3Res,
      slipRes,
    ] = await Promise.all([
      applyFilters(baseCountQuery()),
      applyFilters(baseCountQuery()).not('checkin_round1_at', 'is', null),
      applyFilters(baseCountQuery()).not('checkin_round2_at', 'is', null),
      applyFilters(baseCountQuery()).not('checkin_round3_at', 'is', null),
      applyFilters(baseCountQuery()).not('slip_url', 'is', null),
    ]);

    if (totalRes.error) console.error('Admin count query error:', totalRes.error);
    if (round1Res.error) console.error('Admin round1 count error:', round1Res.error);
    if (round2Res.error) console.error('Admin round2 count error:', round2Res.error);
    if (round3Res.error) console.error('Admin round3 count error:', round3Res.error);
    if (slipRes.error) console.error('Admin slip count error:', slipRes.error);

    fallbackSummary = {
      total: totalRes.count ?? 0,
      round1: round1Res.count ?? 0,
      round2: round2Res.count ?? 0,
      round3: round3Res.count ?? 0,
      slip: slipRes.count ?? 0,
    };
  }

  const summary = summaryData ?? fallbackSummary;
  const totalFiltered = summary?.total ?? 0;

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

  const attendees: AdminAttendeeRow[] = data as AdminAttendeeRow[];

  // --- options สำหรับ dropdown (ตามโค้ดเดิม: จากข้อมูลหน้าเดียว) ---
  const fallbackOrganizationOptions = Array.from(
    new Set(attendees.map((a) => a.organization ?? '').filter((org) => org.trim().length > 0)),
  ).sort((a, b) => a.localeCompare(b, 'th-TH'));

  const fallbackProvinceOptions = Array.from(
    new Set(attendees.map((a) => a.province ?? '').filter((p) => p.trim().length > 0)),
  ).sort((a, b) => a.localeCompare(b, 'th-TH'));

  const organizationOptions = Array.from(
    new Set(
      filterOptionRows
        .map((row) => (row.organization ?? '').trim())
        .filter((organization) => organization.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b, 'th-TH'));

  const provinceOptions = Array.from(
    new Set(
      filterOptionRows
        .map((row) => (row.province ?? '').trim())
        .filter((province) => province.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b, 'th-TH'));

  const effectiveOrganizationOptions =
    organizationOptions.length > 0 ? organizationOptions : fallbackOrganizationOptions;
  const effectiveProvinceOptions = provinceOptions.length > 0 ? provinceOptions : fallbackProvinceOptions;

  const totalCheckedRound1 = summary?.round1 ?? 0;
  const totalCheckedRound2 = summary?.round2 ?? 0;
  const totalCheckedRound3 = summary?.round3 ?? 0;
  const totalWithSlip = summary?.slip ?? 0;

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

    return <div className="admin-pagination">{pageLinks}</div>;
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
                หน้านี้สำหรับเจ้าหน้าที่ใช้ตรวจสอบสถานะการแนบสลิป การลงทะเบียน ประเภทอาหาร และข้อมูลผู้ประสานงานของผู้เข้าร่วม
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
              <div className="admin-summary__label">ลงทะเบียนรอบ 1</div>
              <div className="admin-summary__value admin-summary__value--green">
                {totalCheckedRound1}
              </div>
            </div>
            <div className="admin-summary__item">
              <div className="admin-summary__label">ลงทะเบียนรอบ 2</div>
              <div className="admin-summary__value admin-summary__value--green">
                {totalCheckedRound2}
              </div>
            </div>
            <div className="admin-summary__item">
              <div className="admin-summary__label">ลงทะเบียนรอบ 3</div>
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
              slipStatus={slipStatus}
              regionFilter={regionFilter}
              organizationOptions={effectiveOrganizationOptions}
              provinceOptions={effectiveProvinceOptions}
              organizationValue={sp.organization ?? ''}
              provinceValue={sp.province ?? ''}
            />
          </section>
        </header>

        <section className="admin-table__wrapper">
          <div className="admin-table__inner">
            <AdminAttendeeTableClient
              attendees={attendees}
              from={from}
              canForceCheckin={staff.role === 'super_admin'}
            />
          </div>
        </section>

        {renderPagination(page, totalPages, sp)}
      </main>
    </div>
  );
}
