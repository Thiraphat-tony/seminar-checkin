'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import './admin-page.css';   // แก้จาก ../ เป็น ./
type AdminSlipClearButtonProps = {
  attendeeId: string;
};

export default function AdminSlipClearButton({
  attendeeId,
}: AdminSlipClearButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    const ok = confirm('ยืนยันการยกเลิก / ลบสลิปของผู้เข้าร่วมคนนี้หรือไม่?');
    if (!ok) return;

    startTransition(async () => {
      const res = await fetch('/api/admin/clear-slip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendeeId }),
      });

      if (!res.ok) {
        alert('ไม่สามารถยกเลิกสลิปได้ กรุณาลองใหม่อีกครั้ง');
        return;
      }

      // รีเฟรชข้อมูลแบบนุ่มนวล
      startTransition(() => {
        router.refresh();
      });
    });
  };

  return (
    <button
      type="button"
      className="admin-pill admin-pill--danger admin-slip-clear-btn"
      onClick={handleClick}
      disabled={isPending}
    >
      {isPending ? 'กำลังยกเลิก…' : 'ยกเลิกสลิป'}
    </button>
  );
}
