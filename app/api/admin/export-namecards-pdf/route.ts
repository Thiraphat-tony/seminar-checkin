// app/api/admin/export-namecards-pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // สำหรับ Vercel Pro

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

function formatFoodType(foodType: string | null): string {
  switch (foodType) {
    case 'normal':
      return 'ทั่วไป';
    case 'no_pork':
      return 'ไม่ทานหมู';
    case 'vegetarian':
      return 'มังสวิรัติ';
    case 'vegan':
      return 'เจ / วีแกน';
    case 'halal':
      return 'ฮาลาล';
    case 'seafood_allergy':
      return 'แพ้อาหารทะเล';
    case 'other':
      return 'อื่น ๆ';
    default:
      return 'ไม่ระบุ';
  }
}

function buildQrUrl(ticketToken: string | null, qrImageUrl: string | null) {
  if (qrImageUrl && qrImageUrl.trim().length > 0) {
    return qrImageUrl;
  }
  if (!ticketToken) return null;
  const encoded = encodeURIComponent(ticketToken);
  return `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encoded}`;
}

function generateNamecardsHTML(attendees: AttendeeCardRow[]): string {
  const cards = attendees
    .map((a) => {
      const qrUrl = buildQrUrl(a.ticket_token, a.qr_image_url);
      const foodLabel = formatFoodType(a.food_type);

      return `
        <div class="namecard">
          <div class="namecard-header">
            <h2 class="namecard-name">${a.full_name || 'ไม่ระบุชื่อ'}</h2>
            <p class="namecard-detail">หน่วยงาน: ${a.organization || 'ไม่ระบุหน่วยงาน'}</p>
            <p class="namecard-detail">ตำแหน่ง: ${a.job_position || 'ไม่ระบุตำแหน่ง'}</p>
            <p class="namecard-detail">จังหวัด: ${a.province || 'ไม่ระบุจังหวัด'}</p>
            <p class="namecard-detail">โทรศัพท์: ${a.phone || 'ไม่ระบุ'}</p>
            <p class="namecard-detail">ประเภทอาหาร: ${foodLabel}</p>
          </div>
          <div class="namecard-qr">
            ${
              qrUrl
                ? `<img src="${qrUrl}" alt="QR Code" />`
                : '<span>ไม่มี QR Code</span>'
            }
          </div>
        </div>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Name Cards</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Sarabun', sans-serif;
      background: white;
      padding: 20px;
    }
    
    .namecard-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      page-break-inside: avoid;
    }
    
    .namecard {
      border: 2px solid #333;
      border-radius: 12px;
      padding: 20px;
      background: white;
      page-break-inside: avoid;
      display: flex;
      flex-direction: column;
      min-height: 350px;
    }
    
    .namecard-header {
      flex: 1;
      margin-bottom: 15px;
    }
    
    .namecard-name {
      font-size: 24px;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 12px;
      border-bottom: 2px solid #0066cc;
      padding-bottom: 8px;
    }
    
    .namecard-detail {
      font-size: 16px;
      color: #333;
      margin-bottom: 6px;
      line-height: 1.4;
    }
    
    .namecard-qr {
      text-align: center;
      margin-top: auto;
    }
    
    .namecard-qr img {
      width: 180px;
      height: 180px;
      border: 1px solid #ddd;
      border-radius: 8px;
    }
    
    @media print {
      body {
        padding: 0;
      }
      
      .namecard-grid {
        gap: 15px;
      }
      
      .namecard {
        page-break-inside: avoid;
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="namecard-grid">
    ${cards}
  </div>
</body>
</html>
  `;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = (searchParams.get('q') ?? '').trim().toLowerCase();

    const supabase = createServerClient();

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
      return NextResponse.json(
        { error: 'ไม่สามารถโหลดข้อมูลผู้เข้าร่วมได้' },
        { status: 500 }
      );
    }

    let attendees: AttendeeCardRow[] = data as AttendeeCardRow[];

    // Filter ตาม keyword
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

    if (attendees.length === 0) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลผู้เข้าร่วมตามเงื่อนไข' },
        { status: 404 }
      );
    }

    // สร้าง HTML
    const html = generateNamecardsHTML(attendees);

    // ใช้ Puppeteer สร้าง PDF
    const isProduction = process.env.NODE_ENV === 'production';
    
    let browser;
    
    if (isProduction) {
      // สำหรับ Vercel/Production ใช้ chromium
      browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    } else {
      // สำหรับ Local Development
      browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      });
    }

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px',
      },
    });

    await browser.close();

    const fileName = keyword
      ? `namecards-${keyword}-${Date.now()}.pdf`
      : `namecards-all-${Date.now()}.pdf`;

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (err: any) {
    console.error('Export PDF Error:', err);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการสร้าง PDF', details: err.message },
      { status: 500 }
    );
  }
}
