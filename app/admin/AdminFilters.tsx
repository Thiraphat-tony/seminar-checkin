"use client";

import AdminImportButton from './AdminImportButton';
import AdminExportExcelButton from './AdminExportExcelButton';
import { useRouter, useSearchParams } from 'next/navigation';

type AdminFiltersProps = {
  keyword: string;
  status: string;
  regionFilter: string;
  organizationOptions: string[];
  provinceOptions: string[];
  organizationValue: string;
  provinceValue: string;
};

export default function AdminFilters({
  keyword,
  status,
  regionFilter,
  organizationOptions,
  provinceOptions,
  organizationValue,
  provinceValue,
}: AdminFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSelectChange = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(name, value);
    } else {
      params.delete(name);
    }
    router.push(`/admin?${params.toString()}`);
  };

  return (
    <form className="admin-filters__form" method="get">
      <div className="admin-filters__field">
        <label className="admin-filters__label">
          ค้นหาชื่อ / หน่วยงาน / ตำแหน่ง / จังหวัด / Token
        </label>
        <input
          type="text"
          name="q"
          defaultValue={keyword}
          placeholder="พิมพ์คำค้นหา เช่น ชื่อ หน่วยงาน ตำแหน่ง หรือจังหวัด"
          className="admin-filters__input"
        />
      </div>

      <div className="admin-filters__field admin-filters__field--inline">
        <div className="admin-filters__inline-group">
          <label className="admin-filters__label">ภาค</label>
          <select
            name="region"
            value={regionFilter}
            className="admin-filters__select"
            onChange={(e) => handleSelectChange('region', e.target.value)}
          >
            <option value="">ทุกภาค</option>
            <option value="0">ศาลกลาง</option>
            <option value="1">ภาค 1</option>
            <option value="2">ภาค 2</option>
            <option value="3">ภาค 3</option>
            <option value="4">ภาค 4</option>
            <option value="5">ภาค 5</option>
            <option value="6">ภาค 6</option>
            <option value="7">ภาค 7</option>
            <option value="8">ภาค 8</option>
            <option value="9">ภาค 9</option>
          </select>
        </div>

        <div className="admin-filters__inline-group">
          <label className="admin-filters__label">จังหวัด</label>
          <select
            name="province"
            value={provinceValue}
            className="admin-filters__select"
            onChange={(e) => handleSelectChange('province', e.target.value)}
          >
            <option value="">ทุกจังหวัด</option>
            {provinceOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-filters__inline-group">
          <label className="admin-filters__label">ศาล / หน่วยงาน</label>
          <select
            name="organization"
            value={organizationValue}
            className="admin-filters__select"
            onChange={(e) => handleSelectChange('organization', e.target.value)}
          >
            <option value="">ทุกศาล / หน่วยงาน</option>
            {organizationOptions.map((org) => (
              <option key={org} value={org}>
                {org}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="admin-filters__field admin-filters__field--inline">
        <div className="admin-filters__inline-group">
          <label className="admin-filters__label">สถานะเช็กอิน</label>
          <select
            name="status"
            value={status}
            className="admin-filters__select"
            onChange={(e) => handleSelectChange('status', e.target.value)}
          >
            <option value="all">ทั้งหมด</option>
            <option value="checked">เช็กอินแล้ว</option>
            <option value="unchecked">ยังไม่เช็กอิน</option>
          </select>
        </div>

        <div className="admin-filters__actions">
          <button type="submit" className="admin-filters__button">
            ใช้ตัวกรอง
          </button>
          <a href="/admin" className="admin-filters__link-reset">
            ล้างตัวกรอง
          </a>
        </div>

        <div className="admin-filters__inline-group admin-filters__inline-group--buttons">
          <AdminImportButton />
          <AdminExportExcelButton />
          <a href="/admin/namecards" className="admin-export-btn">
            🎫 หน้านามบัตร (QR)
          </a>
        </div>
      </div>
    </form>
  );
}

