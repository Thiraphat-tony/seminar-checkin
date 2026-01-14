"use client";

import { useEffect, useState, useTransition } from 'react';
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
  const [keywordValue, setKeywordValue] = useState(keyword);
  const [statusValue, setStatusValue] = useState(status);
  const [regionValue, setRegionValue] = useState(regionFilter);
  const [organizationValueState, setOrganizationValueState] = useState(organizationValue);
  const [provinceValueState, setProvinceValueState] = useState(provinceValue);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setKeywordValue(keyword);
    setStatusValue(status);
    setRegionValue(regionFilter);
    setOrganizationValueState(organizationValue);
    setProvinceValueState(provinceValue);
  }, [keyword, status, regionFilter, organizationValue, provinceValue]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    const trimmedKeyword = keywordValue.trim();

    if (trimmedKeyword) {
      params.set('q', trimmedKeyword);
    } else {
      params.delete('q');
    }

    if (statusValue) {
      params.set('status', statusValue);
    } else {
      params.delete('status');
    }

    if (regionValue) {
      params.set('region', regionValue);
    } else {
      params.delete('region');
    }

    if (provinceValueState) {
      params.set('province', provinceValueState);
    } else {
      params.delete('province');
    }

    if (organizationValueState) {
      params.set('organization', organizationValueState);
    } else {
      params.delete('organization');
    }

    startTransition(() => {
      router.push(`/admin?${params.toString()}`);
    });
  };

  return (
    <form className="admin-filters__form" method="get" onSubmit={handleSubmit}>
      <div className="admin-filters__field">
        <label className="admin-filters__label">
          ชื่อ / เบอร์โทร / หน่วยงาน / จังหวัด / Token
        </label>
        <input
          type="text"
          name="q"
          value={keywordValue}
          placeholder="ค้นหาชื่อ เบอร์โทร หน่วยงาน จังหวัด Token"
          className="admin-filters__input"
          onChange={(e) => setKeywordValue(e.target.value)}
        />
      </div>

      <div className="admin-filters__field admin-filters__field--inline">
        <div className="admin-filters__inline-group">
          <label className="admin-filters__label">ภาค</label>
          <select
            name="region"
            value={regionValue}
            className="admin-filters__select"
            onChange={(e) => setRegionValue(e.target.value)}
          >
            <option value="">เลือกภาค</option>
            <option value="0">ส่วนกลาง</option>
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
            value={provinceValueState}
            className="admin-filters__select"
            onChange={(e) => setProvinceValueState(e.target.value)}
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
            value={organizationValueState}
            className="admin-filters__select"
            onChange={(e) => setOrganizationValueState(e.target.value)}
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
            value={statusValue}
            className="admin-filters__select"
            onChange={(e) => setStatusValue(e.target.value)}
          >
            <option value="all">ทั้งหมด</option>
            <option value="checked">เช็กอินแล้ว</option>
            <option value="unchecked">ยังไม่เช็กอิน</option>
          </select>
        </div>

        <div className="admin-filters__actions">
          <button type="submit" className="admin-filters__button" disabled={isPending}>
            ค้นหา
          </button>
          <a href="/admin" className="admin-filters__link-reset">
            ล้างตัวกรอง
          </a>
        </div>

        <div className="admin-filters__inline-group admin-filters__inline-group--buttons">
          <AdminImportButton />
          <AdminExportExcelButton />
          <a href="/admin/namecards" className="admin-export-btn">
            ส่งออกนามบัตร (QR)
          </a>
        </div>
      </div>
    </form>
  );
}
