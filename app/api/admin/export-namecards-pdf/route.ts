// app/api/admin/export-namecards-pdf/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for large PDFs

type AttendeeForCard = {
  id: string;
  event_id: string | null;
  full_name: string | null;
  organization: string | null;
  job_position: string | null;
  province: string | null;
  region: number | null;
  phone: string | null;
  food_type: string | null;
  hotel_name: string | null;
  qr_image_url: string | null;
  ticket_token: string | null;
};

// แปลง code ประเภทอาหารเป็นภาษาไทย
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

// สร้าง QR URL ถ้าไม่มี qr_image_url
function buildQrUrl(ticketToken: string | null, qrImageUrl: string | null) {
  if (qrImageUrl && qrImageUrl.trim().length > 0) {
    return qrImageUrl;
  }
  if (ticketToken) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(ticketToken)}`;
  }
  return '';
}

// สร้าง HTML สำหรับ name card แต่ละใบ
function generateNameCardHTML(attendee: AttendeeForCard): string {
  const qrUrl = buildQrUrl(attendee.ticket_token, attendee.qr_image_url);
  const foodLabel = formatFoodType(attendee.food_type);
  
  return `
    <div class="namecard">
      <div class="card-header">
        <h1 class="name">${attendee.full_name || 'ไม่ระบุชื่อ'}</h1>
      </div>
      <div class="card-body">
        <div class="info-section">
          <div class="info-row">
            <span class="label">องค์กร:</span>
            <span class="value">${attendee.organization || '-'}</span>
          </div>
          <div class="info-row">
            <span class="label">ตำแหน่ง:</span>
            <span class="value">${attendee.job_position || '-'}</span>
          </div>
          <div class="info-row">
            <span class="label">จังหวัด:</span>
            <span class="value">${attendee.province || '-'}</span>
          </div>
          <div class="info-row">
            <span class="label">เบอร์โทร:</span>
            <span class="value">${attendee.phone || '-'}</span>
          </div>
          <div class="info-row">
            <span class="label">ประเภทอาหาร:</span>
            <span class="value">${foodLabel}</span>
          </div>
        </div>
        ${qrUrl ? `
        <div class="qr-section">
          <img src="${qrUrl}" alt="QR Code" class="qr-code" />
        </div>
        ` : ''}
      </div>
    </div>
  `;
}

// สร้าง HTML เต็มหน้าสำหรับ PDF
function generateFullHTML(attendees: AttendeeForCard[]): string {
  const cardsHTML = attendees.map(a => generateNameCardHTML(a)).join('\n');
  
  return `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
      padding: 10mm;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8mm;
      width: 210mm;
      min-height: 297mm;
    }
    
    .namecard {
      width: 90mm;
      height: 60mm;
      border: 2px solid #333;
      border-radius: 8px;
      padding: 10px;
      page-break-inside: avoid;
      background: white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .card-header {
      border-bottom: 2px solid #0066cc;
      padding-bottom: 8px;
      margin-bottom: 8px;
    }
    
    .name {
      font-size: 18px;
      font-weight: 700;
      color: #0066cc;
      text-align: center;
    }
    
    .card-body {
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }
    
    .info-section {
      flex: 1;
      font-size: 11px;
    }
    
    .info-row {
      margin-bottom: 4px;
      display: flex;
      gap: 6px;
    }
    
    .label {
      font-weight: 600;
      color: #555;
      min-width: 70px;
    }
    
    .value {
      color: #333;
      word-break: break-word;
    }
    
    .qr-section {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .qr-code {
      width: 80px;
      height: 80px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    
    @media print {
      body {
        padding: 10mm;
      }
      
      .namecard:nth-child(8n) {
        page-break-after: always;
      }
    }
  </style>
</head>
<body>
  ${cardsHTML}
</body>
</html>
  `;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    const supabase = createServerClient();

    // ดึงข้อมูลผู้เข้าร่วม
    let dbQuery = supabase
      .from('attendees')
      .select('id, event_id, full_name, organization, job_position, province, region, phone, food_type, hotel_name, qr_image_url, ticket_token')
      .order('full_name', { ascending: true });

    // ถ้ามีการค้นหา
    if (query.trim()) {
      dbQuery = dbQuery.or(
        `full_name.ilike.%${query}%,organization.ilike.%${query}%,phone.ilike.%${query}%,province.ilike.%${query}%`
      );
    }

    const { data, error } = await dbQuery;

    if (error || !data) {
      return NextResponse.json(
        { success: false, message: 'ไม่สามารถโหลดข้อมูลได้', error },
        { status: 500 }
      );
    }

    const attendees = data as AttendeeForCard[];

    if (attendees.length === 0) {
      return NextResponse.json(
        { success: false, message: 'ไม่พบข้อมูลผู้เข้าร่วม' },
        { status: 404 }
      );
    }

    // สร้าง HTML
    const htmlContent = generateFullHTML(attendees);

    // เช็คว่ารันบน local หรือ production
    const isLocal = process.env.NODE_ENV === 'development' || !process.env.VERCEL;

    let browser;
    
    if (isLocal) {
      // สำหรับ local development
      browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Windows default
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    } else {
      // สำหรับ Vercel/Production
      browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    }

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // สร้าง PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        bottom: '10mm',
        left: '10mm',
        right: '10mm',
      },
    });

    await browser.close();

    // ส่ง PDF กลับไป
    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="namecards-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });

  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'เกิดข้อผิดพลาดในการสร้าง PDF',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
