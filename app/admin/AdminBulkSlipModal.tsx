'use client';

import { useRef, useState } from 'react';

interface AdminBulkSlipModalProps {
  selectedIds: string[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function AdminBulkSlipModal({
  selectedIds,
  onClose,
  onSuccess,
}: AdminBulkSlipModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setSelectedFile(file || null);
    setError('');
  };

  const handleConfirm = async () => {
    if (!selectedFile) {
      setError('กรุณาเลือกไฟล์');
      return;
    }

    setIsLoading(true);
    setProgress('กำลังอัปโหลด...');
    setError('');

    try {
      // Step 1: Upload file using first attendee ID
      const formData = new FormData();
      formData.append('attendeeId', selectedIds[0]);
      formData.append('file', selectedFile);

      const uploadRes = await fetch('/api/upload-slip', {
        method: 'POST',
        body: formData,
      });

      let uploadData: any;
      try {
        uploadData = await uploadRes.json();
      } catch (parseError) {
        console.error('Failed to parse upload response', parseError);
        setError('ไม่สามารถประมวลผลการตอบสนองจากเซิร์ฟเวอร์');
        setIsLoading(false);
        return;
      }

      if (!uploadRes.ok) {
        throw new Error(uploadData?.message || uploadData?.error || 'ไม่สามารถอัปโหลดไฟล์ได้');
      }

      if (!uploadData?.slipUrl) {
        setError('ไม่ได้รับ URL สลิปจากเซิร์ฟเวอร์');
        setIsLoading(false);
        return;
      }

      const { slipUrl } = uploadData;
      setProgress(`กำลังแนบให้ ${selectedIds.length} รายการ...`);

      // Step 2: Assign same URL to remaining attendees
      for (let i = 1; i < selectedIds.length; i++) {
        const id = selectedIds[i];
        const res = await fetch('/api/admin/update-attendee', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, slip_url: slipUrl }),
        });

        if (!res.ok) {
          throw new Error(`ไม่สามารถแนบให้ผู้เข้าร่วม ${i + 1} ได้`);
        }

        setProgress(`กำลังแนบให้ ${i + 1}/${selectedIds.length}...`);
      }

      setProgress('สำเร็จ! ✓');
      setTimeout(() => {
        onSuccess();
      }, 800);
    } catch (err) {
      let errorMessage = 'เกิดข้อผิดพลาด';

      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }

      console.error('Bulk slip upload error:', err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-bulk-slip-overlay">
      <div className="admin-bulk-slip-modal">
        <h2 className="admin-bulk-slip-modal__title">แนบสลิปให้ผู้เข้าร่วมที่เลือก</h2>

        <div className="admin-bulk-slip-modal__content">
          <p className="admin-bulk-slip-modal__info">
            จำนวนที่เลือก: <strong>{selectedIds.length} รายการ</strong> —
            ระบบจะใช้ไฟล์เดียวกันสำหรับทุกคนที่เลือก
          </p>

          {!isLoading && (
            <>
              <label className="admin-bulk-slip-modal__label">
                เลือกไฟล์สลีป (JPG, PNG, PDF)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="admin-bulk-slip-modal__input"
                disabled={isLoading}
              />
              {selectedFile && (
                <p className="admin-bulk-slip-modal__selected">
                  ✓ ไฟล์ที่เลือก: {selectedFile.name}
                </p>
              )}
            </>
          )}

          {isLoading && (
            <div className="admin-bulk-slip-modal__progress">
              <p className="admin-bulk-slip-modal__progress-text">{progress}</p>
              <div className="admin-bulk-slip-modal__spinner" />
            </div>
          )}

          {error && <p className="admin-bulk-slip-modal__error">❌ {error}</p>}
        </div>

        <div className="admin-bulk-slip-modal__actions">
          <button
            className="admin-bulk-slip-modal__button admin-bulk-slip-modal__button--cancel"
            onClick={onClose}
            disabled={isLoading}
          >
            ยกเลิก
          </button>
          <button
            className="admin-bulk-slip-modal__button admin-bulk-slip-modal__button--confirm"
            onClick={handleConfirm}
            disabled={isLoading || !selectedFile}
          >
            {isLoading ? 'กำลังประมวลผล...' : 'ยืนยัน'}
          </button>
        </div>
      </div>
    </div>
  );
}
