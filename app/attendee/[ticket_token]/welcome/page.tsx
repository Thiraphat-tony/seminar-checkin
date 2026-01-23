import { requireStaffForPage } from '@/lib/requireStaffForPage';
import WelcomeClient from './WelcomeClient';

export const dynamic = 'force-dynamic';

export default async function AttendeeWelcomePage() {
  await requireStaffForPage({ redirectTo: '/login' });
  return <WelcomeClient />;
}
