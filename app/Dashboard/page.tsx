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

    const fetchSummary = async () => {
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
        if (isMounted) setLoading(false);
      }
    };

    fetchSummary();
    const interval = setInterval(fetchSummary, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // ---- คำนวณตัวเลขสรุป ----
  const total = summary?.total ?? 0;
  const totalChecked = summary?.checked ?? 0;
  const totalWithSlip = summary?.slip ?? 0;
  const totalNotChecked = summary?.notChecked ?? 0;

  // รายชื่อที่ยังไม่เช็กอิน (แค่ 5 คนล่าสุด)
  const latestNotChecked = useMemo(
    () => summary?.latestNotChecked ?? [],
    [summary]
  );

  // สำหรับกราฟแท่งแนวตั้ง (4 สถานะ)
  const maxCount = useMemo(
    () =>
      Math.max(
        total,
        totalChecked,
        totalNotChecked,
        totalWithSlip,
        1 // กัน 0
      ),
    [total, totalChecked, totalNotChecked, totalWithSlip]
  );

  const barHeight = (value: number) =>
    `${(value / maxCount) * 100 || 0}%`;

  const checkedPercent =
    total === 0 ? 0 : Math.round((totalChecked / total) * 100);

  // style สำหรับวงกลม (หมุน conic-gradient ตามเปอร์เซ็นต์เช็กอิน)
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
              ภาพรวมการลงทะเบียนและเช็กอินงานสัมมนา
            </h1>
            <p className="dashboard-header__subtitle">
              หน้านี้ใช้สำหรับดูข้อมูลภาพรวมแบบเรียลไทม์
              ข้อมูลจะอัปเดตอัตโนมัติเมื่อมีการลงทะเบียน / แนบสลิป / เช็กอินใหม่
            </p>
          </div>
        </header>

        {/* แถวบน: วงกลมใหญ่ + การ์ดสรุปสั้น ๆ */}
        <section className="dashboard-top">
          {/* วงกลมเปอร์เซ็นต์เช็กอิน */}
          <div className="dashboard-circle-card">
            <div className="dashboard-circle-card__header">
              <p className="dashboard-circle-card__badge">LIVE STATUS</p>
              <h2 className="dashboard-circle-card__title">
                ภาพรวมการเช็กอินหน้างาน
              </h2>
              <p className="dashboard-circle-card__subtitle">
                วงกลมแสดงสัดส่วนผู้ที่เช็กอินแล้วจากจำนวนผู้ลงทะเบียนทั้งหมด
              </p>
            </div>

            <div className="dashboard-circle-card__content">
              <div className="dashboard-circle" style={circleStyle}>
                <div className="dashboard-circle__inner">
                  <span className="dashboard-circle__percent">
                    {checkedPercent}%
                  </span>
                  <span className="dashboard-circle__label">เช็กอินแล้ว</span>
                  <span className="dashboard-circle__count">
                    {totalChecked} / {total} คน
                  </span>
                </div>
              </div>

              <div className="dashboard-circle-card__stats">
                <div className="dashboard-circle-card__stat">
                  <span className="dashboard-circle-card__stat-label">
                    แนบสลิปแล้ว
                  </span>
                  <span className="dashboard-circle-card__stat-value">
                    {totalWithSlip}
                  </span>
                </div>
                <div className="dashboard-circle-card__stat">
                  <span className="dashboard-circle-card__stat-label">
                    ยังไม่เช็กอิน
                  </span>
                  <span className="dashboard-circle-card__stat-value dashboard-circle-card__stat-value--warning">
                    {totalNotChecked}
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
              <p className="dashboard-summary__label">เช็กอินแล้ว</p>
              <p className="dashboard-summary__value">{totalChecked}</p>
              <p className="dashboard-summary__hint">
                คิดเป็นประมาณ {checkedPercent}% ของผู้ลงทะเบียนทั้งหมด
              </p>
            </div>

            <div className="dashboard-summary__card dashboard-summary__card--amber">
              <p className="dashboard-summary__label">ยังไม่เช็กอิน</p>
              <p className="dashboard-summary__value">{totalNotChecked}</p>
              <p className="dashboard-summary__hint">
                ใช้สำหรับติดตามผู้ที่ยังไม่ได้เข้าจุดลงทะเบียน
              </p>
            </div>
          </div>
        </section>

        {/* 2 คอลัมน์: รายชื่อยังไม่เช็กอิน + กราฟแท่งสถานะ 4 กลุ่ม */}
        <section className="dashboard-grid">
          {/* รายชื่อที่ยังไม่เช็กอิน (ตัวอย่าง 5 คนล่าสุด) */}
          <div className="dashboard-panel">
            <h2 className="dashboard-panel__title">รายชื่อที่ยังไม่เช็กอิน</h2>
            <p className="dashboard-panel__subtitle">
              แสดงตัวอย่าง 5 คนล่าสุดที่ยังไม่ได้เช็กอิน (หมุนรายการไปเรื่อย ๆ
              เมื่อมีข้อมูลใหม่)
            </p>

            {latestNotChecked.length === 0 ? (
              <p className="dashboard-panel__empty">
                ตอนนี้ผู้เข้าร่วมทุกคนเช็กอินแล้ว
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

          {/* กราฟแท่งแนวตั้ง 4 สถานะ */}
          <section className="dashboard-chart dashboard-chart--vertical">
            <div className="dashboard-chart__header">
              <h2 className="dashboard-chart__title">
                กราฟสถานะผู้เข้าร่วมงาน
              </h2>
              <p className="dashboard-chart__subtitle">
                เปรียบเทียบจำนวน ลงทะเบียน / แนบสลิป / เช็กอิน / ยังไม่เช็กอิน
                เหมาะกับการขึ้นจอโปรเจกเตอร์
              </p>
            </div>

            <div className="dashboard-chart__columns">
              {/* ลงทะเบียนทั้งหมด */}
              <div className="dashboard-chart__col">
                <div className="dashboard-chart__bar-shell">
                  <div
                    className="dashboard-chart__bar-vertical dashboard-chart__bar-vertical--total"
                    style={{ height: barHeight(total) }}
                  >
                    <span className="dashboard-chart__bar-count">
                      {total}
                    </span>
                  </div>
                </div>
                <p className="dashboard-chart__col-label">ลงทะเบียนทั้งหมด</p>
              </div>

              {/* แนบสลิปแล้ว */}
              <div className="dashboard-chart__col">
                <div className="dashboard-chart__bar-shell">
                  <div
                    className="dashboard-chart__bar-vertical dashboard-chart__bar-vertical--slip"
                    style={{ height: barHeight(totalWithSlip) }}
                  >
                    <span className="dashboard-chart__bar-count">
                      {totalWithSlip}
                    </span>
                  </div>
                </div>
                <p className="dashboard-chart__col-label">แนบสลิปแล้ว</p>
              </div>

              {/* เช็กอินแล้ว */}
              <div className="dashboard-chart__col">
                <div className="dashboard-chart__bar-shell">
                  <div
                    className="dashboard-chart__bar-vertical dashboard-chart__bar-vertical--checked"
                    style={{ height: barHeight(totalChecked) }}
                  >
                    <span className="dashboard-chart__bar-count">
                      {totalChecked}
                    </span>
                  </div>
                </div>
                <p className="dashboard-chart__col-label">เช็กอินแล้ว</p>
              </div>

              {/* ยังไม่เช็กอิน */}
              <div className="dashboard-chart__col">
                <div className="dashboard-chart__bar-shell">
                  <div
                    className="dashboard-chart__bar-vertical dashboard-chart__bar-vertical--pending"
                    style={{ height: barHeight(totalNotChecked) }}
                  >
                    <span className="dashboard-chart__bar-count">
                      {totalNotChecked}
                    </span>
                  </div>
                </div>
                <p className="dashboard-chart__col-label">ยังไม่เช็กอิน</p>
              </div>
            </div>

            <div className="dashboard-chart__legend">
              <div className="dashboard-chart__legend-item">
                <span className="dashboard-chart__legend-dot dashboard-chart__legend-dot--total" />
                <span>ลงทะเบียนทั้งหมด</span>
              </div>
              <div className="dashboard-chart__legend-item">
                <span className="dashboard-chart__legend-dot dashboard-chart__legend-dot--slip" />
                <span>แนบสลิปแล้ว</span>
              </div>
              <div className="dashboard-chart__legend-item">
                <span className="dashboard-chart__legend-dot dashboard-chart__legend-dot--checked" />
                <span>เช็กอินแล้ว (≈ {checkedPercent}% ของทั้งหมด)</span>
              </div>
              <div className="dashboard-chart__legend-item">
                <span className="dashboard-chart__legend-dot dashboard-chart__legend-dot--pending" />
                <span>ยังไม่เช็กอิน</span>
              </div>
            </div>
          </section>
        </section>

        {/* หมายเหตุ / วิธีอ่านสำหรับเจ้าหน้าที่ */}
        <section className="dashboard-note">
          <h2 className="dashboard-note__title">คำอธิบายการใช้งาน</h2>
          <ul className="dashboard-note__list">
            <li>ตัวเลขด้านบนเป็นภาพรวมทั้งหมดในระบบ อัปเดตอัตโนมัติแบบเรียลไทม์</li>
            <li>กล่องซ้ายแสดงรายชื่อผู้ที่ยังไม่เช็กอิน (ตัวอย่าง 5 คนล่าสุด)</li>
            <li>
              วงกลมตรงกลางใช้ดูเปอร์เซ็นต์เช็กอินเทียบกับจำนวนลงทะเบียนทั้งหมดได้ในพริบตา
            </li>
            <li>
              กราฟด้านขวาช่วยให้เห็นสัดส่วน ลงทะเบียน / แนบสลิป / เช็กอิน / ยังไม่เช็กอิน
              ในมุมมองเดียว เหมาะกับการแสดงบนโปรเจกเตอร์
            </li>
            <li>หน้านี้เป็นแบบอ่านอย่างเดียว การแก้ไขข้อมูลทำได้ที่หน้า Admin เท่านั้น</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
