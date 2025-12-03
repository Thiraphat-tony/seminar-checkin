// app/api/admin/export-namecards-pdf-html/route.ts
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { createServerClient } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
// foodType labels removed per request

function buildQrUrl(ticketToken: string | null, qrImageUrl: string | null) {
  if (qrImageUrl && qrImageUrl.trim().length > 0) return qrImageUrl;
  if (!ticketToken) return null;
  const encoded = encodeURIComponent(ticketToken);
  return `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encoded}`;
}

function loadFontBase64(p: string) {
  try {
    const file = fs.readFileSync(p);
    return Buffer.from(file).toString('base64');
  } catch {
    return null;
  }
}

async function renderHtml(attendees: Array<any>) {
  // Embed fonts directly to avoid headless Chromium missing Thai glyphs
  const fontRegularPath = path.join(process.cwd(), 'public', 'fonts', 'NotoSansThai-Regular.ttf');
  const fontBoldPath = path.join(process.cwd(), 'public', 'fonts', 'NotoSansThai-Bold.ttf');
  const fontMonoPath = path.join(process.cwd(), 'public', 'fonts', 'NotoSansMono-Regular.ttf');
  const reg64 = loadFontBase64(fontRegularPath);
  const bold64 = loadFontBase64(fontBoldPath);
  const mono64 = loadFontBase64(fontMonoPath);

  const css = `
    @font-face { font-family: 'NotoThai'; src: url(data:font/ttf;base64,${reg64}); font-weight: 400; }
    @font-face { font-family: 'NotoThai'; src: url(data:font/ttf;base64,${bold64}); font-weight: 700; }
    @font-face { font-family: 'MonoLocal'; src: url(data:font/ttf;base64,${mono64}); }
    @page { size: A4; margin: 10mm 8mm; }
    html, body { padding:0; margin:0; }
    body { font-family: 'NotoThai', system-ui, sans-serif; color: #111; }
    .page { width: 100%; height: calc(297mm - 20mm); padding: 16mm 16mm 16mm 16mm; box-sizing: border-box; page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    .title { font-weight:700; font-size:18px; margin-bottom:8px; }
    .card { border:1px solid #222; padding:14px; margin-bottom:8px; display:flex; align-items:center; justify-content:space-between; }
    .meta { flex: 1 1 auto; padding-right: 8px; }
    .name { font-weight:700; font-size:18px; margin-bottom:4px; }
    .info { font-size:13px; color:#222; margin:1px 0; line-height:1.2; }
    .token { font-family: 'MonoLocal', monospace; font-size:11px; color:#555; margin-top:4px; }
    .qr { width:100px; height:100px; object-fit:contain; }
  `;

  // chunk attendees into pages of 6
  const perPage = 6;
  const all = attendees || [];
  const pagesHtml: string[] = [];
  for (let i = 0; i < all.length; i += perPage) {
    const chunk = all.slice(i, i + perPage);
    const rows = chunk
      .map((a: any) => {
      const qr = buildQrUrl(a.ticket_token, a.qr_image_url);
      return `
        <div class="card">
          <div class="meta">
            <div class="name">${a.full_name ?? 'ไม่ระบุชื่อ'}</div>
            <div class="info">หน่วยงาน: ${a.organization ?? 'ไม่ระบุหน่วยงาน'}</div>
            <div class="info">ตำแหน่ง: ${a.job_position ?? 'ไม่ระบุตำแหน่ง'}</div>
            <div class="info">จังหวัด: ${a.province ?? 'ไม่ระบุจังหวัด'}</div>
            <div class="info">โทรศัพท์: ${a.phone ?? 'ไม่ระบุ'}</div>
            <div class="token">Token: ${a.ticket_token ?? '-'}</div>
          </div>
          <div style="width:110px;flex:0 0 110px;text-align:center">
            ${qr ? `<img class="qr" src="${qr}" alt="QR"/>` : `<div style="font-size:12px;color:#777">QR: ไม่มี</div>`}
          </div>
        </div>
      `;
      })
      .join('\n');

    pagesHtml.push(`
      <div class="page">
        <div class="title">รายชื่อนามบัตรผู้เข้าร่วมงาน (QR Name Cards)</div>
        ${rows}
      </div>
    `);
  }

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <style>${css}</style>
      </head>
      <body>
        ${pagesHtml.join('\n')}
      </body>
    </html>
  `;
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

    // Optional dev/testing: append a synthetic attendee when ?injectName=... is provided
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

    // No longer slice; render all pages.

    const html = await renderHtml(attendees);

    // Try to use a chromium binary packaged for serverless (works on Vercel).
    // If that's not available, fall back to the regular `puppeteer` package (local dev).
    let browser: any;
    
    if (process.env.VERCEL) {
      // On Vercel, always use @sparticuz/chromium
      try {
        const chromium = await import('@sparticuz/chromium');
        const puppeteer = await import('puppeteer-core');
        
        console.log('Loading Chromium executable for Vercel...');
        const executablePath = await chromium.executablePath();
        console.log('Chromium path:', executablePath);
        
        browser = await puppeteer.default.launch({
          args: chromium.args,
          defaultViewport: { width: 1200, height: 800 },
          executablePath,
          headless: chromium.headless,
        });
        console.log('Browser launched successfully on Vercel');
      } catch (e) {
        console.error('Chromium launch error on Vercel:', e);
        throw new Error(`Chromium serverless initialization failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else {
      // Local development - use regular puppeteer
      try {
        const puppeteer = (await import('puppeteer')) as any;
        browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
      } catch (e) {
        console.error('Failed to launch local puppeteer:', e);
        throw new Error('Puppeteer initialization failed in local development');
      }
    }
    const page = await browser.newPage();
    // allow loading local fonts and external images
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' } });
    await browser.close();

    // convert Buffer -> ArrayBuffer
    const arr = new Uint8Array(pdfBuffer as any);
    const buffer = new ArrayBuffer(arr.length);
    new Uint8Array(buffer).set(arr);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="namecards-html.pdf"',
      },
    });
  } catch (err) {
    console.error('Error generating HTML->PDF:', err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, message: 'เกิดข้อผิดพลาดในการสร้าง PDF (HTML engine)', detail }, { status: 500 });
  }
}
