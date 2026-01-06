// app/api/admin/update-attendee/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { phoneForStorage } from '@/lib/phone';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as {
    id?: string;
    event_id?: string | null;
    full_name?: string | null;
    phone?: string | null;
    organization?: string | null;
    job_position?: string | null;
    province?: string | null;
    region?: number | null;
    ticket_token?: string | null;
    qr_image_url?: string | null;
    slip_url?: string | null;
    food_type?: string | null;
    coordinator_name?: string | null;
    hotel_name?: string | null;
    checked_in_at?: string | null; // ISO timestamp expected, or null
  } | null;

  if (!body?.id) {
    return NextResponse.json(
      { error: 'missing id' },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  // Build update object only from allowed fields (match DB schema)
  const updateData: Record<string, any> = {};
  const allowed = [
    'event_id',
    'full_name',
    'phone',
    'organization',
    'job_position',
    'province',
    'region',
    'ticket_token',
    'qr_image_url',
    'slip_url',
    'food_type',
    'coordinator_name',
    'hotel_name',
    'checked_in_at',
  ];
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      updateData[key] = (body as any)[key] ?? null;
    }
  }

  // Validate region if present (must be 1-9)
  if (Object.prototype.hasOwnProperty.call(body, 'region') && updateData.region != null) {
    const regionNum = Number(updateData.region);
    if (!Number.isInteger(regionNum) || regionNum < 1 || regionNum > 9) {
      return NextResponse.json({ error: 'invalid region (must be 1-9)' }, { status: 400 });
    }
    updateData.region = regionNum;
  }

  // Validate phone if present: must be 10 digits after normalization
  if (Object.prototype.hasOwnProperty.call(body, 'phone') && updateData.phone != null) {
    const normalized = phoneForStorage(String(updateData.phone));
    if (!normalized) {
      return NextResponse.json({ error: 'invalid phone (must be 10 digits)' }, { status: 400 });
    }
    updateData.phone = normalized;
  }

  // Validate food_type if present
  if (Object.prototype.hasOwnProperty.call(body, 'food_type') && updateData.food_type != null) {
    const allowedFood = new Set([
      'normal',
      'no_pork',
      'vegetarian',
      'vegan',
      'halal',
      'seafood_allergy',
      'other',
    ]);
    if (!allowedFood.has(String(updateData.food_type))) {
      return NextResponse.json({ error: 'invalid food_type' }, { status: 400 });
    }
  }

  // Validate checked_in_at if present: allow ISO or null
  if (Object.prototype.hasOwnProperty.call(body, 'checked_in_at') && updateData.checked_in_at != null) {
    const ts = Date.parse(String(updateData.checked_in_at));
    if (Number.isNaN(ts)) {
      return NextResponse.json({ error: 'invalid checked_in_at (expect ISO timestamp)' }, { status: 400 });
    }
    // store as ISO string
    updateData.checked_in_at = new Date(ts).toISOString();
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'no updatable fields provided' }, { status: 400 });
  }

  const { error } = await supabase.from('attendees').update(updateData).eq('id', body.id);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
