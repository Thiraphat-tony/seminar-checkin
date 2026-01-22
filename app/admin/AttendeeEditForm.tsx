'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type AttendeeForEdit = {
  id: string;
  name_prefix: string | null;
  full_name: string | null;
  phone: string | null;
  organization: string | null;
  job_position: string | null; // ✅ ตำแหน่ง
  province: string | null;     // ✅ จังหวัด
  region: number | null;       // ✅ ภาค 0-9
  hotel_name: string | null;   // ✅ โรงแรม
  travel_mode: string | null;
  travel_other: string | null;
  food_type: string | null;
  ticket_token: string | null;
};

type AttendeeEditFormProps = {
  attendee: AttendeeForEdit;
};

// Map enum values and legacy "????" strings from old registration encoding.
const JOB_POSITION_LABELS: Record<string, string> = {
  chief_judge: 'ผู้พิพากษาหัวหน้าศาล',
  associate_judge: 'ผู้พิพากษาสมทบ',
  '????????????????????': 'ผู้พิพากษาหัวหน้าศาล',
  '??????????????': 'ผู้พิพากษาสมทบ',
};

const PREFIX_OPTIONS = ['นาย', 'นาง', 'นางสาว', 'ดร.', 'ผศ.', 'รศ.', 'ศ.'];
const OTHER_PREFIX_VALUE = '__other__';

const TRAVEL_MODE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'car', label: 'รถยนต์ส่วนตัว' },
  { value: 'van', label: 'รถตู้' },
  { value: 'bus', label: 'รถบัส' },
  { value: 'train', label: 'รถไฟ' },
  { value: 'plane', label: 'เครื่องบิน' },
  { value: 'motorcycle', label: 'มอเตอร์ไซค์' },
  { value: 'other', label: 'อื่น ๆ (ระบุ)' },
];

const FOOD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'normal', label: 'ปกติ' },
  { value: 'vegetarian', label: 'มังสวิรัติ' },
  { value: 'halal', label: 'ฮาลาล' },
  { value: 'no_pork', label: 'ไม่ทานหมู' },
  { value: 'vegan', label: 'วีแกน' },
  { value: 'seafood_allergy', label: 'แพ้อาหารทะเล' },
  { value: 'other', label: 'อื่น ๆ' },
];

function formatJobPosition(jobPosition: string | null): string {
  if (!jobPosition) return '';
  const trimmed = jobPosition.trim();
  if (!trimmed) return '';
  return JOB_POSITION_LABELS[trimmed] ?? trimmed;
}

function getPrefixSelectValue(prefix: string) {
  const trimmed = prefix?.trim() ?? '';
  if (!trimmed) return '';
  if (trimmed === OTHER_PREFIX_VALUE) return OTHER_PREFIX_VALUE;
  return PREFIX_OPTIONS.includes(trimmed) ? trimmed : OTHER_PREFIX_VALUE;
}

