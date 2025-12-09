// app/admin/AdminImportButton.tsx
'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminImportButton() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // ฟังก์ชันสร้างเอฟเฟกต์ระลอกคลื่น
  const createRipple = (event: React.MouseEvent<HTMLButtonElement>) => {
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
    // เปิด file picker
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setMessage(null);
    setIsError(false);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/admin/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json().catch(() => null);

      if (res.ok) {
        setMessage(
          data?.message ||
            'นำเข้าข้อมูลสำเร็จ (กรุณาตรวจสอบรายชื่อที่หน้า Admin)'
        );
        setIsError(false);

        // รีเฟรชข้อมูลตารางในหน้า /admin ให้ตรงกับข้อมูลใหม่
        router.refresh();
      } else {
        // แสดง error message จาก API
        const errorMsg = data?.message || data?.detail || 'นำเข้าข้อมูลไม่สำเร็จ';
        setMessage(errorMsg);
        setIsError(true);
        console.error('Import error:', data);
      }
    } catch {
      setMessage('เกิดข้อผิดพลาดระหว่างนำเข้าข้อมูล');
      setIsError(true);
    } finally {
      setIsUploading(false);
      // เคลียร์ค่า input เพื่อให้เลือกไฟล์เดิมซ้ำได้
      event.target.value = '';
    }
  };

  return (
    <div className="admin-import">
      <button
        ref={buttonRef}
        type="button"
        className="admin-import__button"
        onClick={handleClick}
        disabled={isUploading}
        data-loading={isUploading}
      >
        {isUploading ? 'กำลังนำเข้าข้อมูล…' : '📤 นำเข้าจาก Excel'}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="admin-import__input"
        onChange={handleFileChange}
      />

      {message && (
        <p className={`admin-import__hint ${isError ? 'error' : ''}`}>
          {message}
        </p>
      )}
    </div>
  );
}
