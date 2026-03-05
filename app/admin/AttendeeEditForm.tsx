'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type PositionType = 'chief_judge' | 'associate_judge' | 'director' | 'other';
type TravelMode = 'car' | 'van' | 'bus' | 'train' | 'plane' | 'motorcycle' | 'other';

type AttendeeForEdit = {
  id: string;
  name_prefix: string | null;
  full_name: string | null;
  phone: string | null;
  organization: string | null;
  job_position: string | null;
  province: string | null;
  region: number | null;
  hotel_name: string | null;
  travel_mode: string | null;
  travel_other: string | null;
  food_type: string | null;
  ticket_token: string | null;
};

type AttendeeEditFormProps = {
  attendee: AttendeeForEdit;
};

const PREFIX_OPTIONS = ['นาย', 'นาง', 'นางสาว', 'ดร.', 'ผศ.', 'รศ.', 'ศ.'];
const OTHER_PREFIX_VALUE = '__other__';
const OTHER_HOTEL_VALUE = '__other__';

const TRAVEL_MODE_OPTIONS: Array<{ value: TravelMode; label: string }> = [
  { value: 'car', label: 'รถยนต์ส่วนบุคคล' },
  { value: 'van', label: 'รถตู้' },
  { value: 'bus', label: 'รถบัส' },
  { value: 'train', label: 'รถไฟ' },
  { value: 'plane', label: 'เครื่องบิน' },
  { value: 'motorcycle', label: 'รถจักรยานยนต์' },
  { value: 'other', label: 'อื่น ๆ (ระบุ)' },
];

const HOTEL_OPTIONS = [
  'โรงแรมวังใต้',
  'โรงแรมสยามธานี',
  'โรงแรมมาริลิน โฮเทล',
  'โรงแรมนิการ์เด้น',
  'โรงแรมแก้วสมุย รีสอร์ท',
  'โรงแรมเพชรพงัน',
  'โรงแรมสลีป สเตชั่น',
  'โรงแรมบรรจงบุรี',
  'โรงแรมไดมอนด์พลาซ่า (สุราษฎร์ธานี)',
  'โรงแรมร้อยเกาะ',
  'โรงแรมบ้านไมตรีจิต',
  'โรงแรมบรรโฮเทล สุราษฎร์ธานี',
  'โรงแรมเดอะริช เรสซิเดนซ์ สุราษฎร์ธานี',
  'โรงแรมเอสทราแกรนด์ สุราษฎร์ธานี',
  'โรงแรมสุขสมบูรณ์',
  'โรงแรมลี โฮเทล สุราษฎร์ธานี',
  'โรงแรมบีทู สุราษฎร์ธานี พรีเมียร์',
];

const FOOD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'normal', label: 'ปกติ' },
  { value: 'vegetarian', label: 'มังสวิรัติ' },
  { value: 'halal', label: 'ฮาลาล' },
  { value: 'no_pork', label: 'ไม่ทานหมู' },
  { value: 'vegan', label: 'เจ / วีแกน' },
  { value: 'seafood_allergy', label: 'แพ้อาหารทะเล' },
  { value: 'other', label: 'อื่น ๆ' },
];

const POSITION_LABELS: Record<Exclude<PositionType, 'other'>, string> = {
  chief_judge: 'ผู้พิพากษาหัวหน้าศาล',
  associate_judge: 'ผู้พิพากษาสมทบ',
  director: 'ผู้อำนวยการ',
};

const POSITION_ALIASES: Record<string, PositionType> = {
  chief_judge: 'chief_judge',
  associate_judge: 'associate_judge',
  director: 'director',
  ผู้พิพากษาหัวหน้าศาล: 'chief_judge',
  ผู้พิพากษาสมทบ: 'associate_judge',
  ผู้อำนวยการ: 'director',
  '????????????????????': 'chief_judge',
  '??????????????': 'associate_judge',
};

function getPrefixSelectValue(prefix: string) {
  const trimmed = prefix?.trim() ?? '';
  if (!trimmed) return '';
  if (trimmed === OTHER_PREFIX_VALUE) return OTHER_PREFIX_VALUE;
  return PREFIX_OPTIONS.includes(trimmed) ? trimmed : OTHER_PREFIX_VALUE;
}

function getTravelSelectValue(value: string) {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';
  return TRAVEL_MODE_OPTIONS.some((option) => option.value === trimmed)
    ? (trimmed as TravelMode)
    : 'other';
}

function getHotelSelectValue(value: string) {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';
  if (trimmed === OTHER_HOTEL_VALUE) return OTHER_HOTEL_VALUE;
  return HOTEL_OPTIONS.includes(trimmed) ? trimmed : OTHER_HOTEL_VALUE;
}

function parsePosition(value: string | null): { position: PositionType; positionOther: string } {
  const raw = (value ?? '').trim();
  if (!raw) {
    return { position: 'associate_judge', positionOther: '' };
  }

  const alias = POSITION_ALIASES[raw];
  if (alias && alias !== 'other') {
    return { position: alias, positionOther: '' };
  }

  return { position: 'other', positionOther: raw };
}

