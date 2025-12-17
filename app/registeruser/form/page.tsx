// app/registeruser/form/page.tsx
import { Suspense } from 'react';
import RegisterUserFormClient from './RegisterUserFormClient';

export const dynamic = 'force-dynamic';

export default function RegisterUserFormPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>กำลังโหลดฟอร์ม...</div>}>
      <RegisterUserFormClient />
    </Suspense>
  );
}
