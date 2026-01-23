import { requireStaffForPage } from '@/lib/requireStaffForPage';
import ManagerPageClient from './ManagerPageClient';

export const dynamic = 'force-dynamic';

export default async function ManagerPage() {
  await requireStaffForPage({ redirectTo: '/login' });
  return <ManagerPageClient />;
}
