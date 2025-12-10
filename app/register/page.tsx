// app/register/page.tsx
'use client';

import './register.css';
import { useState, type FormEvent, type ChangeEvent } from 'react';

// ✅ เพิ่ม 'other' เพื่อใช้กับกรณีระบุเอง
type FoodType = 'normal' | 'vegetarian' | 'halal' | 'other';

type PositionType = 'chief_judge' | 'associate_judge';

type Participant = {
  fullName: string;
  position: PositionType;
  phone: string;
  foodType: FoodType;
  // ✅ ช่องให้พิมพ์อาหารอื่น ๆ
  foodOther?: string;
};

// ✅ รายชื่อโรงแรมในตัวเมืองสุราษฎร์ธานี (ตามแผนที่ข้อ 1–13)
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
];

// ✅ mapping ภาค/ศาลกลาง → รายชื่อศาลเยาวชนและครอบครัว / แผนกคดีเยาวชนฯ
// '0' = ศาลเยาวชนและครอบครัวกลาง (ไม่อยู่ในภาค 1–9)
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

export default function RegisterPage() {
  const [organization, setOrganization] = useState(''); // จะมาจาก list ตามภาค
  const [province, setProvince] = useState('');
  const [region, setRegion] = useState(''); // 0–9
  const [coordinatorName, setCoordinatorName] = useState(''); // ชื่อ-สกุลผู้ประสานงานของศาลนี้

  // ✅ แยก state ของ "ตัวเลือกใน select" ออกจาก "ชื่อโรงแรมจริงที่ส่งไป backend"
  const [hotelSelect, setHotelSelect] = useState(''); // ค่าใน <select>
  const [hotelOther, setHotelOther] = useState('');   // ข้อความโรงแรมอื่น ๆ ที่พิมพ์เอง

  const [participants, setParticipants] = useState<Participant[]>([
    {
      fullName: '',
      position: 'associate_judge',
      phone: '',
      foodType: 'normal',
      foodOther: '',
    },
  ]);
  const [slipFile, setSlipFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const totalAttendees = participants.length;

  const currentOrganizations = REGION_ORGANIZATIONS[region] ?? [];

  function handleParticipantChange(
    index: number,
    field: keyof Participant,
    value: string
  ) {
    setParticipants((prev) => {
      const copy = [...prev];
      const updated: Participant = { ...copy[index], [field]: value } as Participant;

      // ✅ ถ้าเปลี่ยนประเภทอาหารเป็นอย่างอื่นที่ไม่ใช่ other ให้ล้างข้อความ foodOther ทิ้ง
      if (field === 'foodType' && value !== 'other') {
        updated.foodOther = '';
      }

      copy[index] = updated;
      return copy;
    });
  }

  function handleAddParticipant() {
    setParticipants((prev) => [
      ...prev,
      {
        fullName: '',
        position: 'associate_judge',
        phone: '',
        foodType: 'normal',
        foodOther: '',
      },
    ]);
  }

  function handleRemoveParticipant(index: number) {
    setParticipants((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSlipChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSlipFile(file);
  }

  function handleRegionChange(e: ChangeEvent<HTMLSelectElement>) {
    const newRegion = e.target.value;
    setRegion(newRegion);

    const orgs = REGION_ORGANIZATIONS[newRegion] ?? [];
    // ถ้า organization ปัจจุบันไม่อยู่ใน list ใหม่ ให้เคลียร์
    if (!orgs.includes(organization)) {
      setOrganization('');
    }

    // ✅ ถ้าเลือกศาลกลาง (region = 0) ให้ตั้งจังหวัดเป็นกรุงเทพฯ อัตโนมัติ
    if (newRegion === '0') {
      setProvince('กรุงเทพมหานคร');
    } else {
      // ภาคอื่น ๆ ให้เคลียร์จังหวัด รอให้ดึงจากชื่อศาลอีกที หรือพิมพ์เอง
      setProvince('');
    }
  }

  function handleOrganizationChange(e: ChangeEvent<HTMLSelectElement>) {
    const org = e.target.value;
    setOrganization(org);

    // ✅ ถ้าเป็นศาลเยาวชนและครอบครัวกลาง ให้ fix จังหวัดเป็นกรุงเทพฯ
    if (region === '0') {
      setProvince('กรุงเทพมหานคร');
      return;
    }

    // ดึงชื่อจังหวัดจากข้อความหลังคำว่า "จังหวัด" ถ้ามี
    const provinceMatch = org.split('จังหวัด')[1]?.trim();
    if (provinceMatch) {
      setProvince(provinceMatch);
    }
  }

  // ✅ จัดการตอนเลือกโรงแรมจาก select
  function handleHotelSelectChange(e: ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    setHotelSelect(value);

    // ถ้าเปลี่ยนจาก "อื่น ๆ" ไปเป็นโรงแรมที่มีใน list ให้ล้างช่องพิมพ์ออก
    if (value !== '__other') {
      setHotelOther('');
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    // ✅ คำนวณชื่อโรงแรมจริงที่ต้องส่งไป backend
    const actualHotelName =
      hotelSelect === '__other' ? hotelOther.trim() : hotelSelect.trim();

    if (!region) {
      setErrorMessage('กรุณาเลือกสังกัดภาค / ศาลกลาง');
      return;
    }
    if (!organization.trim()) {
      setErrorMessage('กรุณาเลือกหน่วยงาน / ศาล');
      return;
    }
    if (!province.trim()) {
      setErrorMessage('กรุณากรอกจังหวัด');
      return;
    }
    if (!coordinatorName.trim()) {
      setErrorMessage('กรุณากรอกชื่อ-สกุลผู้ประสานงาน');
      return;
    }
    // ✅ ตรวจทั้งกรณีเลือกจาก list และกรณีพิมพ์เอง
    if (!actualHotelName) {
      setErrorMessage('กรุณาเลือกหรือระบุโรงแรมที่พัก');
      return;
    }
    if (!slipFile) {
      setErrorMessage('กรุณาแนบไฟล์หลักฐานค่าลงทะเบียน');
      return;
    }
    if (participants.length === 0) {
      setErrorMessage('ต้องมีผู้เข้าร่วมอย่างน้อย 1 คน');
      return;
    }
    if (!participants[0].fullName.trim()) {
      setErrorMessage('กรุณากรอกชื่อ-สกุลของผู้เข้าร่วมคนที่ 1');
      return;
    }

    try {
      setSubmitting(true);

      const formData = new FormData();
      formData.append('organization', organization);
      formData.append('province', province);
      formData.append('region', region);
      formData.append('coordinatorName', coordinatorName);
      // ✅ ส่งชื่อโรงแรมจริง (ไม่ว่าจะมาจาก list หรือพิมพ์เอง)
      formData.append('hotelName', actualHotelName);
      formData.append('totalAttendees', String(totalAttendees));
      // ✅ ตอนนี้ participants มีทั้ง foodType + foodOther แล้ว
      formData.append('participants', JSON.stringify(participants));

      if (slipFile) {
        formData.append('slip', slipFile); // << แนบสลิปแค่ไฟล์เดียว
      }

      const res = await fetch('/api/register', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        let data: any = null;
        try {
          data = await res.json();
        } catch {
          // response body is empty or not JSON; keep data as null
        }

        const errorMsg =
          (data &&
            typeof data === 'object' &&
            'message' in data &&
            data.message) ||
          'ไม่สามารถบันทึกข้อมูลได้';

        console.error('API Error:', { status: res.status, data });
        throw new Error(String(errorMsg));
      }

      const result = await res.json();
      console.log('Registration success:', result);
      setSuccessMessage('บันทึกข้อมูลการลงทะเบียนเรียบร้อยแล้ว');
      setErrorMessage(null);

      setParticipants([
        {
          fullName: '',
          position: 'associate_judge',
          phone: '',
          foodType: 'normal',
          foodOther: '',
        },
      ]);
      setSlipFile(null);
      setHotelSelect('');
      setHotelOther('');
      // ถ้าต้องการ reset อย่างอื่น เพิ่ม setState ตรงนี้ได้ เช่น:
      // setRegion(''); setOrganization(''); setProvince(''); setCoordinatorName('');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(
        err.message || 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="register-page">
      <h1>แบบฟอร์มลงทะเบียนสัมมนา ศาลเยาวชนและครอบครัว</h1>

      <form onSubmit={handleSubmit}>
        {/* 1. ข้อมูลหน่วยงาน */}
        <section>
          <h2>1. ข้อมูลหน่วยงาน</h2>

          <div>
            <label htmlFor="region">สังกัดภาค / ศาลกลาง *</label>
            <select
              id="region"
              value={region}
              onChange={handleRegionChange}
              required
            >
              <option value="">-- เลือกสังกัดภาค / ศาลกลาง --</option>
              <option value="0">ศาลเยาวชนและครอบครัวกลาง</option>
              <option value="1">1 (กรุงเทพฯ และจังหวัดในภาคกลาง)</option>
              <option value="2">2 (จังหวัดในภาคตะวันออก)</option>
              <option value="3">3 (จังหวัดในภาคอีสานตอนล่าง)</option>
              <option value="4">4 (จังหวัดในภาคอีสานตอนบน)</option>
              <option value="5">5 (จังหวัดในภาคเหนือ)</option>
              <option value="6">6 (จังหวัดในภาคกลางตอนบน)</option>
              <option value="7">7 (จังหวัดในภาคตะวันตก)</option>
              <option value="8">8 (จังหวัดในภาคใต้ตอนบน)</option>
              <option value="9">9 (จังหวัดในภาคใต้ตอนล่าง)</option>
            </select>
          </div>

          <div>
            <label htmlFor="organization">ชื่อหน่วยงาน / ศาล *</label>
            <select
              id="organization"
              value={organization}
              onChange={handleOrganizationChange}
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
            </select>
          </div>

          <div>
            <label htmlFor="province">จังหวัด *</label>
            <input
              id="province"
              type="text"
              value={province}
              onChange={(e) => setProvince(e.target.value)} // ✅ แก้ไขได้เอง
              required
            />
          </div>

          <div>
            <label htmlFor="coordinatorName">ชื่อ-สกุลผู้ประสานงาน *</label>
            <input
              id="coordinatorName"
              type="text"
              value={coordinatorName}
              onChange={(e) => setCoordinatorName(e.target.value)}
              placeholder="เช่น นางสาวกานดา ตัวอย่างดี"
              required
            />
          </div>
        </section>

        {/* 2. ผู้เข้าร่วมสัมมนาฯ */}
        <section>
          <h2>2. ผู้เข้าร่วมสัมมนาฯ</h2>

          {participants.map((p, index) => (
            <fieldset key={index}>
              <legend>ผู้เข้าร่วมคนที่ {index + 1}</legend>

              <div>
                <label>ชื่อ - สกุล *</label>
                <input
                  type="text"
                  value={p.fullName}
                  onChange={(e) =>
                    handleParticipantChange(index, 'fullName', e.target.value)
                  }
                  required={index === 0}
                />
              </div>

              <div>
                <label>ตำแหน่ง *</label>
                <select
                  value={p.position}
                  onChange={(e) =>
                    handleParticipantChange(
                      index,
                      'position',
                      e.target.value as PositionType
                    )
                  }
                  required
                >
                  <option value="chief_judge">ผู้พิพากษาหัวหน้าศาลฯ</option>
                  <option value="associate_judge">ผู้พิพากษาสมทบ</option>
                </select>
              </div>

              <div>
                <label>เบอร์โทรศัพท์</label>
                <input
                  type="tel"
                  value={p.phone}
                  onChange={(e) =>
                    handleParticipantChange(index, 'phone', e.target.value)
                  }
                />
              </div>

              <div>
                <label>ประเภทอาหาร</label>
                <select
                  value={p.foodType}
                  onChange={(e) =>
                    handleParticipantChange(
                      index,
                      'foodType',
                      e.target.value as FoodType
                    )
                  }
                >
                  <option value="normal">ทั่วไป</option>
                  <option value="vegetarian">มังสวิรัติ</option>
                  <option value="halal">อิสลาม</option>
                  <option value="other">อื่น ๆ (ระบุ)</option>
                </select>
              </div>

              {/* ✅ ถ้าเลือก "อื่น ๆ" ให้แสดงช่องกรอกรายละเอียด */}
              {p.foodType === 'other' && (
                <div>
                  <label>ระบุอาหารอื่น ๆ</label>
                  <input
                    type="text"
                    value={p.foodOther ?? ''}
                    onChange={(e) =>
                      handleParticipantChange(
                        index,
                        'foodOther',
                        e.target.value
                      )
                    }
                    placeholder="เช่น ไม่ทานเนื้อวัว, แพ้ไข่, แพ้ถั่ว ฯลฯ"
                  />
                </div>
              )}

              {participants.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveParticipant(index)}
                >
                  ลบผู้เข้าร่วมคนที่ {index + 1}
                </button>
              )}
            </fieldset>
          ))}

          <div>
            <button type="button" onClick={handleAddParticipant}>
              + เพิ่มผู้เข้าร่วม
            </button>
          </div>

          <div>
            <label>รวมผู้เข้าร่วมทั้งหมด</label>
            <input type="number" value={totalAttendees} readOnly />
          </div>
        </section>

        {/* 3. หลักฐานค่าลงทะเบียน */}
        <section>
          <h2>3. หลักฐานค่าลงทะเบียน</h2>
          <div>
            <label htmlFor="slip">แนบไฟล์ *</label>
            <input
              id="slip"
              type="file"
              accept="image/*,application/pdf"
              onChange={handleSlipChange}
              required
            />
          </div>
        </section>

        {/* 4. โรงแรมที่พัก */}
        <section>
          <h2>4. ข้อมูลเพิ่มเติม</h2>
          <div>
            <label htmlFor="hotelName">พักโรงแรมไหน *</label>
            <select
              id="hotelName"
              value={hotelSelect}
              onChange={handleHotelSelectChange}
              required
            >
              <option value="">
                -- เลือกโรงแรม --
              </option>
              {SURAT_CITY_HOTELS.map((hotel) => (
                <option key={hotel} value={hotel}>
                  {hotel}
                </option>
              ))}
              {/* ✅ ตัวเลือกอื่น ๆ */}
              <option value="__other">อื่น ๆ (ระบุชื่อโรงแรม)</option>
            </select>
          </div>

          {/* ✅ แสดงช่องกรอกชื่อโรงแรมเมื่อเลือก "อื่น ๆ" */}
          {hotelSelect === '__other' && (
            <div>
              <label htmlFor="hotelOther">ชื่อโรงแรม (กรณีอื่น ๆ)</label>
              <input
                id="hotelOther"
                type="text"
                value={hotelOther}
                onChange={(e) => setHotelOther(e.target.value)}
                placeholder="ระบุชื่อโรงแรมที่พัก"
              />
            </div>
          )}
        </section>

        {successMessage && <p>{successMessage}</p>}
        {errorMessage && <p>{errorMessage}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? 'กำลังบันทึก...' : 'ส่งแบบฟอร์มลงทะเบียน'}
        </button>
      </form>
    </main>
  );
}
