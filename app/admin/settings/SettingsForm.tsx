'use client';

import { useState } from 'react';

type Props = {
  eventId: string;
  eventName: string | null;
  initialRegistrationOpen: boolean;
  initialCheckinOpen: boolean;
};

type ApiResponse =
  | { ok: true; event: { registration_open: boolean | null; checkin_open: boolean | null } }
  | { ok: false; error?: string };

export default function SettingsForm({
  eventId,
  eventName,
  initialRegistrationOpen,
  initialCheckinOpen,
}: Props) {
  const [registrationOpen, setRegistrationOpen] = useState(initialRegistrationOpen);
  const [checkinOpen, setCheckinOpen] = useState(initialCheckinOpen);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventLabel = eventName ?? eventId;

  const updateSettings = async (payload: {
    registrationOpen?: boolean;
    checkinOpen?: boolean;
  }) => {
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch('/api/admin/event-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, ...payload }),
      });

      const data = (await res.json().catch(() => null)) as ApiResponse | null;

      if (!res.ok || !data || !data.ok) {
        const msg = data && 'error' in data && data.error ? data.error : 'บันทึกไม่สำเร็จ';
        setError(msg);
        return;
      }

      const nextRegistrationOpen = data.event.registration_open !== false;
      const nextCheckinOpen = data.event.checkin_open !== false;

      setRegistrationOpen(nextRegistrationOpen);
      setCheckinOpen(nextCheckinOpen);
      setMessage('บันทึกแล้ว');
    } catch (err: any) {
      setError(err?.message ?? 'บันทึกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-form__section admin-settings">
      <div className="admin-settings__header">
        <div>
          <h2 className="admin-form__title">ควบคุมการเข้าถึง</h2>
          <p className="admin-settings__event">
            งาน: <span>{eventLabel}</span>
          </p>
        </div>
      </div>

      <div className="admin-settings__grid">
        <div className="admin-settings__card" data-open={registrationOpen ? 'true' : 'false'}>
          <div className="admin-settings__row">
            <div className="admin-settings__info">
              <p className="admin-settings__label">การลงทะเบียน</p>
              <p className="admin-settings__hint">เปิด/ปิดการรับลงทะเบียนจากหน้าเว็บ</p>
            </div>
            <div className="admin-settings__status">
              <span
                className={
                  'admin-settings__badge ' +
                  (registrationOpen ? 'is-open' : 'is-closed')
                }
              >
                {registrationOpen ? 'เปิดอยู่' : 'ปิดอยู่'}
              </span>
              <button
                type="button"
                className="admin-form__button admin-form__button--primary admin-settings__button"
                onClick={() => updateSettings({ registrationOpen: !registrationOpen })}
                disabled={busy}
              >
                {busy
                  ? 'กำลังบันทึก...'
                  : registrationOpen
                  ? 'ปิดการลงทะเบียน'
                  : 'เปิดการลงทะเบียน'}
              </button>
            </div>
          </div>
        </div>

        <div className="admin-settings__card" data-open={checkinOpen ? 'true' : 'false'}>
          <div className="admin-settings__row">
            <div className="admin-settings__info">
              <p className="admin-settings__label">การเช็คอิน</p>
              <p className="admin-settings__hint">เปิด/ปิดการเช็คอินหน้างาน</p>
            </div>
            <div className="admin-settings__status">
              <span
                className={
                  'admin-settings__badge ' +
                  (checkinOpen ? 'is-open' : 'is-closed')
                }
              >
                {checkinOpen ? 'เปิดอยู่' : 'ปิดอยู่'}
              </span>
              <button
                type="button"
                className="admin-form__button admin-form__button--primary admin-settings__button"
                onClick={() => updateSettings({ checkinOpen: !checkinOpen })}
                disabled={busy}
              >
                {busy
                  ? 'กำลังบันทึก...'
                  : checkinOpen
                  ? 'ปิดการเช็คอิน'
                  : 'เปิดการเช็คอิน'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <p className="admin-settings__message admin-settings__message--error">{error}</p>
      )}
      {message && (
        <p className="admin-settings__message admin-settings__message--success">{message}</p>
      )}
    </section>
  );
}
