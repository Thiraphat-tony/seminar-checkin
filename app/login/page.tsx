"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabaseBrowser";
type CourtOption = {
  id: string;
  court_name: string;
  max_staff: number | null;
};

function courtIdToEmail(courtId: string, slot = 0) {
  return slot > 0 ? `${courtId}+${slot}@staff.local` : `${courtId}@staff.local`;
}

export default function LoginPage() {
  const router = useRouter();

  const [courtName, setCourtName] = useState("");
  const [courtInput, setCourtInput] = useState("");
  const [showCourtList, setShowCourtList] = useState(false);
  const courtInputRef = useRef<HTMLInputElement>(null);

  const [courts, setCourts] = useState<CourtOption[]>([]);
  const [courtsLoading, setCourtsLoading] = useState(true);
  const [courtsError, setCourtsError] = useState("");

  /* const provinces = [
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
  ]; */

  const filteredCourts = courtInput
    ? courts.filter((c) => c.court_name.includes(courtInput))
    : courts;

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
        if (active) {
          setCourtsError(err?.message || "โหลดรายชื่อศาลไม่สำเร็จ");
        }
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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const supabase = useMemo(() => {
    try {
      return getBrowserClient();
    } catch {
      return null;
    }
  }, []);

  const checkStaffExists = async (courtId: string) => {
    try {
      const res = await fetch(`/api/staff/exists?court_id=${encodeURIComponent(courtId)}`, {
        cache: "no-store",
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) return null;
      return Boolean(payload.exists);
    } catch {
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!supabase) {
      setError("ไม่พบการตั้งค่า Supabase (ตรวจ .env.local)");
      setLoading(false);
      return;
    }

    /* const typed = (provinceInput || "").trim();
    const chosen = (province || "").trim();
    const selectedProvince = chosen || (provinces.includes(typed) ? typed : "");

    if (!selectedProvince) {
      setError("กรุณาเลือกศาล");
      setLoading(false);
      return;
    } */

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

    const typed = (courtInput || "").trim();
    const chosen = (courtName || "").trim();
    const selectedName = chosen || typed;
    const selectedCourt = courts.find((c) => c.court_name === selectedName);

    if (!selectedCourt) {
      setError("กรุณาเลือกศาลจากรายการ");
      setLoading(false);
      return;
    }

    if (!password.trim()) {
      setError("กรุณากรอกรหัสผ่าน");
      setLoading(false);
      return;
    }

    try {
      const trimmedPassword = password.trim();
      const baseEmail = courtIdToEmail(selectedCourt.id, 0);
      let signInData = await supabase.auth.signInWithPassword({
        email: baseEmail,
        password: trimmedPassword,
      });

      let { data, error: signInErr } = signInData;
      const maxStaffSlots = Math.max(1, selectedCourt.max_staff ?? 1);

      if ((signInErr || !data.session) && maxStaffSlots > 1) {
        for (let slot = 1; slot < maxStaffSlots; slot += 1) {
          const altEmail = courtIdToEmail(selectedCourt.id, slot);
          signInData = await supabase.auth.signInWithPassword({
            email: altEmail,
            password: trimmedPassword,
          });

          if (!signInData.error && signInData.data.session) {
            data = signInData.data;
            signInErr = null;
            break;
          }
        }
      }

      if (signInErr || !data.session) {
        const exists = await checkStaffExists(selectedCourt.id);
        if (exists === false) {
          setError("ยังไม่ได้สมัครเจ้าหน้าที่ กรุณาสมัครก่อน");
        } else {
          setError("ศาลหรือรหัสผ่านไม่ถูกต้อง");
        }
        setLoading(false);
        return;
      }

      try {
        document.cookie = `sb-access-token=${data.session.access_token}; path=/; max-age=3600; SameSite=Lax`;
      } catch (e) {
        void e;
      }

      router.push("/");
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>เข้าสู่ระบบ การประชุมสัมมนาทางวิชาการ ผู้พิพากษาสมทบในศาลเยาวชนและครอบครัวทั่วราชอาณาจักร ประจำปี ๒๕๖๙</h2>

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
              {filteredCourts.length === 0 && (
                <li style={{ padding: "8px 12px", color: "#64748b" }}>ไม่พบศาล</li>
              )}
              {filteredCourts.map((court) => (
                <li
                  key={court.id}
                  style={{ padding: "8px 12px", cursor: "pointer" }}
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
