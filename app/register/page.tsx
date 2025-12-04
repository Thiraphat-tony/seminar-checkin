// app/register/page.tsx
'use client';

import { useState, type FormEvent, type ChangeEvent } from 'react';

type FoodType =
  | 'normal'
  | 'no_pork'
  | 'vegetarian'
  | 'vegan'
  | 'halal'
  | 'seafood_allergy'
  | 'other';

type PositionType = 'chief_judge' | 'associate_judge';

type Participant = {
  fullName: string;
  position: PositionType;
  phone: string;
  foodType: FoodType;
};

// ✅ รายชื่อโรงแรมในตัวเมืองสุราษฎร์ธานี (ภาษาไทย)
const SURAT_CITY_HOTELS: string[] = [
  'โรงแรมบีทู สุราษฎร์ธานี พรีเมียร์ (B2 Surat Thani Premier Hotel)',
  'โรงแรมบีทู สุราษฎร์ธานี บูทีค แอนด์ บัดเจท (B2 Surat Thani Boutique & Budget Hotel)',
  'โรงแรมเอเวอร์กรีน สวีท (Evergreen Suite Hotel)',
  'โรงแรมเอส.22 สุราษฎร์ธานี (S.22 Hotel Suratthani)',
  'โรงแรมมายเพลซ แอท สุราษฎร์ (Myplace@Surat Hotel)',
  'โรงแรมราชธานี (Rajthani Hotel)',
  'โรงแรมซีบีดี สุราษฎร์ธานี (CBD Hotel Suratthani)',
  'โรงแรมไดมอนด์ พลาซ่า (Diamond Plaza Hotel)',
  'โรงแรมวังใต้ (Wangtai Hotel)',
  'โรงแรมเค ปาร์ค แกรนด์ (K Park Grand Hotel)',
  'โรงแรม 100 ไอส์แลนด์ รีสอร์ท แอนด์ สปา (100 Islands Resort & Spa)',
  'โรงแรมออคิด ริเวอร์วิว (Orchid Riverview Hotel)',
  'โรงแรมเอส ธารา แกรนด์ (S Tara Grand Hotel)',
  'โรงแรมเซ็นทริโน เซอร์วิส เรสซิเดนซ์ (The Centrino Serviced Residence)',
  'โรงแรมมาร์ลิน (Marlin Hotel)',
  'โรงแรมบลู มังกี้ ฮับ แอนด์ โฮเทล สุราษฎร์ธานี (Blu Monkey Hub & Hotel Surat Thani)',
  'กรีน โฮม รีสอร์ท (Green Home Resort)',
];

// ✅ mapping ภาค → รายชื่อศาลเยาวชนและครอบครัว / แผนกคดีเยาวชนฯ
const REGION_ORGANIZATIONS: Record<string, string[]> = {
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
  const [region, setRegion] = useState(''); // 1–9
  const [hotelName, setHotelName] = useState('');
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
    value: string
  ) {
    setParticipants((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value } as Participant;
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
    // ถ้า organization ปัจจุบันไม่อยู่ใน list ใหม่ ให้เคลียร์
    if (!orgs.includes(organization)) {
      setOrganization('');
    }
  }

  function handleOrganizationChange(e: ChangeEvent<HTMLSelectElement>) {
    setOrganization(e.target.value);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!region) {
      setErrorMessage('กรุณาเลือกสังกัดภาค');
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
    if (!hotelName) {
      setErrorMessage('กรุณาเลือกโรงแรมที่พัก');
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
      formData.append('region', region); // 1–9
      formData.append('hotelName', hotelName);
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
        const data = await res.json().catch(() => null);
        const errorMsg = data?.message || 'ไม่สามารถบันทึกข้อมูลได้';
        console.error('API Error:', { status: res.status, data });
        throw new Error(errorMsg);
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
      // ถ้าอยากล้างโรงแรม/จังหวัด/หน่วยงานด้วยให้ setState เป็นค่าว่างเพิ่มได้
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
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
            <label htmlFor="region">สังกัดภาค *</label>
            <select
              id="region"
              value={region}
              onChange={handleRegionChange}
              required
            >
              <option value="">-- เลือกสังกัดภาค --</option>
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
                  : 'กรุณาเลือกสังกัดภาคก่อน'}
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
              onChange={(e) => setProvince(e.target.value)}
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
                  <option value="no_pork">ไม่ทานหมู</option>
                  <option value="vegetarian">มังสวิรัติ</option>
                  <option value="vegan">เจ / วีแกน</option>
                  <option value="halal">ฮาลาล</option>
                  <option value="seafood_allergy">แพ้อาหารทะเล</option>
                  <option value="other">อื่น ๆ</option>
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
              value={hotelName}
              onChange={(e) => setHotelName(e.target.value)}
              required
            >
              <option value="">
                -- เลือกโรงแรมในตัวเมืองสุราษฎร์ธานี --
              </option>
              {SURAT_CITY_HOTELS.map((hotel) => (
                <option key={hotel} value={hotel}>
                  {hotel}
                </option>
              ))}
            </select>
          </div>
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