function mapPositionForStorage(position: PositionType, positionOther: string): string | null {
  if (position === 'other') {
    const trimmed = positionOther.trim();
    return trimmed || null;
  }
  return POSITION_LABELS[position];
}

export default function AttendeeEditForm({ attendee }: AttendeeEditFormProps) {
  const router = useRouter();

  const parsedPosition = parsePosition(attendee.job_position);
  const rawTravelMode = attendee.travel_mode ?? '';
  const initialTravelMode = getTravelSelectValue(rawTravelMode);
  const initialTravelOther =
    initialTravelMode === 'other'
      ? (attendee.travel_other ?? '').trim() || (rawTravelMode.trim() ? rawTravelMode : '')
      : '';

  const [namePrefix, setNamePrefix] = useState(attendee.name_prefix ?? '');
  const [fullName, setFullName] = useState(attendee.full_name ?? '');
  const [position, setPosition] = useState<PositionType>(parsedPosition.position);
  const [positionOther, setPositionOther] = useState(parsedPosition.positionOther);
  const [phone, setPhone] = useState(attendee.phone ?? '');
  const [travelMode, setTravelMode] = useState<TravelMode | ''>(initialTravelMode);
  const [travelOther, setTravelOther] = useState(initialTravelOther);
  const [hotelName, setHotelName] = useState(attendee.hotel_name ?? '');
  const [foodType, setFoodType] = useState(attendee.food_type ?? 'normal');

  const [organization, setOrganization] = useState(attendee.organization ?? '');
  const [province, setProvince] = useState(attendee.province ?? '');
  const [region, setRegion] = useState(attendee.region?.toString() ?? '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const prefixSelectValue = useMemo(() => getPrefixSelectValue(namePrefix), [namePrefix]);
  const travelSelectValue = useMemo(() => getTravelSelectValue(travelMode), [travelMode]);
  const hotelSelectValue = useMemo(() => getHotelSelectValue(hotelName), [hotelName]);

  const availableFoodOptions = useMemo(() => {
    if (!foodType.trim()) return FOOD_OPTIONS;
    if (FOOD_OPTIONS.some((option) => option.value === foodType)) return FOOD_OPTIONS;
    return [{ value: foodType, label: `ค่าเดิม (${foodType})` }, ...FOOD_OPTIONS];
  }, [foodType]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    const { normalizePhone, isValidPhone, phoneForStorage } = await import('@/lib/phone');
    const normalized = normalizePhone(phone);
    if (normalized && !isValidPhone(normalized)) {
      setErrorMsg('เบอร์โทรต้องเป็นตัวเลข 10 หลัก');
      setIsSubmitting(false);
      return;
    }

    if (prefixSelectValue === OTHER_PREFIX_VALUE && !(namePrefix ?? '').trim()) {
      setErrorMsg('กรุณาระบุคำนำหน้า');
      setIsSubmitting(false);
      return;
    }

    if (position === 'other' && !positionOther.trim()) {
      setErrorMsg('กรุณาระบุตำแหน่ง');
      setIsSubmitting(false);
      return;
    }

    if (travelSelectValue === 'other' && !travelOther.trim()) {
      setErrorMsg('กรุณาระบุพาหนะ/วิธีเดินทาง');
      setIsSubmitting(false);
      return;
    }

    try {
      const normalizedPrefix = (namePrefix ?? '').trim();
      const prefixForStorage =
        normalizedPrefix && normalizedPrefix !== OTHER_PREFIX_VALUE ? normalizedPrefix : null;

      const jobPositionForStorage = mapPositionForStorage(position, positionOther);
      const travelModeForStorage = travelSelectValue ? travelSelectValue : null;
      const travelOtherForStorage =
        travelSelectValue === 'other' ? (travelOther ?? '').trim() || null : null;
      const normalizedHotelName = (hotelName ?? '').trim();
      const hotelNameForStorage =
        normalizedHotelName && normalizedHotelName !== OTHER_HOTEL_VALUE
          ? normalizedHotelName
          : null;

      const res = await fetch('/api/admin/update-attendee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: attendee.id,
          name_prefix: prefixForStorage,
          full_name: fullName.trim(),
          phone: phoneForStorage(phone),
          organization: organization.trim() || null,
          job_position: jobPositionForStorage,
          province: province.trim() || null,
          region: region.trim() ? parseInt(region.trim(), 10) : null,
          hotel_name: hotelNameForStorage,
          travel_mode: travelModeForStorage,
          travel_other: travelOtherForStorage,
          food_type: foodType.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErrorMsg(data?.error || 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
        setIsSubmitting(false);
        return;
      }

      router.push('/admin');
    } catch {
      setErrorMsg('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
      setIsSubmitting(false);
    }
  };

  return (
    <section className="admin-form__section">
      <h2 className="admin-form__title">แก้ไขข้อมูลผู้เข้าร่วม</h2>
      <p className="admin-form__subtitle">
        ใช้รูปแบบเดียวกับหน้ากรอกผู้เข้าร่วม เพื่อแก้ไขข้อมูลได้ง่ายและตรงกับฟอร์มลงทะเบียน
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
              <option value="">คำนำหน้า</option>
              {PREFIX_OPTIONS.map((prefix) => (
                <option key={prefix} value={prefix}>
                  {prefix}
                </option>
              ))}
              <option value={OTHER_PREFIX_VALUE}>อื่น ๆ (ระบุ)</option>
            </select>
          </div>

          <div className="admin-form__field">
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
                placeholder="ระบุคำนำหน้า"
              />
            </div>
          )}

          <div className="admin-form__field">
            <label className="admin-form__label">ตำแหน่ง</label>
            <select
              className="admin-form__input"
              value={position}
              onChange={(e) => {
                const value = e.target.value as PositionType;
                setPosition(value);
                if (value !== 'other') setPositionOther('');
              }}
            >
              <option value="chief_judge">ผู้พิพากษาหัวหน้าศาล</option>
              <option value="associate_judge">ผู้พิพากษาสมทบ</option>
              <option value="director">ผู้อำนวยการ</option>
              <option value="other">อื่น ๆ (ระบุตำแหน่ง)</option>
            </select>
          </div>

          <div className="admin-form__field">
            <label className="admin-form__label">เบอร์โทร (ถ้ามี)</label>
            <input
              type="tel"
              className="admin-form__input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0XXXXXXXXX"
            />
          </div>

          {position === 'other' && (
            <div className="admin-form__field admin-form__field--full">
              <label className="admin-form__label">ระบุตำแหน่ง</label>
              <input
                type="text"
                className="admin-form__input"
                value={positionOther}
                onChange={(e) => setPositionOther(e.target.value)}
                placeholder="ระบุตำแหน่ง"
              />
            </div>
          )}

          <div className="admin-form__field">
            <label className="admin-form__label">พาหนะ/วิธีเดินทาง</label>
            <select
              className="admin-form__input"
              value={travelSelectValue}
              onChange={(e) => {
                const value = e.target.value as TravelMode | '';
                setTravelMode(value);
                if (value !== 'other') setTravelOther('');
              }}
            >
              <option value="">เลือกพาหนะ/วิธีเดินทาง</option>
              {TRAVEL_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-form__field">
            <label className="admin-form__label">โรงแรมที่พัก</label>
            <select
              className="admin-form__input"
              value={hotelSelectValue}
              onChange={(e) =>
                setHotelName(
                  e.target.value === OTHER_HOTEL_VALUE ? OTHER_HOTEL_VALUE : e.target.value,
                )
              }
            >
              <option value="">เลือกโรงแรม</option>
              {HOTEL_OPTIONS.map((hotel) => (
                <option key={hotel} value={hotel}>
                  {hotel}
                </option>
              ))}
              <option value={OTHER_HOTEL_VALUE}>อื่น ๆ (ระบุชื่อโรงแรม)</option>
            </select>
          </div>

          {travelSelectValue === 'other' && (
            <div className="admin-form__field admin-form__field--full">
              <label className="admin-form__label">ระบุพาหนะ/วิธีเดินทาง</label>
              <input
                type="text"
                className="admin-form__input"
                value={travelOther}
                onChange={(e) => setTravelOther(e.target.value)}
                placeholder="ระบุพาหนะ/วิธีเดินทาง"
              />
            </div>
          )}

          {hotelSelectValue === OTHER_HOTEL_VALUE && (
            <div className="admin-form__field admin-form__field--full">
              <label className="admin-form__label">ระบุชื่อโรงแรม</label>
              <input
                type="text"
                className="admin-form__input"
                value={hotelName === OTHER_HOTEL_VALUE ? '' : hotelName}
                onChange={(e) =>
                  setHotelName(e.target.value.trim() ? e.target.value : OTHER_HOTEL_VALUE)
                }
                placeholder="ระบุชื่อโรงแรม"
              />
            </div>
          )}

          <div className="admin-form__field">
            <label className="admin-form__label">ประเภทอาหาร</label>
            <select
              className="admin-form__input"
              value={foodType}
              onChange={(e) => setFoodType(e.target.value)}
            >
              {availableFoodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-form__field">
            <label className="admin-form__label">หน่วยงาน / องค์กร</label>
            <input
              type="text"
              className="admin-form__input"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="หน่วยงาน / ศาล"
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
              <option value="1">1 - ภาค 1</option>
              <option value="2">2 - ภาค 2</option>
              <option value="3">3 - ภาค 3</option>
              <option value="4">4 - ภาค 4</option>
              <option value="5">5 - ภาค 5</option>
              <option value="6">6 - ภาค 6</option>
              <option value="7">7 - ภาค 7</option>
              <option value="8">8 - ภาค 8</option>
              <option value="9">9 - ภาค 9</option>
            </select>
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
            {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
          </button>
        </div>
      </form>
    </section>
  );
}
