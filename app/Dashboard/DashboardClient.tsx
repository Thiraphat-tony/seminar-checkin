// app/Dashboard/page.tsx
'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { maskPhone } from '@/lib/maskPhone';
import './Dashboard.css';

export const dynamic = 'force-dynamic';

type AttendeeRow = {
  id: string;
  name_prefix: string | null;
  full_name: string | null;
  phone: string | null;
  organization: string | null;
};

type DashboardSummary = {
  total: number;
  checked: number;
  notChecked: number;
  slip: number;
  round1: number;
  round2: number;
  round3: number;
  latestNotChecked: AttendeeRow[];
};

type DashboardSummaryResponse =
  | { ok: true; data: DashboardSummary }
  | { ok: false; message: string };

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- ดึงข้อมูล + รีเฟรชอัตโนมัติ ----
  useEffect(() => {
    let isMounted = true;
    const inFlight = { current: false };
    const intervalRef = { current: null as ReturnType<typeof setInterval> | null };

    const fetchSummary = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const res = await fetch('/api/dashboard/summary', { cache: 'no-store' });
        const payload = (await res.json().catch(() => null)) as DashboardSummaryResponse | null;
        if (!res.ok || !payload || !payload.ok) {
          const message =
            payload && 'message' in payload && typeof payload.message === 'string'
              ? payload.message
              : 'โหลดข้อมูลไม่สำเร็จ';
          throw new Error(message);
        }
        if (!isMounted) return;
        setSummary(payload.data);
        setError(null);
      } catch (err: any) {
        if (!isMounted) return;
        setError(err?.message || 'โหลดข้อมูลไม่สำเร็จ');
      } finally {
        inFlight.current = false;
        if (isMounted) setLoading(false);
      }
    };

    const startPolling = () => {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') {
          void fetchSummary();
        }
      }, 10000);
    };

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        stopPolling();
      } else {
        void fetchSummary();
        startPolling();
      }
    };

    void fetchSummary();
    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isMounted = false;
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // ---- คำนวณตัวเลขสรุป ----
  const total = summary?.total ?? 0;
  const totalChecked = summary?.checked ?? 0;
  const totalWithSlip = summary?.slip ?? 0;
  const totalNotChecked = summary?.notChecked ?? 0;
  const totalRound1 = summary?.round1 ?? 0;
  const totalRound2 = summary?.round2 ?? 0;
  const totalRound3 = summary?.round3 ?? 0;

  // รายชื่อที่ยังไม่ลงทะเบียน (แค่ 5 คนล่าสุด)
  const latestNotChecked = useMemo(
    () => summary?.latestNotChecked ?? [],
    [summary]
  );

  // สำหรับกราฟแท่งแนวตั้ง (สรุปรายรอบ)
  const maxCount = useMemo(
    () =>
      Math.max(
        total,
        totalRound1,
        totalRound2,
        totalRound3,
        1 // กัน 0
      ),
    [total, totalRound1, totalRound2, totalRound3]
  );

  const barHeight = (value: number) =>
    `${(value / maxCount) * 100 || 0}%`;

  const checkedPercent =
    total === 0 ? 0 : Math.round((totalChecked / total) * 100);

  // style สำหรับวงกลม (หมุน conic-gradient ตามเปอร์เซ็นต์ลงทะเบียน)
  const circleStyle = {
    '--circle-deg': `${checkedPercent * 3.6}deg`,
  } as CSSProperties;

  // ---- Loading + Error state ----
  if (loading && !error) {
    return (
      <div className="page-wrap page-wrap--center">
        <div className="card">
          <div className="card__icon-badge card__icon-badge--error">
            <span>⏳</span>
          </div>
          <h1 className="card__title">กำลังโหลดข้อมูล Dashboard...</h1>
          <p className="card__subtitle">
            ระบบกำลังดึงข้อมูลผู้เข้าร่วมงานล่าสุด เพื่อแสดงผลแบบเรียลไทม์
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-wrap page-wrap--center">
        <div className="card">
          <div className="card__icon-badge card__icon-badge--error">
            <span>!</span>
          </div>
          <h1 className="card__title">ไม่สามารถโหลดข้อมูลได้</h1>
          <p className="card__subtitle">
            ระบบไม่สามารถดึงข้อมูลผู้เข้าร่วมสำหรับหน้า Dashboard ได้ในขณะนี้
          </p>
          <p className="card__debug">
            <code>{error}</code>
          </p>
        </div>
      </div>
    );
  }

  // ---- หน้าหลัก Dashboard ----
  return (
    <div className="page-wrap">
      <div className="page-gradient" />

      <main className="dashboard-layout">
        {/* หัว Dashboard */}
        <header className="dashboard-header">
          <div>
            <div className="dashboard-header__badge">DASHBOARD (READ ONLY)</div>
            <h1 className="dashboard-header__title">
              ภาพรวมการลงทะเบียนและลงทะเบียนงานสัมมนา
            </h1>
            <p className="dashboard-header__subtitle">
              หน้านี้ใช้สำหรับดูข้อมูลภาพรวมแบบเรียลไทม์
              ข้อมูลจะอัปเดตอัตโนมัติเมื่อมีการลงทะเบียน / แนบสลิป / ลงทะเบียนใหม่
            </p>
          </div>
        </header>

        {/* แถวบน: วงกลมใหญ่ + การ์ดสรุปสั้น ๆ */}
        <section className="dashboard-top">
          {/* วงกลมเปอร์เซ็นต์ลงทะเบียน */}
          <div className="dashboard-circle-card">
            <div className="dashboard-circle-card__header">
              <p className="dashboard-circle-card__badge">LIVE STATUS</p>
              <h2 className="dashboard-circle-card__title">
                ภาพรวมการลงทะเบียนหน้างาน
              </h2>
              <p className="dashboard-circle-card__subtitle">
                วงกลมแสดงสัดส่วนผู้ที่ลงทะเบียนแล้วจากจำนวนผู้ลงทะเบียนทั้งหมด
              </p>
            </div>

            <div className="dashboard-circle-card__content">
              <div className="dashboard-circle" style={circleStyle}>
                <div className="dashboard-circle__inner">
                  <span className="dashboard-circle__percent">
                    {checkedPercent}%
                  </span>
                  <span className="dashboard-circle__label">ลงทะเบียนแล้ว (อย่างน้อย 1 รอบ)</span>
                  <span className="dashboard-circle__count">
                    {totalChecked} / {total} คน
                  </span>
                </div>
              </div>

              <div className="dashboard-circle-card__stats">
                <div className="dashboard-circle-card__stat">
                  <span className="dashboard-circle-card__stat-label">
                    ลงทะเบียนรอบ 1
                  </span>
                  <span className="dashboard-circle-card__stat-value">
                    {totalRound1}
                  </span>
                </div>
                <div className="dashboard-circle-card__stat">
                  <span className="dashboard-circle-card__stat-label">
                    ลงทะเบียนรอบ 2
                  </span>
                  <span className="dashboard-circle-card__stat-value">
                    {totalRound2}
                  </span>
                </div>
                <div className="dashboard-circle-card__stat">
                  <span className="dashboard-circle-card__stat-label">
                    ลงทะเบียนรอบ 3
                  </span>
                  <span className="dashboard-circle-card__stat-value">
                    {totalRound3}
                  </span>
                </div>
                <div className="dashboard-circle-card__stat">
                  <span className="dashboard-circle-card__stat-label">
                    แนบสลิปแล้ว
                  </span>
                  <span className="dashboard-circle-card__stat-value">
                    {totalWithSlip}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* การ์ดตัวเลขสรุป 3 ใบ */}
          <div className="dashboard-summary dashboard-summary--stack">
            <div className="dashboard-summary__card">
              <p className="dashboard-summary__label">ผู้เข้าร่วมทั้งหมด</p>
              <p className="dashboard-summary__value">{total}</p>
              <p className="dashboard-summary__hint">
                จำนวนข้อมูลในระบบทุกสถานะ (อัปเดตอัตโนมัติ)
              </p>
            </div>

            <div className="dashboard-summary__card dashboard-summary__card--green">
              <p className="dashboard-summary__label">ลงทะเบียนแล้ว (อย่างน้อย 1 รอบ)</p>
              <p className="dashboard-summary__value">{totalChecked}</p>
              <p className="dashboard-summary__hint">
                คิดเป็นประมาณ {checkedPercent}% ของผู้ลงทะเบียนทั้งหมด
              </p>
            </div>

            <div className="dashboard-summary__card dashboard-summary__card--amber">
              <p className="dashboard-summary__label">ยังไม่ลงทะเบียนเข้างาน</p>
              <p className="dashboard-summary__value">{totalNotChecked}</p>
              <p className="dashboard-summary__hint">
                ใช้สำหรับติดตามผู้ที่ยังไม่ได้เข้าจุดลงทะเบียน
              </p>
            </div>
          </div>
        </section>

        {/* 2 คอลัมน์: รายชื่อยังไม่ลงทะเบียน + กราฟแท่งสถานะ 4 กลุ่ม */}
        <section className="dashboard-grid">
          {/* รายชื่อที่ยังไม่ลงทะเบียน (ตัวอย่าง 5 คนล่าสุด) */}
          <div className="dashboard-panel">
            <h2 className="dashboard-panel__title">รายชื่อที่ยังไม่ลงทะเบียน</h2>
            <p className="dashboard-panel__subtitle">
              แสดงตัวอย่าง 5 คนล่าสุดที่ยังไม่ได้ลงทะเบียน (หมุนรายการไปเรื่อย ๆ
              เมื่อมีข้อมูลใหม่)
            </p>

            {latestNotChecked.length === 0 ? (
              <p className="dashboard-panel__empty">
                ตอนนี้ผู้เข้าร่วมทุกคนลงทะเบียนแล้ว
              </p>
            ) : (
              <div className="dashboard-table__wrapper">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>ชื่อ - นามสกุล</th>
                      <th>หน่วยงาน</th>
                      <th>เบอร์โทร</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestNotChecked.map((a) => (
                      <tr key={a.id}>
                        <td>{`${a.name_prefix ? `${a.name_prefix} ` : ''}${a.full_name ?? ''}`.trim() || '-'}</td>
                        <td>{a.organization || '-'}</td>
                        <td>{maskPhone(a.phone)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* กราฟแท่งแนวตั้ง: สรุปการลงทะเบียนรายรอบ */}
          <section className="dashboard-chart dashboard-chart--vertical">
            <div className="dashboard-chart__header">
              <h2 className="dashboard-chart__title">
                กราฟสรุปการลงทะเบียนรายรอบ
              </h2>
              <p className="dashboard-chart__subtitle">
                เปรียบเทียบจำนวนผู้ลงทะเบียนรอบ 1 / รอบ 2 / รอบ 3
                เหมาะกับการขึ้นจอโปรเจกเตอร์และติดตามสถานะรายรอบ
              </p>
            </div>

            <div className="dashboard-chart__columns">
              {/* รอบ 1 */}
              <div className="dashboard-chart__col">
                <div className="dashboard-chart__bar-shell">
                  <div
                    className="dashboard-chart__bar-vertical dashboard-chart__bar-vertical--round1"
                    style={{ height: barHeight(totalRound1) }}
                  >
                    <span className="dashboard-chart__bar-count">
                      {totalRound1}
                    </span>
                  </div>
                </div>
                <p className="dashboard-chart__col-label">รอบ 1</p>
              </div>

              {/* รอบ 2 */}
              <div className="dashboard-chart__col">
                <div className="dashboard-chart__bar-shell">
                  <div
                    className="dashboard-chart__bar-vertical dashboard-chart__bar-vertical--round2"
                    style={{ height: barHeight(totalRound2) }}
                  >
                    <span className="dashboard-chart__bar-count">
                      {totalRound2}
                    </span>
                  </div>
                </div>
                <p className="dashboard-chart__col-label">รอบ 2</p>
              </div>

              {/* รอบ 3 */}
              <div className="dashboard-chart__col">
                <div className="dashboard-chart__bar-shell">
                  <div
                    className="dashboard-chart__bar-vertical dashboard-chart__bar-vertical--round3"
                    style={{ height: barHeight(totalRound3) }}
                  >
                    <span className="dashboard-chart__bar-count">
                      {totalRound3}
                    </span>
                  </div>
                </div>
                <p className="dashboard-chart__col-label">รอบ 3</p>
              </div>
            </div>

            <div className="dashboard-chart__legend">
              <div className="dashboard-chart__legend-item">
                <span className="dashboard-chart__legend-dot dashboard-chart__legend-dot--round1" />
                <span>รอบ 1</span>
              </div>
              <div className="dashboard-chart__legend-item">
                <span className="dashboard-chart__legend-dot dashboard-chart__legend-dot--round2" />
                <span>รอบ 2</span>
              </div>
              <div className="dashboard-chart__legend-item">
                <span className="dashboard-chart__legend-dot dashboard-chart__legend-dot--round3" />
                <span>รอบ 3</span>
              </div>
            </div>
          </section>
        </section>

        {/* หมายเหตุ / วิธีอ่านสำหรับเจ้าหน้าที่ */}
        <section className="dashboard-note">
          <h2 className="dashboard-note__title">คำอธิบายการใช้งาน</h2>
          <ul className="dashboard-note__list">
            <li>ตัวเลขด้านบนเป็นภาพรวมทั้งหมดในระบบ อัปเดตอัตโนมัติแบบเรียลไทม์</li>
            <li>กล่องซ้ายแสดงรายชื่อผู้ที่ยังไม่ลงทะเบียน (ตัวอย่าง 5 คนล่าสุด)</li>
            <li>
              วงกลมตรงกลางใช้ดูเปอร์เซ็นต์ลงทะเบียนเทียบกับจำนวนลงทะเบียนทั้งหมดได้ในพริบตา
            </li>
            <li>
              กราฟด้านขวาช่วยให้เห็นจำนวนลงทะเบียนรายรอบ (รอบ 1 / รอบ 2 / รอบ 3)
              ในมุมมองเดียว เหมาะกับการแสดงบนโปรเจกเตอร์
            </li>
            <li>หน้านี้เป็นแบบอ่านอย่างเดียว การแก้ไขข้อมูลทำได้ที่หน้า Admin เท่านั้น</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
