// app/register/page.tsx
'use client';

import './register.css';
import { useState, type FormEvent, type ChangeEvent } from 'react';

// ✅ ประเภทอาหาร (ตัด other ออก เหลือ 3 แบบ)
type FoodType = 'normal' | 'vegetarian' | 'halal';

type PositionType = 'chief_judge' | 'associate_judge';

type Participant = {
  fullName: string;
  position: PositionType;
  phone: string;
  foodType: FoodType;
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
    'ศาลแพ่งมีนบุรีแผนกคดีเยาวชนและครอบครัว',
    'ศาลอาญามีนบุรีแผนกคดีเยาวชนและครอบครัว'
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
  const [organization, setOrganization] = useState('');
  const [province, setProvince] = useState('');
  const [region, setRegion] = useState(''); // 0–9
  const [coordinatorName, setCoordinatorName] = useState('');
  const [coordinatorPhone, setCoordinatorPhone] = useState(''); // ✅ เบอร์โทรผู้ประสานงาน

  // ✅ แยก state ของ "ตัวเลือกใน select" ออกจาก "ชื่อโรงแรมจริงที่ส่งไป backend"
  const [hotelSelect, setHotelSelect] = useState('');
  const [hotelOther, setHotelOther] = useState('');

  const [participants, setParticipants] = useState<Participant[]>([
    {
      fullName: '',
      position: 'associate_judge',
      phone: '',
      foodType: 'normal',
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
    value: string,
  ) {
    setParticipants((prev) => {
      const copy = [...prev];
      const updated: Participant = {
        ...copy[index],
        [field]: value,
      } as Participant;

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
    if (!orgs.includes(organization)) {
      setOrganization('');
    }

    if (newRegion === '0') {
      setProvince('กรุงเทพมหานคร');
    } else {
      setProvince('');
    }
  }

  function handleOrganizationChange(e: ChangeEvent<HTMLSelectElement>) {
    const org = e.target.value;
    setOrganization(org);

    if (region === '0') {
      setProvince('กรุงเทพมหานคร');
      return;
    }

    const provinceMatch = org.split('จังหวัด')[1]?.trim();
    if (provinceMatch) {
      setProvince(provinceMatch);
    }
  }

  function handleHotelSelectChange(e: ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    setHotelSelect(value);

    if (value !== '__other') {
      setHotelOther('');
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

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
    if (!coordinatorPhone.trim()) {
      setErrorMessage('กรุณากรอกเบอร์โทรศัพท์ผู้ประสานงาน');
      return;
    }
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
      formData.append('coordinatorPhone', coordinatorPhone); // ✅ ส่งไป backend
      formData.append('hotelName', actualHotelName);
      formData.append('totalAttendees', String(totalAttendees));
      formData.append('participants', JSON.stringify(participants));

      if (slipFile) {
        formData.append('slip', slipFile);
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
          // ignore
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
        },
      ]);
      setSlipFile(null);
      setHotelSelect('');
      setHotelOther('');
      // ถ้าต้องการ reset อย่างอื่น:
      // setRegion('');
      // setOrganization('');
      // setProvince('');
      // setCoordinatorName('');
      // setCoordinatorPhone('');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(
        err.message || 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="register-page">
      <div className="register-card">
        <header className="register-header">
          <h1>แบบฟอร์มลงทะเบียนสัมมนา ศาลเยาวชนและครอบครัว</h1>
          <p>
            สำหรับผู้พิพากษาหัวหน้าศาลฯ และผู้พิพากษาสมทบ
            กรุณากรอกข้อมูลให้ครบถ้วนก่อนกดส่งแบบฟอร์ม
          </p>
        </header>

        <form className="register-form" onSubmit={handleSubmit}>
          {/* 1. ข้อมูลหน่วยงาน */}
          <section className="register-section">
            <h2 className="register-section__title">1. ข้อมูลหน่วยงาน</h2>

            <div className="register-field">
              <label htmlFor="region" className="register-label">
                สังกัดภาค / ศาลกลาง *
              </label>
              <select
                id="region"
                className="register-select"
                value={region}
                onChange={handleRegionChange}
                required
              >
                <option value="">-- เลือกสังกัดภาค / ศาลกลาง --</option>
                <option value="0">ศาลเยาวชนและครอบครัวกลาง</option>
                <option value="1">
                  ศาลในสังกัดสำนักศาลยุติธรรมประจำภาค 1
                </option>
                <option value="2">
                  ศาลในสังกัดสำนักศาลยุติธรรมประจำภาค 2
                </option>
                <option value="3">
                  ศาลในสังกัดสำนักศาลยุติธรรมประจำภาค 3
                </option>
                <option value="4">
                  ศาลในสังกัดสำนักศาลยุติธรรมประจำภาค 4
                </option>
                <option value="5">
                  ศาลในสังกัดสำนักศาลยุติธรรมประจำภาค 5
                </option>
                <option value="6">
                  ศาลในสังกัดสำนักศาลยุติธรรมประจำภาค 6
                </option>
                <option value="7">
                  ศาลในสังกัดสำนักศาลยุติธรรมประจำภาค 7
                </option>
                <option value="8">
                  ศาลในสังกัดสำนักศาลยุติธรรมประจำภาค 8
                </option>
                <option value="9">
                  ศาลในสังกัดสำนักศาลยุติธรรมประจำภาค 9
                </option>
              </select>
            </div>

            <div className="register-field">
              <label htmlFor="organization" className="register-label">
                ชื่อหน่วยงาน / ศาล *
              </label>
              <select
                id="organization"
                className="register-select"
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

            <div className="register-field">
              <label htmlFor="province" className="register-label">
                จังหวัด *
              </label>
              <input
                id="province"
                type="text"
                className="register-input"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                required
              />
            </div>

            <div className="register-field">
              <label
                htmlFor="coordinatorName"
                className="register-label"
              >
                ชื่อ-สกุลผู้ประสานงาน *
              </label>
              <input
                id="coordinatorName"
                type="text"
                className="register-input"
                value={coordinatorName}
                onChange={(e) => setCoordinatorName(e.target.value)}
                placeholder="เช่น นางสาวกานดา ตัวอย่างดี"
                required
              />
            </div>

            <div className="register-field">
              <label
                htmlFor="coordinatorPhone"
                className="register-label"
              >
                เบอร์โทรศัพท์ผู้ประสานงาน *
              </label>
              <input
                id="coordinatorPhone"
                type="tel"
                className="register-input"
                value={coordinatorPhone}
                onChange={(e) => setCoordinatorPhone(e.target.value)}
                placeholder="เช่น 0812345678"
                required
              />
            </div>
          </section>

          {/* 2. ผู้เข้าร่วมสัมมนาฯ */}
          <section className="register-section">
            <h2 className="register-section__title">
              2. ผู้เข้าร่วมสัมมนาฯ
            </h2>

            {participants.map((p, index) => (
              <fieldset key={index}>
                <legend>ผู้เข้าร่วมคนที่ {index + 1}</legend>

                <div className="register-field">
                  <label className="register-label">ชื่อ - สกุล *</label>
                  <input
                    type="text"
                    className="register-input"
                    value={p.fullName}
                    onChange={(e) =>
                      handleParticipantChange(
                        index,
                        'fullName',
                        e.target.value,
                      )
                    }
                    required={index === 0}
                  />
                </div>

                <div className="register-field">
                  <label className="register-label">ตำแหน่ง *</label>
                  <select
                    className="register-select"
                    value={p.position}
                    onChange={(e) =>
                      handleParticipantChange(
                        index,
                        'position',
                        e.target.value as PositionType,
                      )
                    }
                    required
                  >
                    <option value="chief_judge">
                      ผู้พิพากษาหัวหน้าศาลฯ
                    </option>
                    <option value="associate_judge">
                      ผู้พิพากษาสมทบ
                    </option>
                  </select>
                </div>

                <div className="register-field">
                  <label className="register-label">เบอร์โทรศัพท์</label>
                  <input
                    type="tel"
                    className="register-input"
                    value={p.phone}
                    onChange={(e) =>
                      handleParticipantChange(
                        index,
                        'phone',
                        e.target.value,
                      )
                    }
                  />
                </div>

                <div className="register-field">
                  <label className="register-label">ประเภทอาหาร</label>
                  <select
                    className="register-select"
                    value={p.foodType}
                    onChange={(e) =>
                      handleParticipantChange(
                        index,
                        'foodType',
                        e.target.value as FoodType,
                      )
                    }
                  >
                    <option value="normal">ทั่วไป</option>
                    <option value="vegetarian">มังสวิรัติ</option>
                    <option value="halal">อิสลาม</option>
                  </select>
                </div>

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

            <button
              type="button"
              onClick={handleAddParticipant}
            >
              + เพิ่มผู้เข้าร่วม
            </button>

            <div className="register-field">
              <label className="register-label">
                รวมผู้เข้าร่วมทั้งหมด
              </label>
              <input
                type="number"
                className="register-input"
                value={totalAttendees}
                readOnly
              />
            </div>
          </section>

          {/* 3. หลักฐานค่าลงทะเบียน */}
          <section className="register-section">
            <h2 className="register-section__title">
              3. หลักฐานค่าลงทะเบียน
            </h2>
            <div className="register-field">
              <label htmlFor="slip" className="register-label">
                แนบไฟล์ *
              </label>
              <input
                id="slip"
                type="file"
                className="register-input"
                accept="image/*,application/pdf"
                onChange={handleSlipChange}
                required
              />
              <p className="register-help">
                รองรับไฟล์ภาพ (JPG, PNG) หรือไฟล์ PDF
              </p>
            </div>
          </section>

          {/* 4. โรงแรมที่พัก */}
          <section className="register-section">
            <h2 className="register-section__title">4. ข้อมูลเพิ่มเติม</h2>
            <div className="register-field">
              <label htmlFor="hotelName" className="register-label">
                พักโรงแรมไหน *
              </label>
              <select
                id="hotelName"
                className="register-select"
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
              <div className="register-field">
                <label
                  htmlFor="hotelOther"
                  className="register-label"
                >
                  ชื่อโรงแรม (กรณีอื่น ๆ)
                </label>
                <input
                  id="hotelOther"
                  type="text"
                  className="register-input"
                  value={hotelOther}
                  onChange={(e) => setHotelOther(e.target.value)}
                  placeholder="ระบุชื่อโรงแรมที่พัก"
                />
              </div>
            )}
          </section>

          {successMessage && (
            <p className="register-note">{successMessage}</p>
          )}
          {errorMessage && (
            <p className="register-error">{errorMessage}</p>
          )}

          <div className="register-actions">
            <button
              type="submit"
              className="register-button"
              disabled={submitting}
            >
              {submitting
                ? 'กำลังบันทึก...'
                : 'ส่งแบบฟอร์มลงทะเบียน'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
