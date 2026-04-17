import { requireStaffForPage } from '@/lib/requireStaffForPage';
import CoordinatorEditClient from './CoordinatorEditClient';

export const dynamic = 'force-dynamic';

export default async function CoordinatorEditPage() {
  await requireStaffForPage({ redirectTo: '/login' });

  return <CoordinatorEditClient />;
}
