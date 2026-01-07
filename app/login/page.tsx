"use client";

import React, { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabaseBrowser";
import { makeProvinceKey } from "@/lib/provinceKeys";

function provinceToEmail(provinceName: string) {
  const localPart = makeProvinceKey(provinceName);
  return `${localPart}@staff.local`;
}

export default function LoginPage() {
  const router = useRouter();

  const [province, setProvince] = useState("");
  const [provinceInput, setProvinceInput] = useState("");
  const [showProvinceList, setShowProvinceList] = useState(false);
  const provinceInputRef = useRef<HTMLInputElement>(null);

  const provinces = [
    "กรุงเทพมหานคร",
    "กระบี่",
    "กาญจนบุรี",
    "กาฬสินธุ์",
    "กำแพงเพชร",
    "ขอนแก่น",
    "จันทบุรี",
    "ฉะเชิงเทรา",
    "ชลบุรี",
    "ชัยนาท",
    "ชัยภูมิ",
    "ชุมพร",
    "เชียงราย",
    "เชียงใหม่",
    "ตรัง",
    "ตราด",
    "ตาก",
    "นครนายก",
    "นครปฐม",
    "นครพนม",
    "นครราชสีมา",
    "นครศรีธรรมราช",
    "นครสวรรค์",
    "นนทบุรี",
    "นราธิวาส",
    "น่าน",
    "บึงกาฬ",
    "บุรีรัมย์",
    "ปทุมธานี",
    "ประจวบคีรีขันธ์",
    "ปราจีนบุรี",
    "ปัตตานี",
    "พระนครศรีอยุธยา",
    "พะเยา",
    "พังงา",
    "พัทลุง",
    "พิจิตร",
    "พิษณุโลก",
    "เพชรบุรี",
    "เพชรบูรณ์",
    "แพร่",
    "ภูเก็ต",
    "มหาสารคาม",
    "มุกดาหาร",
    "แม่ฮ่องสอน",
    "ยโสธร",
    "ยะลา",
    "ร้อยเอ็ด",
    "ระนอง",
    "ระยอง",
    "ราชบุรี",
    "ลพบุรี",
    "ลำปาง",
    "ลำพูน",
    "เลย",
    "ศรีสะเกษ",
    "สกลนคร",
    "สงขลา",
    "สตูล",
    "สมุทรปราการ",
    "สมุทรสงคราม",
    "สมุทรสาคร",
    "สระแก้ว",
    "สระบุรี",
    "สิงห์บุรี",
    "สุโขทัย",
    "สุพรรณบุรี",
    "สุราษฎร์ธานี",
    "สุรินทร์",
    "หนองคาย",
    "หนองบัวลำภู",
    "อ่างทอง",
    "อำนาจเจริญ",
    "อุดรธานี",
    "อุตรดิตถ์",
    "อุทัยธานี",
    "อุบลราชธานี",
  ];

  const filteredProvinces = provinceInput
    ? provinces.filter((p) => p.includes(provinceInput))
    : provinces;

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const supabase = useMemo(() => {
    try {
      return getBrowserClient();
    } catch {
      return null;
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!supabase) {
      setError("ไม่พบการตั้งค่า Supabase (ตรวจ .env.local)");
      setLoading(false);
      return;
    }

    const typed = (provinceInput || "").trim();
    const chosen = (province || "").trim();
    const selectedProvince = chosen || (provinces.includes(typed) ? typed : "");

    if (!selectedProvince) {
      setError("กรุณาเลือกจังหวัด");
      setLoading(false);
      return;
    }

    if (!password.trim()) {
      setError("กรุณากรอกรหัสผ่าน");
      setLoading(false);
      return;
    }

    try {
      const email = provinceToEmail(selectedProvince);

      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password: password.trim(),
      });

      if (signInErr || !data.session) {
        setError("จังหวัดหรือรหัสผ่านไม่ถูกต้อง");
        setLoading(false);
        return;
      }

      try {
        document.cookie = `sb-access-token=${data.session.access_token}; path=/; max-age=3600; SameSite=Lax`;
      } catch (e) {
        void e;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>เข้าสู่ระบบ</h2>

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
            placeholder="พิมพ์เพื่อค้นหา..."
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
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                maxHeight: 180,
                overflowY: "auto",
                width: "100%",
                margin: "6px 0 0",
                padding: "6px 0",
                listStyle: "none",
                boxShadow: "0 8px 20px rgba(15, 23, 42, 0.12)",
              }}
            >
              {filteredProvinces.length === 0 && (
                <li style={{ padding: "8px 12px", color: "#64748b" }}>ไม่พบจังหวัด</li>
              )}
              {filteredProvinces.map((p) => (
                <li
                  key={p}
                  style={{ padding: "8px 12px", cursor: "pointer" }}
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

        <label htmlFor="password">รหัสผ่าน</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <div className="login-error">{error}</div>}

        <button type="submit" disabled={loading}>
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>

        <div style={{ textAlign: "center", marginTop: 6 }}>
          <Link href="/staff/register" style={{ color: "#667eea", textDecoration: "underline" }}>
            สมัครเจ้าหน้าที่ (Register)
          </Link>
        </div>
      </form>

      <style jsx>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f5f6fa;
          padding: 24px;
        }
        .login-form {
          background: #fff;
          padding: 2rem 2.5rem;
          border-radius: 12px;
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.12);
          display: flex;
          flex-direction: column;
          gap: 1rem;
          min-width: 320px;
          max-width: 420px;
          width: 100%;
        }
        .login-form h2 {
          margin-bottom: 0.5rem;
          text-align: center;
        }
        .login-form label {
          font-weight: 600;
        }
        .login-form input {
          padding: 0.6rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 1rem;
          background: #fff;
          width: 100%;
          box-sizing: border-box;
        }
        .login-form input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
        }
        .login-form button {
          background: #667eea;
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 0.75rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s, transform 0.2s;
        }
        .login-form button:hover {
          background: #5a67d8;
          transform: translateY(-1px);
        }
        .login-form button:disabled {
          background: #a5b4fc;
          cursor: not-allowed;
          transform: none;
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
