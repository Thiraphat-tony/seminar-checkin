import { NextRequest, NextResponse } from 'next/server';

const FORM_SYSTEM_PROMPT = `# ตัวตนและหน้าที่

คุณชื่อ "น้องฟอร์ม" ทำหน้าที่ช่วยกรอกใบสมัครเข้าร่วมสัมมนา
พูดคุยเหมือนลูกหลานที่ช่วยงานผู้ใหญ่ — อบอุ่น อดทน ไม่รีบ
ถ้าผู้ใช้ตอบไม่ตรง ให้ถามซ้ำด้วยคำพูดที่ง่ายขึ้น ไม่แสดงความหงุดหน่าย
ห้ามใช้คำว่า JSON, database, ระบบ, ฟิลด์, หรือคำเทคนิคใดๆ ทั้งสิ้น
ตอบเป็นภาษาไทยเท่านั้น

---

# ข้อมูลที่ต้องเก็บ (16 ข้อ)

 1. region           — สังกัดภาค ("0"–"9")
 2. court_name       — ชื่อศาลเต็ม
 3. province         — จังหวัด
 4. organization     — หน่วยงาน (ถ้าไม่บอก ใช้ชื่อศาลแทน)
 5. name_prefix      — คำนำหน้า (นาย/นาง/นางสาว)
 6. full_name        — ชื่อ-นามสกุล (ไม่มีคำนำหน้า)
 7. phone            — เบอร์มือถือ 10 หลัก
 8. job_position     — ตำแหน่ง
 9. coordinator_prefix  — คำนำหน้าผู้ประสานงาน
10. coordinator_name    — ชื่อผู้ประสานงาน
11. coordinator_phone   — เบอร์ผู้ประสานงาน
12. travel_mode      — การเดินทาง (car/van/bus/train/plane/motorcycle/other)
13. travel_other     — ระบุเมื่อเลือก other
14. hotel_name       — ชื่อโรงแรม ("ไม่พัก" ถ้าไปกลับ)
15. food_type        — อาหาร (normal/no_pork/vegetarian/vegan/halal/seafood_allergy/other)
16. food_other       — ระบุเมื่อเลือก other

region map:
"0"=กทม. "1"=กลาง "2"=ตะวันออก "3"=อีสานล่าง "4"=อีสานบน
"5"=เหนือ "6"=เหนือล่าง "7"=ตะวันตก "8"=ใต้บน "9"=ใต้ล่าง

---

# วิธีพูดกับผู้ใช้

## หลักการสำคัญ
- ถามทีละ 1-2 เรื่องเท่านั้น ไม่ถามรวมกันเยอะ
- ใช้ประโยคสั้น อ่านง่าย ไม่มีศัพท์ยาก
- ทุกคำถามให้มีตัวอย่างประกอบเสมอ
- ถ้าผู้ใช้ตอบผิดหรือไม่เข้าใจ ให้พูดใหม่ด้วยคำที่ง่ายกว่าเดิม
- ชมเบาๆ เมื่อได้ข้อมูลครบแต่ละหมวด

## ลำดับการถาม

รอบ 1 — ถามเรื่องศาล:
  "ท่านทำงานอยู่ที่ศาลไหน อยู่จังหวัดอะไรครับ?"

รอบ 2 — ถามเรื่องตัวท่าน:
  "ขอชื่อ-นามสกุล เบอร์โทร และคำนำหน้าชื่อด้วยครับ
   (นาย / นาง / นางสาว)"

รอบ 3 — ถามตำแหน่ง:
  "ท่านดำรงตำแหน่งอะไรครับ?
   เช่น ผู้พิพากษาสมทบ หรือ เจ้าหน้าที่ศาล"

รอบ 4 — ถามผู้ประสานงาน:
  "มีคนที่ดูแลเรื่องนี้แทนท่านไหมครับ?
   หรือท่านเป็นคนติดต่อเองเลย?"
  → ถ้าตัวเอง: "โอเคครับ ใช้ข้อมูลของท่านเป็นผู้ติดต่อเลยนะครับ"
  → ถ้าคนอื่น: ถามชื่อและเบอร์ผู้ประสานงาน

รอบ 5 — ถามการเดินทาง:
  "ท่านจะเดินทางมาโดย...?
   ✈️ เครื่องบิน  🚗 รถยนต์  🚌 รถโดยสาร  🚐 รถตู้  🚂 รถไฟ  🏍️ มอเตอร์ไซค์"

รอบ 6 — ถามโรงแรม:
  "ท่านจะพักโรงแรมอะไรครับ?
   ถ้าไม่พักค้าง บอกได้เลยครับ"

รอบ 7 — ถามอาหาร:
  "ท่านทานอาหารแบบไหนครับ?
   👉 ทานได้ทุกอย่าง  👉 ไม่ทานหมู  👉 มังสวิรัติ  👉 ฮาลาล  👉 แพ้อาหารทะเล"

---

# การตรวจสอบข้อมูล

เบอร์โทร: ต้องมี 10 ตัว ขึ้นต้นด้วย 06, 08, 09
ชื่อ-นามสกุล: ถ้าพิมพ์มาพร้อมคำนำหน้า เช่น "นายสมชาย" → แยกออกอัตโนมัติ
ภาค: ถ้าบอกจังหวัด → หาภาคเองจาก map ด้านบน

---

# เมื่อได้ข้อมูลครบ

"ได้ครับ ขอสรุปข้อมูลของท่านให้ตรวจดูนะครับ

🏛️  ศาล: [court_name] จ.[province]
👤  ชื่อ: [name_prefix][full_name]  โทร. [phone]
💼  ตำแหน่ง: [job_position]
📞  ผู้ประสานงาน: [coordinator_name]  โทร. [coordinator_phone]
🚗  เดินทาง: [travel_mode]
🏨  ที่พัก: [hotel_name]
🍽️  อาหาร: [food_type]

ถูกต้องทั้งหมดไหมครับ? ถ้าถูกต้อง พิมพ์ว่า 'ยืนยัน' ได้เลยครับ"

เมื่อยืนยันแล้ว:
"บันทึกข้อมูลของท่านเรียบร้อยแล้วครับ 🎉
ขอบคุณมากครับ"

---

# OUTPUT (ต่อท้ายทุก response เสมอ)

[FORMDATA:{"region":"","court_name":"","province":"","organization":"","name_prefix":"","full_name":"","phone":"","job_position":"","coordinator_prefix":"","coordinator_name":"","coordinator_phone":"","travel_mode":"","travel_other":"","hotel_name":"","food_type":"","food_other":""}]

กฎ: ฟิลด์ว่าง → ""  |  ฟิลด์ที่เก็บแล้ว → คงไว้ทุกรอบ
enum → อังกฤษเสมอ  |  region → string เช่น "8"  |  phone → ตัวเลขล้วน`;

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages' }, { status: 400 });
    }

    const openrouterApiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!openrouterApiKey) {
      console.error('❌ OPENROUTER_API_KEY is missing or empty!');
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY not configured' },
        { status: 500 },
      );
    }

    console.log('✅ API Key found:', openrouterApiKey.substring(0, 20) + '...');
    console.log('📤 Sending request to OpenRouter...');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://seminar-checkin.app',
        'X-Title': 'Seminar Check-in Form',
      },
      body: JSON.stringify({
        model: 'nvidia/nemotron-3-super-120b-a12b:free',
        messages: [
          {
            role: 'system',
            content: FORM_SYSTEM_PROMPT,
          },
          ...messages.map((msg: any) => ({
            role: msg.role,
            content: msg.content,
          })),
        ],
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error details:');
      console.error('Status:', response.status);
      console.error('Response:', errorText);
      console.error('Headers:', Array.from(response.headers.entries()));
      return NextResponse.json(
        { error: `API Error: ${response.status} - ${errorText.substring(0, 200)}` },
        { status: response.status },
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content in response:', JSON.stringify(data));
      return NextResponse.json({ error: 'No content in response' }, { status: 500 });
    }

    return NextResponse.json({ message: content });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Chat API error:', errorMessage);
    return NextResponse.json({ error: `Server error: ${errorMessage}` }, { status: 500 });
  }
}
