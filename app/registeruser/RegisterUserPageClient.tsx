// app/registeruser/page.tsx
'use client';

import './registeruser-page.css';
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

// ✅ ประเภทอาหาร (ตัด other ออก เหลือ 3 แบบ)
type FoodType = 'normal' | 'vegetarian' | 'halal';
type PositionType = 'chief_judge' | 'associate_judge' | 'other';
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

type CourtOption = {
  id: string;
  court_name: string;
  max_staff: number | null;
};

const PREFIX_OPTIONS = ['นาย', 'นาง', 'นางสาว', 'ดร.', 'ศ.', 'รศ.', 'ผศ.'];
const OTHER_PREFIX_VALUE = '__other__';

const TRAVEL_MODE_VALUES = [
  'car',
  'van',
  'bus',
  'train',
  'plane',
  'motorcycle',
  'other',
] as const;

const TRAVEL_MODE_LABELS: Record<(typeof TRAVEL_MODE_VALUES)[number], string> = {
  car: 'รถยนต์ส่วนตัว',
  van: 'รถตู้',
  bus: 'รถโดยสาร/รถบัส',
  train: 'รถไฟ',
  plane: 'เครื่องบิน',
  motorcycle: 'รถจักรยานยนต์',
  other: 'อื่น ๆ',
};

const TRAVEL_MODE_LABELS_EN: Record<(typeof TRAVEL_MODE_VALUES)[number], string> = {
  car: 'Private car',
  van: 'Van',
  bus: 'Bus',
  train: 'Train',
  plane: 'Plane',
  motorcycle: 'Motorcycle',
  other: 'Other',
};

const LANG_STORAGE_KEY = 'registeruser:lang';

