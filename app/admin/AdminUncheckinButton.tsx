// app/admin/AdminUncheckinButton.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

type AdminUncheckinButtonProps = {
  attendeeId: string;
};

type UncheckinResponse = {
  success: boolean;
  message: string;
  alreadyUnchecked?: boolean;
};

export default function AdminUncheckinButton({
  attendeeId,
}: AdminUncheckinButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCalling, setIsCalling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isLoading = isCalling || isPending;

  const handleUncheckin = async () => {
    setMessage(null);

    const ok = window.confirm(
      'ต้องการยกเลิกลงทะเบียนให้ผู้เข้าร่วมรายนี้หรือไม่?\n(ปุ่มนี้ใช้ในกรณีกดลงทะเบียนผิดเท่านั้น)'
    );
    if (!ok) return;

    try {
      setIsCalling(true);

      const res = await fetch('/api/admin/uncheckin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ attendeeId }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: UncheckinResponse | null = null;

      if (contentType.includes('application/json')) {
        data = (await res.json()) as UncheckinResponse;
      } else {
        const text = await res.text();
        console.error('uncheckin response is not JSON:', text);
        setMessage(
          'API ยกเลิกลงทะเบียนตอบกลับรูปแบบไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ'
        );
        return;
      }

      if (!res.ok || !data) {
        setMessage(
          data?.message ||
            'ยกเลิกลงทะเบียนไม่สำเร็จ กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ'
        );
        return;
      }

      setMessage(data.message || 'ยกเลิกลงทะเบียนเรียบร้อย');

      if (!data.alreadyUnchecked) {
        startTransition(() => {
          router.refresh();
        });
      }
    } catch (err) {
      console.error('uncheckin button error', err);
      setMessage('เกิดข้อผิดพลาดขณะยกเลิกลงทะเบียน กรุณาลองใหม่');
    } finally {
      setIsCalling(false);
    }
  };

  return (
    <div className="admin-uncheckin">
      <button
        type="button"
        className="admin-uncheckin__button"
        onClick={handleUncheckin}
        disabled={isLoading}
      >
        {isLoading ? 'กำลังยกเลิกลงทะเบียน…' : 'ยกเลิกลงทะเบียน'}
      </button>
      {message && (
        <p className="admin-uncheckin__message" title={message}>
          {message}
        </p>
      )}
    </div>
  );
}
