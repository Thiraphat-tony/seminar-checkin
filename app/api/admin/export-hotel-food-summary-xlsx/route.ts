// app/api/admin/export-hotel-food-summary-xlsx/route.ts
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createServerClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  region: number | null;
  province: string | null;
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

const UNKNOWN_PROVINCE_LABEL = "ไม่ระบุจังหวัด";

function normalizeHotelName(name: string | null): string {
  const v = (name ?? "").trim();
  return v.length ? v : "ไม่ระบุโรงแรม";
}

function normalizeProvince(name: string | null): string {
  const v = (name ?? "").trim();
  return v.length ? v : UNKNOWN_PROVINCE_LABEL;
}

const FOOD_KEYS = [
  "normal",
  "no_pork",
  "vegetarian",
  "vegan",
  "halal",
  "seafood_allergy",
  "other",
  "unknown",
] as const;
type FoodKey = (typeof FOOD_KEYS)[number];

const FOOD_LABELS: Record<FoodKey, string> = {
  normal: "ปกติ",
  no_pork: "ไม่ทานหมู",
  vegetarian: "มังสวิรัติ",
  vegan: "เจ / วีแกน",
  halal: "ฮาลาล",
  seafood_allergy: "แพ้อาหารทะเล",
  other: "อื่น ๆ",
  unknown: "ไม่ระบุ",
};

