'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import './coordinator-edit.css';

type CoordinatorData = {
  prefix: string;
  name: string;
  phone: string;
};

export default function CoordinatorEditClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [prefix, setPrefix] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [originalName, setOriginalName] = useState('');

  useEffect(() => {
    let active = true;

    const loadCoordinator = async () => {
      try {
        const res = await fetch('/api/admin/coordinator');
        const json = await res.json();

        if (!res.ok || !json.ok) {
          throw new Error(json.error || 'โหลดข้อมูลไม่สำเร็จ');
        }

        if (!active) return;

        const coord: CoordinatorData = json.coordinator;
        setPrefix(coord.prefix);
        setName(coord.name);
        setPhone(coord.phone);
        setOriginalName(coord.name);
      } catch (err: unknown) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadCoordinator();

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      setError('กรุณากรอกชื่อผู้ประสานงาน');
      setSaving(false);
      return;
    }

    if (!trimmedPhone) {
      setError('กรุณากรอกเบอร์โทรผู้ประสานงาน');
      setSaving(false);
      return;
    }

    if (!/^\d{10}$/.test(trimmedPhone)) {
      setError('เบอร์โทรต้องเป็นตัวเลข 10 หลัก');
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/coordinator', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefix: prefix.trim(),
          name: trimmedName,
          phone: trimmedPhone,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'บันทึกข้อมูลไม่สำเร็จ');
      }

      setSuccess('บันทึกข้อมูลผู้ประสานงานสำเร็จ');
      setTimeout(() => {
        router.push('/admin');
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'บันทึกข้อมูลไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="coordinator-edit-page">
        <div className="coordinator-edit-card">
          <p>กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="coordinator-edit-page">
      <div className="coordinator-edit-card">
        <h1 className="coordinator-edit-title">แก้ไขข้อมูลผู้ประสานงาน</h1>
        <p className="coordinator-edit-subtitle">
          แก้ไขข้อมูลผู้ประสานงานสำหรับศาลของคุณ
        </p>

        <form onSubmit={handleSubmit} className="coordinator-edit-form">
          <div className="form-group">
            <label htmlFor="prefix">คำนำหน้าชื่อ (ถ้ามี)</label>
            <select
              id="prefix"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              className="form-input"
            >
              <option value="">-- เลือกคำนำหน้า --</option>
              <option value="นาย">นาย</option>
              <option value="นาง">นาง</option>
              <option value="นางสาว">นางสาว</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="name">
              ชื่อผู้ประสานงาน <span className="required">*</span>
            </label>
            {originalName && (
              <small className="form-hint" style={{ marginBottom: '4px' }}>
                ชื่อเดิม: {originalName}
              </small>
            )}
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ชื่อ-นามสกุล"
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">
              เบอร์โทรผู้ประสานงาน <span className="required">*</span>
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0812345678"
              maxLength={10}
              className="form-input"
              required
            />
            <small className="form-hint">กรอกตัวเลข 10 หลัก</small>
          </div>

          {error && <div className="form-error">{error}</div>}
          {success && <div className="form-success">{success}</div>}

          <div className="form-actions">
            <button
              type="button"
              onClick={() => router.push('/admin')}
              className="btn-cancel"
              disabled={saving}
            >
              ยกเลิก
            </button>
            <button type="submit" className="btn-submit" disabled={saving}>
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
