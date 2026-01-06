// app/registeruser/page.tsx
'use client';

import './registeruser-page.css';
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

// ✅ ประเภทอาหาร (ตัด other ออก เหลือ 3 แบบ)
type FoodType = 'normal' | 'vegetarian' | 'halal';
type PositionType = 'chief_judge' | 'associate_judge';

type Participant = {
  fullName: string;
  position: PositionType;
  phone: string;
  foodType: FoodType;
};

// ✅ รายชื่อโรงแรมในตัวเมืองสุราษฎร์ธานี
const SURAT_CITY_HOTELS: string[] = [
  'โรงแรม ไดมอนด์พลาซ่า',
  'โรงแรม ร้อยเกาะ',
  'โรงแรม เอสธาราแกรนด์',
  'โรงแรม เอสอาร์',
  'โรงแรม บรรโฮเตล',
  'โรงแรม บ้านไมตรีจิต',
  'โรงแรม สยามธานี',
  'โรงแรม วังใต้',
  'โรงแรม บรรจงบุรี',
  'โรงแรม นิภาการ์เด้น',
  'โรงแรม เดอะรัช',
  'โรงแรม เพ็ชรพะงัน',
  'โรงแรม แก้วสมุยรีสอร์ท',
  'โรงแรม ลีโฮเต็ล',
  'โรงแรม เอสทาราแกรนด์',
  'โรงแรม บีทูพรีเมียร',
  'โรงแรม สุขสมบูรณ์',
];

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
    'ศาลแพ่งมีนบุรีแผนกคดีเยาวชนและครอบครัว',
    'ศาลอาญามีนบุรีแผนกคดีเยาวชนและครอบครัว',
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
  coordinatorName: string;
  coordinatorPhone: string;
  hotelSelect: string;
  hotelOther: string;
  count: number;
  completed: boolean;
};

const STORAGE_KEY = 'registeruser:state';
const DRAFT_KEY = 'registeruser:draft';
const PARTICIPANTS_KEY = 'registeruser:participants';

function clampCount(n: number) {
  if (!Number.isFinite(n)) return 1;
  const int = Math.floor(n);
  return Math.max(1, Math.min(500, int));
}

