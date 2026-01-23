import ManagerForm from './ManagerForm';
import { requireStaffForPage } from '@/lib/requireStaffForPage';

export const dynamic = 'force-dynamic';

export default async function ManagerPage() {
  await requireStaffForPage({ redirectTo: '/login' });
  return <ManagerForm />;
}
