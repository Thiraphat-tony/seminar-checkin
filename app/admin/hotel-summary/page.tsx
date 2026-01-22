// app/admin/hotel-summary/page.tsx
import * as React from "react";
import { createServerClient } from "@/lib/supabaseServer";
import ExportXlsxButton from "./ExportXlsxButton";
import "./summary.css";

export const dynamic = "force-dynamic";

type Row = {
  region: number | null;
  hotel_name: string | null;
  food_type: string | null;
  checked_in_at: string | null;
};

const REGION_LABELS: Record<number, string> = {
  0: "ภาค 0 (ศาลเยาวชนและครอบครัวกลาง - กรุงเทพมหานคร)",
  1: "ภาค 1",
  2: "ภาค 2",
  3: "ภาค 3",
  4: "ภาค 4",
  5: "ภาค 5",
  6: "ภาค 6",
  7: "ภาค 7",
  8: "ภาค 8",
  9: "ภาค 9",
};

function normalizeHotelName(name: string | null): string {
  const v = (name ?? "").trim();
  return v.length ? v : "ไม่ระบุโรงแรม";
}

const FOOD_KEYS = ["normal", "vegetarian", "halal", "unknown"] as const;
type FoodKey = (typeof FOOD_KEYS)[number];

const FOOD_LABELS: Record<FoodKey, string> = {
  normal: "ปกติ",
  vegetarian: "มังสวิรัติ",
  halal: "ฮาลาล",
  unknown: "ไม่ระบุ/อื่น ๆ",
};

function normalizeFoodType(v: string | null): FoodKey {
  const t = (v ?? "").trim().toLowerCase();
  if (t === "normal" || t === "vegetarian" || t === "halal") return t;
  return "unknown";
}

