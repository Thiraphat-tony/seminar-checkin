// app/admin/AdminExportRegionButton.tsx
'use client';

import { useState } from 'react';

export default function AdminExportRegionButton() {
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const fileName = 'รายชื่อผู้เข้าร่วม-แยกตามภาค.xlsx';

  const handleExport = async () => {
    setDownloading(true);
    setMessage(null);
    setIsError(false);

    try {
      const res = await fetch(`/api/admin/export-attendees`);

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const errorMsg = data?.message || data?.detail || 'ดาวน์โหลดไม่สำเร็จ';
        setMessage(errorMsg);
        setIsError(true);
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setMessage('ดาวน์โหลดไฟล์เรียบร้อย');
    } catch (err) {
      console.error('export error', err);
      setMessage('เกิดข้อผิดพลาดระหว่างดาวน์โหลด');
      setIsError(true);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="admin-export">
      <button
        type="button"
        className="admin-export__button"
        onClick={handleExport}
        disabled={downloading}
        data-loading={downloading}
      >
        {downloading ? 'กำลังดาวน์โหลด…' : '📥 ส่งออก Excel แยกภาค'}
      </button>

      {message && (
        <p className={`admin-export__hint ${isError ? 'error' : ''}`}>
          {message}
        </p>
      )}
    </div>
  );
}
