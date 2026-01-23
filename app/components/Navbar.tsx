// app/components/Navbar.tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { type SupabaseClient } from '@supabase/supabase-js';
import { getBrowserClient } from '@/lib/supabaseBrowser';
import './Navbar.css';

const navLinks = [
  { href: '/', label: 'หน้าแรก', icon: '🏠' },
  { href: '/admin', label: 'จัดการผู้เข้างาน', icon: '👥' },
  { href: '/Dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/admin/namecards', label: 'Namecard', icon: '🏷️' },
  { href: '/registeruser', label: 'ลงทะเบียน', icon: '✍️' },
  { href: '/admin/hotel-summary', label: 'ตัวสรุปยอด', icon: '🧾' },
];

const suratLinks = [
  { href: '/admin/settings', label: 'ปิด/เปิดลงทะเบียน-ลงทะเบียน', icon: '🛑' },
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

  // staff email (court id)
  if (email.endsWith('@staff.local')) {
    const decoded = safeDecodeURIComponent(localPart).trim();
    return decoded || 'เจ้าหน้าที่';
  }

  // email ปกติ
  return localPart || 'User';
}

type CourtRelation = { court_name: string | null } | { court_name: string | null }[] | null;

function getCourtNameFromRelation(courts: CourtRelation): string {
  if (!courts) return '';
  if (Array.isArray(courts)) {
    return (courts[0]?.court_name ?? '').trim();
  }
  if (typeof courts === 'object') {
    return String(courts.court_name ?? '').trim();
  }
  return '';
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [canManageEvent, setCanManageEvent] = useState(false);
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

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

    let active = true;

    const applySession = async (session: any) => {
      const user = session?.user;
      if (!user) {
        if (!active) return;
        setIsLoggedIn(false);
        setUserName(null);
        setCanManageEvent(false);
        setIsRegistered(null);
        return;
      }

      if (!active) return;
      setIsLoggedIn(true);
      setUserName(getDisplayNameFromEmail(user.email));
      setCanManageEvent(false);
      setIsRegistered(null);

      try {
        const { data: staff } = await supabase
          .from('staff_profiles')
          .select('role, court_id, is_active, courts(court_name)')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!active) return;
        if (staff) {
          let courtName = getCourtNameFromRelation(
            (staff as { courts: CourtRelation }).courts ?? null,
          );
          if (!courtName && staff.court_id) {
            const { data: court } = await supabase
              .from('courts')
              .select('court_name')
              .eq('id', staff.court_id)
              .maybeSingle();
            courtName = (court?.court_name ?? '').trim();
          }
          setUserName(courtName || getDisplayNameFromEmail(user.email));
          setCanManageEvent(staff.role === 'super_admin');
        }
      } catch {
        // ignore; fallback to email display
      }

      try {
        const res = await fetch('/api/registeruser', { method: 'GET', cache: 'no-store' });
        const payload = await res.json().catch(() => null);
        if (!active) return;
        if (res.ok && payload?.ok) {
          setIsRegistered(Boolean(payload.hasRegistration));
        }
      } catch {
        if (active) setIsRegistered(null);
      }
    };

    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      await applySession(data?.session);
      if (active) setLoading(false);
    };

    void checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session);
    });

    return () => {
      active = false;
      authListener?.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

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

  const dimOtherTabs = isLoggedIn && isRegistered === false;

  // ✅ ถ้ายังไม่ล็อกอิน: โชว์เมนูแค่ /registeruser เท่านั้น
  const visibleLinks = isLoggedIn
    ? (canManageEvent ? [...navLinks, ...suratLinks] : navLinks)
    : navLinks.filter((l) => l.href === '/registeruser');

  return (
    <nav className="navbar">
      <div className="navbar__container">
        <div className="navbar__brand">
          <Link href="/">
            <span className="navbar__logo">📝 Seminar Check-in</span>
          </Link>
        </div>

        <button
          type="button"
          className="navbar__toggle"
          aria-controls="navbar-menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          <span className="navbar__toggle-icon" aria-hidden="true">
            {menuOpen ? '✕' : '☰'}
          </span>
          <span className="navbar__sr-only">เปิดเมนู</span>
        </button>

        <ul id="navbar-menu" className={`navbar__menu ${menuOpen ? 'navbar__menu--open' : ''}`}>
          {visibleLinks.map((link) => (
            <li key={link.href} className="navbar__item">
              <Link
                href={link.href}
                className={`navbar__link ${isActive(link.href) ? 'navbar__link--active' : ''} ${
                  dimOtherTabs && link.href !== '/registeruser' ? 'navbar__link--dim' : ''
                }`}
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
