"use client";

import { useEffect, useState, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import "./attendee.css";
import { maskPhone } from '@/lib/maskPhone';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'กรุณาตรวจสอบ NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY ใน .env.local'
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  const router = useRouter();
  const ticketToken =
    typeof params?.ticket_token === "string" ? params.ticket_token.trim() : "";

  const [attendee, setAttendee] = useState<Attendee | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(true);

  const [checkedInAt, setCheckedInAt] = useState<string | null>(null);
  const [checkinMessage, setCheckinMessage] = useState<string | null>(null);
  const [checkinError, setCheckinError] = useState<string | null>(null);
  const [checkinClosed, setCheckinClosed] = useState(false);
  const [checkinStatusChecked, setCheckinStatusChecked] = useState(false);

  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isPending] = useTransition();

  const isBusy = isCheckingIn || isPending;

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
          setCheckedInAt(typed.checked_in_at ?? null);
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

  useEffect(() => {
    if (!ticketToken) return;

    let cancelled = false;

    const loadCheckinStatus = async () => {
      try {
        const res = await fetch(`/api/checkin?ticket_token=${encodeURIComponent(ticketToken)}`, {
          cache: 'no-store',
        });

        if (!res.ok) {
          if (!cancelled) setCheckinStatusChecked(true);
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        setCheckinStatusChecked(true);
        if (data && typeof data.allowed === 'boolean') {
          setCheckinClosed(!data.allowed);
        }
      } catch {
        if (!cancelled) {
          setCheckinStatusChecked(true);
        }
      }
    };

    loadCheckinStatus();

    return () => {
      cancelled = true;
    };
  }, [ticketToken]);

  const handleCheckin = async () => {
    setCheckinMessage(null);
    setCheckinError(null);

    if (!attendee) {
      setCheckinError('ไม่พบข้อมูลผู้เข้าร่วม กรุณารีเฟรชหน้าอีกครั้ง');
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
        body: JSON.stringify({ ticket_token: ticketToken }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.success) {
        const msg =
          data?.message ||
          (!res.ok
            ? 'ระบบไม่สามารถเช็กอินได้ กรุณาลองใหม่หรือติดต่อเจ้าหน้าที่หน้างาน'
            : 'เช็กอินไม่สำเร็จ');

        if (msg === 'CHECKIN_CLOSED') {
          setCheckinClosed(true);
          setCheckinStatusChecked(true);
          return;
        }
        setCheckinError(msg);

        if (data?.alreadyCheckedIn && data.checked_in_at) {
          setCheckedInAt(data.checked_in_at);
          setCheckinMessage('ผู้เข้าร่วมรายนี้เช็กอินไว้แล้ว');
        }

        return;
      }

      setCheckedInAt(data.checked_in_at || new Date().toISOString());
      setCheckinMessage(data.message || 'เช็กอินสำเร็จแล้ว');

      router.push(`/attendee/${encodeURIComponent(ticketToken)}/welcome`);
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
  const showCheckinClosed = checkinStatusChecked && checkinClosed && !isCheckedIn;

  if (showCheckinClosed) {
    return (
      <main className="attendee-page-container attendee-page--closed">
        <div className="attendee-closed-card">
          <div className="attendee-closed__code">CHECKIN_CLOSED</div>
          <h1 className="attendee-closed__title">ระบบปิดการเช็คอิน</h1>
          <p className="attendee-closed__subtitle">
            ขณะนี้ปิดการเช็คอินหน้างานแล้ว โปรดติดต่อเจ้าหน้าที่สำหรับข้อมูลเพิ่มเติม
          </p>
        </div>
      </main>
    );
  }

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
            <div>โทรศัพท์: {maskPhone(attendee.phone, 'ไม่ระบุ')}</div>
            <div>ตำแหน่ง: {attendee.job_position || 'ไม่ระบุตำแหน่ง'}</div>
            <div>
              ภาค:{' '}
              {attendee.region === 0
                ? 'ศาลเยาวชนและครอบครัวกลาง (กรุงเทพมหานคร)'
                : typeof attendee.region === 'number'
                ? `ภาค ${attendee.region}`
                : 'ไม่ระบุภาค'}
            </div>
            {attendee.region && (
              <div className="attendee-region-note">
                {attendee.region === 1 && 'ภาค 1: กรุงเทพมหานครและจังหวัดในภาคกลาง'}
                {attendee.region === 2 && 'ภาค 2: จังหวัดในภาคตะวันออก'}
                {attendee.region === 3 && 'ภาค 3: จังหวัดในภาคอีสานตอนล่าง'}
                {attendee.region === 4 && 'ภาค 4: จังหวัดในภาคอีสานตอนบน'}
                {attendee.region === 5 && 'ภาค 5: จังหวัดในภาคเหนือ'}
                {attendee.region === 6 && 'ภาค 6: จังหวัดในภาคกลางตอนบน'}
                {attendee.region === 7 && 'ภาค 7: จังหวัดในภาคตะวันตก'}
                {attendee.region === 8 && 'ภาค 8: จังหวัดในภาคใต้ตอนบน'}
                {attendee.region === 9 && 'ภาค 9: จังหวัดในภาคใต้ตอนล่าง'}
              </div>
            )}
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

        </section>

        {/* บล็อกเช็กอินอย่างเดียว ไม่มีอัปโหลดสลิป */}
        <section className="form-section">
          <h3>เช็กอินเข้าร่วมงาน</h3>
          <p className="form-description">
            ตรวจสอบข้อมูลด้านบนให้ถูกต้อง แล้วกดปุ่มด้านล่างเพื่อเช็กอินเข้าร่วมงาน
          </p>

          <button
            type="button"
            className={`btn ${isCheckedIn ? "btn-secondary" : "btn-success"}`}
            onClick={handleCheckin}
            disabled={isBusy || isCheckedIn}
          >
            {isCheckingIn
              ? "กำลังเช็กอิน…"
              : isCheckedIn
              ? "เช็กอินเรียบร้อยแล้ว"
              : "เช็กอินเข้าร่วมงาน"}
          </button>

          {checkinMessage && <p className="message success">{checkinMessage}</p>}
          {checkinError && <p className="message error">{checkinError}</p>}
        </section>
      </div>
    </main>
  );
}
