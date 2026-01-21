import { requireStaffForPage } from '@/lib/requireStaffForPage';
import ProfileFormClient from './ProfileFormClient';
import './profile.css';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const { user, staff, supabase } = await requireStaffForPage({ redirectTo: '/login' });

  const { data: court } = await supabase
    .from('courts')
    .select('court_name')
    .eq('id', staff.court_id)
    .maybeSingle();
  const courtName = court?.court_name ?? '';

  return (
    <div className="profile-page">
      <div className="profile-card">
        <h1 className="profile-title">โปรไฟล์ผู้ใช้งาน</h1>

        <div className="profile-meta">
          <div><strong>อีเมล:</strong> {user?.email ?? '-'}</div>
        </div>

        <ProfileFormClient
          initialCourtName={courtName}
        />
      </div>
    </div>
  );
}
