'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type PositionType = 'chief_judge' | 'associate_judge' | 'director' | 'other';
type TravelMode = 'car' | 'van' | 'bus' | 'train' | 'plane' | 'motorcycle' | 'other';
type FoodType = 'normal' | 'vegetarian' | 'halal' | 'no_pork' | 'vegan' | 'seafood_allergy' | 'other';

type BulkAttendee = {
  id: string;
  name_prefix: string | null;
  full_name: string | null;
  phone: string | null;
  job_position: string | null;
  hotel_name: string | null;
  travel_mode: string | null;
  travel_other: string | null;
  food_type: string | null;
};

type BulkParticipant = {
  id: string;
  namePrefix: string;
  fullName: string;
  position: PositionType;
  positionOther: string;
  phone: string;
  travelMode: TravelMode | '';
  travelOther: string;
  hotelName: string;
  foodType: FoodType;
};

type AdminAttendeesBulkEditFormProps = {
  attendees: BulkAttendee[];
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

const FOOD_OPTIONS: Array<{ value: FoodType; label: string }> = [
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
  if (!raw) return { position: 'associate_judge', positionOther: '' };
  const alias = POSITION_ALIASES[raw];
  if (alias && alias !== 'other') return { position: alias, positionOther: '' };
  return { position: 'other', positionOther: raw };
}

function mapPositionForStorage(position: PositionType, positionOther: string): string | null {
  if (position === 'other') {
    const trimmed = positionOther.trim();
    return trimmed || null;
  }
  return POSITION_LABELS[position];
}

function normalizeFoodType(foodType: string | null): FoodType {
  const raw = (foodType ?? '').trim() as FoodType;
  if (FOOD_OPTIONS.some((option) => option.value === raw)) return raw;
  return 'normal';
}

function toParticipant(attendee: BulkAttendee): BulkParticipant {
  const parsedPosition = parsePosition(attendee.job_position);
  const travelMode = getTravelSelectValue(attendee.travel_mode ?? '');
  const travelOther =
    travelMode === 'other'
      ? (attendee.travel_other ?? '').trim() || (attendee.travel_mode ?? '').trim()
      : '';

  return {
    id: attendee.id,
    namePrefix: attendee.name_prefix ?? '',
    fullName: attendee.full_name ?? '',
    position: parsedPosition.position,
    positionOther: parsedPosition.positionOther,
    phone: attendee.phone ?? '',
    travelMode,
    travelOther,
    hotelName: attendee.hotel_name ?? '',
    foodType: normalizeFoodType(attendee.food_type),
  };
}

export default function AdminAttendeesBulkEditForm({
  attendees,
}: AdminAttendeesBulkEditFormProps) {
  const router = useRouter();

  const [participants, setParticipants] = useState<BulkParticipant[]>(() => attendees.map(toParticipant));
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const total = participants.length;

  const rowMeta = useMemo(
    () =>
      participants.map((participant) => ({
        prefixSelectValue: getPrefixSelectValue(participant.namePrefix),
        travelSelectValue: getTravelSelectValue(participant.travelMode),
        hotelSelectValue: getHotelSelectValue(participant.hotelName),
      })),
    [participants],
  );

  function updateParticipant(index: number, patch: Partial<BulkParticipant>) {
    setParticipants((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const { normalizePhone, isValidPhone, phoneForStorage } = await import('@/lib/phone');

    for (let idx = 0; idx < participants.length; idx++) {
      const participant = participants[idx];
      const row = idx + 1;
      const prefixSelectValue = getPrefixSelectValue(participant.namePrefix);
      const travelSelectValue = getTravelSelectValue(participant.travelMode);
      const hotelSelectValue = getHotelSelectValue(participant.hotelName);

      if (!participant.fullName.trim()) {
        setErrorMessage(`กรุณากรอกชื่อ-สกุลของผู้เข้าร่วมคนที่ ${row}`);
        setSubmitting(false);
        return;
      }

      if (!participant.namePrefix.trim() || prefixSelectValue === OTHER_PREFIX_VALUE) {
        setErrorMessage(`กรุณาเลือก/ระบุคำนำหน้าของผู้เข้าร่วมคนที่ ${row}`);
        setSubmitting(false);
        return;
      }

      if (participant.position === 'other' && !participant.positionOther.trim()) {
        setErrorMessage(`กรุณาระบุตำแหน่งของผู้เข้าร่วมคนที่ ${row}`);
        setSubmitting(false);
        return;
      }

      if (travelSelectValue === 'other' && !participant.travelOther.trim()) {
        setErrorMessage(`กรุณาระบุพาหนะ/วิธีเดินทางของผู้เข้าร่วมคนที่ ${row}`);
        setSubmitting(false);
        return;
      }

      if (hotelSelectValue === OTHER_HOTEL_VALUE && !participant.hotelName.trim()) {
        setErrorMessage(`กรุณาระบุชื่อโรงแรมของผู้เข้าร่วมคนที่ ${row}`);
        setSubmitting(false);
        return;
      }

      const normalizedPhone = normalizePhone(participant.phone);
      if (normalizedPhone && !isValidPhone(normalizedPhone)) {
        setErrorMessage(`เบอร์โทรของผู้เข้าร่วมคนที่ ${row} ต้องเป็นตัวเลข 10 หลัก`);
        setSubmitting(false);
        return;
      }
    }

    try {
      for (let idx = 0; idx < participants.length; idx++) {
        const participant = participants[idx];
        const prefixSelectValue = getPrefixSelectValue(participant.namePrefix);
        const travelSelectValue = getTravelSelectValue(participant.travelMode);
        const hotelSelectValue = getHotelSelectValue(participant.hotelName);

        const prefixForStorage =
          prefixSelectValue === OTHER_PREFIX_VALUE ? null : participant.namePrefix.trim() || null;

        const travelModeForStorage = travelSelectValue ? travelSelectValue : null;
        const travelOtherForStorage =
          travelSelectValue === 'other' ? participant.travelOther.trim() || null : null;
        const normalizedHotelName = participant.hotelName.trim();
        const hotelNameForStorage =
          hotelSelectValue === OTHER_HOTEL_VALUE
            ? normalizedHotelName || null
            : normalizedHotelName || null;

        const res = await fetch('/api/admin/update-attendee', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: participant.id,
            name_prefix: prefixForStorage,
            full_name: participant.fullName.trim(),
            phone: phoneForStorage(participant.phone),
            job_position: mapPositionForStorage(participant.position, participant.positionOther),
            travel_mode: travelModeForStorage,
            travel_other: travelOtherForStorage,
            hotel_name: hotelNameForStorage,
            food_type: participant.foodType,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          const msg = data?.error || `ไม่สามารถบันทึกผู้เข้าร่วมคนที่ ${idx + 1} ได้`;
          throw new Error(String(msg));
        }
      }

      setSuccessMessage(`บันทึกข้อมูลผู้เข้าร่วม ${participants.length} คนเรียบร้อยแล้ว`);
      setTimeout(() => {
        router.push('/admin');
        router.refresh();
      }, 500);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'บันทึกข้อมูลไม่สำเร็จ';
      setErrorMessage(message);
      setSubmitting(false);
    }
  }

  return (
    <section className="admin-bulkedit">
      <h2 className="admin-bulkedit__title">ผู้เข้าร่วมทั้งหมด: {total} คน</h2>

      <form className="admin-bulkedit__form" onSubmit={handleSubmit}>
        <div className="admin-bulkedit__list">
          {participants.map((participant, idx) => {
            const meta = rowMeta[idx];
            return (
              <article key={participant.id} className="admin-bulkedit__item">
                <div className="admin-bulkedit__row">
                  <div className="admin-bulkedit__index">ผู้เข้าร่วมคนที่ {idx + 1}</div>

                  <select
                    className="admin-bulkedit__input admin-bulkedit__input--prefix"
                    value={meta.prefixSelectValue}
                    onChange={(e) =>
                      updateParticipant(idx, {
                        namePrefix:
                          e.target.value === OTHER_PREFIX_VALUE ? OTHER_PREFIX_VALUE : e.target.value,
                      })
                    }
                    disabled={submitting}
                  >
                    <option value="">คำนำหน้า</option>
                    {PREFIX_OPTIONS.map((prefix) => (
                      <option key={prefix} value={prefix}>
                        {prefix}
                      </option>
                    ))}
                    <option value={OTHER_PREFIX_VALUE}>อื่น ๆ (ระบุ)</option>
                  </select>

                  <input
                    type="text"
                    className="admin-bulkedit__input admin-bulkedit__input--name"
                    value={participant.fullName}
                    onChange={(e) => updateParticipant(idx, { fullName: e.target.value })}
                    placeholder="ชื่อ-สกุล"
                    disabled={submitting}
                  />

                  <select
                    className="admin-bulkedit__input admin-bulkedit__input--position"
                    value={participant.position}
                    onChange={(e) => {
                      const next = e.target.value as PositionType;
                      updateParticipant(idx, {
                        position: next,
                        positionOther: next === 'other' ? participant.positionOther : '',
                      });
                    }}
                    disabled={submitting}
                  >
                    <option value="chief_judge">ผู้พิพากษาหัวหน้าศาล</option>
                    <option value="associate_judge">ผู้พิพากษาสมทบ</option>
                    <option value="director">ผู้อำนวยการ</option>
                    <option value="other">อื่น ๆ (ระบุตำแหน่ง)</option>
                  </select>

                  <input
                    type="tel"
                    className="admin-bulkedit__input admin-bulkedit__input--phone"
                    value={participant.phone}
                    onChange={(e) => updateParticipant(idx, { phone: e.target.value })}
                    placeholder="เบอร์โทร (ถ้ามี)"
                    disabled={submitting}
                  />

                  <select
                    className="admin-bulkedit__input admin-bulkedit__input--travel"
                    value={meta.travelSelectValue}
                    onChange={(e) => {
                      const next = e.target.value as TravelMode | '';
                      updateParticipant(idx, {
                        travelMode: next,
                        travelOther: next === 'other' ? participant.travelOther : '',
                      });
                    }}
                    disabled={submitting}
                  >
                    <option value="">เลือกพาหนะ/วิธีเดินทาง</option>
                    {TRAVEL_MODE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <select
                    className="admin-bulkedit__input admin-bulkedit__input--hotel"
                    value={meta.hotelSelectValue}
                    onChange={(e) =>
                      updateParticipant(idx, {
                        hotelName: e.target.value === OTHER_HOTEL_VALUE ? OTHER_HOTEL_VALUE : e.target.value,
                      })
                    }
                    disabled={submitting}
                  >
                    <option value="">เลือกโรงแรม</option>
                    {HOTEL_OPTIONS.map((hotel) => (
                      <option key={hotel} value={hotel}>
                        {hotel}
                      </option>
                    ))}
                    <option value={OTHER_HOTEL_VALUE}>อื่น ๆ (ระบุชื่อโรงแรม)</option>
                  </select>

                  <select
                    className="admin-bulkedit__input admin-bulkedit__input--food"
                    value={participant.foodType}
                    onChange={(e) => updateParticipant(idx, { foodType: e.target.value as FoodType })}
                    disabled={submitting}
                  >
                    {FOOD_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {meta.prefixSelectValue === OTHER_PREFIX_VALUE && (
                  <div className="admin-bulkedit__other">
                    <input
                      type="text"
                      className="admin-bulkedit__input admin-bulkedit__input--wide"
                      value={participant.namePrefix === OTHER_PREFIX_VALUE ? '' : participant.namePrefix}
                      onChange={(e) =>
                        updateParticipant(idx, {
                          namePrefix: e.target.value.trim() ? e.target.value : OTHER_PREFIX_VALUE,
                        })
                      }
                      placeholder="ระบุคำนำหน้า"
                      disabled={submitting}
                    />
                  </div>
                )}

                {participant.position === 'other' && (
                  <div className="admin-bulkedit__other">
                    <input
                      type="text"
                      className="admin-bulkedit__input admin-bulkedit__input--wide"
                      value={participant.positionOther}
                      onChange={(e) => updateParticipant(idx, { positionOther: e.target.value })}
                      placeholder="ระบุตำแหน่ง"
                      disabled={submitting}
                    />
                  </div>
                )}

                {meta.travelSelectValue === 'other' && (
                  <div className="admin-bulkedit__other">
                    <input
                      type="text"
                      className="admin-bulkedit__input admin-bulkedit__input--wide"
                      value={participant.travelOther}
                      onChange={(e) => updateParticipant(idx, { travelOther: e.target.value })}
                      placeholder="ระบุพาหนะ/วิธีเดินทาง"
                      disabled={submitting}
                    />
                  </div>
                )}

                {meta.hotelSelectValue === OTHER_HOTEL_VALUE && (
                  <div className="admin-bulkedit__other">
                    <input
                      type="text"
                      className="admin-bulkedit__input admin-bulkedit__input--wide"
                      value={participant.hotelName === OTHER_HOTEL_VALUE ? '' : participant.hotelName}
                      onChange={(e) =>
                        updateParticipant(idx, {
                          hotelName: e.target.value.trim() ? e.target.value : OTHER_HOTEL_VALUE,
                        })
                      }
                      placeholder="ระบุชื่อโรงแรม"
                      disabled={submitting}
                    />
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {errorMessage && <p className="admin-bulkedit__error">{errorMessage}</p>}
        {successMessage && <p className="admin-bulkedit__success">{successMessage}</p>}

        <div className="admin-bulkedit__actions">
          <button
            type="button"
            className="admin-form__button admin-form__button--ghost"
            onClick={() => router.push('/admin')}
            disabled={submitting}
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            className="admin-form__button admin-form__button--primary"
            disabled={submitting}
          >
            {submitting ? 'กำลังบันทึก...' : `บันทึกข้อมูล ${total} คน`}
          </button>
        </div>
      </form>
    </section>
  );
}
