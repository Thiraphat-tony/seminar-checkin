import { requireStaffForPage } from '@/lib/requireStaffForPage';
import ProfileFormClient from './ProfileFormClient';
import './profile.css';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const { user, staff } = await requireStaffForPage({ redirectTo: '/login' });

  return (
    <div className="profile-page">
      <div className="profile-card">
        <h1 className="profile-title">โปรไฟล์ผู้ใช้งาน</h1>

        <div className="profile-meta">
          <div><strong>อีเมล:</strong> {user?.email ?? '-'}</div>
        </div>

        <ProfileFormClient
          initialProvince={staff?.province_name ?? ''}
        />
      </div>
    </div>
  );
}
