import "dotenv/config";
import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
const seedIncidents = [
    {
        id: "9c560cc7-ee68-4cd3-b5ef-ece3f689f5a7",
        title: "Armed clash reported near transport corridor",
        description: "Multiple reports of armed engagement affecting a strategic route.",
        occurredAt: "2026-04-08T10:20:00Z",
        countryCode: "NG",
        countryName: "Nigeria",
        regionName: "Borno",
        cityName: "Maiduguri",
        latitude: 11.8333,
        longitude: 13.1500,
        incidentCategory: "armed_clash",
        attackType: "small_arms",
        targetType: "infrastructure",
        killedCount: 6,
        injuredCount: 14,
        confidenceLevel: 3,
        verificationStatus: "verified"
    },
    {
        id: "f09a50b0-0a7b-4f1b-bad9-8ac03c3552f8",
        title: "Explosion in market district",
        description: "Blast event with civilian casualties; investigations ongoing.",
        occurredAt: "2026-04-09T14:05:00Z",
        countryCode: "IQ",
        countryName: "Iraq",
        regionName: "Baghdad Governorate",
        cityName: "Baghdad",
        latitude: 33.3152,
        longitude: 44.3661,
        incidentCategory: "bombing",
        attackType: "ied",
        targetType: "civilians",
        killedCount: 9,
        injuredCount: 21,
        confidenceLevel: 2,
        verificationStatus: "pending"
    },
    {
        id: "403ae8ca-46fe-4f88-ad7f-5f6779ff8433",
        title: "Checkpoint attack on security forces",
        description: "Assault on checkpoint resulting in casualties among responders.",
        occurredAt: "2026-04-10T06:45:00Z",
        countryCode: "SO",
        countryName: "Somalia",
        regionName: "Banaadir",
        cityName: "Mogadishu",
        latitude: 2.0469,
        longitude: 45.3182,
        incidentCategory: "terror_attack",
        attackType: "complex_attack",
        targetType: "security_forces",
        killedCount: 12,
        injuredCount: 8,
        confidenceLevel: 2,
        verificationStatus: "verified"
    }
];
async function ensureAdminUser() {
    const adminId = randomUUID();
    await pool.query(`
    INSERT INTO users (id, email, role)
    VALUES ($1, $2, $3)
    ON CONFLICT (email)
    DO NOTHING
    `, [adminId, "admin@crisisworld.local", "admin"]);
}
async function upsertIncidents() {
    for (const incident of seedIncidents) {
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
        verification_status
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
        $16,
        $17
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
        updated_at = now()
      `, [
            incident.id,
            incident.title,
            incident.description,
            incident.occurredAt,
            incident.countryCode,
            incident.countryName,
            incident.regionName,
            incident.cityName,
            incident.longitude,
            incident.latitude,
            incident.incidentCategory,
            incident.attackType,
            incident.targetType,
            incident.killedCount,
            incident.injuredCount,
            incident.confidenceLevel,
            incident.verificationStatus
        ]);
    }
}
async function run() {
    await ensureAdminUser();
    await upsertIncidents();
    console.log(`Seed complete. Upserted ${seedIncidents.length} incidents.`);
}
run()
    .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
})
    .finally(async () => {
    await pool.end();
});
