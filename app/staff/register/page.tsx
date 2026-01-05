"use client";

import React, { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { makeProvinceKey } from '@/lib/provinceKeys';

export default function StaffRegisterPage() {
  const router = useRouter();

  const [province, setProvince] = useState("");
  const [provinceInput, setProvinceInput] = useState("");
  const [showProvinceList, setShowProvinceList] = useState(false);
  const provinceInputRef = useRef<HTMLInputElement>(null);

  const provinces = [
    "กรุงเทพมหานคร","กระบี่","กาญจนบุรี","กาฬสินธุ์","กำแพงเพชร","ขอนแก่น","จันทบุรี","ฉะเชิงเทรา","ชลบุรี","ชัยนาท","ชัยภูมิ","ชุมพร","เชียงราย","เชียงใหม่","ตรัง","ตราด","ตาก","นครนายก","นครปฐม","นครพนม","นครราชสีมา","นครศรีธรรมราช","นครสวรรค์","นนทบุรี","นราธิวาส","น่าน","บึงกาฬ","บุรีรัมย์","ปทุมธานี","ประจวบคีรีขันธ์","ปราจีนบุรี","ปัตตานี","พระนครศรีอยุธยา","พังงา","พัทลุง","พิจิตร","พิษณุโลก","เพชรบุรี","เพชรบูรณ์","แพร่","พะเยา","ภูเก็ต","มหาสารคาม","มุกดาหาร","แม่ฮ่องสอน","ยโสธร","ยะลา","ร้อยเอ็ด","ระนอง","ระยอง","ราชบุรี","ลพบุรี","ลำปาง","ลำพูน","เลย","ศรีสะเกษ","สกลนคร","สงขลา","สตูล","สมุทรปราการ","สมุทรสงคราม","สมุทรสาคร","สระแก้ว","สระบุรี","สิงห์บุรี","สุโขทัย","สุพรรณบุรี","สุราษฎร์ธานี","สุรินทร์","หนองคาย","หนองบัวลำภู","อ่างทอง","อำนาจเจริญ","อุดรธานี","อุตรดิตถ์","อุทัยธานี","อุบลราชธานี"
  ];

  const filteredProvinces = useMemo(() => {
    const q = provinceInput.trim();
    return q ? provinces.filter((p) => p.includes(q)) : provinces;
  }, [provinceInput]);

  const selectedProvinceKey = ((): string => {
    const typed = (provinceInput || '').trim();
    const chosen = (province || '').trim();
    const selectedProvince = chosen || (provinces.includes(typed) ? typed : '');
    if (!selectedProvince) return '';
    try {
      return makeProvinceKey(selectedProvince);
    } catch {
      return encodeURIComponent(selectedProvince);
    }
  })();


  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOkMsg("");
    setLoading(true);

    const typed = (provinceInput || "").trim();
    const chosen = (province || "").trim();
    const selectedProvince = chosen || (provinces.includes(typed) ? typed : "");

    if (!selectedProvince) {
      setError("กรุณาเลือกจังหวัดจากรายการ");
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
          provinceName: selectedProvince,
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
      // พาไปหน้า login (ปรับ path ตามจริงของโปรเจกต์คุณได้)
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

        <label htmlFor="province">จังหวัด</label>
        <div style={{ position: "relative" }}>
          <input
            id="province"
            type="text"
            value={provinceInput || province}
            onChange={(e) => {
              setProvinceInput(e.target.value);
              setShowProvinceList(true);
              setProvince("");
            }}
            onFocus={() => setShowProvinceList(true)}
            onBlur={() => setTimeout(() => setShowProvinceList(false), 150)}
            placeholder="พิมพ์ค้นหาจังหวัด..."
            autoComplete="off"
            ref={provinceInputRef}
            required
          />

          {showProvinceList && (
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
              {filteredProvinces.length === 0 && (
                <li style={{ padding: "8px", color: "#888" }}>ไม่พบจังหวัด</li>
              )}
              {filteredProvinces.map((p) => (
                <li
                  key={p}
                  style={{ padding: "8px", cursor: "pointer" }}
                  onMouseDown={() => {
                    setProvince(p);
                    setProvinceInput(p);
                    setShowProvinceList(false);
                  }}
                >
                  {p}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ fontSize: 13, color: '#444' }}>
          ตัวอย่างอีเมลสำหรับล็อกอิน: <code>{selectedProvinceKey ? `${selectedProvinceKey}@staff.local` : '-'}</code>
        </div>



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
          <div style={{ color: "#166534", background: "#dcfce7", padding: "0.5rem", borderRadius: 6, textAlign: "center" }}>
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
