import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import countries from "i18n-iso-countries";
import { parse } from "csv-parse/sync";
import XLSX from "xlsx";
import { pool } from "../db/pool.js";

const require = createRequire(import.meta.url);
countries.registerLocale(require("i18n-iso-countries/langs/en.json"));
const { readFile: readWorkbook, utils } = XLSX;

type CsvRow = {
  data_id?: string;
  event_id_cnty?: string;
  event_id?: string;
  event_date?: string;
  event_type?: string;
  sub_event_type?: string;
  actor2?: string;
  region?: string;
  Region?: string;
  country?: string;
  admin0_txt?: string;
  admin1?: string;
  admin1_txt?: string;
  location?: string;
  city_txt?: string;
  latitude?: string;
  longitude?: string;
  notes?: string;
  summary?: string;
  fatalities?: string;
  killed_low?: string;
  wounded_low?: string;
  status?: string;
  weapon_type_txt?: string;
  weapon_txt?: string;
  tt1_txt?: string;
  iso3?: string;
};

function toSlug(input: string, fallback: string): string {
  const normalized = input.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || fallback;
}

function toDeterministicUuid(seed: string): string {
  const hex = createHash("sha1").update(seed).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function parseEventDate(input: string | undefined): string {
  if (!input) {
    return new Date().toISOString();
  }

  const parsed = new Date(input);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  const alt = new Date(input.replace(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/, "$2 $1, $3"));
  if (!Number.isNaN(alt.getTime())) {
    return alt.toISOString();
  }

  return new Date().toISOString();
}

function toCountryCode2(alpha3: string | undefined): string {
  if (!alpha3) {
    return "UN";
  }
  const code = countries.alpha3ToAlpha2(alpha3.toUpperCase());
  return typeof code === "string" ? code : "UN";
}

function toCountryCode2FromName(countryName: string | undefined): string {
  if (!countryName) {
    return "UN";
  }

  const code = countries.getAlpha2Code(countryName.trim(), "en");
  return typeof code === "string" ? code : "UN";
}

function getRowsFromCsv(csvPath: string, csvContent: string): CsvRow[] {
  return parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: true
  }) as CsvRow[];
}

function getRowsFromXlsx(workbookPath: string): CsvRow[] {
  const workbook = readWorkbook(workbookPath, { cellDates: false });
  const preferredSheet = workbook.SheetNames.includes("dsat_attacks") ? "dsat_attacks" : workbook.SheetNames[0];
  const sheet = workbook.Sheets[preferredSheet];

  if (!sheet) {
    throw new Error(`Could not read worksheet from ${workbookPath}`);
  }

  const rows = utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false
  });

  return rows.map((row) => {
    const toStringValue = (value: unknown): string => (value == null ? "" : String(value).trim());
    const eventType = toStringValue(row.event_type) || "suicide_attack";
    const subEventType = toStringValue(row.sub_event_type) || toStringValue(row.weapon_txt) || toStringValue(row.weapon_type_txt);

    return {
      data_id: toStringValue(row.data_id),
      event_id_cnty: toStringValue(row.event_id_cnty),
      event_id: toStringValue(row.event_id),
      event_date: toStringValue(row.event_date),
      event_type: eventType,
      sub_event_type: subEventType,
      actor2: toStringValue(row.actor2) || toStringValue(row.tt1_txt),
      region: toStringValue(row.region) || toStringValue(row.Region),
      Region: toStringValue(row.Region),
      country: toStringValue(row.country) || toStringValue(row.admin0_txt),
      admin0_txt: toStringValue(row.admin0_txt),
      admin1: toStringValue(row.admin1) || toStringValue(row.admin1_txt),
      admin1_txt: toStringValue(row.admin1_txt),
      location: toStringValue(row.location) || toStringValue(row.city_txt),
      city_txt: toStringValue(row.city_txt),
      latitude: toStringValue(row.latitude),
      longitude: toStringValue(row.longitude),
      notes: toStringValue(row.notes) || toStringValue(row.summary),
      summary: toStringValue(row.summary),
      fatalities: toStringValue(row.fatalities) || toStringValue(row.killed_low),
      killed_low: toStringValue(row.killed_low),
      wounded_low: toStringValue(row.wounded_low),
      status: toStringValue(row.status),
      weapon_type_txt: toStringValue(row.weapon_type_txt),
      weapon_txt: toStringValue(row.weapon_txt),
      tt1_txt: toStringValue(row.tt1_txt),
      iso3: toStringValue(row.iso3)
    };
  });
}

