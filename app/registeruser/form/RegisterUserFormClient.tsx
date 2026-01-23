// app/registeruser/form/RegisterUserFormClient.tsx
'use client';

import './registeruser-form.css';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type FoodType = 'normal' | 'vegetarian' | 'halal';
type PositionType = 'chief_judge' | 'associate_judge' | 'director' | 'other';
type TravelMode = 'car' | 'van' | 'bus' | 'train' | 'plane' | 'motorcycle' | 'other';
type Lang = 'th' | 'en';

type Participant = {
  namePrefix: string;
  fullName: string;
  position: PositionType;
  positionOther: string;
  phone: string;
  foodType: FoodType;
  hotelName: string;
  travelMode: TravelMode | '';
  travelOther: string;
};

type SavedState = {
  region: string;
  organization: string;
  province: string;
  courtId?: string;
  coordinatorPrefix?: string;
  coordinatorPrefixOther?: string;
  coordinatorName: string;
  coordinatorPhone: string;
  count: number;
  completed: boolean;
  participants?: Participant[];
};

const STORAGE_KEY = 'registeruser:state';
const DRAFT_KEY = 'registeruser:draft';
const PARTICIPANTS_KEY = 'registeruser:participants';
const LANG_STORAGE_KEY = 'registeruser:lang';

const PREFIX_OPTIONS = ['นาย', 'นาง', 'นางสาว', 'ดร.', 'ผศ.', 'รศ.', 'ศ.'];
const OTHER_PREFIX_VALUE = '__other__';

const TRAVEL_MODE_OPTIONS: Array<{ value: TravelMode; label: string }> = [
  { value: 'car', label: 'รถยนต์ส่วนบุคคล' },
  { value: 'van', label: 'รถตู้' },
  { value: 'bus', label: 'รถบัส' },
  { value: 'train', label: 'รถไฟ' },
  { value: 'plane', label: 'เครื่องบิน' },
  { value: 'motorcycle', label: 'รถจักรยานยนต์' },
  { value: 'other', label: 'อื่น ๆ (ระบุ)' },
];

const TRAVEL_MODE_LABELS_EN: Record<TravelMode, string> = {
  car: 'Private car',
  van: 'Van',
  bus: 'Bus',
  train: 'Train',
  plane: 'Plane',
  motorcycle: 'Motorcycle',
  other: 'Other (specify)',
};

const POSITION_LABELS_EN: Record<PositionType, string> = {
  chief_judge: 'Chief Judge',
  associate_judge: 'Associate Judge',
  director: 'Director',
  other: 'Other (specify position)',
};

const FOOD_LABELS_EN: Record<FoodType, string> = {
  normal: 'Normal',
  vegetarian: 'Vegetarian',
  halal: 'Halal',
};

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
const OTHER_HOTEL_VALUE = '__other__';

function makeEmptyParticipant(): Participant {
  return {
    namePrefix: '',
    fullName: '',
    position: 'associate_judge',
    positionOther: '',
    phone: '',
    foodType: 'normal',
    hotelName: '',
    travelMode: '',
    travelOther: '',
  };
}

function clampCount(n: number) {
  if (!Number.isFinite(n)) return 1;
  const int = Math.floor(n);
  return Math.max(1, Math.min(500, int));
}

function filterFilledParticipants(list: Participant[]) {
  return list.filter((p) => p.fullName.trim().length > 0);
}

function getPrefixSelectValue(prefix: string) {
  const trimmed = prefix?.trim() ?? '';
  if (!trimmed) return '';
  if (trimmed === OTHER_PREFIX_VALUE) return OTHER_PREFIX_VALUE;
  return PREFIX_OPTIONS.includes(trimmed) ? trimmed : OTHER_PREFIX_VALUE;
}

function getHotelSelectValue(hotelName: string) {
  const trimmed = hotelName?.trim() ?? '';
  if (!trimmed) return '';
  if (trimmed === OTHER_HOTEL_VALUE) return OTHER_HOTEL_VALUE;
  return HOTEL_OPTIONS.includes(trimmed) ? trimmed : OTHER_HOTEL_VALUE;
}

function getTravelSelectValue(travelMode: string) {
  const trimmed = travelMode?.trim() ?? '';
  if (!trimmed) return '';
  return TRAVEL_MODE_OPTIONS.some((option) => option.value === trimmed)
    ? (trimmed as TravelMode)
    : 'other';
}

