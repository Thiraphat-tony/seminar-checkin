// app/api/admin/export-namecards-pdf/route.ts

import { NextResponse } from 'next/server';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { createServerClient } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CachedBytes = {
  bytes: Uint8Array;
  expiresAt: number;
};

const FONT_CACHE_TTL_MS = 60 * 60 * 1000;
const QR_CACHE_TTL_MS = 10 * 60 * 1000;

const globalCache = (() => {
  const globalAny = globalThis as typeof globalThis & {
    __namecardFontCache?: {
      regular?: CachedBytes;
      bold?: CachedBytes;
    };
    __namecardQrCache?: Map<string, CachedBytes>;
  };

  if (!globalAny.__namecardFontCache) {
    globalAny.__namecardFontCache = {};
  }
  if (!globalAny.__namecardQrCache) {
    globalAny.__namecardQrCache = new Map();
  }

  return {
    fontCache: globalAny.__namecardFontCache,
    qrCache: globalAny.__namecardQrCache,
  };
})();

type AttendeeRow = {
  name_prefix: string | null;
  full_name: string | null;
  organization: string | null;
  job_position: string | null;
  province: string | null;
  region: number | null;
  qr_image_url: string | null;
  ticket_token: string | null;
};

// Map enum values and legacy "????" strings from old registration encoding.
const JOB_POSITION_LABELS: Record<string, string> = {
  chief_judge: 'ผู้พิพากษาหัวหน้าศาล',
  associate_judge: 'ผู้พิพากษาสมทบ',
  '????????????????????': 'ผู้พิพากษาหัวหน้าศาล',
  '??????????????': 'ผู้พิพากษาสมทบ',
};

function formatJobPosition(jobPosition: string | null): string {
  if (!jobPosition) return '';
  const trimmed = jobPosition.trim();
  if (!trimmed) return '';
  return JOB_POSITION_LABELS[trimmed] ?? trimmed;
}

function buildQrUrl(qrImageUrl: string | null, ticketToken: string | null) {
  if (qrImageUrl && qrImageUrl.trim().length > 0) {
    return qrImageUrl;
  }
  if (!ticketToken) return null;
  const encoded = encodeURIComponent(ticketToken);
  return `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encoded}`;
}

