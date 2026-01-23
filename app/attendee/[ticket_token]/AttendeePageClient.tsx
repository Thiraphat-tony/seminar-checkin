"use client";

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import './attendee.css';
import { maskPhone } from '@/lib/maskPhone';

type Attendee = {
  id: string;
  name_prefix: string | null;
  full_name: string | null;
  phone: string | null;
  organization: string | null;
  job_position: string | null;   // ✅ ตำแหน่ง
  province: string | null;       // ✅ จังหวัด
  region: number | null;         // ✅ ภาค 1-9
  checked_in_at: string | null;
};

type AttendeeApiResponse =
  | { ok: true; attendee: Attendee }
  | { ok: false; message: string };

type CheckinRounds = {
  round1At: string | null;
  round2At: string | null;
  round3At: string | null;
};

type CheckinStatusResponse =
  | {
      ok: true;
      success: true;
      checkinOpen: boolean;
      checkinRoundOpen: number;
      allowed: boolean;
      withinWindow: boolean;
      alreadyCheckedIn: boolean;
      checkedInAt: string | null;
      rounds: CheckinRounds;
    }
  | { ok: false; success: false; message: string };

type CheckinPostResponse =
  | {
      ok: true;
      success: true;
      status: 'checked_in' | 'already_checked_in';
      round: number;
      checked_in_at: string | null;
      alreadyCheckedIn: boolean;
      message: string;
      checkinOpen?: boolean;
      checkinRoundOpen?: number;
    }
  | {
      ok: false;
      success: false;
      status: 'closed' | 'round_not_open' | 'invalid';
      message: string;
      checkinOpen?: boolean;
      checkinRoundOpen?: number;
    };

const ROUND_LABELS: Record<number, string> = {
  1: 'รอบ 1 (เช้า วันแรก)',
  2: 'รอบ 2 (บ่าย วันแรก)',
  3: 'รอบ 3 (เช้า วันที่สอง)',
};

function getAvatarInitial(name: string | null): string {
  if (!name) return '👤';
  const trimmed = name.trim();
  if (!trimmed) return '👤';
  return trimmed[0];
}

function formatCheckinTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('th-TH', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default function Page() {
  const params = useParams<{ ticket_token?: string }>();
  const router = useRouter();
  const ticketToken =
    typeof params?.ticket_token === 'string' ? params.ticket_token.trim() : '';

  const [attendee, setAttendee] = useState<Attendee | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(true);

  const [checkedInAt, setCheckedInAt] = useState<string | null>(null);
  const [checkinMessage, setCheckinMessage] = useState<string | null>(null);
  const [checkinError, setCheckinError] = useState<string | null>(null);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinRoundOpen, setCheckinRoundOpen] = useState(0);
  const [checkinRounds, setCheckinRounds] = useState<CheckinRounds>({
    round1At: null,
    round2At: null,
    round3At: null,
  });
  const [checkinStatusError, setCheckinStatusError] = useState<string | null>(null);
  const [checkinStatusChecked, setCheckinStatusChecked] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);

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
        const res = await fetch(`/api/attendee/${encodeURIComponent(ticketToken)}`, {
          cache: 'no-store',
        });

        if (!res.ok) {
          const apiError = (await res.json().catch(() => null)) as AttendeeApiResponse | null;
          const apiMessage =
            apiError && 'message' in apiError && typeof apiError.message === 'string'
              ? apiError.message
              : null;
          const msg =
            res.status === 404
              ? `ไม่พบข้อมูลสำหรับ token: ${ticketToken}`
              : apiMessage || 'โหลดข้อมูลจากฐานข้อมูลไม่สำเร็จ';
          if (!cancelled) setLoadError(msg);
          return;
        }

        const data = (await res.json().catch(() => null)) as AttendeeApiResponse | null;
        if (!data || !data.ok) {
          if (!cancelled) {
            setLoadError(data?.message || 'ไม่สามารถโหลดข้อมูลผู้เข้าร่วมได้');
          }
          return;
        }

        if (!cancelled) {
          setAttendee(data.attendee);
          setCheckedInAt(data.attendee.checked_in_at ?? null);
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

  const loadCheckinStatus = useCallback(async () => {
    if (!ticketToken) return;

    setIsRefreshingStatus(true);
    setCheckinStatusError(null);

    try {
      const res = await fetch(`/api/checkin?ticket_token=${encodeURIComponent(ticketToken)}`, {
        cache: 'no-store',
      });

      if (!res.ok) {
        setCheckinStatusError('ไม่สามารถตรวจสอบสถานะลงทะเบียนได้ กรุณาลองใหม่');
        return;
      }

      const data = (await res.json()) as CheckinStatusResponse;
      if (!data || !data.ok) {
        setCheckinStatusError('ไม่สามารถตรวจสอบสถานะลงทะเบียนได้ กรุณาลองใหม่');
        return;
      }

      setCheckinOpen(data.checkinOpen);
      setCheckinRoundOpen(data.checkinRoundOpen);
      setCheckinRounds(data.rounds);
      if (data.checkedInAt) {
        setCheckedInAt(data.checkedInAt);
      }
    } catch {
      setCheckinStatusError('ไม่สามารถตรวจสอบสถานะลงทะเบียนได้ กรุณาลองใหม่');
    } finally {
      setCheckinStatusChecked(true);
      setIsRefreshingStatus(false);
    }
  }, [ticketToken]);

  useEffect(() => {
    if (!ticketToken) return;
    void loadCheckinStatus();
  }, [ticketToken, loadCheckinStatus]);

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

      const data = (await res.json().catch(() => ({}))) as CheckinPostResponse;

      if (!res.ok || !data || !data.ok) {
        const rawMessage = data && 'message' in data ? data.message : '';
        const resolvedMessage =
          rawMessage === 'CHECKIN_CLOSED'
            ? 'ระบบปิดการลงทะเบียน'
            : rawMessage === 'ROUND_NOT_OPEN'
            ? 'ยังไม่เปิดรอบลงทะเบียน'
            : rawMessage ||
              (!res.ok
                ? 'ระบบไม่สามารถลงทะเบียนได้ กรุณาลองใหม่หรือติดต่อเจ้าหน้าที่หน้างาน'
                : 'ลงทะเบียนไม่สำเร็จ');

        setCheckinError(resolvedMessage);
        if (data && 'checkinOpen' in data && typeof data.checkinOpen === 'boolean') {
          setCheckinOpen(data.checkinOpen);
        }
        if (data && 'checkinRoundOpen' in data && typeof data.checkinRoundOpen === 'number') {
          setCheckinRoundOpen(data.checkinRoundOpen);
        }
        return;
      }

      if (data.status === 'already_checked_in') {
        setCheckinMessage('ผู้เข้าร่วมรายนี้ลงทะเบียนรอบนี้ไว้แล้ว');
      } else {
        setCheckinMessage(data.message || 'ลงทะเบียนสำเร็จแล้ว');
        router.push(`/attendee/${encodeURIComponent(ticketToken)}/welcome`);
      }

      if (data.checked_in_at) {
        setCheckedInAt(data.checked_in_at);
      }

      await loadCheckinStatus();
    } catch (err: any) {
      console.error('checkin error', err);
      setCheckinError(
        err?.message ||
          'เกิดข้อผิดพลาดขณะลงทะเบียน กรุณาลองใหม่หรือติดต่อเจ้าหน้าที่',
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

  const displayName = (() => {
    const prefix = (attendee.name_prefix ?? '').trim();
    const fullName = (attendee.full_name ?? '').trim();
    const combined = [prefix, fullName].filter(Boolean).join(' ').trim();
    return combined.length ? combined : 'ไม่ระบุชื่อ';
  })();

  const avatarInitial = getAvatarInitial(displayName);
  const regionValue = typeof attendee.region === 'number' ? attendee.region : null;
  const hasAnyCheckin =
    !!checkedInAt ||
    !!checkinRounds.round1At ||
    !!checkinRounds.round2At ||
    !!checkinRounds.round3At;
  const isCheckedIn = hasAnyCheckin;
  const openRoundLabel = ROUND_LABELS[checkinRoundOpen] ?? 'ยังไม่เปิดรอบลงทะเบียน';
  const checkedInForOpenRound =
    checkinRoundOpen === 1
      ? !!checkinRounds.round1At
      : checkinRoundOpen === 2
      ? !!checkinRounds.round2At
      : checkinRoundOpen === 3
      ? !!checkinRounds.round3At
      : false;
  const canCheckin =
    !checkinStatusError &&
    checkinStatusChecked &&
    checkinOpen &&
    checkinRoundOpen > 0 &&
    !checkedInForOpenRound;
  const checkinDisabledReason = checkinStatusError
    ? checkinStatusError
    : !checkinStatusChecked
    ? 'กำลังตรวจสอบสถานะลงทะเบียน...'
    : !checkinOpen
    ? 'ระบบปิดการลงทะเบียน'
    : checkinRoundOpen === 0
    ? 'ยังไม่เปิดรอบลงทะเบียน'
    : checkedInForOpenRound
    ? 'ลงทะเบียนรอบนี้แล้ว'
    : null;

  return (
    <main className="attendee-page-container">
      <header className="attendee-page-header">
        <h1>หน้าผู้เข้าร่วมงานสัมมนา</h1>
      </header>

      <div className="attendee-page-main">
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
              {regionValue === null
                ? 'ไม่ระบุภาค'
                : regionValue === 0
                ? 'ศาลเยาวชนและครอบครัวกลาง (กรุงเทพมหานคร)'
                : `ภาค ${regionValue}`}
            </div>
            <div>
              รอบลงทะเบียน 1:{' '}
              {checkinRounds.round1At
                ? `ลงทะเบียนแล้ว (${formatCheckinTime(checkinRounds.round1At)})`
                : 'ยังไม่ลงทะเบียน'}
            </div>
            <div>
              รอบลงทะเบียน 2:{' '}
              {checkinRounds.round2At
                ? `ลงทะเบียนแล้ว (${formatCheckinTime(checkinRounds.round2At)})`
                : 'ยังไม่ลงทะเบียน'}
            </div>
            <div>
              รอบลงทะเบียน 3:{' '}
              {checkinRounds.round3At
                ? `ลงทะเบียนแล้ว (${formatCheckinTime(checkinRounds.round3At)})`
                : 'ยังไม่ลงทะเบียน'}
            </div>
            {regionValue !== null && regionValue > 0 && (
              <div className="attendee-region-note">
                {regionValue === 1 && 'ภาค 1: กรุงเทพมหานครและจังหวัดในภาคกลาง'}
                {regionValue === 2 && 'ภาค 2: จังหวัดในภาคตะวันออก'}
                {regionValue === 3 && 'ภาค 3: จังหวัดในภาคอีสานตอนล่าง'}
                {regionValue === 4 && 'ภาค 4: จังหวัดในภาคอีสานตอนบน'}
                {regionValue === 5 && 'ภาค 5: จังหวัดในภาคเหนือ'}
                {regionValue === 6 && 'ภาค 6: จังหวัดในภาคกลางตอนบน'}
                {regionValue === 7 && 'ภาค 7: จังหวัดในภาคตะวันตก'}
                {regionValue === 8 && 'ภาค 8: จังหวัดในภาคใต้ตอนบน'}
                {regionValue === 9 && 'ภาค 9: จังหวัดในภาคใต้ตอนล่าง'}
              </div>
            )}
          </div>

          <div
            className={`status-badge ${
              isCheckedIn ? 'checked-in' : 'not-checked-in'
            }`}
          >
            สถานะลงทะเบียน: {isCheckedIn ? 'ลงทะเบียนแล้ว' : 'ยังไม่ลงทะเบียน'}
          </div>

          {checkedInAt && (
            <p>
              เวลาลงทะเบียน:{' '}
              <strong>
                {new Date(checkedInAt).toLocaleString('th-TH', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </strong>
            </p>
          )}

        </section>

        {/* บล็อกลงทะเบียนอย่างเดียว ไม่มีอัปโหลดสลิป */}
        <section className="form-section">
          <h3>ลงทะเบียนเข้าร่วมงาน</h3>
          <p className="form-description">
            ตรวจสอบข้อมูลด้านบนให้ถูกต้อง แล้วกดปุ่มด้านล่างเพื่อลงทะเบียนเข้าร่วมงาน
          </p>
          <p className="form-description">รอบที่เปิดอยู่: {openRoundLabel}</p>
          {checkinDisabledReason && (
            <p className="message error">{checkinDisabledReason}</p>
          )}
          {checkinStatusError && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={loadCheckinStatus}
              disabled={isRefreshingStatus}
            >
              {isRefreshingStatus ? 'กำลังตรวจสอบ…' : 'ลองใหม่'}
            </button>
          )}

          <button
            type="button"
            className={`btn ${checkedInForOpenRound ? 'btn-secondary' : 'btn-success'}`}
            onClick={handleCheckin}
            disabled={isBusy || !canCheckin}
          >
            {isCheckingIn
              ? 'กำลังลงทะเบียน…'
              : checkedInForOpenRound
              ? 'ลงทะเบียนรอบนี้แล้ว'
              : checkinRoundOpen > 0
              ? `ลงทะเบียน (${openRoundLabel})`
              : 'ลงทะเบียนเข้าร่วมงาน'}
          </button>

          {checkinMessage && <p className="message success">{checkinMessage}</p>}
          {checkinError && <p className="message error">{checkinError}</p>}
        </section>
      </div>
    </main>
  );
}