export default function RegisterUserFormClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [lang, setLang] = useState<Lang>('th');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LANG_STORAGE_KEY);
      if (stored === 'th' || stored === 'en') {
        setLang(stored);
      }
    } catch {
      // ignore
    }
  }, []);

  const setLanguage = (next: Lang) => {
    setLang(next);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  const t = (th: string, en: string) => (lang === 'en' ? en : th);

  const count = useMemo(() => {
    const raw = searchParams.get('count');
    return clampCount(Number(raw ?? '1'));
  }, [searchParams]);

  const [state, setState] = useState<SavedState | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const raw = sessionStorage.getItem(DRAFT_KEY) || sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setState(null);
      setParticipants([]);
      return;
    }

    try {
      const s = JSON.parse(raw) as SavedState;
      setState(s);

      const pRaw = sessionStorage.getItem(PARTICIPANTS_KEY);
      if (pRaw) {
        const p = JSON.parse(pRaw) as Participant[];
        if (Array.isArray(p) && p.length > 0) {
          setParticipants(p);
          return;
        }
      }

      if (Array.isArray(s.participants) && s.participants.length > 0) {
        setParticipants(s.participants);
      }
    } catch {
      setState(null);
      setParticipants([]);
    }
  }, []);

  useEffect(() => {
    setParticipants((prev) => {
      const fromState = state?.participants;
      const base = Array.isArray(fromState) && fromState.length > 0 ? fromState : prev;

      if (base.length === 0) {
        return Array.from({ length: count }, () => makeEmptyParticipant());
      }
      if (base.length < count) {
        const copy = [...base];
        while (copy.length < count) copy.push(makeEmptyParticipant());
        return copy;
      }
      if (base.length > count) return base.slice(0, count);
      return base;
    });
  }, [count, state]);

  function persistBack(nextParticipants: Participant[]) {
    if (!state) return;

    const next: SavedState = {
      ...state,
      count,
      participants: nextParticipants,
      completed: state.completed ?? false,
    };

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    sessionStorage.setItem(PARTICIPANTS_KEY, JSON.stringify(nextParticipants));
  }

  function handleParticipantChange(index: number, field: keyof Participant, value: string) {
    setParticipants((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value } as Participant;

      queueMicrotask(() => persistBack(copy));
      return copy;
    });
  }

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!state) {
      setErrorMessage(t('ไม่พบข้อมูลหน้าก่อนหน้า กรุณากลับไปที่ /registeruser', 'Previous data not found. Please go back to /registeruser'));
      return;
    }

    const filledParticipants = filterFilledParticipants(participants);

    if (filledParticipants.length === 0) {
      setErrorMessage(t('ต้องมีผู้เข้าร่วมอย่างน้อย 1 คน', 'At least one participant is required'));
      return;
    }
    if (!participants[0].fullName.trim()) {
      setErrorMessage(t('กรุณากรอกชื่อ-สกุลของผู้เข้าร่วมคนที่ 1', 'Please enter the full name of participant #1'));
      return;
    }

    const missingPrefixIndex = filledParticipants.findIndex((p) => {
      const prefix = (p.namePrefix ?? '').trim();
      return !prefix || prefix === OTHER_PREFIX_VALUE;
    });
    if (missingPrefixIndex >= 0) {
      setErrorMessage(
        t(
          `กรุณาเลือกคำนำหน้าผู้เข้าร่วมคนที่ ${missingPrefixIndex + 1}`,
          `Please select a prefix for participant #${missingPrefixIndex + 1}`,
        ),
      );
      return;
    }

    const missingHotelIndex = filledParticipants.findIndex((p) => {
      const name = (p.hotelName ?? '').trim();
      return !name || name === OTHER_HOTEL_VALUE;
    });
    if (missingHotelIndex >= 0) {
      setErrorMessage(
        t(
          `กรุณาเลือกโรงแรมของผู้เข้าร่วมคนที่ ${missingHotelIndex + 1}`,
          `Please select a hotel for participant #${missingHotelIndex + 1}`,
        ),
      );
      return;
    }

    // ✅ ตำแหน่ง "อื่น ๆ" ต้องระบุข้อความ
    const missingPositionOtherIndex = filledParticipants.findIndex((p) => {
      const position = (p.position ?? '').trim();
      if (position !== 'other') return false;
      return !(p.positionOther ?? '').trim();
    });
    if (missingPositionOtherIndex >= 0) {
      setErrorMessage(
        t(
          `กรุณาระบุตำแหน่งของผู้เข้าร่วมคนที่ ${missingPositionOtherIndex + 1}`,
          `Please specify the position for participant #${missingPositionOtherIndex + 1}`,
        ),
      );
      return;
    }

    const missingTravelModeIndex = filledParticipants.findIndex((p) => {
      const mode = (p.travelMode ?? '').trim();
      return !mode;
    });
    if (missingTravelModeIndex >= 0) {
      setErrorMessage(
        t(
          `กรุณาเลือกพาหนะในการเดินทางของผู้เข้าร่วมคนที่ ${missingTravelModeIndex + 1}`,
          `Please select a travel mode for participant #${missingTravelModeIndex + 1}`,
        ),
      );
      return;
    }

    const invalidTravelModeIndex = filledParticipants.findIndex((p) => {
      const mode = (p.travelMode ?? '').trim();
      return !!mode && !TRAVEL_MODE_OPTIONS.some((option) => option.value === mode);
    });
    if (invalidTravelModeIndex >= 0) {
      setErrorMessage(
        t(
          `พาหนะในการเดินทางของผู้เข้าร่วมคนที่ ${invalidTravelModeIndex + 1} ไม่ถูกต้อง`,
          `Travel mode for participant #${invalidTravelModeIndex + 1} is invalid`,
        ),
      );
      return;
    }

    const missingTravelOtherIndex = filledParticipants.findIndex((p) => {
      const mode = (p.travelMode ?? '').trim();
      const other = (p.travelOther ?? '').trim();
      return mode === 'other' && !other;
    });
    if (missingTravelOtherIndex >= 0) {
      setErrorMessage(
        t(
          `กรุณาระบุพาหนะในการเดินทางของผู้เข้าร่วมคนที่ ${missingTravelOtherIndex + 1}`,
          `Please specify the travel mode (other) for participant #${missingTravelOtherIndex + 1}`,
        ),
      );
      return;
    }

    // validate participant phones (ถ้ากรอก)
    for (let idx = 0; idx < participants.length; idx++) {
      const p = participants[idx];
      if (!p.fullName.trim()) continue;

      const rawPhone = (p.phone ?? '').trim();
      if (!rawPhone) continue;

      const { normalizePhone, isValidPhone } = await import('@/lib/phone');
      const n = normalizePhone(rawPhone);
      if (!isValidPhone(n)) {
        setErrorMessage(
          t(
            `เบอร์โทรของผู้เข้าร่วมคนที่ ${idx + 1} ต้องเป็นตัวเลข 10 หลัก`,
            `Phone number for participant #${idx + 1} must be 10 digits`,
          ),
        );
        return;
      }
    }

    try {
      setSubmitting(true);

      // ✅ เก็บทั้ง array (ไม่ตัดคนว่างทิ้ง) เพื่อกลับมาแก้ได้ตาม count
      persistBack(participants);

      setSuccessMessage(t('บันทึกข้อมูลผู้เข้าร่วมแล้ว', 'Participant details saved'));
      router.replace('/registeruser');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(
        err?.message ||
          t('บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'Save failed. Please try again.'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="registeruser-page">
      <div className="registeruser-card">
        <header className="registeruser-header">
  <div className="registeruser-header__top">
    <div className="registeruser-header__text">
      <h1>{t('กรอกข้อมูลผู้เข้าร่วม', 'Participant details')}</h1>
      {state ? (
        <p>
          {state.organization} • {state.province}
        </p>
      ) : (
        <p>{t('ไม่พบข้อมูลหน้าก่อนหน้า', 'Previous data not found')}</p>
      )}
    </div>
    <div className="registeruser-lang">
      <span className="registeruser-lang__label">{t('ภาษา', 'Language')}</span>
      <div className="registeruser-lang__buttons" role="group" aria-label="Language toggle">
        <button
          type="button"
          className={`registeruser-lang__button ${lang === 'th' ? 'is-active' : ''}`}
          aria-pressed={lang === 'th'}
          onClick={() => setLanguage('th')}
        >
          ไทย
        </button>
        <button
          type="button"
          className={`registeruser-lang__button ${lang === 'en' ? 'is-active' : ''}`}
          aria-pressed={lang === 'en'}
          onClick={() => setLanguage('en')}
        >
          EN
        </button>
      </div>
    </div>
  </div>
</header>

        <div className="registeruser-actions">
          <button
            type="button"
            className="registeruser-button"
            onClick={() => router.push('/registeruser')}
            disabled={submitting}
          >
            {t('กลับไปหน้า /registeruser', 'Back to /registeruser')}
          </button>
        </div>

        <form className="registeruser-form" onSubmit={handleSave}>
          <section className="registeruser-section">
            <div className="participants-head">
              <h2 className="participants-total">
                {t('ผู้เข้าร่วมทั้งหมด', 'Total participants')}: {participants.length}{' '}
                {t('คน', 'people')}
              </h2>
            </div>

            {participants.map((p, idx) => {
              const prefixSelectValue = getPrefixSelectValue(p.namePrefix);
              const hotelSelectValue = getHotelSelectValue(p.hotelName);
              const travelSelectValue = getTravelSelectValue(p.travelMode);

              return (
                <div key={idx} id={`participant-${idx + 1}`} className="participant-block">
                  <div className="participant-row">
                    <div className="participant-left">
                      {t('ผู้เข้าร่วมคนที่', 'Participant')} {idx + 1}
                    </div>

                    <select
                      className="participant-select prefix"
                      value={prefixSelectValue}
                      onChange={(e) =>
                        handleParticipantChange(
                          idx,
                          'namePrefix',
                          e.target.value === OTHER_PREFIX_VALUE ? OTHER_PREFIX_VALUE : e.target.value,
                        )
                      }
                      required={Boolean(p.fullName.trim())}
                      disabled={submitting}
                    >
                      <option value="">{t('คำนำหน้า', 'Prefix')}</option>
                      {PREFIX_OPTIONS.map((prefix) => (
                        <option key={prefix} value={prefix}>
                          {prefix}
                        </option>
                      ))}
                      <option value={OTHER_PREFIX_VALUE}>
                        {t('อื่น ๆ (ระบุ)', 'Other (specify)')}
                      </option>
                    </select>

                    <input
                      type="text"
                      className="participant-input name"
                      value={p.fullName}
                      onChange={(e) => handleParticipantChange(idx, 'fullName', e.target.value)}
                      placeholder={t('ชื่อ-สกุล', 'Full name')}
                      required={idx === 0}
                      disabled={submitting}
                    />

                    <select
                      className="participant-select position"
                      value={p.position}
                      onChange={(e) => {
                        const value = e.target.value as PositionType;
                        handleParticipantChange(idx, 'position', value);
                        if (value !== 'other') handleParticipantChange(idx, 'positionOther', '');
                      }}
                      disabled={submitting}
                    >
                      <option value="chief_judge">
                        {lang === 'en' ? POSITION_LABELS_EN.chief_judge : 'ผู้พิพากษาหัวหน้าศาล'}
                      </option>
                      <option value="associate_judge">
                        {lang === 'en' ? POSITION_LABELS_EN.associate_judge : 'ผู้พิพากษาสมทบ'}
                      </option>
                      <option value="director">
                        {lang === 'en' ? POSITION_LABELS_EN.director : 'ผู้อำนวยการ'}
                      </option>
                      <option value="other">
                        {lang === 'en' ? POSITION_LABELS_EN.other : 'อื่น ๆ (ระบุตำแหน่ง)'}
                      </option>
                    </select>

                    <input
                      type="tel"
                      className="participant-input phone"
                      value={p.phone}
                      onChange={(e) => handleParticipantChange(idx, 'phone', e.target.value)}
                      placeholder={t('เบอร์โทร (ถ้ามี)', 'Phone (optional)')}
                      disabled={submitting}
                    />

                    <select
                      className="participant-select travel"
                      value={travelSelectValue}
                      onChange={(e) => {
                        const value = e.target.value as TravelMode | '';
                        handleParticipantChange(idx, 'travelMode', value);
                        if (value !== 'other') handleParticipantChange(idx, 'travelOther', '');
                      }}
                      required={Boolean(p.fullName.trim())}
                      disabled={submitting}
                    >
                      <option value="">{t('เลือกพาหนะ/วิธีเดินทาง', 'Select travel mode')}</option>
                      {TRAVEL_MODE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {lang === 'en' ? TRAVEL_MODE_LABELS_EN[option.value] : option.label}
                        </option>
                      ))}
                    </select>

                    <select
                      className="participant-select hotel"
                      value={hotelSelectValue}
                      onChange={(e) =>
                        handleParticipantChange(
                          idx,
                          'hotelName',
                          e.target.value === OTHER_HOTEL_VALUE ? OTHER_HOTEL_VALUE : e.target.value,
                        )
                      }
                      required={Boolean(p.fullName.trim())}
                      disabled={submitting}
                    >
                      <option value="">{t('เลือกโรงแรม', 'Select hotel')}</option>
                      {HOTEL_OPTIONS.map((hotel) => (
                        <option key={hotel} value={hotel}>
                          {hotel}
                        </option>
                      ))}
                      <option value={OTHER_HOTEL_VALUE}>
                        {t('อื่น ๆ (ระบุชื่อโรงแรม)', 'Other (specify hotel)')}
                      </option>
                    </select>

                    <select
                      className="participant-select food"
                      value={p.foodType}
                      onChange={(e) => handleParticipantChange(idx, 'foodType', e.target.value)}
                      disabled={submitting}
                    >
                      <option value="normal">
                        {lang === 'en' ? FOOD_LABELS_EN.normal : 'ปกติ'}
                      </option>
                      <option value="vegetarian">
                        {lang === 'en' ? FOOD_LABELS_EN.vegetarian : 'มังสวิรัติ'}
                      </option>
                      <option value="halal">
                        {lang === 'en' ? FOOD_LABELS_EN.halal : 'ฮาลาล'}
                      </option>
                    </select>
                  </div>

                  {prefixSelectValue === OTHER_PREFIX_VALUE && (
                    <div className="participant-other">
                      <input
                        type="text"
                        className="participant-input prefix-other"
                        value={p.namePrefix === OTHER_PREFIX_VALUE ? '' : (p.namePrefix ?? '')}
                        onChange={(e) =>
                          handleParticipantChange(
                            idx,
                            'namePrefix',
                            e.target.value.trim() ? e.target.value : OTHER_PREFIX_VALUE,
                          )
                        }
                        placeholder={t('ระบุคำนำหน้า', 'Specify prefix')}
                        required={Boolean(p.fullName.trim())}
                        disabled={submitting}
                      />
                    </div>
                  )}

                  {p.position === 'other' && (
                    <div className="participant-other">
                      <input
                        type="text"
                        className="participant-input position-other"
                        value={p.positionOther ?? ''}
                        onChange={(e) => handleParticipantChange(idx, 'positionOther', e.target.value)}
                        placeholder={t('ระบุตำแหน่ง', 'Specify position')}
                        required={Boolean(p.fullName.trim())}
                        disabled={submitting}
                      />
                    </div>
                  )}

                  {travelSelectValue === 'other' && (
                    <div className="participant-other">
                      <input
                        type="text"
                        className="participant-input travel-other"
                        value={p.travelOther ?? ''}
                        onChange={(e) => handleParticipantChange(idx, 'travelOther', e.target.value)}
                        placeholder={t('ระบุพาหนะ/วิธีเดินทาง', 'Specify travel mode')}
                        required={Boolean(p.fullName.trim())}
                        disabled={submitting}
                      />
                    </div>
                  )}

                  {hotelSelectValue === OTHER_HOTEL_VALUE && (
                    <div className="participant-other">
                      <input
                        type="text"
                        className="participant-input hotel-other"
                        value={p.hotelName === OTHER_HOTEL_VALUE ? '' : (p.hotelName ?? '')}
                        onChange={(e) =>
                          handleParticipantChange(
                            idx,
                            'hotelName',
                            e.target.value.trim() ? e.target.value : OTHER_HOTEL_VALUE,
                          )
                        }
                        placeholder={t('ระบุชื่อโรงแรม', 'Specify hotel')}
                        required={Boolean(p.fullName.trim())}
                        disabled={submitting}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          {successMessage && <p className="registeruser-note">{successMessage}</p>}
          {errorMessage && <p className="registeruser-error">{errorMessage}</p>}

          <div className="registeruser-actions">
            <button type="submit" className="registeruser-button" disabled={submitting}>
              {submitting ? t('กำลังบันทึก...', 'Saving...') : t('บันทึก', 'Save')}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