function isValidRegion(n: number) {
  return Number.isInteger(n) && n >= 0 && n <= 9;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length) as R[];
  let i = 0;

  const runners = Array.from({ length: Math.max(1, limit) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  });

  await Promise.all(runners);
  return results;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const regionParam = url.searchParams.get('region');

    if (regionParam == null) {
      return NextResponse.json(
        { ok: false, message: 'กรุณาระบุ region (0-9) ก่อน Export' },
        { status: 400 }
      );
    }

    const region = Number(regionParam);
    if (!isValidRegion(region)) {
      return NextResponse.json(
        { ok: false, message: 'region ไม่ถูกต้อง (ต้องเป็นเลข 0-9)' },
        { status: 400 }
      );
    }

    const eventId = (process.env.EVENT_ID ?? '').trim();
    if (!eventId) {
      return NextResponse.json(
        { ok: false, message: 'EVENT_ID_REQUIRED' },
        { status: 400 },
      );
    }

    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from('attendees')
      .select(
        'name_prefix, full_name, organization, job_position, province, region, qr_image_url, ticket_token',
      )
      .eq('event_id', eventId)
      .eq('region', region)
      .order('organization', { ascending: true })
      .order('job_position', { ascending: true })
      .order('full_name', { ascending: true });

    if (error) {
      console.error('[export-namecards-pdf] Supabase error:', error);
      return NextResponse.json(
        {
          ok: false,
          message: 'ไม่สามารถดึงข้อมูลผู้เข้าร่วมได้',
          detail: error.message,
        },
        { status: 500 }
      );
    }

    const attendees = (data ?? []) as AttendeeRow[];

    if (attendees.length === 0) {
      return NextResponse.json(
        { ok: false, message: `ไม่พบผู้เข้าร่วมในภาค ${region}` },
        { status: 404 }
      );
    }

    // ✅ โหลดฟอนต์ผ่าน HTTP จาก public/fonts (รองรับ Serverless/Vercel)
    const regularFontUrl = new URL('/fonts/Sarabun-Regular.ttf', url.origin).toString();
    const boldFontUrl = new URL('/fonts/Sarabun-Bold.ttf', url.origin).toString();

    const now = Date.now();
    const cachedRegular =
      globalCache.fontCache.regular && globalCache.fontCache.regular.expiresAt > now
        ? globalCache.fontCache.regular.bytes
        : null;
    const cachedBold =
      globalCache.fontCache.bold && globalCache.fontCache.bold.expiresAt > now
        ? globalCache.fontCache.bold.bytes
        : null;

    let regularFontBytes = cachedRegular;
    let boldFontBytes = cachedBold;

    if (!regularFontBytes || !boldFontBytes) {
      const [regularResp, boldResp] = await Promise.all([
        fetch(regularFontUrl, { cache: 'no-store' }),
        fetch(boldFontUrl, { cache: 'no-store' }),
      ]);

      if (!regularResp.ok || !boldResp.ok) {
        const missing = [
          !regularResp.ok ? 'Sarabun-Regular.ttf' : null,
          !boldResp.ok ? 'Sarabun-Bold.ttf' : null,
        ].filter(Boolean);
        return NextResponse.json(
          { ok: false, message: `ไม่พบไฟล์ฟอนต์: ${missing.join(', ')}` },
          { status: 500 }
        );
      }

      const [regularBytes, boldBytes] = await Promise.all([
        regularResp.arrayBuffer().then((ab) => new Uint8Array(ab)),
        boldResp.arrayBuffer().then((ab) => new Uint8Array(ab)),
      ]);

      regularFontBytes = regularBytes;
      boldFontBytes = boldBytes;

      globalCache.fontCache.regular = {
        bytes: regularBytes,
        expiresAt: Date.now() + FONT_CACHE_TTL_MS,
      };
      globalCache.fontCache.bold = {
        bytes: boldBytes,
        expiresAt: Date.now() + FONT_CACHE_TTL_MS,
      };
    }

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const thaiFont = await pdfDoc.embedFont(regularFontBytes);
    const thaiFontBold = await pdfDoc.embedFont(boldFontBytes);

    const pageWidth = 595.28; // A4 width (pt)
    const pageHeight = 841.89; // A4 height (pt)

    // จำนวนการ์ดต่อหน้า: 2 คอลัมน์ × 3 แถว = 6 ช่อง
    const cardsPerRow = 2;
    const cardsPerColumn = 3;
    const cardsPerPage = cardsPerRow * cardsPerColumn;

    const cardWidth = pageWidth / cardsPerRow;
    const cardHeight = pageHeight / cardsPerColumn;

    const marginX = 18;
    const marginY = 18;

    const fontSizeName = 18;
    const fontSizeJob = 12;
    const fontSizeOrg = 11;
    const fontSizeRegionProvince = 11;

    // ✅ Pre-fetch QR images แบบจำกัด concurrency (กันช้า/timeout)
    const uniqueQrUrls = Array.from(
      new Set(
        attendees
          .map((a) => buildQrUrl(a.qr_image_url, a.ticket_token))
          .filter((u): u is string => !!u),
      ),
    );

    const qrBytesMap = new Map<string, Uint8Array>();
    const nowQr = Date.now();
    const urlsToFetch = uniqueQrUrls.filter((qrUrl) => {
      const cached = globalCache.qrCache.get(qrUrl);
      if (cached && cached.expiresAt > nowQr) {
        qrBytesMap.set(qrUrl, cached.bytes);
        return false;
      }
      if (cached) {
        globalCache.qrCache.delete(qrUrl);
      }
      return true;
    });

    await mapWithConcurrency(urlsToFetch, 8, async (qrUrl) => {
      try {
        const res = await fetch(qrUrl, { cache: 'no-store' });
        if (!res.ok) {
          console.warn('[export-namecards-pdf] QR fetch failed:', qrUrl, res.status);
          return null;
        }
        const ab = await res.arrayBuffer();
        const bytes = new Uint8Array(ab);
        qrBytesMap.set(qrUrl, bytes);
        globalCache.qrCache.set(qrUrl, {
          bytes,
          expiresAt: Date.now() + QR_CACHE_TTL_MS,
        });
      } catch (e) {
        console.warn('[export-namecards-pdf] QR fetch error:', qrUrl, (e as Error).message);
      }
      return null;
    });

    const qrImageMap = new Map<string, any>();

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let cardIndex = 0;

    for (let i = 0; i < attendees.length; i++) {
      if (cardIndex > 0 && cardIndex % cardsPerPage === 0) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
      }

      const slotOnPage = cardIndex % cardsPerPage;
      const row = Math.floor(slotOnPage / cardsPerRow);
      const col = slotOnPage % cardsPerRow;

      const x = col * cardWidth;
      const y = pageHeight - (row + 1) * cardHeight;

      // 🔲 กรอบการ์ด
      page.drawRectangle({
        x: x + 6,
        y: y + 6,
        width: cardWidth - 12,
        height: cardHeight - 12,
        borderColor: rgb(0.7, 0.7, 0.7),
        borderWidth: 1,
      });

      const textAreaX = x + marginX;
      const textAreaYTop = y + cardHeight - marginY;

      const attendee = attendees[i];
      const namePrefix = (attendee.name_prefix ?? '').trim();
      const fullName = (attendee.full_name ?? '').trim();
      const displayName = fullName
        ? `${namePrefix ? `${namePrefix} ` : ''}${fullName}`
        : namePrefix;
      const org = attendee.organization ?? '';
      const job = formatJobPosition(attendee.job_position ?? null);
      const province = attendee.province ?? '';
      const r = attendee.region;
      const qrUrl = buildQrUrl(attendee.qr_image_url ?? null, attendee.ticket_token ?? null) ?? '';

      // 🧾 เตรียม QR image (reuse ถ้าเคย embed แล้ว)
      let qrImage: any = null;
      if (qrUrl) {
        const cached = qrImageMap.get(qrUrl);
        if (cached) {
          qrImage = cached;
        } else {
          const bytes = qrBytesMap.get(qrUrl);
          if (bytes) {
            try {
              qrImage = await pdfDoc.embedPng(bytes);
              qrImageMap.set(qrUrl, qrImage);
            } catch {
              try {
                qrImage = await pdfDoc.embedJpg(bytes);
                qrImageMap.set(qrUrl, qrImage);
              } catch (e) {
                console.warn('[export-namecards-pdf] QR embed failed:', qrUrl, (e as Error).message);
              }
            }
          }
        }
      }

      // 🧍‍♂️ ชื่อ (bold)
      if (displayName) {
        page.drawText(displayName, {
          x: textAreaX,
          y: textAreaYTop - fontSizeName,
          size: fontSizeName,
          font: thaiFontBold,
          color: rgb(0, 0, 0),
        });
      }

      // 💼 ตำแหน่ง (ใต้ชื่อ)
      if (job) {
        page.drawText(job, {
          x: textAreaX,
          y: textAreaYTop - fontSizeName - fontSizeJob - 6,
          size: fontSizeJob,
          font: thaiFont,
          color: rgb(0.1, 0.1, 0.1),
        });
      }

      // 🌍 ภาค + จังหวัด (รองรับภาค 0 ด้วย)
      const hasRegion = r !== null && r !== undefined;
      const hasProvince = !!province;

      if (hasRegion || hasProvince) {
        const regionLabel = hasRegion ? `ภาค ${r}` : '';
        const provinceLabel = hasProvince ? `จังหวัด${province}` : '';
        const sep = regionLabel && provinceLabel ? ' – ' : '';
        const line = `${regionLabel}${sep}${provinceLabel}`;

        page.drawText(line, {
          x: textAreaX,
          y: textAreaYTop - fontSizeName - fontSizeJob - fontSizeRegionProvince - 14,
          size: fontSizeRegionProvince,
          font: thaiFont,
          color: rgb(0.25, 0.25, 0.25),
        });
      }

      // 🏢 หน่วยงาน (ถัดจากภาค/จังหวัด)
      if (org) {
        page.drawText(org, {
          x: textAreaX,
          y:
            textAreaYTop -
            fontSizeName -
            fontSizeJob -
            fontSizeRegionProvince -
            fontSizeOrg -
            22,
          size: fontSizeOrg,
          font: thaiFont,
          color: rgb(0.2, 0.2, 0.2),
        });
      }

      // 🧩 วาด QR ด้านล่าง ใหญ่ขึ้น
      if (qrImage) {
        const qrSize = 96;
        page.drawImage(qrImage, {
          x: x + cardWidth / 2 - qrSize / 2,
          y: y + marginY + 10,
          width: qrSize,
          height: qrSize,
        });
      }

      cardIndex++;
    }

    const pdfBytes = await pdfDoc.save();
    const filename = `namecards-region-${region}.pdf`;
    const abCopy = new ArrayBuffer(pdfBytes.byteLength);
    new Uint8Array(abCopy).set(pdfBytes);
    const blob = new Blob([abCopy], { type: 'application/pdf' });

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('[export-namecards-pdf] Unexpected error:', err);
    return NextResponse.json(
      {
        ok: false,
        message: 'เกิดข้อผิดพลาดในการสร้างไฟล์ PDF',
        detail: String(err?.message ?? err),
      },
      { status: 500 }
    );
  }
}
