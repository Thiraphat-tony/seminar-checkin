// app/api/admin/export-hotel-food-summary-xlsx/route.ts
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createServerClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  region: number | null;
  province: string | null;
  court_id: string | null;
  hotel_name: string | null;
  food_type: string | null;
  slip_url: string | null;
  checkin_round1_at: string | null;
  checkin_round2_at: string | null;
  checkin_round3_at: string | null;
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

const UNKNOWN_COURT_LABEL = "ไม่ระบุศาล";

function normalizeHotelName(name: string | null): string {
  const v = (name ?? "").trim();
  return v.length ? v : "ไม่ระบุโรงแรม";
}

function normalizeCourtLabel(courtId: string | null, courtNameMap: Record<string, string>): string {
  if (!courtId) return UNKNOWN_COURT_LABEL;
  const mapped = (courtNameMap[courtId] ?? "").trim();
  return mapped || courtId;
}

const FOOD_KEYS = ["normal", "vegetarian", "halal"] as const;
type FoodKey = (typeof FOOD_KEYS)[number];

const FOOD_LABELS: Record<FoodKey, string> = {
  normal: "ปกติ",
  vegetarian: "มังสวิรัติ",
  halal: "ฮาลาล",
};

function normalizeFoodType(v: string | null): FoodKey {
  const t = (v ?? "").trim().toLowerCase();
  if (t === "normal") return "normal";
  if (t === "vegetarian" || t === "มังสวิรัติ" || t === "มังฯ") return "vegetarian";
  if (t === "halal" || t === "ฮาลาล" || t === "อิสลาม") return "halal";

  // ค่าเก่าหรืออื่น ๆ ให้รวมไปที่ "ปกติ" เพื่อให้สรุปเหลือ 3 อย่างตามฟอร์ม
  return "normal";
}

function isValidRegion(region: number | null): region is number {
  return typeof region === "number" && region >= 0 && region <= 9;
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  row.height = 22;
}

function applyBorders(ws: ExcelJS.Worksheet, fromRow: number, toRow: number, fromCol: number, toCol: number) {
  for (let r = fromRow; r <= toRow; r++) {
    for (let c = fromCol; c <= toCol; c++) {
      const cell = ws.getCell(r, c);
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }
  }
}

function autosizeColumns(ws: ExcelJS.Worksheet, maxWidth = 50) {
  ws.columns?.forEach((col) => {
    let maxLen = 10;
    col.eachCell?.((cell) => {
      const v = cell.value;
      const text =
        v == null
          ? ""
          : typeof v === "string"
          ? v
          : typeof v === "number"
          ? String(v)
          : "richText" in (v as any)
          ? JSON.stringify(v)
          : String(v);

      maxLen = Math.max(maxLen, text.length);
    });
    col.width = Math.min(maxWidth, maxLen + 2);
  });
}

