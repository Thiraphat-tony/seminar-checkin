// app/components/Navbar.tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type SupabaseClient } from '@supabase/supabase-js';
import { getBrowserClient } from '@/lib/supabaseBrowser';
import {
  clearRegistrationStatusCache,
  readRegistrationStatusCache,
  writeRegistrationStatusCache,
} from '@/lib/registrationClientCache';
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
type SessionUser = { id: string; email?: string | null };
type SessionLike = { user: SessionUser | null } | null | undefined;
type RegistrationEventDetail = { hasRegistration?: boolean };
type StaffRow = {
  role: string | null;
  court_id: string | null;
  courts: CourtRelation;
};

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

  const supabase = useMemo<SupabaseClient | null>(() => {
    try {
      return getBrowserClient();
    } catch {
      return null;
    }
  }, []);
  const currentUserIdRef = useRef<string | null>(null);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [canManageEvent, setCanManageEvent] = useState(false);
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(() => supabase !== null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!supabase) return;

    let active = true;

    const applySession = async (session: SessionLike) => {
      const user = session?.user;
      if (!user?.id) {
        if (!active) return;
        currentUserIdRef.current = null;
        setIsLoggedIn(false);
        setUserName(null);
        setCanManageEvent(false);
        setIsRegistered(null);
        return;
      }

      if (!active) return;
      currentUserIdRef.current = user.id;
      setIsLoggedIn(true);
      setUserName(getDisplayNameFromEmail(user.email));
      setCanManageEvent(false);
      setIsRegistered(readRegistrationStatusCache(user.id));

      try {
        const { data: staff } = await supabase
          .from('staff_profiles')
          .select('role, court_id, is_active, courts(court_name)')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!active) return;
        const row = (staff ?? null) as StaffRow | null;
        if (row) {
          let courtName = getCourtNameFromRelation(row.courts ?? null);
          if (!courtName && row.court_id) {
            const { data: court } = await supabase
              .from('courts')
              .select('court_name')
              .eq('id', row.court_id)
              .maybeSingle();
            courtName = (court?.court_name ?? '').trim();
          }
          setUserName(courtName || getDisplayNameFromEmail(user.email));
          setCanManageEvent(row.role === 'super_admin');
        }
      } catch {
        // ignore; fallback to email display
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
    if (typeof window === 'undefined') return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<RegistrationEventDetail>).detail;
      if (typeof detail?.hasRegistration === 'boolean') {
        setIsRegistered(detail.hasRegistration);
        if (currentUserIdRef.current) {
          writeRegistrationStatusCache(currentUserIdRef.current, detail.hasRegistration);
        }
      }
    };
    window.addEventListener('registration:completed', handler);
    return () => window.removeEventListener('registration:completed', handler);
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = setTimeout(() => {
      setNotice(null);
    }, 4500);
  }, []);

  const handleLogout = async () => {
    if (!supabase) return;

    const currentUserId = currentUserIdRef.current;
    await supabase.auth.signOut();
    if (currentUserId) {
      clearRegistrationStatusCache(currentUserId);
    }
    currentUserIdRef.current = null;
    document.cookie = 'sb-access-token=; path=/; max-age=0';
    setMenuOpen(false);
    setIsRegistered(null);

    router.push('/login');
  };

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const dimOtherTabs = isLoggedIn && isRegistered === false;

  const handleNavClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      setMenuOpen(false);
      if (href === '/registeruser' && !isLoggedIn) {
        event.preventDefault();
        showNotice('กรุณาเข้าสู่ระบบหรือสมัครเจ้าหน้าที่ก่อนนะครับ');
        router.push('/login');
      }
    },
    [isLoggedIn, router, showNotice],
  );

  // ✅ ถ้ายังไม่ล็อกอิน: โชว์เมนูแค่ /registeruser เท่านั้น
  const visibleLinks = isLoggedIn
    ? (canManageEvent ? [...navLinks, ...suratLinks] : navLinks)
    : navLinks.filter((l) => l.href === '/registeruser');

  return (
    <nav className="navbar">
      {notice && (
        <div className="navbar__notice" role="status" aria-live="polite">
          <span className="navbar__notice-icon" aria-hidden="true">
            ⚠️
          </span>
          <span className="navbar__notice-text">{notice}</span>
          <button
            type="button"
            className="navbar__notice-close"
            onClick={() => setNotice(null)}
            aria-label="ปิดข้อความแจ้งเตือน"
          >
            ✕
          </button>
        </div>
      )}
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
                onClick={(event) => handleNavClick(event, link.href)}
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
  <span className="navbar__username">
    👤 {userName}
  </span>

  <button onClick={handleLogout} className="navbar__logout-btn">
    ออกจากระบบ
  </button>

  <Link
    href="/profile"
    onClick={() => setMenuOpen(false)}
    className="navbar__profile-btn"
    style={{
      padding: '6px 12px',
      background: '#667eea',
      color: 'white',
      borderRadius: '6px',
      textDecoration: 'none',
      fontSize: '0.85rem',
      fontWeight: 600,
    }}
  >
    โปรไฟล์
  </Link>
</div>

              ) : (
                <Link href="/login" className="navbar__login-btn" onClick={() => setMenuOpen(false)}>
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

