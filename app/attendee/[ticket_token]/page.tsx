'use client';

import { useEffect, useState, useTransition } from 'react';
import type { ChangeEvent } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
// ✅ นำเข้าไฟล์ CSS ทั่วไป
import '@/app/globals.css'; // หรือ '@/styles/globals.css' ขึ้นอยู่กับตำแหน่งไฟล์

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'กรุณาตรวจสอบ NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY ใน .env.local'
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type FoodType =
  | 'normal'
  | 'no_pork'
  | 'vegetarian'
  | 'vegan'
  | 'halal'
  | 'seafood_allergy'
  | 'other';

const FOOD_OPTIONS: { value: FoodType; label: string }[] = [
  { value: 'normal', label: 'อาหารทั่วไป' },
  { value: 'no_pork', label: 'ไม่ทานหมู' },
  { value: 'vegetarian', label: 'มังสวิรัติ' },
  { value: 'vegan', label: 'เจ / วีแกน' },
  { value: 'halal', label: 'ฮาลาล' },
  { value: 'seafood_allergy', label: 'แพ้อาหารทะเล' },
  { value: 'other', label: 'อื่น ๆ' },
];

type Attendee = {
  id: string;
  event_id: string | null;
  full_name: string | null;
  phone: string | null;
  organization: string | null;
  job_position: string | null;   // ✅ ตำแหน่ง
  province: string | null;       // ✅ จังหวัด
  region: number | null;         // ✅ ภาค 1-9
  qr_image_url: string | null;   // ✅ URL รูป QR
  slip_url: string | null;
  checked_in_at: string | null;
  ticket_token: string | null;
  food_type: FoodType | null;
  hotel_name: string | null;     // ✅ โรงแรม
};

function getAvatarInitial(name: string | null): string {
  if (!name) return '👤';
  const trimmed = name.trim();
  if (!trimmed) return '👤';
  return trimmed[0];
}

