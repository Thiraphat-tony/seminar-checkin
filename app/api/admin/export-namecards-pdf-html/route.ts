// app/api/admin/export-namecards-pdf-html/route.ts
import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { renderToStream, Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer';
import { createServerClient } from '@/lib/supabaseServer';
import path from 'path';
import fs from 'fs';

export const runtime = 'nodejs';

// Register fonts using base64 data URIs for maximum reliability on Vercel
function loadFontBase64(relativePath: string) {
  const abs = path.join(process.cwd(), 'public', 'fonts', relativePath);
  const bytes = fs.readFileSync(abs);
  return Buffer.from(bytes).toString('base64');
}

const sarabunRegularB64 = loadFontBase64('Sarabun-Regular.ttf');
const sarabunBoldB64 = loadFontBase64('Sarabun-Bold.ttf');
const notoMonoB64 = loadFontBase64('NotoSansMono-Regular.ttf');

Font.register({
  family: 'Sarabun',
  fonts: [
    { src: `data:font/ttf;charset=utf-8;base64,${sarabunRegularB64}`, fontWeight: 400 },
    { src: `data:font/ttf;charset=utf-8;base64,${sarabunBoldB64}`, fontWeight: 700 },
  ],
});

Font.register({
  family: 'NotoSansMono',
  src: `data:font/ttf;charset=utf-8;base64,${notoMonoB64}`,
});

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontFamily: 'Sarabun',
    fontSize: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 8,
  },
  card: {
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meta: {
    flex: 1,
    paddingRight: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
  },
  info: {
    fontSize: 13,
    color: '#222',
    marginBottom: 2,
    lineHeight: 1.2,
  },
  token: {
    fontFamily: 'NotoSansMono',
    fontSize: 11,
    color: '#555',
    marginTop: 4,
  },
  qr: {
    width: 100,
    height: 100,
  },
  qrContainer: {
    width: 110,
    alignItems: 'center',
  },
  noQr: {
    fontSize: 12,
    color: '#777',
  },
});

function buildQrUrl(ticketToken: string | null, qrImageUrl: string | null) {
  if (qrImageUrl && qrImageUrl.trim().length > 0) return qrImageUrl;
  if (!ticketToken) return null;
  const encoded = encodeURIComponent(ticketToken);
  return `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encoded}`;
}

function NameCard({ attendee }: { attendee: any }) {
  const qr = buildQrUrl(attendee.ticket_token, attendee.qr_image_url);
  
  // Clean up text fields
  const safeName = (attendee.full_name ?? 'ไม่ระบุชื่อ').replace(/\u0000/g, '').trim() || 'ไม่ระบุชื่อ';
  const safeOrg = (attendee.organization ?? 'ไม่ระบุหน่วยงาน').replace(/\u0000/g, '').trim() || 'ไม่ระบุหน่วยงาน';
  const safeJob = (attendee.job_position ?? 'ไม่ระบุตำแหน่ง').replace(/\u0000/g, '').trim() || 'ไม่ระบุตำแหน่ง';
  const safeProv = (attendee.province ?? 'ไม่ระบุจังหวัด').replace(/\u0000/g, '').trim() || 'ไม่ระบุจังหวัด';
  const safePhone = (attendee.phone ?? 'ไม่ระบุ').replace(/\u0000/g, '').trim() || 'ไม่ระบุ';

  return React.createElement(View, { style: styles.card },
    React.createElement(View, { style: styles.meta },
      React.createElement(Text, { style: styles.name }, safeName),
      React.createElement(Text, { style: styles.info }, `หน่วยงาน: ${safeOrg}`),
      React.createElement(Text, { style: styles.info }, `ตำแหน่ง: ${safeJob}`),
      React.createElement(Text, { style: styles.info }, `จังหวัด: ${safeProv}`),
      React.createElement(Text, { style: styles.info }, `โทรศัพท์: ${safePhone}`),
      React.createElement(Text, { style: styles.token }, `Token: ${attendee.ticket_token ?? '-'}`)
    ),
    React.createElement(View, { style: styles.qrContainer },
      qr ? React.createElement(Image, { src: qr, style: styles.qr }) : React.createElement(Text, { style: styles.noQr }, 'QR: ไม่มี')
    )
  );
}

function NameCardsDocument({ attendees }: { attendees: any[] }) {
  const perPage = 6;
  const pages: any[][] = [];
  
  for (let i = 0; i < attendees.length; i += perPage) {
    pages.push(attendees.slice(i, i + perPage));
  }

  return React.createElement(Document, null,
    ...pages.map((pageAttendees, pageIndex) =>
      React.createElement(Page, { key: pageIndex, size: 'A4', style: styles.page },
        React.createElement(Text, { style: styles.title }, 'รายชื่อนามบัตรผู้เข้าร่วมงาน (QR Name Cards)'),
        ...pageAttendees.map((att, idx) =>
          React.createElement(NameCard, { key: att.id || idx, attendee: att })
        )
      )
    )
  );
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const injectName = (searchParams.get('injectName') ?? '').trim();

    const { data, error } = await supabase
      .from('attendees')
      .select('id,full_name,phone,organization,job_position,province,qr_image_url,ticket_token')
      .order('full_name', { ascending: true });

    if (error || !data) {
      return NextResponse.json({ ok: false, message: 'ไม่สามารถโหลดข้อมูลผู้เข้าร่วมได้', detail: error?.message }, { status: 500 });
    }

    const attendees = data as any[];

    if (injectName) {
      attendees.push({
        id: `inject-${Date.now()}`,
        full_name: injectName,
        phone: null,
        organization: 'ทดสอบ (Injected)',
        job_position: null,
        province: null,
        qr_image_url: null,
        ticket_token: `INJ${Date.now().toString().slice(-4)}`,
      });
    }

    const doc = NameCardsDocument({ attendees });
    const stream = await renderToStream(doc);

    return new NextResponse(stream as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="namecards-react-pdf.pdf"',
      },
    });
  } catch (err) {
    console.error('Error generating PDF with @react-pdf/renderer:', err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, message: 'เกิดข้อผิดพลาดในการสร้าง PDF', detail }, { status: 500 });
  }
}
