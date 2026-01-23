import { requireStaffForPage } from '@/lib/requireStaffForPage';
import RegisterUserPageClient from './RegisterUserPageClient';

export const dynamic = 'force-dynamic';

export default async function RegisterUserPage() {
  await requireStaffForPage({ redirectTo: '/login', requireRegistration: false });
  return <RegisterUserPageClient />;
}
