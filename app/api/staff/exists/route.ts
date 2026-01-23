import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const courtId = (url.searchParams.get('court_id') ?? '').trim();

    if (!courtId) {
      return NextResponse.json(
        { ok: false, message: 'COURT_ID_REQUIRED' },
        { status: 400 },
      );
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('staff_profiles')
      .select('user_id')
      .eq('court_id', courtId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, exists: !!data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN_ERROR';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
