'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import './coordinator-edit.css';

type CoordinatorData = {
  prefix: string;
  name: string;
  phone: string;
};

type Court = {
  id: string;
  court_name: string;
};

export default function CoordinatorEditClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [courts, setCourts] = useState<Court[]>([]);
  const [selectedCourtId, setSelectedCourtId] = useState('');

  const [prefix, setPrefix] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [originalName, setOriginalName] = useState('');

  async function loadCoordinator(courtId?: string) {
    const qs = courtId ? `?courtId=${encodeURIComponent(courtId)}` : '';
    const res = await fetch(`/api/admin/coordinator${qs}`);
    const json = await res.json();

    if (!res.ok || !json.ok) {
      throw new Error(json.error || 'โหลดข้อมูลไม่สำเร็จ');
    }

    const coord: CoordinatorData = json.coordinator;
    setPrefix(coord.prefix);
    setName(coord.name);
    setPhone(coord.phone);
    setOriginalName(coord.name);
    setSelectedCourtId((json.courtId as string) || courtId || '');
  }

  useEffect(() => {
    let active = true;

    const loadInitial = async () => {
      try {
        const [courtsRes, coordinatorRes] = await Promise.all([
          fetch('/api/courts'),
          fetch('/api/admin/coordinator'),
        ]);

        const courtsJson = await courtsRes.json();
        if (!courtsRes.ok || !courtsJson.ok) {
          throw new Error(courtsJson.error || 'โหลดรายชื่อศาลไม่สำเร็จ');
        }

        const coordinatorJson = await coordinatorRes.json();
        if (!coordinatorRes.ok || !coordinatorJson.ok) {
          throw new Error(coordinatorJson.error || 'โหลดข้อมูลไม่สำเร็จ');
        }

        if (!active) return;

        setCourts((courtsJson.courts as Court[]) ?? []);

        const coord: CoordinatorData = coordinatorJson.coordinator;
        setPrefix(coord.prefix);
        setName(coord.name);
        setPhone(coord.phone);
        setOriginalName(coord.name);
        setSelectedCourtId((coordinatorJson.courtId as string) || '');
      } catch (err: unknown) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadInitial();

    return () => {
      active = false;
    };
  }, []);

  const handleCourtChange = async (courtId: string) => {
    setSelectedCourtId(courtId);
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await loadCoordinator(courtId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (!selectedCourtId) {
      setError('กรุณาเลือกศาล');
      setSaving(false);
      return;
    }

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
          courtId: selectedCourtId,
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
        <p className="coordinator-edit-subtitle">เลือกศาล แล้วแก้ไขข้อมูลผู้ประสานงานของศาลนั้น</p>

        <form onSubmit={handleSubmit} className="coordinator-edit-form">
          <div className="form-group">
            <label htmlFor="court">
              ศาล <span className="required">*</span>
            </label>
            <select
              id="court"
              value={selectedCourtId}
              onChange={(e) => handleCourtChange(e.target.value)}
              className="form-input"
              required
              disabled={saving}
            >
              <option value="">-- เลือกศาล --</option>
              {courts.map((court) => (
                <option key={court.id} value={court.id}>
                  {court.court_name}
                </option>
              ))}
            </select>
          </div>

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

