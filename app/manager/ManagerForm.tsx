'use client';

import { useEffect, useState } from 'react';

type SetPasswordResponse =
  | { ok: true }
  | { ok: false; error?: string };

type CourtOption = {
  id: string;
  court_name: string;
  max_staff: number | null;
};

function courtIdToEmail(courtId: string) {
  return `${courtId}@staff.local`;
}

export default function ManagerForm() {
  /* const provinces = [
    'กรุงเทพมหานคร',
    'กระบี่',
    'กาญจนบุรี',
    'กาฬสินธุ์',
    'กำแพงเพชร',
    'ขอนแก่น',
    'จันทบุรี',
    'ฉะเชิงเทรา',
    'ชลบุรี',
    'ชัยนาท',
    'ชัยภูมิ',
    'ชุมพร',
    'เชียงราย',
    'เชียงใหม่',
    'ตรัง',
    'ตราด',
    'ตาก',
    'นครนายก',
    'นครปฐม',
    'นครพนม',
    'นครราชสีมา',
    'นครศรีธรรมราช',
    'นครสวรรค์',
    'นนทบุรี',
    'นราธิวาส',
    'น่าน',
    'บึงกาฬ',
    'บุรีรัมย์',
    'ปทุมธานี',
    'ประจวบคีรีขันธ์',
    'ปราจีนบุรี',
    'ปัตตานี',
    'พระนครศรีอยุธยา',
    'พะเยา',
    'พังงา',
    'พัทลุง',
    'พิจิตร',
    'พิษณุโลก',
    'เพชรบุรี',
    'เพชรบูรณ์',
    'แพร่',
    'ภูเก็ต',
    'มหาสารคาม',
    'มุกดาหาร',
    'แม่ฮ่องสอน',
    'ยโสธร',
    'ยะลา',
    'ร้อยเอ็ด',
    'ระนอง',
    'ระยอง',
    'ราชบุรี',
    'ลพบุรี',
    'ลำปาง',
    'ลำพูน',
    'เลย',
    'ศรีสะเกษ',
    'สกลนคร',
    'สงขลา',
    'สตูล',
    'สมุทรปราการ',
    'สมุทรสงคราม',
    'สมุทรสาคร',
    'สระแก้ว',
    'สระบุรี',
    'สิงห์บุรี',
    'สุโขทัย',
    'สุพรรณบุรี',
    'สุราษฎร์ธานี',
    'สุรินทร์',
    'หนองคาย',
    'หนองบัวลำภู',
    'อ่างทอง',
    'อำนาจเจริญ',
    'อุดรธานี',
    'อุตรดิตถ์',
    'อุทัยธานี',
    'อุบลราชธานี',
  ]; */

  const [passphrase, setPassphrase] = useState('');
  const [courtName, setCourtName] = useState('');
  const [courts, setCourts] = useState<CourtOption[]>([]);
  const [courtsLoading, setCourtsLoading] = useState(true);
  const [courtsError, setCourtsError] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
        if (active) {
          setCourtsError(err?.message || 'โหลดรายชื่อศาลไม่สำเร็จ');
        }
      } finally {
        if (active) setCourtsLoading(false);
      }
    };

    loadCourts();

    return () => {
      active = false;
    };
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');

    const trimmedPassphrase = passphrase.trim();
    if (!trimmedPassphrase) {
      setError('กรุณากรอกรหัสลับผู้สร้าง');
      setBusy(false);
      return;
    }

    const trimmedPassword = password.trim();
    if (!trimmedPassword || trimmedPassword.length < 6) {
      setError('รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร');
      setBusy(false);
      return;
    }

    if (courtsLoading) {
      setError('กำลังโหลดรายชื่อศาล กรุณาลองใหม่อีกครั้ง');
      setBusy(false);
      return;
    }
    if (courtsError) {
      setError(courtsError);
      setBusy(false);
      return;
    }

    const trimmedCourt = courtName.trim();
    if (!trimmedCourt) {
      setError('กรุณาเลือกจังหวัด');
      setBusy(false);
      return;
    }

    const selectedCourt = courts.find((court) => court.court_name === trimmedCourt);
    if (!selectedCourt) {
      setError('กรุณาเลือกศาลจากรายการ');
      setBusy(false);
      return;
    }

    try {
      const email = courtIdToEmail(selectedCourt.id);
      const res = await fetch('/api/manager/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passphrase: trimmedPassphrase,
          newPassword: trimmedPassword,
          email,
          courtId: selectedCourt.id,
        }),
      });
      const json = (await res.json().catch(() => null)) as SetPasswordResponse | null;
      if (!res.ok || !json || !json.ok) {
        const message = json && 'error' in json && json.error ? json.error : 'Reset failed.';
        setError(message);
        setBusy(false);
        return;
      }

      setPassword('');
      setCourtName('');
      setPassphrase('');
      setSuccess('ตั้งรหัสผ่านใหม่สำเร็จ');
    } catch (e: any) {
      setError(e?.message ?? 'ตั้งรหัสผ่านใหม่ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="manager-container">
      <form className="manager-form" onSubmit={handleReset}>
        <h2>เข้าถึงสำหรับผู้สร้าง</h2>
        <p className="manager-note">
          หน้านี้ซ่อนจากเมนูระบบ ใช้เฉพาะผู้สร้างสำหรับตั้งรหัสผ่านใหม่
        </p>

        <label htmlFor="passphrase">รหัสลับผู้สร้าง</label>
        <input
          id="passphrase"
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          autoComplete="off"
          required
        />

        <label htmlFor="courtName">ศาล</label>
        <input
          id="courtName"
          type="text"
          value={courtName}
          onChange={(e) => setCourtName(e.target.value)}
          list="court-list"
          placeholder="พิมพ์เพื่อค้นหา"
          required
        />
        <datalist id="court-list">
          {courts.map((court) => (
            <option key={court.id} value={court.court_name} />
          ))}
        </datalist>

        <label htmlFor="password">รหัสผ่านใหม่</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" disabled={busy}>
          {busy ? 'กำลังบันทึก...' : 'ตั้งรหัสผ่านใหม่'}
        </button>

        {error && <div className="manager-error">{error}</div>}
        {success && <div className="manager-success">{success}</div>}
      </form>

      <style jsx>{`
        .manager-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f5f6fa;
          padding: 24px;
        }
        .manager-form {
          background: #fff;
          padding: 2rem 2.5rem;
          border-radius: 12px;
          box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
          display: flex;
          flex-direction: column;
          gap: 1rem;
          width: 100%;
          max-width: 420px;
        }
        .manager-form h2 {
          margin-bottom: 0.25rem;
          text-align: center;
        }
        .manager-note {
          margin: 0;
          text-align: center;
          font-size: 0.92rem;
          color: #64748b;
        }
        .manager-form label {
          font-weight: 500;
        }
        .manager-form input {
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 1rem;
        }
        .manager-form button {
          background: #2563eb;
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 0.75rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        .manager-form button:disabled {
          background: #a5b4fc;
          cursor: not-allowed;
        }
        .manager-error {
          color: #dc2626;
          background: #fee2e2;
          padding: 0.5rem;
          border-radius: 6px;
          text-align: center;
        }
        .manager-success {
          color: #166534;
          background: #dcfce7;
          padding: 0.5rem;
          border-radius: 6px;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
