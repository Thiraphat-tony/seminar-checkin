// app/api/admin/export-namecards-pdf-html/route.ts
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { createServerClient } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
// foodType labels removed per request

function buildQrUrl(ticketToken: string | null, qrImageUrl: string | null) {
  if (qrImageUrl && qrImageUrl.trim().length > 0) return qrImageUrl;
  if (!ticketToken) return null;
  const encoded = encodeURIComponent(ticketToken);
  return `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encoded}`;
}

async function renderHtml(attendees: Array<any>) {
  // Reference fonts from /fonts (public)
  const css = `
    @font-face { font-family: 'NotoThai'; src: url('/fonts/NotoSansThai-Regular.ttf') format('truetype'); font-weight: 400; }
    @font-face { font-family: 'NotoThai'; src: url('/fonts/NotoSansThai-Bold.ttf') format('truetype'); font-weight: 700; }
    @font-face { font-family: 'MonoLocal'; src: url('/fonts/NotoSansMono-Regular.ttf') format('truetype'); }
    body { font-family: 'NotoThai', system-ui, sans-serif; color: #111; }
    .page { width: 210mm; min-height: 297mm; padding: 24mm; box-sizing: border-box; page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    .title { font-weight:700; font-size:18px; margin-bottom:8px; }
    .card { border:1px solid #ddd; padding:16px; margin-bottom:8px; display:flex; align-items:center; justify-content:space-between; }
    .meta { flex: 1 1 auto; padding-right: 8px; }
    .name { font-weight:700; font-size:18px; margin-bottom:4px; }
    .info { font-size:13px; color:#222; margin:1px 0; line-height:1.15; }
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
  let html: string | null = null;
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

    // Only render the first 6 entries (one page)
    const pageItems = attendees.slice(0, 6);

    html = await renderHtml(attendees);

    // Try several strategies to get a runnable Chromium on serverless hosts.
    // 1) @sparticuz/chromium + puppeteer-core (works on Vercel when available)
    // 2) chrome-aws-lambda + puppeteer-core (common serverless fallback)
    // 3) puppeteer (local dev fallback)
    let browser: any = null;
    const launchErrors: Array<{ method: string; error: any }> = [];

    // Strategy 1: @sparticuz/chromium
    try {
      const chromium = (await import('@sparticuz/chromium')) as any;
      const puppeteer = (await import('puppeteer-core')) as any;
      const exe = await chromium.executablePath;
      console.log('[pdf] sparticuz.executablePath=', exe);
      browser = await puppeteer.launch({
        args: chromium.args || [],
        defaultViewport: { width: 1200, height: 800 },
        executablePath: exe || undefined,
        headless: chromium.headless ?? true,
      });
      console.log('[pdf] Launched browser via @sparticuz/chromium');
    } catch (e) {
      launchErrors.push({ method: '@sparticuz/chromium', error: e });
      console.warn('[pdf] @sparticuz/chromium launch failed:', String(e));
    }

    // (chrome-aws-lambda fallback removed to avoid peer-dep conflicts)

    // Strategy 3: full puppeteer (development)
    if (!browser) {
      try {
        const puppeteer = (await import('puppeteer')) as any;
        console.log('[pdf] falling back to puppeteer (local dev)');
        browser = await puppeteer.launch();
        console.log('[pdf] Launched browser via puppeteer');
      } catch (e) {
        launchErrors.push({ method: 'puppeteer', error: e });
        console.warn('[pdf] puppeteer launch failed:', String(e));
      }
    }

    if (!browser) {
      const details = launchErrors.map(le => `${le.method}: ${String(le.error)}`).join(' | ');
      console.error('[pdf] Unable to launch Chromium. Attempts:', details);
      // Fallback: return the rendered HTML so the user can open in browser and print to PDF manually.
      const printUi = `
        <div style="position:fixed;right:12px;top:12px;z-index:9999">
          <button onclick="window.print()" style="padding:8px 12px;border-radius:6px;border:1px solid #ccc;background:#fff;">Print / Save as PDF</button>
        </div>
        <script>
          try {
            if (new URLSearchParams(location.search).get('print') === '1') {
              setTimeout(()=>window.print(), 300);
            }
          } catch(e) { /* ignore */ }
        </script>
      `;
      const finalHtml = html.replace('</body>', `${printUi}</body>`);
      return new NextResponse(finalHtml, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
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
    // If the error is due to missing Chrome / launch failures, return printable HTML fallback
    const lower = String(detail).toLowerCase();
    if (lower.includes('could not find chrome') || lower.includes('unable to launch chromium') || lower.includes('could not find chromium') || lower.includes('no usable chromium')) {
      try {
        const printUi = `
          <div style="position:fixed;right:12px;top:12px;z-index:9999">
            <button onclick="window.print()" style="padding:8px 12px;border-radius:6px;border:1px solid #ccc;background:#fff;">Print / Save as PDF</button>
          </div>
          <script>
            try {
              if (new URLSearchParams(location.search).get('print') === '1') {
                setTimeout(()=>window.print(), 300);
              }
            } catch(e) { /* ignore */ }
          </script>
        `;
        const finalHtml = html
          ? html.replace('</body>', `${printUi}</body>`)
          : `<!doctype html><html><head><meta charset="utf-8" /></head><body><div style="padding:24px">PDF rendering is currently unavailable on the server. Use the button to print/save as PDF.</div>${printUi}</body></html>`;
        return new NextResponse(finalHtml, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      } catch (e2) {
        console.error('Failed to return HTML fallback after chrome error:', e2);
        return NextResponse.json({ ok: false, message: 'เกิดข้อผิดพลาดในการสร้าง PDF (HTML engine)', detail }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: false, message: 'เกิดข้อผิดพลาดในการสร้าง PDF (HTML engine)', detail }, { status: 500 });
  }
}