export default function RegisterUserPage() {
  const router = useRouter();

  const [organization, setOrganization] = useState('');
  const [province, setProvince] = useState('');
  const [region, setRegion] = useState(''); // 0–9
  const [coordinatorName, setCoordinatorName] = useState('');
  const [coordinatorPhone, setCoordinatorPhone] = useState('');

  // ✅ โรงแรม
  const [hotelSelect, setHotelSelect] = useState('');
  const [hotelOther, setHotelOther] = useState('');

  // ✅ แนบสลิปอยู่หน้านี้
  const [slipFile, setSlipFile] = useState<File | null>(null);

  // ✅ จำนวนผู้เข้าร่วม (พิมพ์ได้)
  const [totalInput, setTotalInput] = useState<string>('1');

  // ✅ กลับมาหน้านี้แล้วปุ่มเป็น “แก้ไข”
  const [completed, setCompleted] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentOrganizations = useMemo(() => REGION_ORGANIZATIONS[region] ?? [], [region]);

  // ✅ โหลดสถานะเดิม
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const s = JSON.parse(raw) as SavedState;

      setRegion(s.region ?? '');
      setOrganization(s.organization ?? '');
      setProvince(s.province ?? '');
      setCoordinatorName(s.coordinatorName ?? '');
      setCoordinatorPhone(s.coordinatorPhone ?? '');
      setHotelSelect(s.hotelSelect ?? '');
      setHotelOther(s.hotelOther ?? '');
      setTotalInput(String(s.count ?? 1));
      setCompleted(!!s.completed);

      setErrorMessage(null);
      setSuccessMessage(null);
    } catch {
      // ignore
    }
  }, []);

  function saveState(nextCount: number, nextCompleted: boolean) {
    const s: SavedState = {
      region,
      organization,
      province,
      coordinatorName,
      coordinatorPhone,
      hotelSelect,
      hotelOther,
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

  function handleHotelSelectChange(e: ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    setHotelSelect(value);
    if (value !== '__other') setHotelOther('');
  }

  // ✅ ปุ่ม “บันทึกจำนวนผู้เข้าร่วม / แก้ไข” -> ไปหน้า /registeruser/form?count=
  async function goToFormCount() {
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!region) return setErrorMessage('กรุณาเลือกสังกัดภาค / ศาลกลาง');
    if (!organization.trim()) return setErrorMessage('กรุณากรอกชื่อหน่วยงาน / ศาล');
    if (!province.trim()) return setErrorMessage('กรุณากรอกจังหวัด');
    if (!coordinatorName.trim()) return setErrorMessage('กรุณากรอกชื่อ-สกุลผู้ประสานงาน');
    if (!coordinatorPhone.trim()) return setErrorMessage('กรุณากรอกเบอร์โทรศัพท์ผู้ประสานงาน');

    // validate coordinator phone format (10 digits)
    const { isValidPhone } = await import('@/lib/phone');
    if (!isValidPhone(coordinatorPhone)) return setErrorMessage('เบอร์โทรผู้ประสานงานต้องเป็นตัวเลข 10 หลัก');

    const count = clampCount(Number(totalInput));
    setTotalInput(String(count));
    saveState(count, completed);

    router.push(`/registeruser/form?count=${count}`);
  }

  // ✅ ส่งแบบฟอร์มจริง (หน้านี้)
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    const actualHotelName = hotelSelect === '__other' ? hotelOther.trim() : hotelSelect.trim();

    if (!region) return setErrorMessage('กรุณาเลือกสังกัดภาค / ศาลกลาง');
    if (!organization.trim()) return setErrorMessage('กรุณากรอกชื่อหน่วยงาน / ศาล');
    if (!province.trim()) return setErrorMessage('กรุณากรอกจังหวัด');
    if (!coordinatorName.trim()) return setErrorMessage('กรุณากรอกชื่อ-สกุลผู้ประสานงาน');
    if (!coordinatorPhone.trim()) return setErrorMessage('กรุณากรอกเบอร์โทรศัพท์ผู้ประสานงาน');
    if (!actualHotelName) return setErrorMessage('กรุณาเลือกหรือระบุโรงแรมที่พัก');
    if (!slipFile) return setErrorMessage('กรุณาแนบไฟล์หลักฐานค่าลงทะเบียน');

    // ✅ ดึงผู้เข้าร่วมจากหน้า /registeruser/form
    let participants: Participant[] = [];
    try {
      const raw = sessionStorage.getItem(PARTICIPANTS_KEY);
      if (raw) participants = JSON.parse(raw) as Participant[];
    } catch {
      // ignore
    }

    if (!Array.isArray(participants) || participants.length === 0) {
      return setErrorMessage('กรุณากด “บันทึกจำนวนผู้เข้าร่วม” แล้วกรอกข้อมูลผู้เข้าร่วมให้ครบถ้วน');
    }
    if (!participants[0]?.fullName?.trim()) {
      return setErrorMessage('กรุณากรอกชื่อ-สกุลของผู้เข้าร่วมคนที่ 1');
    }

    try {
      setSubmitting(true);

      // validate coordinator phone
      const { normalizePhone, isValidPhone, phoneForStorage } = await import('@/lib/phone');
      const normCoordinator = normalizePhone(coordinatorPhone);
      if (!isValidPhone(normCoordinator)) {
        setErrorMessage('เบอร์โทรผู้ประสานงานต้องเป็นตัวเลข 10 หลัก');
        setSubmitting(false);
        return;
      }

      // normalize participant phones and validate
      const normalizedParticipants = participants.map((p) => {
        const n = phoneForStorage(p.phone);
        return { ...p, phone: n };
      });

      // If any participant had invalid non-empty phone, phoneForStorage returns null; that's acceptable
      // but if you want to force participants to have valid phones, add a check here.

      const formData = new FormData();
      formData.append('organization', organization);
      formData.append('province', province);
      formData.append('region', region);
      formData.append('coordinatorName', coordinatorName);
      formData.append('coordinatorPhone', phoneForStorage(coordinatorPhone) ?? '');
      formData.append('hotelName', actualHotelName);
      formData.append('totalAttendees', String(participants.length));
      formData.append('participants', JSON.stringify(normalizedParticipants));
      formData.append('slip', slipFile);

      const res = await fetch('/api/registeruser', {
        method: 'POST',
        body: formData,
      });

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
        throw new Error(String(msg));
      }

      await res.json();

      setSuccessMessage('บันทึกข้อมูลการลงทะเบียนเรียบร้อยแล้ว');
      setCompleted(true);
      saveState(clampCount(Number(totalInput)), true);
    } catch (err: any) {
      setErrorMessage(err?.message || 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  }

  // ✅ คำนวณค่า select ให้ “เหมือนเดิม” แต่ถ้าพิมพ์เองจะไปอยู่ option "กำหนดเอง"
  const organizationSelectValue = useMemo(() => {
    if (!region) return '';
    if (!organization.trim()) return '';
    return currentOrganizations.includes(organization) ? organization : '__custom';
  }, [region, organization, currentOrganizations]);

  return (
    <main className="registeruser-page">
      <div className="registeruser-card">
        <header className="registeruser-header">
          <h1>
            แบบฟอร์มลงทะเบียนการประชุมสัมมนาทางวิชาการ ผู้พิพากษาสมทบในศาลเยาวชนและครอบครัว
            ทั่วราชอาณาจักร ประจำปี ๒๕๖๙
          </h1>
          <p>
            สำหรับผู้พิพากษาหัวหน้าศาลฯ และผู้พิพากษาสมทบ กรุณากรอกข้อมูลให้ครบถ้วนก่อนกดส่งแบบฟอร์ม
          </p>
        </header>

        <form className="registeruser-form" onSubmit={handleSubmit}>
          {/* 1. ข้อมูลหน่วยงาน */}
          <section className="registeruser-section">
            <h2 className="registeruser-section__title">1. ข้อมูลหน่วยงาน</h2>

            <div className="registeruser-field">
              <label htmlFor="region" className="registeruser-label">
                สังกัดภาค / ศาลกลาง *
              </label>
              <select
                id="region"
                className="registeruser-select"
                value={region}
                onChange={handleRegionChange}
                required
              >
                <option value="">-- เลือกสังกัดภาค / ศาลกลาง --</option>
                <option value="0">ศาลเยาวชนและครอบครัวกลาง</option>
                <option value="1">ศาลในสังกัดสำนักศาลยุติธรรมประจำภาค 1</option>
                <option value="2">ศาลในสังกัดสำนักศาลยุติธรรมประจำภาค 2</option>
                <option value="3">ศาลในสังกัดสำนักศาลยุติธรรมประจำภาค 3</option>
                <option value="4">ศาลในสังกัดสำนักศาลยุติธรรมประจำภาค 4</option>
                <option value="5">ศาลในสังกัดสำนักศาลยุติธรรมประจำภาค 5</option>
                <option value="6">ศาลในสังกัดสำนักศาลยุติธรรมประจำภาค 6</option>
                <option value="7">ศาลในสังกัดสำนักศาลยุติธรรมประจำภาค 7</option>
                <option value="8">ศาลในสังกัดสำนักศาลยุติธรรมประจำภาค 8</option>
                <option value="9">ศาลในสังกัดสำนักศาลยุติธรรมประจำภาค 9</option>
              </select>
            </div>

            {/* ✅ “เหมือนเดิม” (dropdown) + “แก้ไขได้” (input) */}
            <div className="registeruser-field">
              <label htmlFor="organizationSelect" className="registeruser-label">
                ชื่อหน่วยงาน / ศาล *
              </label>

              <select
                id="organizationSelect"
                className="registeruser-select"
                value={organizationSelectValue}
                onChange={handleOrganizationSelect}
                required
                disabled={!region || currentOrganizations.length === 0}
              >
                <option value="">
                  {region
                    ? '-- เลือกศาลเยาวชนและครอบครัว / แผนกฯ --'
                    : 'กรุณาเลือกสังกัดภาค / ศาลกลางก่อน'}
                </option>

                {currentOrganizations.map((org) => (
                  <option key={org} value={org}>
                    {org}
                  </option>
                ))}

                <option value="__custom">กำหนดเอง (พิมพ์แก้ไขด้านล่าง)</option>
              </select>

              <input
                id="organization"
                type="text"
                className="registeruser-input"
                value={organization}
                onChange={handleOrganizationInput}
                required
                disabled={!region}
                placeholder={
                  region ? 'เลือกจากด้านบนแล้วสามารถแก้ไขข้อความได้ที่ช่องนี้' : 'กรุณาเลือกสังกัดภาค / ศาลกลางก่อน'
                }
              />
            </div>

            <div className="registeruser-field">
              <label htmlFor="province" className="registeruser-label">
                จังหวัด *
              </label>
              <input
                id="province"
                type="text"
                className="registeruser-input"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                required
              />
            </div>

            <div className="registeruser-field">
              <label htmlFor="coordinatorName" className="registeruser-label">
                ชื่อ-สกุลผู้ประสานงาน *
              </label>
              <input
                id="coordinatorName"
                type="text"
                className="registeruser-input"
                value={coordinatorName}
                onChange={(e) => setCoordinatorName(e.target.value)}
                placeholder="เช่น นางสาวกานดา ตัวอย่างดี"
                required
              />
            </div>

            <div className="registeruser-field">
              <label htmlFor="coordinatorPhone" className="registeruser-label">
                เบอร์โทรศัพท์ผู้ประสานงาน *
              </label>
              <input
                id="coordinatorPhone"
                type="tel"
                className="registeruser-input"
                value={coordinatorPhone}
                onChange={(e) => setCoordinatorPhone(e.target.value)}
                placeholder="เช่น 0812345678"
                required
              />
            </div>
          </section>

          {/* 2. ผู้เข้าร่วมสัมมนาฯ */}
          <section className="registeruser-section">
            <h2 className="registeruser-section__title">2. ผู้เข้าร่วมสัมมนาฯ</h2>

            <div className="registeruser-field">
              <label className="registeruser-label">รวมผู้เข้าร่วมทั้งหมด *</label>
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
              />

              <div className="registeruser-actions">
                <button
                  type="button"
                  className="registeruser-button"
                  onClick={goToFormCount}
                  disabled={submitting}
                >
                  {completed ? 'แก้ไข' : 'บันทึกจำนวนผู้เข้าร่วม'}
                </button>
              </div>
            </div>
          </section>

          {/* 3. หลักฐานค่าลงทะเบียน */}
          <section className="registeruser-section">
            <h2 className="registeruser-section__title">3. หลักฐานค่าลงทะเบียน</h2>
            <div className="registeruser-field">
              <label htmlFor="slip" className="registeruser-label">
                แนบไฟล์ *
              </label>
              <input
                id="slip"
                type="file"
                className="registeruser-input"
                accept="image/*,application/pdf"
                onChange={handleSlipChange}
                required
              />
              <p className="registeruser-help">รองรับไฟล์ภาพ (JPG, PNG) หรือไฟล์ PDF</p>
            </div>
          </section>

          {/* 4. โรงแรมที่พัก */}
          <section className="registeruser-section">
            <h2 className="registeruser-section__title">4. ข้อมูลเพิ่มเติม</h2>

            <div className="registeruser-field">
              <label htmlFor="hotelName" className="registeruser-label">
                พักโรงแรมไหน *
              </label>
              <select
                id="hotelName"
                className="registeruser-select"
                value={hotelSelect}
                onChange={handleHotelSelectChange}
                required
              >
                <option value="">-- เลือกโรงแรม --</option>
                {SURAT_CITY_HOTELS.map((hotel) => (
                  <option key={hotel} value={hotel}>
                    {hotel}
                  </option>
                ))}
                <option value="__other">อื่น ๆ (ระบุชื่อโรงแรม)</option>
              </select>
            </div>

            {hotelSelect === '__other' && (
              <div className="registeruser-field">
                <label htmlFor="hotelOther" className="registeruser-label">
                  ชื่อโรงแรม (กรณีอื่น ๆ)
                </label>
                <input
                  id="hotelOther"
                  type="text"
                  className="registeruser-input"
                  value={hotelOther}
                  onChange={(e) => setHotelOther(e.target.value)}
                  placeholder="ระบุชื่อโรงแรมที่พัก"
                />
              </div>
            )}
          </section>

          {successMessage && <p className="registeruser-note">{successMessage}</p>}
          {errorMessage && <p className="registeruser-error">{errorMessage}</p>}

          <div className="registeruser-actions">
            <button type="submit" className="registeruser-button" disabled={submitting}>
              {submitting ? 'กำลังบันทึก...' : 'ส่งแบบฟอร์มลงทะเบียน'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
