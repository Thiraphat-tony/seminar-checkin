// app/admin/AdminExportExcelButton.tsx
'use client';

import { useMemo, useRef, useState } from 'react';

type RegionOption = { value: string; label: string };

export default function AdminExportExcelButton() {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [region, setRegion] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  const regions = useMemo<RegionOption[]>(
    () => [
      { value: 'all', label: 'ทั้งหมด' },
      {
        value: '0',
        label: 'ภาค 0 — ศาลเยาวชนและครอบครัวกลาง (กรุงเทพมหานคร)',
      },
      { value: '1', label: 'ภาค 1' },
      { value: '2', label: 'ภาค 2' },
      { value: '3', label: 'ภาค 3' },
      { value: '4', label: 'ภาค 4' },
      { value: '5', label: 'ภาค 5' },
      { value: '6', label: 'ภาค 6' },
      { value: '7', label: 'ภาค 7' },
      { value: '8', label: 'ภาค 8' },
      { value: '9', label: 'ภาค 9' },
    ],
    [],
  );

  const open = () => dialogRef.current?.showModal();
  const close = () => dialogRef.current?.close();

  const onConfirm = () => {
    setIsLoading(true);
    const url =
      region === 'all'
        ? '/api/admin/export-attendees'
        : `/api/admin/export-attendees?region=${encodeURIComponent(region)}`;
    window.location.assign(url);
    close();
    setIsLoading(false);
  };

  return (
    <>
      <button
        type="button"
        className="admin-export-btn"
        onClick={open}
        disabled={isLoading}
      >
        ⬇️ ดาวน์โหลดรายชื่อ (Excel)
      </button>

      <dialog ref={dialogRef} className="admin-export-dialog">
        <div className="admin-export-dialog__body">
          <h3 className="admin-export-dialog__title">เลือกภาคที่ต้องการ Export</h3>

          <div className="admin-export-dialog__field">
            <label className="admin-export-dialog__label">
              ภาค
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="admin-export-dialog__select"
              >
                {regions.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="admin-export-dialog__actions">
            <button type="button" className="admin-export-dialog__button admin-export-dialog__button--primary" onClick={onConfirm} disabled={isLoading}>
              {isLoading ? 'กำลังเริ่มดาวน์โหลด…' : 'Export Excel'}
            </button>
            <button type="button" className="admin-export-dialog__button admin-export-dialog__button--ghost" onClick={close} disabled={isLoading}>
              ยกเลิก
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

