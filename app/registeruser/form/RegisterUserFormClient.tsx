// app/registeruser/form/RegisterUserFormClient.tsx
'use client';

import './registeruser-form.css';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type FoodType = 'normal' | 'vegetarian' | 'halal';
type PositionType = 'chief_judge' | 'associate_judge';

type Participant = {
  fullName: string;
  position: PositionType;
  phone: string;
  foodType: FoodType;
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
  participants?: Participant[];
};

const STORAGE_KEY = 'registeruser:state';
const DRAFT_KEY = 'registeruser:draft';
const PARTICIPANTS_KEY = 'registeruser:participants';

function makeEmptyParticipant(): Participant {
  return { fullName: '', position: 'associate_judge', phone: '', foodType: 'normal' };
}

function clampCount(n: number) {
  if (!Number.isFinite(n)) return 1;
  const int = Math.floor(n);
  return Math.max(1, Math.min(500, int));
}

export default function RegisterUserFormClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const count = useMemo(() => {
    const raw = searchParams.get('count');
    return clampCount(Number(raw ?? '1'));
  }, [searchParams]);

  const [state, setState] = useState<SavedState | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // ใช้ sessionStorage ได้เฉพาะ client
    if (typeof window === 'undefined') return;

    const raw = sessionStorage.getItem(DRAFT_KEY) || sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setState(null);
      setParticipants([]);
      return;
    }

    try {
      const s = JSON.parse(raw) as SavedState;
      setState(s);

      const pRaw = sessionStorage.getItem(PARTICIPANTS_KEY);
      if (pRaw) {
        const p = JSON.parse(pRaw) as Participant[];
        if (Array.isArray(p) && p.length > 0) {
          setParticipants(p);
          return;
        }
      }

      if (Array.isArray(s.participants) && s.participants.length > 0) {
        setParticipants(s.participants);
      }
    } catch {
      setState(null);
      setParticipants([]);
    }
  }, []);

  useEffect(() => {
    setParticipants((prev) => {
      const fromState = state?.participants;
      const base = Array.isArray(fromState) && fromState.length > 0 ? fromState : prev;

      if (base.length === 0) {
        return Array.from({ length: count }, () => makeEmptyParticipant());
      }
      if (base.length < count) {
        const copy = [...base];
        while (copy.length < count) copy.push(makeEmptyParticipant());
        return copy;
      }
      if (base.length > count) return base.slice(0, count);
      return base;
    });
  }, [count, state]);

  function persistBack(nextParticipants: Participant[]) {
    if (!state) return;

    const next: SavedState = {
      ...state,
      count,
      participants: nextParticipants,
      completed: state.completed ?? false,
    };

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    sessionStorage.setItem(PARTICIPANTS_KEY, JSON.stringify(nextParticipants));
  }

  function handleParticipantChange(index: number, field: keyof Participant, value: string) {
    setParticipants((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value } as Participant;

      queueMicrotask(() => persistBack(copy));
      return copy;
    });
  }

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!state) {
      setErrorMessage('ไม่พบข้อมูลหน้าก่อนหน้า กรุณากลับไปที่ /registeruser');
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

    // validate participant phones (if entered)
    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      if (p.phone && p.phone.trim()) {
        const { normalizePhone, isValidPhone } = await import('@/lib/phone');
        const n = normalizePhone(p.phone);
        if (!isValidPhone(n)) {
          setErrorMessage(`เบอร์โทรของผู้เข้าร่วมคนที่ ${i + 1} ต้องเป็นตัวเลข 10 หลัก`);
          return;
        }
      }
    }

    try {
      setSubmitting(true);
      persistBack(participants);
      setSuccessMessage('บันทึกข้อมูลผู้เข้าร่วมแล้ว');
      router.replace('/registeruser');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="registeruser-page">
      <div className="registeruser-card">
        <header className="registeruser-header">
          <h1>กรอกข้อมูลผู้เข้าร่วม</h1>
          {state ? (
            <p>
              {state.organization} • {state.province}
            </p>
          ) : (
            <p>ไม่พบข้อมูลหน้าก่อนหน้า</p>
          )}
        </header>

        <div className="registeruser-actions">
          <button
            type="button"
            className="registeruser-button"
            onClick={() => router.push('/registeruser')}
            disabled={submitting}
          >
            กลับไปหน้า /registeruser
          </button>
        </div>

        <form className="registeruser-form" onSubmit={handleSave}>
          <section className="registeruser-section">
            <div className="participants-head">
              <h2 className="participants-total">
                ผู้เข้าร่วมทั้งหมด: {participants.length} คน
              </h2>
            </div>

            {participants.map((p, idx) => (
              <div key={idx} className="participant-row">
                <div className="participant-left">ผู้เข้าร่วมคนที่ {idx + 1}</div>

                <input
                  type="text"
                  className="participant-input name"
                  value={p.fullName}
                  onChange={(e) => handleParticipantChange(idx, 'fullName', e.target.value)}
                  placeholder="ชื่อ-สกุล"
                  required={idx === 0}
                />

                <select
                  className="participant-select position"
                  value={p.position}
                  onChange={(e) => handleParticipantChange(idx, 'position', e.target.value)}
                >
                  <option value="chief_judge">ผู้พิพากษาหัวหน้าศาลฯ</option>
                  <option value="associate_judge">ผู้พิพากษาสมทบ</option>
                </select>

                <input
                  type="tel"
                  className="participant-input phone"
                  value={p.phone}
                  onChange={(e) => handleParticipantChange(idx, 'phone', e.target.value)}
                  placeholder="เบอร์โทร (ถ้ามี)"
                />

                <select
                  className="participant-select food"
                  value={p.foodType}
                  onChange={(e) => handleParticipantChange(idx, 'foodType', e.target.value)}
                >
                  <option value="normal">ปกติ</option>
                  <option value="vegetarian">มังสวิรัติ</option>
                  <option value="halal">ฮาลาล</option>
                </select>
              </div>
            ))}
          </section>

          {successMessage && <p className="registeruser-note">{successMessage}</p>}
          {errorMessage && <p className="registeruser-error">{errorMessage}</p>}

          <div className="registeruser-actions">
            <button type="submit" className="registeruser-button" disabled={submitting}>
              {submitting ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
