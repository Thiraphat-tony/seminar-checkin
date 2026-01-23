// app/admin/AdminSlipUploadButton.tsx
'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type AdminSlipUploadButtonProps = {
  attendeeId: string;
};

type UploadResponse = {
  success: boolean;
  message: string;
  slipUrl?: string;
};

export default function AdminSlipUploadButton({
  attendeeId,
}: AdminSlipUploadButtonProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [showSuccess, setShowSuccess] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const isBusy = isUploading || isPending;

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

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    // สร้างเอฟเฟกต์ระลอกคลื่น
    createRipple(event);
    
    setMessage(null);
    setShowSuccess(false);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setMessage(null);
      setShowSuccess(false);

      const formData = new FormData();
      formData.append('attendeeId', attendeeId);
      formData.append('file', file);

      const res = await fetch('/api/upload-slip', {
        method: 'POST',
        body: formData,
      });

      const data: UploadResponse = await res.json();

      if (!data.success) {
        setMessage(data.message || 'อัปโหลดสลิปไม่สำเร็จ');
        setMessageType('error');
        return;
      }

      setMessage('อัปโหลดสลิปแทนเรียบร้อย');
      setMessageType('success');
      setShowSuccess(true);

      // refresh หน้า admin เพื่ออัปเดตสถานะในตาราง
      startTransition(() => {
        router.refresh();
      });

      // ซ่อนสถานะ success หลัง 3 วินาที
      setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('admin upload slip error', err);
      setMessage('เกิดข้อผิดพลาดขณะอัปโหลดสลิป');
      setMessageType('error');
    } finally {
      setIsUploading(false);
      // เคลียร์ค่า input เพื่ออัปโหลดไฟล์เดิมซ้ำได้
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="admin-slipupload">
      <input
        type="file"
        accept="image/*,application/pdf"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <button
        ref={buttonRef}
        type="button"
        className="admin-slipupload__button"
        onClick={handleClick}
        disabled={isBusy}
        data-loading={isUploading}
        data-success={showSuccess}
      >
        {isBusy ? 'กำลังอัปโหลด…' : 'แนบสลิปแทน'}
      </button>

      {message && (
        <p 
          className="admin-slipupload__message" 
          data-type={messageType}
          title={message}
        >
          {message}
        </p>
      )}
    </div>
  );
}