export default function Page() {
  const params = useParams<{ ticket_token?: string }>();
  const ticketToken =
    typeof params?.ticket_token === 'string'
      ? params.ticket_token.trim()
      : '';

  const [attendee, setAttendee] = useState<Attendee | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(true);

  const [checkedInAt, setCheckedInAt] = useState<string | null>(null);
  const [slipUrl, setSlipUrl] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] =
    useState<string>('ยังไม่ได้เลือกไฟล์');

  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [checkinMessage, setCheckinMessage] = useState<string | null>(null);
  const [checkinError, setCheckinError] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isPending] = useTransition();

  const [foodType, setFoodType] = useState<FoodType>('normal');

  const hasSlip = !!slipUrl;
  const isBusy = isUploading || isCheckingIn || isPending;

  useEffect(() => {
    if (!ticketToken) {
      setLoadError('ไม่พบ ticket_token ในลิงก์');
      setIsLoadingInitial(false);
      return;
    }

    let cancelled = false;

    async function loadAttendee() {
      setIsLoadingInitial(true);
      setLoadError(null);

      try {
        const { data, error } = await supabase
          .from('attendees')
          .select(
            `
            id,
            event_id,
            full_name,
            phone,
            organization,
            job_position,
            province,
            region,
            qr_image_url,
            slip_url,
            checked_in_at,
            ticket_token,
            food_type,
            hotel_name
          `
          )
          .eq('ticket_token', ticketToken)
          .maybeSingle();

        if (error) {
          console.error('load attendee error', error);
          if (!cancelled) {
            setLoadError('โหลดข้อมูลจากฐานข้อมูลไม่สำเร็จ');
          }
          return;
        }

        if (!data) {
          if (!cancelled) {
            setLoadError(`ไม่พบข้อมูลสำหรับ token: ${ticketToken}`);
          }
          return;
        }

        if (!cancelled) {
          const typed = data as Attendee;

          setAttendee(typed);
          setSlipUrl(typed.slip_url ?? null);
          setCheckedInAt(typed.checked_in_at ?? null);
          setFoodType((typed.food_type as FoodType) || 'normal');
        }
      } catch (err) {
        console.error('load attendee unexpected error', err);
        if (!cancelled) {
          setLoadError('ระบบมีปัญหา กรุณาลองใหม่หรือติดต่อเจ้าหน้าที่');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingInitial(false);
        }
      }
    }

    loadAttendee();

    return () => {
      cancelled = true;
    };
  }, [ticketToken]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setUploadMessage(null);
    setUploadError(null);

    if (!file) {
      setSelectedFile(null);
      setSelectedFileName('ยังไม่ได้เลือกไฟล์');
      return;
    }

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/heic',
      'image/heif',
      'application/pdf',
    ];

    if (!allowedTypes.includes(file.type)) {
      setUploadError('กรุณาเลือกไฟล์รูปภาพหรือ PDF เท่านั้น');
      setSelectedFile(null);
      setSelectedFileName('ยังไม่ได้เลือกไฟล์');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('ไฟล์มีขนาดใหญ่เกิน 5MB กรุณาเลือกไฟล์ที่เล็กกว่านี้');
      setSelectedFile(null);
      setSelectedFileName('ยังไม่ได้เลือกไฟล์');
      return;
    }

    setSelectedFile(file);
    setSelectedFileName(file.name);
  };

  const handleClearSelectedFile = () => {
    setSelectedFile(null);
    setSelectedFileName('ยังไม่ได้เลือกไฟล์');
    setUploadMessage(null);
    setUploadError(null);
  };

  const handleFoodTypeChange = (value: FoodType) => {
    setFoodType(value);
  };

  const handleUploadSlip = async () => {
    setUploadMessage(null);
    setUploadError(null);

    if (!attendee) {
      setUploadError('ไม่พบข้อมูลผู้เข้าร่วม กรุณารีเฟรชหน้าอีกครั้ง');
      return;
    }

    if (!selectedFile) {
      setUploadError('กรุณาเลือกไฟล์สลิปก่อนกดอัปโหลด');
      return;
    }

    try {
      setIsUploading(true);

      const formData = new FormData();
      formData.append('attendeeId', attendee.id);
      formData.append('file', selectedFile);

      const res = await fetch('/api/upload-slip', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        setUploadError(
          data.message ||
            'อัปโหลดไฟล์สลิปไม่สำเร็จ กรุณาลองใหม่หรือติดต่อเจ้าหน้าที่'
        );
        return;
      }

      setSlipUrl(data.slip_url || null);
      setUploadMessage(data.message || 'อัปโหลดสลิปเรียบร้อยแล้ว');
      setSelectedFile(null);
      setSelectedFileName('ยังไม่ได้เลือกไฟล์');
    } catch (err) {
      console.error('upload slip error', err);
      setUploadError(
        'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ตหรือรีเฟรชหน้าแล้วลองใหม่อีกครั้ง'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleCheckin = async () => {
    setCheckinMessage(null);
    setCheckinError(null);

    if (!attendee) {
      setCheckinError('ไม่พบข้อมูลผู้เข้าร่วม กรุณารีเฟรชหน้าอีกครั้ง');
      return;
    }

    if (!slipUrl) {
      setCheckinError('กรุณาอัปโหลดสลิปก่อนเช็กอินเข้าร่วมงาน');
      return;
    }

    if (!ticketToken) {
      setCheckinError('ไม่พบรหัสบัตร (ticket_token) กรุณาโหลดหน้าใหม่อีกครั้ง');
      return;
    }

    try {
      setIsCheckingIn(true);

      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ticket_token: ticketToken, food_type: foodType }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.success) {
        const msg =
          data?.message ||
          (!res.ok
            ? 'ระบบไม่สามารถเช็กอินได้ กรุณาลองใหม่หรือติดต่อเจ้าหน้าที่หน้างาน'
            : 'เช็กอินไม่สำเร็จ');

        setCheckinError(msg);

        if (data?.alreadyCheckedIn && data.checked_in_at) {
          setCheckedInAt(data.checked_in_at);
          setCheckinMessage('ผู้เข้าร่วมรายนี้เช็กอินไว้แล้ว');
        }

        return;
      }

      setCheckedInAt(data.checked_in_at || new Date().toISOString());
      setCheckinMessage(data.message || 'เช็กอินสำเร็จแล้ว');
    } catch (err: any) {
      console.error('checkin error', err);
      setCheckinError(
        err?.message ||
          'เกิดข้อผิดพลาดขณะเช็กอิน กรุณาลองใหม่หรือติดต่อเจ้าหน้าที่'
      );
    } finally {
      setIsCheckingIn(false);
    }
  };

  if (!ticketToken) {
    return (
      <main className="attendee-page-container">
        <div className="attendee-page-header">
          <h1>หน้าผู้เข้าร่วมงาน</h1>
        </div>
        <div className="attendee-page-main">
          <p>
            ไม่พบ <code>ticket_token</code> ใน URL
          </p>
        </div>
      </main>
    );
  }

  if (isLoadingInitial) {
    return (
      <main className="attendee-page-container">
        <div className="attendee-page-header">
          <h1>หน้าผู้เข้าร่วมงาน</h1>
        </div>
        <div className="attendee-page-main">
          <p>กำลังโหลดข้อมูลผู้เข้าร่วม…</p>
        </div>
      </main>
    );
  }

  if (loadError || !attendee) {
    return (
      <main className="attendee-page-container">
        <div className="attendee-page-header">
          <h1>หน้าผู้เข้าร่วมงาน</h1>
        </div>
        <div className="attendee-page-main">
          <p>{loadError}</p>
        </div>
      </main>
    );
  }

  const displayName =
    attendee.full_name && attendee.full_name.trim().length > 0
      ? attendee.full_name.trim()
      : 'ไม่ระบุชื่อ';

  const avatarInitial = getAvatarInitial(attendee.full_name);
  const isCheckedIn = !!checkedInAt;

  return (
    <main className="attendee-page-container">
      <header className="attendee-page-header">
        <h1>หน้าผู้เข้าร่วมงานสัมมนา</h1>
      </header>

      <div className="attendee-page-main">
        <p>
          รหัสบัตร (TOKEN): <code>{ticketToken}</code>
        </p>

        {/* การ์ดข้อมูลผู้เข้าร่วม */}
        <section className="attendee-card">
          <div className="attendee-card-header">
            <div className="attendee-avatar">
              <span>{avatarInitial}</span>
            </div>
            <div className="attendee-info">
              <h2>{displayName}</h2>
              <p>หน่วยงาน: {attendee.organization || 'ไม่ระบุหน่วยงาน'}</p>
              <p>จังหวัด: {attendee.province || 'ไม่ระบุจังหวัด'}</p>
            </div>
          </div>

          <div className="attendee-details">
            <div>โทรศัพท์: {attendee.phone || 'ไม่ระบุ'}</div>
            <div>ตำแหน่ง: {attendee.job_position || 'ไม่ระบุตำแหน่ง'}</div>
            <div>ภาค: {attendee.region ? `ภาค ${attendee.region}` : 'ไม่ระบุภาค'}</div>
          </div>

          <div
            className={`status-badge ${
              isCheckedIn ? 'checked-in' : 'not-checked-in'
            }`}
          >
            สถานะเช็กอิน: {isCheckedIn ? 'เช็กอินแล้ว' : 'ยังไม่เช็กอิน'}
          </div>

          {checkedInAt && (
            <p>
              เวลาเช็กอิน:{' '}
              <strong>
                {new Date(checkedInAt).toLocaleString('th-TH', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </strong>
            </p>
          )}

          {/* บล็อกเลือกประเภทอาหาร */}
          <div className="form-section">
            <h3>เลือกประเภทอาหาร</h3>
            <p className="form-description">
              โปรดเลือกให้ตรงกับความต้องการ เพื่อให้ทีมงานเตรียมอาหารได้เหมาะสม
            </p>

            <div className="food-options-grid">
              {FOOD_OPTIONS.map((opt) => {
                const active = foodType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`food-option-btn ${active ? 'active' : ''}`}
                    onClick={() => handleFoodTypeChange(opt.value)}
                    disabled={isCheckedIn || isBusy}
                  >
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* บล็อกอัปโหลด + เช็กอิน */}
        <section className="form-section">
          {/* ขั้นตอนที่ 1: อัปโหลดสลิป */}
          <div>
            <h3>ขั้นตอนที่ 1: อัปโหลดสลิป</h3>
            <p className="form-description">
              เลือกไฟล์สลิปจากมือถือ แล้วกดปุ่ม "อัปโหลดสลิป"
            </p>

            <div className="file-upload-wrapper">
              {!hasSlip ? (
                <>
                  <label>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileChange}
                      disabled={isUploading}
                    />
                    <span>เลือกไฟล์สลิป</span>
                  </label>

                  <p>
                    ไฟล์ที่เลือก: <strong>{selectedFileName}</strong>
                  </p>

                  {selectedFile && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleClearSelectedFile}
                      disabled={isUploading}
                    >
                      ล้างไฟล์ที่เลือก
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleUploadSlip}
                    disabled={isUploading || !selectedFile}
                  >
                    {isUploading ? 'กำลังอัปโหลด…' : 'อัปโหลดสลิป'}
                  </button>
                </>
              ) : (
                <p>
                  ✅ มีสลิปแนบในระบบแล้ว{' '}
                  <a
                    href={slipUrl as string}
                    target="_blank"
                    rel="noreferrer"
                  >
                    คลิกเพื่อเปิดดูสลิป
                  </a>
                  <br />
                  (หากต้องการเปลี่ยนสลิป กรุณาติดต่อเจ้าหน้าที่หน้างาน)
                </p>
              )}

              {uploadMessage && (
                <p className="message success">{uploadMessage}</p>
              )}
              {uploadError && <p className="message error">{uploadError}</p>}
            </div>
          </div>

          {/* ขั้นตอนที่ 2: เช็กอิน */}
          <div>
            <h3>ขั้นตอนที่ 2: เช็กอินเข้าร่วมงาน</h3>
            <p className="form-description">
              เมื่ออัปโหลดสลิปแล้ว ให้กดปุ่มด้านล่างเพื่อเช็กอิน
            </p>

            <button
              type="button"
              className={`btn ${
                isCheckedIn ? 'btn-secondary' : 'btn-success'
              }`}
              onClick={handleCheckin}
              disabled={isBusy || !hasSlip || isCheckedIn}
            >
              {isCheckingIn
                ? 'กำลังเช็กอิน…'
                : isCheckedIn
                ? 'เช็กอินเรียบร้อยแล้ว'
                : 'เช็กอินเข้าร่วมงาน'}
            </button>

            {checkinMessage && (
              <p className="message success">{checkinMessage}</p>
            )}
            {checkinError && <p className="message error">{checkinError}</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
