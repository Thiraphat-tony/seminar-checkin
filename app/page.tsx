import { requireStaffForPage } from '@/lib/requireStaffForPage';
import HomePageClient from './HomePageClient';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  await requireStaffForPage({ redirectTo: '/login' });
  return <HomePageClient />;
}
