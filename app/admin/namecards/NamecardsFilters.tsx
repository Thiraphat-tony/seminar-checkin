'use client';

import type { ChangeEvent } from 'react';

import DownloadNamecardsPdfButton from './DownloadNamecardsPdfButton';

type NamecardsFiltersProps = {
  keywordRaw: string;
  regionValue: string;
};

export default function NamecardsFilters({ keywordRaw, regionValue }: NamecardsFiltersProps) {
  const handleRegionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const form = event.currentTarget.form;
    if (!form) return;
    if (form.requestSubmit) {
      form.requestSubmit();
    } else {
      form.submit();
    }
  };

  return (
    <section className="admin-filters">
      <form className="admin-filters__form" method="get">
        <div className="admin-filters__field admin-filters__field--full">
          <label className="admin-filters__label">
            ค้นหาชื่อ / หน่วยงาน / ตำแหน่ง / จังหวัด / Token
          </label>
          <input
            type="text"
            name="q"
            defaultValue={keywordRaw}
            placeholder="พิมพ์คำค้นหา เช่น ชื่อ หน่วยงาน ตำแหน่ง จังหวัด หรือ Token"
            className="admin-filters__input"
          />
        </div>

        <div className="admin-filters__field admin-filters__field--inline">
          <div className="admin-filters__inline-group">
            <label className="admin-filters__label">ภาค</label>
            <select
              name="region"
              defaultValue={regionValue}
              className="admin-filters__select"
              onChange={handleRegionChange}
            >
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
        </div>

        <div className="admin-filters__actions">
          <button type="submit" className="admin-filters__button">
            ใช้ตัวกรอง
          </button>
          <a href="/admin/namecards" className="admin-filters__link-reset">
            ล้างตัวกรอง
          </a>

          <DownloadNamecardsPdfButton />

          <a
            href="/admin"
            className="admin-filters__link-reset"
            style={{ marginLeft: 'auto' }}
          >
            ← กลับไปหน้า Admin
          </a>
        </div>
      </form>
    </section>
  );
}
