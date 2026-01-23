"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isValidPhone } from "@/lib/phone";

type CourtOption = {
  id: string;
  court_name: string;
  max_staff: number | null;
};

function courtIdToEmail(courtId: string) {
  return `${courtId}@staff.local`;
}

export default function StaffRegisterPage() {
  const router = useRouter();

  const [courtName, setCourtName] = useState("");
  const [courtInput, setCourtInput] = useState("");
  const [showCourtList, setShowCourtList] = useState(false);
  const courtInputRef = useRef<HTMLInputElement>(null);

  const [courts, setCourts] = useState<CourtOption[]>([]);
  const [courtsLoading, setCourtsLoading] = useState(true);
  const [courtsError, setCourtsError] = useState("");

  const filteredCourts = useMemo(() => {
    const q = courtInput.trim();
    return q ? courts.filter((c) => c.court_name.includes(q)) : courts;
  }, [courtInput, courts]);

  const selectedCourt = (() => {
    const typed = (courtInput || "").trim();
    const chosen = (courtName || "").trim();
    const selectedName = chosen || typed;
    if (!selectedName) return null;
    return courts.find((c) => c.court_name === selectedName) ?? null;
  })();

  const selectedCourtEmail = selectedCourt ? courtIdToEmail(selectedCourt.id) : "";

  useEffect(() => {
    let active = true;

    const loadCourts = async () => {
      setCourtsLoading(true);
      setCourtsError("");

      try {
        const res = await fetch("/api/courts", { cache: "no-store" });
        const payload = await res.json().catch(() => null);
        if (!res.ok || !payload?.ok) {
          throw new Error(payload?.error || "โหลดรายชื่อศาลไม่สำเร็จ");
        }
        const list = Array.isArray(payload.courts) ? payload.courts : [];
        if (active) setCourts(list);
      } catch (err: any) {
        if (active) setCourtsError(err?.message || "โหลดรายชื่อศาลไม่สำเร็จ");
      } finally {
        if (active) setCourtsLoading(false);
      }
    };

    loadCourts();
    return () => {
      active = false;
    };
  }, []);

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [phone, setPhone] = useState("");
  const [namePrefix, setNamePrefix] = useState("");

  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOkMsg("");
    setLoading(true);

    if (courtsLoading) {
      setError("กำลังโหลดรายชื่อศาล กรุณาลองใหม่อีกครั้ง");
      setLoading(false);
      return;
    }
    if (courtsError) {
      setError(courtsError);
      setLoading(false);
      return;
    }
    if (!selectedCourt) {
      setError("กรุณาเลือกศาลจากรายการ");
      setLoading(false);
      return;
    }
    if (!phone.trim()) {
      setError("กรุณากรอกเบอร์โทรศัพท์");
      setLoading(false);
      return;
    }
    if (!isValidPhone(phone)) {
      setError("เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลัก");
      setLoading(false);
      return;
    }
    if (!password.trim() || password.trim().length < 6) {
      setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      setLoading(false);
      return;
    }
    if (password.trim() !== password2.trim()) {
      setError("ยืนยันรหัสผ่านไม่ตรงกัน");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/staff/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          courtId: selectedCourt.id,
          namePrefix: namePrefix.trim(),
          phone: phone.trim(),
          password: password.trim(),
        }),
      });

      const data = (await res.json()) as { ok: boolean; message?: string };

      if (!res.ok || !data.ok) {
        setError(data.message || "สมัครไม่สำเร็จ");
        setLoading(false);
        return;
      }

      setOkMsg("สมัครสำเร็จแล้ว สามารถเข้าสู่ระบบได้");
      setTimeout(() => router.push("/login"), 600);
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>สมัครเจ้าหน้าที่</h2>

        <label htmlFor="court">ศาล</label>
        <div style={{ position: "relative" }}>
          <input
            id="court"
            type="text"
            value={courtInput || courtName}
            onChange={(e) => {
              setCourtInput(e.target.value);
              setShowCourtList(true);
              setCourtName("");
            }}
            onFocus={() => setShowCourtList(true)}
            onBlur={() => setTimeout(() => setShowCourtList(false), 150)}
            placeholder="พิมพ์ชื่อศาล..."
            autoComplete="off"
            ref={courtInputRef}
            required
          />

          {showCourtList && (
            <ul
              style={{
                position: "absolute",
                zIndex: 10,
                background: "#fff",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                maxHeight: 180,
                overflowY: "auto",
                width: "100%",
                margin: 0,
                padding: 0,
                listStyle: "none",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
            >
              {filteredCourts.length === 0 && (
                <li style={{ padding: "8px", color: "#888" }}>ไม่พบศาล</li>
              )}
              {filteredCourts.map((court) => (
                <li
                  key={court.id}
                  style={{ padding: "8px", cursor: "pointer" }}
                  onMouseDown={() => {
                    setCourtName(court.court_name);
                    setCourtInput(court.court_name);
                    setShowCourtList(false);
                  }}
                >
                  {court.court_name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ fontSize: 13, color: "#444" }}>
          ตัวอย่างอีเมลสำหรับล็อกอิน: <code>{selectedCourtEmail || "-"}</code>
        </div>

        <label htmlFor="namePrefix">ชื่อ-นามสกุล</label>
        <input
          id="namePrefix"
          type="text"
          value={namePrefix}
          onChange={(e) => setNamePrefix(e.target.value)}
        />

        <label htmlFor="phone">เบอร์โทรศัพท์</label>
        <input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="เช่น 0812345678"
          required
        />

        <label htmlFor="password">ตั้งรหัสผ่าน</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <label htmlFor="password2">ยืนยันรหัสผ่าน</label>
        <input
          id="password2"
          type="password"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          required
        />

        {error && <div className="login-error">{error}</div>}
        {okMsg && (
          <div
            style={{
              color: "#166534",
              background: "#dcfce7",
              padding: "0.5rem",
              borderRadius: 6,
              textAlign: "center",
            }}
          >
            {okMsg}
          </div>
        )}

        <button type="submit" disabled={loading}>
          {loading ? "กำลังสมัคร..." : "สมัครเจ้าหน้าที่"}
        </button>
      </form>

      <style jsx>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f5f6fa;
        }
        .login-form {
          background: #fff;
          padding: 2rem 2.5rem;
          border-radius: 12px;
          box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
          display: flex;
          flex-direction: column;
          gap: 1rem;
          min-width: 320px;
        }
        .login-form h2 {
          margin-bottom: 0.5rem;
          text-align: center;
        }
        .login-form label {
          font-weight: 500;
        }
        .login-form input {
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 1rem;
        }
        .login-form button {
          background: #2563eb;
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 0.75rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        .login-form button:disabled {
          background: #a5b4fc;
          cursor: not-allowed;
        }
        .login-error {
          color: #dc2626;
          background: #fee2e2;
          padding: 0.5rem;
          border-radius: 6px;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
