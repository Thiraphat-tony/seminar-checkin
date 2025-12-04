// app/api/admin/export-namecards-pdf/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { PDFDocument, rgb } from 'pdf-lib';

export const runtime = 'nodejs';
export const maxDuration = 300;

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

// สร้าง PDF name cards โดยใช้ pdf-lib
async function generateNameCardsPDF(
  attendees: AttendeeForCard[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  
  // ขนาด A4
  const pageWidth = 210; // mm
  const pageHeight = 297; // mm
  const mmToPoint = 2.834646; // 1mm = 2.834646 points
  
  // card size: 90mm x 60mm
  const cardWidth = 90 * mmToPoint;
  const cardHeight = 60 * mmToPoint;
  
  // margin
  const margin = 10 * mmToPoint;
  const gap = 8 * mmToPoint;
  
  // Cards per page: 2 columns x 4 rows = 8 cards
  const cardsPerPage = 8;
  const cardsPerRow = 2;
  
  let cardIndex = 0;
  
  for (const attendee of attendees) {
    // สร้าง page ใหม่ทุก 8 cards
    if (cardIndex % cardsPerPage === 0) {
      pdfDoc.addPage([pageWidth * mmToPoint, pageHeight * mmToPoint]);
    }
    
    const pages = pdfDoc.getPages();
    const page = pages[pages.length - 1];
    
    // คำนวณตำแหน่ง card
    const posInPage = cardIndex % cardsPerPage;
    const row = Math.floor(posInPage / cardsPerRow);
    const col = posInPage % cardsPerRow;
    
    const x = margin + col * (cardWidth + gap);
    const y = pageHeight * mmToPoint - margin - (row + 1) * cardHeight - row * gap;
    
    // วาดพื้นหลังการ์ด
    page.drawRectangle({
      x,
      y,
      width: cardWidth,
      height: cardHeight,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    });
    
    // ชื่อ (หัวการ์ด)
    const nameText = (attendee.full_name || 'ไม่ระบุชื่อ').substring(0, 30);
    page.drawText(nameText, {
      x: x + 5,
      y: y + cardHeight - 15,
      size: 12,
      color: rgb(0, 0, 0),
      maxWidth: cardWidth - 10,
    });
    
    // เส้นแบ่ง
    page.drawLine({
      start: { x: x + 5, y: y + cardHeight - 20 },
      end: { x: x + cardWidth - 5, y: y + cardHeight - 20 },
      color: rgb(0, 102, 204),
      thickness: 1,
    });
    
    // ข้อมูลเล็ก ๆ
    const fontSize = 7;
    const lineHeight = 8;
    let textY = y + cardHeight - 28;
    
    const infoLines = [
      `องค์กร: ${(attendee.organization || '-').substring(0, 20)}`,
      `ตำแหน่ง: ${(attendee.job_position || '-').substring(0, 20)}`,
      `จังหวัด: ${(attendee.province || '-').substring(0, 15)}`,
      `เบอร์โทร: ${(attendee.phone || '-').substring(0, 15)}`,
      `อาหาร: ${formatFoodType(attendee.food_type)}`,
    ];
    
    for (const line of infoLines) {
      if (textY > y + 5) {
        page.drawText(line, {
          x: x + 3,
          y: textY,
          size: fontSize,
          color: rgb(0, 0, 0),
          maxWidth: cardWidth - 6,
        });
        textY -= lineHeight;
      }
    }
    
    cardIndex++;
  }
  
  // Save PDF
  return await pdfDoc.save();
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
        { success: false, message: 'ไม่สามารถโหลดข้อมูลได้', error: error?.message },
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

    // สร้าง PDF
    const pdfBytes = await generateNameCardsPDF(attendees);

    // ส่ง PDF กลับไป
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="namecards-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });

  } catch (error) {
    console.error('[Export Namecards PDF Error]:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'เกิดข้อผิดพลาดในการสร้าง PDF',
        error: errorMessage,
        details: 'ใช้ pdf-lib สำหรับสร้าง PDF โดยไม่ต้องใช้ Chromium'
      },
      { status: 500 }
    );
  }
}
