// app/registeruser/add/form/page.tsx
import { requireStaffForPage } from '@/lib/requireStaffForPage';
import AddParticipantFormClient from './AddParticipantFormClient';

export const dynamic = 'force-dynamic';

export default async function AddParticipantFormPage() {
  await requireStaffForPage({ redirectTo: '/login', requireRegistration: false });
  return <AddParticipantFormClient />;
}