// ✅ mapping ภาค/ศาลกลาง → รายชื่อศาล
const REGION_ORGANIZATIONS: Record<string, string[]> = {
  '0': ['ศาลเยาวชนและครอบครัวกลาง (กรุงเทพมหานคร)'],
  '1': [
    'ศาลเยาวชนและครอบครัวจังหวัดชัยนาท',
    'ศาลเยาวชนและครอบครัวจังหวัดนนทบุรี',
    'ศาลเยาวชนและครอบครัวจังหวัดปทุมธานี',
    'ศาลเยาวชนและครอบครัวจังหวัดพระนครศรีอยุธยา',
    'ศาลเยาวชนและครอบครัวจังหวัดลพบุรี',
    'ศาลเยาวชนและครอบครัวจังหวัดสมุทรปราการ',
    'ศาลเยาวชนและครอบครัวจังหวัดสระบุรี',
    'ศาลเยาวชนและครอบครัวจังหวัดสิงห์บุรี',
    'ศาลเยาวชนและครอบครัวจังหวัดอ่างทอง',
    'ศาลแพ่งมีนบุรีและศาลอาญามีนบุรี แผนกคดีเยาวชนและครอบครัว',
  ],
  '2': [
    'ศาลเยาวชนและครอบครัวจังหวัดจันทบุรี',
    'ศาลเยาวชนและครอบครัวจังหวัดฉะเชิงเทรา',
    'ศาลเยาวชนและครอบครัวจังหวัดชลบุรี',
    'ศาลเยาวชนและครอบครัวจังหวัดตราด',
    'ศาลเยาวชนและครอบครัวจังหวัดนครนายก',
    'ศาลเยาวชนและครอบครัวจังหวัดปราจีนบุรี',
    'ศาลเยาวชนและครอบครัวจังหวัดระยอง',
    'ศาลเยาวชนและครอบครัวจังหวัดสระแก้ว',
  ],
  '3': [
    'ศาลเยาวชนและครอบครัวจังหวัดชัยภูมิ',
    'ศาลเยาวชนและครอบครัวจังหวัดนครราชสีมา',
    'ศาลเยาวชนและครอบครัวจังหวัดบุรีรัมย์',
    'ศาลเยาวชนและครอบครัวจังหวัดยโสธร',
    'ศาลเยาวชนและครอบครัวจังหวัดศรีสะเกษ',
    'ศาลเยาวชนและครอบครัวจังหวัดสุรินทร์',
    'ศาลเยาวชนและครอบครัวจังหวัดอำนาจเจริญ',
    'ศาลเยาวชนและครอบครัวจังหวัดอุบลราชธานี',
  ],
  '4': [
    'ศาลเยาวชนและครอบครัวจังหวัดกาฬสินธุ์',
    'ศาลเยาวชนและครอบครัวจังหวัดขอนแก่น',
    'ศาลเยาวชนและครอบครัวจังหวัดนครพนม',
    'ศาลเยาวชนและครอบครัวจังหวัดบึงกาฬ',
    'ศาลเยาวชนและครอบครัวจังหวัดมหาสารคาม',
    'ศาลเยาวชนและครอบครัวจังหวัดมุกดาหาร',
    'ศาลเยาวชนและครอบครัวจังหวัดร้อยเอ็ด',
    'ศาลเยาวชนและครอบครัวจังหวัดเลย',
    'ศาลเยาวชนและครอบครัวจังหวัดสกลนคร',
    'ศาลเยาวชนและครอบครัวจังหวัดหนองคาย',
    'ศาลเยาวชนและครอบครัวจังหวัดหนองบัวลำภู',
    'ศาลเยาวชนและครอบครัวจังหวัดอุดรธานี',
  ],
  '5': [
    'ศาลเยาวชนและครอบครัวจังหวัดเชียงราย',
    'ศาลเยาวชนและครอบครัวจังหวัดเชียงใหม่',
    'ศาลเยาวชนและครอบครัวจังหวัดน่าน',
    'ศาลเยาวชนและครอบครัวจังหวัดพะเยา',
    'ศาลเยาวชนและครอบครัวจังหวัดแพร่',
    'ศาลเยาวชนและครอบครัวจังหวัดแม่ฮ่องสอน',
    'ศาลเยาวชนและครอบครัวจังหวัดลำปาง',
    'ศาลเยาวชนและครอบครัวจังหวัดลำพูน',
  ],
  '6': [
    'ศาลเยาวชนและครอบครัวจังหวัดกำแพงเพชร',
    'ศาลเยาวชนและครอบครัวจังหวัดตาก',
    'ศาลเยาวชนและครอบครัวจังหวัดนครสวรรค์',
    'ศาลเยาวชนและครอบครัวจังหวัดพิจิตร',
    'ศาลเยาวชนและครอบครัวจังหวัดพิษณุโลก',
    'ศาลเยาวชนและครอบครัวจังหวัดเพชรบูรณ์',
    'ศาลเยาวชนและครอบครัวจังหวัดสุโขทัย',
    'ศาลเยาวชนและครอบครัวจังหวัดอุตรดิตถ์',
    'ศาลเยาวชนและครอบครัวจังหวัดอุทัยธานี',
    'ศาลเยาวชนและครอบครัวจังหวัดตาก (แม่สอด)',
  ],
  '7': [
    'ศาลเยาวชนและครอบครัวจังหวัดกาญจนบุรี',
    'ศาลเยาวชนและครอบครัวจังหวัดนครปฐม',
    'ศาลเยาวชนและครอบครัวจังหวัดประจวบคีรีขันธ์',
    'ศาลเยาวชนและครอบครัวจังหวัดเพชรบุรี',
    'ศาลเยาวชนและครอบครัวจังหวัดราชบุรี',
    'ศาลเยาวชนและครอบครัวจังหวัดสมุทรสงคราม',
    'ศาลเยาวชนและครอบครัวจังหวัดสมุทรสาคร',
    'ศาลเยาวชนและครอบครัวจังหวัดสุพรรณบุรี',
    'ศาลเยาวชนและครอบครัวจังหวัดกาญจนบุรี (ทองผาภูมิ)',
  ],
  '8': [
    'ศาลเยาวชนและครอบครัวจังหวัดกระบี่',
    'ศาลเยาวชนและครอบครัวจังหวัดชุมพร',
    'ศาลเยาวชนและครอบครัวจังหวัดนครศรีธรรมราช',
    'ศาลเยาวชนและครอบครัวจังหวัดภูเก็ต',
    'ศาลเยาวชนและครอบครัวจังหวัดระนอง',
    'ศาลเยาวชนและครอบครัวจังหวัดสุราษฎร์ธานี',
    'ศาลเยาวชนและครอบครัวจังหวัดพังงา',
    'ศาลเยาวชนและครอบครัวจังหวัดพังงา (ตะกั่วป่า)',
    'ศาลเยาวชนและครอบครัวจังหวัดสุราษฎร์ธานี (เกาะสมุย)',
  ],
  '9': [
    'ศาลเยาวชนและครอบครัวจังหวัดตรัง',
    'ศาลเยาวชนและครอบครัวจังหวัดนราธิวาส',
    'ศาลเยาวชนและครอบครัวจังหวัดปัตตานี',
    'ศาลเยาวชนและครอบครัวจังหวัดพัทลุง',
    'ศาลเยาวชนและครอบครัวจังหวัดยะลา',
    'ศาลเยาวชนและครอบครัวจังหวัดสงขลา',
    'ศาลเยาวชนและครอบครัวจังหวัดสตูล',
    'ศาลเยาวชนและครอบครัวจังหวัดยะลา (เบตง)',
  ],
};

