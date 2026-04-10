import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import countries from "i18n-iso-countries";
import { parse } from "csv-parse/sync";
import { pool } from "../db/pool.js";
function toSlug(input, fallback) {
    const normalized = input.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    return normalized || fallback;
}
function toDeterministicUuid(seed) {
    const hex = createHash("sha1").update(seed).digest("hex").slice(0, 32);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
function parseEventDate(input) {
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
function toCountryCode2(alpha3) {
    if (!alpha3) {
        return "UN";
    }
    const code = countries.alpha3ToAlpha2(alpha3.toUpperCase());
    return typeof code === "string" ? code : "UN";
}
async function run() {
    const csvPath = process.env.CSV_IMPORT_PATH ?? path.resolve(process.cwd(), "../-338405971 - -338405971.csv");
    const csvContent = await readFile(csvPath, "utf8");
    const rows = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
        trim: true
    });
    let upserted = 0;
    for (const row of rows) {
        const latitude = Number(row.latitude ?? "");
        const longitude = Number(row.longitude ?? "");
        if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
            continue;
        }
        const idSeed = row.event_id_cnty || row.data_id || `${row.country}-${row.location}-${row.event_date}`;
        const id = toDeterministicUuid(idSeed);
        const title = `${row.sub_event_type || "Incident"} in ${row.location || row.country || "Unknown location"}`;
        const description = (row.notes || "Imported from CSV source.").slice(0, 7000);
        const occurredAt = parseEventDate(row.event_date);
        const countryName = row.country?.trim() || "Unknown";
        const countryCode = toCountryCode2(row.iso3);
        const regionName = row.admin1?.trim() || row.region?.trim() || null;
        const cityName = row.location?.trim() || null;
        const incidentCategory = toSlug(row.event_type || "incident", "incident");
        const attackType = toSlug(row.sub_event_type || "unknown", "unknown");
        const targetType = toSlug(row.actor2 || "unknown", "unknown");
        const killedCount = Math.max(0, Number.parseInt(row.fatalities || "0", 10) || 0);
        await pool.query(`
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
      `, [
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
            0,
            `Imported CSV event: ${row.event_id_cnty || row.data_id || "n/a"}`
        ]);
        upserted += 1;
    }
    console.log(`CSV import complete. rows=${rows.length}, upserted=${upserted}, source=${csvPath}`);
}
run()
    .catch((error) => {
    console.error("CSV import failed:", error);
    process.exitCode = 1;
})
    .finally(async () => {
    await pool.end();
});
