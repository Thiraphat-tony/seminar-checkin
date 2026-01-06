'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type AttendeeForEdit = {
  id: string;
  full_name: string | null;
  phone: string | null;
  organization: string | null;
  job_position: string | null; // ✅ ตำแหน่ง
  province: string | null;     // ✅ จังหวัด
  region: number | null;       // ✅ ภาค 1-9
  hotel_name: string | null;   // ✅ โรงแรม
  ticket_token: string | null;
};

type AttendeeEditFormProps = {
  attendee: AttendeeForEdit;
};

export default function AttendeeEditForm({ attendee }: AttendeeEditFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(attendee.full_name ?? '');
  const [phone, setPhone] = useState(attendee.phone ?? '');
  const [organization, setOrganization] = useState(attendee.organization ?? '');
  const [jobPosition, setJobPosition] = useState(attendee.job_position ?? '');
  const [province, setProvince] = useState(attendee.province ?? '');
  const [region, setRegion] = useState(attendee.region?.toString() ?? '');
  const [hotelName, setHotelName] = useState(attendee.hotel_name ?? '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    // validate phone
    const { normalizePhone, isValidPhone, phoneForStorage } = await import('@/lib/phone');
    const normalized = normalizePhone(phone);
    if (normalized && !isValidPhone(normalized)) {
      setErrorMsg('เบอร์โทรต้องเป็นตัวเลข 10 หลัก');
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/update-attendee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: attendee.id,
          full_name: fullName.trim(),
          phone: phoneForStorage(phone),
          organization: organization.trim() || null,
          job_position: jobPosition.trim() || null,
          province: province.trim() || null,
          region: region.trim() ? parseInt(region.trim()) : null,
          hotel_name: hotelName.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErrorMsg(
          data?.error || 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง'
        );
        setIsSubmitting(false);
        return;
      }

      // กลับไปหน้า /admin หลังบันทึกสำเร็จ
      router.push('/admin');
    } catch (err) {
      setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
      setIsSubmitting(false);
    }
  };

  return (
    <section className="admin-form__section">
      <h2 className="admin-form__title">แก้ไขข้อมูลผู้เข้าร่วม</h2>
      <p className="admin-form__subtitle">
        ใช้สำหรับปรับแก้ชื่อ เบอร์โทร หน่วยงาน ตำแหน่ง และจังหวัดของผู้เข้าร่วม
      </p>

      <form className="admin-form" onSubmit={handleSubmit}>
        <div className="admin-form__grid">
          <div className="admin-form__field admin-form__field--full">
            <label className="admin-form__label required">ชื่อ - นามสกุล</label>
            <input
              type="text"
              className="admin-form__input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="admin-form__field">
            <label className="admin-form__label">เบอร์โทรศัพท์</label>
            <input
              type="tel"
              className="admin-form__input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="เช่น 08x-xxx-xxxx"
            />
          </div>

          <div className="admin-form__field">
            <label className="admin-form__label">ตำแหน่ง</label>
            <input
              type="text"
              className="admin-form__input"
              value={jobPosition}
              onChange={(e) => setJobPosition(e.target.value)}
              placeholder="เช่น ผู้อำนวยการ, ครู, บุคลากร ฯลฯ"
            />
          </div>

          <div className="admin-form__field admin-form__field--full">
            <label className="admin-form__label">หน่วยงาน / องค์กร</label>
            <input
              type="text"
              className="admin-form__input"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="เช่น ชื่อหน่วยงาน / โรงเรียน / บริษัท"
            />
          </div>

          <div className="admin-form__field">
            <label className="admin-form__label">จังหวัด</label>
            <input
              type="text"
              className="admin-form__input"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              placeholder="เช่น สุราษฎร์ธานี"
            />
          </div>

          <div className="admin-form__field">
            <label className="admin-form__label">ภาค (1-9)</label>
            <select
              className="admin-form__input"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              <option value="">-- ไม่ระบุ --</option>
              <option value="1">1 - กรุงเทพฯ และภาคกลาง</option>
              <option value="2">2 - ภาคตะวันออก</option>
              <option value="3">3 - ภาคอีสานตอนล่าง</option>
              <option value="4">4 - ภาคอีสานตอนบน</option>
              <option value="5">5 - ภาคเหนือ</option>
              <option value="6">6 - ภาคกลางตอนบน</option>
              <option value="7">7 - ภาคตะวันตก</option>
              <option value="8">8 - ภาคใต้ตอนบน</option>
              <option value="9">9 - ภาคใต้ตอนล่าง</option>
            </select>
          </div>

          <div className="admin-form__field admin-form__field--full">
            <label className="admin-form__label">โรงแรมที่พัก</label>
            <input
              type="text"
              className="admin-form__input"
              value={hotelName}
              onChange={(e) => setHotelName(e.target.value)}
              placeholder="เช่น โรงแรมเดอะวานา, โรงแรมแกรนด์พาร์ค"
            />
          </div>

          <div className="admin-form__field admin-form__field--full">
            <label className="admin-form__label">Token (อ่านอย่างเดียว)</label>
            <input
              type="text"
              className="admin-form__input admin-form__input--readonly"
              value={attendee.ticket_token ?? '-'}
              readOnly
            />
          </div>
        </div>

        {errorMsg && <p className="admin-form__error">{errorMsg}</p>}

        <div className="admin-form__actions">
          <button
            type="button"
            className="admin-form__button admin-form__button--ghost"
            onClick={() => router.push('/admin')}
            disabled={isSubmitting}
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            className="admin-form__button admin-form__button--primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'กำลังบันทึก…' : 'บันทึกการเปลี่ยนแปลง'}
          </button>
        </div>
      </form>
    </section>
  );
}
