// app/registeruser/add/AddParticipantPageClient.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import '../registeruser-page.css';

type Lang = 'th' | 'en';

const LANG_STORAGE_KEY = 'registeruser:lang';
const ADD_STORAGE_KEY = 'registeruser:add:count';

function clampCount(n: number) {
  if (!Number.isFinite(n)) return 1;
  const int = Math.floor(n);
  return Math.max(1, Math.min(500, int));
}

export default function AddParticipantPageClient() {
  const router = useRouter();

  const [lang, setLang] = useState<Lang>('th');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [existingCount, setExistingCount] = useState<number>(0);
  const [organization, setOrganization] = useState<string>('');
  const [province, setProvince] = useState<string>('');

  const [additionalCountInput, setAdditionalCountInput] = useState<string>('1');
  const [registrationClosed, setRegistrationClosed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LANG_STORAGE_KEY);
      if (stored === 'th' || stored === 'en') {
        setLang(stored);
      }
    } catch {
      // ignore
    }
  }, []);

  const setLanguage = (next: Lang) => {
    setLang(next);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  const t = (th: string, en: string) => (lang === 'en' ? en : th);

  useEffect(() => {
    let active = true;

    const checkRegistration = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch('/api/registeruser', { method: 'GET', cache: 'no-store' });

        if (!res.ok) {
          throw new Error('ไม่สามารถตรวจสอบสถานะการลงทะเบียนได้');
        }

        const data = await res.json();

        if (active) {
          if (data.registrationOpen === false) {
            setRegistrationClosed(true);
            return;
          }

          if (!data.hasRegistration) {
            setError(
              lang === 'en'
                ? 'You have not registered yet. Please go to the registration page first.'
                : 'ท่านยังไม่ได้ลงทะเบียน กรุณาไปหน้าลงทะเบียนก่อน'
            );
            setLoading(false);
            return;
          }

          // ดึงข้อมูลจำนวนคนที่ลงทะเบียนแล้ว
          const countRes = await fetch('/api/registeruser/count', { cache: 'no-store' });
          if (countRes.ok) {
            const countData = await countRes.json();
            if (countData.ok) {
              setExistingCount(countData.count || 0);
              setOrganization(countData.organization || '');
              setProvince(countData.province || '');
            }
          }

          setLoading(false);
        }
      } catch (err: any) {
        if (active) {
          setError(err?.message || (lang === 'en' ? 'An error occurred' : 'เกิดข้อผิดพลาด'));
          setLoading(false);
        }
      }
    };

    checkRegistration();

    return () => {
      active = false;
    };
  }, [lang]);

  function goToAddForm() {
    const count = clampCount(Number(additionalCountInput));
    setAdditionalCountInput(String(count));

    try {
      sessionStorage.setItem(ADD_STORAGE_KEY, String(count));
    } catch {
      // ignore
    }

    router.push(`/registeruser/add/form?count=${count}`);
  }

  if (registrationClosed) {
    return (
      <main className="registeruser-page registeruser-page--closed">
        <div className="registeruser-closed-card">
          <div className="registeruser-closed__code">REGISTRATION_CLOSED</div>
          <h1 className="registeruser-closed__title">
            {t('ระบบปิดการลงทะเบียน', 'Registration is closed')}
          </h1>
          <p className="registeruser-closed__subtitle">
            {t(
              'ขณะนี้ปิดรับลงทะเบียนแล้ว หากต้องการข้อมูลเพิ่มเติมโปรดติดต่อผู้ดูแลระบบ',
              'Registration is currently closed. For more information, please contact the administrator.',
            )}
          </p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="registeruser-page">
        <div className="registeruser-card">
          <p className="registeruser-help">
            {t('กำลังตรวจสอบข้อมูล...', 'Loading...')}
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="registeruser-page">
        <div className="registeruser-card">
          <p className="registeruser-error">{error}</p>
          <div className="registeruser-actions">
            <button
              type="button"
              className="registeruser-button"
              onClick={() => router.push('/registeruser')}
            >
              {t('ไปหน้าลงทะเบียน', 'Go to registration page')}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="registeruser-page">
      <div className="registeruser-card">
        <header className="registeruser-header">
          <div className="registeruser-header__top">
            <div className="registeruser-header__text">
              <h1>
                {t('เพิ่มผู้เข้าร่วมสัมมนา', 'Add participants')}
              </h1>
              <p>
                {organization} • {province}
              </p>
              <p className="registeruser-help registeruser-help--ok">
                {t(
                  `ลงทะเบียนไว้แล้ว ${existingCount} คน`,
                  `Already registered: ${existingCount} people`
                )}
              </p>
            </div>
            <div className="registeruser-lang">
              <span className="registeruser-lang__label">{t('ภาษา', 'Language')}</span>
              <div className="registeruser-lang__buttons" role="group" aria-label="Language toggle">
                <button
                  type="button"
                  className={`registeruser-lang__button ${lang === 'th' ? 'is-active' : ''}`}
                  aria-pressed={lang === 'th'}
                  onClick={() => setLanguage('th')}
                >
                  ไทย
                </button>
                <button
                  type="button"
                  className={`registeruser-lang__button ${lang === 'en' ? 'is-active' : ''}`}
                  aria-pressed={lang === 'en'}
                  onClick={() => setLanguage('en')}
                >
                  EN
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="registeruser-actions">
          <button
            type="button"
            className="registeruser-button"
            onClick={() => router.push('/registeruser')}
          >
            {t('← กลับหน้าลงทะเบียน', '← Back to registration')}
          </button>
        </div>

        <section className="registeruser-section">
          <h2 className="registeruser-section__title">
            {t('จำนวนผู้เข้าร่วมที่ต้องการเพิ่ม', 'Number of additional participants')}
          </h2>

          <div className="registeruser-field">
            <label className="registeruser-label">
              {t('จำนวนคนที่ต้องการเพิ่ม *', 'Number of people to add *')}
            </label>
            <input
              type="number"
              min={1}
              step={1}
              className="registeruser-input"
              value={additionalCountInput}
              onChange={(e) => setAdditionalCountInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  goToAddForm();
                }
              }}
              required
            />

            <p className="registeruser-help">
              {t(
                'ระบุจำนวนคนที่ต้องการเพิ่ม (1-500 คน)',
                'Specify the number of people to add (1-500 people)'
              )}
            </p>
          </div>

          <div className="registeruser-actions">
            <button
              type="button"
              className="registeruser-button"
              onClick={goToAddForm}
            >
              {t('ถัดไป: กรอกข้อมูลผู้เข้าร่วม', 'Next: Fill in participant details')}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