export default async function HotelSummaryPage() {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("attendees")
    .select("region, hotel_name, food_type, checked_in_at")
    .order("region", { ascending: true });

  if (error) {
    return (
      <main className="hsPage">
        <div className="hsTop">
          <h1 className="hsTitle">สรุป (ภาค 0–9)</h1>
        </div>

        <div className="hsAlert hsAlertError">
          โหลดข้อมูลไม่สำเร็จ: {error.message}
        </div>
      </main>
    );
  }

  const rows = (data ?? []) as Row[];
  const regions = Array.from({ length: 10 }, (_, i) => i);

  // =========================
  // 1) สรุปโรงแรม
  // =========================
  const hotelSet = new Set<string>();
  for (const r of rows) hotelSet.add(normalizeHotelName(r.hotel_name));
  const hotels = Array.from(hotelSet).sort((a, b) => a.localeCompare(b, "th"));

  const hotelCountMap: Record<number, Record<string, number>> = {};
  const hotelRowTotals: Record<number, number> = {};
  const hotelColTotals: Record<string, number> = {};
  let grandTotal = 0;

  for (const region of regions) {
    hotelCountMap[region] = {};
    hotelRowTotals[region] = 0;
  }
  for (const h of hotels) hotelColTotals[h] = 0;

  for (const r of rows) {
    const region = typeof r.region === "number" ? r.region : -1;
    if (region < 0 || region > 9) continue;

    const hotel = normalizeHotelName(r.hotel_name);

    hotelCountMap[region][hotel] = (hotelCountMap[region][hotel] ?? 0) + 1;
    hotelRowTotals[region] += 1;
    hotelColTotals[hotel] = (hotelColTotals[hotel] ?? 0) + 1;
    grandTotal += 1;
  }

  // =========================
  // 2) สรุปยอดอาหาร
  // =========================
  const foodCountMap: Record<number, Record<FoodKey, number>> = {};
  const foodRowTotals: Record<number, number> = {};
  const foodColTotals: Record<FoodKey, number> = {
    normal: 0,
    vegetarian: 0,
    halal: 0,
    unknown: 0,
  };

  for (const region of regions) {
    foodCountMap[region] = { normal: 0, vegetarian: 0, halal: 0, unknown: 0 };
    foodRowTotals[region] = 0;
  }

  for (const r of rows) {
    const region = typeof r.region === "number" ? r.region : -1;
    if (region < 0 || region > 9) continue;

    const key = normalizeFoodType(r.food_type);

    foodCountMap[region][key] += 1;
    foodRowTotals[region] += 1;
    foodColTotals[key] += 1;
  }

  // =========================
  // 3) Participant + Check-in counts per region
  // =========================
  const regionParticipantCounts: Record<number, { total: number; checked: number }> = {};
  let regionTotalAll = 0;
  let regionCheckedAll = 0;

  for (const region of regions) {
    regionParticipantCounts[region] = { total: 0, checked: 0 };
  }

  for (const r of rows) {
    const region = typeof r.region === "number" ? r.region : -1;
    if (region < 0 || region > 9) continue;

    regionParticipantCounts[region].total += 1;
    regionTotalAll += 1;

    if (r.checked_in_at) {
      regionParticipantCounts[region].checked += 1;
      regionCheckedAll += 1;
    }
  }

  return (
    <main className="hsPage">
      <div className="hsTop">
        <div>
          <h1 className="hsTitle">สรุปผู้เข้าพัก + สรุปยอดอาหาร (ภาค 0–9)</h1>
          <p className="hsMeta">
            รวมทั้งหมด: <b>{grandTotal}</b> คน
          </p>
        </div>

        <div className="hsActions">
          <ExportXlsxButton />
        </div>
      </div>

      {/* ========================= */}
      {/* ตารางสรุปโรงแรม */}
      {/* ========================= */}
      <h2 className="hsSectionTitle">สรุปโรงแรม</h2>

      <div className="hsCard">
        <div className="hsTableScroll">
          <table className="hsTable hsTableHotel">
            <thead>
              <tr>
                <th className="hsStickyLeft hsTh">ภาค</th>
                {hotels.map((h) => (
                  <th key={h} className="hsTh">
                    {h}
                  </th>
                ))}
                <th className="hsTh">รวม</th>
              </tr>
            </thead>

            <tbody>
              {regions.map((region) => (
                <tr key={region}>
                  <td className="hsStickyLeft hsTd">
                    {REGION_LABELS[region] ?? `ภาค ${region}`}
                  </td>

                  {hotels.map((h) => (
                    <td key={h} className="hsTd hsNum">
                      {hotelCountMap[region][h] ?? 0}
                    </td>
                  ))}

                  <td className="hsTd hsNumStrong">{hotelRowTotals[region] ?? 0}</td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr>
                <td className="hsStickyLeft hsTd hsFootStrong">รวมทุกภาค</td>
                {hotels.map((h) => (
                  <td key={h} className="hsTd hsNumStrong hsFootStrong">
                    {hotelColTotals[h] ?? 0}
                  </td>
                ))}
                <td className="hsTd hsNumStrong hsFootStrong">{grandTotal}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ========================= */}
      {/* ตารางสรุปยอดอาหาร */}
      {/* ========================= */}
      <h2 className="hsSectionTitle">สรุปยอดอาหาร</h2>

      <div className="hsCard">
        <div className="hsTableScroll">
          <table className="hsTable hsTableFood">
            <thead>
              <tr>
                <th className="hsStickyLeft hsTh">ภาค</th>
                {FOOD_KEYS.map((k) => (
                  <th key={k} className="hsTh">
                    {FOOD_LABELS[k]}
                  </th>
                ))}
                <th className="hsTh">รวม</th>
              </tr>
            </thead>

            <tbody>
              {regions.map((region) => (
                <tr key={region}>
                  <td className="hsStickyLeft hsTd">
                    {REGION_LABELS[region] ?? `ภาค ${region}`}
                  </td>

                  {FOOD_KEYS.map((k) => (
                    <td key={k} className="hsTd hsNum">
                      {foodCountMap[region][k] ?? 0}
                    </td>
                  ))}

                  <td className="hsTd hsNumStrong">{foodRowTotals[region] ?? 0}</td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr>
                <td className="hsStickyLeft hsTd hsFootStrong">รวมทุกภาค</td>
                {FOOD_KEYS.map((k) => (
                  <td key={k} className="hsTd hsNumStrong hsFootStrong">
                    {foodColTotals[k] ?? 0}
                  </td>
                ))}
                <td className="hsTd hsNumStrong hsFootStrong">{grandTotal}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ========================= */}
      {/* สรุปผู้เข้าร่วม + เช็คอินตามภาค */}
      {/* ========================= */}
      <h2 className="hsSectionTitle">สรุปผู้เข้าร่วมและเช็คอินตามภาค</h2>

      <div className="hsCard">
        <div className="hsTableScroll">
          <table className="hsTable hsTableCounts">
            <thead>
              <tr>
                <th className="hsStickyLeft hsTh">ภาค</th>
                <th className="hsTh">ผู้เข้าร่วมทั้งหมด</th>
                <th className="hsTh">เช็คอินแล้ว</th>
              </tr>
            </thead>

            <tbody>
              {regions.map((region) => (
                <tr key={region}>
                  <td className="hsStickyLeft hsTd">
                    {REGION_LABELS[region] ?? `ภาค ${region}`}
                  </td>
                  <td className="hsTd hsNum">
                    {regionParticipantCounts[region]?.total ?? 0}
                  </td>
                  <td className="hsTd hsNum">
                    {regionParticipantCounts[region]?.checked ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr>
                <td className="hsStickyLeft hsTd hsFootStrong">รวมทุกภาค</td>
                <td className="hsTd hsNumStrong hsFootStrong">{regionTotalAll}</td>
                <td className="hsTd hsNumStrong hsFootStrong">{regionCheckedAll}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </main>
  );
}
