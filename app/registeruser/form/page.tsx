// app/registeruser/form/page.tsx
import { Suspense } from 'react';
import RegisterUserFormClient from './RegisterUserFormClient';
import { requireStaffForPage } from '@/lib/requireStaffForPage';

export const dynamic = 'force-dynamic';

export default async function RegisterUserFormPage() {
  await requireStaffForPage({ redirectTo: '/login', requireRegistration: false });
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>กำลังโหลดฟอร์ม...</div>}>
      <RegisterUserFormClient />
    </Suspense>
  );
}
