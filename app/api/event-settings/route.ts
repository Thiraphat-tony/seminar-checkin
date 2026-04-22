import { NextResponse } from 'next/server';

export async function GET() {
  const eventId = (process.env.EVENT_ID ?? '').trim();

  if (!eventId) {
    return NextResponse.json({ error: 'EVENT_ID not configured' }, { status: 500 });
  }

  try {
    const { createServerClient } = await import('@/lib/supabaseServer');
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('events')
      .select('id, ai_assistant_enabled')
      .eq('id', eventId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? 'Event not found' },
        { status: 404 }
      );
    }

    const aiAssistantEnabled = data.ai_assistant_enabled !== false;

    return NextResponse.json({ aiAssistantEnabled });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}