export async function GET() {
  const supabase = await createServerClient();

  const eventId = (process.env.EVENT_ID ?? "").trim();
  if (!eventId) {
    return NextResponse.json({ ok: false, message: "MISSING_EVENT_ID" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("v_attendees_checkin_rounds")
    .select("region, province, court_id, hotel_name, food_type, slip_url, checkin_round1_at, checkin_round2_at, checkin_round3_at")
    .eq("event_id", eventId)
    .order("region", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Row[];
  const regions = Array.from({ length: 10 }, (_, i) => i);

  // ====== Courts list (for summary & hotel pivot) ======
  const courtIdSet = new Set<string>();
  for (const r of rows) {
    if (r.court_id) courtIdSet.add(r.court_id);
  }

  let courtNameMap: Record<string, string> = {};
  if (courtIdSet.size > 0) {
    const { data: courts, error: courtErr } = await supabase
      .from("courts")
      .select("id, court_name")
      .in("id", Array.from(courtIdSet));

    if (courtErr) {
      return NextResponse.json({ ok: false, message: courtErr.message }, { status: 500 });
    }

    courtNameMap = (courts ?? []).reduce<Record<string, string>>((acc, c) => {
      const id = (c as { id: string; court_name?: string | null }).id;
      const name = ((c as { court_name?: string | null }).court_name ?? "").trim();
      acc[id] = name || id;
      return acc;
    }, {});
  }

  // ====== Hotels list ======
  const hotelSet = new Set<string>();
  const courtLabelSet = new Set<string>();
  for (const r of rows) {
    if (!isValidRegion(r.region)) continue;
    hotelSet.add(normalizeHotelName(r.hotel_name));
    courtLabelSet.add(normalizeCourtLabel(r.court_id, courtNameMap));
  }
  const hotels = Array.from(hotelSet).sort((a, b) => a.localeCompare(b, "th"));
  const courts = Array.from(courtLabelSet).sort((a, b) => a.localeCompare(b, "th"));

  // ====== Pivot: hotel counts (by court) ======
  const hotelCount: Record<string, Record<string, number>> = {};
  const hotelRowTotals: Record<string, number> = {};
  const hotelColTotals: Record<string, number> = {};
  let grandTotal = 0;

  for (const court of courts) {
    hotelCount[court] = {};
    hotelRowTotals[court] = 0;
  }
  for (const h of hotels) hotelColTotals[h] = 0;

  for (const r of rows) {
    if (!isValidRegion(r.region)) continue;
    const court = normalizeCourtLabel(r.court_id, courtNameMap);
    const h = normalizeHotelName(r.hotel_name);
    hotelCount[court][h] = (hotelCount[court][h] ?? 0) + 1;
    hotelRowTotals[court] += 1;
    hotelColTotals[h] = (hotelColTotals[h] ?? 0) + 1;
    grandTotal += 1;
  }

  // ====== Pivot: food counts ======
  const foodCount: Record<number, Record<FoodKey, number>> = {};
  const foodRowTotals: Record<number, number> = {};
  const foodColTotals: Record<FoodKey, number> = {
    normal: 0,
    vegetarian: 0,
    halal: 0,
  };

  for (const region of regions) {
    foodCount[region] = {
      normal: 0,
      vegetarian: 0,
      halal: 0,
    };
    foodRowTotals[region] = 0;
  }

  for (const r of rows) {
    if (!isValidRegion(r.region)) continue;
    const region = r.region;

    const key = normalizeFoodType(r.food_type);
    foodCount[region][key] += 1;
    foodRowTotals[region] += 1;
    foodColTotals[key] += 1;
  }

  // ====== Summary: participants vs registration per region (3 rounds) ======
  const regionTotals: Record<number, { total: number; round1: number; round2: number; round3: number }> = {};
  let regionTotalAll = 0;
  let regionRound1All = 0;
  let regionRound2All = 0;
  let regionRound3All = 0;

  for (const region of regions) {
    regionTotals[region] = { total: 0, round1: 0, round2: 0, round3: 0 };
  }

  for (const r of rows) {
    if (!isValidRegion(r.region)) continue;
    const region = r.region;
    regionTotals[region].total += 1;
    regionTotalAll += 1;

    if (r.checkin_round1_at) {
      regionTotals[region].round1 += 1;
      regionRound1All += 1;
    }
    if (r.checkin_round2_at) {
      regionTotals[region].round2 += 1;
      regionRound2All += 1;
    }
    if (r.checkin_round3_at) {
      regionTotals[region].round3 += 1;
      regionRound3All += 1;
    }
  }

  // ====== Summary: participants vs registration per court (3 rounds) ======
  const courtTotals: Record<string, { total: number; round1: number; round2: number; round3: number }> = {};
  let courtTotalAll = 0;
  let courtRound1All = 0;
  let courtRound2All = 0;
  let courtRound3All = 0;

  for (const r of rows) {
    const courtId = r.court_id ?? "unknown";
    if (!courtTotals[courtId]) {
      courtTotals[courtId] = { total: 0, round1: 0, round2: 0, round3: 0 };
    }

    courtTotals[courtId].total += 1;
    courtTotalAll += 1;

    if (r.checkin_round1_at) {
      courtTotals[courtId].round1 += 1;
      courtRound1All += 1;
    }
    if (r.checkin_round2_at) {
      courtTotals[courtId].round2 += 1;
      courtRound2All += 1;
    }
    if (r.checkin_round3_at) {
      courtTotals[courtId].round3 += 1;
      courtRound3All += 1;
    }
  }

  // ====== Build workbook ======
  const wb = new ExcelJS.Workbook();
  wb.creator = "Attendee System";
  wb.created = new Date();

  // Sheet 1: Hotels
  const wsHotel = wb.addWorksheet("Hotel Summary", { views: [{ state: "frozen", xSplit: 1, ySplit: 1 }] });

  wsHotel.addRow(["ศาล", ...hotels, "รวม"]);
  styleHeaderRow(wsHotel.getRow(1));

  for (const court of courts) {
    const line = [
      court,
      ...hotels.map((h) => hotelCount[court][h] ?? 0),
      hotelRowTotals[court] ?? 0,
    ];
    wsHotel.addRow(line);
  }

  wsHotel.addRow(["รวมทุกศาล", ...hotels.map((h) => hotelColTotals[h] ?? 0), grandTotal]);
  wsHotel.getRow(wsHotel.rowCount).font = { bold: true };

  // Align numbers
  for (let r = 2; r <= wsHotel.rowCount; r++) {
    for (let c = 2; c <= hotels.length + 2; c++) {
      wsHotel.getCell(r, c).alignment = { horizontal: "center", vertical: "middle" };
    }
    wsHotel.getCell(r, 1).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  }

  applyBorders(wsHotel, 1, wsHotel.rowCount, 1, hotels.length + 2);
  autosizeColumns(wsHotel);

  // Sheet 2: Food
  const wsFood = wb.addWorksheet("Food Summary", { views: [{ state: "frozen", xSplit: 1, ySplit: 1 }] });

  wsFood.addRow(["ภาค", ...FOOD_KEYS.map((k) => FOOD_LABELS[k]), "รวม"]);
  styleHeaderRow(wsFood.getRow(1));

  for (const region of regions) {
    const label = REGION_LABELS[region] ?? `ภาค ${region}`;
    const line = [
      label,
      ...FOOD_KEYS.map((k) => foodCount[region][k] ?? 0),
      foodRowTotals[region] ?? 0,
    ];
    wsFood.addRow(line);
  }

  wsFood.addRow(["รวมทุกภาค", ...FOOD_KEYS.map((k) => foodColTotals[k] ?? 0), grandTotal]);
  wsFood.getRow(wsFood.rowCount).font = { bold: true };

  for (let r = 2; r <= wsFood.rowCount; r++) {
    for (let c = 2; c <= FOOD_KEYS.length + 2; c++) {
      wsFood.getCell(r, c).alignment = { horizontal: "center", vertical: "middle" };
    }
    wsFood.getCell(r, 1).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  }

  applyBorders(wsFood, 1, wsFood.rowCount, 1, FOOD_KEYS.length + 2);
  autosizeColumns(wsFood);

  // Sheet 3: Court summary
  const wsCourt = wb.addWorksheet("Court Summary", {
    views: [{ state: "frozen", xSplit: 1, ySplit: 1 }],
  });
  wsCourt.addRow(["ศาล", "ผู้เข้าร่วมทั้งหมด", "ลงทะเบียนรอบ 1", "ลงทะเบียนรอบ 2", "ลงทะเบียนรอบ 3"]);
  styleHeaderRow(wsCourt.getRow(1));

  const sortedCourtIds = Object.keys(courtTotals).sort((a, b) => {
    const nameA =
      a === "unknown" ? UNKNOWN_COURT_LABEL : (courtNameMap[a] ?? a).trim();
    const nameB =
      b === "unknown" ? UNKNOWN_COURT_LABEL : (courtNameMap[b] ?? b).trim();
    return nameA.localeCompare(nameB, "th");
  });

  for (const courtId of sortedCourtIds) {
    wsCourt.addRow([
      courtId === "unknown" ? UNKNOWN_COURT_LABEL : courtNameMap[courtId] ?? courtId,
      courtTotals[courtId]?.total ?? 0,
      courtTotals[courtId]?.round1 ?? 0,
      courtTotals[courtId]?.round2 ?? 0,
      courtTotals[courtId]?.round3 ?? 0,
    ]);
  }

  wsCourt.addRow(["รวมทุกศาล", courtTotalAll, courtRound1All, courtRound2All, courtRound3All]);
  wsCourt.getRow(wsCourt.rowCount).font = { bold: true };

  for (let r = 2; r <= wsCourt.rowCount; r++) {
    for (let c = 2; c <= 5; c++) {
      wsCourt.getCell(r, c).alignment = { horizontal: "center", vertical: "middle" };
    }
    wsCourt.getCell(r, 1).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  }

  applyBorders(wsCourt, 1, wsCourt.rowCount, 1, 5);
  autosizeColumns(wsCourt);

  // Sheet 4: Registration summary by region
  const wsCheckin = wb.addWorksheet("Checkin Summary", {
    views: [{ state: "frozen", xSplit: 1, ySplit: 1 }],
  });
  wsCheckin.addRow(["ภาค", "ผู้เข้าร่วมทั้งหมด", "ลงทะเบียนรอบ 1", "ลงทะเบียนรอบ 2", "ลงทะเบียนรอบ 3"]);
  styleHeaderRow(wsCheckin.getRow(1));

  for (const region of regions) {
    const label = REGION_LABELS[region] ?? `ภาค ${region}`;
    wsCheckin.addRow([
      label,
      regionTotals[region]?.total ?? 0,
      regionTotals[region]?.round1 ?? 0,
      regionTotals[region]?.round2 ?? 0,
      regionTotals[region]?.round3 ?? 0,
    ]);
  }

  wsCheckin.addRow(["รวมทุกภาค", regionTotalAll, regionRound1All, regionRound2All, regionRound3All]);
  wsCheckin.getRow(wsCheckin.rowCount).font = { bold: true };

  for (let r = 2; r <= wsCheckin.rowCount; r++) {
    for (let c = 2; c <= 5; c++) {
      wsCheckin.getCell(r, c).alignment = { horizontal: "center", vertical: "middle" };
    }
    wsCheckin.getCell(r, 1).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  }

  applyBorders(wsCheckin, 1, wsCheckin.rowCount, 1, 5);
  autosizeColumns(wsCheckin);

  const buf = await wb.xlsx.writeBuffer();

  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const filename = `hotel_food_summary_${y}-${m}-${d}.xlsx`;

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
