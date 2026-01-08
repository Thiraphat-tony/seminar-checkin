// app/admin/AdminNav.tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
const links = [
  {
    href: '/admin',
    label: 'รายชื่อ & จัดการ',
  },
  {
    href: '/admin/settings',
    label: 'ตั้งค่าการเข้าถึง',
  },
  {
    href: '/Dashboard',
    label: 'Dashboard ภาพรวม',
  },
];
export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="admin-nav">
      <ul className="admin-nav__list">
        {links.map((link) => {
          let isActive = false;
          if (link.href === '/admin') {
            // ให้แท็บ "รายชื่อ & จัดการ" active ทั้งหน้า /admin และ /admin/attendee/[id]
            isActive =
              pathname === '/admin' ||
              pathname.startsWith('/admin/attendee');
          } else if (link.href === '/admin/settings') {
            isActive = pathname === '/admin/settings' || pathname.startsWith('/admin/settings/');
          } else if (link.href === '/Dashboard') {
            // Dashboard active ถ้าอยู่หน้า /Dashboard (เผื่ออนาคตมี /Dashboard/xxx)
            isActive = pathname === '/Dashboard' || pathname.startsWith('/Dashboard/');
          } else {
            isActive = pathname === link.href;
          }
          return (
            <li key={link.href} className="admin-nav__list-item">
              <Link
                href={link.href}
                className={
                  'admin-nav__item' +
                  (isActive ? ' admin-nav__item--active' : '')
                }
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
