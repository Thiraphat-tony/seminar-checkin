// app/admin/namecards/page.tsx
import { createServerClient } from '@/lib/supabaseServer';
import AdminNav from '../AdminNav';
import '../admin-page.css';
import { maskPhone } from '@/lib/maskPhone';
import DownloadNamecardsPdfButton from './DownloadNamecardsPdfButton';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

type AttendeeCardRow = {
  id: string;
  event_id: string | null;
  full_name: string | null;
  phone: string | null;
  organization: string | null;
  job_position: string | null;
  province: string | null;
  region: number | null;
  qr_image_url: string | null;
  ticket_token: string | null;
  food_type: string | null;
  hotel_name: string | null;
};

// แปลง code ประเภทอาหารเป็น label ภาษาไทย
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

// ถ้าใน DB ยังไม่มี qr_image_url ให้ fallback เป็นลิงก์ QR จาก ticket_token
function buildQrUrl(ticketToken: string | null, qrImageUrl: string | null) {
  if (qrImageUrl && qrImageUrl.trim().length > 0) {
    return qrImageUrl;
  }
  if (!ticketToken) return null;
  const encoded = encodeURIComponent(ticketToken);
  return `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encoded}`;
}

export default async function NamecardsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const keywordRaw = (sp.q ?? '').trim();
  const keyword = keywordRaw.toLowerCase();

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('attendees')
    .select(
      `
      id,
      event_id,
      full_name,
      phone,
      organization,
      job_position,
      province,
      region,
      qr_image_url,
      ticket_token,
      food_type,
      hotel_name
    `
    )
    .order('full_name', { ascending: true });

  if (error || !data) {
    return (
      <div className="page-wrap page-wrap--center">
        <div className="card">
          <div className="card__icon-badge card__icon-badge--error">
            <span>!</span>
          </div>
          <h1 className="card__title">โหลดข้อมูลไม่สำเร็จ</h1>
          <p className="card__subtitle">
            ไม่สามารถโหลดรายชื่อผู้เข้าร่วมสำหรับหน้านามบัตรได้
            กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ
          </p>
          <p className="card__debug">
            <code>{error?.message}</code>
          </p>
          <a href="/admin" className="admin-filters__link-reset">
            ← กลับไปหน้า Admin
          </a>
        </div>
      </div>
    );
  }

  const attendees: AttendeeCardRow[] = data as AttendeeCardRow[];

  // filter ตาม keyword (ชื่อ / หน่วยงาน / ตำแหน่ง / จังหวัด / token)
  const filtered = keyword
    ? attendees.filter((a) => {
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
      })
    : attendees;

  return (
    <div className="page-wrap">
      <div className="page-gradient" />

      <main className="admin-layout">
        {/* ---------- Header ---------- */}
        <header className="admin-header">
          <div className="admin-header__top">
            <div>
              <div className="attendee-header__badge">ADMIN • หน้านามบัตร (QR)</div>
              <h1 className="admin-header__title">
                หน้านามบัตรผู้เข้าร่วมงาน (QR Name Cards)
              </h1>
              <p className="admin-header__subtitle">
                แสดงนามบัตรสำหรับผู้เข้าร่วมแต่ละคน พร้อม QR Code ที่ใช้สแกนหน้างาน
                เหมาะสำหรับพิมพ์หรือเปิดบนแท็บเล็ต
              </p>
            </div>
          </div>

          <AdminNav />

          {/* ฟอร์มค้นหาเล็ก ๆ ด้านบน */}
          <section className="admin-filters">
            <form className="admin-filters__form" method="get">
              <div className="admin-filters__field admin-filters__field--full">
                <label className="admin-filters__label">
                  ค้นหาชื่อ / หน่วยงาน / ตำแหน่ง / จังหวัด / Token
                </label>
                <input
                  type="text"
                  name="q"
                  defaultValue={keywordRaw}
                  placeholder="พิมพ์คำค้นหา เช่น ชื่อ หน่วยงาน ตำแหน่ง จังหวัด หรือ Token"
                  className="admin-filters__input"
                />
              </div>

              <div className="admin-filters__actions">
                <button type="submit" className="admin-filters__button">
                  ใช้ตัวกรอง
                </button>
                <a href="/admin/namecards" className="admin-filters__link-reset">
                  ล้างตัวกรอง
                </a>

                {/* ✅ ปุ่มดาวน์โหลดนามบัตร (PDF) -> เด้งเลือกภาคก่อน แล้วดาวน์โหลดเลย */}
                <DownloadNamecardsPdfButton />

                <a
                  href="/admin"
                  className="admin-filters__link-reset"
                  style={{ marginLeft: 'auto' }}
                >
                  ← กลับไปหน้า Admin
                </a>
              </div>
            </form>
          </section>
        </header>

        {/* ---------- Namecard List ---------- */}
        <section className="namecard-list">
          {filtered.length === 0 ? (
            <p className="admin-table__empty">ไม่พบนามบัตรตามเงื่อนไขที่ค้นหา</p>
          ) : (
            <div className="namecard-grid">
              {filtered.map((a) => {
                const qrUrl = buildQrUrl(a.ticket_token, a.qr_image_url);
                formatFoodType(a.food_type); // เผื่อใช้ต่อ (ยังไม่แสดงใน UI)

                return (
                  <article key={a.id} className="namecard-item">
                    <header className="namecard-item__header">
                      <h2 className="namecard-item__name">
                        {a.full_name || 'ไม่ระบุชื่อ'}
                      </h2>
                      <p className="namecard-item__org">
                        หน่วยงาน: {a.organization || 'ไม่ระบุหน่วยงาน'}
                      </p>
                      <p className="namecard-item__job">
                        ตำแหน่ง: {a.job_position || 'ไม่ระบุตำแหน่ง'}
                      </p>
                      <p className="namecard-item__province">
                        จังหวัด: {a.province || 'ไม่ระบุจังหวัด'}
                      </p>
                      <p className="namecard-item__phone">
                        โทรศัพท์: {maskPhone(a.phone, 'ไม่ระบุ')}
                      </p>
                    </header>

                    <div className="namecard-item__body">
                      <div className="namecard-item__qr">
                        {qrUrl ? (
                          <img src={qrUrl} alt={a.ticket_token || 'QR Code'} />
                        ) : (
                          <span>ไม่มี QR Code</span>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
