// app/admin/AdminDeleteButton.tsx
'use client';

import { useEffect, useTransition, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

type AdminDeleteButtonProps = {
  attendeeId: string;
  fullName?: string | null;
};

export default function AdminDeleteButton({
  attendeeId,
  fullName,
}: AdminDeleteButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(media.matches);
    update();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  // ฟังก์ชันสร้างเอฟเฟกต์ระลอกคลื่น
  const createRipple = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (reduceMotion) return;
    const button = buttonRef.current;
    if (!button) return;
    
    const circle = document.createElement('span');
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;
    
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - button.offsetLeft - radius}px`;
    circle.style.top = `${event.clientY - button.offsetTop - radius}px`;
    circle.classList.add('ripple');
    
    const ripple = button.getElementsByClassName('ripple')[0];
    if (ripple) {
      ripple.remove();
    }
    
    button.appendChild(circle);
  };

  async function handleDelete(event: React.MouseEvent<HTMLButtonElement>) {
    // สร้างเอฟเฟกต์ระลอกคลื่น
    createRipple(event);
    
    const displayName = fullName || 'ผู้เข้าร่วม';

    const sure = window.confirm(
      `ต้องการลบข้อมูลของ "${displayName}" ใช่หรือไม่?\n` +
        'เมื่อลบแล้วจะไม่สามารถกู้คืนได้'
    );

    if (!sure) return;

    try {
      setIsDeleting(true);
      
      const res = await fetch('/api/admin/delete-attendee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ attendeeId }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        // If unauthorized/forbidden, prompt to re-login
        if (res.status === 401 || res.status === 403) {
          alert(data?.message || data?.error || 'ไม่ได้รับอนุญาต โปรดล็อกอินอีกครั้ง');
          window.location.href = '/login';
          return;
        }

        alert(data?.message || data?.error || 'ลบข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        return;
      }

      if (data?.message) {
        console.log(data.message);
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      console.error('Delete attendee fetch error:', error);
      alert('เกิดข้อผิดพลาดระหว่างลบข้อมูล กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsDeleting(false);
    }
  }

  const isLoading = isPending || isDeleting;

  return (
    <button
      ref={buttonRef}
      type="button"
      className="admin-delete-btn"
      onClick={handleDelete}
      disabled={isLoading}
      data-loading={isLoading}
    >
      {isLoading ? 'กำลังลบ…' : 'ลบข้อมูล'}
    </button>
  );
}
