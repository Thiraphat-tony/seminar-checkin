// app/components/Navbar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './Navbar.css';

const navLinks = [
  { href: '/', label: 'หน้าแรก', icon: '🏠' },
  { href: '/admin', label: 'จัดการผู้เข้างาน', icon: '👥' },
  { href: '/Dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/admin/namecards', label: 'Namecard', icon: '🏷️' },
  { href: '/register', label: 'ลงทะเบียน', icon: '✍️' },
];

export default function Navbar() {
  const pathname = usePathname();

  // ตรวจสอบว่าลิงก์ไหน active
  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="navbar">
      <div className="navbar__container">
        <div className="navbar__brand">
          <Link href="/">
            <span className="navbar__logo">📝 Seminar Check-in</span>
          </Link>
        </div>

        <ul className="navbar__menu">
          {navLinks.map((link) => (
            <li key={link.href} className="navbar__item">
              <Link
                href={link.href}
                className={`navbar__link ${isActive(link.href) ? 'navbar__link--active' : ''}`}
              >
                <span className="navbar__link-icon">{link.icon}</span>
                <span className="navbar__link-label">{link.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
