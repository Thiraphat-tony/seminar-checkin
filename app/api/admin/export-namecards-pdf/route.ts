import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import fontkit from '@pdf-lib/fontkit';
import { createServerClient } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const maxDuration = 60; // Vercel Pro: max 60s
export const dynamic = 'force-dynamic';

type AttendeeCardRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  organization: string | null;
  job_position: string | null;
  province: string | null;
  qr_image_url: string | null;
  ticket_token: string | null;
  food_type: string | null;
};

// small helper to consistently prefix debug logs
function log(...args: any[]) {
  // keep logs lightweight and readable
  // include timestamp and a fixed tag so you can grep logs easily
  console.log('[export-namecards-pdf]', new Date().toISOString(), ...args);
}

// ถ้าใน DB ยังไม่มี qr_image_url ให้ fallback เป็นลิงก์ QR จาก ticket_token
function buildQrUrl(ticketToken: string | null, qrImageUrl: string | null) {
  if (qrImageUrl && qrImageUrl.trim().length > 0) {
    return qrImageUrl;
  }
  if (!ticketToken) return null;
  const encoded = encodeURIComponent(ticketToken);
  return `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encoded}`;
}

// Launch Puppeteer with multiple fallbacks so we always have a Chromium binary
async function launchHtmlBrowser() {
  const envExecutable =
    process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_EXECUTABLE_PATH || null;
  const headlessEnv = (process.env.PUPPETEER_HEADLESS || '').trim().toLowerCase();
  const normalizeHeadless: 'new' | boolean = headlessEnv === 'false' ? false : headlessEnv === 'legacy' ? true : 'new';
  const baseArgs = process.env.PUPPETEER_ARGS
    ? process.env.PUPPETEER_ARGS.split(/\s+/).filter(Boolean)
    : ['--no-sandbox', '--disable-setuid-sandbox'];

  log('launchHtmlBrowser start', { envExecutable, headlessEnv, normalizeHeadless, baseArgs });

  const useEnvExecutable = async () => {
    const puppeteerCore = (await import('puppeteer-core')) as any;
    // best-effort: log puppeteer-core version
    try {
      const pcorePkg = await import('puppeteer-core/package.json').catch(() => null);
      if (pcorePkg && pcorePkg.version) log('puppeteer-core version:', pcorePkg.version);
    } catch (_) {
      /* ignore */
    }

    log('Attempting puppeteer-core.launch with env executable:', envExecutable);
    return puppeteerCore.launch({
      executablePath: envExecutable,
      headless: normalizeHeadless,
      args: baseArgs,
    });
  };

  if (envExecutable) {
    try {
      // check if path exists and is readable (useful when env points to a missing file)
      try {
        await fs.access(envExecutable);
        log('env executable path exists and is readable:', envExecutable);
      } catch (err) {
        log('env executable path does not exist or is not readable:', envExecutable, err && (err as Error).message);
      }

      const browser = await useEnvExecutable();
      log('Launched browser using env executable.');
      return browser;
    } catch (envErr) {
      log('Failed to launch Puppeteer with env executable, falling back. Error:', (envErr as Error).message || envErr);
    }
  } else {
    log('No PUPPETEER_EXECUTABLE_PATH / CHROME_EXECUTABLE_PATH provided, skipping env executable attempt.');
  }

  try {
    const chromium = (await import('@sparticuz/chromium')) as any;
    const puppeteerCore = (await import('puppeteer-core')) as any;

    // try to read executablePath returned by sparticuz/chromium for debugging
    let sparticuzExec: string | null = null;
    try {
      sparticuzExec = await chromium.executablePath;
      log('@sparticuz/chromium provided executablePath:', sparticuzExec);
      if (sparticuzExec) {
        try {
          await fs.access(sparticuzExec);
          log('sparticuz executable exists and is readable:', sparticuzExec);
        } catch (err) {
          log('sparticuz executable not accessible:', sparticuzExec, err && (err as Error).message);
        }
      }
    } catch (execErr) {
      log('Could not read sparticuz.executablePath:', execErr && (execErr as Error).message);
    }

    log('Attempting puppeteer-core.launch with @sparticuz/chromium', {
      args: chromium.args,
      defaultViewport: chromium.defaultViewport ?? { width: 1200, height: 800 },
      headless: chromium.headless,
    });

    const browser = await puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport ?? { width: 1200, height: 800 },
      executablePath: sparticuzExec ?? (await chromium.executablePath).catch?.(() => undefined),
      headless: chromium.headless,
    });

    log('Launched browser using @sparticuz/chromium fallback.');
    return browser;
  } catch (serverlessErr) {
    log('Falling back to bundled Puppeteer Chrome binary. Error from sparticuz attempt:', (serverlessErr as Error).message || serverlessErr);
  }

  try {
    const puppeteer = (await import('puppeteer')) as any;
    // best-effort: log puppeteer version
    try {
      const pPkg = await import('puppeteer/package.json').catch(() => null);
      if (pPkg && pPkg.version) log('puppeteer package version:', pPkg.version);
    } catch (_) {
      /* ignore */
    }
    log('Attempting to launch bundled puppeteer...');
    const browser = await puppeteer.launch();
    log('Launched bundled puppeteer successfully.');
    return browser;
  } catch (finalErr) {
    log('All browser launch attempts failed:', finalErr && (finalErr as Error).message);
    // rethrow so caller receives an error and can log its stack
    throw finalErr;
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);
    const keyword = (searchParams.get('q') ?? '').trim().toLowerCase();
    // default to the HTML (Puppeteer) engine for correct complex-script shaping
    // use `?engine=pdf` explicitly to force the pdf-lib vector path
    const engine = (searchParams.get('engine') ?? 'html').trim().toLowerCase();
    const injectName = (searchParams.get('injectName') ?? '').trim();

    const { data, error } = await supabase
      .from('attendees')
      .select(
        `
        id,
        full_name,
        phone,
        organization,
        job_position,
        province,
        qr_image_url,
        ticket_token,
        food_type
      `
      )
      .order('full_name', { ascending: true });

    if (error || !data) {
      log('Supabase error when loading attendees:', error?.message || error);
      return NextResponse.json(
        {
          ok: false,
          message: 'ไม่สามารถโหลดข้อมูลผู้เข้าร่วมได้',
          detail: error?.message,
        },
        { status: 500 }
      );
    }

    let attendees: AttendeeCardRow[] = data as AttendeeCardRow[];

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
        food_type: null,
      });
    }

    // filter ตาม keyword (ชื่อ / หน่วยงาน / ตำแหน่ง / จังหวัด / token)
    if (keyword) {
      attendees = attendees.filter((a) => {
        const name = (a.full_name ?? '').toLowerCase();
        const org = (a.organization ?? '').toLowerCase();
        const job = (a.job_position ?? '').toLowerCase();
        const prov = (a.province ?? '').toLowerCase();
        const token = (a.ticket_token ?? '').toLowerCase();

        return (
          name.includes(keyword) ||
          org.includes(keyword) ||
          job.includes(keyword) ||
          prov.includes(keyword) ||
          token.includes(keyword)
        );
      });
    }

    log('Attendees loaded, count:', attendees.length, 'engine:', engine, 'injectName:', !!injectName, 'keyword:', keyword || '-');

    // HTML engine is now enabled on Vercel Pro
    if (engine === 'html') {
      console.log('[export-namecards-pdf] Attempting HTML->PDF rendering with Puppeteer...');
      // inline small HTML renderer (similar to app/api/admin/export-namecards-pdf-html/route.ts)
      function buildQrUrlLocal(ticketToken: string | null, qrImageUrl: string | null) {
        if (qrImageUrl && qrImageUrl.trim().length > 0) return qrImageUrl;
        if (!ticketToken) return null;
        const encoded = encodeURIComponent(ticketToken);
        return `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encoded}`;
      }

      async function renderHtml(att: Array<any>) {
        const css = `
          @font-face { font-family: 'NotoThai'; src: url('/fonts/NotoSansThai-Regular.ttf') format('truetype'); font-weight: 400; }
          @font-face { font-family: 'NotoThai'; src: url('/fonts/NotoSansThai-Bold.ttf') format('truetype'); font-weight: 700; }
          @font-face { font-family: 'MonoLocal'; src: url('/fonts/NotoSansMono-Regular.ttf') format('truetype'); }
          body { font-family: 'NotoThai', system-ui, sans-serif; color: #111; }
          .page { width: 210mm; min-height: 297mm; padding: 24mm; box-sizing: border-box; page-break-after: always; }
          .page:last-child { page-break-after: auto; }
          .title { font-weight:700; font-size:18px; margin-bottom:8px; }
          .card { padding:16px; margin-bottom:8px; display:flex; align-items:center; justify-content:space-between; }
          .meta { flex: 1 1 auto; padding-right: 8px; }
          .name { font-weight:700; font-size:18px; margin-bottom:4px; }
          .info { font-size:13px; color:#222; margin:1px 0; line-height:1.15; }
          .token { font-family: 'MonoLocal', monospace; font-size:11px; color:#555; margin-top:4px; }
          .qr { width:100px; height:100px; object-fit:contain; }
        `;
        // chunk into pages of 6
        const perPage = 6;
        const all = att || [];
        const pagesHtml: string[] = [];
        for (let i = 0; i < all.length; i += perPage) {
          const chunk = all.slice(i, i + perPage);
          const rows = chunk
            .map((a: any) => {
              const qr = buildQrUrlLocal(a.ticket_token, a.qr_image_url);
              // Clean up text fields to remove null bytes and special characters
              const safeName = (a.full_name ?? 'ไม่ระบุชื่อ').replace(/\u0000/g, '').trim() || 'ไม่ระบุชื่อ';
              const safeOrg = (a.organization ?? 'ไม่ระบุหน่วยงาน').replace(/\u0000/g, '').trim() || 'ไม่ระบุหน่วยงาน';
              const safeJob = (a.job_position ?? 'ไม่ระบุตำแหน่ง').replace(/\u0000/g, '').trim() || 'ไม่ระบุตำแหน่ง';
              const safeProv = (a.province ?? 'ไม่ระบุจังหวัด').replace(/\u0000/g, '').trim() || 'ไม่ระบุจังหวัด';
              const safePhone = (a.phone ?? 'ไม่ระบุ').replace(/\u0000/g, '').trim() || 'ไม่ระบุ';
              return `
              <div class="card">
                <div class="meta">
                  <div class="name">${safeName}</div>
                  <div class="info">หน่วยงาน: ${safeOrg}</div>
                  <div class="info">ตำแหน่ง: ${safeJob}</div>
                  <div class="info">จังหวัด: ${safeProv}</div>
                  <div class="info">โทรศัพท์: ${safePhone}</div>
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

        log('renderHtml created pages:', pagesHtml.length, 'attendeesRendered:', all.length);
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

      try {
        const html = await renderHtml(attendees as any[]);
        log('HTML size (chars):', html.length, 'first200chars:', html.slice(0, 200).replace(/\n/g, ' '));
        let browser: any;
        try {
          browser = await launchHtmlBrowser();
          log('Browser instance obtained. Creating new page...');
          const page = await browser.newPage();
          log('Setting page content (networkidle0)...');
          try {
            await page.setContent(html, { waitUntil: 'networkidle0' });
            log('page.setContent resolved.');
          } catch (setContentErr) {
            log('page.setContent failed:', (setContentErr as Error).message || setContentErr);
            throw setContentErr;
          }

          log('Generating PDF via page.pdf...');
          const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' } });
          log('page.pdf finished, size bytes:', (pdfBuffer as any)?.byteLength ?? (pdfBuffer as any)?.length);

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
        } finally {
          if (browser) {
            try {
              await browser.close();
              log('Browser closed.');
            } catch (closeErr) {
              log('Error while closing browser:', (closeErr as Error).message || closeErr);
            }
          }
        }
      } catch (htmlErr) {
        const anyErr: any = htmlErr as any;
        const detail = anyErr && typeof anyErr === 'object' && 'message' in anyErr
          ? String((anyErr as { message?: unknown }).message)
          : (typeof anyErr === 'string' ? anyErr : (() => { try { return JSON.stringify(anyErr); } catch { return String(anyErr); } })());
        const stack = anyErr && typeof anyErr === 'object' && 'stack' in anyErr ? String((anyErr as { stack?: unknown }).stack) : undefined;
        log('Error generating HTML->PDF (engine=html):', detail, 'stack:', stack);
        // Auto-fallback to pdf-lib when Puppeteer/Chrome is unavailable (always fallback on any error)
        console.warn('[export-namecards-pdf] HTML engine failed, falling back to pdf-lib engine (vector-based). Error:', detail);
        // Continue to pdf-lib rendering below instead of returning error
      }
    }

    // ---------- สร้าง PDF ----------
    const pdfDoc = await PDFDocument.create();
    // register fontkit so pdf-lib can embed custom TTF/OTF fonts that support Unicode
    try {
      pdfDoc.registerFontkit(fontkit as any);
    } catch (regErr) {
      console.warn('Warning: failed to register fontkit (embedding custom fonts may fail):', regErr);
    }

    // Try to embed a local TTF font that supports Thai (e.g. NotoSansThai).
    // Place `NotoSansThai-Regular.ttf` and optionally `NotoSansThai-Bold.ttf`
    // into `public/fonts/` at the project root.
    let font: any;
    let fontBold: any;
    let fontMono: any;
    try {
      const regularPath = path.join(process.cwd(), 'public', 'fonts', 'NotoSansThai-Regular.ttf');
      const boldPath = path.join(process.cwd(), 'public', 'fonts', 'NotoSansThai-Bold.ttf');
      const monoPath1 = path.join(process.cwd(), 'public', 'fonts', 'RobotoMono-Regular.ttf');
      const monoPath2 = path.join(process.cwd(), 'public', 'fonts', 'NotoSansMono-Regular.ttf');

      const [regularBytes, boldBytes, monoBytes1, monoBytes2] = await Promise.all([
        fs.readFile(regularPath).catch(() => null),
        fs.readFile(boldPath).catch(() => null),
        fs.readFile(monoPath1).catch(() => null),
        fs.readFile(monoPath2).catch(() => null),
      ]);

      const monoBytes = monoBytes1 ?? monoBytes2 ?? null;

      log(
        'Font files — regular bytes:',
        regularBytes ? (regularBytes.length ?? (regularBytes as any).byteLength) : 'none',
        ', bold bytes:',
        boldBytes ? (boldBytes.length ?? (boldBytes as any).byteLength) : 'none',
        ', mono present:',
        monoBytes ? 'yes' : 'no'
      );

      if (regularBytes) {
        try {
          const regularArr = regularBytes instanceof Uint8Array ? regularBytes : Uint8Array.from(regularBytes as any);
          font = await pdfDoc.embedFont(regularArr, { subset: false });
          log('Embedded regular TTF font (no-subset), bytes:', regularArr.length);
        } catch (embedErr) {
          console.warn('Failed to embed regular TTF font, will try fallback. Error:', embedErr);
        }
      }

      if (boldBytes) {
        try {
          const boldArr = boldBytes instanceof Uint8Array ? boldBytes : Uint8Array.from(boldBytes as any);
          fontBold = await pdfDoc.embedFont(boldArr, { subset: false });
          log('Embedded bold TTF font (no-subset), bytes:', boldArr.length);
        } catch (embedErr) {
          console.warn('Failed to embed bold TTF font, continuing. Error:', embedErr);
        }
      }

      // try embed monospace font for token/QR labels
      if (monoBytes) {
        try {
          const monoArr = monoBytes instanceof Uint8Array ? monoBytes : Uint8Array.from(monoBytes as any);
          fontMono = await pdfDoc.embedFont(monoArr, { subset: false });
          log('Embedded monospace font (no-subset), bytes:', monoArr.length);
        } catch (embedErr) {
          console.warn('Failed to embed mono font, continuing. Error:', embedErr);
        }
      }

      if (!font) {
        // fallback to Standard fonts (will NOT support Thai)
        font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        console.warn('Thai font not found/embedded — falling back to Helvetica. Add a TTF font to public/fonts to support Thai characters.');
      }
      if (!fontBold) fontBold = font;
      if (!fontMono) fontMono = font;
    } catch (e) {
      // Any error reading/embedding font -> fallback
      console.warn('Error reading/embedding custom font, falling back to standard fonts.', e);
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      fontMono = font;
    }

    const pageWidth = 595; // A4 width
    const pageHeight = 842; // A4 height

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let cursorY = pageHeight - 40;

    const marginX = 40;
    const cardHeight = 140; // ความสูงแต่ละนามบัตร (เพิ่มขึ้นเพื่อให้พื้นที่มากขึ้น)
    const cardGap = 18; // ระยะห่างระหว่างบัตร

    // helper: simple truncation to avoid overflowing very long tokens/URLs
    function truncate(text: string, max = 60) {
      if (!text) return text;
      return text.length > max ? text.slice(0, max - 3) + '...' : text;
    }

    // helper: draw small crop marks around a rectangle (simple filled bars)
    function drawCropMarks(
      pg: any,
      x: number,
      yTop: number,
      w: number,
      h: number,
      markLen = 12,
      thickness = 0.8
    ) {
      const col = rgb(0.1, 0.1, 0.1);
      // top-left horizontal
      pg.drawRectangle({ x: x - markLen, y: yTop + 2, width: markLen, height: thickness, color: col });
      // top-left vertical
      pg.drawRectangle({ x: x - 2, y: yTop - markLen + 2, width: thickness, height: markLen, color: col });

      // top-right horizontal
      pg.drawRectangle({ x: x + w, y: yTop + 2, width: markLen, height: thickness, color: col });
      // top-right vertical
      pg.drawRectangle({ x: x + w + 2, y: yTop - markLen + 2, width: thickness, height: markLen, color: col });

      // bottom-left horizontal
      pg.drawRectangle({ x: x - markLen, y: yTop - h - 2 - thickness, width: markLen, height: thickness, color: col });
      // bottom-left vertical
      pg.drawRectangle({ x: x - 2, y: yTop - h - 2, width: thickness, height: markLen, color: col });

      // bottom-right horizontal
      pg.drawRectangle({ x: x + w, y: yTop - h - 2 - thickness, width: markLen, height: thickness, color: col });
      // bottom-right vertical
      pg.drawRectangle({ x: x + w + 2, y: yTop - h - 2, width: thickness, height: markLen, color: col });
    }

    // title บนหน้าแรก
    page.drawText('รายชื่อนามบัตรผู้เข้าร่วมงาน (QR Name Cards)', {
      x: marginX,
      y: cursorY,
      size: 18,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    cursorY -= 34;

    // Debug: log first attendee sample and font presence
    try {
      if (attendees.length > 0) {
        const sampleName = attendees[0].full_name || '';
        const codes = Array.from(sampleName).map((ch) => ch.codePointAt(0));
        log('DEBUG sampleName:', sampleName);
        log('DEBUG sampleName codepoints:', codes);
      }
      log('DEBUG fonts present: regular=', !!font, 'bold=', !!fontBold, 'mono=', !!fontMono);
    } catch (dErr) {
      console.warn('DEBUG logging failed:', dErr);
    }

    // เคสไม่มีข้อมูล
    if (attendees.length === 0) {
      page.drawText('ไม่พบนามบัตรตามเงื่อนไขที่ค้นหา', {
        x: marginX,
        y: cursorY,
        size: 12,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });

      const emptyBytes = await pdfDoc.save();

      // copy to a plain ArrayBuffer to avoid ArrayBuffer|SharedArrayBuffer union
      const emptyBuffer = new ArrayBuffer(emptyBytes.byteLength);
      new Uint8Array(emptyBuffer).set(emptyBytes);

      return new NextResponse(emptyBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline; filename="namecards.pdf"',
        },
      });
    }

    // วาดนามบัตรแต่ละใบ
    for (const a of attendees) {
      // ถ้าพื้นที่ไม่พอให้สร้างหน้าใหม่
      if (cursorY - cardHeight < 40) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        cursorY = pageHeight - 40;
      }

      // กล่องนามบัตร
      page.drawRectangle({
        x: marginX,
        y: cursorY - cardHeight,
        width: pageWidth - marginX * 2,
        height: cardHeight,
        color: rgb(1, 1, 1),
      });

      // simple crop marks for cutting
      drawCropMarks(page, marginX, cursorY, pageWidth - marginX * 2, cardHeight);

      const textX = marginX + 12;
      let textY = cursorY - 18;

      // Clean up text fields to remove null bytes and special characters
      const cleanName = (a.full_name || 'ไม่ระบุชื่อ').replace(/\u0000/g, '').trim() || 'ไม่ระบุชื่อ';
      const cleanOrg = (a.organization || 'ไม่ระบุหน่วยงาน').replace(/\u0000/g, '').trim() || 'ไม่ระบุหน่วยงาน';
      const cleanJob = (a.job_position || 'ไม่ระบุตำแหน่ง').replace(/\u0000/g, '').trim() || 'ไม่ระบุตำแหน่ง';
      const cleanProv = (a.province || 'ไม่ระบุจังหวัด').replace(/\u0000/g, '').trim() || 'ไม่ระบุจังหวัด';

      // ชื่อใหญ่ขึ้น
      page.drawText(cleanName, {
        x: textX,
        y: textY,
        size: 18,
        font: fontBold,
        color: rgb(0.05, 0.05, 0.05),
      });
      textY -= 20;

      page.drawText(`หน่วยงาน: ${truncate(cleanOrg, 56)}`, {
        x: textX,
        y: textY,
        size: 13,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      textY -= 16;

      page.drawText(`ตำแหน่ง: ${truncate(cleanJob, 56)}`, {
        x: textX,
        y: textY,
        size: 13,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      textY -= 16;

      page.drawText(`จังหวัด: ${cleanProv}`, {
        x: textX,
        y: textY,
        size: 13,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      textY -= 16;


      page.drawText(`Token: ${truncate(a.ticket_token || '-', 40)}`, {
        x: textX,
        y: textY,
        size: 11,
        font: fontMono,
        color: rgb(0.3, 0.3, 0.3),
      });

      // Embed QR image (if available) instead of printing the long URL
      const qrUrl = buildQrUrl(a.ticket_token, a.qr_image_url);
      if (qrUrl) {
        try {
          const resp = await fetch(qrUrl);
          if (resp.ok) {
            const ct = resp.headers.get('content-type') || '';
            const arr = new Uint8Array(await resp.arrayBuffer());
            let qrImage: any = null;
            if (ct.includes('png')) {
              qrImage = await pdfDoc.embedPng(arr);
            } else if (ct.includes('jpeg') || ct.includes('jpg')) {
              qrImage = await pdfDoc.embedJpg(arr);
            } else {
              // try png first, then jpg
              try { qrImage = await pdfDoc.embedPng(arr); } catch { qrImage = await pdfDoc.embedJpg(arr); }
            }

            if (qrImage) {
              const imgW = 100;
              const imgH = 100;
              // place QR at the rightmost inside the card (small inner padding)
              const imgX = pageWidth - marginX - imgW - 6;
              const imgY = cursorY - cardHeight + (cardHeight - imgH) / 2;
              page.drawImage(qrImage, { x: imgX, y: imgY, width: imgW, height: imgH });
            }
          } else {
            // failed to fetch image; leave text marker
            page.drawText(`QR: มี`, {
              x: textX,
              y: cursorY - cardHeight + 16,
              size: 10,
              font: fontMono,
              color: rgb(0.4, 0.4, 0.4),
            });
          }
        } catch (fetchErr) {
          console.warn('Failed to fetch/embed QR image:', fetchErr);
          page.drawText(`QR: มี`, {
            x: textX,
            y: cursorY - cardHeight + 16,
            size: 10,
            font: fontMono,
            color: rgb(0.4, 0.4, 0.4),
          });
        }
      }

      cursorY -= cardHeight + cardGap;
    }

    // บันทึก PDF แล้วส่งกลับ
    const pdfBytes = await pdfDoc.save();

    // copy to a plain ArrayBuffer to avoid ArrayBuffer|SharedArrayBuffer union
    const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength);
    new Uint8Array(pdfBuffer).set(pdfBytes);

    log('PDF generated successfully, size bytes:', pdfBytes.byteLength);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="namecards.pdf"',
      },
    });
  } catch (err) {
    log('Error generating namecards PDF:', err && (err as Error).message, 'stack:', err instanceof Error ? err.stack : undefined);

    const detail = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error && err.stack ? err.stack : undefined;

    return NextResponse.json(
      {
        ok: false,
        message: 'เกิดข้อผิดพลาดในการสร้างไฟล์ PDF นามบัตร',
        detail,
        stack,
      },
      { status: 500 }
    );
  }
}

// npm i -g vercel
// vercel login
// vercel link
// vercel env pull .env.local
// vercel --prod