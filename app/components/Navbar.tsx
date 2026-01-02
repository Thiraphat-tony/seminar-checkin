// app/components/Navbar.tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { type SupabaseClient } from '@supabase/supabase-js';
import { getBrowserClient } from '@/lib/supabaseBrowser';
import { getProvinceNameFromKey } from '@/lib/provinceKeys';
import './Navbar.css';

const navLinks = [
  { href: '/', label: 'หน้าแรก', icon: '🏠' },
  { href: '/admin', label: 'จัดการผู้เข้างาน', icon: '👥' },
  { href: '/Dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/admin/namecards', label: 'Namecard', icon: '🏷️' },
  { href: '/registeruser', label: 'ลงทะเบียน', icon: '✍️' },
  { href: '/admin/hotel-summary', label: 'ตัวสรุปยอด', icon: '🧾' },
];

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getDisplayNameFromEmail(email?: string | null) {
  if (!email) return null;

  const localPart = (email.split('@')[0] ?? '').trim();

  // ✅ staff email (encode จังหวัดไว้)
  if (email.endsWith('@staff.local')) {
    // Prefer the canonical Thai province name when we can map it from the local part
    const fromKey = getProvinceNameFromKey(localPart);
    if (fromKey) return fromKey;

    const province = safeDecodeURIComponent(localPart).trim();
    return province || 'เจ้าหน้าที่';
  }

  // email ปกติ
  return localPart || 'User';
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = useMemo<SupabaseClient | null>(() => {
    try {
      return getBrowserClient();
    } catch {
      return null as any;
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const applySession = (session: any) => {
      const user = session?.user;
      if (user) {
        setIsLoggedIn(true);
        setUserName(getDisplayNameFromEmail(user.email));
      } else {
        setIsLoggedIn(false);
        setUserName(null);
      }
    };

    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      applySession(data?.session);
      setLoading(false);
    };

    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [supabase]);

  const handleLogout = async () => {
    if (!supabase) return;

    await supabase.auth.signOut();
    document.cookie = 'sb-access-token=; path=/; max-age=0';

    router.push('/login');
    router.refresh();
  };

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  // ✅ ถ้ายังไม่ล็อกอิน: โชว์เมนูแค่ /registeruser เท่านั้น
  const visibleLinks = isLoggedIn
    ? navLinks
    : navLinks.filter((l) => l.href === '/registeruser');

  return (
    <nav className="navbar">
      <div className="navbar__container">
        <div className="navbar__brand">
          <Link href="/">
            <span className="navbar__logo">📝 Seminar Check-in</span>
          </Link>
        </div>

        <ul className="navbar__menu">
          {visibleLinks.map((link) => (
            <li key={link.href} className="navbar__item">
              <Link
                href={link.href}
                className={`navbar__link ${isActive(link.href) ? 'navbar__link--active' : ''}`}
                aria-current={isActive(link.href) ? 'page' : undefined}
              >
                <span className="navbar__link-icon">{link.icon}</span>
                <span className="navbar__link-label">{link.label}</span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="navbar__auth">
          {!loading && (
            <>
              {isLoggedIn ? (
                <div className="navbar__user">
  <span className="navbar__username">👤 {userName}</span>

  <button onClick={handleLogout} className="navbar__logout-btn">
    ออกจากระบบ
  </button>

  <Link
    href="/profile"
    className="navbar__profile-btn"
    style={{
      marginRight: '10px',
      padding: '8px 16px',
      background: '#667eea',
      color: 'white',
      borderRadius: '6px',
      textDecoration: 'none',
    }}
  >
    โปรไฟล์
  </Link>
</div>

              ) : (
                <Link href="/login" className="navbar__login-btn">
                  🔐 เข้าสู่ระบบ
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