export default function AttendeeEditForm({ attendee }: AttendeeEditFormProps) {
  const router = useRouter();
  const allowedTravelValues = TRAVEL_MODE_OPTIONS.map((option) => option.value);
  const rawTravelMode = attendee.travel_mode ?? '';
  const initialTravelMode =
    rawTravelMode && allowedTravelValues.includes(rawTravelMode) ? rawTravelMode : rawTravelMode ? 'other' : '';
  const initialTravelOther =
    attendee.travel_other ?? (rawTravelMode && initialTravelMode === 'other' ? rawTravelMode : '');

  const [namePrefix, setNamePrefix] = useState(attendee.name_prefix ?? '');
  const [fullName, setFullName] = useState(attendee.full_name ?? '');
  const [phone, setPhone] = useState(attendee.phone ?? '');
  const [organization, setOrganization] = useState(attendee.organization ?? '');
  const [jobPosition, setJobPosition] = useState(formatJobPosition(attendee.job_position));
  const [province, setProvince] = useState(attendee.province ?? '');
  const [region, setRegion] = useState(attendee.region?.toString() ?? '');
  const [hotelName, setHotelName] = useState(attendee.hotel_name ?? '');
  const [travelMode, setTravelMode] = useState(initialTravelMode);
  const [travelOther, setTravelOther] = useState(initialTravelOther);
  const [foodType, setFoodType] = useState(attendee.food_type ?? '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const prefixSelectValue = getPrefixSelectValue(namePrefix);

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

    const prefixSelectValue = getPrefixSelectValue(namePrefix);
    if (prefixSelectValue === OTHER_PREFIX_VALUE && !(namePrefix ?? '').trim()) {
      setErrorMsg('กรุณาระบุคำนำหน้า');
      setIsSubmitting(false);
      return;
    }

    if (travelMode === 'other' && !(travelOther ?? '').trim()) {
      setErrorMsg('กรุณาระบุพาหนะ/วิธีเดินทาง');
      setIsSubmitting(false);
      return;
    }

    try {
      const normalizedPrefix = (namePrefix ?? '').trim();
      const prefixForStorage =
        normalizedPrefix && normalizedPrefix !== OTHER_PREFIX_VALUE ? normalizedPrefix : null;

      const travelModeForStorage = travelMode.trim() ? travelMode.trim() : null;
      const travelOtherForStorage =
        travelMode === 'other' ? (travelOther ?? '').trim() || null : null;

      const res = await fetch('/api/admin/update-attendee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: attendee.id,
          name_prefix: prefixForStorage,
          full_name: fullName.trim(),
          phone: phoneForStorage(phone),
          organization: organization.trim() || null,
          job_position: jobPosition.trim() || null,
          province: province.trim() || null,
          region: region.trim() ? parseInt(region.trim()) : null,
          hotel_name: hotelName.trim() || null,
          travel_mode: travelModeForStorage,
          travel_other: travelOtherForStorage,
          food_type: foodType.trim() || null,
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
        ใช้สำหรับปรับแก้คำนำหน้า ชื่อ เบอร์โทร หน่วยงาน ตำแหน่ง จังหวัด ภาค โรงแรม การเดินทาง และอาหารของผู้เข้าร่วม
      </p>

      <form className="admin-form" onSubmit={handleSubmit}>
        <div className="admin-form__grid">
          <div className="admin-form__field">
            <label className="admin-form__label">คำนำหน้า</label>
            <select
              className="admin-form__input"
              value={prefixSelectValue}
              onChange={(e) =>
                setNamePrefix(
                  e.target.value === OTHER_PREFIX_VALUE ? OTHER_PREFIX_VALUE : e.target.value,
                )
              }
            >
              <option value="">-- ไม่ระบุ --</option>
              {PREFIX_OPTIONS.map((prefix) => (
                <option key={prefix} value={prefix}>
                  {prefix}
                </option>
              ))}
              <option value={OTHER_PREFIX_VALUE}>อื่น ๆ (ระบุ)</option>
            </select>
          </div>

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

          {prefixSelectValue === OTHER_PREFIX_VALUE && (
            <div className="admin-form__field admin-form__field--full">
              <label className="admin-form__label">ระบุคำนำหน้า</label>
              <input
                type="text"
                className="admin-form__input"
                value={namePrefix === OTHER_PREFIX_VALUE ? '' : namePrefix}
                onChange={(e) =>
                  setNamePrefix(e.target.value.trim() ? e.target.value : OTHER_PREFIX_VALUE)
                }
                placeholder="กรุณาระบุคำนำหน้า"
              />
            </div>
          )}

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
            <label className="admin-form__label">ภาค (0-9)</label>
            <select
              className="admin-form__input"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              <option value="">-- ไม่ระบุ --</option>
              <option value="0">0 - ศาลเยาวชนและครอบครัวกลาง (กรุงเทพมหานคร)</option>
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

          <div className="admin-form__field">
            <label className="admin-form__label">การเดินทาง</label>
            <select
              className="admin-form__input"
              value={travelMode}
              onChange={(e) => {
                const value = e.target.value;
                setTravelMode(value);
                if (value !== 'other') setTravelOther('');
              }}
            >
              <option value="">-- ไม่ระบุ --</option>
              {TRAVEL_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-form__field">
            <label className="admin-form__label">ประเภทอาหาร</label>
            <select
              className="admin-form__input"
              value={foodType}
              onChange={(e) => setFoodType(e.target.value)}
            >
              <option value="">-- ไม่ระบุ --</option>
              {FOOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {travelMode === 'other' && (
            <div className="admin-form__field admin-form__field--full">
              <label className="admin-form__label">ระบุการเดินทาง</label>
              <input
                type="text"
                className="admin-form__input"
                value={travelOther}
                onChange={(e) => setTravelOther(e.target.value)}
                placeholder="ระบุพาหนะ/วิธีเดินทาง"
              />
            </div>
          )}

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