type SavedState = {
  region: string;
  organization: string;
  province: string;
  courtId: string;
  coordinatorPrefix: string;
  coordinatorPrefixOther: string;
  coordinatorName: string;
  coordinatorPhone: string;
  count: number;
  completed: boolean;
};

const STORAGE_KEY = 'registeruser:state';
const DRAFT_KEY = 'registeruser:draft';
const PARTICIPANTS_KEY = 'registeruser:participants';
const OTHER_HOTEL_VALUE = '__other__';

function clampCount(n: number) {
  if (!Number.isFinite(n)) return 1;
  const int = Math.floor(n);
  return Math.max(1, Math.min(500, int));
}

function filterFilledParticipants(list: Participant[]) {
  return list.filter((p) => p.fullName.trim().length > 0);
}

function resolveCourtId(name: string, list: CourtOption[]) {
  const trimmed = name.trim();
  if (!trimmed) return '';
  const matched = list.find((court) => court.court_name === trimmed);
  return matched?.id ?? '';
}

function getPrefixSelectValue(prefix: string) {
  const trimmed = prefix?.trim() ?? '';
  if (!trimmed) return '';
  if (trimmed === OTHER_PREFIX_VALUE) return OTHER_PREFIX_VALUE;
  return PREFIX_OPTIONS.includes(trimmed) ? trimmed : OTHER_PREFIX_VALUE;
}

