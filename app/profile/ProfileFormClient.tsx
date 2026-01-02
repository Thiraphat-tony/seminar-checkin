'use client';

import { useState, useEffect } from 'react';
import { getBrowserClient } from '@/lib/supabaseBrowser';

type Props = {
  initialProvince: string;
};

export default function ProfileFormClient({ initialProvince }: Props) {
  const [province] = useState(initialProvince ?? '');

  // email (read-only)
  const [email, setEmail] = useState<string>('');

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMessage, setPwMessage] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    // load current user email
    let mounted = true;
    (async () => {
      try {
        const supabase = getBrowserClient();
        const { data } = await supabase.auth.getUser();
        if (!mounted) return;
        setEmail(data?.user?.email ?? '');
      } catch (e) {
        // ignore — leave email blank
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);



  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwLoading(true);
    setPwMessage(null);
    setPwError(null);

    if (!currentPassword) {
      setPwError('กรุณากรอกรหัสผ่านเดิม');
      setPwLoading(false);
      return;
    }

    if (!newPassword) {
      setPwError('กรุณากรอกรหัสผ่านใหม่');
      setPwLoading(false);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('รหัสผ่านไม่ตรงกัน');
      setPwLoading(false);
      return;
    }

    try {
      const supabase = getBrowserClient();

      if (!email) {
        setPwError('ไม่พบอีเมลผู้ใช้');
        setPwLoading(false);
        return;
      }

      // Verify current password by attempting sign-in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (signInError) {
        setPwError('รหัสผ่านเดิมไม่ถูกต้อง');
        setPwLoading(false);
        return;
      }

      // Now update password
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPwError(error.message || 'ไม่สามารถเปลี่ยนรหัสได้');
        setPwLoading(false);
        return;
      }

      // Re-sign-in with the new password to refresh session
      await supabase.auth.signInWithPassword({ email, password: newPassword });

      setPwMessage('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwError(err?.message || 'ไม่สามารถเปลี่ยนรหัสได้');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div>
      {/* Province: show only (read-only) */}
      <div className="profile-readonly">
        <label className="profile-label">จังหวัด</label>
        <div className="profile-value">{province || 'ไม่ระบุ'}</div>
      </div>

      {/* Email: read-only display */}
      <div className="profile-readonly">
        <label className="profile-label">อีเมล (สำหรับการล็อกอิน)</label>
        <div className="profile-value">{email || '-'}</div>
      </div>

      <hr style={{ margin: '1rem 0' }} />

      <form className="profile-form" onSubmit={handleChangePassword}>
        <label className="profile-label">เปลี่ยนรหัสผ่าน</label>

        {/* current password (user types their existing password) */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            className="profile-input"
            type={showCurrentPassword ? 'text' : 'password'}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="รหัสผ่านเดิม"
          />
          <button
            type="button"
            className="profile-toggle"
            onClick={() => setShowCurrentPassword((s) => !s)}
          >
            {showCurrentPassword ? 'ซ่อน' : 'แสดง'}
          </button>
        </div>

        {/* new password */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
          <input
            className="profile-input"
            type={showNewPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="รหัสผ่านใหม่"
          />
          <button
            type="button"
            className="profile-toggle"
            onClick={() => setShowNewPassword((s) => !s)}
          >
            {showNewPassword ? 'ซ่อน' : 'แสดง'}
          </button>
        </div>

        <input
          className="profile-input"
          type={showNewPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="ยืนยันรหัสผ่าน"
        />

        <div className="profile-actions">
          <button className="profile-btn" type="submit" disabled={pwLoading}>
            {pwLoading ? 'กำลังเปลี่ยน...' : 'เปลี่ยนรหัสผ่าน'}
          </button>
        </div>

        {pwMessage && <div className="profile-success">{pwMessage}</div>}
        {pwError && <div className="profile-error">{pwError}</div>}
      </form>
    </div>
  );
}
