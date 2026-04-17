// app/registeruser/add/form/AddParticipantFormClient.tsx
'use client';

import '../../form/registeruser-form.css';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
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

type ParticipantSlipFiles = Record<number, File | null>;

const ADD_PARTICIPANTS_KEY = 'registeruser:add:participants';
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

export default function AddParticipantFormClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const submittingRef = useRef(false);

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

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantSlipFiles, setParticipantSlipFiles] = useState<ParticipantSlipFiles>({});
  const [participantSlipInputKeys, setParticipantSlipInputKeys] = useState<Record<number, number>>({});
  const [slipFile, setSlipFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [registrationClosed, setRegistrationClosed] = useState(false);

  const participantSlipCount = useMemo(
    () =>
      Object.values(participantSlipFiles).filter((file): file is File => file instanceof File)
        .length,
    [participantSlipFiles],
  );

  const hasIndividualSlips = participantSlipCount > 0;

  const filledParticipantRows = useMemo(
    () =>
      participants
        .map((participant, index) => ({ participant, index }))
        .filter(({ participant }) => participant.fullName.trim().length > 0),
    [participants],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const raw = sessionStorage.getItem(ADD_PARTICIPANTS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Participant[];
        if (Array.isArray(p) && p.length > 0) {
          setParticipants(p);
          return;
        }
      }
    } catch {
      // ignore
    }

    setParticipants(Array.from({ length: count }, () => makeEmptyParticipant()));
  }, [count]);

  useEffect(() => {
    if (hasIndividualSlips) {
      setSlipFile(null);
    }
  }, [hasIndividualSlips]);

  function persistParticipants(nextParticipants: Participant[]) {
    try {
      sessionStorage.setItem(ADD_PARTICIPANTS_KEY, JSON.stringify(nextParticipants));
    } catch {
      // ignore
    }
  }

  function handleParticipantChange(index: number, field: keyof Participant, value: string) {
    setParticipants((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value } as Participant;

      queueMicrotask(() => persistParticipants(copy));
      return copy;
    });
  }

  function handleParticipantSlipChange(index: number, file: File | null) {
    setParticipantSlipFiles((prev) => ({
      ...prev,
      [index]: file,
    }));
  }

  function handleParticipantSlipClear(index: number) {
    setParticipantSlipFiles((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    setParticipantSlipInputKeys((prev) => ({
      ...prev,
      [index]: (prev[index] ?? 0) + 1,
    }));
  }

  function handleSlipChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSlipFile(file);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current) return;

    setSuccessMessage(null);
    setErrorMessage(null);

    const filledParticipants = filterFilledParticipants(participants);

    if (filledParticipants.length === 0) {
      return setErrorMessage(t('ต้องมีผู้เข้าร่วมอย่างน้อย 1 คน', 'At least one participant is required'));
    }

    const missingPrefixIndex = filledParticipants.findIndex((p) => {
      const prefix = (p.namePrefix ?? '').trim();
      return !prefix || prefix === OTHER_PREFIX_VALUE;
    });
    if (missingPrefixIndex >= 0) {
      return setErrorMessage(
        t(
          `กรุณาเลือกคำนำหน้าผู้เข้าร่วมคนที่ ${missingPrefixIndex + 1}`,
          `Please select a prefix for participant #${missingPrefixIndex + 1}`,
        ),
      );
    }

    const missingPositionOtherIndex = filledParticipants.findIndex((p) => {
      const position = (p.position ?? '').trim();
      if (position !== 'other') return false;
      return !(p.positionOther ?? '').trim();
    });
    if (missingPositionOtherIndex >= 0) {
      return setErrorMessage(
        t(
          `กรุณาระบุตำแหน่งของผู้เข้าร่วมคนที่ ${missingPositionOtherIndex + 1}`,
          `Please specify the position for participant #${missingPositionOtherIndex + 1}`,
        ),
      );
    }

    const invalidTravelModeIndex = filledParticipants.findIndex((p) => {
      const mode = (p.travelMode ?? '').trim();
      return !!mode && !TRAVEL_MODE_OPTIONS.some((option) => option.value === mode);
    });
    if (invalidTravelModeIndex >= 0) {
      return setErrorMessage(
        t(
          `พาหนะในการเดินทางของผู้เข้าร่วมคนที่ ${invalidTravelModeIndex + 1} ไม่ถูกต้อง`,
          `Travel mode for participant #${invalidTravelModeIndex + 1} is invalid`,
        ),
      );
    }

    const missingTravelOtherIndex = filledParticipants.findIndex((p) => {
      const mode = (p.travelMode ?? '').trim();
      const other = (p.travelOther ?? '').trim();
      return mode === 'other' && !other;
    });
    if (missingTravelOtherIndex >= 0) {
      return setErrorMessage(
        t(
          `กรุณาระบุพาหนะในการเดินทางของผู้เข้าร่วมคนที่ ${missingTravelOtherIndex + 1}`,
          `Please specify the travel mode (other) for participant #${missingTravelOtherIndex + 1}`,
        ),
      );
    }

    const validParticipantSlipEntries = Object.entries(participantSlipFiles)
      .map(([indexStr, file]) => ({
        index: Number(indexStr),
        file,
      }))
      .filter(
        (entry): entry is { index: number; file: File } =>
          Number.isInteger(entry.index) &&
          entry.index >= 0 &&
          entry.index < filledParticipants.length &&
          entry.file instanceof File,
      );

    const hasAnyParticipantSlip = validParticipantSlipEntries.length > 0;
    const hasCombinedSlip = slipFile instanceof File && slipFile.size > 0;

    if (!hasAnyParticipantSlip && !hasCombinedSlip) {
      return setErrorMessage(
        t(
          'กรุณาแนบหลักฐานอย่างน้อย 1 แบบ: สลิปรายบุคคลหรือสลิปรวม',
          'Please attach at least one proof: individual slips or a combined slip.',
        ),
      );
    }

    // validate participant phones
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

    submittingRef.current = true;
    try {
      setSubmitting(true);

      const { phoneForStorage } = await import('@/lib/phone');

      const normalizedParticipants = filledParticipants.map((p) => {
        const n = phoneForStorage(p.phone);

        const rawHotelName = typeof p.hotelName === 'string' ? p.hotelName.trim() : '';
        const hotelName = rawHotelName === OTHER_HOTEL_VALUE ? '' : rawHotelName;

        const rawPrefix = typeof p.namePrefix === 'string' ? p.namePrefix.trim() : '';
        const namePrefix = rawPrefix === OTHER_PREFIX_VALUE ? '' : rawPrefix;

        const rawPositionOther = typeof p.positionOther === 'string' ? p.positionOther.trim() : '';
        const positionOther = p.position === 'other' ? rawPositionOther : '';

        const travelMode = typeof p.travelMode === 'string' ? p.travelMode.trim() : '';
        const rawTravelOther = typeof p.travelOther === 'string' ? p.travelOther.trim() : '';
        const travelOther = travelMode === 'other' ? rawTravelOther : '';

        return {
          ...p,
          namePrefix,
          phone: n,
          hotelName,
          positionOther,
          travelMode,
          travelOther,
        };
      });

      const formData = new FormData();
      formData.append('participants', JSON.stringify(normalizedParticipants));

      for (const entry of validParticipantSlipEntries) {
        formData.append(`participantSlip_${entry.index}`, entry.file);
      }

      if (!hasAnyParticipantSlip && slipFile instanceof File && slipFile.size > 0) {
        formData.append('slip', slipFile);
      }

      const res = await fetch('/api/registeruser/add', { method: 'POST', body: formData });

      if (!res.ok) {
        let data: any = null;
        try {
          data = await res.json();
        } catch {
          // ignore
        }
        const msg =
          (data && typeof data === 'object' && 'message' in data && (data as any).message) ||
          'ไม่สามารถบันทึกข้อมูลได้';

        if (msg === 'REGISTRATION_CLOSED') {
          setRegistrationClosed(true);
          return;
        }

        if (msg === 'NOT_REGISTERED_YET') {
          setErrorMessage(
            t(
              'ท่านยังไม่ได้ลงทะเบียน กรุณาไปหน้าลงทะเบียนก่อน',
              'You have not registered yet. Please go to the registration page first.'
            )
          );
          return;
        }

        throw new Error(String(msg));
      }

      await res.json();

      setSuccessMessage(t('เพิ่มผู้เข้าร่วมเรียบร้อยแล้ว', 'Participants added successfully'));

      // ลบข้อมูลใน sessionStorage
      try {
        sessionStorage.removeItem(ADD_PARTICIPANTS_KEY);
      } catch {
        // ignore
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message ||
          t('ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง', 'Unable to save. Please try again.'),
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (registrationClosed) {
    return (
      <main className="registeruser-page registeruser-page--closed">
        <div className="registeruser-closed-card">
          <div className="registeruser-closed__code">REGISTRATION_CLOSED</div>
          <h1 className="registeruser-closed__title">
            {t('ระบบปิดการลงทะเบียน', 'Registration is closed')}
          </h1>
          <p className="registeruser-closed__subtitle">
            {t(
              'ขณะนี้ปิดรับลงทะเบียนแล้ว หากต้องการข้อมูลเพิ่มเติมโปรดติดต่อผู้ดูแลระบบ',
              'Registration is currently closed. For more information, please contact the administrator.',
            )}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="registeruser-page">
      <div className="registeruser-card">
        <header className="registeruser-header">
          <div className="registeruser-header__top">
            <div className="registeruser-header__text">
              <h1>{t('กรอกข้อมูลผู้เข้าร่วมเพิ่มเติม', 'Additional participant details')}</h1>
              <p>{t(`เพิ่ม ${count} คน`, `Adding ${count} people`)}</p>
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
            onClick={() => router.push('/registeruser/add')}
            disabled={submitting}
          >
            {t('← กลับ', '← Back')}
          </button>
        </div>

        <form className="registeruser-form" onSubmit={handleSubmit}>
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
                      required
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

          <section className="registeruser-section">
            <h2 className="registeruser-section__title">
              {t('แนบสลีปรายบุคคล (ไม่บังคับ)', 'Attach individual slips (optional)')}
            </h2>

            {filledParticipantRows.length === 0 ? (
              <p className="registeruser-help">
                {t(
                  'ยังไม่พบผู้เข้าร่วมที่กรอกชื่อแล้ว',
                  'No named participants yet.',
                )}
              </p>
            ) : (
              <div className="registeruser-slip-list">
                {filledParticipantRows.map(({ participant, index }) => {
                  const selectedFile = participantSlipFiles[index];
                  const displayName =
                    `${(participant.namePrefix ?? '').trim()} ${(participant.fullName ?? '').trim()}`
                      .trim()
                      .replace(/\s+/g, ' ') || '-';
                  return (
                    <div key={`participant-slip-${index}`} className="registeruser-slip-item">
                      <div className="registeruser-slip-item__head">
                        <span className="registeruser-slip-item__name">
                          {t('ผู้เข้าร่วมคนที่', 'Participant')} {index + 1}: {displayName}
                        </span>
                        {selectedFile && (
                          <button
                            type="button"
                            className="registeruser-slip-item__clear"
                            onClick={() => handleParticipantSlipClear(index)}
                            disabled={submitting}
                          >
                            {t('ล้างไฟล์', 'Clear')}
                          </button>
                        )}
                      </div>
                      <input
                        key={`participant-slip-input-${index}-${participantSlipInputKeys[index] ?? 0}`}
                        type="file"
                        className="registeruser-input"
                        accept="image/*,application/pdf"
                        onChange={(event) =>
                          handleParticipantSlipChange(index, event.target.files?.[0] ?? null)
                        }
                        disabled={submitting}
                      />
                      <p className="registeruser-help">
                        {selectedFile
                          ? t(`ไฟล์ที่เลือก: ${selectedFile.name}`, `Selected file: ${selectedFile.name}`)
                          : t('ยังไม่ได้เลือกไฟล์', 'No file selected')}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="registeruser-section">
            <h2 className="registeruser-section__title">
              {t('แนบสลิปรวม (ไม่บังคับ)', 'Attach combined slip (optional)')}
            </h2>
            <div className="registeruser-field">
              {hasIndividualSlips ? (
                <p className="registeruser-help registeruser-help--ok">
                  {t(
                    `ปิดการแนบในหน้านี้ (มีสลีปรายบุคคลแล้ว ${participantSlipCount} รายการ)`,
                    `Attachment is disabled (${participantSlipCount} individual slip(s) found).`,
                  )}
                </p>
              ) : (
                <>
                  <label htmlFor="slip" className="registeruser-label">
                    {t('แนบไฟล์สลิปรวม', 'Attach combined slip')}
                  </label>
                  <input
                    id="slip"
                    type="file"
                    className="registeruser-input"
                    accept="image/*,application/pdf"
                    onChange={handleSlipChange}
                    disabled={submitting}
                  />
                  <p className="registeruser-help">
                    {t(
                      'รองรับไฟล์ภาพ (JPG, PNG) หรือไฟล์ PDF',
                      'Supports image files (JPG, PNG) or PDF',
                    )}
                  </p>
                </>
              )}
            </div>
          </section>

          {successMessage && <p className="registeruser-note">{successMessage}</p>}
          {errorMessage && <p className="registeruser-error">{errorMessage}</p>}

          <div className="registeruser-actions">
            <button type="submit" className="registeruser-button" disabled={submitting}>
              {submitting ? t('กำลังบันทึก...', 'Saving...') : t('ส่งแบบฟอร์ม', 'Submit')}
            </button>
          </div>

          {successMessage && (
            <div className="registeruser-actions">
              <button
                type="button"
                className="registeruser-button"
                onClick={() => router.push('/registeruser/add')}
              >
                {t('เพิ่มผู้เข้าร่วมอีก', 'Add more participants')}
              </button>
              <button
                type="button"
                className="registeruser-button"
                onClick={() => router.push('/dashboard')}
              >
                {t('กลับหน้าหลัก', 'Back to dashboard')}
              </button>
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