function normalizeFoodType(v: string | null): FoodKey {
  const t = (v ?? "").trim().toLowerCase();
  if (
    t === "normal" ||
    t === "no_pork" ||
    t === "vegetarian" ||
    t === "vegan" ||
    t === "halal" ||
    t === "seafood_allergy" ||
    t === "other"
  ) {
    return t as FoodKey;
  }
  if (t === "ไม่ทานหมู" || t === "งดหมู" || t === "ไม่กินหมู") return "no_pork";
  if (t === "มังสวิรัติ" || t === "มังฯ") return "vegetarian";
  if (t === "เจ" || t === "อาหารเจ" || t === "วีแกน") return "vegan";
  if (t === "ฮาลาล" || t === "อิสลาม") return "halal";
  if (t === "แพ้อาหารทะเล" || t === "แพ้ซีฟู้ด") return "seafood_allergy";
  if (t === "อื่น" || t === "อื่นๆ" || t === "อื่น ๆ") return "other";
  return "unknown";
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
    .select("region, province, hotel_name, food_type, slip_url, checkin_round1_at, checkin_round2_at, checkin_round3_at")
    .eq("event_id", eventId)
    .order("region", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Row[];
  const regions = Array.from({ length: 10 }, (_, i) => i);

  // ====== Hotels list ======
  const hotelSet = new Set<string>();
  const provinceSet = new Set<string>();
  for (const r of rows) {
    if (!isValidRegion(r.region)) continue;
    hotelSet.add(normalizeHotelName(r.hotel_name));
    provinceSet.add(normalizeProvince(r.province));
  }
  const hotels = Array.from(hotelSet).sort((a, b) => a.localeCompare(b, "th"));
  const provinces = Array.from(provinceSet).sort((a, b) => {
    if (a === UNKNOWN_PROVINCE_LABEL && b === UNKNOWN_PROVINCE_LABEL) return 0;
    if (a === UNKNOWN_PROVINCE_LABEL) return 1;
    if (b === UNKNOWN_PROVINCE_LABEL) return -1;
    return a.localeCompare(b, "th");
  });

  // ====== Pivot: hotel counts ======
  const hotelCount: Record<string, Record<string, number>> = {};
  const hotelRowTotals: Record<string, number> = {};
  const hotelColTotals: Record<string, number> = {};
  let grandTotal = 0;

  for (const province of provinces) {
    hotelCount[province] = {};
    hotelRowTotals[province] = 0;
  }
  for (const h of hotels) hotelColTotals[h] = 0;

  for (const r of rows) {
    if (!isValidRegion(r.region)) continue;
    const province = normalizeProvince(r.province);
    const h = normalizeHotelName(r.hotel_name);
    hotelCount[province][h] = (hotelCount[province][h] ?? 0) + 1;
    hotelRowTotals[province] += 1;
    hotelColTotals[h] = (hotelColTotals[h] ?? 0) + 1;
    grandTotal += 1;
  }

  // ====== Pivot: food counts ======
  const foodCount: Record<number, Record<FoodKey, number>> = {};
  const foodRowTotals: Record<number, number> = {};
  const foodColTotals: Record<FoodKey, number> = {
    normal: 0,
    no_pork: 0,
    vegetarian: 0,
    vegan: 0,
    halal: 0,
    seafood_allergy: 0,
    other: 0,
    unknown: 0,
  };

  for (const region of regions) {
    foodCount[region] = {
      normal: 0,
      no_pork: 0,
      vegetarian: 0,
      vegan: 0,
      halal: 0,
      seafood_allergy: 0,
      other: 0,
      unknown: 0,
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

  // ====== Summary: participants vs check-in per region ======
  const regionTotals: Record<number, { total: number; checked: number }> = {};
  let regionTotalAll = 0;
  let regionCheckedAll = 0;

  for (const region of regions) {
    regionTotals[region] = { total: 0, checked: 0 };
  }

  for (const r of rows) {
    if (!isValidRegion(r.region)) continue;
    const region = r.region;
    regionTotals[region].total += 1;
    regionTotalAll += 1;

    const hasCheckin =
      !!r.checkin_round1_at || !!r.checkin_round2_at || !!r.checkin_round3_at;
    if (hasCheckin) {
      regionTotals[region].checked += 1;
      regionCheckedAll += 1;
    }
  }

  // ====== Build workbook ======
  const wb = new ExcelJS.Workbook();
  wb.creator = "Attendee System";
  wb.created = new Date();

  // Sheet 1: Hotels
  const wsHotel = wb.addWorksheet("Hotel Summary", { views: [{ state: "frozen", xSplit: 1, ySplit: 1 }] });

  wsHotel.addRow(["จังหวัด", ...hotels, "รวม"]);
  styleHeaderRow(wsHotel.getRow(1));

  for (const province of provinces) {
    const line = [
      province,
      ...hotels.map((h) => hotelCount[province][h] ?? 0),
      hotelRowTotals[province] ?? 0,
    ];
    wsHotel.addRow(line);
  }

  wsHotel.addRow(["รวมทุกจังหวัด", ...hotels.map((h) => hotelColTotals[h] ?? 0), grandTotal]);
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

  // (Optional) Sheet 3: Raw
  const wsRaw = wb.addWorksheet("Raw (Attendees)");
  wsRaw.addRow([
    "region",
    "province",
    "hotel_name",
    "food_type",
    "slip_url",
    "checkin_round1_at",
    "checkin_round2_at",
    "checkin_round3_at",
  ]);
  styleHeaderRow(wsRaw.getRow(1));
  for (const r of rows) {
    wsRaw.addRow([
      r.region ?? "",
      normalizeProvince(r.province),
      normalizeHotelName(r.hotel_name),
      normalizeFoodType(r.food_type),
      r.slip_url ?? "",
      r.checkin_round1_at ?? "",
      r.checkin_round2_at ?? "",
      r.checkin_round3_at ?? "",
    ]);
  }
  applyBorders(wsRaw, 1, wsRaw.rowCount, 1, 8);
  autosizeColumns(wsRaw, 40);

  // Sheet 4: Check-in summary by region
  const wsCheckin = wb.addWorksheet("Checkin Summary", {
    views: [{ state: "frozen", xSplit: 1, ySplit: 1 }],
  });
  wsCheckin.addRow(["ภาค", "ผู้เข้าร่วมทั้งหมด", "เช็กอินแล้ว"]);
  styleHeaderRow(wsCheckin.getRow(1));

  for (const region of regions) {
    const label = REGION_LABELS[region] ?? `ภาค ${region}`;
    wsCheckin.addRow([
      label,
      regionTotals[region]?.total ?? 0,
      regionTotals[region]?.checked ?? 0,
    ]);
  }

  wsCheckin.addRow(["รวมทุกภาค", regionTotalAll, regionCheckedAll]);
  wsCheckin.getRow(wsCheckin.rowCount).font = { bold: true };

  for (let r = 2; r <= wsCheckin.rowCount; r++) {
    for (let c = 2; c <= 3; c++) {
      wsCheckin.getCell(r, c).alignment = { horizontal: "center", vertical: "middle" };
    }
    wsCheckin.getCell(r, 1).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  }

  applyBorders(wsCheckin, 1, wsCheckin.rowCount, 1, 3);
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
