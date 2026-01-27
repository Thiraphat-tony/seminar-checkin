import { NextResponse } from 'next/server';
import { requireStaffForApi } from '@/lib/requireStaffForApi';

export const runtime = 'nodejs';

type SummaryRow = {
  total: number;
  round1: number;
  round2: number;
  round3: number;
  slip: number;
};

type DashboardSummaryResponse =
  | {
      ok: true;
      data: {
        total: number;
        checked: number;
        notChecked: number;
        slip: number;
        round1: number;
        round2: number;
        round3: number;
        latestNotChecked: Array<{
          id: string;
          name_prefix: string | null;
          full_name: string | null;
          organization: string | null;
          phone: string | null;
        }>;
      };
    }
  | {
      ok: false;
      message: string;
    };

export async function GET() {
  const eventId = (process.env.EVENT_ID ?? '').trim();
  if (!eventId) {
    return NextResponse.json<DashboardSummaryResponse>(
      { ok: false, message: 'ยังไม่ได้ตั้งค่า EVENT_ID' },
      { status: 500 },
    );
  }

  const auth = await requireStaffForApi();
  if (!auth.ok) return auth.response;

  const { supabase, staff } = auth;
  const isSuperAdmin = staff.role === 'super_admin';
  const staffCourtId = (staff.court_id ?? '').trim();
  if (!isSuperAdmin && !staffCourtId) {
    return NextResponse.json<DashboardSummaryResponse>(
      { ok: false, message: 'ไม่พบข้อมูลศาลของเจ้าหน้าที่' },
      { status: 403 },
    );
  }

  const summaryParams = {
    p_event_id: eventId,
    p_keyword: null,
    p_status: null,
    p_region: null,
    p_province: null,
    p_organization: null,
    p_court_id: isSuperAdmin ? null : staffCourtId,
  };

  const summaryPromise = supabase
    .rpc('attendee_summary_counts', summaryParams)
    .single();

  let checkedAnyQuery = supabase
    .from('v_attendees_checkin_rounds')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .or('checkin_round1_at.not.is.null,checkin_round2_at.not.is.null,checkin_round3_at.not.is.null');
  if (!isSuperAdmin) {
    checkedAnyQuery = checkedAnyQuery.eq('court_id', staffCourtId);
  }
  const checkedAnyPromise = checkedAnyQuery;

  let latestNotCheckedQuery = supabase
    .from('v_attendees_checkin_rounds')
    .select('id, name_prefix, full_name, organization, phone')
    .eq('event_id', eventId)
    .is('checkin_round1_at', null)
    .is('checkin_round2_at', null)
    .is('checkin_round3_at', null)
    .order('created_at', { ascending: false })
    .limit(5);
  if (!isSuperAdmin) {
    latestNotCheckedQuery = latestNotCheckedQuery.eq('court_id', staffCourtId);
  }
  const latestNotCheckedPromise = latestNotCheckedQuery;

  const [
    { data: summaryRaw, error: summaryError },
    { count: checkedAny, error: checkedAnyError },
    { data: latestNotChecked, error: latestError },
  ] = await Promise.all([summaryPromise, checkedAnyPromise, latestNotCheckedPromise]);

  if (checkedAnyError) {
    return NextResponse.json<DashboardSummaryResponse>(
      { ok: false, message: checkedAnyError.message },
      { status: 500 },
    );
  }

  if (latestError) {
    return NextResponse.json<DashboardSummaryResponse>(
      { ok: false, message: latestError.message },
      { status: 500 },
    );
  }

  let summary = (summaryRaw ?? null) as SummaryRow | null;

  if (summaryError) {
    // Fallback when RPC function is missing or not in schema cache.
    const withCourtFilter = (q: any) => (isSuperAdmin ? q : q.eq('court_id', staffCourtId));
    const [
      { count: totalCount, error: totalError },
      { count: round1Count, error: round1Error },
      { count: round2Count, error: round2Error },
      { count: round3Count, error: round3Error },
      { count: slipCount, error: slipError },
    ] = await Promise.all([
      withCourtFilter(
        supabase
          .from('v_attendees_checkin_rounds')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', eventId),
      ),
      withCourtFilter(
        supabase
          .from('v_attendees_checkin_rounds')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .not('checkin_round1_at', 'is', null),
      ),
      withCourtFilter(
        supabase
          .from('v_attendees_checkin_rounds')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .not('checkin_round2_at', 'is', null),
      ),
      withCourtFilter(
        supabase
          .from('v_attendees_checkin_rounds')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .not('checkin_round3_at', 'is', null),
      ),
      withCourtFilter(
        supabase
          .from('v_attendees_checkin_rounds')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .not('slip_url', 'is', null),
      ),
    ]);

    const fallbackError =
      totalError || round1Error || round2Error || round3Error || slipError;
    if (fallbackError) {
      return NextResponse.json<DashboardSummaryResponse>(
        { ok: false, message: fallbackError.message || summaryError.message },
        { status: 500 },
      );
    }

    summary = {
      total: totalCount ?? 0,
      round1: round1Count ?? 0,
      round2: round2Count ?? 0,
      round3: round3Count ?? 0,
      slip: slipCount ?? 0,
    };
  }
  const total = summary?.total ?? 0;
  const checked = checkedAny ?? 0;
  const notChecked = Math.max(0, total - checked);

  return NextResponse.json<DashboardSummaryResponse>({
    ok: true,
    data: {
      total,
      checked,
      notChecked,
      slip: summary?.slip ?? 0,
      round1: summary?.round1 ?? 0,
      round2: summary?.round2 ?? 0,
      round3: summary?.round3 ?? 0,
      latestNotChecked: (latestNotChecked ?? []) as Array<{
        id: string;
        name_prefix: string | null;
        full_name: string | null;
        organization: string | null;
        phone: string | null;
      }>,
    },
  });
}
