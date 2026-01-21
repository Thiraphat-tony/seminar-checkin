import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('courts')
      .select('id, court_name, max_staff')
      .order('court_name', { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, courts: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN_ERROR';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
