'use client';

import { useMemo, useRef, useState } from 'react';

type RegionOption = { value: string; label: string };

type ExportFieldOption = {
  key: string;
  label: string;
};

const EXPORT_FIELD_OPTIONS: ExportFieldOption[] = [
  { key: 'full_name', label: 'ชื่อ - นามสกุล' },
  { key: 'organization', label: 'หน่วยงาน' },
  { key: 'region_label', label: 'ภาค/ศาลกลาง' },
  { key: 'job_position', label: 'ตำแหน่ง' },
  { key: 'coordinator', label: 'ผู้ประสานงาน' },
  { key: 'hotel_name', label: 'โรงแรม' },
  { key: 'travel_mode', label: 'การเดินทาง' },
  { key: 'slip', label: 'สลิป' },
  { key: 'checkin_status', label: 'ลงทะเบียน (หน้างาน)' },
  { key: 'food_type', label: 'ประเภทอาหาร' },
];

export default function AdminExportSelectableExcelButton() {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [region, setRegion] = useState<string>('all');
  const [selectedFields, setSelectedFields] = useState<string[]>(
    EXPORT_FIELD_OPTIONS.map((field) => field.key),
  );
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

  const allSelected = selectedFields.length === EXPORT_FIELD_OPTIONS.length;

  const handleToggleField = (fieldKey: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldKey)
        ? prev.filter((key) => key !== fieldKey)
        : [...prev, fieldKey],
    );
  };

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedFields(EXPORT_FIELD_OPTIONS.map((field) => field.key));
      return;
    }
    setSelectedFields([]);
  };

  const onConfirm = () => {
    if (selectedFields.length === 0) return;

    setIsLoading(true);
    const params = new URLSearchParams();
    if (region !== 'all') {
      params.set('region', region);
    }
    params.set('fields', selectedFields.join(','));

    const query = params.toString();
    const url = query ? `/api/admin/export-attendees?${query}` : '/api/admin/export-attendees';
    window.location.assign(url);
    close();
    setIsLoading(false);
  };

  return (
    <>
      <button type="button" className="admin-export-btn" onClick={open} disabled={isLoading}>
        ⬇️ ดาวน์โหลดแบบเลือกข้อมูล
      </button>

      <dialog ref={dialogRef} className="admin-export-dialog admin-export-dialog--fields">
        <div className="admin-export-dialog__body">
          <h3 className="admin-export-dialog__title">เลือกคอลัมน์ที่ต้องการดาวน์โหลด</h3>

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

          <div className="admin-export-dialog__field">
            <label className="admin-export-dialog__label">ข้อมูลที่ต้องการส่งออก</label>
            <label className="admin-export-dialog__checkbox admin-export-dialog__checkbox--all">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => handleToggleAll(e.target.checked)}
              />
              เลือกทั้งหมด
            </label>
            <div className="admin-export-dialog__checkbox-list">
              {EXPORT_FIELD_OPTIONS.map((field) => (
                <label key={field.key} className="admin-export-dialog__checkbox">
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(field.key)}
                    onChange={() => handleToggleField(field.key)}
                  />
                  {field.label}
                </label>
              ))}
            </div>
            <p className="admin-export-dialog__hint">
              เลือกแล้ว {selectedFields.length} รายการ
            </p>
          </div>

          <div className="admin-export-dialog__actions">
            <button
              type="button"
              className="admin-export-dialog__button admin-export-dialog__button--primary"
              onClick={onConfirm}
              disabled={isLoading || selectedFields.length === 0}
            >
              {isLoading ? 'กำลังเริ่มดาวน์โหลด…' : 'ดาวน์โหลด Excel'}
            </button>
            <button
              type="button"
              className="admin-export-dialog__button admin-export-dialog__button--ghost"
              onClick={close}
              disabled={isLoading}
            >
              ยกเลิก
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
