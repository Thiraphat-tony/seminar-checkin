// app/admin/settings/StaffDeleteButton.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type StaffDeleteButtonProps = {
  userId: string;
  courtName: string;
  role: string;
  isSelf: boolean;
};

export default function StaffDeleteButton({
  userId,
  courtName,
  role,
  isSelf,
}: StaffDeleteButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const isSuperAdmin = role === 'super_admin';
  const isDisabled = isSelf || isSuperAdmin || isDeleting;
  const disabledReason = isSelf
    ? 'ไม่สามารถลบบัญชีตัวเองได้'
    : isSuperAdmin
    ? 'ไม่สามารถลบซูเปอร์แอดมินได้'
    : '';

  const handleDelete = async () => {
    if (isDisabled) return;

  const label = courtName ? `ศาล "${courtName}"` : 'บัญชีนี้';
    const confirmed = window.confirm(
      `ยืนยันลบบัญชีแอดมิน${label}?\nการลบจะไม่สามารถกู้คืนได้`,
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const res = await fetch('/api/admin/delete-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          alert(data?.message || data?.error || 'ไม่มีสิทธิ์ใช้งาน');
          window.location.href = '/login';
          return;
        }
        alert(data?.message || data?.error || 'ลบไม่สำเร็จ');
        return;
      }

      router.refresh();
    } catch (error) {
      console.error('Delete staff error:', error);
      alert('ลบไม่สำเร็จ');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button
      type="button"
      className="admin-delete-btn"
      onClick={handleDelete}
      disabled={isDisabled}
      data-loading={isDeleting ? 'true' : 'false'}
      title={disabledReason}
    >
      {isDeleting ? 'กำลังลบ...' : 'ลบ'}
    </button>
  );
}
