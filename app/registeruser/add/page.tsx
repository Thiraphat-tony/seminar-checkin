// app/registeruser/add/page.tsx
import { requireStaffForPage } from '@/lib/requireStaffForPage';
import AddParticipantPageClient from './AddParticipantPageClient';

export const dynamic = 'force-dynamic';

export default async function AddParticipantPage() {
  await requireStaffForPage({ redirectTo: '/login', requireRegistration: false });
  return <AddParticipantPageClient />;
}
