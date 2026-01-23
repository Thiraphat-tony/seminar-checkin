import { requireStaffForPage } from '@/lib/requireStaffForPage';
import AttendeePageClient from './AttendeePageClient';

export const dynamic = 'force-dynamic';

export default async function AttendeePage() {
  await requireStaffForPage({ redirectTo: '/login' });
  return <AttendeePageClient />;
}