export default function RegisterUserPage() {
  const router = useRouter();

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

  const [organization, setOrganization] = useState('');
  const [province, setProvince] = useState('');
  const [region, setRegion] = useState(''); // 0-9

  const [coordinatorPrefix, setCoordinatorPrefix] = useState('');
  const [coordinatorPrefixOther, setCoordinatorPrefixOther] = useState('');
  const [coordinatorName, setCoordinatorName] = useState('');
  const [coordinatorPhone, setCoordinatorPhone] = useState('');

  // ✅ แนบสลิปอยู่หน้านี้
  const [slipFile, setSlipFile] = useState<File | null>(null);

  // ✅ จำนวนผู้เข้าร่วม (พิมพ์ได้)
  const [totalInput, setTotalInput] = useState<string>('1');

  // ✅ กลับมาหน้านี้แล้วปุ่มเป็น “แก้ไข”
  const [completed, setCompleted] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [registrationClosed, setRegistrationClosed] = useState(false);

  const [courts, setCourts] = useState<CourtOption[]>([]);
  const [courtsLoading, setCourtsLoading] = useState(true);
  const [courtsError, setCourtsError] = useState('');

  const currentOrganizations = useMemo(() => REGION_ORGANIZATIONS[region] ?? [], [region]);

  useEffect(() => {
    let active = true;

    const loadCourts = async () => {
      setCourtsLoading(true);
      setCourtsError('');

      try {
        const res = await fetch('/api/courts', { cache: 'no-store' });
        const payload = await res.json().catch(() => null);

        if (!res.ok || !payload?.ok) {
          throw new Error(payload?.error || 'โหลดรายชื่อศาลไม่สำเร็จ');
        }

        const list = Array.isArray(payload.courts) ? payload.courts : [];
        if (active) setCourts(list);
      } catch (err: any) {
        if (active) setCourtsError(err?.message || 'โหลดรายชื่อศาลไม่สำเร็จ');
      } finally {
        if (active) setCourtsLoading(false);
      }
    };

    loadCourts();
    return () => {
      active = false;
    };
  }, []);

  // ✅ โหลดสถานะเดิม
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const s = JSON.parse(raw) as SavedState;

      setRegion(s.region ?? '');
      setOrganization(s.organization ?? '');
      setProvince(s.province ?? '');

      const savedCoordinatorPrefix = s.coordinatorPrefix ?? '';
      if (
        savedCoordinatorPrefix &&
        !PREFIX_OPTIONS.includes(savedCoordinatorPrefix) &&
        savedCoordinatorPrefix !== OTHER_PREFIX_VALUE
      ) {
        setCoordinatorPrefix(OTHER_PREFIX_VALUE);
        setCoordinatorPrefixOther(savedCoordinatorPrefix);
      } else {
        setCoordinatorPrefix(savedCoordinatorPrefix);
        setCoordinatorPrefixOther(s.coordinatorPrefixOther ?? '');
      }

      setCoordinatorName(s.coordinatorName ?? '');
      setCoordinatorPhone(s.coordinatorPhone ?? '');
      setTotalInput(String(s.count ?? 1));
      setCompleted(!!s.completed);

      setErrorMessage(null);
      setSuccessMessage(null);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let active = true;

    const checkRegistrationStatus = async () => {
      try {
        const res = await fetch('/api/registeruser', { method: 'GET', cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (active && data && data.registrationOpen === false) setRegistrationClosed(true);
      } catch {
        // ignore
      }
    };

    checkRegistrationStatus();
    return () => {
      active = false;
    };
  }, []);

  function saveState(nextCount: number, nextCompleted: boolean, nextCourtId: string) {
    const s: SavedState = {
      region,
      organization,
      province,
      courtId: nextCourtId,
      coordinatorPrefix,
      coordinatorPrefixOther,
      coordinatorName,
      coordinatorPhone,
      count: nextCount,
      completed: nextCompleted,
    };

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(s));
  }

  function handleSlipChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSlipFile(file);
  }

  function handleRegionChange(e: ChangeEvent<HTMLSelectElement>) {
    const newRegion = e.target.value;
    setRegion(newRegion);

    const orgs = REGION_ORGANIZATIONS[newRegion] ?? [];
    if (!orgs.includes(organization)) setOrganization('');

    if (newRegion === '0') setProvince('กรุงเทพมหานคร');
    else setProvince('');
  }

  // ✅ dropdown เลือกศาล (เหมือนเดิม) แล้ว “ยังแก้พิมพ์ต่อได้”
  function handleOrganizationSelect(e: ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;

    // เลือก "กำหนดเอง" ไม่ต้องเปลี่ยนค่า (ไปพิมพ์ใน input ด้านล่าง)
    if (v === '__custom') return;

    setOrganization(v);

    if (region === '0') {
      setProvince('กรุงเทพมหานคร');
      return;
    }

    const provinceMatch = v.split('จังหวัด')[1]?.trim();
    if (provinceMatch) setProvince(provinceMatch);
  }

  // ✅ ช่องพิมพ์แก้ไขชื่อหน่วยงาน/ศาล
  function handleOrganizationInput(e: ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setOrganization(v);

    if (region === '0') {
      setProvince('กรุงเทพมหานคร');
      return;
    }

    const provinceMatch = v.split('จังหวัด')[1]?.trim();
    if (provinceMatch) setProvince(provinceMatch);
  }

  function handleCoordinatorPrefixChange(e: ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    setCoordinatorPrefix(v);
    if (v !== OTHER_PREFIX_VALUE) setCoordinatorPrefixOther('');
  }

  // ✅ ปุ่ม “บันทึกจำนวนผู้เข้าร่วม / แก้ไข” -> ไปหน้า /registeruser/form?count=
  async function goToFormCount() {
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!region) return setErrorMessage(t('กรุณาเลือกสังกัดภาค / ศาลกลาง', 'Please select a region / central court'));
    if (!organization.trim()) return setErrorMessage(t('กรุณากรอกชื่อหน่วยงาน / ศาล', 'Please enter the organization / court name'));
    if (!province.trim()) return setErrorMessage(t('กรุณากรอกจังหวัด', 'Please enter the province'));
    if (courtsLoading) return setErrorMessage(t('กำลังโหลดรายชื่อศาล กรุณารอสักครู่', 'Loading court list. Please wait.'));
    if (courtsError) return setErrorMessage(courtsError);

    const resolvedCourtId = resolveCourtId(organization, courts);
    if (!resolvedCourtId) return setErrorMessage(t('ไม่พบศาลที่ตรงกับชื่อหน่วยงาน/ศาล', 'No matching court found for the organization name'));

    if (!coordinatorPrefix.trim()) return setErrorMessage(t('กรุณาเลือกคำนำหน้าผู้ประสานงาน', 'Please select a coordinator prefix'));
    if (coordinatorPrefix === OTHER_PREFIX_VALUE && !coordinatorPrefixOther.trim())
      return setErrorMessage(t('กรุณาระบุคำนำหน้าผู้ประสานงาน', 'Please specify the coordinator prefix'));
    if (!coordinatorName.trim()) return setErrorMessage(t('กรุณากรอกชื่อ-สกุลผู้ประสานงาน', 'Please enter the coordinator full name'));
    if (!coordinatorPhone.trim()) return setErrorMessage(t('กรุณากรอกเบอร์โทรศัพท์ผู้ประสานงาน', 'Please enter the coordinator phone number'));

    const { isValidPhone } = await import('@/lib/phone');
    if (!isValidPhone(coordinatorPhone))
      return setErrorMessage(t('เบอร์โทรผู้ประสานงานต้องเป็นตัวเลข 10 หลัก', 'Coordinator phone number must be 10 digits'));

    const count = clampCount(Number(totalInput));
    setTotalInput(String(count));
    saveState(count, completed, resolvedCourtId);

    router.push(`/registeruser/form?count=${count}`);
  }

  // ✅ ส่งแบบฟอร์มจริง (หน้านี้)
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!region) return setErrorMessage(t('กรุณาเลือกสังกัดภาค / ศาลกลาง', 'Please select a region / central court'));
    if (!organization.trim()) return setErrorMessage(t('กรุณากรอกชื่อหน่วยงาน / ศาล', 'Please enter the organization / court name'));
    if (!province.trim()) return setErrorMessage(t('กรุณากรอกจังหวัด', 'Please enter the province'));
    if (courtsLoading) return setErrorMessage(t('กำลังโหลดรายชื่อศาล กรุณารอสักครู่', 'Loading court list. Please wait.'));
    if (courtsError) return setErrorMessage(courtsError);

    const resolvedCourtId = resolveCourtId(organization, courts);
    if (!resolvedCourtId) return setErrorMessage(t('ไม่พบศาลที่ตรงกับชื่อหน่วยงาน/ศาล', 'No matching court found for the organization name'));

    if (!coordinatorPrefix.trim()) return setErrorMessage(t('กรุณาเลือกคำนำหน้าผู้ประสานงาน', 'Please select a coordinator prefix'));
    if (coordinatorPrefix === OTHER_PREFIX_VALUE && !coordinatorPrefixOther.trim())
      return setErrorMessage(t('กรุณาระบุคำนำหน้าผู้ประสานงาน', 'Please specify the coordinator prefix'));
    if (!coordinatorName.trim()) return setErrorMessage(t('กรุณากรอกชื่อ-สกุลผู้ประสานงาน', 'Please enter the coordinator full name'));
    if (!coordinatorPhone.trim()) return setErrorMessage(t('กรุณากรอกเบอร์โทรศัพท์ผู้ประสานงาน', 'Please enter the coordinator phone number'));

    // ✅ ดึงผู้เข้าร่วมจากหน้า /registeruser/form
    let participants: Participant[] = [];
    try {
      const raw = sessionStorage.getItem(PARTICIPANTS_KEY);
      if (raw) participants = JSON.parse(raw) as Participant[];
    } catch {
      // ignore
    }

    const filledParticipants = filterFilledParticipants(Array.isArray(participants) ? participants : []);

    if (filledParticipants.length === 0) {
      return setErrorMessage(t('กรุณากด “บันทึกจำนวนผู้เข้าร่วม” แล้วกรอกข้อมูลผู้เข้าร่วมให้ครบถ้วน', 'Please click “Save participant count” and complete all participant details'));
    }
    if (!participants[0]?.fullName?.trim()) {
      return setErrorMessage(t('กรุณากรอกชื่อ-สกุลของผู้เข้าร่วมคนที่ 1', 'Please enter the full name of participant #1'));
    }

    const missingPrefixIndex = filledParticipants.findIndex((p) => {
      const prefix = typeof p.namePrefix === 'string' ? p.namePrefix.trim() : '';
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

    const missingHotelIndex = filledParticipants.findIndex((p) => {
      const name = typeof p.hotelName === 'string' ? p.hotelName.trim() : '';
      return !name || name === OTHER_HOTEL_VALUE;
    });
    if (missingHotelIndex >= 0) {
      return setErrorMessage(
        t(
          `กรุณาเลือกโรงแรมของผู้เข้าร่วมคนที่ ${missingHotelIndex + 1}`,
          `Please select a hotel for participant #${missingHotelIndex + 1}`,
        ),
      );
    }

    // ✅ แก้ข้อความ error ที่เป็น ????? ให้เป็นไทยชัด ๆ
    const missingPositionOtherIndex = filledParticipants.findIndex((p) => {
      const position = typeof p.position === 'string' ? p.position.trim() : '';
      if (position !== 'other') return false;
      return !(p.positionOther ?? '').trim();
    });
    if (missingPositionOtherIndex >= 0) {
      return setErrorMessage(
        t(
          `กรุณาระบุตำแหน่ง (อื่น ๆ) ของผู้เข้าร่วมคนที่ ${missingPositionOtherIndex + 1}`,
          `Please specify the position (other) for participant #${missingPositionOtherIndex + 1}`,
        ),
      );
    }

    const missingTravelModeIndex = filledParticipants.findIndex((p) => {
      const mode = typeof p.travelMode === 'string' ? p.travelMode.trim() : '';
      return !mode;
    });
    if (missingTravelModeIndex >= 0) {
      return setErrorMessage(
        t(
          `กรุณาเลือกวิธีการเดินทางของผู้เข้าร่วมคนที่ ${missingTravelModeIndex + 1}`,
          `Please select a travel mode for participant #${missingTravelModeIndex + 1}`,
        ),
      );
    }

    const invalidTravelModeIndex = filledParticipants.findIndex((p) => {
      const mode = typeof p.travelMode === 'string' ? p.travelMode.trim() : '';
      return !!mode && !TRAVEL_MODE_VALUES.includes(mode as (typeof TRAVEL_MODE_VALUES)[number]);
    });
    if (invalidTravelModeIndex >= 0) {
      return setErrorMessage(
        t(
          `วิธีการเดินทางของผู้เข้าร่วมคนที่ ${invalidTravelModeIndex + 1} ไม่ถูกต้อง`,
          `Travel mode for participant #${invalidTravelModeIndex + 1} is invalid`,
        ),
      );
    }

    const missingTravelOtherIndex = filledParticipants.findIndex((p) => {
      const mode = typeof p.travelMode === 'string' ? p.travelMode.trim() : '';
      const other = typeof p.travelOther === 'string' ? p.travelOther.trim() : '';
      return mode === 'other' && !other;
    });
    if (missingTravelOtherIndex >= 0) {
      return setErrorMessage(
        t(
          `กรุณาระบุวิธีการเดินทาง (อื่น ๆ) ของผู้เข้าร่วมคนที่ ${missingTravelOtherIndex + 1}`,
          `Please specify the travel mode (other) for participant #${missingTravelOtherIndex + 1}`,
        ),
      );
    }

    try {
      setSubmitting(true);

      // validate coordinator phone
      const { normalizePhone, isValidPhone, phoneForStorage } = await import('@/lib/phone');
      const normCoordinator = normalizePhone(coordinatorPhone);
      if (!isValidPhone(normCoordinator)) {
      setErrorMessage(t('เบอร์โทรผู้ประสานงานต้องเป็นตัวเลข 10 หลัก', 'Coordinator phone number must be 10 digits'));
        setSubmitting(false);
        return;
      }

      const normalizedParticipants = filledParticipants.map((p) => {
        const { phoneForStorage: pPhoneForStorage } = require('@/lib/phone') as typeof import('@/lib/phone');
        const n = pPhoneForStorage(p.phone);

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

      const coordinatorPrefixPayload =
        coordinatorPrefix === OTHER_PREFIX_VALUE ? coordinatorPrefixOther.trim() : coordinatorPrefix.trim();

      const formData = new FormData();
      formData.append('organization', organization);
      formData.append('province', province);
      formData.append('region', region);
      formData.append('courtId', resolvedCourtId);
      formData.append('coordinatorPrefixOther', coordinatorPrefixPayload);
      formData.append('coordinatorName', coordinatorName);
      formData.append('coordinatorPhone', (await import('@/lib/phone')).phoneForStorage(coordinatorPhone) ?? '');
      formData.append('totalAttendees', String(filledParticipants.length));
      formData.append('participants', JSON.stringify(normalizedParticipants));
      if (slipFile) formData.append('slip', slipFile);

      const res = await fetch('/api/registeruser', { method: 'POST', body: formData });

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
        throw new Error(String(msg));
      }

      await res.json();

      setSuccessMessage(t('บันทึกข้อมูลการลงทะเบียนเรียบร้อยแล้ว', 'Registration saved successfully'));
      setCompleted(true);
      saveState(clampCount(Number(totalInput)), true, resolvedCourtId);
    } catch (err: any) {
      setErrorMessage(
        err?.message ||
          t('ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง', 'Unable to save. Please try again.'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  const organizationSelectValue = useMemo(() => {
    if (!region) return '';
    if (!organization.trim()) return '';
    return currentOrganizations.includes(organization) ? organization : '__custom';
  }, [region, organization, currentOrganizations]);

  const coordinatorPrefixSelectValue = useMemo(
    () => getPrefixSelectValue(coordinatorPrefix),
    [coordinatorPrefix],
  );

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
      <h1>
        {t('แบบฟอร์มลงทะเบียนการประชุมสัมมนาทางวิชาการ ผู้พิพากษาสมทบในศาลเยาวชนและครอบครัวทั่วราชอาณาจักร ประจำปี ๒๕๖๙', 'Registration Form for the Academic Seminar of Juvenile & Family Court Lay Judges (Nationwide) - 2026')}
      </h1>
      <p>
        {t('สำหรับผู้พิพากษาหัวหน้าศาลฯ และผู้พิพากษาสมทบ กรุณากรอกข้อมูลให้ครบถ้วนก่อนส่งแบบฟอร์ม', 'For chief judges and lay judges. Please complete all required fields before submitting the form.')}
      </p>
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

        <form className="registeruser-form" onSubmit={handleSubmit}>
          {/* 1. ข้อมูลหน่วยงาน */}
          <section className="registeruser-section">
            <h2 className="registeruser-section__title">
              {t('1. ข้อมูลหน่วยงาน', '1. Organization')}
            </h2>

            <div className="registeruser-field">
              <label className="registeruser-label">
                {t('สังกัดภาค / ศาลกลาง *', 'Region / Central Court *')}
              </label>
              <select
                className="registeruser-input"
                value={region}
                onChange={handleRegionChange}
                required
                disabled={submitting}
              >
                <option value="">{t('— กรุณาเลือก —', '— Please select —')}</option>
                <option value="0">
                  {t('ศาลกลาง (กรุงเทพมหานคร)', 'Central Court (Bangkok)')}
                </option>
                <option value="1">{t('ภาค 1', 'Region 1')}</option>
                <option value="2">{t('ภาค 2', 'Region 2')}</option>
                <option value="3">{t('ภาค 3', 'Region 3')}</option>
                <option value="4">{t('ภาค 4', 'Region 4')}</option>
                <option value="5">{t('ภาค 5', 'Region 5')}</option>
                <option value="6">{t('ภาค 6', 'Region 6')}</option>
                <option value="7">{t('ภาค 7', 'Region 7')}</option>
                <option value="8">{t('ภาค 8', 'Region 8')}</option>
                <option value="9">{t('ภาค 9', 'Region 9')}</option>
              </select>
            </div>

            <div className="registeruser-field">
              <label className="registeruser-label">
                {t('หน่วยงาน / ศาล *', 'Organization / Court *')}
              </label>

              <select
                className="registeruser-input"
                value={organizationSelectValue}
                onChange={handleOrganizationSelect}
                disabled={!region || submitting}
              >
                <option value="">
                  {t('— เลือกจากรายการ (ถ้ามี) —', '— Select from list (if available) —')}
                </option>
                {currentOrganizations.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
                <option value="__custom">
                  {t('กำหนดเอง (พิมพ์เอง)', 'Custom (type manually)')}
                </option>
              </select>

              <input
                className="registeruser-input"
                value={organization}
                onChange={handleOrganizationInput}
                placeholder={t(
                  'พิมพ์ชื่อหน่วยงาน / ศาล (ให้ตรงกับรายชื่อศาลในระบบ)',
                  'Type organization / court name (must match the system list)',
                )}
                required
                disabled={!region || submitting}
              />

              {courtsLoading ? (
                <p className="registeruser-help">
                  {t('กำลังโหลดรายชื่อศาล…', 'Loading court list...')}
                </p>
              ) : courtsError ? (
                <p className="registeruser-help">{courtsError}</p>
              ) : (
                <p className="registeruser-help">
                  {t(
                    '* ระบบจะจับคู่ “ชื่อหน่วยงาน/ศาล” กับรายชื่อศาลในฐานข้อมูล (ต้องพิมพ์ให้ตรง)',
                    '* The system matches the organization/court name with the court list in the database (must match exactly).',
                  )}
                </p>
              )}
            </div>

            <div className="registeruser-field">
              <label className="registeruser-label">
                {t('จังหวัด *', 'Province *')}
              </label>
              <input
                className="registeruser-input"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                placeholder={t('เช่น สุราษฎร์ธานี', 'e.g. Surat Thani')}
                required
                disabled={!region || region === '0' || submitting}
              />
              {region === '0' && (
                <p className="registeruser-help">
                  {t(
                    'ศาลกลางกำหนดจังหวัดเป็น “กรุงเทพมหานคร” อัตโนมัติ',
                    'Central Court auto-sets the province to “Bangkok”.',
                  )}
                </p>
              )}
            </div>

            <div className="registeruser-field">
              <label className="registeruser-label">
                {t('คำนำหน้าผู้ประสานงาน *', 'Coordinator prefix *')}
              </label>
              <select
                className="registeruser-input"
                value={coordinatorPrefixSelectValue}
                onChange={handleCoordinatorPrefixChange}
                required
                disabled={submitting}
              >
                <option value="">{t('— กรุณาเลือก —', '— Please select —')}</option>
                {PREFIX_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
                <option value={OTHER_PREFIX_VALUE}>
                  {t('อื่น ๆ (ระบุเอง)', 'Other (specify)')}
                </option>
              </select>

              {coordinatorPrefixSelectValue === OTHER_PREFIX_VALUE && (
                <input
                  className="registeruser-input"
                  value={coordinatorPrefixOther}
                  onChange={(e) => setCoordinatorPrefixOther(e.target.value)}
                  placeholder={t('ระบุคำนำหน้า (เช่น ว่าที่ ร.ต.)', 'Specify prefix (e.g., Lt. Jr.)')}
                  required
                  disabled={submitting}
                />
              )}
            </div>

            <div className="registeruser-field">
              <label className="registeruser-label">
                {t('ชื่อ-สกุลผู้ประสานงาน *', 'Coordinator full name *')}
              </label>
              <input
                className="registeruser-input"
                value={coordinatorName}
                onChange={(e) => setCoordinatorName(e.target.value)}
                placeholder={t('ชื่อ-นามสกุล', 'Full name')}
                required
                disabled={submitting}
              />
            </div>

            <div className="registeruser-field">
              <label className="registeruser-label">
                {t('เบอร์โทรผู้ประสานงาน (10 หลัก) *', 'Coordinator phone (10 digits) *')}
              </label>
              <input
                className="registeruser-input"
                value={coordinatorPhone}
                onChange={(e) => setCoordinatorPhone(e.target.value)}
                placeholder="0XXXXXXXXX"
                inputMode="numeric"
                required
                disabled={submitting}
              />
            </div>
          </section>

          {/* 2. ผู้เข้าร่วมสัมมนาฯ */}
          <section className="registeruser-section">
            <h2 className="registeruser-section__title">
              {t('2. ผู้เข้าร่วมสัมมนาฯ', '2. Participants')}
            </h2>

            <div className="registeruser-field">
              <label className="registeruser-label">
                {t('รวมผู้เข้าร่วมทั้งหมด *', 'Total participants *')}
              </label>
              <input
                type="number"
                min={1}
                step={1}
                className="registeruser-input"
                value={totalInput}
                onChange={(e) => setTotalInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    goToFormCount();
                  }
                }}
                required
                disabled={submitting}
              />

              <div className="registeruser-actions">
                <button
                  type="button"
                  className="registeruser-button"
                  onClick={goToFormCount}
                  disabled={submitting}
                >
                  {completed
                    ? t('แก้ไข', 'Edit')
                    : t('บันทึกจำนวนผู้เข้าร่วม', 'Save participant count')}
                </button>
              </div>

              <p className="registeruser-help">
                {t(
                  '* หลังบันทึกจำนวนผู้เข้าร่วม ระบบจะพาไปหน้ากรอกข้อมูลรายบุคคล (รวมถึงโรงแรม / วิธีเดินทาง)',
                  '* After saving the participant count, you will be taken to the participant details page (including hotel / travel mode).',
                )}
                <br />
                {t('* วิธีเดินทาง: ', '* Travel modes: ')}
                {TRAVEL_MODE_VALUES.map((m) =>
                  lang === 'en' ? TRAVEL_MODE_LABELS_EN[m] : TRAVEL_MODE_LABELS[m],
                ).join(', ')}
              </p>
            </div>
          </section>

          {/* 3. หลักฐานค่าลงทะเบียน */}
          <section className="registeruser-section">
            <h2 className="registeruser-section__title">
              {t('3. หลักฐานค่าลงทะเบียน', '3. Registration payment proof')}
            </h2>
            <div className="registeruser-field">
              <label htmlFor="slip" className="registeruser-label">
                {t('แนบไฟล์ *', 'Attach file *')}
              </label>
              <input
                id="slip"
                type="file"
                className="registeruser-input"
                accept="image/*,application/pdf"
                onChange={handleSlipChange}
                required
                disabled={submitting}
              />
              <p className="registeruser-help">
                {t('รองรับไฟล์ภาพ (JPG, PNG) หรือไฟล์ PDF', 'Supports image files (JPG, PNG) or PDF')}
              </p>
            </div>
          </section>

          {successMessage && <p className="registeruser-note">{successMessage}</p>}
          {errorMessage && <p className="registeruser-error">{errorMessage}</p>}

          <div className="registeruser-actions">
            <button type="submit" className="registeruser-button" disabled={submitting}>
              {submitting ? t('กำลังบันทึก...', 'Saving...') : t('ส่งแบบฟอร์มลงทะเบียน', 'Submit registration')}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

