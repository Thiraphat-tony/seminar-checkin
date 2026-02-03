'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import './page.css';

const actions = [
  {
    title: '📊 แดชบอร์ดภาพรวม',
    description: 'สรุปสถิติและสถานะล่าสุด',
    href: '/Dashboard',
    icon: '📊',
    color: 'blue',
  },
  {
    title: '👥 จัดการผู้เข้างาน',
    description: 'ดู/ค้นหา แก้ไข ลงทะเบียน ยกเลิก',
    href: '/admin',
    icon: '👥',
    color: 'cyan',
  },
  {
    title: '📥 นำเข้าข้อมูล',
    description: 'อัปโหลดไฟล์ผู้เข้าร่วมและสลิป',
    href: '/admin',
    icon: '📥',
    color: 'purple',
  },
  {
    title: '🏷️ พิมพ์ Namecard',
    description: 'ส่งออกบัตรชื่อเป็น PDF',
    href: '/admin/namecards',
    icon: '🏷️',
    color: 'pink',
  },
  {
    title: '✍️ ลงทะเบียนใหม่',
    description: 'กรอกข้อมูลผู้เข้าร่วมด้วยตัวเอง',
    href: '/registeruser',
    icon: '✍️',
    color: 'green',
  },
  {
    title: '🎫 หน้าต้อนรับผู้เข้าร่วม',
    description: 'ลิงก์ดูรายละเอียด',
    href: '/attendee/sample-token/welcome',
    icon: '🎫',
    color: 'amber',
  },
];

export default function Home() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(media.matches);
    update();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  return (
    <div className="admin-home">
      {!reduceMotion && (
        <>
          <div className="stars"></div>
          <div className="glow glow-1"></div>
          <div className="glow glow-2"></div>
          <div className="glow glow-3"></div>
        </>
      )}

      {/* Navigation Header */}
      <header className="admin-header">
        <div className="header-content">
          <div className="header-top">
            <p className="header-badge">✨ Admin Control Center</p>
            <nav className="header-nav">
              <a href="/Dashboard">Dashboard</a>
              <a href="/admin">Management</a>
              <a href="/registeruser">Register-user</a>
            </nav>
          </div>
          <div>
            <h1 className="header-title">ศูนย์ควบคุมผู้ดูแลระบบ</h1>
            <p className="header-subtitle">
              เลือกเมนูที่ต้องการจัดการระบบงานสัมมนาได้ทันที 🚀
            </p>
          </div>
          <div className="header-badges">
            <span className="chip chip-1">🎯 เข้าถึงง่าย</span>
            <span className="chip chip-2">👴 รองรับผู้สูงอายุ</span>
            <span className="chip chip-3">🎁 ข้อมูลครบวงจร</span>
          </div>
        </div>
      </header>

      <div className="admin-container">

        {/* Main Actions Grid */}
        <section className="actions-section">
          <div className="actions-grid">
            {actions.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className={`action-card action-card--${item.color}`}
              >
                <div className="card-glow"></div>
                <div className="card-content">
                  <div className="card-icon">{item.icon}</div>
                  <h2 className="card-title">{item.title}</h2>
                  <p className="card-description">{item.description}</p>
                  <div className="card-footer">
                    <span className="card-arrow">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Info Panels */}
        <section className="info-section">
          <div className="info-grid">
            <div className="info-panel info-panel--shortcuts">
              <h3 className="panel-title">🔗 ทางลัดยอดนิยม</h3>
              <ul className="panel-list">
                <li>
                  <Link href="/admin">📍 จัดการผู้เข้างาน</Link>
                </li>
                <li>
                  <Link href="/admin/namecards">📍 ส่งออก Namecard</Link>
                </li>
                <li>
                  <Link href="/Dashboard">📍 ดูภาพรวมสถิติ</Link>
                </li>
              </ul>
            </div>

            <div className="info-panel info-panel--quick-steps">
              <h3 className="panel-title">📋 ขั้นตอนแนะนำ</h3>
              <ol className="panel-list">
                <li>📥 นำเข้ารายชื่อและสลิป</li>
                <li>✅ ตรวจสอบ/แก้ไขข้อมูล</li>
                <li>🎯 ลงทะเบียน ณ หน้างาน</li>
                <li>🖨️ พิมพ์ Namecard</li>
              </ol>
            </div>

            <div className="info-panel info-panel--attendees">
              <h3 className="panel-title">🎫 ลิงก์สำหรับผู้เข้าร่วม</h3>
              <p className="panel-text">ใช้โทเค็นจริงแทน <code>sample-token</code> เพื่อทดสอบ</p>
              <Link href="/attendee/sample-token/welcome" className="panel-cta">
                เปิดตัวอย่างหน้า Welcome
              </Link>
            </div>
          </div>
        </section>

        {/* Footer Stats */}
        <footer className="admin-footer">
          <div className="footer-content">
            <div className="stat">
              <span className="stat-icon">⚡</span>
              <span className="stat-text">ระบบทำงาน</span>
            </div>
            <div className="stat">
              <span className="stat-icon">🔒</span>
              <span className="stat-text">ปลอดภัย</span>
            </div>
            <div className="stat">
              <span className="stat-icon">🌐</span>
              <span className="stat-text">ทันสมัย</span>
            </div>
            <div className="stat">
              <span className="stat-icon">♿</span>
              <span className="stat-text">เข้าถึงได้</span>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© 2025 Seminar Check-in System. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