async function run() {
  const importPath = process.env.CSV_IMPORT_PATH ?? path.resolve(process.cwd(), "../-338405971 - -338405971.csv");
  const ext = path.extname(importPath).toLowerCase();

  let rows: CsvRow[];
  if (ext === ".xlsx") {
    rows = getRowsFromXlsx(importPath);
  } else {
    const csvContent = await readFile(importPath, "utf8");
    rows = getRowsFromCsv(importPath, csvContent);
  }

  let upserted = 0;

  for (const row of rows) {
    const latitude = Number(row.latitude ?? "");
    const longitude = Number(row.longitude ?? "");
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      continue;
    }

    const idSeed = row.event_id_cnty || row.event_id || row.data_id || `${row.country}-${row.location}-${row.event_date}`;
    const id = toDeterministicUuid(idSeed);

    const title = `${row.sub_event_type || "Incident"} in ${row.location || row.country || "Unknown location"}`;
    const description = (row.notes || "Imported from CSV source.").slice(0, 7000);
    const occurredAt = parseEventDate(row.event_date);

    const countryName = row.country?.trim() || row.admin0_txt?.trim() || "Unknown";
    const countryCode = row.iso3 ? toCountryCode2(row.iso3) : toCountryCode2FromName(countryName);
    const regionName = row.admin1?.trim() || row.admin1_txt?.trim() || row.region?.trim() || row.Region?.trim() || null;
    const cityName = row.location?.trim() || row.city_txt?.trim() || null;

    const incidentCategory = toSlug(row.event_type || row.status || "incident", "incident");
    const attackType = toSlug(row.sub_event_type || row.weapon_txt || row.weapon_type_txt || "unknown", "unknown");
    const targetType = toSlug(row.actor2 || row.tt1_txt || "unknown", "unknown");

    const killedCount = Math.max(0, Number.parseInt(row.fatalities || row.killed_low || "0", 10) || 0);
    const injuredCount = Math.max(0, Number.parseInt(row.wounded_low || "0", 10) || 0);

    await pool.query(
      `
      INSERT INTO incidents (
        id,
        title,
        description,
        occurred_at,
        country_code,
        country_name,
        region_name,
        city_name,
        location,
        incident_category,
        attack_type,
        target_type,
        killed_count,
        injured_count,
        confidence_level,
        verification_status,
        ai_summary
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        ST_SetSRID(ST_MakePoint($9, $10), 4326)::geography,
        $11,
        $12,
        $13,
        $14,
        $15,
        4,
        'verified',
        $16
      )
      ON CONFLICT (id)
      DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        occurred_at = EXCLUDED.occurred_at,
        country_code = EXCLUDED.country_code,
        country_name = EXCLUDED.country_name,
        region_name = EXCLUDED.region_name,
        city_name = EXCLUDED.city_name,
        location = EXCLUDED.location,
        incident_category = EXCLUDED.incident_category,
        attack_type = EXCLUDED.attack_type,
        target_type = EXCLUDED.target_type,
        killed_count = EXCLUDED.killed_count,
        injured_count = EXCLUDED.injured_count,
        confidence_level = EXCLUDED.confidence_level,
        verification_status = EXCLUDED.verification_status,
        ai_summary = EXCLUDED.ai_summary,
        updated_at = now()
      `,
      [
        id,
        title,
        description,
        occurredAt,
        countryCode,
        countryName,
        regionName,
        cityName,
        longitude,
        latitude,
        incidentCategory,
        attackType,
        targetType,
        killedCount,
        injuredCount,
        `Imported CSV event: ${row.event_id_cnty || row.data_id || "n/a"}`
      ]
    );

    upserted += 1;
  }

  console.log(`Import complete. rows=${rows.length}, upserted=${upserted}, source=${importPath}`);
}

run()
  .catch((error) => {
    console.error("CSV import failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
